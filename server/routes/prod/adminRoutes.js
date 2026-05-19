import {
  initDatabase,
  createSession, getSession, updateSession,
  addMessage, getMessages, getAllSessions, deleteSession, verifyAdmin,
  changeAdminPassword,
  getSystemConfigs, updateSystemConfigs, getSystemConfig,
  getPaymentConfigs, updatePaymentConfigs,
  getAllConfig, setConfig, batchSetConfig,
  getDashboardStats, lookupSessions,
  registerUser, getUserByPhone, getUserById, updateUserApiMode,
  deductBalance, getAllUsers, adjustUserBalance, deleteUser,
  getUserSessions, isChinese,
  trackUserAction, updateUserActivity, incrementLoginCount, incrementUserMessages, incrementUserSpent,
  checkDeepAnalysisQuota, incrementDeepAnalysisCount,
  saveDeepAnalysisResult, getDeepAnalysisResult,
  createRechargeOrder, getRechargeOrders, getUserRechargeOrders,
  getPendingRechargeOrderByOutTradeNo,
  confirmRechargeOrder, rejectRechargeOrder, getPendingRechargeCount,
  createSuccessCase, getSuccessCases, getSuccessCaseById, updateSuccessCase, deleteSuccessCase, findSimilarCases,
  recordTokenUsage, getUserTokenUsage, getUserTokenStats, getAllTokenUsage, getTokenUsageStats, getTokenUsageLogs,
  getTokenCoverageReport, getUnifiedTokenTimeline,
  saveAppealText, getAppealText, updateAppealStatus, getAppealStats,
  getAllAIRules, getAIRuleById, createAIRule, updateAIRuleStatus, updateAIRuleContent, deleteAIRule, getAIRuleStats,
  getConversationAnalyses, getConversationAnalysisById, getAnalysisStats, getQualityTopAndLow,
  logFieldChange, getFieldChangeLog,
  getAIModels, getAIModelById, getActiveAIModel, createAIModel, updateAIModel, setActiveAIModel, deleteAIModel as deleteAIModelDB, updateModelHealth, getAIModelsWithHealth,
  getRuleChangeLog, getLearningMetrics, getUnanalyzedSessions,
  getTagStats, getConversationTags,
  getKnowledgeClusters, getClusterStats,
  getEngineHealth, getExperiments,
  createProduct, updateProduct, deleteProduct, getProductById, getProducts, getProductStats, batchUpdateProductsStatus,
  incrementProductMetric, getRecommendations, updateRecommendationStatus, getRecommendationStats, listAdminRecommendations,
  getDeepseekAccounts, getDeepseekAccountById, createDeepseekAccount, updateDeepseekAccount, deleteDeepseekAccount, updateDeepseekBalance,
  logAIActivity, getAIActivityLog, getAIActivityStats,
  createOrder, getOrderByNo, getOrders, getOrdersByUser, getOrderById, getUserOrders, updateOrderStatus, appendServiceMessage, getOrderServiceMessages,
  fixEncryptedData,
  saveComplaintDoc, getComplaintDoc,
  createSchedule, getSchedules, updateSchedule, deleteSchedule,
  updateSessionOrder, patchSessionCollectedData, getPool,
  getSessionChatboardStats,
} from '../../db.js'
import { chatWithAI, streamChatWithAI, extractFieldsWithAI, expandFieldsForIndustry, assessCompletenessWithAI, buildCollectionInstruction, checkWeightedCollectionReady, getAIConfig, getWelcomeMessage } from '../../ai.js'
import { createTurnBilling, addOfficialUsage, billUserTokenUsage, recordSystemTokenUsage, tokensFromUsage } from '../../billing.js'
import { initUsageTracker, trackAIUsageFromRequest, trackAIUsage } from '../../ai/usageTracker.js'
import { buildReportPrompt, TOTAL_STEPS, INFO_FIELDS, LOCAL_WELCOME, normalizeFieldValue, buildCollectionContext, findNextUnfilledStep } from '../../localAI.js'
import xianyuApi from '../../xianyu-api.js'
import { getDashboardAnalytics } from '../../xianyu-dashboard.js'
import { calculateCost } from '../../tokenizer.js'
import {
  analyzeConversation, batchAnalyzeConversations, aggregateDailyMetrics,
  generateRulesFromAnalysis, startEvolutionScheduler, stopEvolutionScheduler,
  schedulePostConversationAnalysis, evaluateRuleEffectiveness, autoPromoteRules,
  invalidateRulesCache, autoTagConversation, autoReviewRule, batchAutoReviewRules,
  aggregateKnowledgeClusters, getEngineHealthSummary, safeExecute, runExplorationCycle,
} from '../../evolution.js'
import {
  loadProductCatalogForPrompt, invalidateProductCache,
  aiOptimizeProduct, batchOptimizeProducts,
  getSmartRecommendations, updateUserInterestFromConversation, parseProductRecommendations,
  aiBargain, aiGenerateVirtualPersona,
  aiAutoCreateProducts, aiSuggestNewProducts, aiAssessRisk,
} from '../../mall.js'
import { checkAllModels, checkSingleModel, autoSwitchIfNeeded, startHealthScheduler, callWithFallback } from '../../modelHealth.js'
import { apiMetricsMiddleware, startMonitorScheduler, stopMonitorScheduler, getMonitorStatus, getHealthSummary, getAlerts, acknowledgeAlert, clearAlerts, triggerHealthCheck, resetApiMetrics } from '../../monitor.js'
import { runBackup, startBackupScheduler, stopBackupScheduler, getBackupStatus, deleteBackupFile } from '../../backup.js'
import { createPayment, handleWechatNotify, handleAlipayNotify, handleEpayNotify, handleCodePayNotify, queryPaymentStatus, getPaymentChannels, generateOutTradeNo, reloadPaymentFromDb } from '../../payment.js'
import { syncPaymentEnvToDb, getPaymentSiteBase } from '../../paymentEnvSync.js'
import { validateSessionOwnership } from '../../middleware/sessionAccess.js'
import { agentDebugLog } from '../../utils/agentDebugLog.js'
import {
  handlePostComplaintReply,
  handleGetAppealGuide,
  handlePostAppealGuideGenerate,
} from '../../handlers/appealGuideApi.js'
import fetch from 'node-fetch'
import { listRegistryForApi } from '../../ai/usageRegistry.js'
import { getCollectionFieldGapStats, formatGapStatsForPrompt } from '../../ai/tokenOversightHints.js'

/**
 * 管理端路由
 */
export function registerAdminRoutes(app, ctx) {
  const {
    signToken, verifyAdminToken, requireAdmin, requireAdminOrQueryToken,
    authLimiter, recordAIUsageForRequest, logFinancialActivity,
  } = ctx

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
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: '新密码至少8位' })
    if (!/[a-z]/.test(newPassword)) return res.status(400).json({ error: '密码需包含小写字母' })
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: '密码需包含大写字母' })
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: '密码需包含数字' })
    await changeAdminPassword(req.admin.id, newPassword)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '修改密码失败' })
  }
})

