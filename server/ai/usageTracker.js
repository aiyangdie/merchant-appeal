/**
 * 统一 AI Token 追踪 — 所有 AI 调用应通过 trackAIUsage 记账，保证明细页全覆盖。
 */
import { tokensFromUsage, recordSystemTokenUsage, billUserTokenUsage } from '../billing.js'
import { getUsageTypeMeta } from './usageRegistry.js'
import { buildDetailSummary } from './usageGuide.js'

let _deps = null

export function initUsageTracker(deps) {
  _deps = deps
}

export function isUsageTrackerReady() {
  return !!_deps?.recordTokenUsage
}

function requireDeps() {
  if (!_deps?.recordTokenUsage) throw new Error('usageTracker not initialized')
  return _deps
}

/** 写入 token_usage_logs（模型维度） */
export async function logModelUsage({
  provider = 'unknown',
  modelName = '',
  usage,
  requestType = 'chat',
  modelId = 0,
  userId = 0,
  sessionId = null,
  detailSummary = null,
  contextJson = null,
}) {
  const pool = _deps?.getPool?.()
  if (!pool || !usage) return
  const { inputTokens, outputTokens, totalTokens } = tokensFromUsage(usage)
  if (!inputTokens && !outputTokens) return
  const isVc = provider === 'volcengine' || provider === 'ark'
  const inputPrice = isVc ? 2 : (provider === 'deepseek' ? 1 : 5)
  const outputPrice = isVc ? 8 : (provider === 'deepseek' ? 2 : 15)
  const costYuan = (inputTokens * inputPrice + outputTokens * outputPrice) / 1000000
  try {
    const ctxStr = contextJson != null ? JSON.stringify(contextJson) : null
    await pool.execute(
      `INSERT INTO token_usage_logs (model_id, provider, model_name, prompt_tokens, completion_tokens, total_tokens, request_type, cost_yuan, user_id, session_id, detail_summary, context_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        modelId,
        provider,
        modelName || '',
        inputTokens,
        outputTokens,
        totalTokens,
        requestType || 'chat',
        costYuan,
        userId || 0,
        sessionId || null,
        detailSummary ? String(detailSummary).slice(0, 512) : null,
        ctxStr,
      ]
    )
  } catch (e) {
    console.error('[usageTracker] logModelUsage:', e.message)
  }
}

/**
 * 统一记账：token_usage + token_usage_logs
 * @param {object} opts
 * @param {number|null} opts.userId - 0 或 null 表示系统
 * @param {string} opts.type - 功能类型（须在 usageRegistry 登记）
 * @param {object} opts.usage - OpenAI usage 对象
 * @param {string} [opts.sessionId]
 * @param {boolean} [opts.isOfficialMode] - 用户扣费时
 * @param {string} [opts.apiMode]
 * @param {string} [opts.provider]
 * @param {string} [opts.modelName]
 * @param {number} [opts.modelId]
 */
export async function trackAIUsage({
  userId = 0,
  sessionId = null,
  type,
  usage,
  isOfficialMode = false,
  apiMode,
  provider,
  modelName,
  modelId = 0,
  skipModelLog = false,
  detailSummary = null,
  context = null,
}) {
  if (!usage) return null
  const deps = requireDeps()
  const meta = getUsageTypeMeta(type)
  if (meta.unregistered) {
    console.warn(`[usageTracker] 未登记的功能类型 "${type}"，请在 server/ai/usageRegistry.js 添加`)
  }

  const effectiveUserId = userId == null ? 0 : userId
  const scopeSystem = effectiveUserId === 0 || meta.scope === 'system'
  const summary =
    detailSummary ||
    buildDetailSummary(type, context?.action || context?.instructionPreview || '')
  const contextJson = {
    type,
    provider: provider || null,
    modelName: modelName || null,
    userId: effectiveUserId,
    sessionId: sessionId || null,
    apiMode: apiMode || null,
    ...((context && typeof context === 'object') ? context : {}),
  }

  if (!skipModelLog) {
    await logModelUsage({
      provider: provider || 'system',
      modelName,
      usage,
      requestType: type || 'chat',
      modelId,
      userId: effectiveUserId,
      sessionId,
      detailSummary: summary,
      contextJson,
    })
  }

  const billingOpts = {
    sessionId,
    type,
    usage,
    detailSummary: summary,
    contextJson,
  }

  if (scopeSystem && !isOfficialMode) {
    return recordSystemTokenUsage(deps.recordTokenUsage, {
      ...billingOpts,
      apiMode: apiMode || 'system',
    })
  }

  if (effectiveUserId > 0) {
    return billUserTokenUsage({
      recordTokenUsage: deps.recordTokenUsage,
      deductBalance: deps.deductBalance,
      incrementUserSpent: deps.incrementUserSpent,
      getSystemConfig: deps.getSystemConfig,
      userId: effectiveUserId,
      sessionId,
      type,
      usage,
      isOfficialMode,
      apiMode: apiMode || (isOfficialMode ? 'official' : 'custom'),
      detailSummary: summary,
      contextJson,
    })
  }

  return recordSystemTokenUsage(deps.recordTokenUsage, {
    ...billingOpts,
    apiMode: apiMode || 'system',
  })
}

/** 从 Express req 记账（兼容原 recordAIUsageForRequest） */
export async function trackAIUsageFromRequest(req, {
  type,
  usage,
  sessionId = null,
  asSystem = false,
  provider,
  modelName,
}) {
  if (!usage) return null
  const deps = requireDeps()
  if (asSystem || !req?.userId) {
    return trackAIUsage({
      userId: 0,
      sessionId,
      type,
      usage,
      provider,
      modelName,
    })
  }
  const user = await deps.getUserById(req.userId)
  const activeModel = await deps.getActiveAIModel?.()
  const isModelFree = activeModel?.is_free === 1
  const isOfficialMode = user?.api_mode === 'official' && !isModelFree
  return trackAIUsage({
    userId: req.userId,
    sessionId,
    type,
    usage,
    isOfficialMode,
    provider: provider || activeModel?.provider,
    modelName: modelName || activeModel?.model_name,
    modelId: activeModel?.id || 0,
  })
}
