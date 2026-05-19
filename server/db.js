/**
 * 数据访问层 — 连接初始化见 server/db/init.js
 */
import bcrypt from 'bcryptjs'
import { getPool } from './db/init.js'
export { getPool, initDatabase } from './db/init.js'
export { DB_CONFIG } from './db/pool.js'

import { encrypt, decrypt, safeEncrypt, safeDecrypt, hmacHash } from './utils/crypto.js'

/** 系统配置中需加密存储的字段 */
const SENSITIVE_SYS_KEYS = [
  'deepseek_api_key',
  'zhipu_api_key',
  'siliconflow_api_key',
  'xianyu_app_secret',
]

/** 支付配置中需加密存储的字段 */
const SENSITIVE_PAY_KEYS = [
  'wx_api_key',
  'wx_api_v3_key',
  'wx_private_key',
  'wx_serial_no',
  'ali_private_key',
  'ali_public_key',
]

function safeParse(val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}

// ========== 会话 ==========

export async function createSession(id, userId = null, orderNo = null, orderData = null) {
  await getPool().execute(
    'INSERT INTO sessions (id, user_id, order_no, order_data, collected_data, step) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, orderNo, orderData ? JSON.stringify(orderData) : null, JSON.stringify({}), 0]
  )
  const [rows] = await getPool().execute('SELECT * FROM sessions WHERE id = ?', [id])
  rows[0].collected_data = safeParse(rows[0].collected_data)
  rows[0].order_data = safeParse(rows[0].order_data)
  return rows[0]
}

export async function getSession(id) {
  const [rows] = await getPool().execute('SELECT * FROM sessions WHERE id = ?', [id])
  if (rows.length === 0) return null
  rows[0].collected_data = safeParse(rows[0].collected_data)
  rows[0].order_data = safeParse(rows[0].order_data)
  return rows[0]
}

export async function updateSessionOrder(id, orderNo, orderData) {
  await getPool().execute(
    'UPDATE sessions SET order_no = ?, order_data = ? WHERE id = ?',
    [orderNo, orderData ? JSON.stringify(orderData) : null, id]
  )
}

export async function updateSession(id, step, collectedData) {
  await getPool().execute(
    'UPDATE sessions SET step = ?, collected_data = ? WHERE id = ?',
    [step, JSON.stringify(collectedData), id]
  )
}

/**
 * 行锁 + 浅合并 collected_data，避免并发写覆盖丢字段
 * partial 中值为 null 表示删除该 key
 */
export async function patchSessionCollectedData(id, partial, step = null) {
  if (!partial || typeof partial !== 'object') return null
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute(
      'SELECT step, collected_data FROM sessions WHERE id = ? FOR UPDATE',
      [id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return null
    }
    const current = safeParse(rows[0].collected_data) || {}
    const merged = { ...current }
    for (const [key, value] of Object.entries(partial)) {
      if (value === null) delete merged[key]
      else merged[key] = value
    }
    const newStep = step != null ? step : rows[0].step
    await conn.execute(
      'UPDATE sessions SET step = ?, collected_data = ? WHERE id = ?',
      [newStep, JSON.stringify(merged), id]
    )
    await conn.commit()
    return { step: newStep, collected_data: merged }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export async function updateSessionStatus(id, status) {
  await getPool().execute('UPDATE sessions SET status = ? WHERE id = ?', [status, id])
}

export async function saveDeepAnalysisResult(sessionId, result) {
  await getPool().execute('UPDATE sessions SET deep_analysis_result = ? WHERE id = ?', [result, sessionId])
}

export async function getDeepAnalysisResult(sessionId) {
  const [rows] = await getPool().execute('SELECT deep_analysis_result FROM sessions WHERE id = ?', [sessionId])
  return rows[0]?.deep_analysis_result || null
}

export async function getAppealGuideSnapshot(sessionId) {
  const [rows] = await getPool().execute('SELECT appeal_guide_snapshot FROM sessions WHERE id = ?', [sessionId])
  const raw = rows[0]?.appeal_guide_snapshot
  return safeParse(raw)
}

export async function setAppealGuideSnapshot(sessionId, data) {
  await getPool().execute(
    'UPDATE sessions SET appeal_guide_snapshot = ? WHERE id = ?',
    [JSON.stringify(data), sessionId]
  )
}

// ========== 消息 ==========

export async function addMessage(sessionId, role, content) {
  await getPool().execute(
    'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
    [sessionId, role, content]
  )
}

export async function getMessages(sessionId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]
  )
  return rows
}

// ========== 前端用户 ==========

export function isChinese(str) {
  if (!str) return false
  return /^[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}]+$/u.test(str.trim())
}

/**
 * 解密用户行：phone / nickname / custom_api_key / last_ip
 */
function decryptUserRow(row) {
  if (!row) return null
  const phone = safeDecrypt(row.phone)
  const phoneMasked = phone ? phone.slice(0, 3) + '****' + phone.slice(-4) : null
  return {
    ...row,
    phone,
    phone_masked: phoneMasked,
    nickname: safeDecrypt(row.nickname),
    custom_api_key: safeDecrypt(row.custom_api_key),
    last_ip: safeDecrypt(row.last_ip),
  }
}

export async function registerUser(phone, nickname) {
  const hash = hmacHash(phone)
  const [existing] = await getPool().execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  if (existing.length > 0) return { user: decryptUserRow(existing[0]), isNew: false }
  if (!nickname || !isChinese(nickname)) throw new Error('CHINESE_NAME_REQUIRED')
  const phoneEnc = encrypt(phone.trim())
  const nicknameEnc = encrypt(nickname.trim())
  await getPool().execute(
    'INSERT INTO users (phone, phone_hash, nickname) VALUES (?, ?, ?)',
    [phoneEnc, hash, nicknameEnc]
  )
  const [rows] = await getPool().execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  return { user: decryptUserRow(rows[0]), isNew: true }
}

export async function getUserByPhone(phone) {
  const hash = hmacHash(phone)
  const [rows] = await getPool().execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  return rows.length > 0 ? decryptUserRow(rows[0]) : null
}

export async function getUserById(id) {
  const [rows] = await getPool().execute('SELECT * FROM users WHERE id = ?', [id])
  return rows.length > 0 ? decryptUserRow(rows[0]) : null
}

export async function updateUserApiMode(userId, apiMode, customApiKey) {
  const encKey = customApiKey ? safeEncrypt(customApiKey) : ''
  await getPool().execute(
    'UPDATE users SET api_mode = ?, custom_api_key = ? WHERE id = ?',
    [apiMode, encKey, userId]
  )
}

export async function deductBalance(userId, amount, conn) {
  const db = conn || getPool()
  // 原子操作：UPDATE + WHERE balance >= amount 防止并发扣费导致余额为负
  const [result] = await db.execute(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
    [amount, userId, amount]
  )
  if (result.affectedRows === 0) {
    const user = await getUserById(userId)
    if (!user) return { success: false, error: '用户不存在' }
    return { success: false, error: '余额不足，请充值后再使用官方API' }
  }
  const user = await getUserById(userId)
  return { success: true, newBalance: parseFloat(user.balance).toFixed(2) }
}

export async function getAllUsers() {
  const [rows] = await getPool().execute(`
    SELECT u.id, u.phone, u.nickname, u.balance, u.api_mode, u.created_at,
      u.last_active_at, u.last_ip, u.login_count, u.total_messages, u.total_spent,
      (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as session_count
    FROM users u ORDER BY u.created_at DESC
  `)
  return rows.map(r => decryptUserRow(r))
}

export async function adjustUserBalance(userId, amount) {
  await getPool().execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId])
  const user = await getUserById(userId)
  return user
}

export async function fixEncryptedData() {
  const [rows] = await getPool().execute('SELECT id, phone, nickname FROM users')
  let fixed = 0
  for (const row of rows) {
    const phone = safeDecrypt(row.phone)
    const nickname = safeDecrypt(row.nickname)
    if (phone === '[数据待恢复]' || nickname === '[数据待恢复]') {
      const placeholderPhone = `用户${row.id}`
      const placeholderNick = `用户${row.id}`
      await getPool().execute('UPDATE users SET phone = ?, nickname = ?, phone_hash = ? WHERE id = ?',
        [safeEncrypt(placeholderPhone), safeEncrypt(placeholderNick), hmacHash(placeholderPhone), row.id])
      fixed++
    }
  }
  return { total: rows.length, fixed }
}

export async function deleteUser(userId) {
  // 删除用户的所有相关数据
  await getPool().execute('DELETE FROM user_actions WHERE user_id = ?', [userId])
  await getPool().execute('DELETE FROM token_usage WHERE user_id = ?', [userId])
  await getPool().execute('DELETE FROM recharge_orders WHERE user_id = ?', [userId])
  // 删除用户的会话及消息和申诉文案
  const [sessions] = await getPool().execute('SELECT id FROM sessions WHERE user_id = ?', [userId])
  for (const s of sessions) {
    await getPool().execute('DELETE FROM messages WHERE session_id = ?', [s.id])
    await getPool().execute('DELETE FROM appeal_texts WHERE session_id = ?', [s.id])
    await getPool().execute('DELETE FROM session_qa_reviews WHERE session_id = ?', [s.id])
  }
  await getPool().execute('DELETE FROM sessions WHERE user_id = ?', [userId])
  await getPool().execute('DELETE FROM users WHERE id = ?', [userId])
}

// ========== 用户会话历史 ==========

export async function getUserSessions(userId) {
  const [rows] = await getPool().execute(`
    SELECT s.id, s.created_at, s.status, s.step,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1) as first_message,
      (SELECT content FROM messages WHERE session_id = s.id
       ORDER BY created_at DESC LIMIT 1) as last_message
    FROM sessions s
    WHERE s.user_id = ?
      AND EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id AND m.role = 'user')
    ORDER BY s.created_at DESC
    LIMIT 50
  `, [userId])
  return rows
}

export async function lookupSessions(keyword, userId) {
  if (!userId) return []
  const like = `%${escapeLike(keyword)}%`
  const [rows] = await getPool().execute(`
    SELECT s.id, s.created_at, s.status, s.step,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1) as first_message
    FROM sessions s
    WHERE s.user_id = ? AND (
       s.id = ?
       OR s.id LIKE ?
       OR EXISTS (
         SELECT 1 FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user' AND m.content LIKE ?
       )
    )
    ORDER BY s.created_at DESC
    LIMIT 20
  `, [userId, keyword, like, like])
  return rows.filter(r => r.message_count > 0)
}

// ========== 管理员 ==========

export async function getAllSessions() {
  const [rows] = await getPool().execute(`
    SELECT s.*,
      u.phone as user_phone, u.nickname as user_nickname,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1) as first_message
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id AND m.role = 'user')
    ORDER BY s.created_at DESC
    LIMIT 200
  `)
  return rows.map(r => ({
    ...r,
    user_phone: safeDecrypt(r.user_phone),
    user_nickname: safeDecrypt(r.user_nickname),
  }))
}

export { getSessionChatboardStats, CHATBOARD_METRIC_DEFINITIONS } from './services/chatboardStats.js'

export async function deleteSession(id) {
  await getPool().execute('DELETE FROM messages WHERE session_id = ?', [id])
  await getPool().execute('DELETE FROM appeal_texts WHERE session_id = ?', [id])
  await getPool().execute('DELETE FROM session_qa_reviews WHERE session_id = ?', [id])
  await getPool().execute('DELETE FROM sessions WHERE id = ?', [id])
}

export async function verifyAdmin(username, password) {
  const [rows] = await getPool().execute('SELECT * FROM admins WHERE username = ?', [username])
  if (rows.length === 0) return null
  const admin = rows[0]
  const match = bcrypt.compareSync(password, admin.password)
  return match ? admin : null
}

