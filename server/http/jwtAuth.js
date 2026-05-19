/**
 * JWT 签发与用户/管理员鉴权中间件
 * 供 server/index.js 生产入口使用（单一事实来源）
 */
import jwt from 'jsonwebtoken'

/**
 * @param {string} jwtSecret 必填，由入口在启动前校验
 * @param {string} [jwtExpiresIn] 如 '24h'
 */
export function createJwtAuth(jwtSecret, jwtExpiresIn = '24h') {
  function signToken(payload) {
    return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn })
  }

  function verifyAdminToken(token) {
    if (!token) return null
    try {
      const decoded = jwt.verify(token, jwtSecret)
      if (decoded.role !== 'admin') return null
      return decoded
    } catch {
      return null
    }
  }

  function requireAdmin(req, res, next) {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录或登录已过期' })
    }
    const decoded = verifyAdminToken(auth.slice(7))
    if (!decoded) return res.status(401).json({ error: '登录已过期，请重新登录' })
    req.admin = decoded
    next()
  }

  /** img 等无法带 Authorization 时，允许 query.token 与 Bearer 等价（仅用于受控资源如图片代理） */
  function requireAdminOrQueryToken(req, res, next) {
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    const decoded = verifyAdminToken(headerToken || queryToken)
    if (!decoded) return res.status(401).json({ error: '未登录或登录已过期' })
    req.admin = decoded
    next()
  }

  function requireUser(req, res, next) {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: '请先登录' })
    }
    try {
      const decoded = jwt.verify(auth.slice(7), jwtSecret)
      if (!decoded.userId) return res.status(401).json({ error: '无效的用户凭证' })
      req.userId = decoded.userId
      next()
    } catch {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }
  }

  function optionalUser(req, res, next) {
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(auth.slice(7), jwtSecret)
        if (decoded.userId) req.userId = decoded.userId
      } catch { /* token 无效则忽略 */ }
    }
    next()
  }

  return {
    signToken,
    verifyAdminToken,
    requireAdmin,
    requireAdminOrQueryToken,
    requireUser,
    optionalUser,
  }
}
