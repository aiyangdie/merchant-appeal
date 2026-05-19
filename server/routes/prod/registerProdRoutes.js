/**
 * 生产环境路由统一注册（保持 URL 与顺序不变）
 */
import { registerXianyuRoutes } from './xianyuRoutes.js'
import { registerUserRoutes } from './userRoutes.js'
import { registerPublicRoutes } from './publicRoutes.js'
import { registerRechargeRoutes } from './rechargeRoutes.js'
import { registerSessionRoutes } from './sessionRoutes.js'
import { registerChatRoutes } from './chatRoutes.js'
import { registerChatStreamRoute } from '../../handlers/chatStreamHandler.js'
import { registerDeepAnalysisRoute } from '../../handlers/deepAnalysisHandler.js'
import { registerAdminRoutes } from './adminRoutes.js'
import { registerMallRoutes } from './mallRoutes.js'
import { registerOrderRoutes } from './orderRoutes.js'
import { registerCopywritingRoutes } from './copywritingRoutes.js'
import { registerHealthRoutes } from './healthRoutes.js'

export function registerProdRoutes(app, ctx) {
  registerXianyuRoutes(app, ctx)
  registerSessionRoutes(app, ctx)
  registerUserRoutes(app, ctx)
  registerChatRoutes(app, ctx)
  registerDeepAnalysisRoute(app, ctx)
  registerChatStreamRoute(app, ctx)
  registerPublicRoutes(app, ctx)
  registerRechargeRoutes(app, ctx)
  registerAdminRoutes(app, ctx)
  registerMallRoutes(app, ctx)
  registerOrderRoutes(app, ctx)
  registerCopywritingRoutes(app, ctx)
  registerHealthRoutes(app, ctx)
}