export async function changeAdminPassword(adminId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 12)
  await getPool().execute('UPDATE admins SET password = ? WHERE id = ?', [hash, adminId])
}

// ========== 系统配置 ==========

export async function getSystemConfigs() {
  const [rows] = await getPool().execute('SELECT * FROM system_config ORDER BY sort_order ASC')
  // 解密敏感字段用于后台显示
  return rows.map(r => ({
    ...r,
    config_value: SENSITIVE_SYS_KEYS.includes(r.config_key) ? safeDecrypt(r.config_value) : r.config_value,
  }))
}

export async function getSystemConfig(key) {
  const [rows] = await getPool().execute('SELECT config_value FROM system_config WHERE config_key = ?', [key])
  if (rows.length === 0) return null
  const val = rows[0].config_value
  return SENSITIVE_SYS_KEYS.includes(key) ? safeDecrypt(val) : val
}

export async function updateSystemConfigs(configs) {
  for (const { config_key, config_value } of configs) {
    if (!config_key) continue
    const rawVal = config_value ?? ''
    const val = SENSITIVE_SYS_KEYS.includes(config_key) ? safeEncrypt(rawVal) : rawVal
    await getPool().execute(
      `INSERT INTO system_config (config_key, config_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [config_key, val]
    )
  }
}

// ========== 支付配置 ==========

export async function getPaymentConfigs() {
  const [rows] = await getPool().execute('SELECT * FROM payment_config ORDER BY sort_order ASC')
  return rows.map(r => ({
    ...r,
    config_value: SENSITIVE_PAY_KEYS.includes(r.config_key) ? safeDecrypt(r.config_value) : r.config_value,
  }))
}

export async function updatePaymentConfigs(configs) {
  for (const { config_key, config_value } of configs) {
    if (!config_key) continue
    const rawVal = config_value ?? ''
    const val = SENSITIVE_PAY_KEYS.includes(config_key) ? safeEncrypt(rawVal) : rawVal
    await getPool().execute(
      `INSERT INTO payment_config (config_key, config_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [config_key, val]
    )
  }
}

export async function getAllConfig() {
  const [rows] = await getPool().query('SELECT config_key, config_value FROM system_config')
  const config = {}
  rows.forEach(r => { config[r.config_key] = SENSITIVE_SYS_KEYS.includes(r.config_key) ? safeDecrypt(r.config_value) : r.config_value })
  return config
}

export async function setConfig(key, value) {
  const val = SENSITIVE_SYS_KEYS.includes(key) ? safeEncrypt(value ?? '') : (value ?? '')
  await getPool().query(
    'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
    [key, val, val]
  )
}

export async function batchSetConfig(updates) {
  for (const { key, value } of updates) {
    if (!key) continue
    await setConfig(key, value)
  }
}

// ========== 用户行为追踪 ==========

export async function trackUserAction(userId, action, detail = '', ip = '', userAgent = '') {
  const ipEnc = ip ? encrypt(ip.slice(0, 60)) : ''
  await getPool().execute(
    'INSERT INTO user_actions (user_id, action, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
    [userId, action, detail.slice(0, 500), ipEnc, userAgent.slice(0, 500)]
  )
}

export async function updateUserActivity(userId, ip = '') {
  const ipEnc = ip ? encrypt(ip.slice(0, 60)) : ''
  await getPool().execute(
    'UPDATE users SET last_active_at = NOW(), last_ip = ? WHERE id = ?',
    [ipEnc, userId]
  )
}

export async function incrementLoginCount(userId) {
  await getPool().execute('UPDATE users SET login_count = login_count + 1 WHERE id = ?', [userId])
}

export async function incrementUserMessages(userId) {
  await getPool().execute('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?', [userId])
}

export async function checkDeepAnalysisQuota(userId) {
  const user = await getUserById(userId)
  if (!user) return { allowed: false, reason: 'user_not_found' }
  const currentMonth = new Date().toISOString().slice(0, 7)
  const count = user.deep_analysis_month === currentMonth ? (user.deep_analysis_count || 0) : 0
  const isMember = parseFloat(user.balance) > 0 || (user.api_mode === 'custom' && user.custom_api_key)
  if (isMember) {
    return { allowed: count < 100, isMember: true, used: count, limit: 100, remaining: Math.max(0, 100 - count) }
  }
  return { allowed: parseFloat(user.balance) > 0, isMember: false, used: count, needCharge: true }
}

export async function incrementDeepAnalysisCount(userId) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const user = await getUserById(userId)
  if (!user) return
  if (user.deep_analysis_month === currentMonth) {
    await getPool().execute('UPDATE users SET deep_analysis_count = deep_analysis_count + 1 WHERE id = ?', [userId])
  } else {
    await getPool().execute('UPDATE users SET deep_analysis_count = 1, deep_analysis_month = ? WHERE id = ?', [currentMonth, userId])
  }
}

export async function incrementUserSpent(userId, amount) {
  await getPool().execute('UPDATE users SET total_spent = total_spent + ? WHERE id = ?', [amount, userId])
}

export async function getRecentActions(limit = 50) {
  const [rows] = await getPool().execute(`
    SELECT a.*, u.phone, u.nickname
    FROM user_actions a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT ?
  `, [limit])
  return rows.map(r => ({
    ...r,
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
    ip: safeDecrypt(r.ip),
  }))
}

// ========== 统计 ==========

export async function getDashboardStats() {
  // 基础计数
  const [[{cnt: totalSessions}]] = await getPool().execute('SELECT COUNT(*) as cnt FROM sessions')
  const [[{cnt: activeSessions}]] = await getPool().execute("SELECT COUNT(*) as cnt FROM sessions WHERE status='active'")
  const [[{cnt: totalMessages}]] = await getPool().execute('SELECT COUNT(*) as cnt FROM messages')
  const [[{cnt: todaySessions}]] = await getPool().execute("SELECT COUNT(*) as cnt FROM sessions WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: chatSessions}]] = await getPool().execute("SELECT COUNT(DISTINCT session_id) as cnt FROM messages WHERE role='user'")
  const [[{cnt: totalUsers}]] = await getPool().execute('SELECT COUNT(*) as cnt FROM users')
  const [[{cnt: todayUsers}]] = await getPool().execute("SELECT COUNT(*) as cnt FROM users WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: todayMessages}]] = await getPool().execute("SELECT COUNT(*) as cnt FROM messages WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: activeUsersToday}]] = await getPool().execute("SELECT COUNT(*) as cnt FROM users WHERE DATE(last_active_at)=CURDATE()")
  const [[{s: totalRevenue}]] = await getPool().execute('SELECT COALESCE(SUM(total_spent),0) as s FROM users')
  const [[{s: todayRevenue}]] = await getPool().execute("SELECT COALESCE(SUM(amount),0) as s FROM recharge_orders WHERE status='confirmed' AND DATE(confirmed_at)=CURDATE()")
  const [[{avg: avgMsgsPerSession}]] = await getPool().execute("SELECT ROUND(AVG(c),1) as avg FROM (SELECT COUNT(*) as c FROM messages GROUP BY session_id) t")

  // 最近7天趋势
  const [dailySessions] = await getPool().execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM sessions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)
  const [dailyMessages] = await getPool().execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)
  const [dailyUsers] = await getPool().execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)

  // 24小时消息分布
  const [hourlyMessages] = await getPool().execute(`
    SELECT HOUR(created_at) as hr, COUNT(*) as cnt
    FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY HOUR(created_at) ORDER BY hr
  `)

  // API模式分布
  const [apiModes] = await getPool().execute('SELECT api_mode, COUNT(*) as cnt FROM users GROUP BY api_mode')

  // Top 活跃用户（需解密 phone/nickname）
  const [topUsersRaw] = await getPool().execute(`
    SELECT u.id, u.phone, u.nickname, u.total_messages, u.total_spent, u.balance, u.login_count, u.last_active_at,
      (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as sessions
    FROM users u ORDER BY u.total_messages DESC LIMIT 10
  `)
  const topUsers = topUsersRaw.map(u => ({
    ...u,
    phone: safeDecrypt(u.phone),
    nickname: safeDecrypt(u.nickname),
  }))

  // 最近活动（需解密 phone/nickname/ip）
  const [recentActionsRaw] = await getPool().execute(`
    SELECT a.action, a.detail, a.created_at, a.ip, u.nickname, u.phone
    FROM user_actions a LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 30
  `)
  const recentActions = recentActionsRaw.map(r => ({
    ...r,
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
    ip: safeDecrypt(r.ip),
  }))

  // Token消耗汇总（成本概览）
  const [[tokenSummary]] = await getPool().execute(
    `SELECT COUNT(*) as total_requests,
     COALESCE(SUM(input_tokens),0) as total_input,
     COALESCE(SUM(output_tokens),0) as total_output,
     COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_user_cost
     FROM token_usage`
  )
  const [[todayToken]] = await getPool().execute(
    `SELECT COUNT(*) as requests, COALESCE(SUM(total_tokens),0) as tokens, COALESCE(SUM(cost),0) as cost
     FROM token_usage WHERE DATE(created_at) = CURDATE()`
  )
  // 按类型汇总Token
  const [tokenByType] = await getPool().execute(
    `SELECT type, COUNT(*) as cnt,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage GROUP BY type ORDER BY tokens DESC`
  )
  // 充值收入统计
  const [[rechargeStats]] = await getPool().execute(
    `SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN amount ELSE 0 END),0) as confirmed_total,
     COUNT(CASE WHEN status='confirmed' THEN 1 END) as confirmed_count,
     COUNT(CASE WHEN status='pending' THEN 1 END) as pending_count,
     COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending_total
     FROM recharge_orders`
  )
  // 7天收入趋势
  const [dailyRevenue] = await getPool().execute(
    `SELECT DATE(confirmed_at) as day, COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders
     FROM recharge_orders WHERE status='confirmed' AND confirmed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(confirmed_at) ORDER BY day`
  )
  // 模型健康摘要
  let modelHealth = { total: 0, healthy: 0, error: 0, unknown: 0, activeModel: null }
  try {
    const [models] = await getPool().execute('SELECT id, display_name, health_status, is_active, is_free, is_enabled FROM ai_models WHERE is_enabled = 1')
    modelHealth.total = models.length
    modelHealth.healthy = models.filter(m => m.health_status === 'healthy').length
    modelHealth.error = models.filter(m => ['error','timeout','auth_failed','balance_empty'].includes(m.health_status)).length
    modelHealth.unknown = models.filter(m => !m.health_status || m.health_status === 'unknown').length
    const active = models.find(m => m.is_active)
    if (active) modelHealth.activeModel = { name: active.display_name, status: active.health_status, isFree: !!active.is_free }
  } catch {}

  // AI成本估算（免费模型成本=0）
  const aiCostEstimate = (parseInt(tokenSummary.total_input) / 1000 * 0.001) + (parseInt(tokenSummary.total_output) / 1000 * 0.002)
  const userCharges = parseFloat(tokenSummary.total_user_cost || 0)
  const rechargeIncome = parseFloat(rechargeStats.confirmed_total || 0)

  return {
    totalSessions, activeSessions, totalMessages, todaySessions, chatSessions,
    totalUsers, todayUsers, todayMessages, activeUsersToday,
    totalRevenue: parseFloat(totalRevenue), todayRevenue: parseFloat(todayRevenue),
    avgMsgsPerSession: avgMsgsPerSession || 0,
    dailySessions, dailyMessages, dailyUsers, dailyRevenue,
    hourlyMessages, apiModes, topUsers, recentActions,
    // 新增：Token成本与收入分析
    tokenSummary: {
      ...tokenSummary,
      todayRequests: todayToken.requests,
      todayTokens: todayToken.tokens,
      todayCost: todayToken.cost,
    },
    tokenByType,
    rechargeStats: {
      confirmedTotal: parseFloat(rechargeStats.confirmed_total),
      confirmedCount: parseInt(rechargeStats.confirmed_count),
      pendingCount: parseInt(rechargeStats.pending_count),
      pendingTotal: parseFloat(rechargeStats.pending_total),
    },
    profitAnalysis: {
      rechargeIncome,
      userCharges,
      aiCostEstimate,
      grossProfit: rechargeIncome - aiCostEstimate,
      profitRate: rechargeIncome > 0 ? ((rechargeIncome - aiCostEstimate) / rechargeIncome * 100).toFixed(1) : 0,
    },
    modelHealth,
  }
}

