-- 商户号申诉助手 - 数据库初始化脚本
-- 创建日期: 2026-04-13

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS merchant_appeal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE merchant_appeal;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  order_no VARCHAR(64),
  order_data JSON,
  appeal_type VARCHAR(50),
  status ENUM('active', 'closed', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天记录表
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商户信息表
CREATE TABLE IF NOT EXISTS merchant_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  merchant_id VARCHAR(50),
  company_name VARCHAR(200),
  legal_person VARCHAR(50),
  legal_id_card VARCHAR(50),
  legal_phone VARCHAR(20),
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  business_address TEXT,
  industry_category VARCHAR(100),
  business_license_no VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 申诉记录表
CREATE TABLE IF NOT EXISTS appeal_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  appeal_type VARCHAR(50) NOT NULL,
  appeal_reason TEXT,
  appeal_status ENUM('pending', 'submitted', 'reviewing', 'approved', 'rejected', 'closed') DEFAULT 'pending',
  submitted_at TIMESTAMP NULL,
  reviewed_at TIMESTAMP NULL,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_appeal_status (appeal_status),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 材料文件表
CREATE TABLE IF NOT EXISTS appeal_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员账号（默认密码: admin123）
-- 密码是 bcrypt 加密后的值
INSERT INTO users (username, password, phone, role) VALUES
('admin', '$2a$10$rQXqCQzJw5P5Y5P5Y5P5Y.5Y5P5Y5P5Y5P5Y5P5Y5P5Y5P5Y5P5Y5', NULL, 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- 创建只读用户（用于报表等）
CREATE USER IF NOT EXISTS 'merchant_read'@'%' IDENTIFIED BY 'read_password';
GRANT SELECT ON merchant_appeal.* TO 'merchant_read'@'%';
FLUSH PRIVILEGES;
