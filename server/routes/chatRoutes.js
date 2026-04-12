import { Router } from 'express'
import { 
  createSession, getSession, updateSession, 
  getMessages, getAllSessions, deleteSession,
  trackUserAction, updateUserActivity, incrementUserMessages, incrementUserSpent,
  saveAppealText, getAppealText, updateAppealStatus,
  saveComplaintDoc, getComplaintDoc,
  recordTokenUsage, getUserTokenUsage,
  checkDeepAnalysisQuota, incrementDeepAnalysisCount,
  saveDeepAnalysisResult, getDeepAnalysisResult,
  logFieldChange, getFieldChangeLog,
} from '../db.js'
import { chatWithAI, streamChatWithAI, extractFieldsWithAI, expandFieldsForIndustry, assessCompletenessWithAI, buildCollectionInstruction, getAIConfig } from '../ai.js'
import { buildReportPrompt, TOTAL_STEPS, INFO_FIELDS, LOCAL_WELCOME, normalizeFieldValue, buildCollectionContext, findNextUnfilledStep } from '../localAI.js'
import { calculateCost } from '../tokenizer.js'
import { analyzeConversation, schedulePostConversationAnalysis, autoTagConversation } from '../evolution.js'
import { loadProductCatalogForPrompt, parseProductRecommendations, updateUserInterestFromConversation } from '../mall.js'

const router = Router()

const chatLimiter = (await import('express-rate-limit')).default({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: '请求过于频繁，请稍后再试' })
})

router.post('/chat', chatLimiter, async (req, res) => {
  try {
    const { sessionId, message, userId, skipDeduct } = req.body
    if (!sessionId || !message) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    await addMessage(sessionId, 'user', message)
    await incrementUserMessages(userId)

    const messages = await getMessages(sessionId)
    const recentMessages = messages.slice(-20)

    const aiConfig = await getAIConfig()
    const reply = await chatWithAI(recentMessages, aiConfig)

    await addMessage(sessionId, 'assistant', reply)

    if (userId && !skipDeduct) {
      const inputTokens = messages.reduce((sum, m) => sum + calculateCost(m.content), 0)
      const outputTokens = calculateCost(reply)
      const cost = (inputTokens + outputTokens) * 0.0001
      await deductBalance(userId, cost)
      await recordTokenUsage(userId, sessionId, inputTokens, outputTokens, cost)
      await incrementUserSpent(userId, cost)
    }

    res.json({ success: true, reply })

  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/chat/stream', chatLimiter, async (req, res) => {
  try {
    const { sessionId, message, userId, skipDeduct } = req.body
    if (!sessionId || !message) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const session = await getSession(sessionId)
    if (!session) {
      res.write(`data: ${JSON.stringify({ error: '会话不存在' })}\n\n`)
      return res.end()
    }

    await addMessage(sessionId, 'user', message)
    await incrementUserMessages(userId)

    const messages = await getMessages(sessionId)
    const recentMessages = messages.slice(-20)

    const aiConfig = await getAIConfig()
    let fullReply = ''

    for await (const chunk of streamChatWithAI(recentMessages, aiConfig)) {
      fullReply += chunk
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }

    await addMessage(sessionId, 'assistant', fullReply)

    if (userId && !skipDeduct) {
      const inputTokens = messages.reduce((sum, m) => sum + calculateCost(m.content), 0)
      const outputTokens = calculateCost(fullReply)
      const cost = (inputTokens + outputTokens) * 0.0001
      await deductBalance(userId, cost)
      await recordTokenUsage(userId, sessionId, inputTokens, outputTokens, cost)
      await incrementUserSpent(userId, cost)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()

  } catch (error) {
    console.error('Stream chat error:', error)
    res.write(`data: ${JSON.stringify({ error: '服务器错误' })}\n\n`)
    res.end()
  }
})

export default router
