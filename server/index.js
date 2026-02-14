import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import {
  initDatabase,
  createSession, getSession, updateSession,
  addMessage, getMessages, getAllSessions, deleteSession, verifyAdmin,
  changeAdminPassword,
  getSystemConfigs, updateSystemConfigs, getSystemConfig,
  getPaymentConfigs, updatePaymentConfigs,
  getDashboardStats, lookupSessions,
  registerUser, getUserByPhone, getUserById, updateUserApiMode,
  deductBalance, getAllUsers, adjustUserBalance, deleteUser,
  getUserSessions, isChinese,
  trackUserAction, updateUserActivity, incrementLoginCount, incrementUserMessages, incrementUserSpent,
  checkDeepAnalysisQuota, incrementDeepAnalysisCount,
  saveDeepAnalysisResult, getDeepAnalysisResult,
  createRechargeOrder, getRechargeOrders, getUserRechargeOrders,
  confirmRechargeOrder, rejectRechargeOrder, getPendingRechargeCount,
  createSuccessCase, getSuccessCases, getSuccessCaseById, updateSuccessCase, deleteSuccessCase, findSimilarCases,
  recordTokenUsage, getUserTokenUsage, getUserTokenStats, getAllTokenUsage, getTokenUsageStats,
  saveAppealText, getAppealText, updateAppealStatus, getAppealStats,
  getAllAIRules, getAIRuleById, createAIRule, updateAIRuleStatus, updateAIRuleContent, deleteAIRule, getAIRuleStats,
  getConversationAnalyses, getConversationAnalysisById, getAnalysisStats, getQualityTopAndLow,
  logFieldChange, getFieldChangeLog,
  getAIModels, getAIModelById, getActiveAIModel, createAIModel, updateAIModel, setActiveAIModel, deleteAIModel as deleteAIModelDB, updateModelHealth, getAIModelsWithHealth,
  getRuleChangeLog, getLearningMetrics, getUnanalyzedSessions,
  getTagStats, getConversationTags,
  getKnowledgeClusters, getClusterStats,
  getEngineHealth, getExperiments,
  createProduct, updateProduct, deleteProduct, getProductById, getProducts, getProductStats,
  incrementProductMetric, getRecommendations, updateRecommendationStatus, getRecommendationStats,
  getDeepseekAccounts, getDeepseekAccountById, createDeepseekAccount, updateDeepseekAccount, deleteDeepseekAccount, updateDeepseekBalance,
  createContactCard, updateContactCard, deleteContactCard, getContactCardById, getContactCards, getActiveContactCards, incrementCardMetric,
  logAIActivity, getAIActivityLog, getAIActivityStats,
  createOrder, getOrderByNo, getOrderById, getUserOrders, updateOrderStatus, appendServiceMessage, getOrderServiceMessages,
  fixEncryptedData,
  saveComplaintDoc, getComplaintDoc,
} from './db.js'
import { getWelcomeMessage, chatWithAI, streamChatWithAI, extractFieldsWithAI, expandFieldsForIndustry, assessCompletenessWithAI, buildCollectionInstruction, getAIConfig } from './ai.js'
import { buildReportPrompt, TOTAL_STEPS, INFO_FIELDS, LOCAL_WELCOME, normalizeFieldValue, buildCollectionContext, findNextUnfilledStep } from './localAI.js'
import { calculateCost } from './tokenizer.js'
import {
  analyzeConversation, batchAnalyzeConversations, aggregateDailyMetrics,
  generateRulesFromAnalysis, startEvolutionScheduler, stopEvolutionScheduler,
  schedulePostConversationAnalysis, evaluateRuleEffectiveness, autoPromoteRules,
  invalidateRulesCache, autoTagConversation, autoReviewRule, batchAutoReviewRules,
  aggregateKnowledgeClusters, getEngineHealthSummary, safeExecute, runExplorationCycle,
} from './evolution.js'
import {
  loadProductCatalogForPrompt, invalidateProductCache,
  aiOptimizeProduct, batchOptimizeProducts,
  getSmartRecommendations, updateUserInterestFromConversation, parseProductRecommendations,
  aiAutoCreateProducts, aiSuggestNewProducts, aiRecommendContactCard,
  aiAssessRisk, aiGenerateContactCard,
  aiBargain, aiGenerateVirtualPersona,
} from './mall.js'
import { checkAllModels, checkSingleModel, autoSwitchIfNeeded, startHealthScheduler, callWithFallback } from './modelHealth.js'
import { apiMetricsMiddleware, startMonitorScheduler, stopMonitorScheduler, getMonitorStatus, getHealthSummary, getAlerts, acknowledgeAlert, clearAlerts, triggerHealthCheck, resetApiMetrics } from './monitor.js'
import { runBackup, startBackupScheduler, stopBackupScheduler, getBackupStatus, deleteBackupFile } from './backup.js'
import { createPayment, handleWechatNotify, handleAlipayNotify, handleEpayNotify, handleCodePayNotify, queryPaymentStatus, getPaymentChannels, generateOutTradeNo } from './payment.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// 宝塔 Nginx 反向代理：信任代理头以获取真实 IP
app.set('trust proxy', 1)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me'
if (!process.env.JWT_SECRET) console.warn('\n⚠️  安全警告：未设置 JWT_SECRET 环境变量，正在使用不安全的默认密钥！\n   请在 .env 中设置 JWT_SECRET=<随机长字符串>\n')
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h'

// ========== 安全中间件 ==========

// Helmet: 设置安全 HTTP 头
app.use(helmet({
  contentSecurityPolicy: false,   // SPA 需要内联脚本
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))

// CORS 配置
const corsOrigins = process.env.CORS_ORIGINS || '*'
app.use(cors({
  origin: corsOrigins === '*' ? true : corsOrigins.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// 全局速率限制（管理员跳过：后台并行请求多，不应被限速）
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
  validate: { xForwardedForHeader: false },
  skip: (req) => {
    // 管理后台路由已有 requireAdmin 中间件保护，无需全局限速
    // 避免 JWT 过期/密钥变更导致管理员被误限速的死锁
    if (req.path.startsWith('/api/admin/') && req.path !== '/api/admin/login') {
      return true
    }
    // 管理员浏览前台页面时也跳过限速
    try {
      const auth = req.headers.authorization
      if (auth && auth.startsWith('Bearer ')) {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
        return decoded.role === 'admin'
      }
    } catch {}
    return false
  },
}))

// 聊天接口单独限速
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX || '20'),
  message: { error: '发送消息过快，请稍后再试' },
  validate: { xForwardedForHeader: false },
})

// 登录/注册接口严格限速（防暴力破解）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次尝试
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
})

// 微信支付回调需要原始body，必须在json解析之前注册
app.use('/api/payment/wechat/notify', express.raw({ type: 'application/json' }))
// 支付宝/易支付/码支付回调使用表单格式
app.use('/api/payment/alipay/notify', express.urlencoded({ extended: true }))
app.use('/api/payment/epay/notify', express.urlencoded({ extended: true }))
app.use('/api/payment/codepay/notify', express.urlencoded({ extended: true }))

app.use(express.json({ limit: '1mb' }))

// API 响应时间监控中间件
app.use(apiMetricsMiddleware)

// 静态文件
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// ========== JWT 工具 ==========

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (decoded.role !== 'admin') return res.status(403).json({ error: '无管理员权限' })
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

// 用户 JWT 认证中间件
function requireUser(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' })
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    if (!decoded.userId) return res.status(401).json({ error: '无效的用户凭证' })
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

// 可选用户认证（不强制，但如果有 token 就解析）
function optionalUser(req, res, next) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
      if (decoded.userId) req.userId = decoded.userId
    } catch { /* token 无效则忽略 */ }
  }
  next()
}

// ========== 用户 API ==========

app.post('/api/user/register', authLimiter, async (req, res) => {
  try {
    const { phone, nickname } = req.body
    if (!phone || phone.trim().length < 2 || phone.trim().length > 20) return res.status(400).json({ error: '请输入有效的手机号' })
    if (!nickname || !isChinese(nickname.trim()) || nickname.trim().length > 20) return res.status(400).json({ error: '名称必须为中文（不超过20字）' })
    const result = await registerUser(phone.trim(), nickname.trim())
    const u = result.user
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    if (result.isNew) {
      // 新用户赠送试用余额（管理员可在后台配置 new_user_balance）
      const giftStr = await getSystemConfig('new_user_balance')
      const giftAmount = parseFloat(giftStr || '1.00')
      if (giftAmount > 0) {
        await adjustUserBalance(u.id, giftAmount)
        u.balance = giftAmount
      }
      await trackUserAction(u.id, 'register', `手机号: ${u.phone}, 赠送余额: ¥${giftAmount}`, ip, req.headers['user-agent'] || '')
    }
    await incrementLoginCount(u.id)
    await updateUserActivity(u.id, ip)
    const token = signToken({ userId: u.id, role: 'user' })
    res.json({ user: { id: u.id, phone: u.phone, nickname: u.nickname, balance: u.balance, api_mode: u.api_mode }, token, isNew: result.isNew })
  } catch (err) {
    if (err.message === 'CHINESE_NAME_REQUIRED') return res.status(400).json({ error: '名称必须为中文' })
    console.error('Register error:', err)
    res.status(500).json({ error: '注册失败' })
  }
})

app.post('/api/user/login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || phone.trim().length > 20) return res.status(400).json({ error: '请输入手机号' })
    const user = await getUserByPhone(phone.trim())
    if (!user) return res.status(404).json({ error: '该手机号未注册，请先注册' })
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    await incrementLoginCount(user.id)
    await updateUserActivity(user.id, ip)
    await trackUserAction(user.id, 'login', '', ip, req.headers['user-agent'] || '')
    const token = signToken({ userId: user.id, role: 'user' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode }, token })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: '登录失败' })
  }
})

// 获取用户的所有聊天会话（需登录 + 只能查自己的）
app.get('/api/user/:id/sessions', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const sessions = await getUserSessions(req.params.id)
    res.json({ sessions })
  } catch (err) {
    console.error('Get user sessions error:', err)
    res.status(500).json({ error: '获取历史记录失败' })
  }
})

app.get('/api/user/:id', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const user = await getUserById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode } })
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

app.put('/api/user/:id/api-mode', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const { api_mode, custom_api_key } = req.body
    if (!['official', 'custom'].includes(api_mode)) return res.status(400).json({ error: '无效的API模式' })
    if (api_mode === 'custom' && (!custom_api_key || !custom_api_key.trim())) {
      return res.status(400).json({ error: '使用自定义API必须提供 API Key' })
    }
    if (custom_api_key && custom_api_key.length > 200) return res.status(400).json({ error: 'API Key 过长' })
    await updateUserApiMode(req.params.id, api_mode, custom_api_key || '')
    const user = await getUserById(req.params.id)
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode } })
  } catch (err) {
    res.status(500).json({ error: '更新失败' })
  }
})

// ========== 聊天 API ==========

app.post('/api/chat', chatLimiter, optionalUser, async (req, res) => {
  try {
    let { sessionId, content, userId: bodyUserId } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    // 优先使用JWT验证的userId，兜底用body参数（向后兼容）
    const userId = req.userId || bodyUserId
    let user = null
    if (userId) {
      user = await getUserById(userId)
    }

    // ===== 付费校验：免费模型跳过余额检查 =====
    if (!user) {
      return res.status(401).json({ error: '请先登录后再使用', needLogin: true })
    }
    const activeModel = await getActiveAIModel()
    const isModelFree = activeModel?.is_free === 1
    const hasPayment = (user.api_mode === 'custom' && user.custom_api_key) || (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFree))
    if (!hasPayment) {
      return res.status(402).json({
        error: '⚠️ 您的账户余额不足，无法使用咨询服务。\n\n请先充值后再继续对话。',
        needRecharge: true,
        balance: parseFloat(user.balance)
      })
    }

    let apiKeyToUse = null
    let isOfficialMode = false
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFree)) {
      apiKeyToUse = null
      isOfficialMode = !isModelFree // 免费模型不扣费
    }

    let isNew = false
    if (!sessionId) {
      sessionId = uuidv4()
      await createSession(sessionId, user.id)
      isNew = true
    } else {
      const existing = await getSession(sessionId)
      if (!existing) {
        sessionId = uuidv4()
        await createSession(sessionId, user.id)
        isNew = true
      }
    }

    if (isNew) {
      await addMessage(sessionId, 'assistant', LOCAL_WELCOME)
    }

    await addMessage(sessionId, 'user', content)
    await incrementUserMessages(user.id)
    const allMessages = await getMessages(sessionId)

    let responseText
    let usedAI = false
    let tokenInfo = null

    // 有付费能力 → AI 处理所有对话
    const session = await getSession(sessionId)
    const aiCollectedData = session?.collected_data || {}
    const aiResult = await chatWithAI(allMessages, apiKeyToUse, aiCollectedData)
    if (aiResult && aiResult.error) {
      // AI 调用返回了具体错误
      const errMap = {
        'API_KEY_INVALID': '⚠️ **AI 服务配置异常（API Key 无效）**\n\n请联系管理员在后台「系统配置 → AI配置」中更新有效的 API Key。\n\n如果您使用的是自定义 API Key，请在「API设置」中检查您的 Key 是否正确。',
        'API_BALANCE_INSUFFICIENT': '⚠️ **AI API 余额不足**\n\n平台的 AI 服务额度已用完，请联系管理员充值 API 额度。',
        'API_RATE_LIMIT': '⚠️ **请求过于频繁**\n\n当前 AI 服务请求量较大，请稍等几秒后重新发送消息。',
        'NETWORK_ERROR': '⚠️ **网络连接超时**\n\n无法连接到 AI 服务器，请稍后重试。如果持续超时，请联系管理员检查服务器网络。',
      }
      responseText = errMap[aiResult.error] || `⚠️ AI 服务暂时不可用（错误代码: ${aiResult.error}），请稍后再试或联系管理员。`
    } else if (aiResult && aiResult.response) {
      responseText = aiResult.response
      usedAI = true
      // 官方 API 模式扣费
      if (isOfficialMode && user && aiResult.inputTokens !== undefined) {
        const multiplierStr = await getSystemConfig('cost_multiplier')
        const multiplier = parseFloat(multiplierStr || '2')
        tokenInfo = calculateCost(aiResult.inputTokens, aiResult.outputTokens, multiplier)
        const deductResult = await deductBalance(user.id, tokenInfo.cost)
        if (deductResult.success) {
          await incrementUserSpent(user.id, tokenInfo.cost)
          try { await recordTokenUsage({ userId: user.id, sessionId, type: 'chat', inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, totalTokens: aiResult.inputTokens + aiResult.outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
        }
      }
    } else {
      // AI 返回 null（无 API Key 配置或网络彻底断开）
      responseText = `⚠️ **AI 服务未配置**\n\n系统尚未配置 AI API Key，请联系管理员在后台「系统配置 → AI配置」中配置服务商和API Key。`
    }

    await addMessage(sessionId, 'assistant', responseText)

    const updatedBalance = user ? (await getUserById(user.id))?.balance : null

    res.json({
      sessionId, message: responseText, isNew, usedAI,
      balance: updatedBalance,
      tokenUsage: tokenInfo || null,
    })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: '处理消息失败' })
  }
})

// ========== 获取已保存的深度分析结果 ==========
app.get('/api/sessions/:id/deep-analysis-result', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) return res.status(403).json({ error: '无权访问' })
    const result = await getDeepAnalysisResult(req.params.id)
    res.json({ result })
  } catch (err) { res.status(500).json({ error: '获取失败' }) }
})

// ========== 获取会话收集信息 ==========
app.get('/api/sessions/:id/info', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) return res.status(403).json({ error: '无权访问' })
    res.json({ step: session.step, collectedData: session.collected_data || {}, totalSteps: TOTAL_STEPS, fields: INFO_FIELDS.map(f => ({ key: f.key, label: f.label, group: f.group, icon: f.icon })) })
  } catch (err) { res.status(500).json({ error: '获取失败' }) }
})

// ========== 更新单个收集字段（需登录 + 验证会话归属） ==========
app.put('/api/sessions/:id/field', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    // 权限校验：如果会话有 user_id，必须是本人
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: '无权修改此会话' })
    }
    const { key, value } = req.body
    if (!key || key.length > 50) return res.status(400).json({ error: '字段名无效' })
    if (value && value.length > 2000) return res.status(400).json({ error: '字段内容过长' })
    const collectedData = session.collected_data || {}
    const oldValue = collectedData[key] || ''
    // 智能标准化用户编辑的值
    const normalizedValue = normalizeFieldValue(key, value || '', collectedData)
    // 记录变更（仅值真正改变时）
    if (normalizedValue !== oldValue) {
      const fieldDef = INFO_FIELDS.find(f => f.key === key)
      const label = fieldDef?.label || key
      const reason = oldValue && oldValue !== '用户暂未提供' && oldValue !== '⏳待补充'
        ? `用户手动将"${label}"从"${oldValue}"修改为"${normalizedValue}"`
        : `用户手动填写了"${label}"`
      logFieldChange(req.params.id, key, label, oldValue, normalizedValue, 'user_edit', reason).catch(() => {})
    }
    collectedData[key] = normalizedValue
    await updateSession(req.params.id, session.step, collectedData)
    res.json({ success: true, collectedData, normalizedValue, wasNormalized: normalizedValue !== (value || '').trim() })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新失败' }) }
})

// ========== 获取字段变更历史 ==========
app.get('/api/sessions/:id/field-history', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: '无权查看' })
    }
    const fieldKey = req.query.field || null
    const logs = await getFieldChangeLog(req.params.id, fieldKey)
    res.json({ logs })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取变更历史失败' }) }
})

// ========== 获取AI分析摘要（基于已收集数据本地生成，不消耗AI Token） ==========
app.get('/api/sessions/:id/analysis', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    if (session.user_id && req.userId && String(session.user_id) !== String(req.userId)) return res.status(403).json({ error: '无权访问' })
    const d = session.collected_data || {}
    const { matchViolation, matchBuiltInCases, assessRisk, generateMaterialChecklist } = await import('./knowledgeBase.js')
    const { matchIndustry } = await import('./localAI.js')

    // 风险评估
    const risk = assessRisk(d)

    // 违规分析
    const violation = matchViolation(d.violation_reason || '')

    // 行业匹配
    const industry = matchIndustry(d.industry || '')

    // 匹配成功案例
    const matchedCases = matchBuiltInCases(d.problem_type, d.industry, d.violation_reason)

    // 材料清单
    const checklist = generateMaterialChecklist(d)

    // 生成AI分析摘要
    const analysis = {
      risk,
      violation: violation ? {
        key: violation.key,
        description: violation.description,
        estimated_success_rate: violation.estimated_success_rate,
        success_key: violation.success_key,
        appeal_key_points: violation.appeal_key_points,
        required_materials: violation.required_materials,
        common_rejection_reasons: violation.common_rejection_reasons,
      } : null,
      industry: industry ? {
        key: industry.key,
        appealTips: industry.appealTips,
        commonViolations: industry.commonViolations,
        businessModel: industry.businessModel,
      } : null,
      matchedCases: matchedCases.slice(0, 5).map(c => ({
        title: c.title,
        industry: c.industry,
        problem_type: c.problem_type,
        success_summary: c.success_summary,
        appeal_points: c.appeal_points,
      })),
      checklist,
      // 生成简要的申诉策略建议
      strategy: generateStrategy(d, risk, violation, industry),
    }

    res.json(analysis)
  } catch (err) { console.error(err); res.status(500).json({ error: '分析失败' }) }
})