// ========== 充值订单 ==========

export async function createRechargeOrder(userId, amount, paymentMethod, remark = '', outTradeNo = '') {
  const [result] = await getPool().execute(
    'INSERT INTO recharge_orders (user_id, amount, payment_method, remark, out_trade_no) VALUES (?, ?, ?, ?, ?)',
    [userId, amount, paymentMethod, remark, outTradeNo]
  )
  return result.insertId
}

export async function getRechargeOrders(status = null) {
  let sql = `SELECT r.*, u.phone, u.nickname FROM recharge_orders r LEFT JOIN users u ON r.user_id = u.id`
  const params = []
  if (status) { sql += ' WHERE r.status = ?'; params.push(status) }
  sql += ' ORDER BY r.created_at DESC LIMIT 100'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({
    ...r,
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
  }))
}

export async function getUserRechargeOrders(userId) {
  const [rows] = await getPool().execute(
    'SELECT id, amount, status, payment_method, remark, out_trade_no, admin_note, created_at, confirmed_at FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId]
  )
  return rows
}

export async function getPendingRechargeOrderByOutTradeNo(outTradeNo) {
  const [rows] = await getPool().execute(
    "SELECT * FROM recharge_orders WHERE out_trade_no = ? AND status = 'pending' LIMIT 1",
    [outTradeNo]
  )
  return rows[0] || null
}

export async function confirmRechargeOrder(orderId, adminId = null, adminNote = '') {
  // 原子操作：UPDATE + WHERE status='pending' 防止并发双重确认
  const confirmedBy = adminId || 0 // 0 表示系统自动确认（支付回调）
  const note = adminNote || (adminId ? '' : '支付平台自动确认')
  const [result] = await getPool().execute(
    'UPDATE recharge_orders SET status = ?, confirmed_at = NOW(), confirmed_by = ?, admin_note = ? WHERE id = ? AND status = ?',
    ['confirmed', confirmedBy, note, orderId, 'pending']
  )
  if (result.affectedRows === 0) return null
  // 读取订单信息用于充值
  const [rows] = await getPool().execute('SELECT * FROM recharge_orders WHERE id = ?', [orderId])
  if (rows.length === 0) return null
  const order = rows[0]
  // 充值到用户余额
  await adjustUserBalance(order.user_id, parseFloat(order.amount))
  return order
}

export async function rejectRechargeOrder(orderId, adminId, adminNote = '') {
  await getPool().execute(
    'UPDATE recharge_orders SET status = ?, confirmed_at = NOW(), confirmed_by = ?, admin_note = ? WHERE id = ?',
    ['rejected', adminId, adminNote, orderId]
  )
}

// ========== 成功案例知识库 ==========

export async function createSuccessCase({ sessionId, title, industry, problemType, collectedData, reportContent, successSummary, adminNotes }) {
  const [result] = await getPool().execute(
    `INSERT INTO success_cases (session_id, title, industry, problem_type, collected_data, report_content, success_summary, admin_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId || null, title || '', industry || '', problemType || '', JSON.stringify(collectedData || {}), reportContent || '', successSummary || '', adminNotes || '']
  )
  return result.insertId
}

export async function getSuccessCases(status = 'active') {
  const [rows] = await getPool().execute(
    'SELECT * FROM success_cases WHERE status = ? ORDER BY created_at DESC',
    [status]
  )
  return rows.map(r => ({ ...r, collected_data: safeParse(r.collected_data) }))
}

export async function getSuccessCaseById(id) {
  const [rows] = await getPool().execute('SELECT * FROM success_cases WHERE id = ?', [id])
  if (rows.length === 0) return null
  rows[0].collected_data = safeParse(rows[0].collected_data)
  return rows[0]
}

export async function updateSuccessCase(id, updates) {
  const fields = []
  const params = []
  if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title) }
  if (updates.industry !== undefined) { fields.push('industry = ?'); params.push(updates.industry) }
  if (updates.problemType !== undefined) { fields.push('problem_type = ?'); params.push(updates.problemType) }
  if (updates.successSummary !== undefined) { fields.push('success_summary = ?'); params.push(updates.successSummary) }
  if (updates.adminNotes !== undefined) { fields.push('admin_notes = ?'); params.push(updates.adminNotes) }
  if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status) }
  if (updates.reportContent !== undefined) { fields.push('report_content = ?'); params.push(updates.reportContent) }
  if (fields.length === 0) return
  params.push(id)
  await getPool().execute(`UPDATE success_cases SET ${fields.join(', ')} WHERE id = ?`, params)
}

export async function deleteSuccessCase(id) {
  await getPool().execute('DELETE FROM success_cases WHERE id = ?', [id])
}

export async function findSimilarCases(industry, problemType, limit = 3) {
  let sql = 'SELECT id, title, industry, problem_type, success_summary FROM success_cases WHERE status = ?'
  const params = ['active']
  if (industry) { sql += ' AND industry LIKE ?'; params.push(`%${escapeLike(industry)}%`) }
  if (problemType) { sql += ' AND problem_type LIKE ?'; params.push(`%${escapeLike(problemType)}%`) }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)
  const [rows] = await getPool().execute(sql, params)
  if (rows.length > 0) return rows
  // 如果没有精确匹配，返回最新的活跃案例
  const [fallback] = await getPool().execute(
    'SELECT id, title, industry, problem_type, success_summary FROM success_cases WHERE status = ? ORDER BY created_at DESC LIMIT ?',
    ['active', limit]
  )
  return fallback
}

export async function getPendingRechargeCount() {
  const [rows] = await getPool().execute('SELECT COUNT(*) as cnt FROM recharge_orders WHERE status = ?', ['pending'])
  return rows[0].cnt
}

// ========== Token消费明细 ==========

export async function recordTokenUsage({
  userId,
  sessionId,
  type,
  inputTokens,
  outputTokens,
  totalTokens,
  cost,
  multiplier,
  apiMode,
  detailSummary = null,
  contextJson = null,
}) {
  const ctxStr = contextJson != null ? JSON.stringify(contextJson) : null
  await getPool().execute(
    `INSERT INTO token_usage (user_id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode, detail_summary, context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      sessionId || null,
      type || 'chat',
      inputTokens || 0,
      outputTokens || 0,
      totalTokens || 0,
      cost || 0,
      multiplier || 2,
      apiMode || 'official',
      detailSummary ? String(detailSummary).slice(0, 512) : null,
      ctxStr,
    ]
  )
}

export async function getUserTokenUsage(userId, limit = 50) {
  const [rows] = await getPool().execute(
    `SELECT id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode, created_at
     FROM token_usage WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  )
  return rows
}

export async function getUserTokenStats(userId) {
  const [[totals]] = await getPool().execute(
    `SELECT COUNT(*) as total_requests, COALESCE(SUM(input_tokens),0) as total_input,
     COALESCE(SUM(output_tokens),0) as total_output, COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_cost
     FROM token_usage WHERE user_id = ?`,
    [userId]
  )
  const [[today]] = await getPool().execute(
    `SELECT COUNT(*) as requests, COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  )
  return { totals, today }
}

export async function getAllTokenUsage(limit = 100, { page = 1, type, userId, dateFrom, dateTo } = {}) {
  let where = '1=1'
  const params = []
  if (type) { where += ' AND t.type = ?'; params.push(type) }
  if (userId) { where += ' AND t.user_id = ?'; params.push(userId) }
  if (dateFrom) { where += ' AND t.created_at >= ?'; params.push(dateFrom) }
  if (dateTo) { where += ' AND t.created_at <= ?'; params.push(dateTo + ' 23:59:59') }
  const offset = (page - 1) * limit
  const [rows] = await getPool().execute(
    `SELECT t.id, t.user_id, t.session_id, t.type, t.input_tokens, t.output_tokens, t.total_tokens,
            t.cost, t.multiplier, t.api_mode, t.detail_summary, t.context_json, t.created_at,
            u.phone, u.nickname
     FROM token_usage t
     LEFT JOIN users u ON t.user_id = u.id
     WHERE ${where}
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [[{ total }]] = await getPool().execute(
    `SELECT COUNT(*) as total FROM token_usage t WHERE ${where}`, params
  )
  return {
    records: rows.map(r => ({
      ...r,
      phone: safeDecrypt(r.phone),
      nickname: safeDecrypt(r.nickname),
    })),
    total,
    page,
    pageSize: limit,
  }
}

export async function getTokenUsageLogs(limit = 50, { page = 1, requestType, provider } = {}) {
  let where = '1=1'
  const params = []
  if (requestType) { where += ' AND request_type = ?'; params.push(requestType) }
  if (provider) { where += ' AND provider = ?'; params.push(provider) }
  const offset = (page - 1) * limit
  const [rows] = await getPool().execute(
    `SELECT id, model_id, provider, model_name, prompt_tokens, completion_tokens, total_tokens,
            request_type, cost_yuan, user_id, session_id, detail_summary, context_json, created_at
     FROM token_usage_logs
     WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [[{ total }]] = await getPool().execute(
    `SELECT COUNT(*) as total FROM token_usage_logs WHERE ${where}`,
    params
  )
  const [byType] = await getPool().execute(
    `SELECT request_type, COUNT(*) as cnt, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage_logs GROUP BY request_type ORDER BY tokens DESC LIMIT 30`
  )
  return { records: rows, total, page, pageSize: limit, byType }
}

/** 功能覆盖：billing 表 + logs 表中出现过的 type */
export async function getTokenCoverageReport() {
  const [billingTypes] = await getPool().execute(
    `SELECT type, COUNT(*) as cnt, COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(input_tokens),0) as input_tokens, COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage GROUP BY type ORDER BY tokens DESC`
  )
  const [logTypes] = await getPool().execute(
    `SELECT request_type as type, COUNT(*) as cnt, COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(prompt_tokens),0) as input_tokens, COALESCE(SUM(completion_tokens),0) as output_tokens,
     COALESCE(SUM(cost_yuan),0) as cost
     FROM token_usage_logs GROUP BY request_type ORDER BY tokens DESC`
  )
  const [[billingOnly]] = await getPool().execute(
    `SELECT COUNT(*) as cnt FROM token_usage`
  )
  const [[logsOnly]] = await getPool().execute(
    `SELECT COUNT(*) as cnt FROM token_usage_logs`
  )
  return {
    billingTypes,
    logTypes,
    billingRecordCount: billingOnly?.cnt || 0,
    logRecordCount: logsOnly?.cnt || 0,
  }
}

/** 合并 billing + 仅存在于 logs 的流水（避免双写重复：logs 中无 billing 匹配的才补） */
export async function getUnifiedTokenTimeline(limit = 50, { page = 1, type, dateFrom, dateTo } = {}) {
  let whereBilling = '1=1'
  let whereLogs = '1=1'
  const paramsB = []
  const paramsL = []
  if (type) {
    whereBilling += ' AND t.type = ?'
    whereLogs += ' AND l.request_type = ?'
    paramsB.push(type)
    paramsL.push(type)
  }
  if (dateFrom) {
    whereBilling += ' AND t.created_at >= ?'
    whereLogs += ' AND l.created_at >= ?'
    paramsB.push(dateFrom)
    paramsL.push(dateFrom)
  }
  if (dateTo) {
    whereBilling += ' AND t.created_at <= ?'
    whereLogs += ' AND l.created_at <= ?'
    paramsB.push(dateTo + ' 23:59:59')
    paramsL.push(dateTo + ' 23:59:59')
  }
  const offset = (page - 1) * limit

  const [billingRows] = await getPool().execute(
    `SELECT t.id, t.user_id, t.session_id, t.type as feature_type, t.input_tokens, t.output_tokens,
            t.total_tokens, t.cost, t.multiplier, t.api_mode, t.detail_summary, t.context_json, t.created_at,
            'billing' as source, NULL as provider, NULL as model_name, u.phone, u.nickname
     FROM token_usage t
     LEFT JOIN users u ON t.user_id = u.id
     WHERE ${whereBilling}
     ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...paramsB, limit, offset]
  )

  const [logOnlyRows] = await getPool().execute(
    `SELECT l.id, COALESCE(l.user_id, 0) as user_id, l.session_id, l.request_type as feature_type,
            l.prompt_tokens as input_tokens, l.completion_tokens as output_tokens, l.total_tokens,
            l.cost_yuan as cost, 1 as multiplier, 'model_log' as api_mode, l.detail_summary, l.context_json, l.created_at,
            'model_log' as source, l.provider, l.model_name, NULL as phone, NULL as nickname
     FROM token_usage_logs l
     WHERE ${whereLogs}
       AND NOT EXISTS (
         SELECT 1 FROM token_usage t
         WHERE t.type = l.request_type
           AND ABS(TIMESTAMPDIFF(SECOND, t.created_at, l.created_at)) <= 3
           AND t.total_tokens = l.total_tokens
       )
     ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...paramsL, limit, offset]
  )

  const merged = [
    ...billingRows.map(r => ({
      ...r,
      phone: safeDecrypt(r.phone),
      nickname: safeDecrypt(r.nickname),
    })),
    ...logOnlyRows,
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit)

  const [[{ totalBilling }]] = await getPool().execute(
    `SELECT COUNT(*) as totalBilling FROM token_usage t WHERE ${whereBilling}`, paramsB
  )
  const [[{ totalLogs }]] = await getPool().execute(
    `SELECT COUNT(*) as totalLogs FROM token_usage_logs l WHERE ${whereLogs}`, paramsL
  )

  return {
    records: merged,
    total: (totalBilling || 0) + (totalLogs || 0),
    page,
    pageSize: limit,
  }
}

