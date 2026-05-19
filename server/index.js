/**
 * 生产入口 — 中间件 + 路由注册 + 启动
 * 业务路由见 server/routes/prod/
 */
import 'dotenv/config'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import helmet from 'helmet'
import {
  initDatabase,
  recordTokenUsage,
  deductBalance,
  incrementUserSpent,
  getSystemConfig,
  getUserById,
  getActiveAIModel,
  getPool,
} from './db.js'
import { initUsageTracker } from './ai/usageTracker.js'
import xianyuApi from './xianyu-api.js'
import { apiMetricsMiddleware, startMonitorScheduler, stopMonitorScheduler } from './monitor.js'
import { startBackupScheduler, stopBackupScheduler } from './backup.js'
import { startEvolutionScheduler, stopEvolutionScheduler } from './evolution.js'
import { startHealthScheduler } from './modelHealth.js'
import { createAppContext } from './appContext.js'
import { registerProdRoutes } from './routes/prod/registerProdRoutes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, 'payment.secrets.env') })

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('\n❌ FATAL: JWT_SECRET environment variable is required.\n')
  process.exit(1)
}
if (JWT_SECRET.length < 32 || /merchant_appeal_jwt|change-in-production|dev-secret/i.test(JWT_SECRET)) {
  console.warn('⚠️  JWT_SECRET 强度不足，建议在 server/.env 中更换为至少 32 字节的随机字符串')
}
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || ''
if (!ENCRYPT_KEY || ENCRYPT_KEY === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
  console.warn('⚠️  ENCRYPT_KEY 仍为示例值，请在 server/.env 中设置随机 64 位十六进制密钥')
}

if (!process.env.ORDER_SYSTEM_URL) {
  console.error('\n❌ FATAL: ORDER_SYSTEM_URL environment variable is required.\n')
  process.exit(1)
}
if (!process.env.APPEAL_API_KEY) {
  console.error('\n❌ FATAL: APPEAL_API_KEY environment variable is required.\n')
  process.exit(1)
}

const distPath = path.join(__dirname, '..', 'dist')

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))

const corsOrigins = (process.env.CORS_ORIGINS || 'https://appeal.aikex.ink').split(',').map(s => s.trim())
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

const ctx = createAppContext({
  jwtSecret: JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES_IN || '24h',
  distPath,
})

app.use(ctx.globalRateLimiter)

app.use('/api/payment/wechat/notify', express.raw({ type: 'application/json' }))
app.use('/api/payment/alipay/notify', express.urlencoded({ extended: true }))
app.use('/api/payment/epay/notify', express.urlencoded({ extended: true }))
app.use('/api/payment/codepay/notify', express.urlencoded({ extended: true }))

app.use(express.json({ limit: '1mb' }))
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
  threshold: 1024,
  level: 6,
}))
app.use(apiMetricsMiddleware)
app.use(express.static(distPath))

registerProdRoutes(app, ctx)

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: '接口不存在' })
  }
  const htmlPath = path.join(distPath, 'index.html')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.sendFile(htmlPath, (err) => {
    if (err) {
      console.error('[SPA] index.html 发送失败:', err.message)
      res.status(500).send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>加载中</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#666"><div style="text-align:center"><p>页面加载失败，请刷新重试</p></div></body></html>')
    }
  })
})

app.use((err, req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500
  const isDev = process.env.NODE_ENV !== 'production'
  const logData = {
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    ...(isDev && { stack: err.stack }),
  }
  if (statusCode >= 500) console.error('[ERROR]', JSON.stringify(logData))
  else console.warn('[WARN]', JSON.stringify(logData))
  if (res.headersSent) return
  res.status(statusCode).json({
    error: isDev ? err.message : '服务器内部错误，请稍后重试',
    ...(isDev && { path: req.path, method: req.method }),
  })
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] 未处理的 Promise 拒绝:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[FATAL] 未捕获的异常:', err)
  setTimeout(() => { process.exit(1) }, 10000)
})