// ========== AI 智能深度分析（基于收集数据 + 聊天记录，统一输出全部分析） ==========
app.get('/api/sessions/:id/deep-analysis', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = session.collected_data || {}
    const filledKeys = Object.keys(d).filter(k => d[k] != null && String(d[k]).trim())
    if (filledKeys.length < 1) return res.json({ deepAnalysis: null, reason: 'not_enough_data' })

    // 同时生成本地分析作为兜底
    const { matchViolation: mv2, matchBuiltInCases: mbc2, assessRisk: ar2, generateMaterialChecklist: gmc2 } = await import('./knowledgeBase.js')
    const { matchIndustry: mi2 } = await import('./localAI.js')
    const localRisk = ar2(d)
    const localViolation = mv2(d.violation_reason || '')
    const localIndustry = mi2(d.industry || '')
    const localCases = mbc2(d.problem_type, d.industry, d.violation_reason)
    const localChecklist = gmc2(d)
    const localStrategy = generateStrategy(d, localRisk, localViolation, localIndustry)

    const localAnalysis = {
      risk: localRisk,
      violation: localViolation ? { key: localViolation.key, description: localViolation.description, estimated_success_rate: localViolation.estimated_success_rate, success_key: localViolation.success_key, appeal_key_points: localViolation.appeal_key_points, required_materials: localViolation.required_materials, common_rejection_reasons: localViolation.common_rejection_reasons } : null,
      industry: localIndustry ? { key: localIndustry.key, appealTips: localIndustry.appealTips, commonViolations: localIndustry.commonViolations, businessModel: localIndustry.businessModel } : null,
      matchedCases: localCases.slice(0, 5).map(c => ({ title: c.title, industry: c.industry, problem_type: c.problem_type, success_summary: c.success_summary, appeal_points: c.appeal_points })),
      checklist: localChecklist,
      strategy: localStrategy,
    }

    // 获取完整聊天记录（包括AI回复，提取上下文）
    const allMessages = await getMessages(req.params.id)
    const chatPairs = allMessages.slice(-40).map(m => ({
      role: m.role === 'user' ? '客户' : '顾问',
      content: m.content?.length > 300 ? m.content.slice(0, 300) + '...' : m.content,
    }))

    // ===== 计费逻辑：会员免费(月100次)，免费用户按token收费 =====
    let apiKey = null
    let isMemberFree = false
    let chargeUser = null
    let isOfficialMode = false
    // 优先使用JWT验证的userId，兜底用query参数（向后兼容）
    const userId = req.userId || req.query.userId
    if (userId) {
      const user = await getUserById(userId)
      chargeUser = user
      if (user?.api_mode === 'custom' && user.custom_api_key) {
        apiKey = user.custom_api_key
        // 自定义key用户：检查月度配额
        const quota = await checkDeepAnalysisQuota(user.id)
        isMemberFree = quota.isMember && quota.allowed
      } else if (user?.api_mode === 'official') {
        const activeModelDA = await getActiveAIModel()
        const isModelFreeDA = activeModelDA?.is_free === 1
        const quota = await checkDeepAnalysisQuota(user.id)
        if (quota.isMember && quota.allowed) {
          // 会员用户且未超月限额：免费
          apiKey = (await getAIConfig()).apiKey
          isMemberFree = true
          isOfficialMode = true
        } else if (quota.isMember && !quota.allowed) {
          // 会员但已用完本月额度
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'quota_exceeded', quota: { used: quota.used, limit: quota.limit } })
        } else if (parseFloat(user.balance) > 0 || isModelFreeDA) {
          // 非会员但有余额 或 使用免费模型：允许
          apiKey = (await getAIConfig()).apiKey
          isOfficialMode = !isModelFreeDA // 免费模型不扣费
        } else {
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_balance' })
        }
      }
    }
    if (!apiKey) {
      // 没有用户或用户无付费能力 → 不允许使用系统key白嫖
      if (!chargeUser) return res.json({ deepAnalysis: null, localAnalysis, reason: 'login_required' })
      // 自定义Key用户但未配置Key → 不应回退到系统Key
      if (chargeUser.api_mode === 'custom' && !chargeUser.custom_api_key) {
        return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_custom_key' })
      }
      apiKey = (await getAIConfig()).apiKey
    }
    if (!apiKey) return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_api_key' })

    // ===== 构建超详细分析 prompt =====
    const fieldLabels = {
      industry: '业务类型', business_model: '经营模式',
      problem_type: '处罚类型', violation_reason: '违规原因',
      merchant_id: '商户号', merchant_name: '商户名称',
      company_name: '公司全称', license_no: '统一社会信用代码',
      legal_name: '法人姓名', legal_id_last4: '身份证后四位',
      complaint_status: '投诉情况', refund_policy: '退款政策',
      bank_name: '开户银行', bank_account_last4: '结算账户后四位',
      contact_phone: '联系电话', appeal_history: '申诉历史',
    }

    // 收集信息区
    let dataSection = '## 一、客户基础信息（系统已收集）\n\n'
    const missingFields = []
    for (const [key, label] of Object.entries(fieldLabels)) {
      if (d[key] != null && String(d[key]).trim()) {
        dataSection += `- **${label}**：${d[key]}\n`
      } else {
        missingFields.push(label)
      }
    }
    if (missingFields.length > 0) {
      dataSection += `\n以下信息尚未收集：${missingFields.join('、')}\n`
    }

    // 聊天记录区（完整对话，包含AI回复）
    let chatSection = '\n\n## 二、完整对话记录\n\n请仔细阅读以下对话，从中提取客户透露的所有有价值信息（比如客户可能在回答问题时额外提到了自己的经营细节、遇到的具体困难、之前尝试过什么方法等）。\n\n'
    if (chatPairs.length > 0) {
      chatPairs.forEach((m, i) => {
        chatSection += `**${m.role}**：${m.content}\n\n`
      })
    } else {
      chatSection += '（暂无对话记录）\n'
    }

    // 行业知识库注入（针对匹配到的行业）
    let industryKnowledge = ''
    if (localIndustry) {
      industryKnowledge = `\n\n## 三、行业专业知识（${localIndustry.key}行业）\n\n` +
        `- **常见违规类型**：${localIndustry.commonViolations.join('、')}\n` +
        `- **申诉要点**：${localIndustry.appealTips}\n` +
        `- **典型经营模式**：${localIndustry.businessModel}\n` +
        `\n请结合以上${localIndustry.key}行业特点，给出针对性分析。比如：\n` +
        `- 餐饮行业 → 围绕食品安全许可证、门店照片、外卖平台数据\n` +
        `- 财税服务 → 围绕代理记账许可证、服务合同、客户服务记录\n` +
        `- 电商 → 围绕店铺后台数据、物流发货记录、进货合同\n` +
        `- 科技/SaaS → 围绕软件著作权、服务合同、客户验收报告\n` +
        `- 教育培训 → 围绕办学许可证、课程大纲、学员评价、退费政策\n`
    }

    // 违规知识库注入（针对匹配到的违规类型）
    let violationKnowledge = ''
    if (localViolation) {
      violationKnowledge = `\n\n## 四、违规类型专业知识（${localViolation.key}）\n\n` +
        `- **严重程度**：${localViolation.severity}/5\n` +
        `- **定义**：${localViolation.description}\n` +
        `- **预估成功率**：${localViolation.estimated_success_rate}\n` +
        `- **申诉关键**：${localViolation.success_key}\n` +
        `- **申诉要点**：\n${localViolation.appeal_key_points.map(p => `  - ${p}`).join('\n')}\n` +
        `- **需要准备的材料**：${localViolation.required_materials.join('、')}\n` +
        `- **常见驳回原因**：${localViolation.common_rejection_reasons.join('、')}\n`
    }

    // 成功案例注入
    let casesSection = ''
    if (localCases.length > 0) {
      casesSection = '\n\n## 五、相似成功案例参考\n\n'
      localCases.slice(0, 3).forEach((c, i) => {
        casesSection += `**案例${i + 1}：${c.title}**\n` +
          `- 行业：${c.industry} | 处罚：${c.problem_type} | 违规：${c.violation_reason}\n` +
          `- 成功摘要：${c.success_summary}\n` +
          `- 关键策略：${c.key_strategy}\n` +
          `- 申诉要点：${c.appeal_points.join('；')}\n` +
          `- 时间线：${c.timeline}\n\n`
      })
    }

    const merchantId = d.merchant_id || '未提供'
    const merchantName = d.merchant_name || '未提供'

    const analysisPrompt = `你是微信商户号申诉实战专家，处理过上千起各类商户申诉案件。现在请根据以下客户信息，输出一份**可以直接照着操作的实战分析报告**。

${dataSection}${chatSection}${industryKnowledge}${violationKnowledge}${casesSection}

---

# 输出要求

直接输出格式化中文文本（不要JSON、不要代码块）。**所有内容必须针对该客户的具体行业（${d.industry || '未知'}）、违规原因（${d.violation_reason || '未知'}）、处罚类型（${d.problem_type || '未知'}）来写，禁止输出通用模板。**

严格按以下格式输出：

## 案件概况

用2-3句话概括：${merchantName}（商户号${merchantId}）是做什么的、遇到了什么处罚、违规原因是什么。从对话记录中提取客户提到的关键细节（处罚时间、之前尝试过什么、紧急程度等）一并写出。

## 风险评估

- **难度等级**：简单/中等/较难/困难/极难
- **难度评分**：X/100
- **预估成功率**：XX-XX%
- **核心难点**：
  - 难点1（针对该客户具体情况）
  - 难点2
  - 难点3

## 资质要求

根据客户的行业类型「${d.industry || '未知'}」和违规原因「${d.violation_reason || '未知'}」，列出申诉必须具备的资质证照。每项写清楚：资质名称、去哪里办/获取、是否该客户必须有。

### 基础资质（所有商户必备）
- **营业执照**：要求四角完整、字迹清晰的原件照片，确保经营范围覆盖实际业务
- **法人身份证**：正反面照片 + 法人手持身份证半身照

### 行业资质（${d.industry || ''}行业需要）
根据该客户所在的具体行业，列出行业特有的必需资质。例如：
- 餐饮 → 食品经营许可证、卫生许可证
- 教育 → 办学许可证、教师资格证
- 医疗 → 医疗机构执业许可证
- 电商 → 进货合同/供应商资质
- 科技/SaaS → 软件著作权、ICP备案
- 金融 → 相关金融业务许可证
请只列该客户行业实际需要的，不要列不相关的。

### 特殊资质（该违规原因需要）
根据违规原因额外需要的资质或证明文件。

## 证据链构建

**这是申诉成功的关键。** 审核人员需要看到一条完整的证据链来证明经营合法性。请根据客户情况，构建一条从"资质→经营→交易→交付"的完整证据链。

### 第一层：主体合法性
- 具体要准备什么来证明商户主体合法（针对该客户）

### 第二层：经营真实性
- 具体要准备什么来证明有真实经营场景（针对该客户的行业和经营模式）

### 第三层：交易真实性
- 具体要准备什么来证明交易是真实的（举出3-5笔订单应该怎么提供完整链路）

### 第四层：问题已整改
- 针对该客户的违规原因「${d.violation_reason || ''}」，具体要准备什么来证明问题已解决
${(d.violation_reason || '').includes('纠纷') || (d.violation_reason || '').includes('投诉') ? '- 重点：每笔投诉的退款凭证、消费者撤诉截图、完善的售后政策' : ''}
${(d.violation_reason || '').includes('跨类目') || (d.violation_reason || '').includes('类目') ? '- 重点：已下架不符商品截图、类目变更申请、营业执照经营范围证明' : ''}
${(d.violation_reason || '').includes('套现') ? '- 重点：每笔大额订单的完整链路（下单→发货→物流→签收）' : ''}
${(d.violation_reason || '').includes('欺诈') || (d.violation_reason || '').includes('售假') ? '- 重点：品牌授权书、质检报告、正品进货凭证' : ''}
${(d.violation_reason || '').includes('分销') ? '- 重点：分销系统后台截图证明仅一级分佣、无入门费' : ''}

## 材料清单

按分类列出所有需要准备的具体材料。每项标注【必需】或【建议】，写清楚怎么准备、去哪获取、格式要求（照片/截图/文档/PDF）。

### 证件资质类
- 【必需/建议】材料名：获取方式、格式要求、注意事项

### 经营证明类
- 根据该客户行业列出经营场景证明材料

### 交易凭证类
- 列出需要准备的订单、物流、发货相关凭证

### 整改证据类
- 针对该违规原因需要的整改证明材料
${(d.problem_type || '').includes('冻结') || (d.problem_type || '').includes('延迟') ? `
### 资金解冻类
- 结算账户开户信息（银行：${d.bank_name || '待提供'}，后四位：${d.bank_account_last4 || '待提供'}）
- 交易流水明细导出
- 资金来源合法性说明` : ''}

## 风控触发逆向推演

这是本报告最有价值的部分。请站在微信风控系统的角度，逆向推演：
1. **该商户为什么被标记？** — 风控系统可能检测到了什么异常信号？（如交易模式突变、投诉率飙升、交易对手集中度过高等）
2. **触发的是哪一层风控？** — 是规则引擎（硬性规则）还是模型层（行为模式异常）还是人工复核（举报/投诉触发）？
3. **审核人员最关心什么？** — 基于该违规类型，人工审核时重点看哪些证据？
4. **我们的反驳策略** — 针对风控系统可能的判定逻辑，用什么证据来逐一反驳

## 行动计划

按时间顺序给出具体步骤，每步写清楚：做什么、怎么做、去哪做、预计耗时。

### 第一阶段：立即执行（D0，今天）
- 具体要做的第一件事（最紧急的）
- 如有未处理投诉，必须先处理

### 第二阶段：准备材料（D1-D3）
- 按材料清单逐一准备，标注优先级
- 写清楚每份材料去哪获取、什么格式

### 第三阶段：提交申诉（D3-D4）
- 通过什么渠道提交（商户平台/商家助手/95017）
- 最佳提交时间：工作日上午9-11点
- 材料组织顺序建议

### 第四阶段：跟进催审（D5-D7）
- 提交后第3个工作日拨打95017转3催审
- 话术和注意事项

### 第五阶段：二次申诉预案（如被驳回）
- 常见驳回原因及对应的补充方案
- 二次申诉的时间间隔建议（至少间隔3-5天）
- 增量证据的准备方向

## 申诉话术

给出拨打95017和提交申诉时可以直接使用的话术模板。

### 电话话术（95017转3）
**首次致电（提交前摸底）**：
"您好，我是商户号${merchantId}的${d.legal_name || '法人'}，我们商户因${d.violation_reason || '违规原因'}被${d.problem_type || '处罚'}。我现在正在准备申诉材料，想请问一下具体的违规详情和需要准备哪些材料？以便我针对性准备。"

**催审致电（提交后3天）**：
"您好，我是商户号${merchantId}，我在X月X日通过商户平台提交了申诉材料，包括营业执照、交易凭证、整改说明等完整材料。想请问一下目前审核进度如何？"

### 申诉信核心内容
给出一段300字以内的申诉信核心段落，包含五个要素：
1. 商户身份介绍（公司名+商户号+业务简述）
2. 对违规判定的回应（承认问题/解释误判）
3. 整改措施说明（已做了什么、后续计划）
4. 证据概述（准备了哪些证明材料）
5. 恳请恢复（表达诚意和承诺）
内容必须针对该客户的具体行业「${d.industry || ''}」和违规原因「${d.violation_reason || ''}」来写，不要使用通用模板。

## 申诉最佳时机

根据该客户的情况，给出申诉时机建议：
- 现在是否适合立即申诉？还是需要先做某些准备？
- 如果有未处理投诉，建议先处理完再申诉（投诉率是审核重点）
- 如果之前被驳回过，建议间隔多久？需要准备什么增量证据？
- 最佳提交时间段：工作日上午9-11点（审核人员工作效率最高）

## 报价参考

根据该案件的实际难度和工作量，给出市场参考价格：
- 本案件的难度等级和对应的市场服务费用区间
- 说明本次AI咨询生成的报告和材料可免费自行使用
- 如需人工1对1辅导，建议的费用范围

---

# 硬性要求
1. **必须引用客户具体信息**：商户号${merchantId}、名称${merchantName}、行业${d.industry || ''}、违规原因${d.violation_reason || ''}。
2. **必须引用对话记录内容**：客户在对话中提到的任何细节都要体现在分析中。
3. **资质和材料必须针对该行业**：不要列与该客户行业无关的资质。
4. **每项材料都要说清楚怎么准备**：不要只说"准备营业执照"，要说"营业执照原件照片，四角完整、字迹清晰、要能看到经营范围"。
5. **证据链必须完整**：从主体→经营→交易→整改，形成闭环。
6. **风控逆向推演必须具体**：不要泛泛而谈，要基于该客户的具体数据推理。
7. **所有建议可直接执行**：杜绝空话套话，每条建议都要有具体操作步骤。
8. **行动计划必须带时间线**：让客户知道每一步什么时候做。`

    // ===== SSE 流式输出 =====
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // 先发送本地分析（立即可用）
    res.write(`data: ${JSON.stringify({ type: 'local', localAnalysis })}\n\n`)

    const aiCfg = await getAIConfig()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const apiRes = await fetch(aiCfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || aiCfg.apiKey}` },
      body: JSON.stringify({ model: aiCfg.model, messages: [{ role: 'user', content: analysisPrompt }], temperature: 0.5, max_tokens: 6000, stream: true, stream_options: { include_usage: true } }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!apiRes.ok) {
      console.error(`[${aiCfg.provider}] analysis stream error:`, apiRes.status)
      res.write(`data: ${JSON.stringify({ type: 'error', reason: `api_error_${apiRes.status}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // 流式读取 AI 响应
    let fullContent = ''
    let inputTokens = 0, outputTokens = 0
    const reader = apiRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue
          try {
            const chunk = JSON.parse(payload)
            const rawDelta = chunk.choices?.[0]?.delta?.content || ''
            if (rawDelta) {
              fullContent += rawDelta
              const delta = stripEmoji(rawDelta)
              if (delta) res.write(`data: ${JSON.stringify({ type: 'chunk', text: delta })}\n\n`)
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens
              outputTokens = chunk.usage.completion_tokens || outputTokens
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      console.error('Stream read error:', streamErr.message)
    }

    // 保存分析结果到数据库
    if (fullContent.trim()) {
      try { await saveDeepAnalysisResult(req.params.id, fullContent) } catch (e) { console.error('Save analysis error:', e.message) }
    }

    // 计费结算
    let billing = { type: 'free', cost: 0 }
    if (userId && chargeUser) {
      await incrementDeepAnalysisCount(chargeUser.id)
      if (isMemberFree) {
        billing = { type: 'member_free', cost: 0, message: '会员免费额度' }
      } else if (isOfficialMode) {
        const multiplierStr = await getSystemConfig('cost_multiplier')
        const multiplier = parseFloat(multiplierStr || '2')
        const tokenInfo = calculateCost(inputTokens, outputTokens, multiplier)
        const deductResult = await deductBalance(chargeUser.id, tokenInfo.cost)
        if (deductResult.success) {
          await incrementUserSpent(chargeUser.id, tokenInfo.cost)
          try { await recordTokenUsage({ userId: chargeUser.id, sessionId: req.params.id, type: 'deep_analysis', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
        }
        const updatedUser = await getUserById(chargeUser.id)
        billing = { type: 'token_charge', cost: tokenInfo.cost, balance: updatedUser?.balance, tokenInfo }
      }
    }

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', billing, tokens: { input: inputTokens, output: outputTokens } })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Deep analysis error:', err.message)
    try {
      if (!res.headersSent) {
        res.json({ deepAnalysis: null, reason: 'error', message: err.message })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', reason: 'error', message: err.message })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } catch { res.end() }
  }
})

function generateStrategy(d, risk, violation, industry) {
  const strategies = []
  const pt = (d.problem_type || '').toLowerCase()
  const vr = (d.violation_reason || '').toLowerCase()
  const ah = (d.appeal_history || '').toLowerCase()

  // 处罚类型建议
  if (pt.includes('冻结') || pt.includes('延迟')) {
    strategies.push({ type: 'warning', text: '资金冻结案件需提供结算账户信息配合验证，建议拨打95017转3催促审核' })
  }
  if (pt.includes('封禁')) {
    strategies.push({ type: 'warning', text: '商户号封禁是最严重处罚，需准备全套材料，可能需要法人视频认证' })
  }

  // 违规原因建议
  if (violation) {
    strategies.push({ type: 'info', text: `违规类型「${violation.key}」预估成功率：${violation.estimated_success_rate}` })
    strategies.push({ type: 'tip', text: `申诉关键：${violation.success_key}` })
  }

  // 行业建议
  if (industry) {
    strategies.push({ type: 'info', text: `${industry.key}行业申诉要点：${industry.appealTips}` })
  }

  // 申诉历史
  if (ah.includes('驳回') || ah.includes('失败') || ah.includes('拒绝')) {
    strategies.push({ type: 'warning', text: '有被驳回记录，建议先打95017转3查询具体驳回原因，针对性补充材料' })
    strategies.push({ type: 'tip', text: '二次申诉材料须比首次更详细，间隔3-5天再提交' })
  }

  // 投诉处理
  const cs = (d.complaint_status || '').toLowerCase()
  if (cs.includes('有') || cs.includes('投诉') || cs.includes('未处理')) {
    strategies.push({ type: 'warning', text: '有未处理投诉会严重影响申诉成功率，建议先100%处理完投诉再申诉' })
  }

  // 通用建议
  strategies.push({ type: 'tip', text: '订单号必须是微信支付订单号（4开头28位），不是商户系统订单号' })
  strategies.push({ type: 'tip', text: '补充资料通道一般只开放24小时，请提前准备好材料' })

  return strategies
}

// ========== 服务端文本清理（所有发给前端的文本都经过此函数） ==========
function stripEmoji(text) {
  if (!text) return text
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[☐✅❓⚡⏳]/g, '')
    .replace(/^[ \t]*[•·]\s*/gm, '- ')              // 行首 ·• 转成标准 markdown 列表
    .replace(/[•·]/g, '')                             // 行内残余 ·• 直接删除
    .replace(/  +/g, ' ')
    .replace(/^ /gm, '')
}

// ========== 模拟打字效果的 SSE 工具函数 ==========
async function simulateTypingSSE(res, text, chunkSize = 3, delayMs = 18) {
  const cleaned = stripEmoji(text)
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    const chunk = cleaned.slice(i, i + chunkSize)
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
    await new Promise(r => setTimeout(r, delayMs))
  }
}

// ========== AI 流式转发工具函数 ==========
async function pipeAIStream(res, streamResult, { isOfficialMode, user, sessionId, usageType }) {
  const reader = streamResult.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  let usageHandled = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const rawDelta = parsed.choices?.[0]?.delta?.content || ''
        if (rawDelta) {
          fullContent += rawDelta
          const delta = stripEmoji(rawDelta)
          if (delta) res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`)
        }
        if (parsed.usage && !usageHandled) {
          usageHandled = true
          const inputTokens = parsed.usage.prompt_tokens || streamResult.inputTokens
          const outputTokens = parsed.usage.completion_tokens || 0
          if (isOfficialMode && user) {
            const multiplierStr = await getSystemConfig('cost_multiplier')
            const multiplier = parseFloat(multiplierStr || '2')
            const tokenInfo = calculateCost(inputTokens, outputTokens, multiplier)
            const deductResult = await deductBalance(user.id, tokenInfo.cost)
            if (deductResult.success) await incrementUserSpent(user.id, tokenInfo.cost)
            const updatedBalance = (await getUserById(user.id))?.balance
            res.write(`data: ${JSON.stringify({ type: 'usage', tokenUsage: tokenInfo, balance: updatedBalance })}\n\n`)
            // 记录Token消费明细
            try { await recordTokenUsage({ userId: user.id, sessionId, type: usageType || 'chat', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
          }
        }
      } catch {}
    }
  }

  // 本地估算扣费兜底
  if (fullContent && isOfficialMode && user && !usageHandled) {
    const { countTokens } = await import('./tokenizer.js')
    const outputTokens = countTokens(fullContent)
    const multiplierStr = await getSystemConfig('cost_multiplier')
    const multiplier = parseFloat(multiplierStr || '2')
    const tokenInfo = calculateCost(streamResult.inputTokens, outputTokens, multiplier)
    const deductResult = await deductBalance(user.id, tokenInfo.cost)
    if (deductResult.success) await incrementUserSpent(user.id, tokenInfo.cost)
    const updatedBalance = (await getUserById(user.id))?.balance
    res.write(`data: ${JSON.stringify({ type: 'usage', tokenUsage: tokenInfo, balance: updatedBalance })}\n\n`)
    try { await recordTokenUsage({ userId: user.id, sessionId, type: usageType || 'chat', inputTokens: streamResult.inputTokens, outputTokens, totalTokens: streamResult.inputTokens + outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
  }

  return fullContent
}

// ========== 流式聊天 SSE ==========
app.post('/api/chat/stream', chatLimiter, optionalUser, async (req, res) => {
  try {
    const { content, sessionId: inSessionId, userId: bodyUserId } = req.body
    if (!content?.trim()) return res.status(400).json({ error: '消息不能为空' })
    if (content.length > 5000) return res.status(400).json({ error: '消息过长，请缩短后重试' })

    // 优先使用JWT验证的userId，兜底用body参数（向后兼容）
    const userId = req.userId || bodyUserId
    const user = userId ? await getUserById(userId) : null

    // ===== 付费校验：免费模型跳过余额检查 =====
    if (!user) {
      return res.status(401).json({ error: '请先登录后再使用', needLogin: true })
    }
    const activeModelStream = await getActiveAIModel()
    const isModelFreeStream = activeModelStream?.is_free === 1
    const hasPayment = (user.api_mode === 'custom' && user.custom_api_key) || (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFreeStream))
    if (!hasPayment) {
      return res.status(402).json({
        error: '⚠️ 您的账户余额不足，无法使用咨询服务。\n\n请先充值后再继续对话。',
        needRecharge: true,
        balance: parseFloat(user.balance)
      })
    }

    // 会话处理（验证 session 存在性，防止刷新后丢失历史）
    let sessionId = inSessionId
    let isNew = false
    if (!sessionId) {
      sessionId = uuidv4()
      await createSession(sessionId, userId || null)
      isNew = true
    } else {
      // 验证 session 是否真实存在（防止 localStorage 中存了已删除的 sessionId）
      const existing = await getSession(sessionId)
      if (!existing) {
        sessionId = uuidv4()
        await createSession(sessionId, userId || null)
        isNew = true
      } else if (existing.user_id && userId && String(existing.user_id) !== String(userId)) {
        // 防止用户A写入用户B的会话
        sessionId = uuidv4()
        await createSession(sessionId, userId)
        isNew = true
      }
    }

    // 新会话：保存欢迎消息到数据库（刷新后能恢复完整历史）
    if (isNew) {
      await addMessage(sessionId, 'assistant', LOCAL_WELCOME)
    }

    await addMessage(sessionId, 'user', content)
    if (user) {
      await incrementUserMessages(user.id)
      await updateUserActivity(user.id)
    }

    // 获取会话状态
    const session = await getSession(sessionId)
    const currentStep = session?.step || 0
    const collectedData = session?.collected_data || {}

    // 检查付费能力（AI报告阶段需要）
    let apiKeyToUse = null
    let canUseAI = false
    let isOfficialMode = false
    if (user) {
      if (user.api_mode === 'custom' && user.custom_api_key) {
        apiKeyToUse = user.custom_api_key
        canUseAI = true
      } else if (user.api_mode === 'official') {
        if (parseFloat(user.balance) > 0 || isModelFreeStream) {
          apiKeyToUse = null
          canUseAI = true
          isOfficialMode = !isModelFreeStream // 免费模型不扣费
        }
      }
    }

    // SSE 头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // 防止客户端断开后继续写入死连接
    let clientDisconnected = false
    req.on('close', () => { clientDisconnected = true })
    const safeSend = (data) => { if (!clientDisconnected && !res.writableEnded) res.write(data) }

    // 先发送 sessionId + 当前收集进度
    safeSend(`data: ${JSON.stringify({ type: 'start', sessionId, isNew, step: currentStep, totalSteps: TOTAL_STEPS })}\n\n`)

    // ===== AI-First: 用 _collection_complete 标记判断阶段 =====
    const isCollectionDone = collectedData._collection_complete === true
    if (!isCollectionDone) {
      // ===== AI-First: 所有消息统一由 AI 驱动对话 + 并行字段提取 =====
      if (!canUseAI) {
        const errMsg = '⚠️ 余额不足，无法使用AI咨询服务。请充值后继续。'
        safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg, needRecharge: true })}\n\n`)
      } else {
        try {
          const stepStartTime = Date.now()
          let updatedData = { ...collectedData }
          let updatedStep = currentStep

          // 构建收集上下文
          const filledFields = Object.entries(updatedData).filter(([k, v]) => !k.startsWith('_') && v && String(v).trim() && v !== '用户暂未提供' && v !== '⏳待补充')
          const filledCount = filledFields.length
          const collectionCtx = buildCollectionContext(updatedData, currentStep)
          const dynamicFields = updatedData._dynamic_fields || []
          const unfilled = dynamicFields.filter(df => !updatedData[df.key] || !String(updatedData[df.key]).trim()).map(df => `${df.label}: ${df.question || df.hint || ''}`).join('\n')
          const dynamicNote = unfilled ? `\n\n[行业专属信息待收集]\n${unfilled}` : ''

          const enrichedData = {
            ...updatedData,
            _current_step: `已收集${filledCount}项`,
            _collection_context: collectionCtx,
            _instruction: buildCollectionInstruction('', dynamicNote)
          }

          // 并行：AI字段提取 + 流式对话回复
          const allMessages = await getMessages(sessionId)
          const extractionPromise = extractFieldsWithAI(content, updatedData, currentStep, apiKeyToUse, allMessages.slice(-6)).catch(e => {
            console.error('AI extraction error (non-fatal):', e.message)
            return null
          })

          // 流式回复（用户秒看到内容）
          const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, enrichedData)
          const firstByteMs = Date.now() - stepStartTime
          safeSend(`data: ${JSON.stringify({ type: 'timing', firstByteMs })}\n\n`)

          const fullContent = await pipeAIStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'chat_collection' })
          if (fullContent) await addMessage(sessionId, 'assistant', fullContent)

          const totalMs = Date.now() - stepStartTime
          safeSend(`data: ${JSON.stringify({ type: 'timing', totalMs, firstByteMs })}\n\n`)

          // 处理后台AI提取结果
          const aiResult = await extractionPromise
          if (aiResult && Object.keys(aiResult.extracted).length > 0) {
            const fieldValidators = {
              merchant_id: v => /^\d{8,12}$/.test(v.replace(/\s/g, '')),
              legal_id_last4: v => /^\d{3}[\dxX]$/.test(v.replace(/\s/g, '')),
              bank_account_last4: v => /^\d{4}$/.test(v.replace(/\s/g, '')),
              contact_phone: v => /^1[3-9]\d{9}$/.test(v.replace(/[\s\-]/g, '')),
              license_no: v => /^[0-9A-Z]{15,18}$/i.test(v.replace(/\s/g, '')),
              business_model: v => v.length <= 30,
              problem_type: v => v.length <= 20,
              industry: v => v.length <= 20,
              violation_reason: v => v.length <= 60,
              merchant_name: v => v.length <= 40,
              company_name: v => v.length <= 50 && !/^(就是|哎呀|那个|反正)/.test(v),
              legal_name: v => v.length >= 2 && v.length <= 10 && /^[\u4e00-\u9fff·]+$/.test(v),
              bank_name: v => v.length <= 20 && /银行|信用社|支付宝|财付通/.test(v) && !/[？?怎么吗呢呀吧]/.test(v),
              complaint_status: v => v.length <= 50 && !/[？?]$/.test(v.trim()),
              refund_policy: v => v.length <= 80 && !/[？?]$/.test(v.trim()),
              appeal_history: v => v.length <= 60 && !/[？?]$/.test(v.trim()),
            }
            const aiInfoUpdates = []
            const allFieldDefs = [...INFO_FIELDS, ...(updatedData._dynamic_fields || [])]
            for (const [key, value] of Object.entries(aiResult.extracted)) {
              let fieldDef = allFieldDefs.find(f => f.key === key)
              if (!fieldDef && key && !key.startsWith('_') && value) {
                const v = String(value).trim()
                if (v.length > 0 && v.length <= 100) fieldDef = { key, label: key, group: '补充信息', icon: '📌', dynamic: true }
              }
              if (!fieldDef) continue
              const v = String(value).trim()
              if (!v) continue
              const validator = fieldValidators[key]
              if (validator && !validator(v)) continue
              const existing = updatedData[key]
              const shouldUpdate = aiResult.correction || !existing || existing === '用户暂未提供' || existing === '⏳待补充'
              if (shouldUpdate) {
                const oldVal = existing || ''
                const source = (existing && existing !== '用户暂未提供' && existing !== '⏳待补充') ? 'ai_correction' : 'ai_extract'
                const reason = source === 'ai_correction'
                  ? `AI根据用户最新描述将"${fieldDef.label}"从"${oldVal}"更正为"${v}"`
                  : `AI从用户对话中识别并提取了"${fieldDef.label}"`
                logFieldChange(sessionId, key, fieldDef.label, oldVal, v, source, reason).catch(() => {})
                updatedData[key] = v
                aiInfoUpdates.push({ key, label: fieldDef.label, value: v, group: fieldDef.group || '补充信息', icon: fieldDef.icon || '📌' })
              }
            }
            if (aiInfoUpdates.length > 0) {
              updatedStep = findNextUnfilledStep(0, updatedData)
              if (updatedStep >= TOTAL_STEPS) updatedStep = TOTAL_STEPS
              for (const upd of aiInfoUpdates) {
                safeSend(`data: ${JSON.stringify({ type: 'info_update', ...upd, step: updatedStep, totalSteps: TOTAL_STEPS })}\n\n`)
              }
              await updateSession(sessionId, updatedStep, updatedData)
              console.log(`[AI提取成功] session=${sessionId} 提取${aiInfoUpdates.length}个字段, step→${updatedStep}`)
            }
            // 扣费
            if (aiResult.inputTokens || aiResult.outputTokens) {
              const multiplierStr = await getSystemConfig('cost_multiplier')
              const multiplier = parseFloat(multiplierStr || '2')
              const tokenInfo = calculateCost(aiResult.inputTokens, aiResult.outputTokens, multiplier)
              if (isOfficialMode && tokenInfo.cost > 0) {
                await deductBalance(user.id, tokenInfo.cost)
                await incrementUserSpent(user.id, tokenInfo.cost)
                try { await recordTokenUsage({ userId: user.id, sessionId, type: 'ai_extraction', inputTokens: aiResult.inputTokens, outputTokens: aiResult.outputTokens, totalTokens: aiResult.inputTokens + aiResult.outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
              }
            }
          }

          // 行业自适应字段扩展（当 industry 首次被识别时触发）
          if (updatedData.industry && !updatedData._dynamic_fields) {
            try {
              const expansion = await expandFieldsForIndustry(updatedData.industry, updatedData.problem_type, updatedData, apiKeyToUse)
              if (expansion && expansion.fields?.length > 0) {
                updatedData._dynamic_fields = expansion.fields
                updatedData._industry_tip = expansion.industryTip
                await updateSession(sessionId, updatedStep, updatedData)
                for (const df of expansion.fields) {
                  safeSend(`data: ${JSON.stringify({ type: 'info_update', key: df.key, label: df.label, value: '', group: df.group || '行业信息', icon: df.icon || '🏭', step: updatedStep, totalSteps: TOTAL_STEPS, dynamic: true })}\n\n`)
                }
                console.log(`[行业扩展] 为 ${updatedData.industry} 生成 ${expansion.fields.length} 个动态字段`)
                if (expansion.inputTokens || expansion.outputTokens) {
                  const multiplierStr = await getSystemConfig('cost_multiplier')
                  const multiplier = parseFloat(multiplierStr || '2')
                  const tokenInfo = calculateCost(expansion.inputTokens, expansion.outputTokens, multiplier)
                  if (isOfficialMode && tokenInfo.cost > 0) {
                    await deductBalance(user.id, tokenInfo.cost)
                    await incrementUserSpent(user.id, tokenInfo.cost)
                    try { await recordTokenUsage({ userId: user.id, sessionId, type: 'industry_expansion', inputTokens: expansion.inputTokens, outputTokens: expansion.outputTokens, totalTokens: expansion.inputTokens + expansion.outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
                  }
                }
              }
            } catch (e) { console.error('Industry expansion error (non-fatal):', e.message) }
          }

          // 完成度检查（有核心字段且已收集8+项时触发）
          const postFilledFields = Object.entries(updatedData).filter(([k, v]) => !k.startsWith('_') && v && String(v).trim() && v !== '用户暂未提供' && v !== '⏳待补充')
          const hasCore = updatedData.industry && updatedData.problem_type && updatedData.violation_reason
          if (hasCore && postFilledFields.length >= 8) {
            try {
              const assessment = await assessCompletenessWithAI(updatedData, apiKeyToUse)
              safeSend(`data: ${JSON.stringify({ type: 'completeness', score: assessment.score, ready: assessment.ready })}\n\n`)
              if (assessment.inputTokens || assessment.outputTokens) {
                const multiplierStr = await getSystemConfig('cost_multiplier')
                const multiplier = parseFloat(multiplierStr || '2')
                const tokenInfo = calculateCost(assessment.inputTokens, assessment.outputTokens, multiplier)
                if (isOfficialMode && tokenInfo.cost > 0) {
                  await deductBalance(user.id, tokenInfo.cost)
                  await incrementUserSpent(user.id, tokenInfo.cost)
                  try { await recordTokenUsage({ userId: user.id, sessionId, type: 'completeness_check', inputTokens: assessment.inputTokens, outputTokens: assessment.outputTokens, totalTokens: assessment.inputTokens + assessment.outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
                }
              }
              if (assessment.ready && assessment.score >= 75) {
                updatedData._collection_complete = true
                await updateSession(sessionId, updatedStep, updatedData)
                safeSend(`data: ${JSON.stringify({ type: 'completeness', score: assessment.score, ready: true, triggerReport: true })}\n\n`)
              }
            } catch (e) { console.error('Completeness check error (non-fatal):', e.message) }
          }
        } catch (err) {
          console.error('AI collection error:', err.message)
          // 实时fallback：标记故障+尝试自动切换+重试
          if (!apiKeyToUse) { // 官方模式才fallback，自定义Key用户不管
            const active = await getActiveAIModel()
            if (active) await updateModelHealth(active.id, { status: 'error', error: err.message })
            const sw = await autoSwitchIfNeeded()
            if (sw?.switched) {
              safeSend(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n⚡ 模型故障，已自动切换到 ${sw.model}，正在重试...\n\n` })}\n\n`)
              try {
                const retryMessages = await getMessages(sessionId)
                const retryStream = await streamChatWithAI(retryMessages, null, collectedData)
                const retryContent = await pipeAIStream(res, retryStream, { isOfficialMode: !isModelFreeStream, user, sessionId, usageType: 'chat_collection' })
                if (retryContent) await addMessage(sessionId, 'assistant', retryContent)
              } catch (retryErr) {
                console.error('Fallback retry also failed:', retryErr.message)
                safeSend(`data: ${JSON.stringify({ type: 'error', content: '⚠️ 所有AI模型暂时不可用，请稍后重试' })}\n\n`)
              }
            } else {
              const errMap = { 'API_KEY_INVALID': '⚠️ AI 服务配置异常', 'API_BALANCE_INSUFFICIENT': '⚠️ AI API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁', 'NETWORK_ERROR': '⚠️ 网络连接超时', 'NO_API_KEY': '⚠️ AI 服务未配置' }
              safeSend(`data: ${JSON.stringify({ type: 'error', content: errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）` })}\n\n`)
            }
          } else {
            const errMap = { 'API_KEY_INVALID': '⚠️ AI 服务配置异常（API Key 无效）', 'API_BALANCE_INSUFFICIENT': '⚠️ AI API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁，请稍后重试', 'NETWORK_ERROR': '⚠️ 网络连接超时', 'NO_API_KEY': '⚠️ AI 服务未配置 API Key' }
            safeSend(`data: ${JSON.stringify({ type: 'error', content: errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）` })}\n\n`)
          }
        }
      }
    } else {
      // ===== 报告已生成阶段：后续对话全部走 AI =====
      if (!canUseAI) {
        const errMsg = '⚠️ **余额不足，无法继续AI对话。** 请先充值后再继续。'
        await addMessage(sessionId, 'assistant', errMsg)
        safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg, needRecharge: true })}\n\n`)
      } else {
        // 检查是否是"生成报告"重试指令
        const isRetryReport = /生成报告|重新生成|再生成/.test(content)
        try {
          if (isRetryReport) {
            const similarCases = await findSimilarCases(collectedData.industry, collectedData.problem_type, 3)
            const reportPrompt = buildReportPrompt(collectedData, similarCases)
            const reportMessages = [{ role: 'user', content: reportPrompt }]
            const streamResult = await streamChatWithAI(reportMessages, apiKeyToUse)
            const fullContent = await pipeAIStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'report_retry' })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          } else {
            const allMessages = await getMessages(sessionId)
            const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, collectedData)
            const fullContent = await pipeAIStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'chat' })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          }
        } catch (err) {
          console.error('AI post-report error:', err.message)
          // 实时fallback
          if (!apiKeyToUse) {
            const active = await getActiveAIModel()
            if (active) await updateModelHealth(active.id, { status: 'error', error: err.message })
            const sw = await autoSwitchIfNeeded()
            if (sw?.switched) {
              safeSend(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n⚡ 已自动切换到 ${sw.model}，重试中...\n\n` })}\n\n`)
              try {
                const retryMsgs = await getMessages(sessionId)
                const retryStream = await streamChatWithAI(retryMsgs, null, collectedData)
                const retryContent = await pipeAIStream(res, retryStream, { isOfficialMode: !isModelFreeStream, user, sessionId, usageType: 'chat' })
                if (retryContent) await addMessage(sessionId, 'assistant', retryContent)
              } catch (retryErr) {
                const errMsg = '⚠️ 所有AI模型暂时不可用，请稍后重试'
                await addMessage(sessionId, 'assistant', errMsg)
                safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
              }
            } else {
              const errMsg = `⚠️ AI 服务暂时不可用（${err.message}）`
              await addMessage(sessionId, 'assistant', errMsg)
              safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
            }
          } else {
            const errMap = { 'API_KEY_INVALID': '⚠️ API Key 无效', 'API_BALANCE_INSUFFICIENT': '⚠️ API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁', 'NETWORK_ERROR': '⚠️ 网络超时', 'NO_API_KEY': '⚠️ 未配置 API Key' }
            const errMsg = errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）`
            await addMessage(sessionId, 'assistant', errMsg)
            safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
          }
        }
      }
    }

    safeSend('data: [DONE]\n\n')
    if (!clientDisconnected) res.end()

    // 商城：异步解析AI回复中的商品推荐标记 + 更新用户兴趣（不阻塞响应）
    const allMsgs = await getMessages(sessionId).catch(() => [])
    const lastAssistant = [...allMsgs].reverse().find(m => m.role === 'assistant')
    if (lastAssistant?.content) {
      parseProductRecommendations(lastAssistant.content).catch(() => {})
    }
    if (user?.id) {
      updateUserInterestFromConversation(user.id, sessionId, collectedData, allMsgs).catch(() => {})
    }

    // V2: 对话结束后异步触发AI分析（不阻塞响应）
    // 当收集完成 或 消息数>=8 时触发分析
    const msgCount = allMsgs.length
    if (collectedData._collection_complete || msgCount >= 8) {
      schedulePostConversationAnalysis(sessionId)
    }
  } catch (err) {
    console.error('Stream chat error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '处理消息失败' })
    } else {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: '处理消息失败' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      } catch { /* stream already closed */ }
    }
  }
})

// 用户查询历史记录（按关键词/会话ID/聊天内容搜索）— 必须在 :id 路由之前
app.get('/api/sessions/lookup', optionalUser, async (req, res) => {
  try {
    const keyword = (req.query.q || '').trim()
    if (!keyword || keyword.length < 2) {
      return res.status(400).json({ error: '请输入至少2个字符进行查询' })
    }
    // 只搜索当前用户自己的会话
    const sessions = await lookupSessions(keyword, req.userId || null)
    res.json({ sessions })
  } catch (err) {
    console.error('Lookup error:', err)
    res.status(500).json({ error: '查询失败' })
  }
})

// 获取会话消息历史
app.get('/api/sessions/:id/messages', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (session?.user_id && req.userId && String(session.user_id) !== String(req.userId)) return res.status(403).json({ error: '无权访问' })
    const messages = await getMessages(req.params.id)
    res.json({ messages })
  } catch (err) {
    console.error('Get messages error:', err)
    res.status(500).json({ error: '获取消息失败' })
  }
})

// ========== 申诉文案生成 ==========

app.post('/api/sessions/:id/generate-appeal-text', requireUser, async (req, res) => {
  try {
    const userId = req.userId
    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })

    // 检查付费能力（免费模型跳过余额检查）
    let apiKeyToUse = null
    let isOfficialMode = false
    const activeModelAppeal = await getActiveAIModel()
    const isModelFreeAppeal = activeModelAppeal?.is_free === 1
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFreeAppeal)) {
      apiKeyToUse = null
      isOfficialMode = !isModelFreeAppeal
    } else {
      return res.status(402).json({ error: '余额不足，请先充值后再生成申诉文案', needRecharge: true })
    }

    const { force } = req.body
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = session.collected_data || {}
    if (!d.industry && !d.violation_reason) return res.status(400).json({ error: '请先完成信息收集' })

    // 检查是否已有缓存（force=true 时跳过缓存）
    if (!force) {
      const existing = await getAppealText(req.params.id)
      if (existing) return res.json({ appealText: existing, cached: true })
    }

    const appealAiCfg = await getAIConfig()
    const apiKey = apiKeyToUse || appealAiCfg.apiKey
    if (!apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    // 构建违规类型专项辩护策略
    const violationStrategies = {
      '信用卡套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '赌博': '辩护要点：①强调持有游戏版号/文网文 ②说明有防沉迷系统和实名认证 ③概率公示透明合规 ④游戏内无现金兑换机制、仅售虚拟道具 ⑤与赌博行为有本质区别',
      '虚假交易': '辩护要点：①提供真实订单截图+物流签收记录 ②说明交易量增长有合理原因（如促销活动） ③展示真实买家评价 ④如有刷单嫌疑，承认并说明已停止、已处罚涉事人员',
      '欺诈': '辩护要点：①展示商品/服务真实交付证据 ②如宣传有偏差，承认并已修正所有宣传材料 ③主动为不满客户全额退款 ④更新服务协议增加消费者知情权条款',
      '洗钱': '辩护要点：①提供完整业务合同+海关报关单+外汇许可 ②说明资金流向清晰可追溯、与真实贸易匹配 ③公司已通过反洗钱合规审查 ④大额交易有合同支撑',
      '交易异常': '辩护要点：①解释交易波动原因（季节性/促销/新品上市） ②提供交易对手方信息证明真实性 ③展示历史交易数据佐证业务正常增长',
      '交易纠纷': '辩护要点：①列出所有投诉并说明已全部处理完成 ②分析投诉根因（如沟通不足/服务进度误解）③强调不构成恶意交易纠纷 ④展示整改措施（强化服务前说明、缩短响应时效、建立跟进机制）⑤提供退款凭证和投诉处理记录',
      '投诉': '辩护要点：①正面承认投诉存在并说明处理进展 ②分析投诉产生的客观原因 ③展示已落实的整改措施 ④提供投诉处理完成凭证和客户满意度反馈',
    }
    const reason = d.violation_reason || ''
    let matchedStrategy = ''
    for (const [keyword, strategy] of Object.entries(violationStrategies)) {
      if (reason.includes(keyword)) { matchedStrategy = strategy; break }
    }

    // 行业专业术语要求
    const industryTerms = {
      '游戏': '必须提及：游戏版号、防沉迷系统、实名认证、概率公示、文网文许可',
      '棋牌': '必须提及：游戏版号、防沉迷系统、实名认证、概率公示、文网文许可、无现金兑换',
      '教育': '必须提及：教育资质备案、课程大纲公示、试听机制、学员评价体系',
      '支付': '必须提及：支付牌照/代理资质、POS机入网合规、商户准入审核',
      '跨境': '必须提及：海关报关单、外汇收支许可、跨境电商备案、贸易合同',
      '贸易': '必须提及：进出口许可、贸易合同、海关申报记录、资金流可追溯',
      '医疗': '必须提及：医疗机构执业许可、医师资质、药品经营许可',
      '金融': '必须提及：金融业务牌照、合规审计报告、反洗钱制度',
    }
    let industryReq = ''
    for (const [keyword, terms] of Object.entries(industryTerms)) {
      if ((d.industry || '').includes(keyword) || reason.includes(keyword)) { industryReq = terms; break }
    }

    // 申诉历史策略
    const appealHistory = d.appeal_history || ''
    let appealStrategy = ''
    if (/驳回|被拒|失败|不通过/.test(appealHistory)) {
      const times = appealHistory.match(/(\d+)\s*次/) ? appealHistory.match(/(\d+)\s*次/)[1] : '多'
      appealStrategy = `【重要】此为第${times}次申诉（前次被驳回），本次文案必须：①明确指出与上次申诉的不同之处 ②补充新证据 ③更深入地分析问题根因 ④展示已落实的具体整改（不是计划而是已做到的）⑤语气更诚恳但也更有理有据`
    }

    // 投诉情况诚实处理策略
    const complaintStatus = d.complaint_status || ''
    let complaintStrategy = ''
    if (/\d+.*投诉|投诉.*\d+/.test(complaintStatus)) {
      complaintStrategy = '【注意】客户有投诉记录，文案中必须正面承认投诉存在并说明处理进展，绝不能说"无投诉"或回避投诉事实'
    }

    // 经营场景信息
    const scenario = d.business_scenario || d.business_model || '未提供'
    const mpName = d.miniprogram_name || ''
    const mpAppid = d.miniprogram_appid || ''
    const orderInfo = d.order_info || ''

    const prompt = `你是微信商户号申诉实战专家，有10年帮助商户成功申诉的经验。你深谙微信审核人员的关注重点。

以下是用户需要填写的【微信商户后台真实申诉表单】，你需要帮用户生成每一栏可以直接复制粘贴提交的专业内容。

═══════════ 客户信息 ═══════════
- 行业：${d.industry || '未提供'}
- 经营模式：${d.business_model || '未提供'}
- 经营场景：${scenario}
- 小程序/公众号名称：${mpName || '未提供'}
- 小程序AppID：${mpAppid || '未提供'}
- 商户名称：${d.merchant_name || '未提供'}
- 公司全称：${d.company_name || '未提供'}
- 商户号：${d.merchant_id || '未提供'}
- 处罚类型：${d.problem_type || '未提供'}
- 违规原因：${d.violation_reason || '未提供'}
- 投诉情况：${complaintStatus || '无投诉'}
- 退款政策：${d.refund_policy || '未提供'}
- 交易订单信息：${orderInfo || '未提供'}
- 联系人：${d.legal_name || '未提供'}
- 联系电话：${d.contact_phone || '未提供'}
- 申诉历史：${appealHistory || '首次申诉'}
${matchedStrategy ? `\n═══════════ 针对「${reason}」的专项辩护策略 ═══════════\n${matchedStrategy}` : ''}
${industryReq ? `\n═══════════ 行业专业要求 ═══════════\n${industryReq}` : ''}
${appealStrategy ? `\n═══════════ 申诉历史注意 ═══════════\n${appealStrategy}` : ''}
${complaintStrategy ? `\n${complaintStrategy}` : ''}

═══════════ 输出要求 ═══════════

请输出JSON，5个字段。这5个字段对应微信商户后台申诉表单的真实填写栏，生成内容可直接复制粘贴提交。每个字段200-300字符（尽量接近300字，充分利用空间）：

{
  "business_model": "【业务模式说明】对应微信申诉表单「业务模式说明」栏。内容包含：①我司为XX行业，通过XX方式经营 ②主营业务为XX ③盈利模式为XX ④解释为何本业务与被指控的违规行为有本质区别。写成第一人称「我司/我方」的正式陈述，可直接复制到表单。",
  "refund_rules": "【退款机制与退款方式】对应微信申诉表单「退款机制与退款方式」栏。内容包含：①基于客户提供的退款政策优化展开 ②描述退款处理流程（申请→审核→退款） ③响应时效承诺（如24小时内审核、N个工作日退款） ④如客户原有政策不完善，用'现已优化为...'改进。写成可直接提交的正式内容。",
  "complaint_cause": "【投诉产生原因及详细说明】对应微信申诉表单「投诉产生原因及详细说明」栏。内容包含：①如实描述投诉现状（已处理/未处理） ②分析投诉根本原因 ③如有投诉必须正面承认并说明处理结果 ④说明这不构成恶意行为的理由。绝不回避负面信息，语气诚恳。",
  "complaint_resolution": "【妥善处理消费者投诉/投诉处理方法】对应微信申诉表单「投诉处理方法」栏。内容包含：①已落实的具体整改措施（用'已'表述） ②计划中的预防机制（用'将/现已着手'表述） ③投诉响应时效承诺 ④建议准备的证据材料（退款凭证、处理记录等）。",
  "supplementary": "【补充文字说明】对应微信申诉表单「补充文字说明」栏。内容包含：①恢复支付权限后的合规承诺 ②联系人+联系电话表达配合意愿 ③如有腾讯文档等补充资料链接可提及 ④提醒客户需要上传的证件照片和补充材料清单。"
}

═══════════ 铁律（违反则文案无效）═══════════
1. 【禁止编造数据】绝对不能编造客户未提供的任何具体数字、统计、日期、编号！如需引用数据，用"我方可提供XX数据证明"代替。
2. 【禁止占位符】不能出现[具体版号]、[具体日期]等方括号占位符。如需客户填入信息，用"（附：您的XX证书编号）"的格式。
3. 【禁止虚假声明】不能替客户声称已完成未确认的整改。建议做的整改用"现已着手/将"表述，客户确认的事实才用"已"。
4. 【禁止回避】有投诉就必须正面回应，不能假装没有。
5. 【禁止套话】禁用"高度重视""积极配合""竭诚服务"等空洞表述。
6. 【充分利用】每段200-300字符，信息密度要高，可直接复制到微信商户后台申诉表单提交。
7. 【第一人称】必须用"我司/我方/本公司"等第一人称撰写，这是用户直接复制提交的内容。
8. 【审核视角】微信审核员能看到商户真实交易数据，文案中的数字必须可验证，或用"可提供XX证明"。`

    // 调用 AI API（带重试）
    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const maxRetries = 2
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 90000)
        const appealBody = {
          model: appealAiCfg.model,
          messages: [
            { role: 'system', content: '你是全平台商户号申诉实战专家，覆盖微信支付、支付宝、抖音、快手、美团等平台。请严格按JSON格式输出，不要输出任何其他内容。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 3000,
        }
        appealBody.response_format = { type: 'json_object' }

        const apiRes = await fetch(appealAiCfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(appealBody),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!apiRes.ok) {
          const errText = await apiRes.text().catch(() => '')
          console.error(`[${appealAiCfg.provider}] appeal API error (attempt ${attempt + 1}):`, apiRes.status, errText)
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
          return res.status(500).json({ error: `AI服务请求失败(${apiRes.status})` })
        }
        const apiData = await apiRes.json()
        content = apiData.choices?.[0]?.message?.content || ''
        inputTokens = apiData.usage?.prompt_tokens || 0
        outputTokens = apiData.usage?.completion_tokens || 0
        break // 成功，退出重试循环
      } catch (fetchErr) {
        console.error(`[${appealAiCfg.provider}] appeal fetch error (attempt ${attempt + 1}):`, fetchErr.message)
        if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
        return res.status(500).json({ error: `AI服务连接失败：${fetchErr.name === 'AbortError' ? '请求超时(90s)' : fetchErr.message}` })
      }
    }

    if (!content) {
      return res.status(500).json({ error: 'AI返回内容为空，请重试' })
    }

    // 解析JSON（兼容AI返回 markdown 代码块包裹的情况）
    let parsed
    try {
      let cleanContent = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanContent)
    } catch (parseErr) {
      console.error('Appeal text parse error:', parseErr.message, '\nRaw:', content.substring(0, 500))
      // 尝试逐段提取（降级方案）
      try {
        const sections = content.split(/\n\n+/)
        parsed = {
          business_model: sections[0] || '',
          refund_rules: sections[1] || '',
          complaint_cause: sections[2] || '',
          complaint_resolution: sections[3] || '',
          supplementary: sections[4] || '',
        }
      } catch {
        return res.status(500).json({ error: '文案解析失败，请重试' })
      }
    }

    // 计费
    let cost = 0
    if (isOfficialMode) {
      const multiplierStr = await getSystemConfig('cost_multiplier')
      const multiplier = parseFloat(multiplierStr || '2')
      const tokenInfo = calculateCost(inputTokens, outputTokens, multiplier)
      cost = tokenInfo.cost
      const deductResult = await deductBalance(user.id, cost)
      if (deductResult.success) await incrementUserSpent(user.id, cost)
      await recordTokenUsage({ userId: user.id, sessionId: req.params.id, type: 'appeal_text', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, multiplier, apiMode: 'official' })
    }

    // 保存
    await saveAppealText({
      sessionId: req.params.id, userId: user.id,
      businessModel: parsed.business_model || '',
      refundRules: parsed.refund_rules || '',
      complaintCause: parsed.complaint_cause || '',
      complaintResolution: parsed.complaint_resolution || '',
      supplementary: parsed.supplementary || '',
      inputTokens, outputTokens, cost,
    })

    const savedText = await getAppealText(req.params.id)
    const updatedUser = await getUserById(user.id)
    res.json({ appealText: savedText, cached: false, cost, balance: updatedUser?.balance, isOfficialMode, inputTokens, outputTokens })
  } catch (err) {
    console.error('Generate appeal text error:', err)
    res.status(500).json({ error: '生成申诉文案失败' })
  }
})

// 获取已生成的申诉文案
app.get('/api/sessions/:id/appeal-text', optionalUser, async (req, res) => {
  try {
    const text = await getAppealText(req.params.id)
    res.json({ appealText: text })
  } catch (err) { res.status(500).json({ error: '获取失败' }) }
})

// ========== 申诉进度反馈 ==========

app.post('/api/sessions/:id/appeal-feedback', requireUser, async (req, res) => {
  try {
    const { status, feedback, rejectionReason } = req.body
    const valid = ['submitted', 'under_review', 'approved', 'rejected', 'resubmitted']
    if (!valid.includes(status)) return res.status(400).json({ error: '无效的状态' })
    await updateAppealStatus(req.params.id, req.userId, { status, feedback, rejectionReason })

    // 进化引擎学习：真实结果反馈
    if (status === 'approved' || status === 'rejected') {
      try {
        const { upsertKnowledgeCluster } = await import('./db.js')
        const session = await getSession(req.params.id)
        const d = session?.collected_data || {}
        const industry = d.industry || 'unknown'
        const violation = d.problem_type || 'unknown'
        // 更新行业成功率知识簇
        await upsertKnowledgeCluster({
          clusterType: 'success_factor',
          clusterKey: `real_result:${industry}:${violation}`,
          clusterData: { industry, violation, result: status, feedback, rejectionReason, sessionId: req.params.id, timestamp: new Date().toISOString() },
          sampleCount: 1,
          confidenceScore: status === 'approved' ? 80 : 30,
        })
      } catch (evoErr) { console.error('[Evolution] 反馈学习失败:', evoErr.message) }
    }

    const updated = await getAppealText(req.params.id)
    res.json({ success: true, appealText: updated })
  } catch (err) {
    console.error('Appeal feedback error:', err)
    res.status(500).json({ error: '更新失败' })
  }
})

app.get('/api/admin/appeal-stats', requireAdmin, async (req, res) => {
  try { res.json(await getAppealStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取申诉统计失败' }) }
})

// ========== 投诉材料整理 ==========

app.post('/api/sessions/:id/generate-complaint-doc', requireUser, async (req, res) => {
  try {
    const userId = req.userId
    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })

    let apiKeyToUse = null
    let isOfficialMode = false
    const activeModel = await getActiveAIModel()
    const isModelFree = activeModel?.is_free === 1
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFree)) {
      apiKeyToUse = null
      isOfficialMode = !isModelFree
    } else {
      return res.status(402).json({ error: '余额不足，请先充值', needRecharge: true })
    }

    const { force } = req.body
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = session.collected_data || {}
    if (!d.industry && !d.violation_reason && !d.problem_type) {
      return res.status(400).json({ error: '请先通过对话提供基本信息（行业、违规原因等）' })
    }

    if (!force) {
      const existing = await getComplaintDoc(req.params.id)
      if (existing) return res.json({ doc: existing, cached: true })
    }

    const aiCfg = await getAIConfig()
    const apiKey = apiKeyToUse || aiCfg.apiKey
    if (!apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    // 构建收集到的所有信息摘要（使用中文标签）
    const fieldLabels = {
      industry: '行业', business_model: '经营模式', business_scenario: '经营场景',
      miniprogram_name: '小程序/公众号名称', miniprogram_appid: '小程序AppID',
      problem_type: '处罚类型', violation_reason: '违规原因',
      merchant_id: '商户号', merchant_name: '商户名称',
      company_name: '公司全称', license_no: '统一社会信用代码',
      legal_name: '法人姓名', legal_id_last4: '身份证后四位',
      complaint_status: '投诉情况', refund_policy: '退款政策',
      order_info: '交易订单信息', bank_name: '开户银行',
      bank_account_last4: '结算账户后四位', contact_phone: '联系电话',
      appeal_history: '申诉历史',
    }
    const infoLines = Object.entries(d)
      .filter(([k, v]) => v && !k.startsWith('_'))
      .map(([k, v]) => `- ${fieldLabels[k] || k}: ${v}`)
      .join('\n')

    const prompt = `你是一位专业的商户申诉材料整理专家。请根据以下客户信息，生成一份完整的、可直接使用的投诉/申诉材料整理文档。

参考微信商户号申诉的真实流程，申诉材料需要包含：身份证件照片、业务模式说明、经营场景、交易订单凭证、投诉原因说明、投诉处理方法、退款机制、补充说明等。

═══════════ 客户已提供的信息 ═══════════
${infoLines || '（信息较少，请基于已有内容尽可能整理）'}

═══════════ 输出要求 ═══════════

请输出JSON，包含以下字段：

{
  "doc_title": "文档标题，如：关于XXX商户号涉嫌XXX申诉材料整理",
  "complaint_summary": "案件概述（200-400字）：用专业简洁的第一人称语言概述整个事件。包括：商户基本情况、遭遇的处罚类型和原因、当前状态、核心诉求（恢复支付权限）。",
  "merchant_info": "商户与经营信息整理：结构化格式，每项一行。必须包含：\\n商户名称：XX\\n商户号：XX\\n公司全称：XX\\n统一社会信用代码：XX\\n法人/经营者：XX\\n行业类型：XX\\n经营场景：线上/线下/线上+线下\\n线上经营平台：小程序/公众号/H5\\n小程序名称：XX\\n小程序AppID：XX\\n联系电话：XX\\n（未提供的标注「待补充」）",
  "violation_detail": "违规/处罚详情+交易订单信息（300-500字）：①处罚类型和平台给出的违规原因 ②如有交易订单号，逐笔列出（格式：微信交易订单号：XXXX / 订单商品/服务内容：XXXX） ③说明这些交易的真实性 ④处罚的影响范围",
  "evidence_list": "申诉需准备的证据材料清单：根据真实申诉表单要求，编号列出所有需要准备的材料。必须包含：\\n1. 法人/经营者身份证正面照片 — 申诉表单必传\\n2. 法人/经营者身份证反面照片 — 申诉表单必传\\n3. 法人/经营者手持身份证正面照片 — 申诉表单必传\\n4. 营业执照照片 — 证明经营资质\\n5. 小程序/公众号截图或门店照片 — 证明经营场景\\n6. 微信支付交易订单截图（2-3笔） — 证明真实交易\\n7. 投诉处理完成截图 — 证明投诉已妥善处理\\n8. 退款凭证截图 — 证明退款已执行\\n然后根据行业和违规类型补充更多（如行业许可证、服务合同、客户好评等），至少列12项。每项标注获取方式。",
  "timeline": "事件时间线：按时间顺序整理事件经过。格式为：日期/时间段 → 事件。未提供具体日期的用（具体日期待确认）标注。必须包含：注册商户号时间、正常经营期间、收到处罚通知、处理投诉/整改、提交申诉等关键节点。",
  "appeal_points": "申诉要点与策略梳理（300-500字）：①核心策略概述 ②逐条要点，每条包含论点+证据支撑 ③需要特别注意的事项 ④建议的申诉提交顺序和注意事项 ⑤如被驳回的应对预案",
  "full_document": "完整申诉文书（1000-2000字）：这是用户可以直接复制到Word打印的完整版本。格式要求：\\n\\n标题居中\\n\\n致：微信支付团队\\n\\n一、商户基本情况（简介+经营场景）\\n\\n二、关于涉嫌XX的情况说明（处罚原因+我方解释）\\n\\n三、交易真实性说明（列出订单号和内容）\\n\\n四、投诉处理情况（投诉已处理+具体措施）\\n\\n五、整改措施（已落实+计划中）\\n\\n六、退款保障机制\\n\\n七、附件清单（编号列出所有附件材料）\\n\\n恳请贵团队审核并恢复我司支付权限。\\n\\n联系人：XX 联系电话：XX\\n\\n日期：XXXX年XX月XX日\\n\\n注意使用换行分段，格式清晰专业。"
}

═══════════ 重要规则 ═══════════
1. 【禁止编造】不能编造客户未提供的具体数字、日期、编号。未知信息用（待补充：XXX）标注。
2. 【实事求是】基于客户提供的信息整理，不夸大不缩小。
3. 【专业格式】使用正式文书语言，第一人称撰写，条理清晰，可直接使用。
4. 【可操作性】证据清单要具体可执行，告诉客户每项材料在哪里获取。
5. 【真实表单对齐】必须覆盖微信真实申诉表单的所有必填项（身份证照片、业务模式、经营场景、订单凭证、投诉说明、处理方法、退款机制、补充说明）。`

    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const maxRetries = 2
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)
        const body = {
          model: aiCfg.model,
          messages: [
            { role: 'system', content: '你是专业的商户申诉材料整理专家。请严格按JSON格式输出，不要输出任何其他内容。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        }
        const apiRes = await fetch(aiCfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!apiRes.ok) {
          const errText = await apiRes.text().catch(() => '')
          console.error(`[ComplaintDoc] API error (attempt ${attempt + 1}):`, apiRes.status, errText)
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
          return res.status(500).json({ error: `AI服务请求失败(${apiRes.status})` })
        }
        const apiData = await apiRes.json()
        content = apiData.choices?.[0]?.message?.content || ''
        inputTokens = apiData.usage?.prompt_tokens || 0
        outputTokens = apiData.usage?.completion_tokens || 0
        break
      } catch (fetchErr) {
        console.error(`[ComplaintDoc] fetch error (attempt ${attempt + 1}):`, fetchErr.message)
        if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
        return res.status(500).json({ error: `AI服务连接失败：${fetchErr.name === 'AbortError' ? '请求超时' : fetchErr.message}` })
      }
    }

    if (!content) return res.status(500).json({ error: 'AI返回内容为空，请重试' })

    let parsed
    try {
      let clean = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean)
    } catch {
      return res.status(500).json({ error: '材料解析失败，请重试' })
    }

    let cost = 0
    if (isOfficialMode) {
      const multiplierStr = await getSystemConfig('cost_multiplier')
      const multiplier = parseFloat(multiplierStr || '2')
      const tokenInfo = calculateCost(inputTokens, outputTokens, multiplier)
      cost = tokenInfo.cost
      const deductResult = await deductBalance(user.id, cost)
      if (deductResult.success) await incrementUserSpent(user.id, cost)
      await recordTokenUsage({ userId: user.id, sessionId: req.params.id, type: 'complaint_doc', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, multiplier, apiMode: 'official' })
    }

    await saveComplaintDoc({
      sessionId: req.params.id, userId: user.id,
      docTitle: parsed.doc_title || '',
      complaintSummary: parsed.complaint_summary || '',
      merchantInfo: parsed.merchant_info || '',
      violationDetail: parsed.violation_detail || '',
      evidenceList: parsed.evidence_list || '',
      timeline: parsed.timeline || '',
      appealPoints: parsed.appeal_points || '',
      fullDocument: parsed.full_document || '',
      inputTokens, outputTokens, cost,
    })

    const saved = await getComplaintDoc(req.params.id)
    const updatedUser = await getUserById(user.id)
    res.json({ doc: saved, cached: false, cost, balance: updatedUser?.balance, isOfficialMode, inputTokens, outputTokens })
  } catch (err) {
    console.error('Generate complaint doc error:', err)
    res.status(500).json({ error: '生成投诉材料失败' })
  }
})

app.get('/api/sessions/:id/complaint-doc', optionalUser, async (req, res) => {
  try {
    const doc = await getComplaintDoc(req.params.id)
    res.json({ doc })
  } catch (err) { res.status(500).json({ error: '获取失败' }) }
})

// ========== 投诉回复话术生成（免费·本地规则） ==========

app.post('/api/sessions/:id/generate-complaint-reply', requireUser, async (req, res) => {
  try {
    const session = await getSessionById(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = typeof session.collected_info === 'string' ? JSON.parse(session.collected_info || '{}') : (session.collected_info || {})
    const { complaint_type, complaint_content } = req.body || {}

    const industry = d.industry || '通用'
    const merchantName = d.merchant_name || d.company_name || '我司'
    const refundPolicy = d.refund_policy || ''

    // 根据投诉类型生成不同话术
    const replyTemplates = {
      '退款': {
        first_reply: `您好，非常抱歉给您带来不好的体验。您的退款申请我们已收到并高度关注，正在为您加急处理中。我们的退款政策是：${refundPolicy || '收到申请后24小时内审核，审核通过后1个工作日内原路退回'}。请您放心，我们会尽快为您处理。如需沟通请随时留言，我们会第一时间回复。`,
        resolution: `您好，关于您的退款申请，我们已经完成审核。退款已通过原支付渠道发起，预计1-3个工作日到账，请您留意查收。如到账有任何问题，请随时联系我们。再次对给您造成的不便表示歉意，感谢您的理解与支持。`,
        close: `尊敬的客户，您的退款已于{日期}成功退回，请确认查收。如您对处理结果满意，恳请在投诉页面确认"已解决"。如仍有任何问题，我们随时为您服务。祝您生活愉快！`
      },
      '服务不满意': {
        first_reply: `您好，非常感谢您的反馈，对于您不满意的体验我们深表歉意。您的意见对我们非常重要，我们已安排专人跟进您的问题。请问方便详细说明一下具体是哪方面让您不满意吗？我们会认真对待并尽快给您满意的解决方案。`,
        resolution: `您好，针对您反馈的问题，我们已进行了内部核实和整改。具体解决方案如下：{根据实际情况填写}。同时我们也已优化了相关服务流程，避免类似情况再次发生。如果您对以上方案有任何意见，请随时告知。`,
        close: `尊敬的客户，感谢您给我们改进的机会。我们已对您反馈的问题进行了整改，并将持续优化服务质量。如处理结果让您满意，恳请在投诉页面确认"已解决"。后续如有任何需要，随时联系我们。`
      },
      '商品问题': {
        first_reply: `您好，非常抱歉我们的商品/服务未能达到您的期望。您反馈的问题我们已经记录并安排核实，会在24小时内给您明确的处理方案。如涉及退款或补偿，我们会按照售后政策第一时间为您处理。请您稍候，感谢您的耐心。`,
        resolution: `您好，经过核实，您反馈的问题属实。我们愿意为您提供以下解决方案：{1.全额退款 / 2.补发商品 / 3.折扣补偿}。请您选择最合适的方案，我们将立即执行。再次为给您带来的不便致歉。`,
        close: `尊敬的客户，您的问题已按{方案}处理完成。感谢您的理解与配合。如对处理结果满意，恳请在投诉页面确认"已解决"。我们会持续提升产品和服务质量。`
      },
      '未收到货': {
        first_reply: `您好，非常抱歉让您久等了。我们已经在核实您的订单物流情况，会尽快查明原因。如确认物流异常，我们将立即为您安排补发或退款。请您稍候，预计24小时内给您明确答复。`,
        resolution: `您好，经查询您的订单{订单号}，{物流情况说明}。我们已为您安排{补发/退款}，{预计到达时间/退款预计到账时间}。再次对延误表示歉意。`,
        close: `尊敬的客户，您的问题已妥善处理（{补发已签收/退款已到账}）。如对处理结果满意，恳请在投诉页面确认"已解决"。感谢您的耐心等待！`
      },
      '其他': {
        first_reply: `您好，感谢您的反馈。您提出的问题我们已经收到并认真记录，正在安排专人跟进核实。我们会在24小时内给您详细的处理方案。期间如有任何补充信息，请随时留言，我们会第一时间查看。`,
        resolution: `您好，关于您反馈的问题，经我们内部核实和协商，处理方案如下：{具体方案}。我们始终以客户满意为目标，如您对方案有任何异议，我们可以进一步协商。`,
        close: `尊敬的客户，您反馈的问题已处理完成。感谢您给予我们改进的机会。如对处理结果满意，恳请在投诉页面确认"已解决"。祝您一切顺利！`
      }
    }

    const type = complaint_type && replyTemplates[complaint_type] ? complaint_type : '其他'
    const templates = replyTemplates[type]

    // 生成处理时间线提醒
    const timeline_tips = {
      '24h内': '收到投诉后必须在24小时内首次回复用户（否则影响「1日回复率」指标）',
      '72h内': '必须在72小时内处理完毕并标记"处理完成"（否则影响「3日处理完成率」指标）',
      '标记完成后': '标记"处理完成"后用户可能继续投诉，需持续关注'
    }

    // 生成95017电话话术
    const phone_script = {
      preparation: `拨打前准备好以下信息：\n• 商户号：${d.merchant_id || '（请准备好）'}\n• 法人姓名：${d.legal_name || '（请准备好）'}\n• 身份证后四位：${d.legal_id_last4 || '（请准备好）'}\n• 银行卡后四位：${d.bank_account_last4 || '（请准备好）'}\n• 联系电话：${d.contact_phone || '（请准备好）'}`,
      steps: [
        '拨打 95017',
        '按 2（商户服务）',
        '输入商户号后按 # 确认',
        '等待转接人工客服（可能等待5-15分钟）',
        '人工接通后说明来意'
      ],
      script: `您好，我是商户号${d.merchant_id || 'XXXXXXXXXX'}的${d.legal_name ? '法人' + d.legal_name : '负责人'}。我司商户号因${d.violation_reason || '涉嫌违规'}被${d.problem_type || '限制'}，我们已在商户平台提交了申诉材料，想咨询一下审核进度。我们是${industry}行业，正常经营中，所有投诉都已处理完成。请问大概什么时候能有审核结果？需要我们补充什么材料吗？`,
      tips: [
        '语气保持礼貌诚恳，不要激动',
        '准确报出商户号和法人信息以验证身份',
        '明确说明已提交申诉并处理好投诉',
        '询问是否需要补充材料',
        '记录客服工号和回复内容',
        '如果客服说在审核中，可以问预计时间',
        '每隔2-3天可以再次致电跟进'
      ]
    }

    res.json({
      complaint_type: type,
      templates,
      timeline_tips,
      phone_script,
      industry,
      merchant_name: merchantName,
    })
  } catch (err) {
    console.error('Generate complaint reply error:', err)
    res.status(500).json({ error: '生成投诉回复失败' })
  }
})

// ========== 申诉全流程指导 ==========

app.get('/api/sessions/:id/appeal-guide', requireUser, async (req, res) => {
  try {
    const session = await getSessionById(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = typeof session.collected_info === 'string' ? JSON.parse(session.collected_info || '{}') : (session.collected_info || {})

    const violationReason = d.violation_reason || ''
    const problemType = d.problem_type || ''
    const hasComplaints = /\d+.*投诉|投诉.*\d+|有/.test(d.complaint_status || '')
    const isFirstAppeal = !/驳回|被拒|失败/.test(d.appeal_history || '')

    // 根据用户情况动态生成流程步骤
    const steps = []

    // 第1步：处理投诉（如果有的话）
    if (hasComplaints) {
      steps.push({
        id: 'handle_complaints',
        title: '优先处理所有消费者投诉',
        priority: 'urgent',
        icon: '🚨',
        description: '申诉前必须先把所有投诉处理完！未处理的投诉会直接导致申诉被驳回。',
        actions: [
          '登录商户平台 pay.weixin.qq.com → 账户中心 → 消费者投诉',
          '逐一回复所有"待处理"的投诉（24小时内必须首次回复）',
          '与用户协商解决方案（退款/补偿/解释）',
          '72小时内处理完毕并标记"处理完成"',
          '引导满意的用户在投诉页面确认"已解决"'
        ],
        tips: '所有投诉必须处于"已处理完成"状态再提交申诉',
        time_estimate: '1-3天'
      })
    }

    // 第2步：查看违约记录
    steps.push({
      id: 'check_violation',
      title: '查看违约记录详情',
      priority: 'required',
      icon: '🔍',
      description: '确认处罚类型和具体原因，了解申诉要求。',
      actions: [
        '方式一：登录商户平台 pay.weixin.qq.com → 账户中心 → 违约记录',
        '方式二：微信搜索【微信支付商家助手】小程序 → 风险处理 → 违约处理记录',
        '方式三：关注【微信支付商家助手】公众号 → 我的账号 → 我是商家 → 风险处理',
        '记录下违约类型、处罚措施、处理时效要求'
      ],
      tips: '截图保存违约记录页面，申诉时可能需要参考',
      time_estimate: '10分钟'
    })

    // 第3步：准备材料
    const materials = [
      { name: '法人/经营者身份证正面照片', required: true, note: '申诉表单必传' },
      { name: '法人/经营者身份证反面照片', required: true, note: '申诉表单必传' },
      { name: '法人/经营者手持身份证正面照片', required: true, note: '申诉表单必传' },
      { name: '营业执照照片', required: true, note: '证明经营资质' },
    ]
    if (/线上|小程序|公众号|网/.test(d.business_scenario || d.business_model || '')) {
      materials.push({ name: '小程序/公众号截图', required: true, note: '线上经营场景证明' })
      if (d.miniprogram_appid) materials.push({ name: `小程序AppID: ${d.miniprogram_appid}`, required: true, note: '表单需要填写' })
    }
    if (/线下|实体|门店/.test(d.business_scenario || d.business_model || '')) {
      materials.push({ name: '门头照+内景照', required: true, note: '线下经营场景证明' })
      materials.push({ name: '门店定位截图', required: false, note: '辅助证明' })
    }
    materials.push(
      { name: '微信支付交易订单截图（2-3笔）', required: true, note: '证明真实交易，4200开头的订单号' },
      { name: '投诉处理完成截图', required: hasComplaints, note: '证明投诉已妥善处理' },
      { name: '退款凭证截图', required: hasComplaints, note: '证明退款已执行' },
    )
    // 行业特殊材料
    if (/游戏|棋牌/.test(d.industry || '')) {
      materials.push({ name: '游戏版号/文网文许可', required: true, note: '游戏行业必须' })
    }
    if (/教育|培训/.test(d.industry || '')) {
      materials.push({ name: '办学许可证/教育资质', required: true, note: '教育行业必须' })
    }
    if (/食品|餐饮/.test(d.industry || '')) {
      materials.push({ name: '食品经营许可证', required: true, note: '餐饮行业必须' })
    }
    if (/医疗|药品/.test(d.industry || '')) {
      materials.push({ name: '医疗机构执业许可', required: true, note: '医疗行业必须' })
    }

    steps.push({
      id: 'prepare_materials',
      title: '准备申诉材料',
      priority: 'required',
      icon: '📋',
      description: '根据您的情况，需要准备以下材料：',
      materials,
      tips: '材料尽量齐全，一次性提交成功率更高',
      time_estimate: '1-2天'
    })

    // 第4步：填写申诉表单
    steps.push({
      id: 'fill_appeal_form',
      title: '填写并提交申诉',
      priority: 'required',
      icon: '✍️',
      description: '在商户平台提交申诉，我们已帮您生成好各栏内容，可直接复制粘贴。',
      actions: [
        '登录商户平台 pay.weixin.qq.com → 账户中心 → 违约记录',
        '找到对应记录，点击"申请解除限制"',
        '上传证件照片（身份证正反面+手持照）',
        '填写"业务模式说明"→ 点击本平台【申诉文案】复制第1段',
        '选择经营场景（线上/线下）→ 填写小程序信息',
        '填写交易订单信息（2-3笔）',
        '填写"投诉产生原因"→ 复制第3段',
        '填写"投诉处理方法"→ 复制第4段',
        '填写"退款机制"→ 复制第2段',
        '填写"补充文字说明"→ 复制第5段',
        '上传补充材料文件',
        '仔细检查后点击提交'
      ],
      tips: '提交前仔细检查所有内容是否准确，提交后无法修改',
      time_estimate: '30分钟'
    })

    // 第5步：等待审核 + 电话跟进
    steps.push({
      id: 'wait_and_follow',
      title: '等待审核 + 电话跟进',
      priority: 'recommended',
      icon: '📞',
      description: '提交后预计1-7个工作日出结果。建议2-3天后致电95017跟进。',
      actions: [
        '提交后第2-3天：拨打95017 → 按2 → 输入商户号 → 转人工',
        '告知客服已提交申诉，询问审核进度',
        '如客服要求补充材料，尽快准备提交',
        '留意商户平台站内信、邮件和公众号通知',
        '审核中心会展示处理进度，定期查看'
      ],
      tips: '每隔2-3天跟进一次，语气礼貌诚恳',
      time_estimate: '1-7个工作日'
    })

    // 第6步：驳回应对（如果不是首次申诉）
    if (!isFirstAppeal) {
      steps.push({
        id: 'rejected_plan',
        title: '驳回后的应对方案',
        priority: 'important',
        icon: '🔄',
        description: '如果申诉被驳回，不要放弃，分析原因后补充材料重新申诉。',
        actions: [
          '仔细阅读驳回理由（在违约记录页面查看）',
          '针对驳回理由补充新的证据材料',
          '修改申诉文案，重点回应驳回原因',
          '联系95017人工客服确认需要补充什么',
          '重新提交申诉（通常可以多次申诉）'
        ],
        tips: '每次申诉必须有新证据或新说明，否则容易再次被驳回',
        time_estimate: '3-5天准备后重新提交'
      })
    } else {
      steps.push({
        id: 'rejected_plan',
        title: '如果被驳回怎么办',
        priority: 'info',
        icon: '💡',
        description: '首次申诉通过率较高。万一被驳回，可以补充材料后再次申诉。',
        actions: [
          '查看驳回原因',
          '针对性补充新证据',
          '修改文案后重新提交',
          '致电95017咨询具体需要什么材料'
        ],
        tips: '大部分商户在1-2次申诉内都能通过',
        time_estimate: '视情况而定'
      })
    }

    // 成功率评估
    let successRate = 70
    let riskFactors = []
    let positiveFactors = []

    if (hasComplaints) { successRate -= 10; riskFactors.push('存在未处理投诉会降低成功率') }
    if (!isFirstAppeal) { successRate -= 15; riskFactors.push('非首次申诉，审核会更严格') }
    if (/套现|赌博|欺诈|洗钱/.test(violationReason)) { successRate -= 20; riskFactors.push('严重违规类型（' + violationReason + '），审核标准高') }
    if (/交易异常|交易纠纷|投诉/.test(violationReason)) { successRate += 5; positiveFactors.push('该违规类型申诉成功率相对较高') }
    if (d.order_info) { successRate += 5; positiveFactors.push('已提供交易订单信息') }
    if (d.miniprogram_appid || d.miniprogram_name) { successRate += 3; positiveFactors.push('已提供经营场景信息') }
    if (d.refund_policy) { successRate += 5; positiveFactors.push('有完善的退款政策') }
    if (d.contact_phone) { successRate += 2; positiveFactors.push('已提供联系电话') }
    if (/处理完|已解决|已退款/.test(d.complaint_status || '')) { successRate += 10; positiveFactors.push('投诉已处理完毕') }

    successRate = Math.max(10, Math.min(95, successRate))

    res.json({
      steps,
      success_estimate: {
        rate: successRate,
        level: successRate >= 75 ? 'high' : successRate >= 50 ? 'medium' : 'low',
        risk_factors: riskFactors,
        positive_factors: positiveFactors,
      },
      violation_info: {
        type: violationReason || '未知',
        problem: problemType || '未知',
        industry: d.industry || '未知',
        has_complaints: hasComplaints,
        is_first_appeal: isFirstAppeal,
      }
    })
  } catch (err) {
    console.error('Appeal guide error:', err)
    res.status(500).json({ error: '生成申诉指导失败' })
  }
})

// ========== 申诉进度追踪 ==========

app.get('/api/sessions/:id/appeal-progress', requireUser, async (req, res) => {
  try {
    const sessionId = req.params.id
    const [rows] = await pool.execute(
      'SELECT appeal_status, user_feedback, submitted_at, result_at, rejection_reason, resubmit_count, created_at FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    if (rows.length === 0) return res.json({ status: null, message: '尚未生成申诉文案' })
    const r = rows[0]
    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    res.json({
      status: r.appeal_status || 'generated',
      label: statusLabels[r.appeal_status] || '已生成文案',
      submitted_at: r.submitted_at,
      result_at: r.result_at,
      rejection_reason: r.rejection_reason,
      resubmit_count: r.resubmit_count || 0,
      user_feedback: r.user_feedback,
      created_at: r.created_at,
    })
  } catch (err) {
    console.error('Get appeal progress error:', err)
    res.status(500).json({ error: '获取申诉进度失败' })
  }
})

app.put('/api/sessions/:id/appeal-progress', requireUser, async (req, res) => {
  try {
    const sessionId = req.params.id
    const { status, feedback, rejectionReason } = req.body || {}
    const validStatuses = ['generated', 'submitted', 'under_review', 'approved', 'rejected', 'resubmitted']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }
    // Check if appeal text exists for this session
    const [rows] = await pool.execute(
      'SELECT id FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    if (rows.length === 0) return res.status(404).json({ error: '未找到申诉记录' })

    const updates = ['appeal_status = ?']
    const params = [status]
    const now = new Date()
    if (feedback) { updates.push('user_feedback = ?'); params.push(feedback) }
    if (rejectionReason) { updates.push('rejection_reason = ?'); params.push(rejectionReason) }
    if (status === 'submitted' || status === 'resubmitted') { updates.push('submitted_at = ?'); params.push(now) }
    if (status === 'approved' || status === 'rejected') { updates.push('result_at = ?'); params.push(now) }
    if (status === 'resubmitted') { updates.push('resubmit_count = resubmit_count + 1') }

    params.push(rows[0].id)
    await pool.execute(`UPDATE appeal_texts SET ${updates.join(', ')} WHERE id = ?`, params)

    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    res.json({ success: true, status, label: statusLabels[status] })
  } catch (err) {
    console.error('Update appeal progress error:', err)
    res.status(500).json({ error: '更新申诉进度失败' })
  }
})

// ========== 驳回后智能重申策略 ==========

app.post('/api/sessions/:id/resubmit-strategy', requireUser, async (req, res) => {
  try {
    const sessionId = req.params.id
    const session = await getSessionById(sessionId)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = typeof session.collected_data === 'string' ? JSON.parse(session.collected_data || '{}') : (session.collected_data || {})

    // 获取驳回原因
    const [rows] = await pool.execute(
      'SELECT rejection_reason, resubmit_count FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    const rejectionReason = rows[0]?.rejection_reason || req.body?.rejectionReason || ''
    const resubmitCount = rows[0]?.resubmit_count || 0
    const reasonLower = rejectionReason.toLowerCase()

    // 基于驳回原因生成改进方案
    const improvements = []
    const newMaterials = []
    const textFixes = []

    // 通用改进
    improvements.push({ priority: 'high', action: '拨打95017转3确认具体驳回原因', detail: '电话中记录客服的原话，这是最准确的驳回原因。话术参考「申诉指导→95017话术」Tab' })

    if (reasonLower.includes('材料') || reasonLower.includes('不完整') || reasonLower.includes('缺少') || reasonLower.includes('不足')) {
      improvements.push({ priority: 'high', action: '补充缺失材料', detail: '对照「申诉指导→材料清单」逐项检查，确保每项都有对应文件' })
      newMaterials.push('法人手持身份证+营业执照合影（如之前未提供）')
      newMaterials.push('补充更多交易订单凭证（至少5笔）')
      textFixes.push('在补充说明中列出本次新增的所有材料清单')
    }

    if (reasonLower.includes('投诉') || reasonLower.includes('纠纷') || reasonLower.includes('消费者')) {
      improvements.push({ priority: 'urgent', action: '优先处理所有消费者投诉', detail: '在商户后台→消费者投诉中逐一回复并协商解决，目标：投诉状态全部变为"已处理完成"' })
      newMaterials.push('所有投诉的处理完成截图')
      newMaterials.push('退款凭证截图（每笔投诉对应的退款记录）')
      newMaterials.push('消费者确认已解决的聊天截图（如有）')
      textFixes.push('在「投诉产生原因」中详细说明每笔投诉的处理结果')
      textFixes.push('在「投诉处理方法」中新增已落实的整改措施')
    }

    if (reasonLower.includes('真实') || reasonLower.includes('交易') || reasonLower.includes('虚假') || reasonLower.includes('刷单')) {
      improvements.push({ priority: 'high', action: '补充交易真实性证据', detail: '每笔被质疑的订单都需要：订单截图+物流单号+签收记录+客户沟通记录' })
      newMaterials.push('物流签收记录（含签收照片）')
      newMaterials.push('与买家的微信/电话沟通记录截图')
      newMaterials.push('进货合同或供应商发票')
      newMaterials.push('仓库实拍照片（含商品和包装）')
      textFixes.push('在业务模式说明中详细描述完整的交易流程')
    }

    if (reasonLower.includes('整改') || reasonLower.includes('违规') || reasonLower.includes('合规')) {
      improvements.push({ priority: 'high', action: '提供整改证据', detail: '截图保存整改前后的对比，撰写详细的整改措施说明' })
      newMaterials.push('整改前后对比截图')
      newMaterials.push('《整改措施说明书》（含具体措施+执行时间+责任人）')
      textFixes.push('在补充说明中重点描述已完成的整改措施和预防机制')
    }

    if (reasonLower.includes('资质') || reasonLower.includes('许可') || reasonLower.includes('证照')) {
      improvements.push({ priority: 'high', action: '补充行业资质证明', detail: '提供与经营范围对应的所有资质证书' })
      newMaterials.push('行业经营许可证（如食品/医疗/教育等）')
      newMaterials.push('相关从业人员资质证明')
    }

    if (reasonLower.includes('说明') || reasonLower.includes('不清') || reasonLower.includes('模糊')) {
      improvements.push({ priority: 'medium', action: '优化申诉文案表述', detail: '重新生成申诉文案，使用更具体的数据和事实，避免模糊表述' })
      textFixes.push('用具体数字替代模糊描述（如"大量"→"共15笔，金额合计¥3,200"）')
      textFixes.push('每段申诉文案都要有对应的证据支撑')
    }

    // 通用建议
    if (resubmitCount >= 2) {
      improvements.push({ priority: 'medium', action: '考虑寻求专业协助', detail: '多次被驳回说明案件有一定难度，专业团队可以帮助分析具体问题并针对性优化' })
    }
    improvements.push({ priority: 'medium', action: '重新生成申诉文案', detail: '在平台点击「📄 申诉文案」重新生成，系统会根据最新信息优化内容' })

    res.json({
      rejection_reason: rejectionReason,
      resubmit_count: resubmitCount,
      improvements,
      new_materials: newMaterials,
      text_fixes: textFixes,
      timeline: resubmitCount >= 2 ? '建议准备5-7天后重新提交' : '建议准备3-5天后重新提交',
      tip: '每次重新申诉必须有实质性的新证据或新说明，切勿简单重复提交',
    })
  } catch (err) {
    console.error('Resubmit strategy error:', err)
    res.status(500).json({ error: '生成重申策略失败' })
  }
})

// ========== 用户申诉记录一览 ==========

app.get('/api/user/:id/appeal-records', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const uid = parseInt(req.params.id)
    const [rows] = await pool.execute(`
      SELECT at.session_id, at.appeal_status, at.submitted_at, at.result_at, at.rejection_reason, at.resubmit_count, at.created_at,
             s.collected_data
      FROM appeal_texts at
      LEFT JOIN sessions s ON at.session_id = s.session_id
      WHERE at.user_id = ?
      ORDER BY at.created_at DESC
      LIMIT 20
    `, [uid])
    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    const records = rows.map(r => {
      let info = {}
      try { info = typeof r.collected_data === 'string' ? JSON.parse(r.collected_data) : (r.collected_data || {}) } catch {}
      return {
        session_id: r.session_id,
        status: r.appeal_status || 'generated',
        label: statusLabels[r.appeal_status] || '已生成文案',
        merchant_name: info.merchant_name || info.company_name || '',
        problem_type: info.problem_type || '',
        violation_reason: info.violation_reason || '',
        submitted_at: r.submitted_at,
        result_at: r.result_at,
        rejection_reason: r.rejection_reason,
        resubmit_count: r.resubmit_count || 0,
        created_at: r.created_at,
      }
    })
    res.json({ records })
  } catch (err) {
    console.error('Get appeal records error:', err)
    res.status(500).json({ error: '获取申诉记录失败' })
  }
})

// ========== 用户消费明细 ==========

app.get('/api/user/:id/usage', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const uid = parseInt(req.params.id)
    const [usage, stats, rechargeOrders] = await Promise.all([
      getUserTokenUsage(uid, 100),
      getUserTokenStats(uid),
      getUserRechargeOrders(uid),
    ])
    const user = await getUserById(uid)
    res.json({
      balance: user ? parseFloat(user.balance) : 0,
      totalSpent: user ? parseFloat(user.total_spent) : 0,
      stats,
      usage,
      rechargeOrders,
    })
  } catch (err) {
    console.error('Get usage error:', err)
    res.status(500).json({ error: '获取消费明细失败' })
  }
})

// ========== 充值 API（真实支付集成） ==========

// 获取充值配置（公开接口）
app.get('/api/recharge/config', async (req, res) => {
  try {
    const enabled = await getSystemConfig('recharge_enabled')
    if (enabled !== '1') return res.json({ enabled: false })
    const [amounts, minAmount, qrWechat, qrAlipay, instructions] = await Promise.all([
      getSystemConfig('recharge_amounts'),
      getSystemConfig('recharge_min_amount'),
      getSystemConfig('recharge_qr_wechat'),
      getSystemConfig('recharge_qr_alipay'),
      getSystemConfig('recharge_instructions'),
    ])
    // 检测真实支付渠道配置状态
    const channels = getPaymentChannels()
    res.json({
      enabled: true,
      amounts: (amounts || '10,30,50,100,200,500').split(',').map(s => parseFloat(s.trim())).filter(n => n > 0),
      minAmount: parseFloat(minAmount || '10'),
      qrWechat: qrWechat || '',
      qrAlipay: qrAlipay || '',
      instructions: instructions || '',
      // 真实支付渠道可用状态
      paymentChannels: channels,
      realPayment: channels.wechat || channels.alipay || channels.epay || channels.codepay,
    })
  } catch (err) {
    console.error('Recharge config error:', err)
    res.status(500).json({ error: '获取充值配置失败' })
  }
})

// 用户提交充值订单（需登录）— 支持真实支付和手动充值两种模式
app.post('/api/recharge', requireUser, async (req, res) => {
  try {
    const { amount, paymentMethod, remark } = req.body
    const userId = req.userId
    if (!userId) return res.status(400).json({ error: '请先登录' })
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: '请选择充值金额' })
    if (!paymentMethod) return res.status(400).json({ error: '请选择支付方式' })
    const minAmount = parseFloat((await getSystemConfig('recharge_min_amount')) || '10')
    if (parseFloat(amount) < minAmount) return res.status(400).json({ error: `最低充值金额为 ¥${minAmount}` })

    const channels = getPaymentChannels()
    const realAmount = parseFloat(amount)

    // 判断是否为真实支付渠道
    const isRealPay = (paymentMethod === 'wechat' && channels.wechat) ||
      (paymentMethod === 'alipay' && channels.alipay) ||
      (paymentMethod.startsWith('epay_') && channels.epay) ||
      (paymentMethod.startsWith('codepay_') && channels.codepay)

    // 真实支付模式
    if (isRealPay) {
      const outTradeNo = generateOutTradeNo()
      const orderId = await createRechargeOrder(userId, realAmount, paymentMethod, remark || '', outTradeNo)

      try {
        const payResult = await createPayment(paymentMethod, outTradeNo, realAmount, '商户申诉助手-账户充值')
        console.log(`[支付] 用户${userId} 创建${paymentMethod}支付订单: ${outTradeNo}, 金额: ¥${realAmount}`)
        res.json({
          success: true,
          orderId,
          realPayment: true,
          paymentMethod,
          outTradeNo,
          ...payResult,
        })
      } catch (payErr) {
        console.error(`[支付] 创建支付订单失败:`, payErr.message)
        // 支付创建失败，回退到手动模式
        res.json({
          success: true,
          orderId,
          realPayment: false,
          message: `${paymentMethod === 'wechat' ? '微信' : '支付宝'}支付暂不可用，请使用扫码转账方式。管理员确认后余额将自动到账。`,
        })
      }
    } else {
      // 手动充值模式（兜底）：用户扫码转账，管理员手动确认
      const orderId = await createRechargeOrder(userId, realAmount, paymentMethod, remark || '')
      res.json({ success: true, orderId, realPayment: false })
    }
  } catch (err) {
    console.error('Create recharge order error:', err)
    res.status(500).json({ error: '提交充值订单失败' })
  }
})

// 查询支付状态（前端轮询）
app.get('/api/recharge/status/:outTradeNo', requireUser, async (req, res) => {
  try {
    const { outTradeNo } = req.params
    if (!outTradeNo) return res.status(400).json({ error: '缺少订单号' })

    // 先查数据库状态
    const orders = await getUserRechargeOrders(req.userId)
    const order = orders.find(o => o.out_trade_no === outTradeNo)
    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.status === 'confirmed') return res.json({ status: 'paid', message: '支付成功，余额已到账' })
    if (order.status === 'rejected') return res.json({ status: 'failed', message: '订单已取消' })

    // 查询支付平台状态
    const channels = getPaymentChannels()
    if (order.payment_method === 'wechat' && channels.wechat) {
      try {
        const result = await queryPaymentStatus('wechat', outTradeNo)
        if (result.tradeState === 'SUCCESS') {
          // 自动确认订单
          await confirmRechargeOrder(order.id)
          const user = await getUserById(req.userId)
          console.log(`[支付] 微信支付成功自动确认: ${outTradeNo}, 用户${req.userId}, 金额: ¥${order.amount}`)
          return res.json({ status: 'paid', message: '支付成功，余额已到账', balance: parseFloat(user.balance) })
        }
        return res.json({ status: result.tradeState === 'NOTPAY' ? 'pending' : result.tradeState.toLowerCase() })
      } catch (e) {
        return res.json({ status: 'pending' })
      }
    } else if (order.payment_method === 'alipay' && channels.alipay) {
      try {
        const result = await queryPaymentStatus('alipay', outTradeNo)
        if (result.tradeState === 'TRADE_SUCCESS' || result.tradeState === 'TRADE_FINISHED') {
          await confirmRechargeOrder(order.id)
          const user = await getUserById(req.userId)
          console.log(`[支付] 支付宝支付成功自动确认: ${outTradeNo}, 用户${req.userId}, 金额: ¥${order.amount}`)
          return res.json({ status: 'paid', message: '支付成功，余额已到账', balance: parseFloat(user.balance) })
        }
        return res.json({ status: result.tradeState === 'WAIT_BUYER_PAY' ? 'pending' : result.tradeState.toLowerCase() })
      } catch (e) {
        return res.json({ status: 'pending' })
      }
    }

    res.json({ status: 'pending' })
  } catch (err) {
    console.error('Query payment status error:', err)
    res.status(500).json({ error: '查询支付状态失败' })
  }
})

// ========== 支付回调通知 ==========

// 微信支付回调通知
app.post('/api/payment/wechat/notify', async (req, res) => {
  try {
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8')
    const result = handleWechatNotify(req.headers, rawBody)

    console.log(`[微信支付回调] 订单: ${result.out_trade_no}, 状态: ${result.trade_state}`)

    if (result.trade_state === 'SUCCESS') {
      const outTradeNo = result.out_trade_no
      // 查找并确认充值订单
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[微信支付回调] 自动确认订单: ${outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }

    // 微信要求返回 200 + JSON
    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (err) {
    console.error('[微信支付回调] 处理失败:', err.message)
    res.status(500).json({ code: 'FAIL', message: err.message })
  }
})

// 支付宝回调通知
app.post('/api/payment/alipay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[支付宝回调] 订单: ${params.out_trade_no}, 状态: ${params.trade_status}`)

    const result = handleAlipayNotify(params)

    if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
      const outTradeNo = result.outTradeNo
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[支付宝回调] 自动确认订单: ${outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }

    // 支付宝要求返回纯文本 "success"
    res.send('success')
  } catch (err) {
    console.error('[支付宝回调] 处理失败:', err.message)
    res.send('fail')
  }
})

