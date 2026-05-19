import {
  createSession, getSession, addMessage, getMessages, getUserById, getActiveAIModel,
  incrementUserMessages, patchSessionCollectedData,
} from '../../db.js'
import { chatWithAI, getAIConfig } from '../../ai.js'
import { createTurnBilling } from '../../billing.js'
import { schedulePostConversationAnalysis } from '../../evolution.js'
/**
 * chatRoutes
 */
export function registerChatRoutes(app, ctx) {
  const { signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken, authLimiter, chatLimiter, ensureUserCanUseOfficialAI, recordAIUsageForRequest, logFinancialActivity, unwrapMallUsagePayload, unwrapPersonaPayload } = ctx

app.post('/api/chat', chatLimiter, requireUser, async (req, res) => {
  try {
    let { sessionId, content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' })
    }

    const userId = req.userId
    const user = await getUserById(userId)
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
      } else if (!existing.user_id || String(existing.user_id) !== String(user.id)) {
        return res.status(403).json({ error: '无权访问此会话' })
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
}