app.get('/api/admin/appeal-stats', requireAdmin, async (req, res) => {
  try {
    res.json(await getAppealStats())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取申诉统计失败' })
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
    const { amount, type } = req.body
    if (amount === undefined || isNaN(parseFloat(amount))) return res.status(400).json({ error: '请输入有效金额' })
    const val = type === 'deduct' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount))
    const user = await adjustUserBalance(req.params.id, val)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    await logFinancialActivity({
      userId: user.id,
      type: type === 'deduct' ? 'admin_deduct' : 'admin_recharge',
      amount: val,
      balanceAfter: parseFloat(user.balance || 0),
      refId: 'admin_manual',
      note: req.body.note || `管理员${type === 'deduct' ? '扣款' : '充值'}`,
    })
    res.json({ success: true, user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '调整余额失败' })
  }
})

app.post('/api/admin/users/ai-command', requireAdmin, async (req, res) => {
  try {
    const { instruction } = req.body || {}
    if (!instruction?.trim()) return res.status(400).json({ error: '请输入指令' })
    const { executeUserAiCommand } = await import('../../services/userAiCommand.js')
    const result = await executeUserAiCommand(instruction.trim())
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'AI 指令执行失败' })
  }
})

app.post('/api/admin/users/ai-command/confirm-delete', requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body || {}
    const idList = Array.isArray(userIds) ? userIds : []
    if (!idList.length) return res.status(400).json({ error: '请指定要删除的用户' })
    const { executePendingUserDeletes } = await import('../../services/userAiCommand.js')
    const result = await executePendingUserDeletes(idList)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '删除失败' })
  }
})

/** 统一自然语言管理指令（充值/订单/分析/知识库/运营/看板/Token/进化/日程/备份/监控/设置） */
app.post('/api/admin/ai-command', requireAdmin, async (req, res) => {
  try {
    const { module, instruction } = req.body || {}
    if (!module) return res.status(400).json({ error: '缺少 module 参数' })
    if (!instruction?.trim()) return res.status(400).json({ error: '请输入指令' })
    const { executeAdminAiCommand } = await import('../../services/adminAi/index.js')
    const mod = String(module).trim()
    const result = await executeAdminAiCommand(mod, instruction.trim(), { adminId: req.admin?.id })
    agentDebugLog('adminRoutes:unified-ai-command', 'ok', {
      module: mod,
      instructionLen: instruction.trim().length,
      executedTypes: (result.executed || []).map((e) => e.type),
      hasPending: !!result.pendingConfirms,
    }, 'H-unified-ai')
    res.json(result)
  } catch (err) {
    console.error(err)
    agentDebugLog('adminRoutes:unified-ai-command', 'error', { message: err.message }, 'H-unified-ai')
    res.status(500).json({ error: err.message || 'AI 指令执行失败' })
  }
})

app.post('/api/admin/ai-command/confirm', requireAdmin, async (req, res) => {
  try {
    const { module, kind, payload } = req.body || {}
    if (!kind) return res.status(400).json({ error: '缺少 kind' })
    const { confirmAdminAiAction } = await import('../../services/adminAi/index.js')
    const result = await confirmAdminAiAction(module, kind, payload || {}, { adminId: req.admin?.id })
    res.json({ success: true, ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '确认操作失败' })
  }
})

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try { res.json(await getDashboardStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取统计失败' }) }
})

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const { getAdminAnalytics } = await import('../../services/analyticsStats.js')
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days || '30'), 10) || 30))
    res.json(await getAdminAnalytics({ days }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取数据分析失败' })
  }
})

/** 数据分析页 AI 洞察（记入 Token 明细 admin_analytics_insights） */
app.post('/api/admin/analytics/ai-insights', requireAdmin, async (req, res) => {
  try {
    const { getAdminAnalytics } = await import('../../services/analyticsStats.js')
    const days = Math.min(90, Math.max(7, parseInt(String(req.body?.days || '30'), 10) || 30))
    const analytics = await getAdminAnalytics({ days })
    const cfg = await getAIConfig()
    if (!cfg?.apiKey) return res.status(500).json({ error: 'AI 未配置' })

    const payload = {
      days: analytics.days,
      profitAnalysis: analytics.dashboard?.profitAnalysis,
      tokenSummary: analytics.dashboard?.tokenSummary,
      tokenWindow: analytics.tokenWindow,
      tokenByTypeWindow: (analytics.tokenByTypeWindow || []).slice(0, 15),
      chatboardTotals: analytics.chatboard?.totals,
      actionBreakdown: (analytics.window?.actionBreakdown || []).slice(0, 12),
      knowledge: analytics.knowledge,
      topUsers: (analytics.dashboard?.topUsers || []).slice(0, 8).map((u) => ({
        nickname: u.nickname,
        total_messages: u.total_messages,
        total_spent: u.total_spent,
      })),
    }

    const systemPrompt = `你是 SaaS 运营数据分析顾问。仅根据 JSON 写中文 Markdown 报告，禁止编造数字。
## 经营总览（充值、AI 成本、毛利、用户增长）
## Token 消耗（窗口内输入/输出、系统 vs 用户、Top 功能类型）
## 用户与产品（会话、行为分布、知识库案例数）
## 风险与建议（3～5 条可执行项）
无数据处写「数据不足」。百分比须能从 JSON 直接计算。`

    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload, null, 2) },
        ],
        temperature: 0.3,
        max_tokens: 2800,
      }),
      signal: AbortSignal.timeout(120000),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => '')
      return res.status(500).json({ error: 'AI 分析失败', detail: t.slice(0, 200) })
    }
    const data = await aiRes.json()
    const markdown = data.choices?.[0]?.message?.content || ''
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_analytics_insights',
        usage: data.usage,
        provider: cfg.provider,
        modelName: cfg.model,
      })
    }
    const generatedAt = new Date().toISOString()
    const contextKey = `days:${days}`
    const trimmed = markdown.trim()
    const { saveAdminAiReport } = await import('../../services/adminAiReports.js')
    await saveAdminAiReport('analytics_insights', contextKey, trimmed, { days })
    res.json({ markdown: trimmed, generatedAt, contextKey })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'AI 分析失败' })
  }
})

app.get('/api/admin/ai-reports/latest', requireAdmin, async (req, res) => {
  try {
    const scope = String(req.query.scope || '').trim()
    const contextKey = String(req.query.contextKey || 'default').trim()
    const { getLatestAdminAiReport } = await import('../../services/adminAiReports.js')
    const row = await getLatestAdminAiReport(scope, contextKey)
    if (!row) return res.json({ markdown: '', generatedAt: null })
    res.json({ markdown: row.markdown, generatedAt: row.generatedAt, meta: row.meta })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '读取简报失败' })
  }
})

