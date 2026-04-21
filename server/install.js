import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import db from './config/database.js'
import { initSchema } from './config/initDb.js'
import logger from './utils/logger.js'

const ENV_FILE = path.join(process.cwd(), '.env')
const INSTALL_FLAG = path.join(process.cwd(), '.installed')

export async function checkInstallationStatus(req, res) {
  try {
    // 检查安装标志文件
    const installed = fs.existsSync(INSTALL_FLAG)
    res.json({ installed })
  } catch (error) {
    logger.error('检查安装状态失败:', error)
    res.status(500).json({ error: '检查安装状态失败' })
  }
}

export async function handleInstallation(req, res) {
  try {
    const { dbHost, dbPort, dbUser, dbPassword, dbName, jwtSecret, encryptKey, adminUsername, adminPassword } = req.body
    
    // 验证必填字段
    if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName || !jwtSecret || !encryptKey || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: '请填写所有必填字段' })
    }
    
    // 验证加密密钥格式
    if (!/^[0-9a-fA-F]{64}$/.test(encryptKey)) {
      return res.status(400).json({ error: '加密密钥必须是64位十六进制字符串' })
    }
    
    // 创建.env文件
    const envContent = `# 数据库配置
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_NAME=${dbName}

# 服务配置
PORT=3001
NODE_ENV=production

# JWT密钥
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d

# 数据加密密钥
ENCRYPT_KEY=${encryptKey}

# 前端配置
VITE_APP_TITLE=商户号申诉助手
VITE_API_BASE_URL=http://localhost:3001
`
    
    fs.writeFileSync(ENV_FILE, envContent)
    logger.info('创建.env文件成功')
    
    // 初始化数据库连接
    await db.init()
    logger.info('数据库连接成功')
    
    // 初始化数据库 schema
    await initSchema()
    logger.info('数据库初始化成功')
    
    // 创建管理员账户
    const pool = db.getPool()
    const hashedPassword = bcrypt.hashSync(adminPassword, 12)
    await pool.execute('INSERT INTO admins (username, password) VALUES (?, ?)', [adminUsername, hashedPassword])
    logger.info('创建管理员账户成功')
    
    // 创建安装标志文件
    fs.writeFileSync(INSTALL_FLAG, new Date().toISOString())
    logger.info('创建安装标志文件成功')
    
    res.json({ success: true, message: '安装成功' })
  } catch (error) {
    logger.error('安装失败:', error)
    
    // 清理安装过程中创建的文件
    try {
      if (fs.existsSync(ENV_FILE)) {
        fs.unlinkSync(ENV_FILE)
      }
      if (fs.existsSync(INSTALL_FLAG)) {
        fs.unlinkSync(INSTALL_FLAG)
      }
    } catch (cleanupError) {
      logger.error('清理安装文件失败:', cleanupError)
    }
    
    res.status(500).json({ error: '安装失败: ' + error.message })
  }
}

export async function initInstallRoutes(app) {
  // 检查安装状态
  app.get('/api/install/check', checkInstallationStatus)
  
  // 处理安装请求
  app.post('/api/install', handleInstallation)
  
  // 重新安装（仅开发环境）
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/install/reset', async (req, res) => {
      try {
        if (fs.existsSync(ENV_FILE)) {
          fs.unlinkSync(ENV_FILE)
        }
        if (fs.existsSync(INSTALL_FLAG)) {
          fs.unlinkSync(INSTALL_FLAG)
        }
        res.json({ success: true, message: '重置安装状态成功' })
      } catch (error) {
        res.status(500).json({ error: '重置安装状态失败' })
      }
    })
  }
}