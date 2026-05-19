import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../db.js'
import { getMonitorStatus, getHealthSummary, getAlerts, acknowledgeAlert, clearAlerts, triggerHealthCheck, resetApiMetrics } from '../../monitor.js'
import { getBackupStatus, runBackup, deleteBackupFile } from '../../backup.js'
/**
 * healthRoutes
 */
export function registerHealthRoutes(app, ctx) {
  const {
    signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken,
    authLimiter,
  } = ctx

app.get('/api/health', async (req, res) => {
  try {
    const summary = getHealthSummary()
    const statusCode = summary.status === 'critical' ? 503 : 200
    res.status(statusCode).json(summary)
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message })
  }
})

// 管理员：完整监控状态
app.get('/api/admin/monitor/status', requireAdmin, (req, res) => {
  try {
    res.json(getMonitorStatus())
  } catch (err) {
    res.status(500).json({ error: '获取监控状态失败: ' + err.message })
  }
})

// 管理员：手动触发健康检测
app.post('/api/admin/monitor/check', requireAdmin, async (req, res) => {
  try {
    const result = await triggerHealthCheck()
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: '健康检测失败: ' + err.message })
  }
})

// 管理员：获取告警列表
app.get('/api/admin/monitor/alerts', requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit || '50')
  const level = req.query.level || null
  res.json({ alerts: getAlerts(limit, level) })
})

// 管理员：确认告警
app.put('/api/admin/monitor/alerts/:id/acknowledge', requireAdmin, (req, res) => {
  const ok = acknowledgeAlert(req.params.id)
  res.json({ success: ok })
})

// 管理员：清空告警
app.delete('/api/admin/monitor/alerts', requireAdmin, (req, res) => {
  const count = clearAlerts()
  res.json({ success: true, cleared: count })
})

// 管理员：重置 API 指标
app.post('/api/admin/monitor/reset-api-metrics', requireAdmin, (req, res) => {
  resetApiMetrics()
  res.json({ success: true })
})

// ========== 数据备份 API ==========

// 管理员：获取备份状态
app.get('/api/admin/backup/status', requireAdmin, (req, res) => {
  try {
    res.json(getBackupStatus())
  } catch (err) {
    res.status(500).json({ error: '获取备份状态失败: ' + err.message })
  }
})

// 管理员：手动触发备份
app.post('/api/admin/backup/run', requireAdmin, async (req, res) => {
  try {
    const result = await runBackup({ type: 'manual' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: '备份失败: ' + err.message })
  }
})

// 管理员：删除备份文件
app.delete('/api/admin/backup/:filename', requireAdmin, (req, res) => {
  const result = deleteBackupFile(req.params.filename)
  res.status(result.success ? 200 : 400).json(result)
})

// ========== 日程安排 API ==========

// --- 管理员: 获取所有日程 ---
app.get('/api/schedules', requireAdmin, async (req, res) => {
  try {
    const schedules = await getSchedules()
    res.json({ schedules })
  } catch (err) {
    console.error('获取日程失败:', err)
    res.status(500).json({ error: '获取日程失败' })
  }
})

// --- 管理员: 创建日程 ---
app.post('/api/schedules', requireAdmin, async (req, res) => {
  try {
    const { title, description, scheduledTime, type, status } = req.body
    if (!title || !scheduledTime) {
      return res.status(400).json({ error: '标题和时间是必填的' })
    }
    const id = await createSchedule({ title, description, scheduledTime, type, status })
    res.json({ success: true, id })
  } catch (err) {
    console.error('创建日程失败:', err)
    res.status(500).json({ error: '创建日程失败' })
  }
})

// --- 管理员: 更新日程 ---
app.put('/api/schedules/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, scheduledTime, type, status } = req.body
    await updateSchedule(id, { title, description, scheduledTime, type, status })
    res.json({ success: true })
  } catch (err) {
    console.error('更新日程失败:', err)
    res.status(500).json({ error: '更新日程失败' })
  }
})

// --- 管理员: 删除日程 ---
app.delete('/api/schedules/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await deleteSchedule(id)
    res.json({ success: true })
  } catch (err) {
    console.error('删除日程失败:', err)
    res.status(500).json({ error: '删除日程失败' })
  }
})
}