// --- 运营中心（大屏 / 搜索 / 快照 / 质检 / Prompt）---
app.get('/api/admin/ops/screen', requireAdmin, async (req, res) => {
  try {
    const { getOpsScreenPayload } = await import('../../opsCenter.js')
    res.json(await getOpsScreenPayload())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取大屏数据失败' })
  }
})

app.get('/api/admin/ops/messages/search', requireAdmin, async (req, res) => {
  try {
    const { searchMessagesAdmin } = await import('../../opsCenter.js')
    res.json(await searchMessagesAdmin({
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '搜索失败' })
  }
})

app.get('/api/admin/ops/week-compare', requireAdmin, async (req, res) => {
  try {
    const { getWeekCompare } = await import('../../opsCenter.js')
    const days = parseInt(String(req.query.days || '7'), 10) || 7
    res.json(await getWeekCompare(days))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取周对比失败' })
  }
})

app.post('/api/admin/ops/snapshots', requireAdmin, async (req, res) => {
  try {
    const { saveChatboardSnapshot, listChatboardSnapshots } = await import('../../opsCenter.js')
    const days = parseInt(String(req.body?.days ?? req.query?.days ?? '7'), 10) || 7
    const saved = await saveChatboardSnapshot(days)
    const list = await listChatboardSnapshots(30)
    res.json({ saved, list })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '保存快照失败' })
  }
})

app.get('/api/admin/ops/snapshots', requireAdmin, async (req, res) => {
  try {
    const { listChatboardSnapshots } = await import('../../opsCenter.js')
    res.json({ snapshots: await listChatboardSnapshots(req.query.limit) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取快照失败' })
  }
})

app.get('/api/admin/ops/alerts', requireAdmin, async (req, res) => {
  try {
    const { getOpsAlerts } = await import('../../opsCenter.js')
    res.json(await getOpsAlerts())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取告警失败' })
  }
})

app.post('/api/admin/ops/qa/sample', requireAdmin, async (req, res) => {
  try {
    const { sampleSessionsForQA } = await import('../../opsCenter.js')
    const result = await sampleSessionsForQA(req.body?.count ?? 8)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '抽样失败' })
  }
})

app.get('/api/admin/ops/qa', requireAdmin, async (req, res) => {
  try {
    const { listQAReviews } = await import('../../opsCenter.js')
    const { items, purged } = await listQAReviews(req.query.rating || '', req.query.limit)
    res.json({ items, purged })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取质检列表失败' })
  }
})

app.put('/api/admin/ops/qa/:sessionId', requireAdmin, async (req, res) => {
  try {
    const { updateQAReview } = await import('../../opsCenter.js')
    await updateQAReview(req.params.sessionId, { rating: req.body?.rating, notes: req.body?.notes })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'SESSION_GONE') {
      return res.status(404).json({ error: err.message })
    }
    console.error(err)
    res.status(500).json({ error: '更新质检失败' })
  }
})

app.get('/api/admin/ops/quick-replies', requireAdmin, async (req, res) => {
  try {
    const { listQuickReplies } = await import('../../opsCenter.js')
    res.json({ items: await listQuickReplies() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取快捷回复失败' })
  }
})

app.post('/api/admin/ops/quick-replies', requireAdmin, async (req, res) => {
  try {
    const { saveQuickReply } = await import('../../opsCenter.js')
    res.json(await saveQuickReply(req.body || {}))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '保存快捷回复失败' })
  }
})

app.delete('/api/admin/ops/quick-replies/:id', requireAdmin, async (req, res) => {
  try {
    const { deleteQuickReply } = await import('../../opsCenter.js')
    await deleteQuickReply(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '删除失败' })
  }
})

app.get('/api/admin/ops/prompts', requireAdmin, async (req, res) => {
  try {
    const { listPrompts } = await import('../../opsCenter.js')
    res.json({ items: await listPrompts() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取 Prompt 失败' })
  }
})

app.get('/api/admin/ops/prompts/published/:key', requireAdmin, async (req, res) => {
  try {
    const { getPromptByKey } = await import('../../opsCenter.js')
    const row = await getPromptByKey(String(req.params.key || '').trim(), 'published')
    res.json({ item: row || null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取线上 Prompt 失败' })
  }
})

app.post('/api/admin/ops/prompts/draft', requireAdmin, async (req, res) => {
  try {
    const { savePromptDraft } = await import('../../opsCenter.js')
    const { promptKey, title, content } = req.body || {}
    if (!promptKey || !content) return res.status(400).json({ error: '缺少 promptKey 或 content' })
    res.json(await savePromptDraft({ promptKey, title: title || promptKey, content }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '保存草稿失败' })
  }
})

app.post('/api/admin/ops/prompts/:id/publish', requireAdmin, async (req, res) => {
  try {
    const { publishPrompt } = await import('../../opsCenter.js')
    const row = await publishPrompt(parseInt(req.params.id, 10))
    res.json({ ok: true, published: { id: row.id, promptKey: row.prompt_key, version: row.version } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '发布失败' })
  }
})

app.get('/api/admin/ops/prompt-suggestions', requireAdmin, async (req, res) => {
  try {
    const { getPromptRevisionSuggestions } = await import('../../opsCenter.js')
    res.json(await getPromptRevisionSuggestions())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取建议失败' })
  }
})

app.post('/api/admin/ops/prompts/test', requireAdmin, async (req, res) => {
  try {
    const { userMessage, collectedData } = req.body || {}
    const msg = String(userMessage || '我做餐饮的，微信收款被限额了，说我交易异常').trim()
    const data = collectedData && typeof collectedData === 'object' ? collectedData : {}
    const instruction = await buildCollectionInstruction()
    const enriched = { ...data, _instruction: instruction }
    const result = await chatWithAI([{ role: 'user', content: msg }], null, enriched)
    if (result?.error) return res.status(502).json({ error: result.error })
    if (result?.usage || result?.inputTokens || result?.outputTokens) {
      const cfg = await getAIConfig().catch(() => null)
      await trackAIUsage({
        userId: 0,
        type: 'admin_prompt_test',
        usage: result.usage || {
          prompt_tokens: result.inputTokens,
          completion_tokens: result.outputTokens,
          total_tokens: (result.inputTokens || 0) + (result.outputTokens || 0),
        },
        provider: cfg?.provider,
        modelName: cfg?.model,
      })
    }
    res.json({
      reply: result?.response || '',
      instructionChars: instruction.length,
      usedAI: !!result?.usedAI,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '测试失败' })
  }
})

app.get('/api/admin/sessions/chatboard', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || '14'), 10) || 14))
    res.json(await getSessionChatboardStats({ days }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取会话看板数据失败' })
  }
})

