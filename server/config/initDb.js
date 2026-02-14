import db from './database.js';
import { encrypt, safeEncrypt, hmacHash, safeDecrypt } from '../utils/crypto.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

export async function initSchema() {
  logger.info('Initializing database schema...');
  const pool = db.getPool();

  try {
    // 1. Create Tables
    await createTables(pool);
    
    // 2. Run Migrations (Add columns if missing)
    await runMigrations(pool);
    
    // 3. Encrypt Legacy Data
    await migrateEncryptUserData(pool);
    await migrateEncryptActionIPs(pool);
    
    // 4. Seed Default Data
    await seedDefaults(pool);
    await seedKnowledgeBase(pool);
    
    logger.info('✅ Database schema initialization completed');
  } catch (error) {
    logger.error('❌ Schema initialization failed:', error);
    throw error;
  }
}

async function createTables(pool) {
  // Sessions
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'active',
      collected_data JSON,
      step INT DEFAULT 0,
      deep_analysis_result MEDIUMTEXT DEFAULT NULL,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Messages
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Users
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
      deep_analysis_count INT DEFAULT 0,
      deep_analysis_month VARCHAR(7) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Admins
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password VARCHAR(128) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // System Config
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS system_config (
      config_key VARCHAR(128) PRIMARY KEY,
      config_value TEXT,
      config_label VARCHAR(128),
      config_group VARCHAR(64) DEFAULT 'general',
      sort_order INT DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Payment Config
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS payment_config (
      config_key VARCHAR(128) PRIMARY KEY,
      config_value TEXT,
      config_label VARCHAR(128),
      config_group VARCHAR(32) DEFAULT 'wechat',
      sort_order INT DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Recharge Orders
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
  `);

  // User Actions
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
  `);

  // Token Usage
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
  `);

  // Appeal Texts
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
      appeal_status ENUM('generated','submitted','under_review','approved','rejected','resubmitted') DEFAULT 'generated',
      user_feedback TEXT DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      result_at DATETIME DEFAULT NULL,
      rejection_reason VARCHAR(500) DEFAULT NULL,
      resubmit_count INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Success Cases
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
  `);

  // AI Models
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
  `);

  // Knowledge Snippets (Violation Knowledge)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_snippets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(32) NOT NULL DEFAULT 'violation',
      snippet_key VARCHAR(64) NOT NULL,
      content JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_category_key (category, snippet_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ... (Other tables like orders, products, etc. if needed)
}

async function runMigrations(pool) {
  // Simple check and add columns
  const migrations = [
    'ALTER TABLE sessions ADD COLUMN user_id INT DEFAULT NULL AFTER id',
    'ALTER TABLE sessions ADD INDEX idx_user (user_id)',
    'ALTER TABLE sessions ADD COLUMN deep_analysis_result MEDIUMTEXT DEFAULT NULL',
    'ALTER TABLE messages MODIFY content MEDIUMTEXT NOT NULL',
    'ALTER TABLE users ADD COLUMN last_active_at DATETIME DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN last_ip VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users ADD COLUMN login_count INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN total_messages INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0.00',
    'ALTER TABLE users ADD COLUMN phone_hash VARCHAR(64) NOT NULL DEFAULT "" AFTER phone',
    'ALTER TABLE users MODIFY phone VARCHAR(512) NOT NULL',
    'ALTER TABLE users MODIFY nickname VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users MODIFY custom_api_key VARCHAR(512) DEFAULT ""',
    'ALTER TABLE users ADD COLUMN deep_analysis_count INT DEFAULT 0',
    'ALTER TABLE users ADD COLUMN deep_analysis_month VARCHAR(7) DEFAULT ""',
    'ALTER TABLE users DROP INDEX phone', // Drop old index if exists
    'ALTER TABLE users ADD UNIQUE INDEX idx_phone_hash (phone_hash)'
  ];

  for (const sql of migrations) {
    try {
      await pool.execute(sql);
    } catch (e) {
      // Ignore "Duplicate column name" or "Duplicate key name" errors
      if (!e.message.includes('Duplicate') && !e.message.includes('exist')) {
        // logger.warn('Migration warning:', e.message);
      }
    }
  }
}

async function seedDefaults(pool) {
  // 1. Admin
  const [admins] = await pool.execute('SELECT COUNT(*) as cnt FROM admins');
  if (admins[0].cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 12);
    await pool.execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hash]);
    logger.warn('⚠️  Created default admin: admin / admin123 (CHANGE IMMEDIATELY)');
  }

  // 2. AI Models
  const aiModelPresets = [
    ['zhipu',     '智谱GLM-4-Flash（免费）',   '', 'glm-4.7-flash',     'https://open.bigmodel.cn/api/paas/v4/chat/completions',  1, 1, 1, 1],
    ['deepseek',  'DeepSeek-Chat',            '', 'deepseek-chat',     'https://api.deepseek.com/chat/completions',              0, 1, 0, 3],
    ['custom',    '自定义模型',                '', 'custom-model',      'https://your-api.com/v1/chat/completions',               0, 0, 0, 99],
  ];
  for (const [provider, name, key, model, endpoint, active, enabled, free, order] of aiModelPresets) {
    await pool.execute(
      'INSERT IGNORE INTO ai_models (provider, display_name, api_key, model_name, endpoint, is_active, is_enabled, is_free, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [provider, name, key, model, endpoint, active, enabled, free, order]
    );
  }

  // 3. System Config Defaults
  const sysDefaults = [
    ['site_name',           '微信商户号申诉助手',       '网站名称',                     'general', 1],
    ['ai_provider',         'zhipu',                   'AI服务商（deepseek / zhipu）',  'ai',      9],
    ['ai_temperature',      '0.7',                     'AI 回复温度（0-1）',             'ai',      14],
    ['cost_multiplier',     '2',                       'Token计费倍率（默认2倍）',        'ai',      15],
    ['new_user_balance',    '1.00',                    '新用户注册赠送余额（元，0=不赠送）', 'ai',      16],
  ];
  for (const [key, value, label, group, order] of sysDefaults) {
    await pool.execute(
      'INSERT IGNORE INTO system_config (config_key, config_value, config_label, config_group, sort_order) VALUES (?, ?, ?, ?, ?)',
      [key, value, label, group, order]
    );
  }
}

import { BUILT_IN_CASES, VIOLATION_KNOWLEDGE } from './seedData.js';

async function seedKnowledgeBase(pool) {
  // 1. Seed Success Cases
  const [cases] = await pool.execute('SELECT COUNT(*) as cnt FROM success_cases');
  if (cases[0].cnt === 0) {
    logger.info(`📚 Seeding ${BUILT_IN_CASES.length} built-in success cases...`);
    for (const c of BUILT_IN_CASES) {
      const collectedData = {
        violation_reason: c.violation_reason,
        difficulty: c.difficulty,
        appeal_points: c.appeal_points,
        timeline: c.timeline
      };
      
      await pool.execute(
        `INSERT INTO success_cases 
        (title, industry, problem_type, collected_data, success_summary, admin_notes, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [
          c.title,
          c.industry,
          c.problem_type,
          JSON.stringify(collectedData),
          c.success_summary,
          c.key_strategy // Use admin_notes to store key_strategy
        ]
      );
    }
  }

  // 2. Seed Violation Knowledge
  const [snippets] = await pool.execute("SELECT COUNT(*) as cnt FROM knowledge_snippets WHERE category = 'violation'");
  if (snippets[0].cnt === 0) {
    const entries = Object.entries(VIOLATION_KNOWLEDGE);
    logger.info(`🧠 Seeding ${entries.length} violation knowledge snippets...`);
    
    for (const [key, info] of entries) {
      await pool.execute(
        'INSERT INTO knowledge_snippets (category, snippet_key, content) VALUES (?, ?, ?)',
        ['violation', key, JSON.stringify(info)]
      );
    }
  }
}