export async function getTokenUsageStats() {
  const [[totals]] = await getPool().execute(
    `SELECT COUNT(*) as total_requests,
     COALESCE(SUM(input_tokens),0) as total_input,
     COALESCE(SUM(output_tokens),0) as total_output,
     COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_cost
     FROM token_usage`
  )
  const [[today]] = await getPool().execute(
    `SELECT COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost,
     COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage WHERE DATE(created_at) = CURDATE()`
  )
  const [byType] = await getPool().execute(
    `SELECT type, COUNT(*) as cnt,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage GROUP BY type`
  )
  const [byUser] = await getPool().execute(
    `SELECT t.user_id, u.phone, u.nickname,
     COUNT(*) as requests,
     COALESCE(SUM(t.input_tokens),0) as input_tokens,
     COALESCE(SUM(t.output_tokens),0) as output_tokens,
     COALESCE(SUM(t.total_tokens),0) as total_tokens,
     COALESCE(SUM(t.cost),0) as total_cost,
     MAX(t.created_at) as last_used
     FROM token_usage t LEFT JOIN users u ON t.user_id = u.id
     GROUP BY t.user_id ORDER BY total_cost DESC LIMIT 50`
  )
  const [daily] = await getPool().execute(
    `SELECT DATE(created_at) as day, COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY day DESC`
  )
  // 系统级消耗（user_id=0 或 evolution类型）
  const [[systemUsage]] = await getPool().execute(
    `SELECT COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage WHERE user_id = 0 OR type LIKE 'evolution%' OR type LIKE 'auto_%'`
  )
  const [logsByType] = await getPool().execute(
    `SELECT request_type as type, COUNT(*) as cnt,
     COALESCE(SUM(prompt_tokens),0) as input_tokens,
     COALESCE(SUM(completion_tokens),0) as output_tokens,
     COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(cost_yuan),0) as cost
     FROM token_usage_logs GROUP BY request_type`
  )
  const [[logsTotals]] = await getPool().execute(
    `SELECT COUNT(*) as total_requests,
     COALESCE(SUM(prompt_tokens),0) as total_input,
     COALESCE(SUM(completion_tokens),0) as total_output,
     COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost_yuan),0) as total_cost
     FROM token_usage_logs`
  )
  return {
    totals, today, byType,
    byUser: byUser.map(r => ({ ...r, phone: safeDecrypt(r.phone), nickname: safeDecrypt(r.nickname) })),
    daily, systemUsage,
    logsByType,
    logsTotals,
  }
}

// ========== 申诉文案 ==========

export async function saveAppealText({ sessionId, userId, businessModel, refundRules, complaintCause, complaintResolution, supplementary, inputTokens, outputTokens, cost }) {
  const [result] = await getPool().execute(
    `INSERT INTO appeal_texts (session_id, user_id, business_model, refund_rules, complaint_cause, complaint_resolution, supplementary, input_tokens, output_tokens, cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, businessModel || '', refundRules || '', complaintCause || '', complaintResolution || '', supplementary || '', inputTokens || 0, outputTokens || 0, cost || 0]
  )
  return result.insertId
}

export async function getAppealText(sessionId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
    [sessionId]
  )
  return rows.length > 0 ? rows[0] : null
}

// ========== 申诉进度跟踪 ==========

export async function updateAppealStatus(sessionId, userId, { status, feedback, rejectionReason }) {
  const now = new Date()
  const updates = ['appeal_status = ?']
  const params = [status]
  if (feedback) { updates.push('user_feedback = ?'); params.push(feedback) }
  if (rejectionReason) { updates.push('rejection_reason = ?'); params.push(rejectionReason) }
  if (status === 'submitted' || status === 'resubmitted') { updates.push('submitted_at = ?'); params.push(now) }
  if (status === 'approved' || status === 'rejected') { updates.push('result_at = ?'); params.push(now) }
  if (status === 'resubmitted') { updates.push('resubmit_count = resubmit_count + 1') }
  params.push(sessionId, userId)
  await getPool().execute(`UPDATE appeal_texts SET ${updates.join(', ')} WHERE session_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`, params)
}

export async function getAppealStats() {
  const [[totals]] = await getPool().execute(
    `SELECT COUNT(*) as total,
     SUM(appeal_status='generated') as \`generated\`,
     SUM(appeal_status='submitted') as \`submitted\`,
     SUM(appeal_status='under_review') as under_review,
     SUM(appeal_status='approved') as approved,
     SUM(appeal_status='rejected') as rejected,
     SUM(appeal_status='resubmitted') as resubmitted
     FROM appeal_texts`
  )
  // 成功率 = approved / (approved + rejected)
  const decided = parseInt(totals.approved || 0) + parseInt(totals.rejected || 0)
  const successRate = decided > 0 ? (parseInt(totals.approved || 0) / decided * 100).toFixed(1) : 0

  // 按行业成功率
  const [byIndustry] = await getPool().execute(
    `SELECT s.collected_data->>'$.industry' as industry,
     COUNT(*) as total,
     SUM(a.appeal_status='approved') as approved,
     SUM(a.appeal_status='rejected') as rejected
     FROM appeal_texts a JOIN sessions s ON a.session_id = s.id
     WHERE a.appeal_status IN ('approved','rejected')
     GROUP BY industry HAVING industry IS NOT NULL AND industry != ''
     ORDER BY total DESC LIMIT 20`
  )

  // 按违规类型成功率
  const [byViolation] = await getPool().execute(
    `SELECT s.collected_data->>'$.problem_type' as violation_type,
     COUNT(*) as total,
     SUM(a.appeal_status='approved') as approved,
     SUM(a.appeal_status='rejected') as rejected
     FROM appeal_texts a JOIN sessions s ON a.session_id = s.id
     WHERE a.appeal_status IN ('approved','rejected')
     GROUP BY violation_type HAVING violation_type IS NOT NULL AND violation_type != ''
     ORDER BY total DESC LIMIT 20`
  )

  // 7天趋势
  const [dailyTrend] = await getPool().execute(
    `SELECT DATE(result_at) as day,
     SUM(appeal_status='approved') as approved,
     SUM(appeal_status='rejected') as rejected
     FROM appeal_texts
     WHERE result_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND appeal_status IN ('approved','rejected')
     GROUP BY DATE(result_at) ORDER BY day`
  )

  // 最近反馈
  const [recentFeedback] = await getPool().execute(
    `SELECT a.session_id, a.appeal_status, a.user_feedback, a.result_at, a.rejection_reason, a.resubmit_count,
     s.collected_data->>'$.industry' as industry, s.collected_data->>'$.problem_type' as violation_type
     FROM appeal_texts a JOIN sessions s ON a.session_id = s.id
     WHERE a.appeal_status IN ('approved','rejected') AND a.result_at IS NOT NULL
     ORDER BY a.result_at DESC LIMIT 20`
  )

  return {
    totals: { ...totals, successRate, decided },
    byIndustry: byIndustry.map(r => ({
      ...r, successRate: (parseInt(r.approved||0) + parseInt(r.rejected||0)) > 0
        ? (parseInt(r.approved||0) / (parseInt(r.approved||0) + parseInt(r.rejected||0)) * 100).toFixed(1) : 0
    })),
    byViolation: byViolation.map(r => ({
      ...r, successRate: (parseInt(r.approved||0) + parseInt(r.rejected||0)) > 0
        ? (parseInt(r.approved||0) / (parseInt(r.approved||0) + parseInt(r.rejected||0)) * 100).toFixed(1) : 0
    })),
    dailyTrend,
    recentFeedback,
  }
}

// ========== AI 自进化：规则库 ==========