// 易支付回调通知
app.post('/api/payment/epay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[易支付回调] 订单: ${params.out_trade_no}, 状态: ${params.trade_status}`)
    const result = handleEpayNotify(params)
    if (result.tradeStatus === 'SUCCESS') {
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === result.outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[易支付回调] 自动确认订单: ${result.outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }
    res.send('success')
  } catch (err) {
    console.error('[易支付回调] 处理失败:', err.message)
    res.send('fail')
  }
})
// 易支付同步返回
app.get('/api/payment/epay/return', async (req, res) => {
  res.redirect('/recharge-success')
})

// 码支付回调通知
app.post('/api/payment/codepay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[码支付回调] 订单: ${params.pay_id}`)
    const result = handleCodePayNotify(params)
    if (result.tradeStatus === 'SUCCESS') {
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === result.outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[码支付回调] 自动确认订单: ${result.outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }
    res.send('success')
  } catch (err) {
    console.error('[码支付回调] 处理失败:', err.message)
    res.send('fail')
  }
})
// 码支付同步返回
app.get('/api/payment/codepay/return', async (req, res) => {
  res.redirect('/recharge-success')
})

// 用户查看自己的充值记录
app.get('/api/recharge/orders', requireUser, async (req, res) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(400).json({ error: '缺少用户ID' })
    const orders = await getUserRechargeOrders(userId)
    res.json({ orders })
  } catch (err) {
    console.error('Get user recharge orders error:', err)
    res.status(500).json({ error: '获取充值记录失败' })
  }
})

