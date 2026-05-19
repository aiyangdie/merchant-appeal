import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { encrypt, safeEncrypt, hmacHash } from '../utils/crypto.js'

async function migrateEncryptUserData(pool) {
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
  console.log('🔐 用户数据加密迁移完成')
}

async function migrateEncryptActionIPs(pool) {
  const [rows] = await pool.execute("SELECT id, ip FROM user_actions WHERE ip != '' AND ip IS NOT NULL")
  let migrated = 0
  for (const row of rows) {
    try {
      const buf = Buffer.from(row.ip, 'base64')
      if (buf.length >= 33 && row.ip === buf.toString('base64')) continue
    } catch { /* needs encryption */ }
    const ipEnc = encrypt(row.ip)
    await pool.execute('UPDATE user_actions SET ip = ? WHERE id = ?', [ipEnc, row.id])
    migrated++
  }
  if (migrated > 0) console.log(`🔐 已加密 ${migrated} 条 user_actions IP 记录`)
}

export async function runSchemaMigrations(pool) {
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
  try {
    await pool.execute('ALTER TABLE sessions ADD COLUMN appeal_guide_snapshot JSON DEFAULT NULL')
  } catch { /* 列已存在，忽略 */ }
  // 迁移：messages.content TEXT → MEDIUMTEXT（AI报告可能超过64KB）
  try {
    await pool.execute('ALTER TABLE messages MODIFY content MEDIUMTEXT NOT NULL')
  } catch { /* 忽略 */ }
  // 迁移：sessions表添加订单绑定字段
  try {
    await pool.execute('ALTER TABLE sessions ADD COLUMN order_no VARCHAR(100) DEFAULT NULL AFTER user_id')
    await pool.execute('ALTER TABLE sessions ADD COLUMN order_data JSON DEFAULT NULL AFTER order_no')
  } catch { /* 列已存在，忽略 */ }
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
  await migrateEncryptUserData(pool)

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
  // 迁移：给 recharge_orders 加 out_trade_no 列（真实支付订单号）
  try { await pool.execute('ALTER TABLE recharge_orders ADD COLUMN out_trade_no VARCHAR(64) DEFAULT "" AFTER remark') } catch { /* 已存在 */ }
  try { await pool.execute('ALTER TABLE recharge_orders ADD INDEX idx_out_trade_no (out_trade_no)') } catch { /* 已存在 */ }

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
  await migrateEncryptActionIPs(pool)

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

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS token_usage_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      model_id INT DEFAULT 0,
      provider VARCHAR(32) DEFAULT '',
      model_name VARCHAR(128) DEFAULT '',
      prompt_tokens INT DEFAULT 0,
      completion_tokens INT DEFAULT 0,
      total_tokens INT DEFAULT 0,
      request_type VARCHAR(64) DEFAULT 'chat',
      cost_yuan DECIMAL(12,6) DEFAULT 0,
      user_id INT DEFAULT 0,
      session_id VARCHAR(64) DEFAULT NULL,
      detail_summary VARCHAR(512) DEFAULT NULL,
      context_json JSON DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_type (request_type),
      INDEX idx_created (created_at),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  for (const col of [
    'ALTER TABLE token_usage ADD COLUMN detail_summary VARCHAR(512) DEFAULT NULL',
    'ALTER TABLE token_usage ADD COLUMN context_json JSON DEFAULT NULL',
    'ALTER TABLE token_usage_logs ADD COLUMN detail_summary VARCHAR(512) DEFAULT NULL',
    'ALTER TABLE token_usage_logs ADD COLUMN context_json JSON DEFAULT NULL',
    'ALTER TABLE token_usage_logs ADD COLUMN user_id INT DEFAULT 0',
    'ALTER TABLE token_usage_logs ADD COLUMN session_id VARCHAR(64) DEFAULT NULL',
  ]) {
    try { await pool.execute(col) } catch { /* exists */ }
  }

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

  // 迁移：appeal_texts 加申诉进度跟踪字段
  const appealTrackCols = {
    appeal_status: "ENUM('generated','submitted','under_review','approved','rejected','resubmitted') DEFAULT 'generated'",
    user_feedback: 'TEXT DEFAULT NULL',
    submitted_at: 'DATETIME DEFAULT NULL',
    result_at: 'DATETIME DEFAULT NULL',
    rejection_reason: 'VARCHAR(500) DEFAULT NULL',
    resubmit_count: 'INT DEFAULT 0',
  }
  for (const [col, def] of Object.entries(appealTrackCols)) {
    try { await pool.execute(`SELECT ${col} FROM appeal_texts LIMIT 0`) }
    catch { try { await pool.execute(`ALTER TABLE appeal_texts ADD COLUMN ${col} ${def}`) } catch {} }
  }

  // 投诉材料整理表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS complaint_docs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      doc_title VARCHAR(256) DEFAULT '',
      complaint_summary TEXT,
      merchant_info TEXT,
      violation_detail TEXT,
      evidence_list TEXT,
      timeline TEXT,
      appeal_points TEXT,
      full_document MEDIUMTEXT,
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
      category ENUM('collection_strategy','question_template','industry_knowledge','violation_strategy','conversation_pattern','diagnosis_rule','empathy','efficiency','other') NOT NULL,
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
  // 迁移：扩展 category ENUM（支持 empathy/efficiency/other）
  try {
    await pool.execute(
      "ALTER TABLE ai_rules MODIFY COLUMN category ENUM('collection_strategy','question_template','industry_knowledge','violation_strategy','conversation_pattern','diagnosis_rule','empathy','efficiency','other') NOT NULL"
    )
  } catch { /* ENUM 已是最新，忽略 */ }

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

  // ========== 日程安排 ==========
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(256) NOT NULL,
      description TEXT,
      scheduled_time DATETIME NOT NULL,
      type ENUM('reminder','task','meeting','deadline') DEFAULT 'reminder',
      status ENUM('pending','completed','cancelled') DEFAULT 'pending',
      completed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_scheduled_time (scheduled_time)
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

  // AI行为日志表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(128) NOT NULL,
      category VARCHAR(64) DEFAULT 'general',
      detail TEXT,
      tokens_used INT DEFAULT 0,
      cost DECIMAL(10,6) DEFAULT 0,
      duration_ms INT DEFAULT 0,
      status ENUM('success','failed','pending') DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at DESC),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 订单表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(256) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      status ENUM('paid','serving','completed','refunded') DEFAULT 'paid',
      persona JSON,
      collected_data JSON,
      service_messages JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_status (status),
      INDEX idx_order_no (order_no),
      INDEX idx_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // 迁移：orders 表重命名 price → amount，扩展 status ENUM，添加新列
  const orderMigrations = [
    "ALTER TABLE orders CHANGE COLUMN price amount DECIMAL(10,2) NOT NULL",
    "ALTER TABLE orders MODIFY COLUMN status ENUM('pending','created','paid','serving','completed','cancelled','refunded') DEFAULT 'pending'",
    "ALTER TABLE orders ADD COLUMN session_id VARCHAR(64) DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(32) DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN payment_time DATETIME DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN completed_time DATETIME DEFAULT NULL",
  ]
  for (const sql of orderMigrations) { try { await pool.execute(sql) } catch { /* 已存在 */ } }

  // AI 模型管理表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_models (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(50) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      api_key VARCHAR(1000) DEFAULT '',
      model_name VARCHAR(100) NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      is_active TINYINT(1) DEFAULT 0,
      is_enabled TINYINT(1) DEFAULT 1,
      is_free TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      health_status VARCHAR(20) DEFAULT 'unknown',
      last_check_at DATETIME DEFAULT NULL,
      last_error VARCHAR(500) DEFAULT NULL,
      consecutive_fails INT DEFAULT 0,
      response_ms INT DEFAULT NULL,
      extra JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_provider_model (provider, model_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 兼容旧表：添加新字段（已有表不会被 CREATE TABLE IF NOT EXISTS 修改）
  const healthCols = ['health_status', 'last_check_at', 'last_error', 'consecutive_fails', 'response_ms']
  for (const col of healthCols) {
    try { await pool.execute(`SELECT ${col} FROM ai_models LIMIT 0`) }
    catch { 
      const colDefs = {
        health_status: "VARCHAR(20) DEFAULT 'unknown'",
        last_check_at: 'DATETIME DEFAULT NULL',
        last_error: 'VARCHAR(500) DEFAULT NULL',
        consecutive_fails: 'INT DEFAULT 0',
        response_ms: 'INT DEFAULT NULL',
      }
      try { await pool.execute(`ALTER TABLE ai_models ADD COLUMN ${col} ${colDefs[col]}`) } catch {}
    }
  }

  // 预设常见 AI 模型供应商（INSERT IGNORE 幂等）
  const aiModelPresets = [
    // --- 国内模型 ---
    ['zhipu',     '智谱GLM-4-Flash（免费）',   '', 'glm-4.7-flash',     'https://open.bigmodel.cn/api/paas/v4/chat/completions',  1, 1, 1, 1],
    ['zhipu',     '智谱GLM-4-Plus',           '', 'glm-4-plus',        'https://open.bigmodel.cn/api/paas/v4/chat/completions',  0, 1, 0, 2],
    ['zhipu',     '智谱GLM-4-Long',           '', 'glm-4-long',        'https://open.bigmodel.cn/api/paas/v4/chat/completions',  0, 1, 0, 3],
    ['deepseek',  'DeepSeek-Chat',            '', 'deepseek-chat',     'https://api.deepseek.com/chat/completions',              0, 1, 0, 4],
    ['deepseek',  'DeepSeek-Reasoner',        '', 'deepseek-reasoner', 'https://api.deepseek.com/chat/completions',              0, 1, 0, 5],
    ['qwen',      '通义千问-Turbo',            '', 'qwen-turbo',        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 0, 1, 0, 6],
    ['qwen',      '通义千问-Plus',             '', 'qwen-plus',         'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 0, 1, 0, 7],
    ['qwen',      '通义千问-Max',              '', 'qwen-max',          'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 0, 1, 0, 8],
    ['qwen',      '通义千问-Long',             '', 'qwen-long',         'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 0, 1, 0, 9],
    ['moonshot',  'Moonshot Kimi-v1-8K',      '', 'moonshot-v1-8k',    'https://api.moonshot.cn/v1/chat/completions',            0, 1, 0, 10],
    ['moonshot',  'Moonshot Kimi-v1-32K',     '', 'moonshot-v1-32k',   'https://api.moonshot.cn/v1/chat/completions',            0, 1, 0, 11],
    ['moonshot',  'Moonshot Kimi-v1-128K',    '', 'moonshot-v1-128k',  'https://api.moonshot.cn/v1/chat/completions',            0, 1, 0, 12],
    ['baichuan',  '百川Baichuan4',            '', 'Baichuan4',         'https://api.baichuan-ai.com/v1/chat/completions',        0, 1, 0, 13],
    ['yi',        '零一万物Yi-Lightning',      '', 'yi-lightning',      'https://api.lingyiwanwu.com/v1/chat/completions',        0, 1, 0, 14],
    ['yi',        '零一万物Yi-Large',          '', 'yi-large',          'https://api.lingyiwanwu.com/v1/chat/completions',        0, 1, 0, 15],
    ['doubao',    '字节豆包-Lite-32K',         '', 'doubao-lite-32k',   'https://ark.cn-beijing.volces.com/api/v3/chat/completions', 0, 1, 0, 16],
    ['doubao',    '字节豆包-Pro-32K',          '', 'doubao-pro-32k',    'https://ark.cn-beijing.volces.com/api/v3/chat/completions', 0, 1, 0, 17],
    ['volcengine','火山方舟DeepSeek-V3.1',     '', 'deepseek-v3-1-250821', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', 0, 1, 0, 17.5],
    ['spark',     '讯飞星火-Lite（免费）',      '', 'generalv3',         'https://spark-api-open.xf-yun.com/v1/chat/completions', 0, 1, 1, 18],
    ['spark',     '讯飞星火-Pro',              '', 'generalv3.5',       'https://spark-api-open.xf-yun.com/v1/chat/completions', 0, 1, 0, 19],
    ['spark',     '讯飞星火-Max',              '', 'general4.0',        'https://spark-api-open.xf-yun.com/v1/chat/completions', 0, 1, 0, 20],
    ['minimax',   'MiniMax abab6.5s',         '', 'abab6.5s-chat',     'https://api.minimax.chat/v1/text/chatcompletion_v2',     0, 1, 0, 21],
    ['stepfun',   '阶跃星辰Step-1-8K',        '', 'step-1-8k',         'https://api.stepfun.com/v1/chat/completions',            0, 1, 0, 22],
    ['stepfun',   '阶跃星辰Step-2-16K',       '', 'step-2-16k',        'https://api.stepfun.com/v1/chat/completions',            0, 1, 0, 23],
    ['hunyuan',   '腾讯混元-Lite（免费）',      '', 'hunyuan-lite',      'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', 0, 1, 1, 24],
    ['hunyuan',   '腾讯混元-Standard',         '', 'hunyuan-standard',  'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', 0, 1, 0, 25],
    ['hunyuan',   '腾讯混元-Pro',              '', 'hunyuan-pro',       'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', 0, 1, 0, 26],
    // --- SiliconFlow 免费模型 ---
    ['siliconflow','SiliconFlow Qwen2.5-7B（免费）','','Qwen/Qwen2.5-7B-Instruct','https://api.siliconflow.cn/v1/chat/completions', 0, 1, 1, 30],
    ['siliconflow','SiliconFlow GLM4-9B（免费）','', 'THUDM/glm-4-9b-chat','https://api.siliconflow.cn/v1/chat/completions',     0, 1, 1, 31],
    ['siliconflow','SiliconFlow DeepSeek-V3（免费）','','deepseek-ai/DeepSeek-V3','https://api.siliconflow.cn/v1/chat/completions', 0, 1, 1, 32],
    ['siliconflow','SiliconFlow Yi-1.5-9B（免费）','','01-ai/Yi-1.5-9B-Chat-16K','https://api.siliconflow.cn/v1/chat/completions', 0, 1, 1, 33],
    ['siliconflow','SiliconFlow Llama3-8B（免费）','','meta-llama/Meta-Llama-3-8B-Instruct','https://api.siliconflow.cn/v1/chat/completions', 0, 1, 1, 34],
    ['siliconflow','SiliconFlow InternLM2.5-7B（免费）','','internlm/internlm2_5-7b-chat','https://api.siliconflow.cn/v1/chat/completions', 0, 1, 1, 35],
    // --- 国际模型 ---
    ['openai',    'OpenAI GPT-4o-mini',       '', 'gpt-4o-mini',       'https://api.openai.com/v1/chat/completions',             0, 1, 0, 40],
    ['openai',    'OpenAI GPT-4o',            '', 'gpt-4o',            'https://api.openai.com/v1/chat/completions',             0, 1, 0, 41],
    ['openai',    'OpenAI GPT-4-Turbo',       '', 'gpt-4-turbo',       'https://api.openai.com/v1/chat/completions',             0, 1, 0, 42],
    ['openai',    'OpenAI o1-mini',            '', 'o1-mini',           'https://api.openai.com/v1/chat/completions',             0, 1, 0, 43],
    ['anthropic', 'Claude 3.5 Sonnet',        '', 'claude-3-5-sonnet-20241022', 'https://api.anthropic.com/v1/messages',         0, 1, 0, 44],
    ['anthropic', 'Claude 3.5 Haiku',         '', 'claude-3-5-haiku-20241022',  'https://api.anthropic.com/v1/messages',         0, 1, 0, 45],
    ['gemini',    'Google Gemini 2.0 Flash',  '', 'gemini-2.0-flash',  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 0, 1, 0, 46],
    ['gemini',    'Google Gemini 1.5 Pro',    '', 'gemini-1.5-pro',    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 0, 1, 0, 47],
    ['groq',      'Groq Llama3-70B（免费）',   '', 'llama3-70b-8192',   'https://api.groq.com/openai/v1/chat/completions',       0, 1, 1, 48],
    ['groq',      'Groq Mixtral-8x7B（免费）', '', 'mixtral-8x7b-32768','https://api.groq.com/openai/v1/chat/completions',       0, 1, 1, 49],
    // --- 自定义 ---
    ['custom',    '自定义模型',                '', 'custom-model',      'https://your-api.com/v1/chat/completions',               0, 0, 0, 99],
  ]
  for (const [provider, name, key, model, endpoint, active, enabled, free, order] of aiModelPresets) {
    await pool.execute(
      'INSERT IGNORE INTO ai_models (provider, display_name, api_key, model_name, endpoint, is_active, is_enabled, is_free, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [provider, name, key, model, endpoint, active, enabled, free, order]
    )
  }

  // DeepSeek 多账号余额管理表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS deepseek_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(100) NOT NULL DEFAULT '',
      api_key VARCHAR(1000) NOT NULL,
      is_enabled TINYINT(1) DEFAULT 1,
      total_balance DECIMAL(12,2) DEFAULT NULL,
      granted_balance DECIMAL(12,2) DEFAULT NULL,
      topped_up_balance DECIMAL(12,2) DEFAULT NULL,
      is_available TINYINT(1) DEFAULT NULL,
      warning_threshold DECIMAL(10,2) DEFAULT 10.00,
      last_check_at DATETIME DEFAULT NULL,
      last_error VARCHAR(500) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 管理端 AI 简报持久化（每 scope + context_key 一条）
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_ai_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scope VARCHAR(64) NOT NULL,
      context_key VARCHAR(64) NOT NULL DEFAULT 'default',
      markdown MEDIUMTEXT NOT NULL,
      meta_json JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_scope_context (scope, context_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 管理端异步任务（商城 AI 生成/优化等）
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_jobs (
      id VARCHAR(36) PRIMARY KEY,
      type VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      phase VARCHAR(64) DEFAULT '',
      message VARCHAR(512) DEFAULT '',
      current_step INT DEFAULT 0,
      total_steps INT DEFAULT 0,
      result_json JSON,
      error TEXT,
      meta_json JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status_type (status, type),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 资金审计日志表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS financial_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL COMMENT 'purchase_deduct|recharge_confirm|admin_adjust|refund',
      amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '正数=入账, 负数=出账',
      balance_after DECIMAL(10,2) DEFAULT 0 COMMENT '操作后余额',
      ref_id VARCHAR(64) DEFAULT '' COMMENT '关联订单号/流水号',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_type (type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 迁移：将旧 system_config 中的 API Key 迁移到 ai_models 表
  try {
    const oldZhipuKey = await getSystemConfig('zhipu_api_key')
    if (oldZhipuKey) {
      const encKey = safeEncrypt(oldZhipuKey)
      await pool.execute("UPDATE ai_models SET api_key = ? WHERE provider = 'zhipu' AND api_key = ''", [encKey])
    }
    const oldDeepseekKey = await getSystemConfig('deepseek_api_key')
    if (oldDeepseekKey) {
      const encKey = safeEncrypt(oldDeepseekKey)
      await pool.execute("UPDATE ai_models SET api_key = ? WHERE provider = 'deepseek' AND api_key = ''", [encKey])
    }
  } catch {}

  // 默认管理员（bcrypt 哈希密码）
  const [admins] = await pool.execute('SELECT COUNT(*) as cnt FROM admins')
  if (admins[0].cnt === 0) {
    const envPwd = process.env.ADMIN_INITIAL_PASSWORD
    let initialPassword
    if (envPwd && envPwd.length >= 12) {
      initialPassword = envPwd
    } else {
      initialPassword = crypto.randomBytes(16).toString('hex')
      console.warn('\n⚠️  未设置 ADMIN_INITIAL_PASSWORD（≥12 字符），已生成随机管理员密码：')
      console.warn(`   用户名: admin  密码: ${initialPassword}`)
      console.warn('   请立即登录后台修改密码，并在 server/.env 中设置 ADMIN_INITIAL_PASSWORD 以便复现部署。\n')
    }
    const hash = bcrypt.hashSync(initialPassword, 12)
    await pool.execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hash])
  } else {
    const [adminRow] = await pool.execute("SELECT id FROM admins WHERE username = 'admin' LIMIT 1")
    if (adminRow.length > 0) {
      console.warn('⚠️  请确认生产环境管理员 admin 已使用强密码（勿使用默认 admin123）')
    }
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
    ['ai_provider',         'siliconflow',             'AI服务商（deepseek / zhipu / siliconflow）',  'ai',      9],
    ['deepseek_api_key',    '',                         'DeepSeek API Key',             'ai',      10],
    ['deepseek_model',      'deepseek-chat',            'DeepSeek 模型名称',             'ai',      11],
    ['zhipu_api_key',       '',                         '智谱AI API Key（GLM免费模型）',  'ai',      12],
    ['zhipu_model',         'glm-4.7-flash',            '智谱AI 模型名称',               'ai',      13],
    ['siliconflow_api_key', '',                         'SiliconFlow API Key',          'ai',      14],
    ['siliconflow_model',   'deepseek-ai/DeepSeek-V3',  'SiliconFlow 模型名称',          'ai',      15],
    ['ai_temperature',      '0.7',                     'AI 回复温度（0-1）',             'ai',      16],
    ['cost_multiplier',     '2',                       'Token计费倍率（默认2倍）',        'ai',      17],
    ['new_user_balance',    '1.00',                    '新用户注册赠送余额（元，0=不赠送）', 'ai',      18],
    ['recharge_enabled',    '1',                       '启用用户充值功能',               'recharge', 20],
    ['recharge_amounts',    '10,30,50,100,200,500',    '预设充值金额（逗号分隔）',        'recharge', 21],
    ['recharge_min_amount', '10',                      '最低充值金额（元）',              'recharge', 22],
    ['recharge_qr_wechat',  '',                        '微信收款二维码图片URL',           'recharge', 23],
    ['recharge_qr_alipay',  '',                        '支付宝收款二维码图片URL',          'recharge', 24],
    ['recharge_instructions','扫码支付后，请在下方输入您的支付截图备注或交易单号，管理员确认后余额将自动到账。', '充值说明文字', 'recharge', 25],
    ['tech_contact_enabled', '1',                       '启用技术人员名片',                'contact', 30],
    ['tech_contact_name',    '',                         '技术人员姓名',                    'contact', 31],
    ['tech_contact_title',   'AI申诉助手技术顾问',         '职位头衔',                       'contact', 32],
    ['tech_contact_phone',   '',                         '联系电话',                        'contact', 33],
    ['tech_contact_wechat',  '',                         '微信号',                          'contact', 34],
    ['tech_contact_email',   '',                         '邮箱',                            'contact', 35],
    ['tech_contact_qr',      '',                        '微信二维码图片URL',                'contact', 36],
    ['tech_contact_desc',    '专业商户申诉解决方案，有问题随时联系我', '名片描述语',            'contact', 37],
    ['xianyu_app_key',       '',                        '闲管家 AppKey',               'xianyu',  1],
    ['xianyu_app_secret',    '',                        '闲管家 AppSecret',             'xianyu',  2],
    ['xianyu_app_type',      '进销存',                   '应用类型',                      'xianyu',  3],
    ['xianyu_app_mode',      '自研系统',                  '应用模式',                      'xianyu',  4],
    ['xianyu_app_name',      '艾阳的店铺',                '应用名称',                      'xianyu',  5],
    ['xianyu_app_status',    '已上线',                    '应用状态',                      'xianyu',  6],
    ['xianyu_created_at',    '2026-03-17 19:39:40',     '创建时间',                      'xianyu',  7],
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

  try {
    const { initOpsCenterTables } = await import('../opsCenter.js')
    await initOpsCenterTables()
  } catch (err) {
    console.warn('[OpsCenter] 表初始化跳过:', err.message)
  }

  console.log('✅ MySQL 数据库初始化完成')
}