export async function createAIRule({ category, ruleKey, ruleName, ruleContent, source = 'ai_generated', status = 'pending_review', parentId = null }) {
  // 计算版本号
  const [[{ maxVer }]] = await getPool().execute(
    'SELECT COALESCE(MAX(version), 0) as maxVer FROM ai_rules WHERE category = ? AND rule_key = ?',
    [category, ruleKey]
  )
  const version = maxVer + 1
  const [result] = await getPool().execute(
    `INSERT INTO ai_rules (category, rule_key, rule_name, rule_content, source, status, version, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, ruleKey, ruleName || '', JSON.stringify(ruleContent), source, status, version, parentId]
  )
  // 记录变更日志
  await logRuleChange(result.insertId, 'created', null, ruleContent, `${source} 创建 v${version}`, source === 'ai_generated' ? 'ai' : 'admin')
  return { id: result.insertId, version }
}

export async function getActiveRules(category = null) {
  let sql = 'SELECT * FROM ai_rules WHERE status = ?'
  const params = ['active']
  if (category) { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY effectiveness_score DESC, usage_count DESC LIMIT 25'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({ ...r, rule_content: safeParse(r.rule_content) }))
}

export async function getAllAIRules(category = null, status = null) {
  let sql = 'SELECT * FROM ai_rules WHERE 1=1'
  const params = []
  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY updated_at DESC LIMIT 200'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({ ...r, rule_content: safeParse(r.rule_content) }))
}

export async function getAIRuleById(id) {
  const [rows] = await getPool().execute('SELECT * FROM ai_rules WHERE id = ?', [id])
  if (rows.length === 0) return null
  rows[0].rule_content = safeParse(rows[0].rule_content)
  return rows[0]
}

export async function updateAIRuleStatus(id, status, reason = '', changedBy = 'admin') {
  const rule = await getAIRuleById(id)
  if (!rule) return null
  const oldStatus = rule.status
  await getPool().execute('UPDATE ai_rules SET status = ? WHERE id = ?', [status, id])
  await logRuleChange(id, status === 'active' ? 'activated' : status === 'archived' ? 'archived' : status === 'rejected' ? 'rejected' : 'updated',
    { status: oldStatus }, { status }, reason, changedBy)
  return { ...rule, status }
}

export async function updateAIRuleContent(id, ruleContent, ruleName = null, changedBy = 'admin') {
  const rule = await getAIRuleById(id)
  if (!rule) return null
  const sets = ['rule_content = ?']
  const params = [JSON.stringify(ruleContent)]
  if (ruleName !== null) { sets.push('rule_name = ?'); params.push(ruleName) }
  params.push(id)
  await getPool().execute(`UPDATE ai_rules SET ${sets.join(', ')} WHERE id = ?`, params)
  await logRuleChange(id, 'updated', rule.rule_content, ruleContent, `${changedBy} 编辑内容`, changedBy)
  return { ...rule, rule_content: ruleContent }
}

export async function incrementRuleUsage(id) {
  await getPool().execute('UPDATE ai_rules SET usage_count = usage_count + 1 WHERE id = ?', [id])
}

export async function updateRuleEffectiveness(id, score) {
  await getPool().execute('UPDATE ai_rules SET effectiveness_score = ? WHERE id = ?', [score, id])
}

export async function deleteAIRule(id) {
  await getPool().execute('DELETE FROM rule_change_log WHERE rule_id = ?', [id])
  await getPool().execute('DELETE FROM ai_rules WHERE id = ?', [id])
}

export async function getAIRuleStats() {
  const [byCategory] = await getPool().execute(
    `SELECT category, status, COUNT(*) as cnt FROM ai_rules GROUP BY category, status`
  )
  const [[totals]] = await getPool().execute(
    `SELECT COUNT(*) as total, SUM(status='active') as active, SUM(status='pending_review') as pending,
     AVG(CASE WHEN status='active' THEN effectiveness_score END) as avg_score
     FROM ai_rules`
  )
  const [topRules] = await getPool().execute(
    `SELECT id, category, rule_key, rule_name, effectiveness_score, usage_count
     FROM ai_rules WHERE status = 'active' ORDER BY effectiveness_score DESC LIMIT 10`
  )
  return { byCategory, totals, topRules }
}

// ========== AI 自进化：对话分析 ==========

export async function saveConversationAnalysis(data) {
  const [result] = await getPool().execute(
    `INSERT INTO conversation_analyses
     (session_id, user_id, industry, problem_type, total_turns, collection_turns,
      fields_collected, fields_skipped, fields_refused, completion_rate,
      professionalism_score, appeal_success_rate, user_satisfaction, response_quality,
      user_sentiment, drop_off_point, collection_efficiency, sentiment_trajectory, suggestions, raw_analysis, active_rule_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.sessionId, data.userId || null, data.industry || '', data.problemType || '',
      data.totalTurns || 0, data.collectionTurns || 0,
      data.fieldsCollected || 0, data.fieldsSkipped || 0, data.fieldsRefused || 0,
      data.completionRate || 0,
      data.professionalismScore || 0, data.appealSuccessRate || 0, data.userSatisfaction || 0,
      JSON.stringify(data.responseQuality || {}),
      data.userSentiment || 'neutral', data.dropOffPoint || '',
      JSON.stringify(data.collectionEfficiency || {}),
      JSON.stringify(data.sentimentTrajectory || []),
      JSON.stringify(data.suggestions || []),
      data.rawAnalysis || '',
      JSON.stringify(data.activeRuleIds || [])
    ]
  )
  return result.insertId
}

export async function getConversationAnalyses(limit = 50, filters = {}) {
  let sql = `SELECT ca.*, s.status as session_status
    FROM conversation_analyses ca
    LEFT JOIN sessions s ON ca.session_id = s.id
    WHERE 1=1`
  const params = []
  if (filters.industry) { sql += ' AND ca.industry LIKE ?'; params.push(`%${escapeLike(filters.industry)}%`) }
  if (filters.sentiment) { sql += ' AND ca.user_sentiment = ?'; params.push(filters.sentiment) }
  if (filters.minCompletion) { sql += ' AND ca.completion_rate >= ?'; params.push(filters.minCompletion) }
  if (filters.maxCompletion) { sql += ' AND ca.completion_rate <= ?'; params.push(filters.maxCompletion) }
  sql += ' ORDER BY ca.analyzed_at DESC LIMIT ?'
  params.push(limit)
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({
    ...r,
    collection_efficiency: safeParse(r.collection_efficiency),
    sentiment_trajectory: safeParse(r.sentiment_trajectory),
    suggestions: safeParse(r.suggestions),
    active_rule_ids: safeParse(r.active_rule_ids),
    response_quality: safeParse(r.response_quality),
  }))
}

export async function getConversationAnalysisById(id) {
  const [rows] = await getPool().execute('SELECT * FROM conversation_analyses WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    collection_efficiency: safeParse(r.collection_efficiency),
    sentiment_trajectory: safeParse(r.sentiment_trajectory),
    suggestions: safeParse(r.suggestions),
    active_rule_ids: safeParse(r.active_rule_ids),
    response_quality: safeParse(r.response_quality),
  }
}

export async function getAnalysisStats() {
  const [[totals]] = await getPool().execute(
    `SELECT COUNT(*) as total,
     AVG(completion_rate) as avg_completion,
     AVG(total_turns) as avg_turns,
     AVG(collection_turns) as avg_collection_turns,
     AVG(fields_collected) as avg_fields_collected,
     AVG(professionalism_score) as avg_professionalism,
     AVG(appeal_success_rate) as avg_appeal_success,
     AVG(user_satisfaction) as avg_satisfaction,
     SUM(drop_off_point != '') as drop_off_count,
     SUM(completion_rate >= 80) as high_completion_count,
     SUM(professionalism_score >= 70) as high_prof_count,
     SUM(appeal_success_rate >= 60) as high_appeal_count,
     SUM(user_satisfaction >= 70) as high_satisfaction_count
     FROM conversation_analyses`
  )
  const [bySentiment] = await getPool().execute(
    `SELECT user_sentiment, COUNT(*) as cnt FROM conversation_analyses GROUP BY user_sentiment`
  )
  const [byIndustry] = await getPool().execute(
    `SELECT industry, COUNT(*) as cnt, AVG(completion_rate) as avg_completion, AVG(total_turns) as avg_turns,
     AVG(professionalism_score) as avg_prof, AVG(appeal_success_rate) as avg_appeal, AVG(user_satisfaction) as avg_sat
     FROM conversation_analyses WHERE industry != '' GROUP BY industry ORDER BY cnt DESC LIMIT 20`
  )
  const [recent7d] = await getPool().execute(
    `SELECT DATE(analyzed_at) as day, COUNT(*) as cnt, AVG(completion_rate) as avg_completion,
     AVG(professionalism_score) as avg_prof, AVG(appeal_success_rate) as avg_appeal, AVG(user_satisfaction) as avg_sat
     FROM conversation_analyses WHERE analyzed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(analyzed_at) ORDER BY day`
  )
  const [topDropOffs] = await getPool().execute(
    `SELECT drop_off_point, COUNT(*) as cnt FROM conversation_analyses
     WHERE drop_off_point != '' GROUP BY drop_off_point ORDER BY cnt DESC LIMIT 10`
  )
  return { totals, bySentiment, byIndustry, recent7d, topDropOffs }
}

export async function getQualityTopAndLow() {
  const cols = `session_id, industry, problem_type, completion_rate, professionalism_score,
     appeal_success_rate, user_satisfaction, user_sentiment, fields_collected, total_turns, analyzed_at,
     suggestions, drop_off_point, raw_analysis, collection_efficiency, response_quality`
  const [topAnalyses] = await getPool().execute(
    `SELECT ${cols} FROM conversation_analyses WHERE total_turns >= 3 ORDER BY professionalism_score DESC, completion_rate DESC LIMIT 5`
  )
  const [lowAnalyses] = await getPool().execute(
    `SELECT ${cols} FROM conversation_analyses WHERE professionalism_score > 0 AND total_turns >= 3 AND fields_collected >= 1 ORDER BY professionalism_score ASC, completion_rate ASC LIMIT 5`
  )
  const pf = a => {
    const suggestions = safeParse(a.suggestions) || []
    const collEff = safeParse(a.collection_efficiency) || {}
    const respQuality = safeParse(a.response_quality) || {}
    const highlights = extractAIHighlights(a)

    // 当AI深度分析缺失时，基于基础指标自动生成诊断
    const autoDiagnostics = []
    if (suggestions.length === 0 && !highlights.worstMoment) {
      const cr = parseFloat(a.completion_rate) || 0
      const prof = parseFloat(a.professionalism_score) || 0
      const sat = parseFloat(a.user_satisfaction) || 0
      const turns = a.total_turns || 0
      const fields = a.fields_collected || 0

      if (cr < 30) autoDiagnostics.push({ priority: 'high', recommended: `信息收集完成率仅${Math.round(cr)}%，需优化收集策略，减少用户流失` })
      if (prof < 50) autoDiagnostics.push({ priority: 'high', recommended: `AI专业度评分${Math.round(prof)}，建议增加结构化回复和行业术语` })
      if (sat < 40) autoDiagnostics.push({ priority: 'high', recommended: `用户满意度仅${Math.round(sat)}，需增强共情表达和高效引导` })
      if (turns > 15 && cr < 50) autoDiagnostics.push({ priority: 'medium', recommended: `对话${turns}轮但完成率低，收集效率需提升` })
      if (fields < 3 && turns >= 5) autoDiagnostics.push({ priority: 'medium', recommended: `${turns}轮对话仅收集${fields}个字段，建议优化多字段合并提问` })
      if (collEff.redundantQuestions > 0) autoDiagnostics.push({ priority: 'medium', recommended: `存在${collEff.redundantQuestions}个重复提问，需避免追问已回答信息` })
      if (a.user_sentiment === 'negative' || a.user_sentiment === 'slightly_negative') {
        autoDiagnostics.push({ priority: 'high', recommended: '用户情绪偏负面，需增强共情回应和耐心引导' })
      }
      if (autoDiagnostics.length === 0) {
        autoDiagnostics.push({ priority: 'low', recommended: '基础指标正常，等待AI深度分析生成更精准建议' })
      }
    }

    return {
      ...a,
      completion_rate: parseFloat(a.completion_rate),
      professionalism_score: parseFloat(a.professionalism_score),
      appeal_success_rate: parseFloat(a.appeal_success_rate),
      user_satisfaction: parseFloat(a.user_satisfaction),
      suggestions: suggestions.length > 0 ? suggestions : autoDiagnostics,
      drop_off_point: a.drop_off_point || '',
      ai_highlights: highlights,
      collection_efficiency: collEff,
      response_quality: respQuality,
    }
  }
  return { topAnalyses: topAnalyses.map(pf), lowAnalyses: lowAnalyses.map(pf) }
}

function extractAIHighlights(analysis) {
  try {
    const raw = safeParse(analysis.raw_analysis) || {}
    const eff = raw.efficiency || {}
    return {
      bestMoment: eff.bestMoment || '',
      worstMoment: eff.worstMoment || '',
      redundantQuestions: eff.redundantQuestions || 0,
      smoothTransitions: eff.smoothTransitions ?? true,
    }
  } catch { return {} }
}

// ========== AI 自进化：规则变更日志 ==========

