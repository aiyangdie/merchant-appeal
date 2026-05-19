/**
 * 监控告警系统 (Monitor & Alert System)
 * 
 * 核心功能：
 * 1. 系统健康检测 — CPU/内存/磁盘/进程运行时间
 * 2. 数据库连接监控 — 连接池状态/查询延迟
 * 3. API 响应时间追踪 — 慢请求记录/错误率统计
 * 4. 告警通知 — Webhook/日志/邮件通知
 * 5. 健康检查端点 — /api/health 供外部监控调用
 * 6. 定时巡检 — 可配置间隔自动检测
 */

import os from 'os'
import { getPool } from './db.js'

// ========== 配置 ==========

const MONITOR_CONFIG = {
  checkIntervalMs: 60 * 1000,          // 检测间隔：1分钟
  memoryWarningPercent: 85,             // 内存使用超过85%告警
  memoryCriticalPercent: 95,            // 内存使用超过95%严重告警
  heapWarningMB: 512,                   // Node堆内存超过512MB告警
  heapCriticalMB: 1024,                 // Node堆内存超过1GB严重告警
  dbQueryTimeoutMs: 5000,               // 数据库查询超时5秒告警
  dbPoolWarningPercent: 80,             // 连接池使用超过80%告警
  apiSlowThresholdMs: 3000,             // API响应超过3秒算慢请求
  apiErrorRateWarning: 0.05,            // 错误率超过5%告警
  maxAlertHistorySize: 500,             // 最多保留500条告警记录
  webhookUrl: process.env.MONITOR_WEBHOOK_URL || '',
  webhookSecret: process.env.MONITOR_WEBHOOK_SECRET || '',
  enableConsoleAlerts: true,
}

// ========== 状态存储 ==========

const _state = {
  startTime: Date.now(),
  lastCheck: null,
  alerts: [],                           // 告警历史
  apiMetrics: {                         // API指标
    totalRequests: 0,
    totalErrors: 0,
    slowRequests: 0,
    avgResponseMs: 0,
    _responseTimes: [],                 // 最近1000次响应时间
  },
  dbMetrics: {                          // 数据库指标
    totalQueries: 0,
    failedQueries: 0,
    avgQueryMs: 0,
    lastPingMs: null,
    poolStatus: null,
  },
  systemMetrics: null,                  // 最近一次系统指标
  isRunning: false,
}

let _checkTimer = null

// ========== 1. 系统指标采集 ==========

