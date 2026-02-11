import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { encrypt, decrypt, safeEncrypt, safeDecrypt, hmacHash } from './crypto.js'

// 敏感配置字段 — 存储时加密、读取时解密
const SENSITIVE_SYS_KEYS = ['deepseek_api_key']
const SENSITIVE_PAY_KEYS = [
  'wx_api_key', 'wx_api_v3_key', 'wx_private_key', 'wx_serial_no',
  'ali_private_key', 'ali_public_key',
]

const DB_CONFIG = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'merchant_appeal',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  connectTimeout: 30000,
  // SSL for remote Malaysia DB (uncomment when deploying)
  // ssl: { rejectUnauthorized: true },
}

let pool = null

// LIKE 查询特殊字符转义，防止 % 和 _ 被当作通配符
function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&')
}

export async function initDatabase() {
  const tmpConn = await mysql.createConnection({
    host: DB_CONFIG.host, port: DB_CONFIG.port,
    user: DB_CONFIG.user, password: DB_CONFIG.password,
    connectTimeout: DB_CONFIG.connectTimeout,
  })
  await tmpConn.execute(
    `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await tmpConn.end()

  pool = mysql.createPool(DB_CONFIG)

  // 连接池健康监控：捕获底层连接错误防止进程崩溃
  pool.pool.on('connection', () => { /* new connection acquired */ })
  pool.pool.on('release', () => { /* connection released */ })
  // 定时 keepalive ping 防止连接被 MySQL wait_timeout 关闭
  setInterval(async () => {
    try { await pool.execute('SELECT 1') }
    catch (err) { console.error('[DB Keepalive] ping failed:', err.message) }
  }, 60000)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'active',
      collected_data JSON,
      step INT DEFAULT 0,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // 迁移：给旧表加 user_id 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE sessions ADD COLUMN user_id INT DEFAULT NULL AFTER id')
    await pool.execute('ALTER TABLE sessions ADD INDEX idx_user (user_id)')
  } catch { /* 列已存在，忽略 */ }
  // 迁移：给 sessions 加 deep_analysis_result 列
  try {
    await pool.execute('ALTER TABLE sessions ADD COLUMN deep_analysis_result MEDIUMTEXT DEFAULT NULL')
  } catch { /* 列已存在，忽略 */ }
  // 迁移：messages.content TEXT → MEDIUMTEXT（AI报告可能超过64KB）
  try {
    await pool.execute('ALTER TABLE messages MODIFY content MEDIUMTEXT NOT NULL')
  } catch { /* 忽略 */ }
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password VARCHAR(128) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS system_config (
      config_key VARCHAR(128) PRIMARY KEY,
      config_value TEXT,
      config_label VARCHAR(128),
      config_group VARCHAR(64) DEFAULT 'general',
      sort_order INT DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS payment_config (
      config_key VARCHAR(128) PRIMARY KEY,
      config_value TEXT,
      config_label VARCHAR(128),
      config_group VARCHAR(32) DEFAULT 'wechat',
      sort_order INT DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(512) NOT NULL,
      phone_hash VARCHAR(64) UNIQUE NOT NULL,
      nickname VARCHAR(512) DEFAULT '',
      balance DECIMAL(10,2) DEFAULT 0.00,
      api_mode ENUM('official','custom') DEFAULT 'official',
      custom_api_key VARCHAR(512) DEFAULT '',
      last_active_at DATETIME DEFAULT NULL,
      last_ip VARCHAR(512) DEFAULT '',
      login_count INT DEFAULT 0,
      total_messages INT DEFAULT 0,
      total_spent DECIMAL(10,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // 迁移：给旧 users 表加新列（包括加密迁移列）
  const userMigrations = [
    'ALTER TABLE users ADD COLUMN last_active_at DATETIME DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN last_ip VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users ADD COLUMN login_count INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN total_messages INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0.00',
    'ALTER TABLE users ADD COLUMN phone_hash VARCHAR(64) NOT NULL DEFAULT "" AFTER phone',
    'ALTER TABLE users MODIFY phone VARCHAR(512) NOT NULL',
    'ALTER TABLE users MODIFY nickname VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users MODIFY custom_api_key VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users MODIFY last_ip VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users ADD COLUMN deep_analysis_count INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN deep_analysis_month VARCHAR(7) DEFAULT ""',
  ]
  for (const sql of userMigrations) { try { await pool.execute(sql) } catch { /* 已存在 */ } }

  // 迁移：加密现有明文数据（phone、nickname、last_ip）
  await migrateEncryptUserData()

  // 迁移：添加 phone_hash 唯一索引（替换旧的 phone 唯一索引）
  try { await pool.execute('ALTER TABLE users DROP INDEX phone') } catch { /* 索引不存在 */ }
  try { await pool.execute('ALTER TABLE users ADD UNIQUE INDEX idx_phone_hash (phone_hash)') } catch { /* 已存在 */ }

  // 充值订单表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS recharge_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','confirmed','rejected') DEFAULT 'pending',
      payment_method VARCHAR(32) DEFAULT '',
      remark VARCHAR(512) DEFAULT '',
      admin_note VARCHAR(512) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME DEFAULT NULL,
      confirmed_by INT DEFAULT NULL,
      INDEX idx_user (user_id),
      INDEX idx_status (status),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 用户行为追踪表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      action VARCHAR(64) NOT NULL,
      detail VARCHAR(512) DEFAULT '',
      ip VARCHAR(512) DEFAULT '',
      user_agent VARCHAR(512) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_action (user_id),
      INDEX idx_action (action),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // 迁移：user_actions.ip 列扩容（加密后更长）
  try { await pool.execute('ALTER TABLE user_actions MODIFY ip VARCHAR(512) DEFAULT ""') } catch { /* 忽略 */ }

  // 迁移：加密 user_actions 中的明文 IP
  await migrateEncryptActionIPs()

  // 成功案例知识库
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS success_cases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) DEFAULT NULL,
      title VARCHAR(256) NOT NULL DEFAULT '',
      industry VARCHAR(64) DEFAULT '',
      problem_type VARCHAR(128) DEFAULT '',
      collected_data JSON,
      report_content TEXT,
      success_summary TEXT,
      admin_notes TEXT,
      status ENUM('active','archived') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_industry (industry),
      INDEX idx_problem (problem_type),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // Token消费明细表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_id VARCHAR(64) DEFAULT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'chat',
      input_tokens INT DEFAULT 0,
      output_tokens INT DEFAULT 0,
      total_tokens INT DEFAULT 0,
      cost DECIMAL(10,4) DEFAULT 0.0000,
      multiplier DECIMAL(5,2) DEFAULT 2.00,
      api_mode VARCHAR(16) DEFAULT 'official',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_type (type),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 申诉文案表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS appeal_texts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      business_model TEXT,
      refund_rules TEXT,
      complaint_cause TEXT,
      complaint_resolution TEXT,
      supplementary TEXT,
      input_tokens INT DEFAULT 0,
      output_tokens INT DEFAULT 0,
      cost DECIMAL(10,4) DEFAULT 0.0000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 默认管理员（bcrypt 哈希密码）
  const [admins] = await pool.execute('SELECT COUNT(*) as cnt FROM admins')
  if (admins[0].cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 12)
    await pool.execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hash])
    console.warn('\n⚠️  安全警告：已创建默认管理员账户 admin / admin123')
    console.warn('   请立即登录后台修改密码！\n')
  } else {
    // 迁移：如果旧密码是明文，升级为 bcrypt
    const [allAdmins] = await pool.execute('SELECT id, password FROM admins')
    for (const a of allAdmins) {
      if (!a.password.startsWith('$2a$') && !a.password.startsWith('$2b$')) {
        const hash = bcrypt.hashSync(a.password, 12)
        await pool.execute('UPDATE admins SET password = ? WHERE id = ?', [hash, a.id])
      }
    }
  }

  // 系统配置（使用 INSERT IGNORE 保证幂等）
  const sysDefaults = [
    ['site_name',           '微信商户号申诉助手',       '网站名称',                     'general', 1],
    ['site_description',    '智能生成专业申诉材料',      '网站描述',                     'general', 2],
    ['welcome_message',     '',                         '自定义欢迎语（留空使用默认）',    'general', 3],
    ['admin_email',         '',                         '管理员邮箱',                    'general', 4],
    ['enable_chat',         '1',                        '启用聊天功能（1=开启 0=关闭）',   'general', 5],
    ['announcement',        '',                         '前台公告内容（留空不显示）',      'general', 6],
    ['copyright_text',      '© 2026 微信商户号申诉助手', '版权信息',                     'general', 7],
    ['deepseek_api_key',    '',                         'DeepSeek API Key',             'ai',      10],
    ['deepseek_model',      'deepseek-chat',            'DeepSeek 模型名称',             'ai',      11],
    ['ai_temperature',      '0.7',                     'AI 回复温度（0-1）',             'ai',      12],
    ['cost_multiplier',     '2',                       'Token计费倍率（默认2倍）',        'ai',      13],
    ['new_user_balance',    '1.00',                    '新用户注册赠送余额（元，0=不赠送）', 'ai',      14],
    ['recharge_enabled',    '1',                       '启用用户充值功能',               'recharge', 20],
    ['recharge_amounts',    '10,30,50,100,200,500',    '预设充值金额（逗号分隔）',        'recharge', 21],
    ['recharge_min_amount', '10',                      '最低充值金额（元）',              'recharge', 22],
    ['recharge_qr_wechat',  '',                        '微信收款二维码图片URL',           'recharge', 23],
    ['recharge_qr_alipay',  '',                        '支付宝收款二维码图片URL',          'recharge', 24],
    ['recharge_instructions','扫码支付后，请在下方输入您的支付截图备注或交易单号，管理员确认后余额将自动到账。', '充值说明文字', 'recharge', 25],
  ]
  for (const [key, value, label, group, order] of sysDefaults) {
    await pool.execute(
      'INSERT IGNORE INTO system_config (config_key, config_value, config_label, config_group, sort_order) VALUES (?, ?, ?, ?, ?)',
      [key, value, label, group, order]
    )
  }

  // 支付配置：微信支付 + 支付宝 双通道
  const payDefaults = [
    ['wx_enabled',          '0',       '启用微信支付（1=开启 0=关闭）',   'wechat',  1],
    ['wx_mch_id',           '',        '微信商户号 (MchID)',              'wechat',  2],
    ['wx_app_id',           '',        '微信应用ID (AppID)',             'wechat',  3],
    ['wx_api_key',          '',        '微信API密钥 (APIv2 Key)',        'wechat',  4],
    ['wx_api_v3_key',       '',        '微信APIv3密钥',                  'wechat',  5],
    ['wx_serial_no',        '',        '微信证书序列号',                  'wechat',  6],
    ['wx_private_key',      '',        '微信私钥内容（或文件路径）',       'wechat',  7],
    ['wx_notify_url',       '',        '微信支付回调地址',                'wechat',  8],
    ['wx_mode',             'sandbox', '微信支付模式（sandbox/production）','wechat', 9],
    ['ali_enabled',         '0',       '启用支付宝（1=开启 0=关闭）',     'alipay',  20],
    ['ali_app_id',          '',        '支付宝应用ID (AppID)',           'alipay',  21],
    ['ali_private_key',     '',        '支付宝应用私钥',                 'alipay',  22],
    ['ali_public_key',      '',        '支付宝公钥',                    'alipay',  23],
    ['ali_gateway',         'https://openapi.alipay.com/gateway.do', '支付宝网关地址', 'alipay', 24],
    ['ali_notify_url',      '',        '支付宝回调地址',                 'alipay',  25],
    ['ali_return_url',      '',        '支付宝同步跳转地址',              'alipay',  26],
    ['ali_mode',            'sandbox', '支付宝模式（sandbox/production）','alipay',  27],
  ]
  for (const [key, value, label, group, order] of payDefaults) {
    await pool.execute(
      'INSERT IGNORE INTO payment_config (config_key, config_value, config_label, config_group, sort_order) VALUES (?, ?, ?, ?, ?)',
      [key, value, label, group, order]
    )
  }

  console.log('✅ MySQL 数据库初始化完成')
}

// ========== 加密数据迁移 ==========

/**
 * 迁移已有用户数据：将明文 phone/nickname/last_ip 加密
 * 判断逻辑：如果 phone_hash 为空 → 说明是未迁移的旧数据
 */
async function migrateEncryptUserData() {
  const [rows] = await pool.execute('SELECT id, phone, nickname, last_ip FROM users WHERE phone_hash = "" OR phone_hash IS NULL')
  if (rows.length === 0) return
  console.log(`🔐 正在加密迁移 ${rows.length} 条用户数据...`)
  for (const row of rows) {
    const phoneHash = hmacHash(row.phone)
    const phoneEnc = safeEncrypt(row.phone)
    const nicknameEnc = row.nickname ? safeEncrypt(row.nickname) : ''
    const ipEnc = row.last_ip ? safeEncrypt(row.last_ip) : ''
    await pool.execute(
      'UPDATE users SET phone = ?, phone_hash = ?, nickname = ?, last_ip = ? WHERE id = ?',
      [phoneEnc, phoneHash, nicknameEnc, ipEnc, row.id]
    )
  }
  console.log(`🔐 用户数据加密迁移完成`)
}

/**
 * 迁移 user_actions 中的明文 IP 地址
 * 判断逻辑：如果 ip 不为空且不是 base64 格式 → 是明文
 */
async function migrateEncryptActionIPs() {
  const [rows] = await pool.execute("SELECT id, ip FROM user_actions WHERE ip != '' AND ip IS NOT NULL")
  let migrated = 0
  for (const row of rows) {
    // 已经加密的跳过（base64 格式且长度较长）
    try {
      const buf = Buffer.from(row.ip, 'base64')
      if (buf.length >= 33 && row.ip === buf.toString('base64')) continue
    } catch { /* not base64, needs encryption */ }
    const ipEnc = encrypt(row.ip)
    await pool.execute('UPDATE user_actions SET ip = ? WHERE id = ?', [ipEnc, row.id])
    migrated++
  }
  if (migrated > 0) console.log(`🔐 已加密 ${migrated} 条 user_actions IP 记录`)
}

function safeParse(val) {
  if (!val) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}

// ========== 会话 ==========

export async function createSession(id, userId = null) {
  await pool.execute(
    'INSERT INTO sessions (id, user_id, collected_data, step) VALUES (?, ?, ?, ?)',
    [id, userId, JSON.stringify({}), 0]
  )
  const [rows] = await pool.execute('SELECT * FROM sessions WHERE id = ?', [id])
  rows[0].collected_data = safeParse(rows[0].collected_data)
  return rows[0]
}

export async function getSession(id) {
  const [rows] = await pool.execute('SELECT * FROM sessions WHERE id = ?', [id])
  if (rows.length === 0) return null
  rows[0].collected_data = safeParse(rows[0].collected_data)
  return rows[0]
}

export async function updateSession(id, step, collectedData) {
  await pool.execute(
    'UPDATE sessions SET step = ?, collected_data = ? WHERE id = ?',
    [step, JSON.stringify(collectedData), id]
  )
}

export async function updateSessionStatus(id, status) {
  await pool.execute('UPDATE sessions SET status = ? WHERE id = ?', [status, id])
}

export async function saveDeepAnalysisResult(sessionId, result) {
  await pool.execute('UPDATE sessions SET deep_analysis_result = ? WHERE id = ?', [result, sessionId])
}

export async function getDeepAnalysisResult(sessionId) {
  const [rows] = await pool.execute('SELECT deep_analysis_result FROM sessions WHERE id = ?', [sessionId])
  return rows[0]?.deep_analysis_result || null
}

// ========== 消息 ==========

export async function addMessage(sessionId, role, content) {
  await pool.execute(
    'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
    [sessionId, role, content]
  )
}

export async function getMessages(sessionId) {
  const [rows] = await pool.execute(
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
  return {
    ...row,
    phone: safeDecrypt(row.phone),
    nickname: safeDecrypt(row.nickname),
    custom_api_key: safeDecrypt(row.custom_api_key),
    last_ip: safeDecrypt(row.last_ip),
  }
}

export async function registerUser(phone, nickname) {
  const hash = hmacHash(phone)
  const [existing] = await pool.execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  if (existing.length > 0) return { user: decryptUserRow(existing[0]), isNew: false }
  if (!nickname || !isChinese(nickname)) throw new Error('CHINESE_NAME_REQUIRED')
  const phoneEnc = encrypt(phone.trim())
  const nicknameEnc = encrypt(nickname.trim())
  await pool.execute(
    'INSERT INTO users (phone, phone_hash, nickname) VALUES (?, ?, ?)',
    [phoneEnc, hash, nicknameEnc]
  )
  const [rows] = await pool.execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  return { user: decryptUserRow(rows[0]), isNew: true }
}

export async function getUserByPhone(phone) {
  const hash = hmacHash(phone)
  const [rows] = await pool.execute('SELECT * FROM users WHERE phone_hash = ?', [hash])
  return rows.length > 0 ? decryptUserRow(rows[0]) : null
}

export async function getUserById(id) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id])
  return rows.length > 0 ? decryptUserRow(rows[0]) : null
}

export async function updateUserApiMode(userId, apiMode, customApiKey) {
  const encKey = customApiKey ? safeEncrypt(customApiKey) : ''
  await pool.execute(
    'UPDATE users SET api_mode = ?, custom_api_key = ? WHERE id = ?',
    [apiMode, encKey, userId]
  )
}

export async function deductBalance(userId, amount) {
  // 原子操作：UPDATE + WHERE balance >= amount 防止并发扣费导致余额为负
  const [result] = await pool.execute(
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
  const [rows] = await pool.execute(`
    SELECT u.id, u.phone, u.nickname, u.balance, u.api_mode, u.created_at,
      u.last_active_at, u.last_ip, u.login_count, u.total_messages, u.total_spent,
      (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as session_count
    FROM users u ORDER BY u.created_at DESC
  `)
  return rows.map(r => decryptUserRow(r))
}

export async function adjustUserBalance(userId, amount) {
  await pool.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId])
  const user = await getUserById(userId)
  return user
}

export async function deleteUser(userId) {
  // 删除用户的所有相关数据
  await pool.execute('DELETE FROM user_actions WHERE user_id = ?', [userId])
  await pool.execute('DELETE FROM token_usage WHERE user_id = ?', [userId])
  await pool.execute('DELETE FROM recharge_orders WHERE user_id = ?', [userId])
  // 删除用户的会话及消息和申诉文案
  const [sessions] = await pool.execute('SELECT id FROM sessions WHERE user_id = ?', [userId])
  for (const s of sessions) {
    await pool.execute('DELETE FROM messages WHERE session_id = ?', [s.id])
    await pool.execute('DELETE FROM appeal_texts WHERE session_id = ?', [s.id])
  }
  await pool.execute('DELETE FROM sessions WHERE user_id = ?', [userId])
  await pool.execute('DELETE FROM users WHERE id = ?', [userId])
}

// ========== 用户会话历史 ==========

export async function getUserSessions(userId) {
  const [rows] = await pool.execute(`
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

export async function lookupSessions(keyword, userId = null) {
  const like = `%${escapeLike(keyword)}%`
  const params = userId ? [userId, keyword, like, like] : [keyword, like, like]
  const userFilter = userId ? 's.user_id = ? AND (' : '('
  const [rows] = await pool.execute(`
    SELECT s.id, s.created_at, s.status, s.step,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1) as first_message
    FROM sessions s
    WHERE ${userFilter}
       s.id = ?
       OR s.id LIKE ?
       OR EXISTS (
         SELECT 1 FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user' AND m.content LIKE ?
       )
    )
    ORDER BY s.created_at DESC
    LIMIT 20
  `, params)
  return rows.filter(r => r.message_count > 0)
}

// ========== 管理员 ==========

export async function getAllSessions() {
  const [rows] = await pool.execute(`
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

export async function deleteSession(id) {
  await pool.execute('DELETE FROM messages WHERE session_id = ?', [id])
  await pool.execute('DELETE FROM sessions WHERE id = ?', [id])
}

export async function verifyAdmin(username, password) {
  const [rows] = await pool.execute('SELECT * FROM admins WHERE username = ?', [username])
  if (rows.length === 0) return null
  const admin = rows[0]
  const match = bcrypt.compareSync(password, admin.password)
  return match ? admin : null
}

export async function changeAdminPassword(adminId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 12)
  await pool.execute('UPDATE admins SET password = ? WHERE id = ?', [hash, adminId])
}

// ========== 系统配置 ==========

export async function getSystemConfigs() {
  const [rows] = await pool.execute('SELECT * FROM system_config ORDER BY sort_order ASC')
  // 解密敏感字段用于后台显示
  return rows.map(r => ({
    ...r,
    config_value: SENSITIVE_SYS_KEYS.includes(r.config_key) ? safeDecrypt(r.config_value) : r.config_value,
  }))
}

export async function getSystemConfig(key) {
  const [rows] = await pool.execute('SELECT config_value FROM system_config WHERE config_key = ?', [key])
  if (rows.length === 0) return null
  const val = rows[0].config_value
  return SENSITIVE_SYS_KEYS.includes(key) ? safeDecrypt(val) : val
}

export async function updateSystemConfigs(configs) {
  for (const { config_key, config_value } of configs) {
    const rawVal = config_value ?? ''
    const val = SENSITIVE_SYS_KEYS.includes(config_key) ? safeEncrypt(rawVal) : rawVal
    await pool.execute('UPDATE system_config SET config_value = ? WHERE config_key = ?', [val, config_key])
  }
}

// ========== 支付配置 ==========

export async function getPaymentConfigs() {
  const [rows] = await pool.execute('SELECT * FROM payment_config ORDER BY sort_order ASC')
  return rows.map(r => ({
    ...r,
    config_value: SENSITIVE_PAY_KEYS.includes(r.config_key) ? safeDecrypt(r.config_value) : r.config_value,
  }))
}

export async function updatePaymentConfigs(configs) {
  for (const { config_key, config_value } of configs) {
    const rawVal = config_value ?? ''
    const val = SENSITIVE_PAY_KEYS.includes(config_key) ? safeEncrypt(rawVal) : rawVal
    await pool.execute('UPDATE payment_config SET config_value = ? WHERE config_key = ?', [val, config_key])
  }
}

// ========== 用户行为追踪 ==========

export async function trackUserAction(userId, action, detail = '', ip = '', userAgent = '') {
  const ipEnc = ip ? encrypt(ip.slice(0, 60)) : ''
  await pool.execute(
    'INSERT INTO user_actions (user_id, action, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
    [userId, action, detail.slice(0, 500), ipEnc, userAgent.slice(0, 500)]
  )
}

export async function updateUserActivity(userId, ip = '') {
  const ipEnc = ip ? encrypt(ip.slice(0, 60)) : ''
  await pool.execute(
    'UPDATE users SET last_active_at = NOW(), last_ip = ? WHERE id = ?',
    [ipEnc, userId]
  )
}

export async function incrementLoginCount(userId) {
  await pool.execute('UPDATE users SET login_count = login_count + 1 WHERE id = ?', [userId])
}

export async function incrementUserMessages(userId) {
  await pool.execute('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?', [userId])
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
    await pool.execute('UPDATE users SET deep_analysis_count = deep_analysis_count + 1 WHERE id = ?', [userId])
  } else {
    await pool.execute('UPDATE users SET deep_analysis_count = 1, deep_analysis_month = ? WHERE id = ?', [currentMonth, userId])
  }
}

export async function incrementUserSpent(userId, amount) {
  await pool.execute('UPDATE users SET total_spent = total_spent + ? WHERE id = ?', [amount, userId])
}

export async function getRecentActions(limit = 50) {
  const [rows] = await pool.execute(`
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
  const [[{cnt: totalSessions}]] = await pool.execute('SELECT COUNT(*) as cnt FROM sessions')
  const [[{cnt: activeSessions}]] = await pool.execute("SELECT COUNT(*) as cnt FROM sessions WHERE status='active'")
  const [[{cnt: totalMessages}]] = await pool.execute('SELECT COUNT(*) as cnt FROM messages')
  const [[{cnt: todaySessions}]] = await pool.execute("SELECT COUNT(*) as cnt FROM sessions WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: chatSessions}]] = await pool.execute("SELECT COUNT(DISTINCT session_id) as cnt FROM messages WHERE role='user'")
  const [[{cnt: totalUsers}]] = await pool.execute('SELECT COUNT(*) as cnt FROM users')
  const [[{cnt: todayUsers}]] = await pool.execute("SELECT COUNT(*) as cnt FROM users WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: todayMessages}]] = await pool.execute("SELECT COUNT(*) as cnt FROM messages WHERE DATE(created_at)=CURDATE()")
  const [[{cnt: activeUsersToday}]] = await pool.execute("SELECT COUNT(*) as cnt FROM users WHERE DATE(last_active_at)=CURDATE()")
  const [[{s: totalRevenue}]] = await pool.execute('SELECT COALESCE(SUM(total_spent),0) as s FROM users')
  const [[{s: todayRevenue}]] = await pool.execute("SELECT COALESCE(SUM(amount),0) as s FROM recharge_orders WHERE status='confirmed' AND DATE(confirmed_at)=CURDATE()")
  const [[{avg: avgMsgsPerSession}]] = await pool.execute("SELECT ROUND(AVG(c),1) as avg FROM (SELECT COUNT(*) as c FROM messages GROUP BY session_id) t")

  // 最近7天趋势
  const [dailySessions] = await pool.execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM sessions WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)
  const [dailyMessages] = await pool.execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)
  const [dailyUsers] = await pool.execute(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at) ORDER BY day
  `)

  // 24小时消息分布
  const [hourlyMessages] = await pool.execute(`
    SELECT HOUR(created_at) as hr, COUNT(*) as cnt
    FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY HOUR(created_at) ORDER BY hr
  `)

  // API模式分布
  const [apiModes] = await pool.execute('SELECT api_mode, COUNT(*) as cnt FROM users GROUP BY api_mode')

  // Top 活跃用户（需解密 phone/nickname）
  const [topUsersRaw] = await pool.execute(`
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
  const [recentActionsRaw] = await pool.execute(`
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

  return {
    totalSessions, activeSessions, totalMessages, todaySessions, chatSessions,
    totalUsers, todayUsers, todayMessages, activeUsersToday,
    totalRevenue: parseFloat(totalRevenue), todayRevenue: parseFloat(todayRevenue),
    avgMsgsPerSession: avgMsgsPerSession || 0,
    dailySessions, dailyMessages, dailyUsers,
    hourlyMessages, apiModes, topUsers, recentActions,
  }
}

// ========== 充值订单 ==========

export async function createRechargeOrder(userId, amount, paymentMethod, remark = '') {
  const [result] = await pool.execute(
    'INSERT INTO recharge_orders (user_id, amount, payment_method, remark) VALUES (?, ?, ?, ?)',
    [userId, amount, paymentMethod, remark]
  )
  return result.insertId
}

export async function getRechargeOrders(status = null) {
  let sql = `SELECT r.*, u.phone, u.nickname FROM recharge_orders r LEFT JOIN users u ON r.user_id = u.id`
  const params = []
  if (status) { sql += ' WHERE r.status = ?'; params.push(status) }
  sql += ' ORDER BY r.created_at DESC LIMIT 100'
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({
    ...r,
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
  }))
}

export async function getUserRechargeOrders(userId) {
  const [rows] = await pool.execute(
    'SELECT id, amount, status, payment_method, remark, admin_note, created_at, confirmed_at FROM recharge_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId]
  )
  return rows
}

export async function confirmRechargeOrder(orderId, adminId, adminNote = '') {
  // 原子操作：UPDATE + WHERE status='pending' 防止并发双重确认
  const [result] = await pool.execute(
    'UPDATE recharge_orders SET status = ?, confirmed_at = NOW(), confirmed_by = ?, admin_note = ? WHERE id = ? AND status = ?',
    ['confirmed', adminId, adminNote, orderId, 'pending']
  )
  if (result.affectedRows === 0) return null
  // 读取订单信息用于充值
  const [rows] = await pool.execute('SELECT * FROM recharge_orders WHERE id = ?', [orderId])
  if (rows.length === 0) return null
  const order = rows[0]
  // 充值到用户余额
  await adjustUserBalance(order.user_id, parseFloat(order.amount))
  return order
}

export async function rejectRechargeOrder(orderId, adminId, adminNote = '') {
  await pool.execute(
    'UPDATE recharge_orders SET status = ?, confirmed_at = NOW(), confirmed_by = ?, admin_note = ? WHERE id = ?',
    ['rejected', adminId, adminNote, orderId]
  )
}

// ========== 成功案例知识库 ==========

export async function createSuccessCase({ sessionId, title, industry, problemType, collectedData, reportContent, successSummary, adminNotes }) {
  const [result] = await pool.execute(
    `INSERT INTO success_cases (session_id, title, industry, problem_type, collected_data, report_content, success_summary, admin_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId || null, title || '', industry || '', problemType || '', JSON.stringify(collectedData || {}), reportContent || '', successSummary || '', adminNotes || '']
  )
  return result.insertId
}

export async function getSuccessCases(status = 'active') {
  const [rows] = await pool.execute(
    'SELECT * FROM success_cases WHERE status = ? ORDER BY created_at DESC',
    [status]
  )
  return rows.map(r => ({ ...r, collected_data: safeParse(r.collected_data) }))
}

export async function getSuccessCaseById(id) {
  const [rows] = await pool.execute('SELECT * FROM success_cases WHERE id = ?', [id])
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
  await pool.execute(`UPDATE success_cases SET ${fields.join(', ')} WHERE id = ?`, params)
}

export async function deleteSuccessCase(id) {
  await pool.execute('DELETE FROM success_cases WHERE id = ?', [id])
}

export async function findSimilarCases(industry, problemType, limit = 3) {
  let sql = 'SELECT id, title, industry, problem_type, success_summary FROM success_cases WHERE status = ?'
  const params = ['active']
  if (industry) { sql += ' AND industry LIKE ?'; params.push(`%${escapeLike(industry)}%`) }
  if (problemType) { sql += ' AND problem_type LIKE ?'; params.push(`%${escapeLike(problemType)}%`) }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)
  const [rows] = await pool.execute(sql, params)
  if (rows.length > 0) return rows
  // 如果没有精确匹配，返回最新的活跃案例
  const [fallback] = await pool.execute(
    'SELECT id, title, industry, problem_type, success_summary FROM success_cases WHERE status = ? ORDER BY created_at DESC LIMIT ?',
    ['active', limit]
  )
  return fallback
}

export async function getPendingRechargeCount() {
  const [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM recharge_orders WHERE status = ?', ['pending'])
  return rows[0].cnt
}

// ========== Token消费明细 ==========

export async function recordTokenUsage({ userId, sessionId, type, inputTokens, outputTokens, totalTokens, cost, multiplier, apiMode }) {
  await pool.execute(
    `INSERT INTO token_usage (user_id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, sessionId || null, type || 'chat', inputTokens || 0, outputTokens || 0, totalTokens || 0, cost || 0, multiplier || 2, apiMode || 'official']
  )
}

export async function getUserTokenUsage(userId, limit = 50) {
  const [rows] = await pool.execute(
    `SELECT id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode, created_at
     FROM token_usage WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  )
  return rows
}

export async function getUserTokenStats(userId) {
  const [[totals]] = await pool.execute(
    `SELECT COUNT(*) as total_requests, COALESCE(SUM(input_tokens),0) as total_input,
     COALESCE(SUM(output_tokens),0) as total_output, COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_cost
     FROM token_usage WHERE user_id = ?`,
    [userId]
  )
  const [[today]] = await pool.execute(
    `SELECT COUNT(*) as requests, COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  )
  return { totals, today }
}

export async function getAllTokenUsage(limit = 100) {
  const [rows] = await pool.execute(
    `SELECT t.*, u.phone, u.nickname FROM token_usage t
     LEFT JOIN users u ON t.user_id = u.id
     ORDER BY t.created_at DESC LIMIT ?`,
    [limit]
  )
  return rows.map(r => ({
    ...r,
    phone: safeDecrypt(r.phone),
    nickname: safeDecrypt(r.nickname),
  }))
}

export async function getTokenUsageStats() {
  const [[totals]] = await pool.execute(
    `SELECT COUNT(*) as total_requests, COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_cost FROM token_usage`
  )
  const [[today]] = await pool.execute(
    `SELECT COUNT(*) as requests, COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage WHERE DATE(created_at) = CURDATE()`
  )
  const [byType] = await pool.execute(
    `SELECT type, COUNT(*) as cnt, COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage GROUP BY type`
  )
  return { totals, today, byType }
}

// ========== 申诉文案 ==========

export async function saveAppealText({ sessionId, userId, businessModel, refundRules, complaintCause, complaintResolution, supplementary, inputTokens, outputTokens, cost }) {
  const [result] = await pool.execute(
    `INSERT INTO appeal_texts (session_id, user_id, business_model, refund_rules, complaint_cause, complaint_resolution, supplementary, input_tokens, output_tokens, cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, businessModel || '', refundRules || '', complaintCause || '', complaintResolution || '', supplementary || '', inputTokens || 0, outputTokens || 0, cost || 0]
  )
  return result.insertId
}

export async function getAppealText(sessionId) {
  const [rows] = await pool.execute(
    'SELECT * FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
    [sessionId]
  )
  return rows.length > 0 ? rows[0] : null
}