async function logRuleChange(ruleId, action, oldContent, newContent, reason = '', changedBy = 'system') {
  await getPool().execute(
    `INSERT INTO rule_change_log (rule_id, action, old_content, new_content, reason, changed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ruleId, action, oldContent ? JSON.stringify(oldContent) : null, newContent ? JSON.stringify(newContent) : null, reason, changedBy]
  )
}

export async function getRuleChangeLog(ruleId = null, limit = 50) {
  let sql = `SELECT cl.*, r.rule_key, r.rule_name, r.category
    FROM rule_change_log cl
    LEFT JOIN ai_rules r ON cl.rule_id = r.id`
  const params = []
  if (ruleId) { sql += ' WHERE cl.rule_id = ?'; params.push(ruleId) }
  sql += ' ORDER BY cl.created_at DESC LIMIT ?'
  params.push(limit)
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({
    ...r,
    old_content: safeParse(r.old_content),
    new_content: safeParse(r.new_content),
  }))
}

// ========== AI 自进化：学习指标 ==========

export async function upsertLearningMetrics(date, data) {
  await getPool().execute(
    `INSERT INTO learning_metrics
     (metric_date, total_conversations, avg_collection_turns, avg_completion_rate, avg_user_satisfaction,
      avg_professionalism, avg_appeal_success,
      completion_count, drop_off_count, top_drop_off_fields, top_improvements, rules_generated, rules_promoted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      total_conversations = VALUES(total_conversations),
      avg_collection_turns = VALUES(avg_collection_turns),
      avg_completion_rate = VALUES(avg_completion_rate),
      avg_user_satisfaction = VALUES(avg_user_satisfaction),
      avg_professionalism = VALUES(avg_professionalism),
      avg_appeal_success = VALUES(avg_appeal_success),
      completion_count = VALUES(completion_count),
      drop_off_count = VALUES(drop_off_count),
      top_drop_off_fields = VALUES(top_drop_off_fields),
      top_improvements = VALUES(top_improvements),
      rules_generated = VALUES(rules_generated),
      rules_promoted = VALUES(rules_promoted)`,
    [
      date, data.totalConversations || 0, data.avgCollectionTurns || 0,
      data.avgCompletionRate || 0, data.avgUserSatisfaction || 0,
      data.avgProfessionalism || 0, data.avgAppealSuccess || 0,
      data.completionCount || 0, data.dropOffCount || 0,
      JSON.stringify(data.topDropOffFields || []),
      JSON.stringify(data.topImprovements || []),
      data.rulesGenerated || 0, data.rulesPromoted || 0,
    ]
  )
}

export async function getLearningMetrics(days = 30) {
  const [rows] = await getPool().execute(
    `SELECT * FROM learning_metrics WHERE metric_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY metric_date ASC`,
    [days]
  )
  return rows.map(r => ({
    ...r,
    top_drop_off_fields: safeParse(r.top_drop_off_fields),
    top_improvements: safeParse(r.top_improvements),
  }))
}

// ========== AI 智能标签 ==========

export async function upsertConversationTags(sessionId, data) {
  await getPool().execute(
    `INSERT INTO conversation_tags
     (session_id, analysis_id, difficulty, user_type, quality_score, outcome, tags, industry_cluster, violation_cluster, pattern_flags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       analysis_id=VALUES(analysis_id), difficulty=VALUES(difficulty), user_type=VALUES(user_type),
       quality_score=VALUES(quality_score), outcome=VALUES(outcome), tags=VALUES(tags),
       industry_cluster=VALUES(industry_cluster), violation_cluster=VALUES(violation_cluster), pattern_flags=VALUES(pattern_flags)`,
    [
      sessionId, data.analysisId || null, data.difficulty || 'medium', data.userType || 'first_time',
      data.qualityScore || 0, data.outcome || 'partial',
      JSON.stringify(data.tags || []), data.industryCluster || '', data.violationCluster || '',
      JSON.stringify(data.patternFlags || {}),
    ]
  )
}

export async function getConversationTags(sessionId) {
  const [rows] = await getPool().execute('SELECT * FROM conversation_tags WHERE session_id = ?', [sessionId])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, tags: safeParse(r.tags), pattern_flags: safeParse(r.pattern_flags) }
}

export async function getTagStats() {
  const [byDifficulty] = await getPool().execute(
    `SELECT difficulty, COUNT(*) as cnt, AVG(quality_score) as avg_quality FROM conversation_tags GROUP BY difficulty`
  )
  const [byOutcome] = await getPool().execute(
    `SELECT outcome, COUNT(*) as cnt FROM conversation_tags GROUP BY outcome`
  )
  const [byUserType] = await getPool().execute(
    `SELECT user_type, COUNT(*) as cnt, AVG(quality_score) as avg_quality FROM conversation_tags GROUP BY user_type`
  )
  const [topClusters] = await getPool().execute(
    `SELECT industry_cluster, COUNT(*) as cnt, AVG(quality_score) as avg_quality
     FROM conversation_tags WHERE industry_cluster != '' GROUP BY industry_cluster ORDER BY cnt DESC LIMIT 20`
  )
  const [total] = await getPool().execute(`SELECT COUNT(*) as cnt FROM conversation_tags`)
  return { total: total[0].cnt, byDifficulty, byOutcome, byUserType, topClusters }
}

// ========== 知识聚合簇 ==========

export async function upsertKnowledgeCluster(type, key, data) {
  await getPool().execute(
    `INSERT INTO knowledge_clusters (cluster_type, cluster_key, cluster_name, insight_data, sample_count, confidence)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cluster_name=VALUES(cluster_name), insight_data=VALUES(insight_data),
       sample_count=VALUES(sample_count), confidence=VALUES(confidence)`,
    [type, key, data.name || key, JSON.stringify(data.insights || {}), data.sampleCount || 0, data.confidence || 0]
  )
}

export async function getKnowledgeClusters(type = null, minConfidence = 0) {
  let sql = 'SELECT * FROM knowledge_clusters WHERE confidence >= ?'
  const params = [minConfidence]
  if (type) { sql += ' AND cluster_type = ?'; params.push(type) }
  sql += ' ORDER BY confidence DESC, sample_count DESC LIMIT 100'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({ ...r, insight_data: safeParse(r.insight_data) }))
}

export async function getClusterStats() {
  const [byType] = await getPool().execute(
    `SELECT cluster_type, COUNT(*) as cnt, AVG(confidence) as avg_confidence, SUM(sample_count) as total_samples
     FROM knowledge_clusters GROUP BY cluster_type`
  )
  return { byType }
}

// ========== 引擎健康 & 熔断器 ==========

export async function upsertEngineHealth(component, data) {
  await getPool().execute(
    `INSERT INTO engine_health (component, status, error_count, success_count, last_error, last_success_at, last_error_at, circuit_opened_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status=VALUES(status), error_count=VALUES(error_count), success_count=VALUES(success_count),
       last_error=VALUES(last_error), last_success_at=VALUES(last_success_at), last_error_at=VALUES(last_error_at),
       circuit_opened_at=VALUES(circuit_opened_at), metadata=VALUES(metadata)`,
    [
      component, data.status || 'healthy', data.errorCount || 0, data.successCount || 0,
      data.lastError || null, data.lastSuccessAt || null, data.lastErrorAt || null,
      data.circuitOpenedAt || null, JSON.stringify(data.metadata || {}),
    ]
  )
}

export async function getEngineHealth(component = null) {
  if (component) {
    const [rows] = await getPool().execute('SELECT * FROM engine_health WHERE component = ?', [component])
    return rows.length > 0 ? { ...rows[0], metadata: safeParse(rows[0].metadata) } : null
  }
  const [rows] = await getPool().execute('SELECT * FROM engine_health ORDER BY component')
  return rows.map(r => ({ ...r, metadata: safeParse(r.metadata) }))
}

export async function incrementEngineError(component, errorMsg) {
  await getPool().execute(
    `INSERT INTO engine_health (component, status, error_count, last_error, last_error_at)
     VALUES (?, 'degraded', 1, ?, NOW())
     ON DUPLICATE KEY UPDATE
       error_count = error_count + 1, last_error = VALUES(last_error), last_error_at = NOW(),
       status = CASE WHEN error_count + 1 >= 5 THEN 'circuit_open' WHEN error_count + 1 >= 3 THEN 'degraded' ELSE status END,
       circuit_opened_at = CASE WHEN error_count + 1 >= 5 AND circuit_opened_at IS NULL THEN NOW() ELSE circuit_opened_at END`,
    [component, errorMsg]
  )
}

export async function recordEngineSuccess(component) {
  await getPool().execute(
    `INSERT INTO engine_health (component, status, success_count, last_success_at)
     VALUES (?, 'healthy', 1, NOW())
     ON DUPLICATE KEY UPDATE
       success_count = success_count + 1, last_success_at = NOW(),
       status = CASE WHEN status = 'circuit_open' THEN 'recovering' ELSE 'healthy' END,
       error_count = CASE WHEN success_count + 1 >= 3 AND status IN ('degraded','recovering') THEN 0 ELSE error_count END,
       circuit_opened_at = CASE WHEN success_count + 1 >= 3 THEN NULL ELSE circuit_opened_at END`,
    [component]
  )
}

// ========== 探索实验 ==========

export async function createExperiment(data) {
  const [result] = await getPool().execute(
    `INSERT INTO exploration_experiments (experiment_name, rule_id, hypothesis, variant_a, variant_b)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.ruleId || null, data.hypothesis || '', JSON.stringify(data.variantA || {}), JSON.stringify(data.variantB || {})]
  )
  return { id: result.insertId }
}

export async function updateExperiment(id, data) {
  const sets = []
  const params = []
  if (data.sampleA !== undefined) { sets.push('sample_a = ?'); params.push(data.sampleA) }
  if (data.sampleB !== undefined) { sets.push('sample_b = ?'); params.push(data.sampleB) }
  if (data.resultA) { sets.push('result_a = ?'); params.push(JSON.stringify(data.resultA)) }
  if (data.resultB) { sets.push('result_b = ?'); params.push(JSON.stringify(data.resultB)) }
  if (data.status) { sets.push('status = ?'); params.push(data.status) }
  if (data.winner) { sets.push('winner = ?'); params.push(data.winner) }
  if (data.status === 'completed' || data.status === 'aborted') { sets.push('ended_at = NOW()') }
  if (sets.length === 0) return
  params.push(id)
  await getPool().execute(`UPDATE exploration_experiments SET ${sets.join(', ')} WHERE id = ?`, params)
}

export async function getExperiments(status = null) {
  let sql = 'SELECT * FROM exploration_experiments'
  const params = []
  if (status) { sql += ' WHERE status = ?'; params.push(status) }
  sql += ' ORDER BY started_at DESC LIMIT 50'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({
    ...r, variant_a: safeParse(r.variant_a), variant_b: safeParse(r.variant_b),
    result_a: safeParse(r.result_a), result_b: safeParse(r.result_b),
  }))
}

// ========== AI 智能商城 ==========

export async function createProduct(data) {
  const [result] = await getPool().execute(
    `INSERT INTO mall_products (name, category, price, original_price, description, ai_description, image_url, tags, target_audience, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.category || '', data.price || 0, data.originalPrice || 0,
      data.description || '', data.aiDescription || '', data.imageUrl || '',
      JSON.stringify(data.tags || []), JSON.stringify(data.targetAudience || []),
      data.status || 'draft', data.sortOrder || 0,
    ]
  )
  return { id: result.insertId }
}

export async function updateProduct(id, data) {
  const sets = []; const params = []
  if (data.name !== undefined) { sets.push('name=?'); params.push(data.name) }
  if (data.category !== undefined) { sets.push('category=?'); params.push(data.category) }
  if (data.price !== undefined) { sets.push('price=?'); params.push(data.price) }
  if (data.originalPrice !== undefined) { sets.push('original_price=?'); params.push(data.originalPrice) }
  if (data.description !== undefined) { sets.push('description=?'); params.push(data.description) }
  if (data.aiDescription !== undefined) { sets.push('ai_description=?'); params.push(data.aiDescription) }
  if (data.imageUrl !== undefined) { sets.push('image_url=?'); params.push(data.imageUrl) }
  if (data.tags !== undefined) { sets.push('tags=?'); params.push(JSON.stringify(data.tags)) }
  if (data.targetAudience !== undefined) { sets.push('target_audience=?'); params.push(JSON.stringify(data.targetAudience)) }
  if (data.status !== undefined) { sets.push('status=?'); params.push(data.status) }
  if (data.sortOrder !== undefined) { sets.push('sort_order=?'); params.push(data.sortOrder) }
  if (data.recommendationScore !== undefined) { sets.push('recommendation_score=?'); params.push(data.recommendationScore) }
  if (data.aiOptimizedAt !== undefined) { sets.push('ai_optimized_at=NOW()') }
  if (sets.length === 0) return null
  params.push(id)
  await getPool().execute(`UPDATE mall_products SET ${sets.join(', ')} WHERE id = ?`, params)
  return getProductById(id)
}

export async function deleteProduct(id) {
  await getPool().execute('DELETE FROM mall_products WHERE id = ?', [id])
}

/** 批量更新商品状态；返回实际更新条数 */
export async function batchUpdateProductsStatus(ids, status) {
  const allowed = new Set(['active', 'draft', 'archived', 'sold_out'])
  if (!allowed.has(status)) throw new Error('无效的商品状态')
  const unique = [...new Set(ids.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))]
  if (!unique.length) return { updated: 0, ids: [] }
  const placeholders = unique.map(() => '?').join(',')
  const [result] = await getPool().execute(
    `UPDATE mall_products SET status = ? WHERE id IN (${placeholders})`,
    [status, ...unique],
  )
  return { updated: result.affectedRows || 0, ids: unique }
}

export async function getProductById(id) {
  const [rows] = await getPool().execute('SELECT * FROM mall_products WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, tags: safeParse(r.tags), target_audience: safeParse(r.target_audience) }
}

export async function getProducts(filters = {}) {
  let sql = 'SELECT * FROM mall_products WHERE 1=1'
  const params = []
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status) }
  if (filters.category) { sql += ' AND category = ?'; params.push(filters.category) }
  if (filters.search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`) }
  sql += ' ORDER BY sort_order ASC, recommendation_score DESC, id DESC'
  if (filters.limit) { sql += ' LIMIT ?'; params.push(parseInt(filters.limit)) }
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({ ...r, tags: safeParse(r.tags), target_audience: safeParse(r.target_audience) }))
}

