import { Router } from 'express'
import {
  registerUser, getUserByPhone, getUserById, updateUserApiMode,
  deductBalance, getUserSessions, trackUserAction,
  updateUserActivity, incrementLoginCount, incrementUserMessages,
  incrementUserSpent, getUserTokenUsage, getUserTokenStats,
  createRechargeOrder, getUserRechargeOrders,
} from '../db.js'
import jwt from 'jsonwebtoken'
import { requireUser } from '../middleware/auth.js'
import logger from '../utils/logger.js'

const router = Router()

const authLimiter = (await import('express-rate-limit')).default({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: '请求过于频繁，请稍后再试' })
})

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h'

if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is required. Server cannot start securely.')
  process.exit(1)
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { phone, nickname } = req.body
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    
    const existingUser = await getUserByPhone(phone)
    if (existingUser) {
      return res.status(400).json({ error: '该手机号已注册' })
    }
    
    const user = await registerUser({ phone, nickname })
    const token = signToken({ userId: user.id })
    
    await trackUserAction(user.id, 'register', { phone })
    
    res.json({ success: true, token, user })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: '注册失败' })
  }
})

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    
    const user = await getUserByPhone(phone)
    if (!user) {
      return res.status(404).json({ error: '用户不存在，请先注册' })
    }
    
    const token = signToken({ userId: user.id })
    await incrementLoginCount(user.id)
    await trackUserAction(user.id, 'login', { phone })
    
    res.json({ success: true, token, user })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: '登录失败' })
  }
})

router.get('/:id/sessions', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    
    if (id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to access sessions of user ${id}`)
      return res.status(403).json({ error: '无权访问其他用户的会话' })
    }
    
    const sessions = await getUserSessions(id)
    res.json({ success: true, sessions })
  } catch (error) {
    logger.error('Get user sessions error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    
    if (id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to access profile of user ${id}`)
      return res.status(403).json({ error: '无权访问其他用户信息' })
    }
    
    const user = await getUserById(id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    res.json({ success: true, user })
  } catch (error) {
    logger.error('Get user error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/api-mode', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    const { apiMode } = req.body
    
    if (id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to modify api-mode of user ${id}`)
      return res.status(403).json({ error: '无权修改其他用户设置' })
    }
    
    await updateUserApiMode(id, apiMode)
    res.json({ success: true })
  } catch (error) {
    logger.error('Update API mode error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/usage', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    
    if (id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to access usage of user ${id}`)
      return res.status(403).json({ error: '无权访问其他用户使用量' })
    }
    
    const usage = await getUserTokenStats(id)
    res.json({ success: true, usage })
  } catch (error) {
    logger.error('Get user usage error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router
