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
  saveAppealText, getAppealText,
} from './db.js'
import { getWelcomeMessage, chatWithAI, streamChatWithAI, extractFieldsWithAI, expandFieldsForIndustry, assessCompletenessWithAI } from './ai.js'
import { processLocal, buildReportPrompt, TOTAL_STEPS, INFO_FIELDS, LOCAL_WELCOME, normalizeFieldValue, buildCollectionContext, findNextUnfilledStep } from './localAI.js'
import { calculateCost } from './tokenizer.js'

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

// 全局速率限制
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
  validate: { xForwardedForHeader: false },
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

app.use(express.json({ limit: '1mb' }))

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

app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    let { sessionId, content, userId } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    // 获取用户信息（如果已登录）
    let user = null
    if (userId) {
      user = await getUserById(userId)
    }

    // ===== 强制付费校验：没有付费能力不允许使用任何聊天功能 =====
    if (!user) {
      return res.status(401).json({ error: '请先登录后再使用', needLogin: true })
    }
    const hasPayment = (user.api_mode === 'custom' && user.custom_api_key) || (user.api_mode === 'official' && parseFloat(user.balance) > 0)
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
    } else if (user.api_mode === 'official' && parseFloat(user.balance) > 0) {
      apiKeyToUse = null
      isOfficialMode = true
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
        'API_KEY_INVALID': '⚠️ **AI 服务配置异常（API Key 无效）**\n\n请联系管理员在后台「系统配置 → AI配置」中更新有效的 DeepSeek API Key。\n\n如果您使用的是自定义 API Key，请在「API设置」中检查您的 Key 是否正确。',
        'API_BALANCE_INSUFFICIENT': '⚠️ **DeepSeek API 余额不足**\n\n平台的 AI 服务额度已用完，请联系管理员充值 DeepSeek API 额度。',
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
      responseText = `⚠️ **AI 服务未配置**\n\n系统尚未配置 DeepSeek API Key，请联系管理员在后台「系统配置」中完成配置。`
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
    // 智能标准化用户编辑的值
    const normalizedValue = normalizeFieldValue(key, value || '', collectedData)
    collectedData[key] = normalizedValue
    await updateSession(req.params.id, session.step, collectedData)
    res.json({ success: true, collectedData, normalizedValue, wasNormalized: normalizedValue !== (value || '').trim() })
  } catch (err) { console.error(err); res.status(500).json({ error: '更新失败' }) }
})

// ========== 获取AI分析摘要（基于已收集数据本地生成，不消耗DeepSeek） ==========
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