// ========== 管理员 API ==========

// 登录（不需要 JWT，返回 JWT）
app.post('/api/admin/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' })
    const admin = await verifyAdmin(username, password)
    if (admin) {
      const token = signToken({ id: admin.id, username: admin.username, role: 'admin' })
      res.json({ success: true, token })
    } else {
      res.status(401).json({ error: '用户名或密码错误' })
    }
  } catch (err) {
    console.error('Admin login error:', err)
    res.status(500).json({ error: '登录失败' })
  }
})

// 修改管理员密码
app.put('/api/admin/password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' })
    await changeAdminPassword(req.admin.id, newPassword)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '修改密码失败' })
  }
})

// 以下所有 /api/admin/* 路由都需要 JWT 认证
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try { res.json({ users: await getAllUsers() }) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取用户列表失败' }) }
})

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    await deleteUser(req.params.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Delete user error:', err)
    res.status(500).json({ error: '删除用户失败' })
  }
})

app.post('/api/admin/users/:id/balance', requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body
    if (amount === undefined || isNaN(parseFloat(amount))) return res.status(400).json({ error: '请输入有效金额' })
    const user = await adjustUserBalance(req.params.id, parseFloat(amount))
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '调整余额失败' })
  }
})

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try { res.json(await getDashboardStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取统计失败' }) }
})