/** 基于看板统计生成 AI 简报（需配置官方 AI） */
app.post('/api/admin/sessions/chatboard/brief', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.body?.days ?? req.query?.days ?? '14'), 10) || 14))
    const stats = await getSessionChatboardStats({ days })
    const cfg = await getAIConfig()
    if (!cfg?.apiKey) return res.status(500).json({ error: 'AI服务未配置' })
    const compact = JSON.stringify({
      days: stats.days,
      metricDefinitions: stats.metricDefinitions,
      dataQuality: stats.dataQuality,
      totals: stats.totals,
      messagesByRole: stats.messagesByRole,
      sessionsByStep: stats.sessionsByStep,
      sessionsByStatus: stats.sessionsByStatus,
      orderBinding: stats.orderBinding,
      userMessageLengthBuckets: stats.userMessageLengthBuckets,
      sessionDepth: stats.sessionDepth,
      topSessions: (stats.topSessionsByVolume || []).slice(0, 12),
      sampleFirstMessages: (stats.recentFirstUserSnippets || []).slice(0, 18).map((s, i) => ({
        index: i + 1,
        sessionId: s.sessionId,
        snippet: s.snippet,
      })).filter((s) => s.snippet),
    })
    const systemPrompt = `你是商户申诉助手产品的数据分析顾问。你只能根据用户提供的 JSON 统计撰写客观简报，禁止编造。

硬性规则：
1. 每个结论必须能在 JSON 的 totals、messagesByRole、sessionsByStep、orderBinding、userMessageLengthBuckets、sessionDepth 或 sampleFirstMessages 中找到依据；找不到则写「数据不足，无法判断」。
2. 禁止虚构：用户数、行业分布、转化率、未给出的百分比、未在 sampleFirstMessages 中出现的会话内容。
3. 禁止心理诊断（如「焦虑」「抑郁」）；「客户怎么聊」仅描述样本中可观察的句式：长短、是否含订单/平台名、是否一次粘贴大段文字等。
4. sampleFirstMessages 中的 sessionId 仅可引用列表中已有的 ID，不得编造。
5. 百分比仅当分子分母均来自 JSON 且你能明确写出计算方式时才可写。
6. 输出中文 Markdown，四节：## 总览、## 客户怎么聊、## 会话深浅与流程、## 给 AI 的提问优化建议（每节用列表）。
7. 总览：2～4 条，引用 totals 与 metricDefinitions 中的口径。
8. 会话深浅：必须说明 sessionDepth 仅针对「窗口内新建会话」；结合 step/status、角色占比。
9. 优化建议：必须对应 sessionsByStep 或长度分桶或 orderBinding 中的具体数字，写出可执行的追问字段名（如行业、订单号），不得空泛。`
    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '以下为最近 ' + stats.days + ' 天的会话看板统计 JSON：\n' + compact },
        ],
        temperature: 0.35,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(90000),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => '')
      return res.status(500).json({ error: 'AI 调用失败', detail: t.slice(0, 200) })
    }
    const data = await aiRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_chatboard_brief',
        usage: data.usage,
        provider: cfg.provider,
        modelName: cfg.model,
      })
    }
    const trimmed = text.trim()
    const contextKey = `days:${days}`
    const statsMeta = { days: stats.days, generatedAt: stats.generatedAt }
    const { saveAdminAiReport } = await import('../../services/adminAiReports.js')
    await saveAdminAiReport('session_chatboard_brief', contextKey, trimmed, statsMeta)
    res.json({ markdown: trimmed, statsMeta, generatedAt: new Date().toISOString(), contextKey })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '生成简报失败' })
  }
})

app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q) {
      const { getAdminSessionsFiltered } = await import('../../opsCenter.js')
      const data = await getAdminSessionsFiltered({ q, limit: req.query.limit, offset: req.query.offset })
      return res.json(data)
    }
    res.json({ sessions: await getAllSessions(), total: null })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取会话列表失败' }) }
})

app.get('/api/admin/sessions/:id/messages', requireAdmin, async (req, res) => {
  try {
    const [messages, session] = await Promise.all([
      getMessages(req.params.id), getSession(req.params.id)
    ])
    if (!session) return res.status(404).json({ error: '会话不存在' })
    res.json({ messages, session })
  } catch (err) { console.error(err); res.status(500).json({ error: '获取聊天记录失败' }) }
})

app.get('/api/admin/sessions/:id/analysis', requireAdmin, async (req, res) => {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    res.json(await buildSessionAnalysis(session))
  } catch (err) { console.error(err); res.status(500).json({ error: '分析失败' }) }
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

    // 记录资金审计日志（充值确认）
    const rechargeUser = await getUserById(order.user_id)
    if (rechargeUser) {
      await logFinancialActivity({
        userId: order.user_id,
        type: 'recharge_confirm',
        amount: parseFloat(order.amount),
        balanceAfter: parseFloat(rechargeUser.balance || 0),
        refId: order.order_no || order.id,
        note: `充值 ¥${order.amount} (${req.body.adminNote || '管理员确认'})`,
      })
    }

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
    const { sessionId, title, industry, problemType, reportContent, successSummary, adminNotes } = req.body
    if (!title) return res.status(400).json({ error: '标题不能为空' })
    const id = await createSuccessCase({
      sessionId: sessionId || null,
      title,
      industry,
      problemType,
      reportContent,
      successSummary,
      adminNotes,
      collectedData: {},
    })
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

/** 聚合会话案例材料（消息 / 对话分析 / 深度分析 / 申诉文案；会话已删时仍可读孤儿分析） */
app.get('/api/admin/sessions/:id/case-material', requireAdmin, async (req, res) => {
  try {
    const { buildCaseMaterialFromSession } = await import('../../services/caseMaterial.js')
    const bundle = await buildCaseMaterialFromSession(req.params.id)
    if (!bundle.sessionExists && !bundle.materialLen) {
      return res.status(404).json({ error: '会话不存在且无关联分析/申诉材料' })
    }
    res.json(bundle)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '加载材料失败' })
  }
})

/** 从进化「对话分析」记录加载案例材料 */
app.get('/api/admin/evolution/analyses/:id/case-material', requireAdmin, async (req, res) => {
  try {
    const { buildCaseMaterialFromAnalysisId } = await import('../../services/caseMaterial.js')
    const bundle = await buildCaseMaterialFromAnalysisId(parseInt(req.params.id, 10))
    if (!bundle.materialLen) return res.status(404).json({ error: '该分析记录无可用正文' })
    res.json(bundle)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '加载材料失败' })
  }
})