// ========== DeepSeek 智能分析（基于收集数据 + 聊天记录，统一输出全部分析） ==========
app.get('/api/sessions/:id/deep-analysis', optionalUser, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = session.collected_data || {}
    const filledKeys = Object.keys(d).filter(k => d[k]?.trim())
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
        const quota = await checkDeepAnalysisQuota(user.id)
        if (quota.isMember && quota.allowed) {
          // 会员用户且未超月限额：免费
          apiKey = await getSystemConfig('deepseek_api_key')
          isMemberFree = true
          isOfficialMode = true
        } else if (quota.isMember && !quota.allowed) {
          // 会员但已用完本月额度
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'quota_exceeded', quota: { used: quota.used, limit: quota.limit } })
        } else if (parseFloat(user.balance) > 0) {
          // 非会员但有余额：按token收费
          apiKey = await getSystemConfig('deepseek_api_key')
          isOfficialMode = true
        } else {
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_balance' })
        }
      }
    }
    if (!apiKey) {
      // 没有用户或用户无付费能力 → 不允许使用系统key白嫖
      if (!chargeUser) return res.json({ deepAnalysis: null, localAnalysis, reason: 'login_required' })
      apiKey = await getSystemConfig('deepseek_api_key')
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
      if (d[key]?.trim()) {
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

## 行动计划

按时间顺序给出具体步骤，每步写清楚：做什么、怎么做、去哪做。

1. **立即执行**（今天）：具体要做的第一件事
2. **准备材料**（1-3天）：按上面清单逐一准备
3. **提交申诉**：通过什么渠道、怎么提交
4. **跟进催审**：什么时候打95017转3催促
5. **二次申诉**（如被驳回）：怎么调整

## 申诉话术

给出拨打95017和提交申诉时可以直接使用的话术模板。

### 电话话术（95017转3）
"您好，我是商户号${merchantId}的${d.legal_name || '法人'}，我们商户因${d.violation_reason || '违规原因'}被${d.problem_type || '处罚'}，我已准备好申诉材料，请问具体的违规详情是什么？我这边好针对性准备补充材料。"

### 申诉信核心内容
给出一段200字以内的申诉信核心段落，包含：商户情况说明、违规原因解释、整改措施、请求恢复。内容要针对该客户的具体情况来写。

---

# 硬性要求
1. **必须引用客户具体信息**：商户号${merchantId}、名称${merchantName}、行业${d.industry || ''}、违规原因${d.violation_reason || ''}。
2. **必须引用对话记录内容**：客户在对话中提到的任何细节都要体现。
3. **资质和材料必须针对该行业**：不要列与该客户行业无关的资质。
4. **每项材料都要说清楚怎么准备**：不要只说"准备营业执照"，要说"营业执照原件照片，四角完整、字迹清晰、要能看到经营范围"。
5. **证据链必须完整**：从主体→经营→交易→整改，形成闭环。
6. **所有建议可直接执行**：杜绝空话套话。`

    // ===== SSE 流式输出 =====
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // 先发送本地分析（立即可用）
    res.write(`data: ${JSON.stringify({ type: 'local', localAnalysis })}\n\n`)

    const model = (await getSystemConfig('deepseek_model')) || 'deepseek-chat'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: analysisPrompt }], temperature: 0.5, max_tokens: 4000, stream: true }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!apiRes.ok) {
      console.error('DeepSeek analysis stream error:', apiRes.status)
      res.write(`data: ${JSON.stringify({ type: 'error', reason: `api_error_${apiRes.status}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // 流式读取 DeepSeek 响应
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

// ========== DeepSeek 流式转发工具函数 ==========
async function pipeDeepSeekStream(res, streamResult, { isOfficialMode, user, sessionId, usageType }) {
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
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { content, sessionId: inSessionId, userId } = req.body
    if (!content?.trim()) return res.status(400).json({ error: '消息不能为空' })
    if (content.length > 5000) return res.status(400).json({ error: '消息过长，请缩短后重试' })

    const user = userId ? await getUserById(userId) : null

    // ===== 强制付费校验：没有付费能力不允许使用任何聊天功能 =====
    if (!user) {
      return res.status(401).json({ error: '请先登录后再使用', needLogin: true })
    }
    const hasPayment = (user.api_mode === 'custom' && user.custom_api_key) || (user.api_mode === 'official' && parseFloat(user.balance) > 0)
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

    // 检查付费能力（DeepSeek 报告阶段需要）
    let apiKeyToUse = null
    let canUseAI = false
    let isOfficialMode = false
    if (user) {
      if (user.api_mode === 'custom' && user.custom_api_key) {
        apiKeyToUse = user.custom_api_key
        canUseAI = true
      } else if (user.api_mode === 'official') {
        if (parseFloat(user.balance) > 0) {
          apiKeyToUse = null
          canUseAI = true
          isOfficialMode = true
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

    // ===== 阶段判断：用 _collection_complete 标记（AI判断），不再硬编码 step 上限 =====
    const isCollectionDone = collectedData._collection_complete === true
    if (!isCollectionDone) {
      // ===== 信息收集阶段：规则引擎 + AI 协作，动态无限收集 =====
      const inBasePhase = currentStep < TOTAL_STEPS
      const result = inBasePhase
        ? processLocal(content, currentStep, collectedData)
        : { response: null, nextStep: currentStep, collectedData: { ...collectedData }, infoUpdate: null, needDeepSeek: true, allCollected: false }

      // Step 1: 发送本轮提取到的字段 + 保存进度
      if (result.infoUpdate) {
        const updates = Array.isArray(result.infoUpdate) ? result.infoUpdate : [result.infoUpdate]
        for (const upd of updates) {
          if (upd && upd.key) safeSend(`data: ${JSON.stringify({ type: 'info_update', ...upd, step: result.nextStep, totalSteps: TOTAL_STEPS })}\n\n`)
        }
      }
      await updateSession(sessionId, result.nextStep, result.collectedData)

      // Step 1.5: 行业自适应字段扩展（当 industry 首次被识别时触发）
      if (canUseAI && result.collectedData.industry && !result.collectedData._dynamic_fields) {
        try {
          const expansion = await expandFieldsForIndustry(result.collectedData.industry, result.collectedData.problem_type, result.collectedData, apiKeyToUse)
          if (expansion && expansion.fields?.length > 0) {
            result.collectedData._dynamic_fields = expansion.fields
            result.collectedData._industry_tip = expansion.industryTip
            await updateSession(sessionId, result.nextStep, result.collectedData)
            // 通知前端新增动态字段
            for (const df of expansion.fields) {
              safeSend(`data: ${JSON.stringify({ type: 'info_update', key: df.key, label: df.label, value: '', group: df.group || '行业信息', icon: df.icon || '🏭', step: result.nextStep, totalSteps: TOTAL_STEPS, dynamic: true })}\n\n`)
            }
            console.log(`[行业扩展] 为 ${result.collectedData.industry} 生成 ${expansion.fields.length} 个动态字段`)
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

      // Step 2: 格式校验错误 → 本地即时反馈（同时也让DeepSeek提取其他字段）
      const isValidationError = result.response && result.nextStep === currentStep &&
        /⚠️.*格式|⚠️.*位数|⚠️.*数字|⚠️.*重新输入|⚠️.*不太对|🤔/.test(result.response)

      if (isValidationError) {
        await simulateTypingSSE(res, result.response)
        await addMessage(sessionId, 'assistant', result.response)
        // 即使校验失败，也跑DeepSeek提取（用户消息可能包含其他字段的数据）
        if (canUseAI) {
          try {
            const allMsgsForExtract = await getMessages(sessionId)
            const valExtraction = await extractFieldsWithAI(content, result.collectedData, currentStep, apiKeyToUse, allMsgsForExtract.slice(-6))
            if (valExtraction && Object.keys(valExtraction.extracted).length > 0) {
              const fieldValidators = {
                merchant_id: v => /^\d{8,12}$/.test(v.replace(/\s/g, '')),
                legal_id_last4: v => /^\d{3}[\dxX]$/.test(v.replace(/\s/g, '')),
                bank_account_last4: v => /^\d{4}$/.test(v.replace(/\s/g, '')),
                contact_phone: v => /^1[3-9]\d{9}$/.test(v.replace(/[\s\-]/g, '')),
                license_no: v => /^[0-9A-Z]{15,18}$/i.test(v.replace(/\s/g, '')),
                bank_name: v => v.length <= 20 && /银行|信用社|支付宝|财付通/.test(v) && !/[？?怎么吗呢呀吧]/.test(v),
                company_name: v => v.length <= 50 && !/^(就是|哎呀|那个|反正)/.test(v),
                legal_name: v => v.length >= 2 && v.length <= 10 && /^[\u4e00-\u9fff·]+$/.test(v),
              }
              const allFieldDefs = [...INFO_FIELDS, ...(result.collectedData._dynamic_fields || [])]
              for (const [key, value] of Object.entries(valExtraction.extracted)) {
                let fieldDef = allFieldDefs.find(f => f.key === key)
                if (!fieldDef) continue
                const v = String(value).trim()
                if (!v) continue
                const validator = fieldValidators[key]
                if (validator && !validator(v)) continue
                const existing = result.collectedData[key]
                if (!existing || existing === '用户暂未提供' || existing === '⏳待补充') {
                  result.collectedData[key] = v
                  safeSend(`data: ${JSON.stringify({ type: 'info_update', key, label: fieldDef.label, value: v, group: fieldDef.group, icon: fieldDef.icon, step: result.nextStep, totalSteps: TOTAL_STEPS })}\n\n`)
                }
              }
              await updateSession(sessionId, result.nextStep, result.collectedData)
            }
          } catch (e) { console.error('Step 2 extraction error (non-fatal):', e.message) }
        }
      }
      // Step 3: 基础字段收集完毕或AI提取后 → AI评估是否可以生成报告
      else if (result.allCollected || result.nextStep >= TOTAL_STEPS) {
        // 先发送本地汇总
        if (result.response) {
          await simulateTypingSSE(res, result.response)
          await addMessage(sessionId, 'assistant', result.response)
        }

        // ===== Step 3.1: 对最后一条用户消息也跑DeepSeek提取（确保无遗漏） =====
        if (canUseAI) {
          try {
            const allMsgsForExtract = await getMessages(sessionId)
            const lastExtraction = await extractFieldsWithAI(content, result.collectedData, currentStep, apiKeyToUse, allMsgsForExtract.slice(-6))
            if (lastExtraction && Object.keys(lastExtraction.extracted).length > 0) {
              const fieldValidators = {
                merchant_id: v => /^\d{8,12}$/.test(v.replace(/\s/g, '')),
                legal_id_last4: v => /^\d{3}[\dxX]$/.test(v.replace(/\s/g, '')),
                bank_account_last4: v => /^\d{4}$/.test(v.replace(/\s/g, '')),
                contact_phone: v => /^1[3-9]\d{9}$/.test(v.replace(/[\s\-]/g, '')),
                license_no: v => /^[0-9A-Z]{15,18}$/i.test(v.replace(/\s/g, '')),
                bank_name: v => v.length <= 20 && /银行|信用社|支付宝|财付通/.test(v) && !/[？?怎么吗呢呀吧]/.test(v),
                company_name: v => v.length <= 50 && !/^(就是|哎呀|那个|反正)/.test(v),
                legal_name: v => v.length >= 2 && v.length <= 10 && /^[\u4e00-\u9fff·]+$/.test(v),
              }
              const allFieldDefs = [...INFO_FIELDS, ...(result.collectedData._dynamic_fields || [])]
              for (const [key, value] of Object.entries(lastExtraction.extracted)) {
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
                const existing = result.collectedData[key]
                const shouldUpdate = lastExtraction.correction || !existing || existing === '用户暂未提供' || existing === '⏳待补充'
                if (shouldUpdate) {
                  result.collectedData[key] = v
                  safeSend(`data: ${JSON.stringify({ type: 'info_update', key, label: fieldDef.label, value: v, group: fieldDef.group || '补充信息', icon: fieldDef.icon || '📌', step: result.nextStep, totalSteps: TOTAL_STEPS })}\n\n`)
                }
              }
              await updateSession(sessionId, result.nextStep, result.collectedData)
              // 扣费
              if (lastExtraction.inputTokens || lastExtraction.outputTokens) {
                const multiplierStr = await getSystemConfig('cost_multiplier')
                const multiplier = parseFloat(multiplierStr || '2')
                const tokenInfo = calculateCost(lastExtraction.inputTokens, lastExtraction.outputTokens, multiplier)
                if (isOfficialMode && tokenInfo.cost > 0) {
                  await deductBalance(user.id, tokenInfo.cost)
                  await incrementUserSpent(user.id, tokenInfo.cost)
                  try { await recordTokenUsage({ userId: user.id, sessionId, type: 'ai_extraction', inputTokens: lastExtraction.inputTokens, outputTokens: lastExtraction.outputTokens, totalTokens: lastExtraction.inputTokens + lastExtraction.outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
                }
              }
            }
          } catch (e) { console.error('Step 3 extraction error (non-fatal):', e.message) }
        }

        // AI 评估完成度
        let shouldGenerate = false
        if (canUseAI) {
          try {
            const assessment = await assessCompletenessWithAI(result.collectedData, apiKeyToUse)
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
              shouldGenerate = true
            } else {
              // AI说信息还不够 → 继续收集，引导用户补充
              const guideMsg = assessment.nextQuestion
                ? `📊 信息完成度：${assessment.score}%\n\n${assessment.reason}\n\n${assessment.nextQuestion}`
                : `📊 当前信息完成度 ${assessment.score}%，还需要补充一些关键信息：${(assessment.missingCritical || []).join('、')}。\n\n您可以继续告诉我更多信息，信息越充分，申诉材料质量越高~`
              await simulateTypingSSE(res, guideMsg)
              await addMessage(sessionId, 'assistant', guideMsg)
            }
          } catch (assessErr) {
            console.error('Completeness assessment error:', assessErr.message)
            shouldGenerate = true // 评估失败时降级为直接生成
          }
        } else {
          shouldGenerate = true // 无AI能力时直接生成
        }

        if (shouldGenerate) {
          result.collectedData._collection_complete = true
          await updateSession(sessionId, result.nextStep, result.collectedData)
          if (!canUseAI) {
            const errMsg = '\n\n⚠️ **余额不足，无法生成申诉报告。** 请充值后发送"生成报告"即可继续。'
            await simulateTypingSSE(res, errMsg)
            await addMessage(sessionId, 'assistant', errMsg)
            safeSend(`data: ${JSON.stringify({ type: 'error', needRecharge: true })}\n\n`)
          } else {
            try {
              const similarCases = await findSimilarCases(result.collectedData.industry, result.collectedData.problem_type, 3)
              if (similarCases.length > 0) {
                const caseMsg = `\n\n💼 **发现 ${similarCases.length} 个相似成功案例**，AI 将参考这些案例为您生成更有针对性的申诉材料。\n`
                await simulateTypingSSE(res, caseMsg)
              }
              const reportPrompt = buildReportPrompt(result.collectedData, similarCases)
              const reportMessages = [{ role: 'user', content: reportPrompt }]
              const streamResult = await streamChatWithAI(reportMessages, apiKeyToUse)
              const fullContent = await pipeDeepSeekStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'report' })
              if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
            } catch (err) {
              console.error('DeepSeek report error:', err.message)
              const errMsg = `\n\n⚠️ 报告生成失败（${err.message}），请稍后发送"生成报告"重试。`
              await simulateTypingSSE(res, errMsg)
              await addMessage(sessionId, 'assistant', errMsg)
            }
          }
        }
      }
      // Step 4: 其他所有情况 → DeepSeek 驱动对话（先回复，后台提取）
      else {
        if (!canUseAI) {
          const fallbackResponse = result.response || `请继续回答当前问题~`
          await simulateTypingSSE(res, fallbackResponse)
          await addMessage(sessionId, 'assistant', fallbackResponse)
        } else {
          try {
            const stepStartTime = Date.now()
            const effectiveStep = result.nextStep < TOTAL_STEPS ? result.nextStep : currentStep
            let updatedData = { ...result.collectedData }
            let updatedStep = effectiveStep

            // ===== 4.1 先构建上下文，立即开始流式回复（用户秒看到内容） =====
            let extractionNote = ''
            if (result.infoUpdate) {
              const updates = Array.isArray(result.infoUpdate) ? result.infoUpdate : [result.infoUpdate]
              const extracted = updates.filter(u => u && u.key).map(u => `${u.label}: ${u.value}`)
              if (extracted.length > 0) extractionNote = `\n\n[系统提示] 规则引擎已提取：${extracted.join('、')}。请在回复中自然确认。`
            }

            const filledFields = Object.entries(updatedData).filter(([k, v]) => !k.startsWith('_') && v && String(v).trim() && v !== '用户暂未提供' && v !== '⏳待补充')
            const filledCount = filledFields.length
            const currentFieldInfo = INFO_FIELDS[Math.min(updatedStep, TOTAL_STEPS - 1)] || INFO_FIELDS[INFO_FIELDS.length - 1]
            const collectionCtx = buildCollectionContext(updatedData, Math.min(updatedStep, TOTAL_STEPS - 1))
            const dynamicFields = updatedData._dynamic_fields || []
            const unfilled = dynamicFields.filter(df => !updatedData[df.key] || !String(updatedData[df.key]).trim()).map(df => `${df.label}: ${df.question || df.hint || ''}`).join('\n')
            const dynamicNote = unfilled ? `\n\n[行业专属信息待收集]\n${unfilled}` : ''

            const enrichedData = {
              ...updatedData,
              _current_step: `已收集${filledCount}项`,
              _current_question: currentFieldInfo.question,
              _current_field_label: currentFieldInfo.label,
              _collection_context: collectionCtx,
              _instruction: `你是专为商家打造的商户号申诉全流程智能专家AI，具备自主学习、自我迭代、持续进化能力。你帮过上百个商家成功解封，经验极其丰富。说话就跟朋友聊天一样，随意但专业。${extractionNote}${dynamicNote}

【你的核心能力】
- 智能违规诊断：自动识别交易异常、资金冻结、违规风控、投诉过多、异地收款等各类封禁原因，精准判断问题根源
- 全流程申诉支撑：匹配最新平台规则，生成高通过率申诉文案，出具必交证据材料清单
- 多平台覆盖：微信支付、支付宝、抖音、快手、美团等全平台商户号申诉
- 自我迭代：每次对话都在学习优化，追求最高申诉成功率

【最高优先级 — 反幻觉铁律】
⛔ 你的回复100%只能基于用户已提供的真实信息，严禁编造、脑补、添加用户未说过的任何细节！
⛔ 用户说"游戏陪练"→你只能说"游戏陪练"，绝不能自作主张加上"王者荣耀""和平精英"等具体游戏名！
⛔ 用户说"有"/"已经有了"→你只能说"已有相关措施"，绝不能编造具体细节！
⛔ 用户没说的=不存在，禁止"合理推测""行业惯例补充"
⛔ 确认信息时只复述用户原话，不修饰不扩展

【信息修正规则】
✅ 用户随时可以纠正之前的信息，你要积极配合
✅ 用户说"不对""搞错了""改一下"→立刻确认要修改哪个信息，确认新值后覆盖
✅ 同一字段多次提供不同值→以最新一次为准，主动确认"之前是XX，现在改成YY对吧？"
✅ 发现用户前后矛盾→温和提醒，让用户确认以哪个为准

【智能诊断输出】
- 行业+问题+原因收齐后，给出明确诊断：是否可申诉、预估难度、建议策略
- 根据违规类型自动匹配最优申诉方案，告诉用户大概什么情况、怎么应对
- 不同平台有不同的审核规则和申诉口径，要区分处理

【对话风格 — 像真人顾问】
1. 说大白话，用户是普通商家，别整专业术语
2. 不要机械地一问一答，要像聊天一样自然过渡
3. 提取到信息后，自然地带过（"行，游戏陪练，了解了"），别搞"✅已记录您的行业为..."
4. 问下一个信息时，解释为啥需要、在哪找，别让人一脸懵
5. 用户急/有情绪→先共情安抚（"理解，换谁都着急"），别直接跳过
6. 100-200字，简短，像微信聊天。别写小作文
7. 一次只问一个问题，别连环炮
8. 用户说得乱七八糟也没关系，你自己从中理出有用信息
9. 用户跑题了，把有用的捞出来存好，然后自然拉回来
10. 用户提供了额外信息（日活、交易量等），积极接收，别浪费
11. 不要用emoji装饰，不要用"亲""您好"等客服腔，像朋友说话
12. 体现你的专业判断力——不只是收集信息，要给出有价值的分析和建议`
            }

            // 立即开始流式回复 + 同时后台启动AI提取（并行）
            const allMessages = await getMessages(sessionId)
            const extractionPromise = extractFieldsWithAI(content, updatedData, effectiveStep, apiKeyToUse, allMessages.slice(-6)).catch(e => {
              console.error('AI extraction error (non-fatal):', e.message)
              return null
            })

            // 发送计时：首字节延迟
            const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, enrichedData)
            const firstByteMs = Date.now() - stepStartTime
            safeSend(`data: ${JSON.stringify({ type: 'timing', firstByteMs })}\n\n`)

            const fullContent = await pipeDeepSeekStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'chat_qa' })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)

            const totalMs = Date.now() - stepStartTime
            safeSend(`data: ${JSON.stringify({ type: 'timing', totalMs, firstByteMs })}\n\n`)

            // ===== 4.2 流式回复结束后，处理后台AI提取结果 =====
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
                console.log(`[AI提取成功] session=${sessionId} 提取${aiInfoUpdates.length}个字段, step: ${effectiveStep}→${updatedStep}`)
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

            // ===== 4.3 后台完成度检查（不阻塞用户） =====
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
            console.error('DeepSeek collection error:', err.message)
            const fallbackResponse = result.response || '抱歉，AI暂时无法回答。请继续提供信息即可。'
            await simulateTypingSSE(res, fallbackResponse)
            await addMessage(sessionId, 'assistant', fallbackResponse)
          }
        }
      }
    } else {
      // ===== 报告已生成阶段：后续对话全部走 DeepSeek =====
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
            const fullContent = await pipeDeepSeekStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'report_retry' })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          } else {
            const allMessages = await getMessages(sessionId)
            const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, collectedData)
            const fullContent = await pipeDeepSeekStream(res, streamResult, { isOfficialMode, user, sessionId, usageType: 'chat' })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          }
        } catch (err) {
          console.error('DeepSeek post-report error:', err.message)
          const errMap = {
            'API_KEY_INVALID': '⚠️ AI 服务配置异常（API Key 无效）',
            'API_BALANCE_INSUFFICIENT': '⚠️ DeepSeek API 余额不足',
            'API_RATE_LIMIT': '⚠️ 请求过于频繁，请稍后重试',
            'NETWORK_ERROR': '⚠️ 网络连接超时',
            'NO_API_KEY': '⚠️ AI 服务未配置 API Key',
          }
          const errMsg = errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）`
          await addMessage(sessionId, 'assistant', errMsg)
          safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
        }
      }
    }

    safeSend('data: [DONE]\n\n')
    if (!clientDisconnected) res.end()
  } catch (err) {
    console.error('Stream chat error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '处理消息失败' })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '处理消息失败' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
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

    // 检查付费能力
    let apiKeyToUse = null
    let isOfficialMode = false
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && parseFloat(user.balance) > 0) {
      apiKeyToUse = null
      isOfficialMode = true
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

    const apiKey = apiKeyToUse || await getSystemConfig('deepseek_api_key')
    if (!apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    const model = (await getSystemConfig('deepseek_model')) || 'deepseek-chat'

    // 构建违规类型专项辩护策略
    const violationStrategies = {
      '信用卡套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '赌博': '辩护要点：①强调持有游戏版号/文网文 ②说明有防沉迷系统和实名认证 ③概率公示透明合规 ④游戏内无现金兑换机制、仅售虚拟道具 ⑤与赌博行为有本质区别',
      '虚假交易': '辩护要点：①提供真实订单截图+物流签收记录 ②说明交易量增长有合理原因（如促销活动） ③展示真实买家评价 ④如有刷单嫌疑，承认并说明已停止、已处罚涉事人员',
      '欺诈': '辩护要点：①展示商品/服务真实交付证据 ②如宣传有偏差，承认并已修正所有宣传材料 ③主动为不满客户全额退款 ④更新服务协议增加消费者知情权条款',
      '洗钱': '辩护要点：①提供完整业务合同+海关报关单+外汇许可 ②说明资金流向清晰可追溯、与真实贸易匹配 ③公司已通过反洗钱合规审查 ④大额交易有合同支撑',
      '交易异常': '辩护要点：①解释交易波动原因（季节性/促销/新品上市） ②提供交易对手方信息证明真实性 ③展示历史交易数据佐证业务正常增长',
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

    const prompt = `你是微信商户号申诉实战专家，有10年帮助商户成功申诉的经验。你深谙微信审核人员的关注重点。

═══════════ 客户信息 ═══════════
- 行业：${d.industry || '未提供'}
- 经营模式：${d.business_model || '未提供'}
- 商户名称：${d.merchant_name || '未提供'}
- 公司全称：${d.company_name || '未提供'}
- 商户号：${d.merchant_id || '未提供'}
- 处罚类型：${d.problem_type || '未提供'}
- 违规原因：${d.violation_reason || '未提供'}
- 投诉情况：${complaintStatus || '无投诉'}
- 退款政策：${d.refund_policy || '未提供'}
- 联系人：${d.legal_name || '未提供'}
- 联系电话：${d.contact_phone || '未提供'}
- 申诉历史：${appealHistory || '首次申诉'}
${matchedStrategy ? `\n═══════════ 针对「${reason}」的专项辩护策略 ═══════════\n${matchedStrategy}` : ''}
${industryReq ? `\n═══════════ 行业专业要求 ═══════════\n${industryReq}` : ''}
${appealStrategy ? `\n═══════════ 申诉历史注意 ═══════════\n${appealStrategy}` : ''}
${complaintStrategy ? `\n${complaintStrategy}` : ''}

═══════════ 输出要求 ═══════════

请输出JSON，5个字段，每个字段200-300字符（尽量接近300字，充分利用空间）：

{
  "business_model": "说明经营模式。包含：①基于客户信息描述主营业务和服务对象 ②盈利模式 ③解释为何本业务与被指控的违规行为有本质区别。对于客户未提供的数据，用'我方可提供XXX证明'的表述引导客户补充，不要编造数字。",
  "refund_rules": "展示消费者保护体系。包含：①基于客户提供的退款政策展开说明 ②描述退款处理流程框架（申请→审核→退款） ③给出响应时效承诺。退款政策要与行业匹配（B2B按合同、虚拟商品可替换等）。如客户原有政策不完善，用'现已优化为...'的措辞建议改进方案。",
  "complaint_cause": "诚恳分析投诉原因。包含：①基于客户提供的投诉情况如实描述 ②分析根本原因 ③如有投诉必须正面承认并说明处理进展 ④解释为何不构成所指控的违规，或承认不足并说明整改方向。绝不回避负面信息。",
  "complaint_resolution": "展示解决方案框架。包含：①针对本次违规类型的具体整改方向 ②建议改进的流程和新增的预防机制 ③用'已/将'区分已完成和计划中的措施 ④列出建议准备的证据材料清单。不要替客户声称已完成未确认的整改。",
  "supplementary": "补充有利信息。包含：①提醒客户准备哪些资质证明（营业执照、行业许可等） ②建议附上的具体证据材料清单（根据违规类型定制） ③恢复后的合规承诺 ④联系方式表达配合意愿。这段是帮客户理清'需要准备什么材料'。"
}

═══════════ 铁律（违反则文案无效）═══════════
1. 【禁止编造数据】绝对不能编造客户未提供的任何具体数字、统计、日期、编号！不能编造注册用户数、好评率、退款成功率、订单量、评分、信用代码、ICP备案号等。如需引用数据，用"我方可提供XX数据证明"代替。
2. 【禁止占位符】不能出现[具体版号]、[具体日期]等方括号占位符。如需客户填入信息，用"（附：您的XX证书编号）"的格式。
3. 【禁止虚假声明】不能替客户声称已完成未确认的整改（如"已上线自动化退款系统"）。对于建议做的整改，用"现已着手/将"表述，对于客户确认的事实才用"已"。
4. 【禁止回避】有投诉就必须正面回应，不能假装没有。
5. 【禁止套话】禁用"高度重视""积极配合""竭诚服务"等空洞表述。
6. 【充分利用】每段200-300字符，信息密度要高。
7. 【诚恳务实】语气诚恳、立场坚定。承认不足是诚意，提供可验证的信息是实力。引导客户用真实证据说话，而非靠文字包装。
8. 【审核视角】微信审核员能看到商户的真实交易数据，所以文案中的任何数字都必须是客户能验证的真实数据，或者用"可提供XX证明"让客户自己填充。`

    // 调用 DeepSeek API（带重试）
    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const maxRetries = 2
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 90000)
        const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: '你是微信商户号申诉实战专家。请严格按JSON格式输出，不要输出任何其他内容。' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.6,
            max_tokens: 3000,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!apiRes.ok) {
          const errText = await apiRes.text().catch(() => '')
          console.error(`DeepSeek appeal API error (attempt ${attempt + 1}):`, apiRes.status, errText)
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
          return res.status(500).json({ error: `AI服务请求失败(${apiRes.status})` })
        }
        const apiData = await apiRes.json()
        content = apiData.choices?.[0]?.message?.content || ''
        inputTokens = apiData.usage?.prompt_tokens || 0
        outputTokens = apiData.usage?.completion_tokens || 0
        break // 成功，退出重试循环
      } catch (fetchErr) {
        console.error(`DeepSeek appeal fetch error (attempt ${attempt + 1}):`, fetchErr.message)
        if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
        return res.status(500).json({ error: `AI服务连接失败：${fetchErr.name === 'AbortError' ? '请求超时(90s)' : fetchErr.message}` })
      }
    }

    if (!content) {
      return res.status(500).json({ error: 'AI返回内容为空，请重试' })
    }

    // 解析JSON（兼容DeepSeek返回 markdown 代码块包裹的情况）
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

// ========== 充值 API ==========

// 获取充值配置（公开接口，用户需要看到QR码和金额选项）
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
    res.json({
      enabled: true,
      amounts: (amounts || '10,30,50,100,200,500').split(',').map(s => parseFloat(s.trim())).filter(n => n > 0),
      minAmount: parseFloat(minAmount || '10'),
      qrWechat: qrWechat || '',
      qrAlipay: qrAlipay || '',
      instructions: instructions || '',
    })
  } catch (err) {
    console.error('Recharge config error:', err)
    res.status(500).json({ error: '获取充值配置失败' })
  }
})