async function migrateEncryptUserData(pool) {
  const [rows] = await pool.execute('SELECT id, phone, nickname, last_ip FROM users WHERE phone_hash = "" OR phone_hash IS NULL');
  if (rows.length === 0) return;
  
  logger.info(`🔐 Encrypting ${rows.length} legacy users...`);
  for (const row of rows) {
    const phoneHash = hmacHash(row.phone);
    const phoneEnc = safeEncrypt(row.phone);
    const nicknameEnc = row.nickname ? safeEncrypt(row.nickname) : '';
    const ipEnc = row.last_ip ? safeEncrypt(row.last_ip) : '';
    
    await pool.execute(
      'UPDATE users SET phone = ?, phone_hash = ?, nickname = ?, last_ip = ? WHERE id = ?',
      [phoneEnc, phoneHash, nicknameEnc, ipEnc, row.id]
    );
  }
}

async function migrateEncryptActionIPs(pool) {
  const [rows] = await pool.execute("SELECT id, ip FROM user_actions WHERE ip != '' AND ip IS NOT NULL");
  for (const row of rows) {
    // Check if already encrypted (base64 and length check is a heuristics)
    if (row.ip.length > 30 && !row.ip.includes('.')) continue; // Likely encrypted
    
    const ipEnc = safeEncrypt(row.ip);
    await pool.execute('UPDATE user_actions SET ip = ? WHERE id = ?', [ipEnc, row.id]);
  }
}
