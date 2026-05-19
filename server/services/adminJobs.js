import { randomUUID } from 'crypto'
import { getPool } from '../db/init.js'

const JOB_TYPES = new Set([
  'mall_ai_generate',
  'mall_batch_optimize',
  'mall_optimize_one',
])

const MALL_JOB_TYPES = ['mall_ai_generate', 'mall_batch_optimize', 'mall_optimize_one']

/** 默认：超过 5 分钟无进度更新视为僵死（进程重启或 AI 调用挂起） */
const DEFAULT_STALE_MS = 5 * 60 * 1000

function parseMeta(raw) {
  if (!raw) return {}
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return {}
  }
}

function rowToJob(r) {
  let result = null
  if (r.result_json) {
    try {
      result = typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json
    } catch { result = null }
  }
  const meta = parseMeta(r.meta_json)
  const log = Array.isArray(meta.log) ? meta.log : []
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    phase: r.phase || '',
    message: r.message || '',
    current: r.current_step ?? 0,
    total: r.total_steps ?? 0,
    result,
    error: r.error || null,
    meta,
    log,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  }
}

async function readMeta(pool, id) {
  const [rows] = await pool.execute('SELECT meta_json FROM admin_jobs WHERE id = ? LIMIT 1', [id])
  if (!rows.length) return {}
  return parseMeta(rows[0].meta_json)
}

async function appendJobLog(pool, id, text, phase) {
  const meta = await readMeta(pool, id)
  const log = Array.isArray(meta.log) ? [...meta.log] : []
  log.push({
    t: new Date().toISOString(),
    phase: phase || '',
    text: String(text).slice(0, 300),
  })
  if (log.length > 80) log.splice(0, log.length - 80)
  meta.log = log
  await pool.execute(
    'UPDATE admin_jobs SET meta_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(meta), id],
  )
}

/** 将长时间无更新的 running 任务标记为失败，避免永远 409 */
export async function recoverStaleAdminJobs(staleMs = DEFAULT_STALE_MS) {
  const pool = getPool()
  const sec = Math.max(60, Math.floor(staleMs / 1000))
  const staleError = `任务超时或进程已中断（超过 ${Math.round(sec / 60)} 分钟无进度），已自动结束，可重新发起`
  const [result] = await pool.execute(
    `UPDATE admin_jobs SET status = 'failed', phase = 'stale',
       error = ?, message = '任务已超时结束', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'running' AND updated_at < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [staleError, sec],
  )
  return result.affectedRows || 0
}

export async function createAdminJob(type, meta = {}) {
  if (!JOB_TYPES.has(type)) throw new Error('invalid job type')
  const pool = getPool()
  const id = randomUUID()
  const initialMeta = { ...(meta || {}), log: [{ t: new Date().toISOString(), phase: 'starting', text: '任务已创建，等待执行…' }] }
  await pool.execute(
    `INSERT INTO admin_jobs (id, type, status, phase, message, current_step, total_steps, meta_json)
     VALUES (?, ?, 'running', 'starting', '任务已开始…', 0, 0, ?)`,
    [id, type, JSON.stringify(initialMeta)],
  )
  return id
}

export async function updateAdminJobProgress(id, patch = {}) {
  const pool = getPool()
  const fields = []
  const vals = []
  if (patch.phase != null) { fields.push('phase = ?'); vals.push(patch.phase) }
  if (patch.message != null) {
    fields.push('message = ?')
    vals.push(String(patch.message).slice(0, 500))
    await appendJobLog(pool, id, patch.message, patch.phase)
  }
  if (patch.current != null) { fields.push('current_step = ?'); vals.push(patch.current) }
  if (patch.total != null) { fields.push('total_steps = ?'); vals.push(patch.total) }
  if (patch.status != null) { fields.push('status = ?'); vals.push(patch.status) }
  if (patch.result != null) { fields.push('result_json = ?'); vals.push(JSON.stringify(patch.result)) }
  if (patch.error != null) { fields.push('error = ?'); vals.push(String(patch.error).slice(0, 2000)) }
  if (!fields.length) return
  vals.push(id)
  await pool.execute(`UPDATE admin_jobs SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, vals)
}

export async function getAdminJob(id) {
  const pool = getPool()
  const [rows] = await pool.execute('SELECT * FROM admin_jobs WHERE id = ? LIMIT 1', [id])
  if (!rows.length) return null
  return rowToJob(rows[0])
}

export async function hasRunningJobOfType(type) {
  await recoverStaleAdminJobs()
  const pool = getPool()
  const [rows] = await pool.execute(
    `SELECT id FROM admin_jobs WHERE type = ? AND status = 'running' ORDER BY created_at DESC LIMIT 1`,
    [type],
  )
  return rows.length ? rows[0].id : null
}

/** 任意商城 AI 任务进行中时返回该任务（用于统一展示进度、避免 409 无 jobId） */
export async function getActiveMallJob() {
  await recoverStaleAdminJobs()
  const pool = getPool()
  const placeholders = MALL_JOB_TYPES.map(() => '?').join(',')
  const [rows] = await pool.execute(
    `SELECT * FROM admin_jobs WHERE type IN (${placeholders}) AND status = 'running'
     ORDER BY updated_at DESC LIMIT 1`,
    MALL_JOB_TYPES,
  )
  if (!rows.length) return null
  return rowToJob(rows[0])
}

export async function cancelAdminJob(id, reason = '用户手动取消') {
  const job = await getAdminJob(id)
  if (!job) return false
  if (job.status !== 'running') return false
  const pool = getPool()
  await appendJobLog(pool, id, reason, 'cancelled')
  await updateAdminJobProgress(id, {
    status: 'failed',
    phase: 'cancelled',
    message: '任务已取消',
    error: reason,
  })
  return true
}

export const MALL_JOB_TITLES = {
  mall_ai_generate: 'AI 自动生成商品',
  mall_batch_optimize: 'AI 批量优化商品',
  mall_optimize_one: 'AI 优化单个商品',
}
