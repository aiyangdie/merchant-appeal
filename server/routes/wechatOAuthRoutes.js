import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getOAuthPublicConfig,
  buildOAuthAuthorizeUrl,
  exchangeOAuthCode,
  parseOAuthState,
  safeReturnPath,
} from '../services/wechatOAuthService.js'

const router = Router()

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
})

router.get('/config', (_req, res) => {
  res.json(getOAuthPublicConfig())
})

router.get('/url', oauthLimiter, (req, res) => {
  try {
    const returnPath = safeReturnPath(req.query.returnPath)
    const url = buildOAuthAuthorizeUrl(returnPath)
    res.json({ url })
  } catch (err) {
    res.status(400).json({ error: err.message || '无法生成授权链接' })
  }
})

router.post('/exchange', oauthLimiter, async (req, res) => {
  try {
    const { code, state, returnPath } = req.body || {}
    const parsed = parseOAuthState(state)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    const result = await exchangeOAuthCode(code, {
      ip,
      userAgent: req.headers['user-agent'] || '',
    })
    res.json({
      ...result,
      returnPath: safeReturnPath(returnPath || parsed.returnPath),
    })
  } catch (err) {
    console.error('[wechat-oauth] exchange error:', err.message)
    res.status(400).json({ error: err.message || '微信登录失败' })
  }
})

export default router