export async function getActiveProductsForAI() {
  const [rows] = await getPool().execute(
    `SELECT id, name, category, price, original_price, description, ai_description, tags, target_audience, recommendation_score
     FROM mall_products WHERE status = 'active' ORDER BY recommendation_score DESC, sort_order ASC LIMIT 50`
  )
  return rows.map(r => ({ ...r, tags: safeParse(r.tags), target_audience: safeParse(r.target_audience) }))
}

export async function getProductStats() {
  const [totals] = await getPool().execute(
    `SELECT COUNT(*) as total, SUM(status='active') as active, SUM(status='draft') as draft,
     SUM(status='sold_out') as sold_out, SUM(view_count) as total_views, SUM(click_count) as total_clicks,
     SUM(purchase_count) as total_purchases FROM mall_products`
  )
  const [byCategory] = await getPool().execute(
    `SELECT category, COUNT(*) as cnt, AVG(recommendation_score) as avg_score
     FROM mall_products WHERE category != '' GROUP BY category ORDER BY cnt DESC`
  )
  return { totals: totals[0], byCategory }
}

export async function incrementProductMetric(id, field, conn) {
  const allowed = ['view_count', 'click_count', 'purchase_count']
  if (!allowed.includes(field)) return
  const db = conn || getPool()
  await db.execute(`UPDATE mall_products SET ${field} = ${field} + 1 WHERE id = ?`, [id])
}

// --- 用户兴趣画像 ---

export async function upsertUserInterest(userId, data) {
  await getPool().execute(
    `INSERT INTO user_interests (user_id, session_id, industry, problem_type, keywords, need_tags, interest_score, last_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       session_id=VALUES(session_id), industry=VALUES(industry), problem_type=VALUES(problem_type),
       keywords=VALUES(keywords), need_tags=VALUES(need_tags), interest_score=VALUES(interest_score), last_active=NOW()`,
    [
      userId, data.sessionId || '', data.industry || '', data.problemType || '',
      JSON.stringify(data.keywords || []), JSON.stringify(data.needTags || []),
      JSON.stringify(data.interestScore || {}),
    ]
  )
}

export async function getUserInterest(userId) {
  const [rows] = await getPool().execute('SELECT * FROM user_interests WHERE user_id = ?', [userId])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, keywords: safeParse(r.keywords), need_tags: safeParse(r.need_tags), interest_score: safeParse(r.interest_score) }
}

// --- 商品推荐记录 ---

export async function createRecommendation(data) {
  const [result] = await getPool().execute(
    `INSERT INTO product_recommendations (user_id, session_id, product_id, reason, match_score)
     VALUES (?, ?, ?, ?, ?)`,
    [data.userId || null, data.sessionId || '', data.productId, data.reason || '', data.matchScore || 0]
  )
  return { id: result.insertId }
}

export async function getRecommendations(userId = null, sessionId = null, limit = 10) {
  let sql = `SELECT r.*, p.name as product_name, p.price, p.image_url, p.category, p.ai_description
     FROM product_recommendations r LEFT JOIN mall_products p ON r.product_id = p.id WHERE 1=1`
  const params = []
  if (userId) { sql += ' AND r.user_id = ?'; params.push(userId) }
  if (sessionId) { sql += ' AND r.session_id = ?'; params.push(sessionId) }
  sql += ' ORDER BY r.match_score DESC, r.created_at DESC LIMIT ?'
  params.push(limit)
  const [rows] = await getPool().execute(sql, params)
  return rows
}

export async function updateRecommendationStatus(id, status) {
  const timeField = status === 'shown' ? ', shown_at=NOW()' : status === 'clicked' ? ', clicked_at=NOW()' : ''
  await getPool().execute(`UPDATE product_recommendations SET status=?${timeField} WHERE id = ?`, [status, id])
}

export async function listAdminRecommendations({ page = 1, pageSize = 50, status } = {}) {
  const ps = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 100)
  const pg = Math.max(parseInt(page, 10) || 1, 1)
  const offset = (pg - 1) * ps
  let sql = `SELECT r.*, p.name as product_name, p.price, p.image_url, p.category
     FROM product_recommendations r LEFT JOIN mall_products p ON r.product_id = p.id WHERE 1=1`
  const params = []
  if (status) { sql += ' AND r.status = ?'; params.push(status) }
  sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
  params.push(ps, offset)
  const [rows] = await getPool().execute(sql, params)
  let countSql = 'SELECT COUNT(*) as total FROM product_recommendations WHERE 1=1'
  const countParams = []
  if (status) { countSql += ' AND status = ?'; countParams.push(status) }
  const [countResult] = await getPool().execute(countSql, countParams)
  return { list: rows, total: countResult[0].total, page: pg, pageSize: ps }
}

export async function getRecommendationStats() {
  const [totals] = await getPool().execute(
    `SELECT COUNT(*) as total, SUM(status='shown') as shown, SUM(status='clicked') as clicked,
     SUM(status='purchased') as purchased, SUM(status='dismissed') as dismissed FROM product_recommendations`
  )
  const [topProducts] = await getPool().execute(
    `SELECT p.id, p.name, COUNT(*) as rec_count, SUM(r.status='clicked') as clicks, SUM(r.status='purchased') as purchases
     FROM product_recommendations r JOIN mall_products p ON r.product_id = p.id
     GROUP BY p.id ORDER BY rec_count DESC LIMIT 10`
  )
  return { totals: totals[0], topProducts }
}

export async function getUnanalyzedSessions(limit = 20) {
  const [rows] = await getPool().execute(
    `SELECT s.id, s.user_id, s.collected_data, s.step, s.status, s.created_at,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
     FROM sessions s
     WHERE NOT EXISTS (SELECT 1 FROM conversation_analyses ca WHERE ca.session_id = s.id)
       AND EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id AND m.role = 'user')
       AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY s.created_at DESC LIMIT ?`,
    [limit]
  )
  return rows.map(r => ({ ...r, collected_data: safeParse(r.collected_data) }))
}

// ========== 字段变更记录 ==========

export async function logFieldChange(sessionId, fieldKey, fieldLabel, oldValue, newValue, changeSource, changeReason) {
  await getPool().execute(
    `INSERT INTO field_change_log (session_id, field_key, field_label, old_value, new_value, change_source, change_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, fieldKey, fieldLabel || fieldKey, oldValue || '', newValue || '', changeSource || 'ai_extract', changeReason || '']
  )
}

export async function getFieldChangeLog(sessionId, fieldKey = null) {
  let sql = 'SELECT * FROM field_change_log WHERE session_id = ?'
  const params = [sessionId]
  if (fieldKey) { sql += ' AND field_key = ?'; params.push(fieldKey) }
  sql += ' ORDER BY created_at ASC'
  const [rows] = await getPool().execute(sql, params)
  return rows
}

// ========== AI 模型管理 ==========

export async function getAIModels() {
  const [rows] = await getPool().execute('SELECT * FROM ai_models ORDER BY sort_order ASC, id ASC')
  return rows.map(r => ({
    ...r,
    api_key: r.api_key ? safeDecrypt(r.api_key) : '',
  }))
}

export async function getAIModelById(id) {
  const [rows] = await getPool().execute('SELECT * FROM ai_models WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }
}

export async function getActiveAIModel() {
  const [rows] = await getPool().execute('SELECT * FROM ai_models WHERE is_active = 1 AND is_enabled = 1 LIMIT 1')
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }
}

export async function createAIModel({ provider, displayName, apiKey, modelName, endpoint, isFree, sortOrder, extra }) {
  const encKey = apiKey ? safeEncrypt(apiKey) : ''
  const [result] = await getPool().execute(
    'INSERT INTO ai_models (provider, display_name, api_key, model_name, endpoint, is_free, sort_order, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [provider, displayName, encKey, modelName, endpoint, isFree ? 1 : 0, sortOrder || 0, extra ? JSON.stringify(extra) : null]
  )
  return { id: result.insertId }
}

export async function updateAIModel(id, fields) {
  const sets = []
  const params = []
  if (fields.displayName !== undefined) { sets.push('display_name=?'); params.push(fields.displayName) }
  if (fields.apiKey !== undefined) { sets.push('api_key=?'); params.push(fields.apiKey ? safeEncrypt(fields.apiKey) : '') }
  if (fields.modelName !== undefined) { sets.push('model_name=?'); params.push(fields.modelName) }
  if (fields.endpoint !== undefined) { sets.push('endpoint=?'); params.push(fields.endpoint) }
  if (fields.isEnabled !== undefined) { sets.push('is_enabled=?'); params.push(fields.isEnabled ? 1 : 0) }
  if (fields.isFree !== undefined) { sets.push('is_free=?'); params.push(fields.isFree ? 1 : 0) }
  if (fields.sortOrder !== undefined) { sets.push('sort_order=?'); params.push(fields.sortOrder) }
  if (fields.extra !== undefined) { sets.push('extra=?'); params.push(JSON.stringify(fields.extra)) }
  if (sets.length === 0) return
  params.push(id)
  await getPool().execute(`UPDATE ai_models SET ${sets.join(',')} WHERE id = ?`, params)
}

export async function setActiveAIModel(id) {
  await getPool().execute('UPDATE ai_models SET is_active = 0')
  await getPool().execute('UPDATE ai_models SET is_active = 1 WHERE id = ? AND is_enabled = 1', [id])
}

export async function deleteAIModel(id) {
  await getPool().execute('DELETE FROM ai_models WHERE id = ? AND is_active = 0', [id])
}

// 更新模型健康状态
export async function updateModelHealth(id, { status, error, responseMs }) {
  const failIncr = status === 'healthy' ? 0 : undefined
  if (status === 'healthy') {
    await getPool().execute(
      'UPDATE ai_models SET health_status=?, last_check_at=NOW(), last_error=NULL, consecutive_fails=0, response_ms=? WHERE id=?',
      [status, responseMs || null, id]
    )
  } else {
    await getPool().execute(
      'UPDATE ai_models SET health_status=?, last_check_at=NOW(), last_error=?, consecutive_fails=consecutive_fails+1, response_ms=NULL WHERE id=?',
      [status, (error || '').substring(0, 500), id]
    )
  }
}

// 获取所有启用的、有 Key 的免费模型（按健康状态+排序）
export async function getHealthyFreeModels() {
  const [rows] = await getPool().execute(
    `SELECT * FROM ai_models WHERE is_enabled=1 AND is_free=1 AND api_key!='' 
     ORDER BY health_status='healthy' DESC, consecutive_fails ASC, sort_order ASC`
  )
  return rows.map(r => ({ ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }))
}

// 获取可用于 fallback 的模型列表（排除当前活跃模型）
export async function getFallbackModels(excludeId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM ai_models WHERE is_enabled=1 AND api_key!='' AND id!=?
     ORDER BY is_free DESC, health_status='healthy' DESC, consecutive_fails ASC, sort_order ASC`,
    [excludeId || 0]
  )
  return rows.map(r => ({ ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }))
}