app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  try { res.json({ sessions: await getAllSessions() }) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取会话列表失败' }) }
})

app.get('/api/admin/sessions/:id/messages', requireAdmin, async (req, res) => {
  try {
    const [messages, session] = await Promise.all([
      getMessages(req.params.id), getSession(req.params.id)
    ])
    res.json({ messages, session })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取聊天记录失败' }) }
})

app.delete('/api/admin/sessions/:id', requireAdmin, async (req, res) => {
  try { await deleteSession(req.params.id); res.json({ success: true }) }
  catch (err) { console.error(err); res.status(500).json({ error: '删除失败' }) }
})

// 管理员人工回复客户消息
app.post('/api/admin/sessions/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) return res.status(400).json({ error: '回复内容不能为空' })
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    await addMessage(req.params.id, 'admin', content.trim())
    const messages = await getMessages(req.params.id)
    res.json({ success: true, messages })
  } catch (err) {
    console.error('Admin reply error:', err)
    res.status(500).json({ error: '回复失败' })
  }
})

// ========== 充值订单管理（管理员） ==========

app.get('/api/admin/recharge-orders', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || null
    const orders = await getRechargeOrders(status)
    const pendingCount = await getPendingRechargeCount()
    res.json({ orders, pendingCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取充值订单失败' })
  }
})

