import { getWelcomeMessage } from '../../ai.js'
/**
 * publicRoutes
 */
export function registerPublicRoutes(app, ctx) {
  const {
    signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken,
    authLimiter,
  } = ctx

app.get('/api/public/welcome', (_req, res) => {
  res.json({ message: getWelcomeMessage() })
})
}