// 获取所有模型（含健康信息，管理面板用）
export async function getAIModelsWithHealth() {
  const [rows] = await getPool().execute('SELECT * FROM ai_models ORDER BY sort_order ASC, id ASC')
  return rows.map(r => ({
    ...r,
    api_key: r.api_key ? safeDecrypt(r.api_key) : '',
    has_key: !!(r.api_key && r.api_key.length > 0),
  }))
}

// ========== DeepSeek 多账号余额管理 ==========

export async function getDeepseekAccounts() {
  const [rows] = await getPool().execute('SELECT * FROM deepseek_accounts ORDER BY id ASC')
  return rows.map(r => ({ ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }))
}

export async function getDeepseekAccountById(id) {
  const [rows] = await getPool().execute('SELECT * FROM deepseek_accounts WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, api_key: r.api_key ? safeDecrypt(r.api_key) : '' }
}

export async function createDeepseekAccount({ label, apiKey, warningThreshold }) {
  const encKey = apiKey ? safeEncrypt(apiKey) : ''
  const [result] = await getPool().execute(
    'INSERT INTO deepseek_accounts (label, api_key, warning_threshold) VALUES (?, ?, ?)',
    [label || '', encKey, warningThreshold || 10.00]
  )
  return { id: result.insertId }
}

export async function updateDeepseekAccount(id, fields) {
  const sets = []
  const params = []
  if (fields.label !== undefined) { sets.push('label=?'); params.push(fields.label) }
  if (fields.apiKey !== undefined) { sets.push('api_key=?'); params.push(fields.apiKey ? safeEncrypt(fields.apiKey) : '') }
  if (fields.isEnabled !== undefined) { sets.push('is_enabled=?'); params.push(fields.isEnabled ? 1 : 0) }
  if (fields.warningThreshold !== undefined) { sets.push('warning_threshold=?'); params.push(fields.warningThreshold) }
  if (sets.length === 0) return
  params.push(id)
  await getPool().execute(`UPDATE deepseek_accounts SET ${sets.join(',')} WHERE id = ?`, params)
}

export async function deleteDeepseekAccount(id) {
  await getPool().execute('DELETE FROM deepseek_accounts WHERE id = ?', [id])
}

export async function updateDeepseekBalance(id, { totalBalance, grantedBalance, toppedUpBalance, isAvailable, error }) {
  if (error) {
    await getPool().execute(
      'UPDATE deepseek_accounts SET last_check_at=NOW(), last_error=?, is_available=0 WHERE id=?',
      [(error || '').substring(0, 500), id]
    )
  } else {
    await getPool().execute(
      'UPDATE deepseek_accounts SET total_balance=?, granted_balance=?, topped_up_balance=?, is_available=?, last_check_at=NOW(), last_error=NULL WHERE id=?',
      [totalBalance, grantedBalance, toppedUpBalance, isAvailable ? 1 : 0, id]
    )
  }
}

// ========== AI行为日志 ==========

export async function logAIActivity({ action, category = 'general', detail = '', tokens_used = 0, cost = 0, duration_ms = 0, status = 'success' }) {
  try {
    const [result] = await getPool().execute(
      'INSERT INTO ai_activity_log (action, category, detail, tokens_used, cost, duration_ms, status) VALUES (?,?,?,?,?,?,?)',
      [action, category, detail, tokens_used, cost, duration_ms, status]
    )
    return { id: result.insertId }
  } catch (err) {
    console.error('[DB] AI活动日志写入失败:', err.message)
    return null
  }
}

export async function getAIActivityLog(limit = 50, offset = 0, category = null) {
  let sql = 'SELECT * FROM ai_activity_log WHERE 1=1'
  const params = []
  if (category) { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  const [rows] = await getPool().execute(sql, params)
  return rows
}

export async function getAIActivityStats() {
  const [rows] = await getPool().execute(`
    SELECT 
      COUNT(*) as total,
      SUM(tokens_used) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(CASE WHEN status='success' THEN 1 END) as success_count,
      COUNT(CASE WHEN status='failed' THEN 1 END) as failed_count,
      COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as last_24h,
      SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN tokens_used ELSE 0 END) as tokens_24h
    FROM ai_activity_log
  `)
  return rows[0] || {}
}

// ========== 订单管理 ==========

export async function createOrder(data, conn) {
  const db = conn || getPool()
  const orderNo = data.orderNo || `AP${Date.now()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
  const [result] = await db.execute(
    `INSERT INTO orders (order_no, user_id, product_id, product_name, amount, status, persona, collected_data, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderNo, data.userId || data.user_id, data.productId || data.product_id, data.productName || data.product_name,
     data.price || data.amount || 0, data.status || 'pending',
     JSON.stringify(data.persona || {}), JSON.stringify(data.collectedData || data.collected_data || {}),
     data.session_id || data.sessionId || null]
  )
  return { id: result.insertId, orderNo }
}

export async function getOrderByNo(orderNo) {
  const [rows] = await getPool().execute('SELECT * FROM orders WHERE order_no = ?', [orderNo])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, persona: safeParse(r.persona), collected_data: safeParse(r.collected_data), service_messages: safeParse(r.service_messages) }
}

export async function getOrders(filters = {}) {
  let sql = `SELECT o.*, u.phone, u.nickname
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE 1=1`
  const params = []
  if (filters.status) { sql += ' AND o.status = ?'; params.push(filters.status) }
  if (filters.user_id) { sql += ' AND o.user_id = ?'; params.push(filters.user_id) }
  sql += ' ORDER BY o.created_at DESC'
  const [rows] = await getPool().execute(sql, params)
  return rows.map(r => ({
    ...r,
    persona: safeParse(r.persona),
    collected_data: safeParse(r.collected_data),
    service_messages: safeParse(r.service_messages),
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
  }))
}

export async function getOrdersByUser(userId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  )
  return rows.map(r => ({
    ...r,
    persona: safeParse(r.persona),
    collected_data: safeParse(r.collected_data),
    service_messages: safeParse(r.service_messages),
  }))
}

export async function getOrderById(id, conn) {
  const db = conn || getPool()
  const [rows] = await db.execute(
    `SELECT o.*, u.phone, u.nickname
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [id]
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    persona: safeParse(r.persona),
    collected_data: safeParse(r.collected_data),
    service_messages: safeParse(r.service_messages),
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
  }
}

export async function updateOrderStatus(id, status, conn) {
  const db = conn || getPool()
  const now = new Date()
  const updates = ['status = ?']
  const params = [status]
  if (status === 'paid') { updates.push('payment_time = ?'); params.push(now) }
  if (status === 'completed') { updates.push('completed_time = ?'); params.push(now) }
  params.push(id)
  await db.execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params)
  const [rows] = await db.execute('SELECT * FROM orders WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    persona: safeParse(r.persona),
    collected_data: safeParse(r.collected_data),
    service_messages: safeParse(r.service_messages),
  }
}

export async function getUserOrders(userId) {
  const [rows] = await getPool().execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId])
  return rows.map(r => ({ ...r, persona: safeParse(r.persona), collected_data: safeParse(r.collected_data), service_messages: safeParse(r.service_messages) }))
}

export async function appendServiceMessage(orderId, message, conn) {
  const order = await getOrderById(orderId, conn)
  if (!order) return null
  const msgs = order.service_messages || []
  msgs.push(message)
  const db = conn || getPool()
  await db.execute('UPDATE orders SET service_messages = ? WHERE id = ?', [JSON.stringify(msgs), orderId])
  return msgs
}

export async function getOrderServiceMessages(orderId) {
  const order = await getOrderById(orderId)
  return order ? (order.service_messages || []) : []
}

// ========== 投诉材料整理 ==========

export async function saveComplaintDoc({ sessionId, userId, docTitle, complaintSummary, merchantInfo, violationDetail, evidenceList, timeline, appealPoints, fullDocument, inputTokens, outputTokens, cost }) {
  const [result] = await getPool().execute(
    `INSERT INTO complaint_docs (session_id, user_id, doc_title, complaint_summary, merchant_info, violation_detail, evidence_list, timeline, appeal_points, full_document, input_tokens, output_tokens, cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, docTitle || '', complaintSummary || '', merchantInfo || '', violationDetail || '', evidenceList || '', timeline || '', appealPoints || '', fullDocument || '', inputTokens || 0, outputTokens || 0, cost || 0]
  )
  return result.insertId
}

export async function getComplaintDoc(sessionId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM complaint_docs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
    [sessionId]
  )
  return rows.length > 0 ? rows[0] : null
}

// ========== 日程安排 ==========

export async function createSchedule({ title, description, scheduledTime, type = 'reminder', status = 'pending' }) {
  const [result] = await getPool().execute(
    'INSERT INTO schedules (title, description, scheduled_time, type, status) VALUES (?, ?, ?, ?, ?)',
    [title, description || '', scheduledTime, type, status]
  )
  return result.insertId
}

export async function getSchedules() {
  const [rows] = await getPool().execute(
    'SELECT * FROM schedules ORDER BY scheduled_time ASC'
  )
  return rows
}

export async function updateSchedule(id, { title, description, scheduledTime, type, status }) {
  const updates = []
  const values = []
  if (title !== undefined) { updates.push('title = ?'); values.push(title) }
  if (description !== undefined) { updates.push('description = ?'); values.push(description) }
  if (scheduledTime !== undefined) { updates.push('scheduled_time = ?'); values.push(scheduledTime) }
  if (type !== undefined) { updates.push('type = ?'); values.push(type) }
  if (status !== undefined) {
    updates.push('status = ?')
    values.push(status)
    if (status === 'completed') {
      updates.push('completed_at = NOW()')
    }
  }
  if (updates.length === 0) return
  values.push(id)
  await getPool().execute(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`, values)
}

export async function deleteSchedule(id) {
  await getPool().execute('DELETE FROM schedules WHERE id = ?', [id])
}