/** 知识库：AI 辅助生成案例标题/摘要/备注（记入 admin_knowledge_ai） */
app.post('/api/admin/cases/ai-enhance', requireAdmin, async (req, res) => {
  try {
    const { sessionId, analysisId, title, industry, problemType, reportContent, successSummary } = req.body || {}

    const { buildCaseMaterialFromSession, buildCaseMaterialFromAnalysisId } = await import('../../services/caseMaterial.js')
    let mergedReport = String(reportContent || '').trim()
    let mergedIndustry = industry || ''
    let mergedProblem = problemType || ''
    let mergedTitle = title || ''
    let sources = []

    if (analysisId) {
      const bundle = await buildCaseMaterialFromAnalysisId(parseInt(analysisId, 10))
      sources = bundle.sources || []
      if ((!mergedReport || mergedReport.length < 40) && bundle.reportContent) mergedReport = bundle.reportContent
      if (!mergedIndustry && bundle.industry) mergedIndustry = bundle.industry
      if (!mergedProblem && bundle.problemType) mergedProblem = bundle.problemType
      if (!mergedTitle && bundle.title) mergedTitle = bundle.title
    } else if (sessionId) {
      const bundle = await buildCaseMaterialFromSession(sessionId)
      sources = bundle.sources || []
      if ((!mergedReport || mergedReport.length < 40) && bundle.reportContent) mergedReport = bundle.reportContent
      if (!mergedIndustry && bundle.industry) mergedIndustry = bundle.industry
      if (!mergedProblem && bundle.problemType) mergedProblem = bundle.problemType
      if (!mergedTitle && bundle.title) mergedTitle = bundle.title
      if (!bundle.sessionExists && !bundle.materialLen) {
        return res.status(404).json({ error: '会话不存在且无关联材料，请使用「从进化分析加载」', code: 'NO_MATERIAL' })
      }
    }

    const context = {
      title: mergedTitle,
      industry: mergedIndustry,
      problemType: mergedProblem,
      reportContent: mergedReport.slice(0, 6000),
      successSummary: successSummary || '',
      sessionSnippet: '',
      deepAnalysis: '',
    }

    const materialLen = (context.reportContent?.length || 0) + (context.successSummary?.trim().length || 0)
    if (materialLen < 40) {
      return res.status(400).json({
        error: sources.length
          ? '材料过短，请补充「案例材料」或成功要点后再试'
          : '该会话暂无对话分析/聊天记录：请粘贴「案例材料」，或选择有进化分析数据的会话',
        code: 'INSUFFICIENT_MATERIAL',
        sources,
      })
    }

    const cfg = await getAIConfig()
    if (!cfg?.apiKey) {
      return res.status(500).json({ error: 'AI 未配置：请在「AI 模型」中配置当前激活模型的 API Key，或填写 server/.env / system_config' })
    }

    const systemPrompt = `你是商户申诉成功案例编辑。根据用户 JSON 中的 reportContent、sessionSnippet、deepAnalysis 归纳案例字段。
输出严格 JSON（无 markdown 代码块），字段：
{"title":"案例标题(12-24字)","industry":"行业","problemType":"处罚/问题类型","successSummary":"成功要点(80-150字，写可复用的经验)","adminNotes":"管理员内部备注(可选,60字内)"}
规则：只根据材料写，不编造金额/判决；每个字段必须有实质内容；禁止输出「待补充」「示例」等占位语。`

    const aiBodyBase = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(context) },
      ],
      temperature: 0.25,
      max_tokens: 1000,
    }
    let aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ ...aiBodyBase, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(60000),
    })
    if (!aiRes.ok) {
      aiRes = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(aiBodyBase),
        signal: AbortSignal.timeout(60000),
      })
    }
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => '')
      return res.status(500).json({ error: 'AI 生成失败', detail: t.slice(0, 200) })
    }
    const data = await aiRes.json()
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_knowledge_ai',
        usage: data.usage,
        sessionId: sessionId || null,
        provider: cfg.provider,
        modelName: cfg.model,
      })
    }
    let parsed = {}
    const raw = data.choices?.[0]?.message?.content || ''
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : JSON.parse(raw || '{}')
    } catch {
      return res.status(500).json({ error: 'AI 返回格式无效', raw: raw.slice(0, 300) })
    }

    const norm = {
      title: parsed.title || parsed.标题 || parsed.caseTitle || '',
      industry: parsed.industry || parsed.行业 || '',
      problemType: parsed.problemType || parsed.problem_type || parsed.处罚类型 || parsed.问题类型 || '',
      successSummary: parsed.successSummary || parsed.success_summary || parsed.成功要点 || parsed.成功摘要 || '',
      adminNotes: parsed.adminNotes || parsed.admin_notes || parsed.管理员备注 || parsed.备注 || '',
    }

    const filledFields = []
    const pick = (key, label) => {
      const v = typeof norm[key] === 'string' ? norm[key].trim() : ''
      if (v && !/^(需补充|待补充|暂无|示例)/.test(v)) filledFields.push(label)
      return v
    }
    const suggestion = {
      title: pick('title', '标题'),
      industry: pick('industry', '行业'),
      problemType: pick('problemType', '处罚类型'),
      successSummary: pick('successSummary', '成功要点'),
      adminNotes: pick('adminNotes', '管理员备注'),
    }
    if (!filledFields.length) {
      return res.status(422).json({
        error: 'AI 未能从材料中提取有效字段，请补充案例材料后重试',
        code: 'EMPTY_SUGGESTION',
        suggestion,
      })
    }
    res.json({ success: true, suggestion, filledFields })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'AI 辅助失败' })
  }
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
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_model_test',
        usage: data.usage,
        provider: provider || 'custom',
        modelName: data.model || modelName,
      })
    }
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
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_model_test',
        usage: data.usage,
        provider: cfg.provider,
        modelName: data.model || cfg.model,
      }).catch(() => {})
    }
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
      {
        name: 'volcengine', label: '火山方舟',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        testModel: 'deepseek-v3-1-250821',
        models: [
          { model: 'deepseek-v3-1-250821', display: '火山方舟DeepSeek-V3.1', free: 0 },
        ]
      },
      {
        name: 'doubao', label: '字节豆包',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        testModel: 'doubao-lite-32k',
        models: [
          { model: 'doubao-lite-32k', display: '字节豆包-Lite-32K', free: 0 },
          { model: 'doubao-pro-32k', display: '字节豆包-Pro-32K', free: 0 },
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

app.get('/api/admin/token-usage-logs', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, requestType, provider } = req.query
    const data = await getTokenUsageLogs(parseInt(limit, 10) || 50, {
      page: parseInt(page, 10) || 1,
      requestType: requestType || undefined,
      provider: provider || undefined,
    })
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取模型调用日志失败' })
  }
})

