import { Router } from 'express'
import chatRoutes from './chatRoutes.js'
import sessionRoutes from './sessionRoutes.js'
import userRoutes from './userRoutes.js'
import adminRoutes from './adminRoutes.js'
import appealRoutes from './appealRoutes.js'
import paymentRoutes from './paymentRoutes.js'
import scheduleRoutes from './scheduleRoutes.js'
import aiRoutes from './aiRoutes.js'
import copywritingRoutes from './copywritingRoutes.js'

const router = Router()

router.use('/chat', chatRoutes)
router.use('/sessions', sessionRoutes)
router.use('/users', userRoutes)
router.use('/admin', adminRoutes)
router.use('/appeal', appealRoutes)
router.use('/payment', paymentRoutes)
router.use('/schedules', scheduleRoutes)
router.use('/ai', aiRoutes)
router.use('/copywriting', copywritingRoutes)

export default router