// 用户提交充值订单（需登录）
app.post('/api/recharge', requireUser, async (req, res) => {
  try {
    const { amount, paymentMethod, remark } = req.body
    const userId = req.userId
    if (!userId) return res.status(400).json({ error: '请先登录' })
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: '请选择充值金额' })
    if (!paymentMethod) return res.status(400).json({ error: '请选择支付方式' })
    const minAmount = parseFloat((await getSystemConfig('recharge_min_amount')) || '10')
    if (parseFloat(amount) < minAmount) return res.status(400).json({ error: `最低充值金额为 ¥${minAmount}` })
    const orderId = await createRechargeOrder(userId, parseFloat(amount), paymentMethod, remark || '')
    res.json({ success: true, orderId })
  } catch (err) {
    console.error('Create recharge order error:', err)
    res.status(500).json({ error: '提交充值订单失败' })
  }
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

// 测试 DeepSeek API Key 是否有效
app.post('/api/admin/test-deepseek', requireAdmin, async (req, res) => {
  try {
    const { apiKey } = req.body
    const key = apiKey || await getSystemConfig('deepseek_api_key')
    if (!key) return res.json({ success: false, error: '未配置 API Key' })

    console.log('[Test DeepSeek] Key:', key.slice(0, 6) + '****' + key.slice(-4), 'Length:', key.length)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: '你好' }], max_tokens: 20 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!r.ok) {
      const errText = await r.text()
      console.log('[Test DeepSeek] Error:', r.status, errText)
      return res.json({ success: false, error: `API 返回 ${r.status}: ${errText.substring(0, 200)}` })
    }

    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content || ''
    res.json({ success: true, reply: reply.substring(0, 100), model: data.model })
  } catch (err) {
    console.error('[Test DeepSeek]', err)
    res.json({ success: false, error: err.message })
  }
})

// 管理员查看Token消费明细
app.get('/api/admin/token-usage', requireAdmin, async (req, res) => {
  try {
    const [usage, stats] = await Promise.all([
      getAllTokenUsage(200),
      getTokenUsageStats(),
    ])
    res.json({ usage, stats })
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

// SPA fallback（排除 /api 路径，避免 API 404 返回 HTML）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: '接口不存在' })
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

// 全局错误处理（生产环境不泄露内部错误细节）
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err)
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(err.status || 500).json({
    error: isDev ? err.message : '服务器内部错误，请稍后重试',
  })
})

async function start() {
  try {
    await initDatabase()
    const server = app.listen(PORT, () => console.log(`🚀 服务器已启动: http://localhost:${PORT}`))

    // 优雅关闭：先停止接受新连接，等待现有请求完成，再关闭数据库
    const shutdown = (signal) => {
      console.log(`\n⏹ 收到 ${signal}，正在优雅关闭...`)
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