app.put('/api/admin/recharge-orders/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const order = await confirmRechargeOrder(req.params.id, req.admin.id, req.body.adminNote || '')
    if (!order) return res.status(404).json({ error: '订单不存在或已处理' })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '确认充值失败' })
  }
})

app.put('/api/admin/recharge-orders/:id/reject', requireAdmin, async (req, res) => {
  try {
    await rejectRechargeOrder(req.params.id, req.admin.id, req.body.adminNote || '')
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '拒绝充值失败' })
  }
})

// ========== 知识库 API（需要管理员认证） ==========

app.get('/api/admin/cases', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'active'
    const cases = await getSuccessCases(status)
    res.json({ cases })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取案例失败' }) }
})

app.get('/api/admin/cases/:id', requireAdmin, async (req, res) => {
  try {
    const c = await getSuccessCaseById(req.params.id)
    if (!c) return res.status(404).json({ error: '案例不存在' })
    res.json({ case: c })
  } catch (err) { res.status(500).json({ error: '获取失败' }) }
})

// 从会话标记为成功案例
app.post('/api/admin/cases/from-session', requireAdmin, async (req, res) => {
  try {
    const { sessionId, title, successSummary, adminNotes } = req.body
    if (!sessionId) return res.status(400).json({ error: '缺少会话ID' })
    const session = await getSession(sessionId)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const msgs = await getMessages(sessionId)
    const reportMsg = [...msgs].reverse().find(m => m.role === 'assistant' && m.content && (m.content.match(/^###\s+/gm) || []).length >= 2)
    const cd = session.collected_data || {}
    const id = await createSuccessCase({
      sessionId,
      title: title || cd.company_name || cd.merchant_name || `案例-${sessionId.slice(0, 8)}`,
      industry: cd.industry || '',
      problemType: cd.problem_type || '',
      collectedData: cd,
      reportContent: reportMsg?.content || '',
      successSummary: successSummary || '',
      adminNotes: adminNotes || '',
    })
    res.json({ success: true, id })
  } catch (err) { console.error(err); res.status(500).json({ error: '创建案例失败' }) }
})

// 手动创建案例
app.post('/api/admin/cases', requireAdmin, async (req, res) => {
  try {
    const { title, industry, problemType, reportContent, successSummary, adminNotes } = req.body
    if (!title) return res.status(400).json({ error: '标题不能为空' })
    const id = await createSuccessCase({ title, industry, problemType, reportContent, successSummary, adminNotes, collectedData: {} })
    res.json({ success: true, id })
  } catch (err) { console.error(err); res.status(500).json({ error: '创建失败' }) }
})

app.put('/api/admin/cases/:id', requireAdmin, async (req, res) => {
  try {
    await updateSuccessCase(req.params.id, req.body)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '更新失败' }) }
})

app.delete('/api/admin/cases/:id', requireAdmin, async (req, res) => {
  try {
    await deleteSuccessCase(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '删除失败' }) }
})

// ========== 配置 API（需要管理员认证） ==========

// ========== AI 模型管理 API ==========

// 获取所有模型
app.get('/api/admin/ai-models', requireAdmin, async (req, res) => {
  try {
    const models = await getAIModels()
    // 隐藏完整 API Key，只返回掩码
    const safe = models.map(m => ({
      ...m,
      api_key_masked: m.api_key ? m.api_key.slice(0, 6) + '****' + m.api_key.slice(-4) : '',
      has_key: !!m.api_key,
      api_key: undefined,
    }))
    res.json({ models: safe })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取模型列表失败' }) }
})

// 创建新模型
app.post('/api/admin/ai-models', requireAdmin, async (req, res) => {
  try {
    const { provider, displayName, apiKey, modelName, endpoint, isFree, sortOrder } = req.body
    if (!provider || !modelName || !endpoint) return res.status(400).json({ error: '缺少必填字段' })
    const result = await createAIModel({ provider, displayName: displayName || modelName, apiKey, modelName, endpoint, isFree, sortOrder })
    res.json({ success: true, id: result.id })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该供应商下已存在同名模型' })
    console.error(err); res.status(500).json({ error: '创建失败' })
  }
})

// 更新模型配置
app.put('/api/admin/ai-models/:id', requireAdmin, async (req, res) => {
  try {
    const { displayName, apiKey, modelName, endpoint, isEnabled, isFree, sortOrder } = req.body
    await updateAIModel(req.params.id, { displayName, apiKey, modelName, endpoint, isEnabled, isFree, sortOrder })
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新失败' }) }
})

// 激活模型（设为当前使用）
app.put('/api/admin/ai-models/:id/activate', requireAdmin, async (req, res) => {
  try {
    const model = await getAIModelById(req.params.id)
    if (!model) return res.status(404).json({ error: '模型不存在' })
    if (!model.api_key) return res.status(400).json({ error: '请先配置 API Key' })
    await setActiveAIModel(req.params.id)
    res.json({ success: true, model: model.display_name })
  } catch (err) { console.error(err); res.status(500).json({ error: '激活失败' }) }
})

// 删除模型
app.delete('/api/admin/ai-models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await getAIModelById(req.params.id)
    if (!model) return res.status(404).json({ error: '模型不存在' })
    if (model.is_active) return res.status(400).json({ error: '不能删除当前激活的模型' })
    await deleteAIModelDB(req.params.id)
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '删除失败' }) }
})

// 测试指定模型连接（支持传入 modelId 或直接传 endpoint+apiKey+model）
app.post('/api/admin/ai-models/test', requireAdmin, async (req, res) => {
  try {
    let endpoint, apiKey, modelName, provider
    if (req.body.modelId) {
      const m = await getAIModelById(req.body.modelId)
      if (!m) return res.json({ success: false, error: '模型不存在' })
      endpoint = m.endpoint; apiKey = req.body.apiKey || m.api_key; modelName = m.model_name; provider = m.provider
    } else {
      endpoint = req.body.endpoint; apiKey = req.body.apiKey; modelName = req.body.modelName; provider = req.body.provider || 'custom'
    }
    if (!apiKey) return res.json({ success: false, error: '未配置 API Key' })
    if (!endpoint) return res.json({ success: false, error: '未配置 API 端点' })

    console.log(`[Test AI:${provider}] Model: ${modelName}, Key: ${apiKey.slice(0, 6)}****`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelName, messages: [{ role: 'user', content: '你好，请用一句话介绍你自己' }], max_tokens: 50 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!r.ok) {
      const errText = await r.text()
      return res.json({ success: false, error: `API ${r.status}: ${errText.substring(0, 200)}` })
    }

    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content || ''
    res.json({ success: true, reply: reply.substring(0, 200), model: data.model || modelName, provider })
  } catch (err) {
    console.error('[Test AI]', err.message)
    res.json({ success: false, error: err.name === 'AbortError' ? '请求超时(30s)' : err.message })
  }
})

// 兼容旧接口：测试当前激活模型
app.post('/api/admin/test-deepseek', requireAdmin, async (req, res) => {
  try {
    const cfg = await getAIConfig()
    const key = req.body.apiKey || cfg.apiKey
    if (!key) return res.json({ success: false, error: '未配置 API Key' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const r = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: '你好' }], max_tokens: 20 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!r.ok) { const t = await r.text(); return res.json({ success: false, error: `API ${r.status}: ${t.substring(0, 200)}` }) }
    const data = await r.json()
    res.json({ success: true, reply: (data.choices?.[0]?.message?.content || '').substring(0, 100), model: data.model, provider: cfg.provider })
  } catch (err) { res.json({ success: false, error: err.message }) }
})

// ========== AI模型智能导入（自动检测API Key所属平台并批量配置） ==========
app.post('/api/admin/ai-models/auto-import', requireAdmin, async (req, res) => {
  try {
    const { apiKey } = req.body
    if (!apiKey || apiKey.trim().length < 10) return res.status(400).json({ error: '请输入有效的 API Key' })
    const key = apiKey.trim()

    // 各平台检测配置：endpoint + 测试model + 该key可用的所有模型
    const providers = [
      {
        name: 'deepseek', label: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/chat/completions',
        testModel: 'deepseek-chat',
        models: [
          { model: 'deepseek-chat', display: 'DeepSeek-Chat', free: 0 },
          { model: 'deepseek-reasoner', display: 'DeepSeek-Reasoner', free: 0 },
        ]
      },
      {
        name: 'zhipu', label: '智谱AI',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        testModel: 'glm-4.7-flash',
        models: [
          { model: 'glm-4.7-flash', display: '智谱GLM-4-Flash（免费）', free: 1 },
          { model: 'glm-4-plus', display: '智谱GLM-4-Plus', free: 0 },
          { model: 'glm-4-long', display: '智谱GLM-4-Long', free: 0 },
        ]
      },
      {
        name: 'qwen', label: '通义千问',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        testModel: 'qwen-turbo',
        models: [
          { model: 'qwen-turbo', display: '通义千问-Turbo', free: 0 },
          { model: 'qwen-plus', display: '通义千问-Plus', free: 0 },
          { model: 'qwen-max', display: '通义千问-Max', free: 0 },
          { model: 'qwen-long', display: '通义千问-Long', free: 0 },
        ]
      },
      {
        name: 'moonshot', label: 'Moonshot Kimi',
        endpoint: 'https://api.moonshot.cn/v1/chat/completions',
        testModel: 'moonshot-v1-8k',
        models: [
          { model: 'moonshot-v1-8k', display: 'Moonshot Kimi-v1-8K', free: 0 },
          { model: 'moonshot-v1-32k', display: 'Moonshot Kimi-v1-32K', free: 0 },
          { model: 'moonshot-v1-128k', display: 'Moonshot Kimi-v1-128K', free: 0 },
        ]
      },
      {
        name: 'siliconflow', label: 'SiliconFlow',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        testModel: 'deepseek-ai/DeepSeek-V3',
        models: [
          { model: 'deepseek-ai/DeepSeek-V3', display: 'SiliconFlow DeepSeek-V3（免费）', free: 1 },
          { model: 'Qwen/Qwen2.5-7B-Instruct', display: 'SiliconFlow Qwen2.5-7B（免费）', free: 1 },
          { model: 'THUDM/glm-4-9b-chat', display: 'SiliconFlow GLM4-9B（免费）', free: 1 },
          { model: '01-ai/Yi-1.5-9B-Chat-16K', display: 'SiliconFlow Yi-1.5-9B（免费）', free: 1 },
          { model: 'meta-llama/Meta-Llama-3-8B-Instruct', display: 'SiliconFlow Llama3-8B（免费）', free: 1 },
          { model: 'internlm/internlm2_5-7b-chat', display: 'SiliconFlow InternLM2.5-7B（免费）', free: 1 },
        ]
      },
      {
        name: 'yi', label: '零一万物',
        endpoint: 'https://api.lingyiwanwu.com/v1/chat/completions',
        testModel: 'yi-lightning',
        models: [
          { model: 'yi-lightning', display: '零一万物Yi-Lightning', free: 0 },
          { model: 'yi-large', display: '零一万物Yi-Large', free: 0 },
        ]
      },
      {
        name: 'spark', label: '讯飞星火',
        endpoint: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
        testModel: 'generalv3',
        models: [
          { model: 'generalv3', display: '讯飞星火-Lite（免费）', free: 1 },
          { model: 'generalv3.5', display: '讯飞星火-Pro', free: 0 },
          { model: 'general4.0', display: '讯飞星火-Max', free: 0 },
        ]
      },
      {
        name: 'stepfun', label: '阶跃星辰',
        endpoint: 'https://api.stepfun.com/v1/chat/completions',
        testModel: 'step-1-8k',
        models: [
          { model: 'step-1-8k', display: '阶跃星辰Step-1-8K', free: 0 },
          { model: 'step-2-16k', display: '阶跃星辰Step-2-16K', free: 0 },
        ]
      },
      {
        name: 'openai', label: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        testModel: 'gpt-4o-mini',
        models: [
          { model: 'gpt-4o-mini', display: 'OpenAI GPT-4o-mini', free: 0 },
          { model: 'gpt-4o', display: 'OpenAI GPT-4o', free: 0 },
          { model: 'gpt-4-turbo', display: 'OpenAI GPT-4-Turbo', free: 0 },
        ]
      },
      {
        name: 'groq', label: 'Groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        testModel: 'llama3-70b-8192',
        models: [
          { model: 'llama3-70b-8192', display: 'Groq Llama3-70B（免费）', free: 1 },
          { model: 'mixtral-8x7b-32768', display: 'Groq Mixtral-8x7B（免费）', free: 1 },
        ]
      },
    ]

    console.log(`[Auto-Import] 开始检测 API Key: ${key.slice(0, 8)}****`)
    let detected = null

    // 并行检测所有平台（带超时）
    const results = await Promise.allSettled(providers.map(async (p) => {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 15000)
        const r = await fetch(p.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ model: p.testModel, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
          signal: ctrl.signal,
        })
        clearTimeout(timer)
        if (r.ok) return { provider: p, status: 'ok' }
        const errText = await r.text()
        // 401/403 = key不属于这个平台，其他错误可能是模型问题但key有效
        if (r.status === 401 || r.status === 403) return { provider: p, status: 'auth_failed' }
        if (r.status === 429) return { provider: p, status: 'ok' } // 限频说明key有效
        return { provider: p, status: 'error', error: errText.slice(0, 100) }
      } catch (e) {
        return { provider: p, status: 'error', error: e.message }
      }
    }))

    // 找到验证通过的平台
    const matched = results.filter(r => r.status === 'fulfilled' && r.value.status === 'ok').map(r => r.value)
    
    if (matched.length === 0) {
      return res.json({ success: false, error: '未能识别该 API Key 所属平台。请确认 Key 是否正确。', tested: providers.map(p => p.label) })
    }

    // 批量导入匹配平台的所有模型
    const imported = []
    for (const m of matched) {
      const p = m.provider
      for (const model of p.models) {
        try {
          // 检查是否已存在
          const existingModels = await getAIModels()
          const existing = existingModels.find(e => e.provider === p.name && e.model_name === model.model)
          if (existing) {
            // 更新API Key
            await updateAIModel(existing.id, { apiKey: key })
            imported.push({ id: existing.id, name: model.display, action: 'updated' })
          } else {
            // 创建新模型
            const result = await createAIModel({
              provider: p.name, displayName: model.display, apiKey: key,
              modelName: model.model, endpoint: p.endpoint, isFree: model.free, sortOrder: 50
            })
            imported.push({ id: result.id, name: model.display, action: 'created' })
          }
        } catch (e) {
          imported.push({ name: model.display, action: 'failed', error: e.message })
        }
      }
    }

    // 如果当前没有活跃模型，自动激活第一个导入的
    const activeModel = await getActiveAIModel()
    if (!activeModel && imported.length > 0) {
      const first = imported.find(i => i.id && i.action !== 'failed')
      if (first) await setActiveAIModel(first.id)
    }

    console.log(`[Auto-Import] 完成: ${matched.map(m => m.provider.label).join(', ')} → ${imported.length} 个模型`)
    res.json({
      success: true,
      provider: matched.map(m => m.provider.label),
      imported,
      message: `检测到 ${matched.map(m => m.provider.label).join('/')} 平台，已自动配置 ${imported.length} 个模型`,
    })
  } catch (err) {
    console.error('[Auto-Import]', err)
    res.status(500).json({ error: '自动导入失败: ' + err.message })
  }
})

