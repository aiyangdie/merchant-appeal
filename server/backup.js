/**
 * 数据备份策略系统 (Database Backup System)
 * 
 * 核心功能：
 * 1. 定时自动备份 — 每日凌晨自动导出数据库
 * 2. 手动触发备份 — 管理员可随时触发
 * 3. 备份文件管理 — 自动清理过期备份
 * 4. 备份状态追踪 — 记录每次备份的状态和大小
 * 5. 关键表优先备份 — users/sessions/messages/appeal_texts 优先
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './db.js'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ========== 配置 ==========

const BACKUP_CONFIG = {
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'),
  maxBackupFiles: parseInt(process.env.BACKUP_MAX_FILES || '30'),
  autoBackupHour: parseInt(process.env.BACKUP_HOUR || '3'),
  autoBackupEnabled: process.env.BACKUP_AUTO !== 'false',
  compressBackup: true,
  // 关键表（优先备份）
  criticalTables: [
    'users', 'sessions', 'messages', 'appeal_texts',
    'success_cases', 'system_config', 'admins',
    'recharge_orders', 'token_usage', 'ai_rules',
  ],
}

// ========== 状态 ==========

const _backupState = {
  lastBackup: null,
  lastBackupFile: null,
  lastBackupSize: null,
  lastBackupDuration: null,
  isRunning: false,
  history: [],       // 最近50次备份记录
  schedulerActive: false,
}

let _backupTimer = null

// ========== 1. SQL 导出备份（纯 SQL 方式，不依赖 mysqldump） ==========

async function exportTableToSQL(tableName) {
  const pool = getPool()
  if (!pool) throw new Error('数据库连接池未初始化')

  let sql = ''

  // 获取建表语句
  try {
    const [createResult] = await pool.execute(`SHOW CREATE TABLE \`${tableName}\``)
    if (createResult.length > 0) {
      sql += `-- Table: ${tableName}\n`
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`
      sql += createResult[0]['Create Table'] + ';\n\n'
    }
  } catch (err) {
    sql += `-- Error getting CREATE TABLE for ${tableName}: ${err.message}\n\n`
    return sql
  }

  // 导出数据（分批次，每次1000行）
  const batchSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM \`${tableName}\` LIMIT ${batchSize} OFFSET ${offset}`
      )
      if (rows.length === 0) {
        hasMore = false
        break
      }

      // 构建 INSERT 语句
      const columns = Object.keys(rows[0])
      const colList = columns.map(c => `\`${c}\``).join(', ')

      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col]
          if (val === null || val === undefined) return 'NULL'
          if (typeof val === 'number') return val.toString()
          if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`
          // 转义字符串
          const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
          return `'${escaped}'`
        })
        sql += `INSERT INTO \`${tableName}\` (${colList}) VALUES (${values.join(', ')});\n`
      }

      offset += batchSize
      if (rows.length < batchSize) hasMore = false
    } catch (err) {
      sql += `-- Error exporting data from ${tableName} at offset ${offset}: ${err.message}\n`
      hasMore = false
    }
  }

  sql += '\n'
  return sql
}

// ========== 2. 执行备份 ==========

export async function runBackup(options = {}) {
  if (_backupState.isRunning) {
    return { success: false, error: '备份正在进行中，请稍后再试' }
  }

  _backupState.isRunning = true
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `backup_${timestamp}.sql`
  const filepath = path.join(BACKUP_CONFIG.backupDir, filename)

  const record = {
    id: Date.now().toString(36),
    timestamp: new Date().toISOString(),
    filename,
    filepath,
    type: options.type || 'manual',
    status: 'running',
    tables: 0,
    rows: 0,
    sizeBytes: 0,
    durationMs: 0,
    error: null,
  }

  try {
    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_CONFIG.backupDir)) {
      fs.mkdirSync(BACKUP_CONFIG.backupDir, { recursive: true })
    }

    const pool = getPool()
    if (!pool) throw new Error('数据库连接池未初始化')

    // 获取所有表名
    const [tables] = await pool.execute('SHOW TABLES')
    const dbName = process.env.DB_NAME || 'merchant_appeal'
    const tableKey = `Tables_in_${dbName}`
    const tableNames = tables.map(t => t[tableKey] || Object.values(t)[0]).filter(Boolean)

    // 排序：关键表优先
    tableNames.sort((a, b) => {
      const ai = BACKUP_CONFIG.criticalTables.indexOf(a)
      const bi = BACKUP_CONFIG.criticalTables.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b)
    })

    let fullSQL = `-- Merchant Appeal Database Backup\n`
    fullSQL += `-- Generated: ${new Date().toISOString()}\n`
    fullSQL += `-- Database: ${dbName}\n`
    fullSQL += `-- Tables: ${tableNames.length}\n`
    fullSQL += `-- ==========================================\n\n`
    fullSQL += `SET NAMES utf8mb4;\n`
    fullSQL += `SET FOREIGN_KEY_CHECKS = 0;\n\n`

    let totalRows = 0
    for (const table of tableNames) {
      console.log(`[Backup] 导出表: ${table}`)
      const tableSQL = await exportTableToSQL(table)
      fullSQL += tableSQL

      // 粗略统计行数
      const insertCount = (tableSQL.match(/^INSERT INTO/gm) || []).length
      totalRows += insertCount
      record.tables++
    }

    fullSQL += `SET FOREIGN_KEY_CHECKS = 1;\n`
    fullSQL += `-- Backup complete. Total tables: ${tableNames.length}, Total rows: ${totalRows}\n`

    // 写入文件
    fs.writeFileSync(filepath, fullSQL, 'utf8')

    const stats = fs.statSync(filepath)
    record.rows = totalRows
    record.sizeBytes = stats.size
    record.durationMs = Date.now() - startTime
    record.status = 'success'

    _backupState.lastBackup = record.timestamp
    _backupState.lastBackupFile = filename
    _backupState.lastBackupSize = stats.size
    _backupState.lastBackupDuration = record.durationMs

    console.log(`[Backup] 备份完成: ${filename} (${formatSize(stats.size)}, ${tableNames.length}表, ${totalRows}行, ${record.durationMs}ms)`)

    // 清理旧备份
    await cleanOldBackups()

  } catch (err) {
    record.status = 'failed'
    record.error = err.message
    record.durationMs = Date.now() - startTime
    console.error('[Backup] 备份失败:', err.message)
  } finally {
    _backupState.isRunning = false
    _backupState.history.unshift(record)
    if (_backupState.history.length > 50) _backupState.history.length = 50
  }

  return {
    success: record.status === 'success',
    ...record,
    sizeHuman: formatSize(record.sizeBytes),
  }
}

// ========== 3. 清理旧备份 ==========

async function cleanOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_CONFIG.backupDir)) return

    const files = fs.readdirSync(BACKUP_CONFIG.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_CONFIG.backupDir, f),
        time: fs.statSync(path.join(BACKUP_CONFIG.backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)

    if (files.length > BACKUP_CONFIG.maxBackupFiles) {
      const toDelete = files.slice(BACKUP_CONFIG.maxBackupFiles)
      for (const f of toDelete) {
        fs.unlinkSync(f.path)
        console.log(`[Backup] 清理旧备份: ${f.name}`)
      }
    }
  } catch (err) {
    console.error('[Backup] 清理旧备份失败:', err.message)
  }
}

// ========== 4. 定时备份调度 ==========

export function startBackupScheduler() {
  if (!BACKUP_CONFIG.autoBackupEnabled) {
    console.log('[Backup] 自动备份已禁用（设置 BACKUP_AUTO=true 启用）')
    return
  }
  if (_backupState.schedulerActive) return

  _backupState.schedulerActive = true

  function scheduleNext() {
    const now = new Date()
    const target = new Date(now)
    target.setHours(BACKUP_CONFIG.autoBackupHour, 0, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const delay = target.getTime() - now.getTime()

    console.log(`[Backup] 下次自动备份时间: ${target.toLocaleString('zh-CN')} (${Math.round(delay / 3600000)}小时后)`)

    _backupTimer = setTimeout(async () => {
      console.log('[Backup] 开始定时自动备份...')
      await runBackup({ type: 'auto' })
      scheduleNext()
    }, delay)
  }

  scheduleNext()
}

export function stopBackupScheduler() {
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
  _backupState.schedulerActive = false
  console.log('[Backup] 自动备份调度已停止')
}

// ========== 5. 备份列表与状态 ==========

export function getBackupStatus() {
  // 扫描备份目录获取文件列表
  let files = []
  try {
    if (fs.existsSync(BACKUP_CONFIG.backupDir)) {
      files = fs.readdirSync(BACKUP_CONFIG.backupDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
        .map(f => {
          const fp = path.join(BACKUP_CONFIG.backupDir, f)
          const stats = fs.statSync(fp)
          return {
            filename: f,
            sizeBytes: stats.size,
            sizeHuman: formatSize(stats.size),
            createdAt: stats.mtime.toISOString(),
          }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
  } catch { /* 忽略 */ }

  return {
    isRunning: _backupState.isRunning,
    schedulerActive: _backupState.schedulerActive,
    autoBackupHour: BACKUP_CONFIG.autoBackupHour,
    maxFiles: BACKUP_CONFIG.maxBackupFiles,
    backupDir: BACKUP_CONFIG.backupDir,
    lastBackup: _backupState.lastBackup,
    lastBackupFile: _backupState.lastBackupFile,
    lastBackupSize: _backupState.lastBackupSize ? formatSize(_backupState.lastBackupSize) : null,
    lastBackupDuration: _backupState.lastBackupDuration,
    totalBackupFiles: files.length,
    totalBackupSize: formatSize(files.reduce((s, f) => s + f.sizeBytes, 0)),
    files: files.slice(0, 20),
    history: _backupState.history.slice(0, 20),
  }
}

export function deleteBackupFile(filename) {
  if (!filename || !filename.startsWith('backup_') || !filename.endsWith('.sql')) {
    return { success: false, error: '无效的备份文件名' }
  }
  const filepath = path.join(BACKUP_CONFIG.backupDir, filename)
  if (!fs.existsSync(filepath)) {
    return { success: false, error: '备份文件不存在' }
  }
  try {
    fs.unlinkSync(filepath)
    return { success: true, message: `已删除备份文件: ${filename}` }
  } catch (err) {
    return { success: false, error: `删除失败: ${err.message}` }
  }
}

// ========== 工具函数 ==========

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}