import { calculateCost } from './tokenizer.js'

const CHARGE_LABELS = {
  chat_collection: '对话回复',
  chat: '对话回复',
  report_retry: '报告生成',
  ai_extraction: '信息提取',
  industry_expansion: '行业字段扩展',
  completeness_check: '完成度评估',
  deep_analysis: '深度分析',
}

/**
 * 单轮用户消息合并计费：分项记账，结束时一次扣余额
 */
export function createTurnBilling({ multiplier = 2 } = {}) {
  const items = []

  return {
    addCharge({ type, label, inputTokens = 0, outputTokens = 0, cost }) {
      const tokenInfo = cost != null
        ? { cost, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
        : calculateCost(inputTokens, outputTokens, multiplier)
      if (tokenInfo.cost <= 0 && !inputTokens && !outputTokens) return
      items.push({
        type: type || 'chat',
        label: label || CHARGE_LABELS[type] || type || 'AI调用',
        cost: tokenInfo.cost,
        inputTokens: tokenInfo.inputTokens,
        outputTokens: tokenInfo.outputTokens,
        totalTokens: tokenInfo.totalTokens,
        multiplier,
      })
    },

    getTotal() {
      return items.reduce((sum, i) => sum + (i.cost || 0), 0)
    },

    getBreakdown() {
      return items.map(({ type, label, cost, inputTokens, outputTokens, totalTokens }) => ({
        type, label, cost, inputTokens, outputTokens, totalTokens,
      }))
    },

    isEmpty() {
      return items.length === 0
    },

    /**
     * 官方模式：一次扣费 + 返回 SSE usage 载荷
     */
    async finalizeOfficial({ userId, deductBalance, incrementUserSpent, getUserById }) {
      const total = this.getTotal()
      if (total <= 0) {
        return { cost: 0, breakdown: this.getBreakdown(), balance: (await getUserById(userId))?.balance }
      }
      const deductResult = await deductBalance(userId, total)
      if (deductResult.success) await incrementUserSpent(userId, total)
      const balance = (await getUserById(userId))?.balance
      return {
        cost: total,
        breakdown: this.getBreakdown(),
        balance,
        inputTokens: items.reduce((s, i) => s + i.inputTokens, 0),
        outputTokens: items.reduce((s, i) => s + i.outputTokens, 0),
        totalTokens: items.reduce((s, i) => s + i.totalTokens, 0),
        multiplier,
      }
    },
  }
}

export function tokensFromUsage(usage) {
  if (!usage) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  const inputTokens = usage.prompt_tokens || usage.input_tokens || 0
  const outputTokens = usage.completion_tokens || usage.output_tokens || 0
  const totalTokens = usage.total_tokens || inputTokens + outputTokens
  return { inputTokens, outputTokens, totalTokens }
}

/** 平台承担：记入 token_usage（user_id=0），不扣用户余额 */
export async function recordSystemTokenUsage(recordTokenUsage, {
  sessionId = null,
  type,
  inputTokens = 0,
  outputTokens = 0,
  usage = null,
  apiMode = 'system',
  detailSummary = null,
  contextJson = null,
}) {
  if (!recordTokenUsage) return null
  const fromUsage = usage ? tokensFromUsage(usage) : { inputTokens, outputTokens }
  const inTok = fromUsage.inputTokens || inputTokens || 0
  const outTok = fromUsage.outputTokens || outputTokens || 0
  if (!inTok && !outTok) return null
  try {
    await recordTokenUsage({
      userId: 0,
      sessionId,
      type: type || 'chat',
      inputTokens: inTok,
      outputTokens: outTok,
      totalTokens: inTok + outTok,
      cost: 0,
      multiplier: 1,
      apiMode,
      detailSummary,
      contextJson,
    })
  } catch { /* non-fatal */ }
  return { inputTokens: inTok, outputTokens: outTok }
}

/** 用户官方模式：扣余额并记入 token_usage */
export async function billUserTokenUsage({
  recordTokenUsage,
  deductBalance,
  incrementUserSpent,
  getSystemConfig,
  userId,
  sessionId,
  type,
  inputTokens = 0,
  outputTokens = 0,
  usage = null,
  isOfficialMode = false,
  apiMode = 'official',
  detailSummary = null,
  contextJson = null,
}) {
  if (!recordTokenUsage || userId == null) return { cost: 0, inputTokens: 0, outputTokens: 0 }
  const fromUsage = usage ? tokensFromUsage(usage) : { inputTokens, outputTokens }
  const inTok = fromUsage.inputTokens || inputTokens || 0
  const outTok = fromUsage.outputTokens || outputTokens || 0
  if (!inTok && !outTok) return { cost: 0, inputTokens: 0, outputTokens: 0 }
  const multiplierStr = getSystemConfig ? await getSystemConfig('cost_multiplier') : '2'
  const multiplier = parseFloat(multiplierStr || '2')
  const tokenInfo = calculateCost(inTok, outTok, multiplier)
  if (isOfficialMode) {
    const deductResult = await deductBalance(userId, tokenInfo.cost)
    if (deductResult.success && incrementUserSpent) await incrementUserSpent(userId, tokenInfo.cost)
  }
  try {
    await recordTokenUsage({
      userId,
      sessionId,
      type: type || 'chat',
      inputTokens: inTok,
      outputTokens: outTok,
      totalTokens: inTok + outTok,
      cost: isOfficialMode ? tokenInfo.cost : 0,
      multiplier,
      apiMode: isOfficialMode ? apiMode : 'custom',
      detailSummary,
      contextJson,
    })
  } catch { /* non-fatal */ }
  return { ...tokenInfo, inputTokens: inTok, outputTokens: outTok, multiplier }
}

export async function recordUsageLine(recordTokenUsage, {
  userId, sessionId, type, inputTokens, outputTokens, cost, multiplier, apiMode = 'official',
}) {
  if (!recordTokenUsage || userId == null) return
  try {
    await recordTokenUsage({
      userId,
      sessionId,
      type: type || 'chat',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      cost: cost || 0,
      multiplier,
      apiMode,
    })
  } catch { /* non-fatal */ }
}

export async function addOfficialUsage(turnBilling, {
  isOfficialMode,
  multiplier,
  type,
  label,
  inputTokens,
  outputTokens,
  userId,
  sessionId,
  recordTokenUsage,
  apiMode = 'official',
}) {
  const inTok = inputTokens || 0
  const outTok = outputTokens || 0
  if (!inTok && !outTok) return null
  const tokenInfo = calculateCost(inTok, outTok, multiplier)
  if (isOfficialMode && turnBilling) {
    turnBilling.addCharge({
      type,
      label,
      inputTokens: inTok,
      outputTokens: outTok,
      cost: tokenInfo.cost,
    })
  }
  await recordUsageLine(recordTokenUsage, {
    userId,
    sessionId,
    type,
    inputTokens: inTok,
    outputTokens: outTok,
    cost: tokenInfo.cost,
    multiplier,
    apiMode,
  })
  return tokenInfo
}
