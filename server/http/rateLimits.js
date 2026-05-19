/**
 * HTTP 限流 — 与生产入口解耦，便于单测与调参
 */
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'

/**
 * @param {string} jwtSecret 与 index 启动校验后的 JWT_SECRET 一致
 */
export function createGlobalApiRateLimiter(jwtSecret) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '请求过于频繁，请稍后再试' },
    validate: { xForwardedForHeader: false },
    skip: (req) => {
      if (req.path.startsWith('/api/admin/') && req.path !== '/api/admin/login') {
        return true
      }
      try {
        const auth = req.headers.authorization
        if (auth && auth.startsWith('Bearer ')) {
          const decoded = jwt.verify(auth.slice(7), jwtSecret)
          return decoded.role === 'admin'
        }
      } catch { /* ignore */ }
      return false
    },
  })
}

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX || '20', 10),
  message: { error: '发送消息过快，请稍后再试' },
  validate: { xForwardedForHeader: false },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
})

/** AI 风险评估（用户级） */
export const riskAssessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '风险评估请求过于频繁，请稍后再试' },
  validate: { xForwardedForHeader: false },
})