app.get('/api/admin/token-usage/registry', requireAdmin, async (req, res) => {
  try {
    const { listUsageGuideForApi } = await import('../../ai/usageGuide.js')
    const registry = listRegistryForApi()
    const coverage = await getTokenCoverageReport()
    const guide = listUsageGuideForApi()
    res.json({ ...registry, coverage, guide })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取功能注册表失败' })
  }
})

app.get('/api/admin/token-usage/guide', requireAdmin, async (req, res) => {
  try {
    const { listUsageGuideForApi } = await import('../../ai/usageGuide.js')
    res.json(listUsageGuideForApi())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取使用指南失败' })
  }
})

app.get('/api/admin/token-usage/unified', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, dateFrom, dateTo } = req.query
    const data = await getUnifiedTokenTimeline(parseInt(limit, 10) || 50, {
      page: parseInt(page, 10) || 1,
      type: type || undefined,
      dateFrom,
      dateTo,
    })
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取统一流水失败' })
  }
})

/** AI 监管：分析 Token 消耗趋势与异常 */
app.post('/api/admin/token-usage/ai-analyze', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(String(req.body?.days || '14'), 10) || 14))
    const [stats, coverage, registry, collectionFieldGaps] = await Promise.all([
      getTokenUsageStats(),
      getTokenCoverageReport(),
      Promise.resolve(listRegistryForApi()),
      getCollectionFieldGapStats({ days: Math.min(days, 14), sampleLimit: 200 }).catch(() => null),
    ])
    const cfg = await getAIConfig()
    if (!cfg?.apiKey) return res.status(500).json({ error: 'AI 未配置，无法生成分析报告' })

    const payload = {
      days,
      billingTotals: stats.totals,
      billingToday: stats.today,
      billingByType: stats.byType,
      systemUsage: stats.systemUsage,
      logsTotals: stats.logsTotals,
      logsByType: stats.logsByType,
      coverageBillingTypes: coverage.billingTypes,
      coverageLogTypes: coverage.logTypes,
      registeredFeatureCount: registry.types.length,
      unregisteredInDb: [
        ...coverage.billingTypes.filter(r => !registry.types.find(t => t.id === r.type)),
        ...coverage.logTypes.filter(r => !registry.types.find(t => t.id === r.type)),
      ].map(r => r.type),
      collectionFieldGaps,
      collectionGapSummary: formatGapStatsForPrompt(collectionFieldGaps),
    }

    const systemPrompt = `你是平台 AI 运维与成本监管顾问。根据 JSON 统计数据，用中文 Markdown 输出监管报告，包含：
## 消耗总览（输入/输出 Token、用户付费、系统消耗、模型日志总量）
## 功能维度分析（哪些功能消耗最高、用户 vs 系统占比）
## 异常与缺口（未登记功能类型、仅出现在 logs 的类型、可能的重复记账或漏记）
## 优化建议（降本、监控告警阈值、应优先登记的新功能）
## 收集字段缺口（结合 collectionFieldGaps / collectionGapSummary，指出行业/违规/商户号等长期缺失 → 如何改 chat_collection）
## 下一步自动化（如何让系统更 AI 化地自我管理）
要求：基于数据说话，不编造数字；若某块数据为空则说明暂无记录。`

    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payload, null, 2) },
        ],
        temperature: 0.35,
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(120000),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => '')
      return res.status(500).json({ error: 'AI 分析失败', detail: t.slice(0, 200) })
    }
    const data = await aiRes.json()
    const markdown = data.choices?.[0]?.message?.content || ''
    if (data.usage) {
      await trackAIUsage({
        userId: 0,
        type: 'admin_token_analyze',
        usage: data.usage,
        provider: cfg.provider,
        modelName: cfg.model,
      })
    }
    const generatedAt = new Date().toISOString()
    const contextKey = `days:${days}`
    const trimmed = markdown.trim()
    const { saveAdminAiReport } = await import('../../services/adminAiReports.js')
    await saveAdminAiReport('token_ai_analyze', contextKey, trimmed, { days, snapshotSummary: true })
    res.json({ markdown: trimmed, generatedAt, snapshot: payload, contextKey })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'AI 分析失败' })
  }
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

