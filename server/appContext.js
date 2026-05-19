/**
 * 生产入口共享上下文 — JWT、限流、计费辅助
 */
import { getUserById, getActiveAIModel } from './db.js'
import { trackAIUsageFromRequest } from './ai/usageTracker.js'
import { createJwtAuth } from './http/jwtAuth.js'
import {
  createGlobalApiRateLimiter,
  chatLimiter,
  authLimiter,
  riskAssessLimiter,
} from './http/rateLimits.js'
import { logFinancialActivity } from './services/financialAudit.js'
import { unwrapMallUsagePayload, unwrapPersonaPayload } from './lib/mallPayload.js'

export function createAppContext({ jwtSecret, jwtExpires, distPath }) {
  const auth = createJwtAuth(jwtSecret, jwtExpires)
  const globalRateLimiter = createGlobalApiRateLimiter(jwtSecret)

  async function resolveUserOfficialBilling(userId) {
    const user = await getUserById(userId)
    if (!user) return { user: null, isOfficialMode: false }
    const activeModel = await getActiveAIModel()
    const isModelFree = activeModel?.is_free === 1
    const isOfficialMode = user.api_mode === 'official' && !isModelFree
    return { user, isOfficialMode }
  }

  async function recordAIUsageForRequest(req, opts) {
    return trackAIUsageFromRequest(req, opts)
  }

  async function ensureUserCanUseOfficialAI(req, res, next) {
    try {
      const user = await getUserById(req.userId)
      if (!user) return res.status(401).json({ error: '用户不存在' })
      const activeModel = await getActiveAIModel()
      const isModelFree = activeModel?.is_free === 1
      const hasPayment =
        (user.api_mode === 'custom' && user.custom_api_key) ||
        (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFree))
      if (!hasPayment) {
        return res.status(402).json({
          error: '账户余额不足，请先充值',
          needRecharge: true,
          balance: parseFloat(user.balance),
        })
      }
      req.billingUser = user
      next()
    } catch (err) {
      console.error('ensureUserCanUseOfficialAI:', err)
      res.status(500).json({ error: '服务器错误' })
    }
  }

  return {
    ...auth,
    chatLimiter,
    authLimiter,
    riskAssessLimiter,
    globalRateLimiter,
    recordAIUsageForRequest,
    resolveUserOfficialBilling,
    ensureUserCanUseOfficialAI,
    logFinancialActivity,
    unwrapMallUsagePayload,
    unwrapPersonaPayload,
    distPath,
    ORDER_SYSTEM_URL: process.env.ORDER_SYSTEM_URL,
    APPEAL_API_KEY: process.env.APPEAL_API_KEY,
  }
}
