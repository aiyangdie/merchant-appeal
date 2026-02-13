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

  // ========== AI 自进化系统表 ==========

  // AI 规则库：存储 AI 自动生成/优化的规则
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category ENUM('collection_strategy','question_template','industry_knowledge','violation_strategy','conversation_pattern','diagnosis_rule') NOT NULL,
      rule_key VARCHAR(128) NOT NULL,
      rule_name VARCHAR(256) NOT NULL DEFAULT '',
      rule_content JSON NOT NULL,
      source ENUM('ai_generated','admin_manual','system_default') DEFAULT 'ai_generated',
      status ENUM('active','pending_review','archived','rejected') DEFAULT 'pending_review',
      effectiveness_score DECIMAL(5,2) DEFAULT 0.00,
      usage_count INT DEFAULT 0,
      version INT DEFAULT 1,
      parent_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_category_key_version (category, rule_key, version),
      INDEX idx_category_status (category, status),
      INDEX idx_effectiveness (effectiveness_score DESC),
      INDEX idx_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 对话分析结果：每次对话结束后 AI 异步分析
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS conversation_analyses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      user_id INT DEFAULT NULL,
      industry VARCHAR(64) DEFAULT '',
      problem_type VARCHAR(128) DEFAULT '',
      total_turns INT DEFAULT 0,
      collection_turns INT DEFAULT 0,
      fields_collected INT DEFAULT 0,
      fields_skipped INT DEFAULT 0,
      fields_refused INT DEFAULT 0,
      completion_rate DECIMAL(5,2) DEFAULT 0.00,
      professionalism_score DECIMAL(5,2) DEFAULT 0.00,
      appeal_success_rate DECIMAL(5,2) DEFAULT 0.00,
      user_satisfaction DECIMAL(5,2) DEFAULT 0.00,
      response_quality JSON,
      user_sentiment VARCHAR(32) DEFAULT 'neutral',
      drop_off_point VARCHAR(128) DEFAULT '',
      collection_efficiency JSON,
      sentiment_trajectory JSON,
      suggestions JSON,
      raw_analysis MEDIUMTEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_analyzed (analyzed_at),
      INDEX idx_industry (industry),
      INDEX idx_sentiment (user_sentiment)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 自动添加新列（兼容旧数据库）
  for (const col of [
    "professionalism_score DECIMAL(5,2) DEFAULT 0.00 AFTER completion_rate",
    "appeal_success_rate DECIMAL(5,2) DEFAULT 0.00 AFTER professionalism_score",
    "user_satisfaction DECIMAL(5,2) DEFAULT 0.00 AFTER appeal_success_rate",
    "response_quality JSON AFTER user_satisfaction",
    "active_rule_ids JSON AFTER raw_analysis",
  ]) {
    await pool.execute(`ALTER TABLE conversation_analyses ADD COLUMN ${col}`).catch(() => {})
  }

  // learning_metrics 新增聚合列
  for (const col of [
    "avg_professionalism DECIMAL(5,2) DEFAULT 0.00 AFTER avg_user_satisfaction",
    "avg_appeal_success DECIMAL(5,2) DEFAULT 0.00 AFTER avg_professionalism",
    "product_recommendation_count INT DEFAULT 0 AFTER avg_appeal_success",
  ]) {
    await pool.execute(`ALTER TABLE learning_metrics ADD COLUMN ${col}`).catch(() => {})
  }

  // 规则变更日志：审计追踪
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS rule_change_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_id INT NOT NULL,
      action ENUM('created','updated','activated','archived','rejected','auto_promoted') NOT NULL,
      old_content JSON,
      new_content JSON,
      reason TEXT,
      changed_by VARCHAR(32) DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rule (rule_id),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 学习指标：每日聚合的效果数据
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS learning_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      metric_date DATE NOT NULL,
      total_conversations INT DEFAULT 0,
      avg_collection_turns DECIMAL(5,2) DEFAULT 0.00,
      avg_completion_rate DECIMAL(5,2) DEFAULT 0.00,
      avg_user_satisfaction DECIMAL(5,2) DEFAULT 0.00,
      completion_count INT DEFAULT 0,
      drop_off_count INT DEFAULT 0,
      top_drop_off_fields JSON,
      top_improvements JSON,
      rules_generated INT DEFAULT 0,
      rules_promoted INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_date (metric_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ========== AI 智能标签 & 聚合 & 熔断 ==========

  // 对话标签：AI自动打标分类
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS conversation_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      analysis_id INT DEFAULT NULL,
      difficulty ENUM('easy','medium','hard','extreme') DEFAULT 'medium',
      user_type ENUM('first_time','returning','experienced','vip') DEFAULT 'first_time',
      quality_score DECIMAL(5,2) DEFAULT 0.00,
      outcome ENUM('completed','abandoned','partial','redirected') DEFAULT 'partial',
      tags JSON,
      industry_cluster VARCHAR(64) DEFAULT '',
      violation_cluster VARCHAR(64) DEFAULT '',
      pattern_flags JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_session (session_id),
      INDEX idx_analysis (analysis_id),
      INDEX idx_difficulty (difficulty),
      INDEX idx_outcome (outcome),
      INDEX idx_industry_cluster (industry_cluster),
      INDEX idx_quality (quality_score DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 知识聚合簇：跨对话模式聚合
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_clusters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cluster_type ENUM('industry_pattern','violation_pattern','question_effectiveness','user_behavior','success_factor') NOT NULL,
      cluster_key VARCHAR(128) NOT NULL,
      cluster_name VARCHAR(256) DEFAULT '',
      insight_data JSON NOT NULL,
      sample_count INT DEFAULT 0,
      confidence DECIMAL(5,2) DEFAULT 0.00,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_type_key (cluster_type, cluster_key),
      INDEX idx_type_confidence (cluster_type, confidence DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 引擎健康状态：熔断器 + 监控
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS engine_health (
      id INT AUTO_INCREMENT PRIMARY KEY,
      component VARCHAR(64) NOT NULL,
      status ENUM('healthy','degraded','circuit_open','recovering') DEFAULT 'healthy',
      error_count INT DEFAULT 0,
      success_count INT DEFAULT 0,
      last_error TEXT,
      last_success_at DATETIME DEFAULT NULL,
      last_error_at DATETIME DEFAULT NULL,
      circuit_opened_at DATETIME DEFAULT NULL,
      metadata JSON,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_component (component)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 探索实验：AI自主探索的A/B测试记录
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS exploration_experiments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      experiment_name VARCHAR(128) NOT NULL,
      rule_id INT DEFAULT NULL,
      hypothesis TEXT,
      status ENUM('running','completed','aborted','failed') DEFAULT 'running',
      variant_a JSON,
      variant_b JSON,
      sample_a INT DEFAULT 0,
      sample_b INT DEFAULT 0,
      result_a JSON,
      result_b JSON,
      winner ENUM('a','b','inconclusive') DEFAULT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME DEFAULT NULL,
      INDEX idx_status (status),
      INDEX idx_rule (rule_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ========== 字段变更记录 ==========
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS field_change_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      field_key VARCHAR(64) NOT NULL,
      field_label VARCHAR(64) DEFAULT '',
      old_value TEXT,
      new_value TEXT,
      change_source ENUM('ai_extract','user_edit','ai_correction','system') DEFAULT 'ai_extract',
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_field (field_key),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // ========== AI 智能商城 ==========

  // 商品表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mall_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      category VARCHAR(64) DEFAULT '',
      price DECIMAL(10,2) DEFAULT 0.00,
      original_price DECIMAL(10,2) DEFAULT 0.00,
      description TEXT,
      ai_description TEXT,
      image_url VARCHAR(512) DEFAULT '',
      tags JSON,
      target_audience JSON,
      status ENUM('active','draft','archived','sold_out') DEFAULT 'draft',
      sort_order INT DEFAULT 0,
      view_count INT DEFAULT 0,
      click_count INT DEFAULT 0,
      purchase_count INT DEFAULT 0,
      recommendation_score DECIMAL(5,2) DEFAULT 50.00,
      ai_optimized_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_category (category),
      INDEX idx_recommendation (recommendation_score DESC),
      INDEX idx_sort (sort_order, id DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 用户兴趣画像
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_interests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      session_id VARCHAR(64) DEFAULT '',
      industry VARCHAR(64) DEFAULT '',
      problem_type VARCHAR(128) DEFAULT '',
      keywords JSON,
      need_tags JSON,
      interest_score JSON,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user (user_id),
      INDEX idx_session (session_id),
      INDEX idx_industry (industry)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 商品推荐记录
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS product_recommendations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      session_id VARCHAR(64) DEFAULT '',
      product_id INT NOT NULL,
      reason VARCHAR(256) DEFAULT '',
      match_score DECIMAL(5,2) DEFAULT 0.00,
      status ENUM('pending','shown','clicked','purchased','dismissed') DEFAULT 'pending',
      shown_at DATETIME DEFAULT NULL,
      clicked_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_session (session_id),
      INDEX idx_product (product_id),
      INDEX idx_status (status)
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
    `SELECT COUNT(*) as total_requests,
     COALESCE(SUM(input_tokens),0) as total_input,
     COALESCE(SUM(output_tokens),0) as total_output,
     COALESCE(SUM(total_tokens),0) as total_tokens,
     COALESCE(SUM(cost),0) as total_cost
     FROM token_usage`
  )
  const [[today]] = await pool.execute(
    `SELECT COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost,
     COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage WHERE DATE(created_at) = CURDATE()`
  )
  const [byType] = await pool.execute(
    `SELECT type, COUNT(*) as cnt,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost, COALESCE(SUM(total_tokens),0) as tokens
     FROM token_usage GROUP BY type`
  )
  const [byUser] = await pool.execute(
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
  const [daily] = await pool.execute(
    `SELECT DATE(created_at) as day, COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(total_tokens),0) as tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY day DESC`
  )
  // 系统级消耗（user_id=0 或 evolution类型）
  const [[systemUsage]] = await pool.execute(
    `SELECT COUNT(*) as requests,
     COALESCE(SUM(input_tokens),0) as input_tokens,
     COALESCE(SUM(output_tokens),0) as output_tokens,
     COALESCE(SUM(cost),0) as cost
     FROM token_usage WHERE user_id = 0 OR type LIKE 'evolution%' OR type LIKE 'auto_%'`
  )
  return {
    totals, today, byType,
    byUser: byUser.map(r => ({ ...r, phone: safeDecrypt(r.phone), nickname: safeDecrypt(r.nickname) })),
    daily, systemUsage
  }
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

// ========== AI 自进化：规则库 ==========

export async function createAIRule({ category, ruleKey, ruleName, ruleContent, source = 'ai_generated', status = 'pending_review', parentId = null }) {
  // 计算版本号
  const [[{ maxVer }]] = await pool.execute(
    'SELECT COALESCE(MAX(version), 0) as maxVer FROM ai_rules WHERE category = ? AND rule_key = ?',
    [category, ruleKey]
  )
  const version = maxVer + 1
  const [result] = await pool.execute(
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
  sql += ' ORDER BY effectiveness_score DESC, usage_count DESC'
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({ ...r, rule_content: safeParse(r.rule_content) }))
}

export async function getAllAIRules(category = null, status = null) {
  let sql = 'SELECT * FROM ai_rules WHERE 1=1'
  const params = []
  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY updated_at DESC LIMIT 200'
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({ ...r, rule_content: safeParse(r.rule_content) }))
}

export async function getAIRuleById(id) {
  const [rows] = await pool.execute('SELECT * FROM ai_rules WHERE id = ?', [id])
  if (rows.length === 0) return null
  rows[0].rule_content = safeParse(rows[0].rule_content)
  return rows[0]
}

export async function updateAIRuleStatus(id, status, reason = '', changedBy = 'admin') {
  const rule = await getAIRuleById(id)
  if (!rule) return null
  const oldStatus = rule.status
  await pool.execute('UPDATE ai_rules SET status = ? WHERE id = ?', [status, id])
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
  await pool.execute(`UPDATE ai_rules SET ${sets.join(', ')} WHERE id = ?`, params)
  await logRuleChange(id, 'updated', rule.rule_content, ruleContent, `${changedBy} 编辑内容`, changedBy)
  return { ...rule, rule_content: ruleContent }
}

export async function incrementRuleUsage(id) {
  await pool.execute('UPDATE ai_rules SET usage_count = usage_count + 1 WHERE id = ?', [id])
}

export async function updateRuleEffectiveness(id, score) {
  await pool.execute('UPDATE ai_rules SET effectiveness_score = ? WHERE id = ?', [score, id])
}

export async function deleteAIRule(id) {
  await pool.execute('DELETE FROM rule_change_log WHERE rule_id = ?', [id])
  await pool.execute('DELETE FROM ai_rules WHERE id = ?', [id])
}

export async function getAIRuleStats() {
  const [byCategory] = await pool.execute(
    `SELECT category, status, COUNT(*) as cnt FROM ai_rules GROUP BY category, status`
  )
  const [[totals]] = await pool.execute(
    `SELECT COUNT(*) as total, SUM(status='active') as active, SUM(status='pending_review') as pending,
     AVG(CASE WHEN status='active' THEN effectiveness_score END) as avg_score
     FROM ai_rules`
  )
  const [topRules] = await pool.execute(
    `SELECT id, category, rule_key, rule_name, effectiveness_score, usage_count
     FROM ai_rules WHERE status = 'active' ORDER BY effectiveness_score DESC LIMIT 10`
  )
  return { byCategory, totals, topRules }
}

// ========== AI 自进化：对话分析 ==========

export async function saveConversationAnalysis(data) {
  const [result] = await pool.execute(
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
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({
    ...r,
    collection_efficiency: safeParse(r.collection_efficiency),
    sentiment_trajectory: safeParse(r.sentiment_trajectory),
    suggestions: safeParse(r.suggestions),
    active_rule_ids: safeParse(r.active_rule_ids),
  }))
}

export async function getConversationAnalysisById(id) {
  const [rows] = await pool.execute('SELECT * FROM conversation_analyses WHERE id = ?', [id])
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...r,
    collection_efficiency: safeParse(r.collection_efficiency),
    sentiment_trajectory: safeParse(r.sentiment_trajectory),
    suggestions: safeParse(r.suggestions),
  }
}

export async function getAnalysisStats() {
  const [[totals]] = await pool.execute(
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
  const [bySentiment] = await pool.execute(
    `SELECT user_sentiment, COUNT(*) as cnt FROM conversation_analyses GROUP BY user_sentiment`
  )
  const [byIndustry] = await pool.execute(
    `SELECT industry, COUNT(*) as cnt, AVG(completion_rate) as avg_completion, AVG(total_turns) as avg_turns,
     AVG(professionalism_score) as avg_prof, AVG(appeal_success_rate) as avg_appeal, AVG(user_satisfaction) as avg_sat
     FROM conversation_analyses WHERE industry != '' GROUP BY industry ORDER BY cnt DESC LIMIT 20`
  )
  const [recent7d] = await pool.execute(
    `SELECT DATE(analyzed_at) as day, COUNT(*) as cnt, AVG(completion_rate) as avg_completion,
     AVG(professionalism_score) as avg_prof, AVG(appeal_success_rate) as avg_appeal, AVG(user_satisfaction) as avg_sat
     FROM conversation_analyses WHERE analyzed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(analyzed_at) ORDER BY day`
  )
  const [topDropOffs] = await pool.execute(
    `SELECT drop_off_point, COUNT(*) as cnt FROM conversation_analyses
     WHERE drop_off_point != '' GROUP BY drop_off_point ORDER BY cnt DESC LIMIT 10`
  )
  return { totals, bySentiment, byIndustry, recent7d, topDropOffs }
}

export async function getQualityTopAndLow() {
  const cols = `session_id, industry, problem_type, completion_rate, professionalism_score,
     appeal_success_rate, user_satisfaction, user_sentiment, fields_collected, total_turns, analyzed_at,
     suggestions, drop_off_point, raw_analysis`
  const [topAnalyses] = await pool.execute(
    `SELECT ${cols} FROM conversation_analyses ORDER BY professionalism_score DESC, completion_rate DESC LIMIT 5`
  )
  const [lowAnalyses] = await pool.execute(
    `SELECT ${cols} FROM conversation_analyses WHERE professionalism_score > 0 ORDER BY professionalism_score ASC LIMIT 5`
  )
  const pf = a => ({
    ...a,
    completion_rate: parseFloat(a.completion_rate),
    professionalism_score: parseFloat(a.professionalism_score),
    appeal_success_rate: parseFloat(a.appeal_success_rate),
    user_satisfaction: parseFloat(a.user_satisfaction),
    suggestions: safeParse(a.suggestions) || [],
    drop_off_point: a.drop_off_point || '',
    ai_highlights: extractAIHighlights(a),
  })
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
  await pool.execute(
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
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({
    ...r,
    old_content: safeParse(r.old_content),
    new_content: safeParse(r.new_content),
  }))
}

// ========== AI 自进化：学习指标 ==========

export async function upsertLearningMetrics(date, data) {
  await pool.execute(
    `INSERT INTO learning_metrics
     (metric_date, total_conversations, avg_collection_turns, avg_completion_rate, avg_user_satisfaction,
      completion_count, drop_off_count, top_drop_off_fields, top_improvements, rules_generated, rules_promoted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      total_conversations = VALUES(total_conversations),
      avg_collection_turns = VALUES(avg_collection_turns),
      avg_completion_rate = VALUES(avg_completion_rate),
      avg_user_satisfaction = VALUES(avg_user_satisfaction),
      completion_count = VALUES(completion_count),
      drop_off_count = VALUES(drop_off_count),
      top_drop_off_fields = VALUES(top_drop_off_fields),
      top_improvements = VALUES(top_improvements),
      rules_generated = VALUES(rules_generated),
      rules_promoted = VALUES(rules_promoted)`,
    [
      date, data.totalConversations || 0, data.avgCollectionTurns || 0,
      data.avgCompletionRate || 0, data.avgUserSatisfaction || 0,
      data.completionCount || 0, data.dropOffCount || 0,
      JSON.stringify(data.topDropOffFields || []),
      JSON.stringify(data.topImprovements || []),
      data.rulesGenerated || 0, data.rulesPromoted || 0,
    ]
  )
}

export async function getLearningMetrics(days = 30) {
  const [rows] = await pool.execute(
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
  await pool.execute(
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
  const [rows] = await pool.execute('SELECT * FROM conversation_tags WHERE session_id = ?', [sessionId])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, tags: safeParse(r.tags), pattern_flags: safeParse(r.pattern_flags) }
}

export async function getTagStats() {
  const [byDifficulty] = await pool.execute(
    `SELECT difficulty, COUNT(*) as cnt, AVG(quality_score) as avg_quality FROM conversation_tags GROUP BY difficulty`
  )
  const [byOutcome] = await pool.execute(
    `SELECT outcome, COUNT(*) as cnt FROM conversation_tags GROUP BY outcome`
  )
  const [byUserType] = await pool.execute(
    `SELECT user_type, COUNT(*) as cnt, AVG(quality_score) as avg_quality FROM conversation_tags GROUP BY user_type`
  )
  const [topClusters] = await pool.execute(
    `SELECT industry_cluster, COUNT(*) as cnt, AVG(quality_score) as avg_quality
     FROM conversation_tags WHERE industry_cluster != '' GROUP BY industry_cluster ORDER BY cnt DESC LIMIT 20`
  )
  const [total] = await pool.execute(`SELECT COUNT(*) as cnt FROM conversation_tags`)
  return { total: total[0].cnt, byDifficulty, byOutcome, byUserType, topClusters }
}

// ========== 知识聚合簇 ==========

export async function upsertKnowledgeCluster(type, key, data) {
  await pool.execute(
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
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({ ...r, insight_data: safeParse(r.insight_data) }))
}

export async function getClusterStats() {
  const [byType] = await pool.execute(
    `SELECT cluster_type, COUNT(*) as cnt, AVG(confidence) as avg_confidence, SUM(sample_count) as total_samples
     FROM knowledge_clusters GROUP BY cluster_type`
  )
  return { byType }
}

// ========== 引擎健康 & 熔断器 ==========

export async function upsertEngineHealth(component, data) {
  await pool.execute(
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
    const [rows] = await pool.execute('SELECT * FROM engine_health WHERE component = ?', [component])
    return rows.length > 0 ? { ...rows[0], metadata: safeParse(rows[0].metadata) } : null
  }
  const [rows] = await pool.execute('SELECT * FROM engine_health ORDER BY component')
  return rows.map(r => ({ ...r, metadata: safeParse(r.metadata) }))
}

export async function incrementEngineError(component, errorMsg) {
  await pool.execute(
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
  await pool.execute(
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
  const [result] = await pool.execute(
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
  await pool.execute(`UPDATE exploration_experiments SET ${sets.join(', ')} WHERE id = ?`, params)
}

export async function getExperiments(status = null) {
  let sql = 'SELECT * FROM exploration_experiments'
  const params = []
  if (status) { sql += ' WHERE status = ?'; params.push(status) }
  sql += ' ORDER BY started_at DESC LIMIT 50'
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({
    ...r, variant_a: safeParse(r.variant_a), variant_b: safeParse(r.variant_b),
    result_a: safeParse(r.result_a), result_b: safeParse(r.result_b),
  }))
}

// ========== AI 智能商城 ==========

export async function createProduct(data) {
  const [result] = await pool.execute(
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
  await pool.execute(`UPDATE mall_products SET ${sets.join(', ')} WHERE id = ?`, params)
  return getProductById(id)
}

export async function deleteProduct(id) {
  await pool.execute('DELETE FROM mall_products WHERE id = ?', [id])
}

export async function getProductById(id) {
  const [rows] = await pool.execute('SELECT * FROM mall_products WHERE id = ?', [id])
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
  const [rows] = await pool.execute(sql, params)
  return rows.map(r => ({ ...r, tags: safeParse(r.tags), target_audience: safeParse(r.target_audience) }))
}

export async function getActiveProductsForAI() {
  const [rows] = await pool.execute(
    `SELECT id, name, category, price, original_price, description, ai_description, tags, target_audience, recommendation_score
     FROM mall_products WHERE status = 'active' ORDER BY recommendation_score DESC, sort_order ASC LIMIT 50`
  )
  return rows.map(r => ({ ...r, tags: safeParse(r.tags), target_audience: safeParse(r.target_audience) }))
}

export async function getProductStats() {
  const [totals] = await pool.execute(
    `SELECT COUNT(*) as total, SUM(status='active') as active, SUM(status='draft') as draft,
     SUM(status='sold_out') as sold_out, SUM(view_count) as total_views, SUM(click_count) as total_clicks,
     SUM(purchase_count) as total_purchases FROM mall_products`
  )
  const [byCategory] = await pool.execute(
    `SELECT category, COUNT(*) as cnt, AVG(recommendation_score) as avg_score
     FROM mall_products WHERE category != '' GROUP BY category ORDER BY cnt DESC`
  )
  return { totals: totals[0], byCategory }
}

export async function incrementProductMetric(id, field) {
  const allowed = ['view_count', 'click_count', 'purchase_count']
  if (!allowed.includes(field)) return
  await pool.execute(`UPDATE mall_products SET ${field} = ${field} + 1 WHERE id = ?`, [id])
}

// --- 用户兴趣画像 ---

export async function upsertUserInterest(userId, data) {
  await pool.execute(
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
  const [rows] = await pool.execute('SELECT * FROM user_interests WHERE user_id = ?', [userId])
  if (rows.length === 0) return null
  const r = rows[0]
  return { ...r, keywords: safeParse(r.keywords), need_tags: safeParse(r.need_tags), interest_score: safeParse(r.interest_score) }
}

// --- 商品推荐记录 ---

export async function createRecommendation(data) {
  const [result] = await pool.execute(
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
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function updateRecommendationStatus(id, status) {
  const timeField = status === 'shown' ? ', shown_at=NOW()' : status === 'clicked' ? ', clicked_at=NOW()' : ''
  await pool.execute(`UPDATE product_recommendations SET status=?${timeField} WHERE id = ?`, [status, id])
}

export async function getRecommendationStats() {
  const [totals] = await pool.execute(
    `SELECT COUNT(*) as total, SUM(status='shown') as shown, SUM(status='clicked') as clicked,
     SUM(status='purchased') as purchased, SUM(status='dismissed') as dismissed FROM product_recommendations`
  )
  const [topProducts] = await pool.execute(
    `SELECT p.id, p.name, COUNT(*) as rec_count, SUM(r.status='clicked') as clicks, SUM(r.status='purchased') as purchases
     FROM product_recommendations r JOIN mall_products p ON r.product_id = p.id
     GROUP BY p.id ORDER BY rec_count DESC LIMIT 10`
  )
  return { totals: totals[0], topProducts }
}

export async function getUnanalyzedSessions(limit = 20) {
  const [rows] = await pool.execute(
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
  await pool.execute(
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
  const [rows] = await pool.execute(sql, params)
  return rows
}