// ========== 管理员数据清理（修复加密乱码） ==========
app.post('/api/admin/fix-encrypted-data', requireAdmin, async (req, res) => {
  try {
    const result = await fixEncryptedData()
    res.json({ success: true, ...result, message: `共 ${result.total} 个用户，修复了 ${result.fixed} 个乱码数据` })
  } catch (err) { console.error(err); res.status(500).json({ error: '修复失败: ' + err.message }) }
})

// ========== 模型健康检测 API ==========

// 获取所有模型（含健康状态）
app.get('/api/admin/ai-models/health', requireAdmin, async (req, res) => {
  try {
    const models = await getAIModelsWithHealth()
    // 安全处理：掩码 API Key，不泄露到前端
    const safe = models.map(m => ({
      ...m,
      api_key_masked: m.api_key ? m.api_key.slice(0, 6) + '****' + m.api_key.slice(-4) : '',
      has_key: !!m.api_key,
      api_key: undefined,
    }))
    const active = safe.find(m => m.is_active)
    res.json({ models: safe, activeModelId: active?.id || null })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取模型状态失败' }) }
})

// 批量检测所有模型
app.post('/api/admin/ai-models/check-all', requireAdmin, async (req, res) => {
  try {
    const results = await checkAllModels()
    const switchResult = await autoSwitchIfNeeded()
    res.json({ results, autoSwitch: switchResult })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量检测失败' }) }
})

// 检测单个模型
app.post('/api/admin/ai-models/:id/check', requireAdmin, async (req, res) => {
  try {
    const result = await checkSingleModel(parseInt(req.params.id))
    res.json(result)
  } catch (err) { console.error(err); res.status(500).json({ error: '检测失败' }) }
})

// 手动触发自动切换
app.post('/api/admin/ai-models/auto-switch', requireAdmin, async (req, res) => {
  try {
    const result = await autoSwitchIfNeeded()
    res.json(result || { switched: false, reason: '当前模型正常，无需切换' })
  } catch (err) { console.error(err); res.status(500).json({ error: '切换失败' }) }
})

// ========== DeepSeek 多账号余额管理 API ==========

// 查询单个DeepSeek账号余额（调用官方API）
async function fetchDeepseekBalance(apiKey) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`)
    }
    const data = await res.json()
    const info = data.balance_infos?.[0] || {}
    return {
      isAvailable: data.is_available ?? false,
      totalBalance: parseFloat(info.total_balance || 0),
      grantedBalance: parseFloat(info.granted_balance || 0),
      toppedUpBalance: parseFloat(info.topped_up_balance || 0),
      currency: info.currency || 'CNY',
    }
  } catch (err) {
    clearTimeout(timeout)
    throw new Error(err.name === 'AbortError' ? '请求超时(15s)' : err.message)
  }
}

// 获取所有DeepSeek账号（掩码Key+余额）
app.get('/api/admin/deepseek-accounts', requireAdmin, async (req, res) => {
  try {
    const accounts = await getDeepseekAccounts()
    const safe = accounts.map(a => ({
      ...a,
      api_key_masked: a.api_key ? a.api_key.slice(0, 8) + '****' + a.api_key.slice(-4) : '',
      has_key: !!a.api_key,
      api_key: undefined,
      is_warning: a.total_balance !== null && parseFloat(a.total_balance) <= parseFloat(a.warning_threshold || 10),
    }))
    const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.total_balance || 0), 0)
    const warningCount = safe.filter(a => a.is_warning && a.is_enabled).length
    res.json({ accounts: safe, summary: { total: accounts.length, totalBalance: totalBalance.toFixed(2), warningCount } })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取账号列表失败' }) }
})

// 添加DeepSeek账号
app.post('/api/admin/deepseek-accounts', requireAdmin, async (req, res) => {
  try {
    const { label, apiKey, warningThreshold } = req.body
    if (!apiKey) return res.status(400).json({ error: '请填写 API Key' })
    const result = await createDeepseekAccount({ label, apiKey, warningThreshold })
    // 立即查询余额
    try {
      const balance = await fetchDeepseekBalance(apiKey)
      await updateDeepseekBalance(result.id, { totalBalance: balance.totalBalance, grantedBalance: balance.grantedBalance, toppedUpBalance: balance.toppedUpBalance, isAvailable: balance.isAvailable })
    } catch (e) {
      await updateDeepseekBalance(result.id, { error: e.message })
    }
    res.json({ success: true, id: result.id })
  } catch (err) { console.error(err); res.status(500).json({ error: '添加失败' }) }
})

// 更新DeepSeek账号
app.put('/api/admin/deepseek-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const { label, apiKey, isEnabled, warningThreshold } = req.body
    await updateDeepseekAccount(req.params.id, { label, apiKey, isEnabled, warningThreshold })
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新失败' }) }
})

// 删除DeepSeek账号
app.delete('/api/admin/deepseek-accounts/:id', requireAdmin, async (req, res) => {
  try {
    await deleteDeepseekAccount(req.params.id)
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '删除失败' }) }
})

// 批量查询所有账号余额 (NOTE: must be BEFORE :id routes to avoid Express matching 'check-all' as :id)
app.post('/api/admin/deepseek-accounts/check-all', requireAdmin, async (req, res) => {
  try {
    const accounts = await getDeepseekAccounts()
    const enabled = accounts.filter(a => a.is_enabled && a.api_key)
    const results = []
    for (const account of enabled) {
      try {
        const balance = await fetchDeepseekBalance(account.api_key)
        await updateDeepseekBalance(account.id, { totalBalance: balance.totalBalance, grantedBalance: balance.grantedBalance, toppedUpBalance: balance.toppedUpBalance, isAvailable: balance.isAvailable })
        results.push({ id: account.id, label: account.label, success: true, ...balance, isWarning: balance.totalBalance <= parseFloat(account.warning_threshold || 10) })
      } catch (err) {
        await updateDeepseekBalance(account.id, { error: err.message })
        results.push({ id: account.id, label: account.label, success: false, error: err.message })
      }
      // 避免限流
      if (enabled.indexOf(account) < enabled.length - 1) await new Promise(r => setTimeout(r, 300))
    }
    const totalBalance = results.filter(r => r.success).reduce((s, r) => s + r.totalBalance, 0)
    const warningCount = results.filter(r => r.isWarning).length
    res.json({ results, summary: { checked: results.length, totalBalance: totalBalance.toFixed(2), warningCount } })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量查询失败' }) }
})

// 查询单个账号余额
app.post('/api/admin/deepseek-accounts/:id/check-balance', requireAdmin, async (req, res) => {
  try {
    const account = await getDeepseekAccountById(parseInt(req.params.id))
    if (!account) return res.status(404).json({ error: '账号不存在' })
    if (!account.api_key) return res.json({ success: false, error: '未配置 API Key' })
    const balance = await fetchDeepseekBalance(account.api_key)
    await updateDeepseekBalance(account.id, { totalBalance: balance.totalBalance, grantedBalance: balance.grantedBalance, toppedUpBalance: balance.toppedUpBalance, isAvailable: balance.isAvailable })
    res.json({ success: true, ...balance, isWarning: balance.totalBalance <= parseFloat(account.warning_threshold || 10) })
  } catch (err) {
    const account = await getDeepseekAccountById(parseInt(req.params.id)).catch(() => null)
    if (account) await updateDeepseekBalance(account.id, { error: err.message })
    res.json({ success: false, error: err.message })
  }
})

// ========== 名片系统（多名片，公开+管理API）==========

// 公开API：获取所有活跃名片（兼容旧的单名片接口）
app.get('/api/contact-card', async (req, res) => {
  try {
    const cards = await getActiveContactCards()
    if (cards.length > 0) {
      // 新版：返回所有名片
      const formatted = cards.map(c => ({
        id: c.id, name: c.name, title: c.title, phone: c.phone, wechat: c.wechat,
        email: c.email, qrCode: c.qr_code, description: c.description,
        category: c.category, tags: c.tags,
      }))
      // 兼容旧版：enabled + 第一张名片的字段
      res.json({ enabled: true, cards: formatted, ...formatted[0] })
    } else {
      // 回退到旧的system_config方式
      const configs = await getSystemConfigs()
      const get = (key) => configs.find(c => c.config_key === key)?.config_value || ''
      const card = {
        name: get('tech_contact_name') || '技术支持',
        title: get('tech_contact_title') || 'AI申诉助手技术顾问',
        phone: get('tech_contact_phone'), wechat: get('tech_contact_wechat'),
        email: get('tech_contact_email'), qrCode: get('tech_contact_qr'),
        description: get('tech_contact_desc') || '专业商户申诉解决方案，有问题随时联系我',
        enabled: get('tech_contact_enabled') === '1',
      }
      res.json({ ...card, cards: card.enabled ? [card] : [] })
    }
  } catch (err) { res.json({ enabled: false, cards: [] }) }
})

// 公开API：点击名片计数
app.post('/api/contact-cards/:id/click', async (req, res) => {
  try {
    await incrementCardMetric(parseInt(req.params.id), 'click_count')
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '记录失败' }) }
})

// 管理API：名片CRUD
app.get('/api/admin/contact-cards', requireAdmin, async (req, res) => {
  try {
    const { status, category } = req.query
    const cards = await getContactCards({ status, category })
    res.json({ cards })
  } catch (err) { res.status(500).json({ error: '获取名片失败' }) }
})

app.get('/api/admin/contact-cards/:id', requireAdmin, async (req, res) => {
  try {
    const card = await getContactCardById(parseInt(req.params.id))
    if (!card) return res.status(404).json({ error: '名片不存在' })
    res.json({ card })
  } catch (err) { res.status(500).json({ error: '获取名片失败' }) }
})

app.post('/api/admin/contact-cards', requireAdmin, async (req, res) => {
  try {
    const { name, title, phone, wechat, email, qrCode, description, category, tags, targetAudience, sortOrder, status } = req.body
    if (!name) return res.status(400).json({ error: '名称不能为空' })
    const result = await createContactCard({ name, title, phone, wechat, email, qrCode, description, category, tags, targetAudience, sortOrder, status })
    res.json({ success: true, ...result })
  } catch (err) { res.status(500).json({ error: '创建名片失败: ' + err.message }) }
})

app.put('/api/admin/contact-cards/:id', requireAdmin, async (req, res) => {
  try {
    const card = await updateContactCard(parseInt(req.params.id), req.body)
    if (!card) return res.status(404).json({ error: '名片不存在' })
    res.json({ success: true, card })
  } catch (err) { res.status(500).json({ error: '更新名片失败' }) }
})

app.delete('/api/admin/contact-cards/:id', requireAdmin, async (req, res) => {
  try {
    await deleteContactCard(parseInt(req.params.id))
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '删除名片失败' }) }
})

// 管理员查看Token消费明细（支持分页/筛选）
app.get('/api/admin/token-usage', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId, dateFrom, dateTo } = req.query
    const [usage, stats] = await Promise.all([
      getAllTokenUsage(parseInt(limit), { page: parseInt(page), type, userId: userId ? parseInt(userId) : undefined, dateFrom, dateTo }),
      getTokenUsageStats(),
    ])
    res.json({ ...usage, stats })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取Token明细失败' }) }
})

app.get('/api/admin/system-config', requireAdmin, async (req, res) => {
  try { res.json({ configs: await getSystemConfigs() }) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取系统配置失败' }) }
})

app.put('/api/admin/system-config', requireAdmin, async (req, res) => {
  try {
    const configs = req.body.configs
    if (!Array.isArray(configs)) return res.status(400).json({ error: '配置数据格式错误' })
    await updateSystemConfigs(configs)
    res.json({ success: true })
  } catch (err) { console.error('[System Config Save Error]', err); res.status(500).json({ error: '更新系统配置失败: ' + err.message }) }
})

app.get('/api/admin/payment-config', requireAdmin, async (req, res) => {
  try { res.json({ configs: await getPaymentConfigs() }) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取支付配置失败' }) }
})

app.put('/api/admin/payment-config', requireAdmin, async (req, res) => {
  try {
    const configs = req.body.configs
    if (!Array.isArray(configs)) return res.status(400).json({ error: '配置数据格式错误' })
    await updatePaymentConfigs(configs)
    res.json({ success: true })
  } catch (err) { console.error('[Payment Config Save Error]', err); res.status(500).json({ error: '更新支付配置失败: ' + err.message }) }
})

// ========== AI 自进化 API（需要管理员认证） ==========

// --- 规则管理 ---
app.get('/api/admin/evolution/rules', requireAdmin, async (req, res) => {
  try {
    const { category, status } = req.query
    const rules = await getAllAIRules(category || null, status || null)
    res.json({ rules })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取规则列表失败' }) }
})

app.get('/api/admin/evolution/rules/stats', requireAdmin, async (req, res) => {
  try { res.json(await getAIRuleStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取规则统计失败' }) }
})

app.get('/api/admin/evolution/rules/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await getAIRuleById(parseInt(req.params.id))
    if (!rule) return res.status(404).json({ error: '规则不存在' })
    const changeLog = await getRuleChangeLog(rule.id, 20)
    res.json({ rule, changeLog })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取规则详情失败' }) }
})

app.post('/api/admin/evolution/rules', requireAdmin, async (req, res) => {
  try {
    const { category, ruleKey, ruleName, ruleContent, status } = req.body
    if (!category || !ruleKey) return res.status(400).json({ error: '缺少 category 或 ruleKey' })
    const result = await createAIRule({
      category, ruleKey, ruleName: ruleName || ruleKey,
      ruleContent: ruleContent || {}, source: 'admin_manual',
      status: status || 'active',
    })
    invalidateRulesCache()
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: '创建规则失败: ' + err.message }) }
})

app.put('/api/admin/evolution/rules/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body
    if (!status) return res.status(400).json({ error: '缺少 status' })
    const result = await updateAIRuleStatus(parseInt(req.params.id), status, reason || '', 'admin')
    if (!result) return res.status(404).json({ error: '规则不存在' })
    invalidateRulesCache()
    res.json({ success: true, rule: result })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新状态失败' }) }
})

app.put('/api/admin/evolution/rules/:id/content', requireAdmin, async (req, res) => {
  try {
    const { ruleContent, ruleName } = req.body
    if (!ruleContent) return res.status(400).json({ error: '缺少 ruleContent' })
    const result = await updateAIRuleContent(parseInt(req.params.id), ruleContent, ruleName || null, 'admin')
    if (!result) return res.status(404).json({ error: '规则不存在' })
    invalidateRulesCache()
    res.json({ success: true, rule: result })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新内容失败' }) }
})

app.delete('/api/admin/evolution/rules/:id', requireAdmin, async (req, res) => {
  try {
    await deleteAIRule(parseInt(req.params.id))
    invalidateRulesCache()
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '删除规则失败' }) }
})

// --- 对话分析 ---
app.get('/api/admin/evolution/analyses', requireAdmin, async (req, res) => {
  try {
    const { industry, sentiment, minCompletion, maxCompletion, limit } = req.query
    const analyses = await getConversationAnalyses(
      parseInt(limit) || 50,
      { industry, sentiment, minCompletion: minCompletion ? parseFloat(minCompletion) : undefined, maxCompletion: maxCompletion ? parseFloat(maxCompletion) : undefined }
    )
    res.json({ analyses })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取分析列表失败' }) }
})

app.get('/api/admin/evolution/analyses/stats', requireAdmin, async (req, res) => {
  try { res.json(await getAnalysisStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取分析统计失败' }) }
})

// 质量仪表板 - 多维度AI能力展示
app.get('/api/admin/evolution/quality-dashboard', requireAdmin, async (req, res) => {
  try {
    const [stats, qualityData] = await Promise.all([
      getAnalysisStats(),
      getQualityTopAndLow(),
    ])
    let mallStats = null, productStats = null
    try { mallStats = await getRecommendationStats() } catch {}
    try { productStats = await getProductStats() } catch {}
    const t = stats.totals || {}
    const total = parseInt(t.total) || 0
    const pct = (field) => total > 0 ? Math.round((parseInt(t[field]) || 0) / total * 100) : 0
    res.json({
      overview: {
        totalAnalyses: total,
        avgProfessionalism: parseFloat(t.avg_professionalism) || 0,
        avgAppealSuccess: parseFloat(t.avg_appeal_success) || 0,
        avgSatisfaction: parseFloat(t.avg_satisfaction) || 0,
        avgCompletion: parseFloat(t.avg_completion) || 0,
        avgTurns: parseFloat(t.avg_turns) || 0,
        highCompletionRate: pct('high_completion_count'),
        highProfRate: pct('high_prof_count'),
        highAppealRate: pct('high_appeal_count'),
        highSatisfactionRate: pct('high_satisfaction_count'),
      },
      sentiment: stats.bySentiment || [],
      trend: (stats.recent7d || []).map(d => ({
        day: d.day, count: parseInt(d.cnt),
        avgCompletion: parseFloat(d.avg_completion) || 0,
        avgProf: parseFloat(d.avg_prof) || 0,
        avgAppeal: parseFloat(d.avg_appeal) || 0,
        avgSat: parseFloat(d.avg_sat) || 0,
      })),
      qualityByIndustry: (stats.byIndustry || []).map(i => ({
        industry: i.industry, count: parseInt(i.cnt),
        avgCompletion: parseFloat(i.avg_completion) || 0,
        avgProf: parseFloat(i.avg_prof) || 0,
        avgAppeal: parseFloat(i.avg_appeal) || 0,
        avgSat: parseFloat(i.avg_sat) || 0,
      })),
      topDropOffs: stats.topDropOffs || [],
      topAnalyses: qualityData.topAnalyses,
      lowAnalyses: qualityData.lowAnalyses,
      mall: {
        totalProducts: parseInt(productStats?.totals?.total) || 0,
        activeProducts: parseInt(productStats?.totals?.active) || 0,
        totalRecommendations: parseInt(mallStats?.totals?.total) || 0,
        clickedRecommendations: parseInt(mallStats?.totals?.clicked) || 0,
        purchasedRecommendations: parseInt(mallStats?.totals?.purchased) || 0,
      },
    })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取质量仪表板失败' }) }
})

app.get('/api/admin/evolution/analyses/:id', requireAdmin, async (req, res) => {
  try {
    const analysis = await getConversationAnalysisById(parseInt(req.params.id))
    if (!analysis) return res.status(404).json({ error: '分析不存在' })
    res.json({ analysis })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取分析详情失败' }) }
})

// 手动触发单个对话分析
app.post('/api/admin/evolution/analyze/:sessionId', requireAdmin, async (req, res) => {
  try {
    const result = await analyzeConversation(req.params.sessionId)
    if (!result) return res.status(400).json({ error: '分析失败：对话不存在或消息过少' })
    // 尝试从分析结果生成规则
    const rules = await generateRulesFromAnalysis(result)
    res.json({ success: true, analysis: result, rulesGenerated: rules.length })
  } catch (err) { console.error(err); res.status(500).json({ error: '分析失败: ' + err.message }) }
})

// 手动触发批量分析
app.post('/api/admin/evolution/batch-analyze', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.body.limit) || 10
    const count = await batchAnalyzeConversations(limit)
    res.json({ success: true, analyzed: count })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量分析失败: ' + err.message }) }
})

// 获取未分析的对话列表
app.get('/api/admin/evolution/unanalyzed', requireAdmin, async (req, res) => {
  try {
    const sessions = await getUnanalyzedSessions(parseInt(req.query.limit) || 20)
    res.json({ sessions })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取未分析列表失败' }) }
})

// --- 学习指标 ---
app.get('/api/admin/evolution/metrics', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const metrics = await getLearningMetrics(days)
    res.json({ metrics })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取学习指标失败' }) }
})

// 手动触发每日聚合
app.post('/api/admin/evolution/aggregate', requireAdmin, async (req, res) => {
  try {
    await aggregateDailyMetrics()
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '聚合失败: ' + err.message }) }
})

// --- 规则自动评估 & 升降级 ---
app.post('/api/admin/evolution/evaluate', requireAdmin, async (req, res) => {
  try {
    await evaluateRuleEffectiveness()
    res.json({ success: true, message: '规则效果评估完成' })
  } catch (err) { console.error(err); res.status(500).json({ error: '评估失败: ' + err.message }) }
})

app.post('/api/admin/evolution/auto-promote', requireAdmin, async (req, res) => {
  try {
    const result = await autoPromoteRules()
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: '升降级失败: ' + err.message }) }
})

// --- AI自动审批 ---
app.post('/api/admin/evolution/rules/:id/auto-review', requireAdmin, async (req, res) => {
  try {
    const result = await autoReviewRule(parseInt(req.params.id))
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: 'AI审批失败: ' + err.message }) }
})

app.post('/api/admin/evolution/rules/batch-auto-review', requireAdmin, async (req, res) => {
  try {
    const result = await batchAutoReviewRules()
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量AI审批失败: ' + err.message }) }
})

// --- 标签系统 ---
app.get('/api/admin/evolution/tags/stats', requireAdmin, async (req, res) => {
  try { res.json(await getTagStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取标签统计失败' }) }
})

app.get('/api/admin/evolution/tags/:sessionId', requireAdmin, async (req, res) => {
  try {
    const tags = await getConversationTags(req.params.sessionId)
    res.json({ tags })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取标签失败' }) }
})

// --- 知识聚合 ---
app.get('/api/admin/evolution/clusters', requireAdmin, async (req, res) => {
  try {
    const { type, minConfidence } = req.query
    const clusters = await getKnowledgeClusters(type || null, parseFloat(minConfidence) || 0)
    res.json({ clusters })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取知识簇失败' }) }
})

app.get('/api/admin/evolution/clusters/stats', requireAdmin, async (req, res) => {
  try { res.json(await getClusterStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取聚合统计失败' }) }
})

app.post('/api/admin/evolution/clusters/refresh', requireAdmin, async (req, res) => {
  try {
    await aggregateKnowledgeClusters()
    res.json({ success: true, message: '知识聚合完成' })
  } catch (err) { console.error(err); res.status(500).json({ error: '聚合失败: ' + err.message }) }
})

// --- 引擎健康 & 熔断器 ---
app.get('/api/admin/evolution/health', requireAdmin, async (req, res) => {
  try { res.json(await getEngineHealthSummary()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取健康状态失败' }) }
})

// --- 探索实验 ---
app.get('/api/admin/evolution/experiments', requireAdmin, async (req, res) => {
  try {
    const experiments = await getExperiments(req.query.status || null)
    res.json({ experiments })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取实验列表失败' }) }
})

app.post('/api/admin/evolution/explore', requireAdmin, async (req, res) => {
  try {
    await runExplorationCycle()
    res.json({ success: true, message: '探索周期完成' })
  } catch (err) { console.error(err); res.status(500).json({ error: '探索失败: ' + err.message }) }
})

app.post('/api/admin/evolution/experiments/:id/abort', requireAdmin, async (req, res) => {
  try {
    const { updateExperiment } = await import('./db.js')
    await updateExperiment(parseInt(req.params.id), { status: 'aborted', winner: 'inconclusive' })
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '终止实验失败' }) }
})

// --- 变更日志 ---
app.get('/api/admin/evolution/changelog', requireAdmin, async (req, res) => {
  try {
    const ruleId = req.query.ruleId ? parseInt(req.query.ruleId) : null
    const log = await getRuleChangeLog(ruleId, parseInt(req.query.limit) || 50)
    res.json({ log })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取变更日志失败' }) }
})

// ============================
// AI 智能商城 API
// ============================

// --- 后台: 商品管理 ---
app.get('/api/admin/mall/products', requireAdmin, async (req, res) => {
  try {
    const { status, category, search, limit } = req.query
    const products = await getProducts({ status, category, search, limit: limit || 100 })
    res.json({ products })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取商品列表失败' }) }
})

app.get('/api/admin/mall/products/stats', requireAdmin, async (req, res) => {
  try { res.json(await getProductStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取商品统计失败' }) }
})

app.get('/api/admin/mall/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product) return res.status(404).json({ error: '商品不存在' })
    res.json({ product })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取商品失败' }) }
})

app.post('/api/admin/mall/products', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, originalPrice, description, imageUrl, tags, targetAudience, status, sortOrder } = req.body
    if (!name) return res.status(400).json({ error: '商品名称不能为空' })
    const result = await createProduct({ name, category, price, originalPrice, description, imageUrl, tags, targetAudience, status, sortOrder })
    invalidateProductCache()
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: '创建商品失败: ' + err.message }) }
})

app.put('/api/admin/mall/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await updateProduct(parseInt(req.params.id), req.body)
    if (!product) return res.status(404).json({ error: '商品不存在' })
    invalidateProductCache()
    res.json({ success: true, product })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新商品失败' }) }
})

app.delete('/api/admin/mall/products/:id', requireAdmin, async (req, res) => {
  try {
    await deleteProduct(parseInt(req.params.id))
    invalidateProductCache()
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '删除商品失败' }) }
})

// --- 后台: AI商品优化 ---
app.post('/api/admin/mall/products/:id/optimize', requireAdmin, async (req, res) => {
  try {
    const result = await aiOptimizeProduct(parseInt(req.params.id))
    if (!result) return res.status(500).json({ error: 'AI优化失败' })
    res.json({ success: true, optimization: result })
  } catch (err) { console.error(err); res.status(500).json({ error: '优化失败: ' + err.message }) }
})

app.post('/api/admin/mall/products/batch-optimize', requireAdmin, async (req, res) => {
  try {
    const result = await batchOptimizeProducts()
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量优化失败: ' + err.message }) }
})

// --- 后台: 推荐统计 ---
app.get('/api/admin/mall/recommendations/stats', requireAdmin, async (req, res) => {
  try { res.json(await getRecommendationStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取推荐统计失败' }) }
})

// --- 用户端: 商品浏览 ---
app.get('/api/mall/products', async (req, res) => {
  try {
    const { category, search } = req.query
    const products = await getProducts({ status: 'active', category, search, limit: 50 })
    res.json({ products: products.map(p => ({
      id: p.id, name: p.name, category: p.category, price: p.price, originalPrice: p.original_price,
      description: p.ai_description || p.description, imageUrl: p.image_url, tags: p.tags,
    })) })
  } catch (err) { res.status(500).json({ error: '获取商品失败' }) }
})

app.get('/api/mall/products/:id', async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在' })
    await incrementProductMetric(product.id, 'view_count').catch(() => {})
    res.json({ product: {
      id: product.id, name: product.name, category: product.category,
      price: product.price, originalPrice: product.original_price,
      description: product.ai_description || product.description, imageUrl: product.image_url, tags: product.tags,
    } })
  } catch (err) { res.status(500).json({ error: '获取商品失败' }) }
})

app.post('/api/mall/products/:id/click', async (req, res) => {
  try {
    await incrementProductMetric(parseInt(req.params.id), 'click_count')
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '记录失败' }) }
})

// --- 用户端: 个性化推荐 ---
app.get('/api/mall/recommendations', optionalUser, async (req, res) => {
  try {
    const { sessionId } = req.query
    const userId = req.userId || null
    const recs = await getRecommendations(userId, sessionId || null, 10)
    res.json({ recommendations: recs })
  } catch (err) { res.status(500).json({ error: '获取推荐失败' }) }
})

app.put('/api/mall/recommendations/:id/status', async (req, res) => {
  try {
    await updateRecommendationStatus(parseInt(req.params.id), req.body.status || 'clicked')
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '更新失败' }) }
})

// --- 公开: AI砍价 ---
app.post('/api/mall/products/:id/bargain', async (req, res) => {
  const t0 = Date.now()
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在' })
    const { history, message } = req.body || {}
    const result = await aiBargain(product, history || [], message || '')
    logAIActivity({ action: 'AI砍价', category: 'bargain', detail: `商品"${product.name}" ${result.accepted ? '成交¥'+result.finalPrice : '议价中'}`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json(result)
  } catch (err) { res.json({ reply: '系统繁忙，请稍后再试', finalPrice: null, accepted: false }) }
})

// --- 公开: 下单后生成虚拟人设 ---
app.post('/api/mall/products/:id/persona', async (req, res) => {
  const t0 = Date.now()
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product) return res.status(404).json({ error: '商品不存在' })
    const { collectedData } = req.body || {}
    const persona = await aiGenerateVirtualPersona(product, collectedData || {})
    const p = persona || { name: '客服小助', title: '专属顾问', avatar: '👨‍💼', greeting: '您好，我是您的专属服务顾问！' }
    logAIActivity({ action: '生成虚拟人设', category: 'persona', detail: `${p.name}·${p.title} 服务商品"${product.name}"`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json({ persona: p })
  } catch (err) { res.json({ persona: { name: '客服小助', title: '专属顾问', avatar: '👨‍💼', greeting: '您好，我是您的专属服务顾问！' } }) }
})

// --- 公开: AI风险评估 ---
app.post('/api/risk-assess', async (req, res) => {
  const t0 = Date.now()
  try {
    const { collectedData } = req.body || {}
    const result = await aiAssessRisk(collectedData || {})
    logAIActivity({ action: 'AI风险评估', category: 'risk', detail: `${result.label}: ${result.description || ''}`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json(result)
  } catch (err) { res.json({ level: 'medium', label: '评估中', description: '评估失败' }) }
})

// --- 后台: AI行为日志 ---
app.get('/api/admin/ai-activity', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')
    const category = req.query.category || null
    const logs = await getAIActivityLog(limit, offset, category)
    const stats = await getAIActivityStats()
    res.json({ logs, stats })
  } catch (err) { res.status(500).json({ error: '获取AI日志失败' }) }
})

// --- 后台: AI生成名片 ---
app.post('/api/admin/contact-cards/ai-generate', requireAdmin, async (req, res) => {
  const t0 = Date.now()
  try {
    const { description, category } = req.body || {}
    const cardData = await aiGenerateContactCard({ description, category })
    if (!cardData) {
      logAIActivity({ action: 'AI生成名片', category: 'card', detail: '生成失败', status: 'failed', duration_ms: Date.now()-t0 }).catch(()=>{})
      return res.status(500).json({ error: 'AI生成失败，请重试' })
    }
    const result = await createContactCard({ ...cardData, status: 'draft' })
    logAIActivity({ action: 'AI生成名片', category: 'card', detail: `${cardData.name}·${cardData.title}`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json({ success: true, ...result, card: cardData })
  } catch (err) { res.status(500).json({ error: 'AI名片生成失败: ' + err.message }) }
})

// --- 后台: AI辅助生成（规则/名片/商品） ---
app.post('/api/admin/ai-assist', requireAdmin, async (req, res) => {
  const t0 = Date.now()
  try {
    const { type, description } = req.body || {}
    if (!description?.trim()) return res.status(400).json({ error: '请输入描述' })
    const cfg = await getAIConfig()
    if (!cfg.apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    let systemPrompt = '', parseField = ''
    if (type === 'rule') {
      parseField = 'rule'
      systemPrompt = `你是商户申诉平台的AI规则专家。用户会用自然语言描述一条业务规则，你需要将其转化为结构化的规则配置。
输出严格JSON格式：
{
  "ruleKey": "英文下划线标识，如 industry_food_greeting",
  "ruleName": "简短中文规则名",
  "category": "规则类型，只能是: collection_strategy / response_template / industry_knowledge / scoring_weight / workflow",
  "ruleContent": {
    "description": "详细描述这条规则做什么",
    "condition": "触发条件",
    "action": "执行动作",
    "priority": "high/medium/low",
    "examples": ["示例场景1", "示例场景2"]
  }
}
只输出JSON，不要其他内容。`
    } else if (type === 'card') {
      parseField = 'card'
      systemPrompt = `你是商户申诉平台的名片设计AI。用户会用自然语言描述想要创建的联系人/客服名片，你需要生成完整的名片信息。
输出严格JSON格式：
{
  "name": "姓名",
  "title": "头衔/职位",
  "phone": "手机号（可用虚拟号如138xxxx1234）",
  "wechat": "微信号",
  "email": "邮箱",
  "description": "一句话描述此人专长",
  "category": "分类：general/payment/legal/technical/industry",
  "tags": ["标签1", "标签2"]
}
只输出JSON，不要其他内容。根据描述合理填充所有字段。`
    } else if (type === 'product') {
      parseField = 'product'
      systemPrompt = `你是商户申诉平台的商品策划AI。用户会用自然语言描述想要创建的服务商品，你需要生成完整的商品信息。
输出严格JSON格式：
{
  "name": "商品名称（简洁有力）",
  "category": "分类，如：申诉服务/法律咨询/培训课程",
  "price": 数字（合理定价，单位元），
  "originalPrice": 数字（原价，比售价高20-50%），
  "description": "详细商品描述（2-3句话，突出价值）",
  "tags": ["标签1", "标签2", "标签3"],
  "targetAudience": ["目标客户1", "目标客户2"]
}
只输出JSON，不要其他内容。`
    } else {
      return res.status(400).json({ error: '不支持的类型: ' + type })
    }

    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description.trim() },
      ], temperature: 0.7, max_tokens: 1500 }),
      signal: AbortSignal.timeout(30000),
    })

    if (!aiRes.ok) return res.status(500).json({ error: 'AI调用失败' })
    const data = await aiRes.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // 提取JSON
    let result
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw)
    } catch { return res.status(500).json({ error: 'AI返回格式异常', raw }) }

    logAIActivity({ action: `AI辅助生成${type}`, category: 'assist', detail: description.trim().slice(0, 80), duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json({ [parseField]: result })
  } catch (err) {
    console.error('[AI-Assist]', err)
    res.status(500).json({ error: 'AI辅助生成失败: ' + err.message })
  }
})

// --- 后台: AI自动生成商品 ---
app.post('/api/admin/mall/products/ai-generate', requireAdmin, async (req, res) => {
  try {
    const analyses = await getConversationAnalyses(20)
    const result = await aiAutoCreateProducts(analyses)
    res.json({ success: true, ...result })
  } catch (err) { console.error(err); res.status(500).json({ error: 'AI生成商品失败: ' + err.message }) }
})

app.post('/api/admin/mall/products/ai-suggest', requireAdmin, async (req, res) => {
  try {
    const analyses = await getConversationAnalyses(20)
    const suggestions = await aiSuggestNewProducts(analyses)
    res.json({ suggestions: suggestions || [] })
  } catch (err) { console.error(err); res.status(500).json({ error: 'AI建议失败: ' + err.message }) }
})

// --- 公开: AI智能名片推荐 ---
app.post('/api/contact-cards/ai-recommend', async (req, res) => {
  try {
    const { collectedData, messages } = req.body || {}
    const card = await aiRecommendContactCard(collectedData || {}, messages || [])
    res.json({ card: card ? { id: card.id, name: card.name, title: card.title, phone: card.phone, wechat: card.wechat, email: card.email, qrCode: card.qr_code, description: card.description, aiReason: card.aiReason } : null })
  } catch (err) { res.json({ card: null }) }
})

// --- 用户端: 购买商品 ---
app.post('/api/orders/purchase', requireUser, async (req, res) => {
  const t0 = Date.now()
  try {
    const user = await getUserById(req.userId)
    if (!user) return res.status(401).json({ error: '用户不存在' })

    const { productId, collectedData } = req.body || {}
    const product = await getProductById(parseInt(productId))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在或已下架' })

    // 扣余额
    const price = parseFloat(product.price)
    const balance = parseFloat(user.balance || 0)
    if (balance < price) return res.status(400).json({ error: '余额不足', needRecharge: true, balance, price })

    await deductBalance(user.id, price)
    await incrementProductMetric(product.id, 'purchase_count')

    // 生成虚拟人设
    const persona = await aiGenerateVirtualPersona(product, collectedData || {})
    const p = persona || { name: '客服小助', title: '专属服务顾问', avatar: '👨‍💼', personality: '专业、耐心', greeting: `您好！我是您的专属服务顾问，将全程协助您处理"${product.name}"相关事宜。` }

    // 创建订单
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const order = await createOrder({
      orderNo, userId: user.id, productId: product.id, productName: product.name,
      price, persona: p, collectedData: collectedData || {},
    })

    // 写入首条服务消息（AI打招呼）
    await appendServiceMessage(order.id, { role: 'assistant', content: p.greeting, ts: Date.now() })
    await updateOrderStatus(order.id, 'serving')

    logAIActivity({ action: '商品购买+生成人设', category: 'purchase', detail: `${user.nickname||user.id}购买"${product.name}" ¥${price} → ${p.name}·${p.title}`, duration_ms: Date.now()-t0 }).catch(()=>{})

    res.json({ success: true, orderNo: order.orderNo, orderId: order.id, persona: p })
  } catch (err) {
    console.error('[Purchase]', err)
    res.status(500).json({ error: '购买失败: ' + err.message })
  }
})

// --- 用户端: 我的订单列表 ---
app.get('/api/orders', requireUser, async (req, res) => {
  try {
    const orders = await getUserOrders(req.userId)
    res.json({ orders: orders.map(o => ({
      id: o.id, orderNo: o.order_no, productName: o.product_name, price: o.price,
      status: o.status, persona: o.persona, createdAt: o.created_at,
    })) })
  } catch (err) { res.status(500).json({ error: '获取订单失败' }) }
})

// --- 用户端: 订单详情 ---
app.get('/api/orders/:orderNo', requireUser, async (req, res) => {
  try {
    const order = await getOrderByNo(req.params.orderNo)
    if (!order || order.user_id !== req.userId) return res.status(404).json({ error: '订单不存在' })
    const product = await getProductById(order.product_id)
    res.json({
      order: {
        id: order.id, orderNo: order.order_no, productName: order.product_name,
        productCategory: product?.category || '', price: order.price, status: order.status,
        persona: order.persona, collectedData: order.collected_data,
        messages: order.service_messages || [], createdAt: order.created_at,
      }
    })
  } catch (err) { res.status(500).json({ error: '获取订单详情失败' }) }
})

// --- 用户端: 订单AI服务对话 ---
app.post('/api/orders/:orderNo/chat', requireUser, async (req, res) => {
  const t0 = Date.now()
  try {
    const order = await getOrderByNo(req.params.orderNo)
    if (!order || order.user_id !== req.userId) return res.status(404).json({ error: '订单不存在' })
    if (order.status === 'refunded') return res.status(400).json({ error: '该订单已退款' })

    const { message } = req.body || {}
    if (!message?.trim()) return res.status(400).json({ error: '消息不能为空' })

    // 记录用户消息
    await appendServiceMessage(order.id, { role: 'user', content: message.trim(), ts: Date.now() })

    // 构建AI对话
    const persona = order.persona || {}
    const collectedData = order.collected_data || {}
    const userContext = Object.entries(collectedData).filter(([k,v]) => v && !k.startsWith('_')).map(([k,v]) => `${k}: ${v}`).join('\n')

    const systemPrompt = `你是${persona.name || '专属服务顾问'}，${persona.title || '客服顾问'}。
${persona.systemPrompt || '你专业、耐心、有经验，帮助用户解决商户申诉相关问题。'}

## 你的性格
${persona.personality || '专业、温暖、有耐心'}

## 用户购买的服务
${order.product_name}

## 用户已知情况
${userContext || '暂无详细信息'}

## 你的核心职责
1. 根据用户的具体情况，帮助分析问题、制定申诉策略
2. 如果用户需要，帮助撰写申诉报告、申诉文案、证据整理方案
3. 解答用户的疑问，提供专业建议
4. 用第一人称，像真人顾问一样自然沟通，不要暴露自己是AI
5. 主动推进问题解决进度，每次回复都要有实质性帮助

## 重要
- 直接帮用户做事，不要只给建议
- 如果用户要你写报告/申诉书，直接写出来
- 语气温暖但专业`

    const historyMsgs = (order.service_messages || []).slice(-20).map(m => ({ role: m.role, content: m.content }))

    const cfg = await getAIConfig()
    const aiMessages = [{ role: 'system', content: systemPrompt }, ...historyMsgs, { role: 'user', content: message.trim() }]

    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: aiMessages, temperature: 0.7, max_tokens: 2000 }),
      signal: AbortSignal.timeout(30000),
    })

    let reply = '抱歉，系统繁忙，请稍后再试。'
    if (aiRes.ok) {
      const data = await aiRes.json()
      reply = data.choices?.[0]?.message?.content || reply
    }

    await appendServiceMessage(order.id, { role: 'assistant', content: reply, ts: Date.now() })
    logAIActivity({ action: '服务对话', category: 'service', detail: `订单${order.order_no}: ${message.trim().slice(0,50)}`, duration_ms: Date.now()-t0 }).catch(()=>{})

    res.json({ reply })
  } catch (err) {
    console.error('[ServiceChat]', err)
    res.status(500).json({ error: '对话失败: ' + err.message })
  }
})

// ========== 监控告警 API ==========

// 公开健康检查端点（供外部监控平台调用，如 UptimeRobot/阿里云监控）
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

// SPA fallback（排除 /api 路径，避免 API 404 返回 HTML）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: '接口不存在' })
  }
  const htmlPath = path.join(distPath, 'index.html')
  res.sendFile(htmlPath, (err) => {
    if (err) {
      console.error('[SPA] index.html 发送失败:', err.message)
      res.status(500).send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>加载中</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#666"><div style="text-align:center"><p>页面加载失败，请刷新重试</p><button onclick="location.reload()" style="margin-top:12px;padding:8px 24px;background:#07C160;color:#fff;border:none;border-radius:8px;cursor:pointer">刷新</button></div></body></html>')
    }
  })
})

// 全局错误处理（生产环境不泄露内部错误细节）
app.use((err, req, res, _next) => {
  // 区分错误类型，记录详细日志
  const statusCode = err.status || err.statusCode || 500
  const isDev = process.env.NODE_ENV !== 'production'

  // 结构化错误日志
  const logData = {
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    ...(isDev && { stack: err.stack }),
  }

  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logData))
  } else {
    console.warn('[WARN]', JSON.stringify(logData))
  }

  // 防止头已发送时重复响应
  if (res.headersSent) return

  res.status(statusCode).json({
    error: isDev ? err.message : '服务器内部错误，请稍后重试',
    ...(isDev && { path: req.path, method: req.method }),
  })
})

// ========== 进程级错误捕获 ==========

// 未捕获的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] 未处理的 Promise 拒绝:', reason)
  // 不立即退出，让现有请求完成
})

// 未捕获的同步异常
process.on('uncaughtException', (err) => {
  console.error('[FATAL] 未捕获的异常:', err)
  // 给 10 秒处理剩余请求后退出（不可恢复的状态）
  setTimeout(() => { process.exit(1) }, 10000)
})

async function start() {
  try {
    await initDatabase()
    const server = app.listen(PORT, () => console.log(`🚀 服务器已启动: http://localhost:${PORT}`))

    // 启动 AI 自进化引擎
    startEvolutionScheduler()

    // 启动模型健康巡检（每30分钟）
    startHealthScheduler(30)

    // 启动系统监控巡检（每1分钟）
    startMonitorScheduler(1)

    // 启动数据库自动备份调度（每日凌晨3点）
    startBackupScheduler()

    console.log('📊 监控告警系统已启动（/api/health 可用）')
    console.log('💾 数据备份系统已启动')

    // 优雅关闭：先停止接受新连接，等待现有请求完成，再关闭数据库
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
      // 10秒超时强制退出
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
