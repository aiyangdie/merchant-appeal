import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import logger from '../utils/logger.js'

// 加载.env文件
dotenv.config()

// 配置管理类
class ConfigManager {
  constructor() {
    this.config = {}
    this.loadConfig()
  }

  // 加载配置
  loadConfig() {
    // 数据库配置
    this.config.database = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'merchant_appeal',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : undefined
    }

    // 服务器配置
    this.config.server = {
      port: process.env.PORT || 3001,
      nodeEnv: process.env.NODE_ENV || 'development',
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      encryptKey: process.env.ENCRYPT_KEY
    }

    // CORS配置
    this.config.cors = {
      origins: process.env.CORS_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : '*'),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }

    // AI配置
    this.config.ai = {
      provider: process.env.AI_PROVIDER || 'zhipu',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      costMultiplier: parseFloat(process.env.COST_MULTIPLIER || '2'),
      newUserBalance: parseFloat(process.env.NEW_USER_BALANCE || '1.00')
    }

    // 前端配置
    this.config.frontend = {
      title: process.env.VITE_APP_TITLE || '商户号申诉助手',
      apiBaseUrl: process.env.VITE_API_BASE_URL || 'http://localhost:3001'
    }

    // 安全配置
    this.config.security = {
      rateLimit: {
        windowMs: 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX || '100')
      },
      chatRateLimit: {
        windowMs: 60 * 1000,
        max: parseInt(process.env.CHAT_RATE_LIMIT_MAX || '20')
      },
      authRateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 10
      }
    }

    // 验证必要的配置
    this.validateConfig()
  }

  // 验证配置
  validateConfig() {
    // 验证JWT密钥
    if (!this.config.server.jwtSecret) {
      logger.warn('⚠️ JWT_SECRET 未配置，使用随机生成的临时密钥（仅用于开发）')
      this.config.server.jwtSecret = Math.random().toString(36).substring(2, 35) + Math.random().toString(36).substring(2, 35)
    }

    // 验证加密密钥
    if (!this.config.server.encryptKey) {
      logger.warn('⚠️ ENCRYPT_KEY 未配置，使用随机生成的临时密钥（仅用于开发）')
      this.config.server.encryptKey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
    } else if (!/^[0-9a-fA-F]{64}$/.test(this.config.server.encryptKey)) {
      logger.error('❌ ENCRYPT_KEY 必须是64位十六进制字符串')
      process.exit(1)
    }

    // 验证数据库配置
    if (!this.config.database.user || !this.config.database.password || !this.config.database.database) {
      logger.error('❌ 数据库配置不完整')
      process.exit(1)
    }
  }

  // 获取配置
  get(key, defaultValue = undefined) {
    const keys = key.split('.')
    let value = this.config

    for (const k of keys) {
      if (value[k] === undefined) {
        return defaultValue
      }
      value = value[k]
    }

    return value
  }

  // 设置配置
  set(key, value) {
    const keys = key.split('.')
    let config = this.config

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!config[k]) {
        config[k] = {}
      }
      config = config[k]
    }

    config[keys[keys.length - 1]] = value
  }

  // 检查是否已安装
  isInstalled() {
    return fs.existsSync(path.join(process.cwd(), '.installed'))
  }

  // 获取完整配置
  getAll() {
    return this.config
  }
}

// 导出单例
export default new ConfigManager()