app.post('/api/admin/parse-xianyu-config', requireAdmin, async (req, res) => {
  try {
    const { rawText } = req.body
    if (!rawText || !rawText.trim()) return res.status(400).json({ error: '请提供原始配置文本' })

    const cfg = await getAIConfig()
    if (!cfg || !cfg.apiKey) return res.json({ error: 'AI 模型未配置，请先在系统设置 → AI 配置中设置 API Key' })

    const prompt = `你是一个配置解析助手。请从以下闲管家应用配置原始文本中提取配置信息，返回严格的JSON格式（只返回JSON，不要包含任何其他文字或markdown标记）。

需要提取的字段：
- xianyu_app_key: AppKey（数字字母混合字符串，如 1500256339739973）
- xianyu_app_secret: AppSecret/Secret（字母数字混合字符串）
- xianyu_app_type: 应用类型（如 进销存、电商、工具等）
- xianyu_app_mode: 应用模式（如 自研系统、SaaS、第三方等）
- xianyu_app_name: 应用名称（应用的中文名称）
- xianyu_app_status: 应用状态（如 已上线、测试中、已下线）
- xianyu_created_at: 创建时间（日期时间格式）

如果没有提取到某个字段，请返回空字符串""。

原始文本：
${rawText}

请返回JSON格式示例：
{"xianyu_app_key":"1500256339739973","xianyu_app_secret":"ggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH","xianyu_app_type":"进销存","xianyu_app_mode":"自研系统","xianyu_app_name":"艾阳的店铺","xianyu_app_status":"已上线","xianyu_created_at":"2026-03-17 19:39:40"}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const body = {
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }

      const response = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || data.message?.content

      if (!content) {
        return res.json({ error: 'AI 返回内容为空，请检查文本内容或重试' })
      }

      if (data.usage) {
        await trackAIUsage({ userId: 0, type: 'admin_xianyu_parse', usage: data.usage, provider: cfg.provider, modelName: cfg.model })
      }

      const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content))

      const fields = [
        'xianyu_app_key', 'xianyu_app_secret', 'xianyu_app_type',
        'xianyu_app_mode', 'xianyu_app_name', 'xianyu_app_status', 'xianyu_created_at',
      ]
      for (const f of fields) {
        if (!parsed[f]) parsed[f] = ''
      }

      res.json({ success: true, config: parsed })
    } catch (fetchErr) {
      console.error('[Parse Xianyu Config AI Error]', fetchErr)
      if (fetchErr.name === 'AbortError') {
        res.status(504).json({ error: 'AI 解析超时，请重试' })
      } else {
        res.status(500).json({ error: 'AI 解析失败: ' + fetchErr.message })
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    console.error('[Parse Xianyu Config Error]', err)
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'AI 返回格式无法解析，请检查文本内容或重试' })
    } else {
      res.status(500).json({ error: '解析失败: ' + err.message })
    }
  }
})

app.get('/api/admin/payment-config', requireAdmin, async (req, res) => {
  try {
    const configs = await getPaymentConfigs()
    const channels = getPaymentChannels()
    res.json({ configs, channels })
  }
  catch (err) { console.error(err); res.status(500).json({ error: '获取支付配置失败' }) }
})

app.put('/api/admin/payment-config', requireAdmin, async (req, res) => {
  try {
    const configs = req.body.configs
    if (!Array.isArray(configs)) return res.status(400).json({ error: '配置数据格式错误' })
    await updatePaymentConfigs(configs)
    const channels = await reloadPaymentFromDb()
    res.json({ success: true, channels })
  } catch (err) { console.error('[Payment Config Save Error]', err); res.status(500).json({ error: '更新支付配置失败: ' + err.message }) }
})

/** 从 .env / payment.secrets.env 同步到数据库并热加载 */
app.post('/api/admin/payment-config/sync-env', requireAdmin, async (req, res) => {
  try {
    const result = await syncPaymentEnvToDb({ forceSecrets: !!req.body?.forceSecrets })
    res.json({ success: true, siteBase: getPaymentSiteBase(), ...result })
  } catch (err) {
    console.error('[Payment sync-env]', err)
    res.status(500).json({ error: err.message || '同步失败' })
  }
})

app.get('/api/admin/config', requireAdmin, async (req, res) => {
  try {
    const config = await getAllConfig()
    res.json({ success: true, data: config })
  } catch (err) { console.error('[Config Get Error]', err); res.status(500).json({ error: '获取配置失败' }) }
})

app.post('/api/admin/config', requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates 必须是数组 [{ key, value }, ...]' })
    await batchSetConfig(updates)
    const config = await getAllConfig()
    res.json({ success: true, data: config })
  } catch (err) { console.error('[Config Save Error]', err); res.status(500).json({ error: '保存配置失败: ' + err.message }) }
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
    const { updateExperiment } = await import('../../db.js')
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

app.post('/api/admin/mall/products/batch-status', requireAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body || {}
    if (!status) return res.status(400).json({ error: '请指定 status（active/archived/draft）' })
    const idList = Array.isArray(ids) ? ids : []
    if (!idList.length) return res.status(400).json({ error: '请选择至少一个商品' })
    const result = await batchUpdateProductsStatus(idList, status)
    invalidateProductCache()
    // #region agent log
    agentDebugLog('adminRoutes:batch-status', 'ok', { status, ids: idList.slice(0, 20), updated: result.updated }, 'H-batch')
    // #endregion
    res.json({ success: true, ...result, status })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '批量更新失败' })
  }
})

app.post('/api/admin/mall/products/ai-command', requireAdmin, async (req, res) => {
  try {
    const { instruction } = req.body || {}
    if (!instruction?.trim()) return res.status(400).json({ error: '请输入指令' })
    const { executeMallAiCommand } = await import('../../services/mallAiCommand.js')
    const result = await executeMallAiCommand(instruction.trim())
    // #region agent log
    agentDebugLog('adminRoutes:ai-command', 'ok', {
      instructionLen: instruction.trim().length,
      triggerAutoGenerate: !!result.triggerAutoGenerate,
      executedTypes: (result.executed || []).map((e) => e.type),
    }, 'H-chat')
    // #endregion
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'AI 指令执行失败' })
  }
})

app.delete('/api/admin/mall/products/:id', requireAdmin, async (req, res) => {
  try {
    await deleteProduct(parseInt(req.params.id))
    invalidateProductCache()
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: '删除商品失败' }) }
})

// --- 后台: 异步任务进度 ---
app.get('/api/admin/jobs/active/mall', requireAdmin, async (req, res) => {
  try {
    const { getActiveMallJob, recoverStaleAdminJobs, MALL_JOB_TITLES } = await import('../../services/adminJobs.js')
    await recoverStaleAdminJobs()
    const job = await getActiveMallJob()
    // #region agent log
    agentDebugLog('adminRoutes:active-mall', 'query', {
      hasJob: !!job,
      jobId: job?.id?.slice(0, 8),
      status: job?.status,
      phase: job?.phase,
      logLen: job?.log?.length ?? 0,
    }, 'H2')
    // #endregion
    res.json({
      job,
      title: job ? (MALL_JOB_TITLES[job.type] || job.type) : null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '获取任务失败' })
  }
})

app.post('/api/admin/jobs/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const { cancelAdminJob, getAdminJob } = await import('../../services/adminJobs.js')
    const job = await getAdminJob(req.params.id)
    if (!job) return res.status(404).json({ error: '任务不存在' })
    if (job.status !== 'running') return res.json({ success: true, job })
    const ok = await cancelAdminJob(req.params.id, req.body?.reason || '用户手动取消')
    if (!ok) return res.status(400).json({ error: '无法取消该任务' })
    const updated = await getAdminJob(req.params.id)
    res.json({ success: true, job: updated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '取消失败' })
  }
})

app.get('/api/admin/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const { getAdminJob, recoverStaleAdminJobs } = await import('../../services/adminJobs.js')
    await recoverStaleAdminJobs()
    const job = await getAdminJob(req.params.id)
    if (!job) return res.status(404).json({ error: '任务不存在' })
    res.json(job)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || '获取任务失败' })
  }
})

async function blockIfMallJobRunning(res) {
  const { getActiveMallJob, MALL_JOB_TITLES } = await import('../../services/adminJobs.js')
  const active = await getActiveMallJob()
  if (!active) return null
  const title = MALL_JOB_TITLES[active.type] || active.type
  // #region agent log
  agentDebugLog('adminRoutes:block-mall', '409', {
    jobId: active.id,
    type: active.type,
    phase: active.phase,
    message: active.message?.slice(0, 80),
  }, 'H409')
  // #endregion
  return res.status(409).json({
    error: `已有任务进行中（${title}）`,
    jobId: active.id,
    job: active,
    title,
  })
}

// --- 后台: AI商品优化 ---
app.post('/api/admin/mall/products/:id/optimize', requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10)
    if (req.query.sync === '1') {
      const result = await aiOptimizeProduct(productId)
      if (!result) return res.status(500).json({ error: 'AI优化失败' })
      return res.json({ success: true, optimization: result })
    }
    const blocked = await blockIfMallJobRunning(res)
    if (blocked) return blocked
    const { createAdminJob, updateAdminJobProgress } = await import('../../services/adminJobs.js')
    const jobId = await createAdminJob('mall_optimize_one', { productId })
    res.json({ jobId })
    setImmediate(async () => {
      try {
        await updateAdminJobProgress(jobId, { phase: 'optimizing', message: '正在 AI 优化商品…', current: 0, total: 1 })
        const result = await aiOptimizeProduct(productId)
        if (!result) throw new Error('AI优化失败')
        await updateAdminJobProgress(jobId, {
          status: 'done',
          phase: 'done',
          message: '优化完成',
          current: 1,
          total: 1,
          result: { success: true, optimization: result },
        })
      } catch (e) {
        await updateAdminJobProgress(jobId, { status: 'failed', phase: 'failed', error: e.message })
      }
    })
  } catch (err) { console.error(err); res.status(500).json({ error: '优化失败: ' + err.message }) }
})

app.post('/api/admin/mall/products/batch-optimize', requireAdmin, async (req, res) => {
  try {
    if (req.query.sync === '1') {
      const result = await batchOptimizeProducts()
      return res.json({ success: true, ...result })
    }
    const blocked = await blockIfMallJobRunning(res)
    if (blocked) return blocked
    const { createAdminJob, updateAdminJobProgress } = await import('../../services/adminJobs.js')
    const jobId = await createAdminJob('mall_batch_optimize', {})
    res.json({ jobId })
    setImmediate(async () => {
      try {
        const result = await batchOptimizeProducts((p) => updateAdminJobProgress(jobId, {
          phase: p.phase,
          message: p.message,
          current: p.current,
          total: p.total,
        }))
        await updateAdminJobProgress(jobId, {
          status: 'done',
          phase: 'done',
          message: `批量优化完成，成功 ${result.optimized} 个`,
          current: result.processed ?? result.optimized,
          total: result.processed ?? result.total,
          result: { success: true, ...result },
        })
      } catch (e) {
        await updateAdminJobProgress(jobId, { status: 'failed', phase: 'failed', error: e.message })
      }
    })
  } catch (err) { console.error(err); res.status(500).json({ error: '批量优化失败: ' + err.message }) }
})

// --- 后台: 推荐统计 ---
app.get('/api/admin/mall/recommendations/stats', requireAdmin, async (req, res) => {
  try { res.json(await getRecommendationStats()) }
  catch (err) { console.error(err); res.status(500).json({ error: '获取推荐统计失败' }) }
})

app.get('/api/admin/mall/recommendations', requireAdmin, async (req, res) => {
  try {
    const { page, pageSize, status } = req.query
    res.json(await listAdminRecommendations({ page, pageSize, status }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '获取推荐列表失败' })
  }
})

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
      ], temperature: 0.3, top_p: 0.7, max_tokens: 1500 }),
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

    if (data.usage) {
      await trackAIUsage({ userId: 0, type: 'admin_ai_assist', usage: data.usage, provider: cfg.provider, modelName: cfg.model })
    }
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
    if (req.query.sync === '1') {
      const analyses = await getConversationAnalyses(20)
      const result = await aiAutoCreateProducts(analyses)
      return res.json({ success: true, ...result })
    }
    const blocked = await blockIfMallJobRunning(res)
    if (blocked) return blocked
    const { createAdminJob, updateAdminJobProgress } = await import('../../services/adminJobs.js')
    const jobId = await createAdminJob('mall_ai_generate', {})
    // #region agent log
    agentDebugLog('adminRoutes:ai-generate', 'started', { jobId }, 'H1')
    // #endregion
    res.json({ jobId })
    setImmediate(async () => {
      try {
        await updateAdminJobProgress(jobId, { phase: 'loading', message: '正在加载对话分析数据…', current: 0, total: 0 })
        const analyses = await getConversationAnalyses(20)
        await updateAdminJobProgress(jobId, {
          phase: 'loading',
          message: `已加载 ${analyses.length} 条对话分析，开始 AI 处理…`,
          current: 0,
          total: 0,
        })
        const result = await aiAutoCreateProducts(analyses, (p) => updateAdminJobProgress(jobId, {
          phase: p.phase,
          message: p.message,
          current: p.current,
          total: p.total,
        }))
        await updateAdminJobProgress(jobId, {
          status: 'done',
          phase: 'done',
          message: result.created > 0 ? `已创建 ${result.created} 个商品草稿` : '暂无新商品建议',
          current: result.created,
          total: result.suggestions?.length || result.created,
          result: { success: true, ...result },
        })
      } catch (e) {
        await updateAdminJobProgress(jobId, { status: 'failed', phase: 'failed', error: e.message })
      }
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'AI生成商品失败: ' + err.message }) }
})

app.post('/api/admin/mall/products/ai-suggest', requireAdmin, async (req, res) => {
  try {
    const analyses = await getConversationAnalyses(20)
    const suggestions = await aiSuggestNewProducts(analyses)
    res.json({ suggestions: suggestions || [] })
  } catch (err) { console.error(err); res.status(500).json({ error: 'AI建议失败: ' + err.message }) }
})


// --- 管理员: 获取所有订单 ---
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const filters = {}
    if (req.query.status) filters.status = req.query.status
    if (req.query.user_id) filters.user_id = req.query.user_id
    const orders = await getOrders(filters)
    res.json({ orders })
  } catch (err) {
    console.error('获取订单列表失败:', err)
    res.status(500).json({ error: '获取订单列表失败' })
  }
})

// --- 管理员: 获取单个订单详情 ---
app.get('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id)
    if (!order) return res.status(404).json({ error: '订单不存在' })
    res.json({ order })
  } catch (err) {
    console.error('获取订单详情失败:', err)
    res.status(500).json({ error: '获取订单详情失败' })
  }
})

// --- 管理员: 更新订单状态 ---
app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['pending', 'paid', 'serving', 'completed', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `无效的状态值，可接受的值：${validStatuses.join(', ')}` })
    }
    const order = await getOrderById(req.params.id)
    if (!order) return res.status(404).json({ error: '订单不存在' })
    await updateOrderStatus(req.params.id, status)
    const updated = await getOrderById(req.params.id)
    res.json({ success: true, order: updated })
  } catch (err) {
    console.error('更新订单状态失败:', err)
    res.status(500).json({ error: '更新订单状态失败' })
  }
})

// --- 管理端: 资金审计日志 ---
app.get('/api/admin/audit/log', requireAdmin, async (req, res) => {
  try {
    const { userId, type, page = 1, pageSize = 50 } = req.query
    let sql = 'SELECT * FROM financial_audit WHERE 1=1'
    const params = []
    if (userId) { sql += ' AND user_id = ?'; params.push(userId) }
    if (type) { sql += ' AND type = ?'; params.push(type) }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    const [rows] = await getPool().query(sql, params)
    const [countResult] = await getPool().query(
      'SELECT COUNT(*) as total FROM financial_audit WHERE 1=1' +
      (userId ? ' AND user_id = ?' : '') + (type ? ' AND type = ?' : ''),
      params.slice(0, (userId ? 1 : 0) + (type ? 1 : 0))
    )
    res.json({ data: rows, total: countResult[0].total })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
}