function collectSystemMetrics() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memPercent = (usedMem / totalMem * 100).toFixed(1)

  const cpus = os.cpus()
  let cpuIdle = 0, cpuTotal = 0
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      cpuTotal += cpu.times[type]
    }
    cpuIdle += cpu.times.idle
  }
  const cpuPercent = ((1 - cpuIdle / cpuTotal) * 100).toFixed(1)

  const heap = process.memoryUsage()
  const uptimeSec = process.uptime()

  return {
    timestamp: new Date().toISOString(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuCount: cpus.length,
      cpuPercent: parseFloat(cpuPercent),
      totalMemMB: Math.round(totalMem / 1024 / 1024),
      usedMemMB: Math.round(usedMem / 1024 / 1024),
      freeMemMB: Math.round(freeMem / 1024 / 1024),
      memPercent: parseFloat(memPercent),
      loadAvg: os.loadavg(),
    },
    process: {
      pid: process.pid,
      uptimeSeconds: Math.round(uptimeSec),
      uptimeHuman: formatUptime(uptimeSec),
      heapUsedMB: Math.round(heap.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(heap.heapTotal / 1024 / 1024),
      rssMB: Math.round(heap.rss / 1024 / 1024),
      externalMB: Math.round((heap.external || 0) / 1024 / 1024),
    },
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}小时`)
  parts.push(`${m}分钟`)
  return parts.join('')
}

// ========== 2. 数据库健康检测 ==========

async function checkDatabase() {
  const pool = getPool()
  if (!pool) {
    return { status: 'error', error: '数据库连接池未初始化', pingMs: null, poolInfo: null }
  }

  const result = { status: 'healthy', error: null, pingMs: null, poolInfo: null }

  // Ping 测试
  const pingStart = Date.now()
  try {
    await pool.execute('SELECT 1')
    result.pingMs = Date.now() - pingStart
  } catch (err) {
    result.status = 'error'
    result.error = `数据库Ping失败: ${err.message}`
    result.pingMs = Date.now() - pingStart
  }

  // 连接池状态
  try {
    const poolInternal = pool.pool
    if (poolInternal) {
      result.poolInfo = {
        totalConnections: poolInternal._allConnections?.length || 0,
        freeConnections: poolInternal._freeConnections?.length || 0,
        queueLength: poolInternal._connectionQueue?.length || 0,
        connectionLimit: poolInternal.config?.connectionLimit || 10,
      }
      const usedPercent = result.poolInfo.totalConnections > 0
        ? ((result.poolInfo.totalConnections - result.poolInfo.freeConnections) / result.poolInfo.connectionLimit * 100)
        : 0
      result.poolInfo.usedPercent = Math.round(usedPercent)
    }
  } catch { /* mysql2 内部结构可能变化，忽略 */ }

  _state.dbMetrics.lastPingMs = result.pingMs
  _state.dbMetrics.poolStatus = result.poolInfo

  return result
}

// ========== 3. API 指标中间件 ==========

export function apiMetricsMiddleware(req, res, next) {
  const start = Date.now()
  const originalEnd = res.end

  res.end = function (...args) {
    const duration = Date.now() - start
    _state.apiMetrics.totalRequests++

    if (res.statusCode >= 500) {
      _state.apiMetrics.totalErrors++
    }
    if (duration > MONITOR_CONFIG.apiSlowThresholdMs) {
      _state.apiMetrics.slowRequests++
      console.warn(`[Monitor] 慢请求: ${req.method} ${req.path} ${duration}ms (状态码: ${res.statusCode})`)
    }

    // 保留最近1000次响应时间
    const times = _state.apiMetrics._responseTimes
    times.push(duration)
    if (times.length > 1000) times.shift()
    _state.apiMetrics.avgResponseMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length)

    originalEnd.apply(res, args)
  }
  next()
}

// ========== 4. 告警引擎 ==========

function addAlert(level, category, message, details = null) {
  const alert = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    level,      // 'info' | 'warning' | 'critical'
    category,   // 'system' | 'database' | 'api' | 'memory' | 'process'
    message,
    details,
    acknowledged: false,
  }

  _state.alerts.unshift(alert)
  if (_state.alerts.length > MONITOR_CONFIG.maxAlertHistorySize) {
    _state.alerts.length = MONITOR_CONFIG.maxAlertHistorySize
  }

  if (MONITOR_CONFIG.enableConsoleAlerts) {
    const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵'
    console.log(`${icon} [Monitor Alert] [${level.toUpperCase()}] [${category}] ${message}`)
  }

  // 异步发送 Webhook 通知（不阻塞）
  if (MONITOR_CONFIG.webhookUrl && (level === 'warning' || level === 'critical')) {
    sendWebhookAlert(alert).catch(() => {})
  }

  return alert
}

async function sendWebhookAlert(alert) {
  if (!MONITOR_CONFIG.webhookUrl) return

  try {
    const body = {
      type: 'monitor_alert',
      app: '商户号申诉助手',
      alert,
      server: os.hostname(),
      timestamp: alert.timestamp,
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    await fetch(MONITOR_CONFIG.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MONITOR_CONFIG.webhookSecret ? { 'X-Webhook-Secret': MONITOR_CONFIG.webhookSecret } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
  } catch (err) {
    console.error('[Monitor] Webhook发送失败:', err.message)
  }
}

// ========== 5. 综合健康检查 ==========

async function runHealthCheck() {
  const metrics = collectSystemMetrics()
  _state.systemMetrics = metrics
  _state.lastCheck = new Date().toISOString()

  // 内存告警
  if (metrics.system.memPercent >= MONITOR_CONFIG.memoryCriticalPercent) {
    addAlert('critical', 'memory', `系统内存使用率 ${metrics.system.memPercent}% 超过临界值 ${MONITOR_CONFIG.memoryCriticalPercent}%`, metrics.system)
  } else if (metrics.system.memPercent >= MONITOR_CONFIG.memoryWarningPercent) {
    addAlert('warning', 'memory', `系统内存使用率 ${metrics.system.memPercent}% 超过警戒值 ${MONITOR_CONFIG.memoryWarningPercent}%`, metrics.system)
  }

  // Node堆内存告警
  if (metrics.process.heapUsedMB >= MONITOR_CONFIG.heapCriticalMB) {
    addAlert('critical', 'process', `Node堆内存 ${metrics.process.heapUsedMB}MB 超过临界值 ${MONITOR_CONFIG.heapCriticalMB}MB`, metrics.process)
  } else if (metrics.process.heapUsedMB >= MONITOR_CONFIG.heapWarningMB) {
    addAlert('warning', 'process', `Node堆内存 ${metrics.process.heapUsedMB}MB 超过警戒值 ${MONITOR_CONFIG.heapWarningMB}MB`, metrics.process)
  }

  // 数据库检测
  const dbResult = await checkDatabase()
  if (dbResult.status === 'error') {
    addAlert('critical', 'database', dbResult.error || '数据库连接异常', dbResult)
  } else if (dbResult.pingMs > MONITOR_CONFIG.dbQueryTimeoutMs) {
    addAlert('warning', 'database', `数据库响应缓慢: ${dbResult.pingMs}ms`, dbResult)
  }
  if (dbResult.poolInfo && dbResult.poolInfo.usedPercent >= MONITOR_CONFIG.dbPoolWarningPercent) {
    addAlert('warning', 'database', `数据库连接池使用率 ${dbResult.poolInfo.usedPercent}% 超过警戒值`, dbResult.poolInfo)
  }

  // API 错误率检测
  const { totalRequests, totalErrors } = _state.apiMetrics
  if (totalRequests > 100) {
    const errorRate = totalErrors / totalRequests
    if (errorRate >= MONITOR_CONFIG.apiErrorRateWarning) {
      addAlert('warning', 'api', `API错误率 ${(errorRate * 100).toFixed(1)}% 超过警戒值 ${(MONITOR_CONFIG.apiErrorRateWarning * 100)}%`,
        { totalRequests, totalErrors, errorRate: errorRate.toFixed(4) })
    }
  }

  return { metrics, db: dbResult, api: _state.apiMetrics }
}

// ========== 6. 定时巡检调度 ==========

export function startMonitorScheduler(intervalMinutes = 1) {
  if (_state.isRunning) return
  _state.isRunning = true

  const intervalMs = intervalMinutes * 60 * 1000
  console.log(`[Monitor] 监控巡检已启动，间隔 ${intervalMinutes} 分钟`)

  // 立即执行首次检测
  runHealthCheck().catch(err => console.error('[Monitor] 首次检测失败:', err.message))

  _checkTimer = setInterval(() => {
    runHealthCheck().catch(err => console.error('[Monitor] 定时检测失败:', err.message))
  }, intervalMs)
}

export function stopMonitorScheduler() {
  if (_checkTimer) {
    clearInterval(_checkTimer)
    _checkTimer = null
  }
  _state.isRunning = false
  console.log('[Monitor] 监控巡检已停止')
}

// ========== 7. API 数据接口 ==========

export function getMonitorStatus() {
  return {
    serverStartTime: new Date(_state.startTime).toISOString(),
    lastCheckTime: _state.lastCheck,
    isMonitoring: _state.isRunning,
    system: _state.systemMetrics,
    api: {
      totalRequests: _state.apiMetrics.totalRequests,
      totalErrors: _state.apiMetrics.totalErrors,
      slowRequests: _state.apiMetrics.slowRequests,
      avgResponseMs: _state.apiMetrics.avgResponseMs,
      errorRate: _state.apiMetrics.totalRequests > 0
        ? (_state.apiMetrics.totalErrors / _state.apiMetrics.totalRequests).toFixed(4)
        : '0.0000',
    },
    database: {
      lastPingMs: _state.dbMetrics.lastPingMs,
      poolStatus: _state.dbMetrics.poolStatus,
    },
    recentAlerts: _state.alerts.slice(0, 20),
  }
}

export function getHealthSummary() {
  const sys = _state.systemMetrics
  const criticalAlerts = _state.alerts.filter(a => a.level === 'critical' && !a.acknowledged).length
  const warningAlerts = _state.alerts.filter(a => a.level === 'warning' && !a.acknowledged).length

  let status = 'healthy'
  if (criticalAlerts > 0) status = 'critical'
  else if (warningAlerts > 0) status = 'degraded'

  return {
    status,
    uptime: sys?.process?.uptimeHuman || 'unknown',
    uptimeSeconds: sys?.process?.uptimeSeconds || 0,
    memPercent: sys?.system?.memPercent || 0,
    heapMB: sys?.process?.heapUsedMB || 0,
    dbPingMs: _state.dbMetrics.lastPingMs,
    apiAvgMs: _state.apiMetrics.avgResponseMs,
    apiErrorRate: _state.apiMetrics.totalRequests > 0
      ? parseFloat((_state.apiMetrics.totalErrors / _state.apiMetrics.totalRequests * 100).toFixed(2))
      : 0,
    activeAlerts: { critical: criticalAlerts, warning: warningAlerts },
  }
}

export function getAlerts(limit = 50, level = null) {
  let alerts = _state.alerts
  if (level) alerts = alerts.filter(a => a.level === level)
  return alerts.slice(0, limit)
}

export function acknowledgeAlert(alertId) {
  const alert = _state.alerts.find(a => a.id === alertId)
  if (alert) {
    alert.acknowledged = true
    return true
  }
  return false
}

export function clearAlerts() {
  const count = _state.alerts.length
  _state.alerts = []
  return count
}

export function resetApiMetrics() {
  _state.apiMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    slowRequests: 0,
    avgResponseMs: 0,
    _responseTimes: [],
  }
}

// ========== 8. 手动触发检测 ==========

export async function triggerHealthCheck() {
  return await runHealthCheck()
}