async function start() {
  try {
    await initDatabase()
    try {
      const { recoverStaleAdminJobs } = await import('./services/adminJobs.js')
      const cleaned = await recoverStaleAdminJobs()
      if (cleaned > 0) console.log(`🧹 已自动结束 ${cleaned} 个超时的后台任务（admin_jobs）`)
    } catch (e) {
      console.warn('⚠️  清理超时后台任务失败:', e.message)
    }
    try {
      const { loadPaymentSecretsEnv, syncPaymentEnvToDb, ensureRechargeDefaults } = await import('./paymentEnvSync.js')
      const loadedSecrets = loadPaymentSecretsEnv()
      await ensureRechargeDefaults()
      const pay = await syncPaymentEnvToDb({ forceSecrets: loadedSecrets })
      const ch = pay.channels
      console.log(`💳 支付站点: ${pay.siteBase}`)
      console.log(`💳 支付渠道: 微信 ${ch.wechat ? '✓' : '—'} | 支付宝 ${ch.alipay ? '✓' : '—'} | 易支付 ${ch.epay ? '✓' : '—'} | 码支付 ${ch.codepay ? '✓' : '—'}`)
      if (!pay.wechatReady || !pay.alipayReady) {
        console.log('💡 微信/支付宝密钥未齐：请填写 server/payment.secrets.env 或在管理后台「系统设置」保存后重启')
      }
      if (pay.updated?.length) console.log(`💳 已同步配置项: ${pay.updated.join(', ')}`)
    } catch (e) {
      console.warn('[Payment] 加载支付配置:', e.message)
    }
    initUsageTracker({
      recordTokenUsage,
      deductBalance,
      incrementUserSpent,
      getSystemConfig,
      getUserById,
      getActiveAIModel,
      getPool,
    })
    xianyuApi.clearCacheByPrefix('shops_')
    xianyuApi.clearCacheByPrefix('products_')
    try {
      const { saveChatboardSnapshot } = await import('./opsCenter.js')
      await saveChatboardSnapshot(7)
      console.log('[OpsCenter] 今日看板快照已就绪')
    } catch (e) {
      console.warn('[OpsCenter] 快照初始化:', e.message)
    }
    const [auditTable] = await getPool().query('SELECT 1 FROM financial_audit LIMIT 1').catch(() => [])
    if (auditTable) console.log('[Init] 审计日志表就绪')

    const server = app.listen(PORT, '0.0.0.0', () => console.log(`🚀 服务器已启动: http://0.0.0.0:${PORT}`))

    try {
      const { getAIModels } = await import('./db.js')
      const models = await getAIModels()
      const enabled = models.filter(m => m.is_enabled)
      const healthy = enabled.filter(m => m.health_status === 'healthy')
      const hasKey = enabled.filter(m => m.has_key)
      const activeModel = enabled.find(m => m.is_active)
      console.log(`\n🤖 AI 模型诊断: ${healthy.length}/${enabled.length} 健康 | ${hasKey.length}/${enabled.length} 已配置密钥`)
      if (!activeModel) console.log('⚠️  未设置默认AI模型，请在管理后台激活一个模型')
      else if (activeModel.health_status !== 'healthy') {
        console.log(`⚠️  默认模型 "${activeModel.display_name}" 状态异常 (${activeModel.health_status})`)
      }
      console.log()
    } catch { /* ignore */ }

    startEvolutionScheduler()
    startHealthScheduler(30)
    startMonitorScheduler(1)
    startBackupScheduler()

    console.log('📊 监控告警系统已启动（/api/health 可用）')
    console.log('💾 数据备份系统已启动')

    const ORDER_SYSTEM_URL = process.env.ORDER_SYSTEM_URL
    if (ORDER_SYSTEM_URL) {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 5000)
        const r = await fetch(`${ORDER_SYSTEM_URL.replace(/\/$/, '')}/health`, { signal: ctrl.signal })
        clearTimeout(t)
        if (r.ok) console.log(`✅ 订单系统联通: ${ORDER_SYSTEM_URL}`)
        else console.warn(`⚠️  订单系统响应异常: ${ORDER_SYSTEM_URL} (${r.status})`)
      } catch (e) {
        console.warn(`⚠️  订单系统不可达: ${ORDER_SYSTEM_URL} — ${e.message}`)
      }
    }

    const { stopHealthScheduler } = await import('./modelHealth.js')
    const shutdown = (signal) => {
      console.log(`\n⏹ 收到 ${signal}，正在优雅关闭...`)
      stopEvolutionScheduler()
      stopHealthScheduler()
      stopMonitorScheduler()
      stopBackupScheduler()
      server.close(() => {
        console.log('✅ HTTP 服务器已关闭')
        process.exit(0)
      })
      setTimeout(() => { console.error('⚠️ 关闭超时，强制退出'); process.exit(1) }, 10000)
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (err) {
    console.error('❌ 启动失败:', err)
    process.exit(1)
  }
}

start()
