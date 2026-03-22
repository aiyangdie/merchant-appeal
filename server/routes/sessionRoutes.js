import { Router } from 'express'
import {
  getSession, updateSession, getMessages,
  saveAppealText, getAppealText, updateAppealStatus,
  saveComplaintDoc, getComplaintDoc,
  logFieldChange, getFieldChangeLog,
  checkDeepAnalysisQuota, incrementDeepAnalysisCount,
  saveDeepAnalysisResult, getDeepAnalysisResult,
} from '../db.js'
import { requireUser } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = Router()

async function validateSessionOwnership(req, res, next) {
  try {
    const { id } = req.params
    const session = await getSession(id)
    
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    
    if (session.user_id && session.user_id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to access session ${id} owned by ${session.user_id}`)
      return res.status(403).json({ error: '无权访问此会话' })
    }
    
    req.session = session
    next()
  } catch (error) {
    logger.error('Session ownership validation error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

router.get('/:id/info', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    res.json({ success: true, session: req.session })
  } catch (error) {
    logger.error('Get session error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/field', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const { field, value } = req.body
    
    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: '字段名无效' })
    }

    const oldValue = req.session.collected_data?.[field]
    await updateSession(id, { 
      collected_data: { ...req.session.collected_data, [field]: value }
    })
    
    await logFieldChange(id, field, oldValue, value, req.userId)
    
    res.json({ success: true })
  } catch (error) {
    logger.error('Update field error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/messages', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const messages = await getMessages(id)
    res.json({ success: true, messages })
  } catch (error) {
    logger.error('Get messages error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/field-history', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const history = await getFieldChangeLog(id)
    res.json({ success: true, history })
  } catch (error) {
    logger.error('Get field history error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/:id/generate-appeal-text', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    
    const appealText = await generateAppealText(req.session)
    await saveAppealText(id, req.userId, appealText)
    
    res.json({ success: true, appealText })
  } catch (error) {
    logger.error('Generate appeal text error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/appeal-text', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const appealText = await getAppealText(id)
    res.json({ success: true, appealText })
  } catch (error) {
    logger.error('Get appeal text error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/deep-analysis', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    
    const hasQuota = await checkDeepAnalysisQuota(req.userId)
    if (!hasQuota) {
      return res.status(403).json({ error: '深度分析次数已用完' })
    }

    const messages = await getMessages(id)
    
    const analysis = await performDeepAnalysis(req.session, messages)
    await saveDeepAnalysisResult(id, analysis)
    await incrementDeepAnalysisCount(req.userId)
    
    res.json({ success: true, analysis })
  } catch (error) {
    logger.error('Deep analysis error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/deep-analysis-result', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const result = await getDeepAnalysisResult(id)
    res.json({ success: true, result })
  } catch (error) {
    logger.error('Get deep analysis result error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router

async function generateAppealText(session) {
  return {
    business_model: '示例经营模式',
    refund_rules: '示例退款规则',
    complaint_cause: '示例投诉原因',
    complaint_resolution: '示例解决方案',
    supplementary: '示例补充说明'
  }
}

async function performDeepAnalysis(session, messages) {
  return {
    risk_level: 'medium',
    success_rate: 0.7,
    suggestions: ['建议1', '建议2']
  }
}
