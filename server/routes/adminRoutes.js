import { Router } from 'express'
import {
  verifyAdmin, changeAdminPassword,
  getAllUsers, adjustUserBalance, deleteUser,
  getDashboardStats, getAllSessions,
  getRechargeOrders, confirmRechargeOrder, rejectRechargeOrder,
  getSuccessCases, getSuccessCaseById, createSuccessCase, updateSuccessCase, deleteSuccessCase,
  getAIModels, getAIModelById, createAIModel, updateAIModel, setActiveAIModel, deleteAIModel as deleteAIModelDB,
  getDeepseekAccounts, createDeepseekAccount, updateDeepseekAccount, deleteDeepseekAccount,
  getTokenUsageStats, getAppealStats,
} from '../db.js'
import jwt from 'jsonwebtoken'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

const authLimiter = (await import('express-rate-limit')).default({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required')
  process.exit(1)
}

const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h'

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    
    const admin = await verifyAdmin(username, password)
    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    
    const token = signToken({ adminId: admin.id, role: 'admin' })
    res.json({ success: true, token, admin })
  } catch (error) {
    console.error('Admin login error:', error.message)
    res.status(500).json({ error: '登录失败' })
  }
})

router.put('/password', requireAdmin, async (req, res) => {
  try {
    const { adminId } = req.admin
    const { oldPassword, newPassword } = req.body
    
    const success = await changeAdminPassword(adminId, oldPassword, newPassword)
    if (!success) {
      return res.status(400).json({ error: '原密码错误' })
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getDashboardStats()
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Get stats error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers()
    res.json({ success: true, users })
  } catch (error) {
    console.error('Get users error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await deleteUser(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/users/:id/balance', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { amount, reason } = req.body
    await adjustUserBalance(id, amount, reason)
    res.json({ success: true })
  } catch (error) {
    console.error('Adjust balance error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const sessions = await getAllSessions()
    res.json({ success: true, sessions })
  } catch (error) {
    console.error('Get sessions error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/recharge-orders', requireAdmin, async (req, res) => {
  try {
    const orders = await getRechargeOrders()
    res.json({ success: true, orders })
  } catch (error) {
    console.error('Get recharge orders error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/recharge-orders/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await confirmRechargeOrder(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Confirm order error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/recharge-orders/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    await rejectRechargeOrder(id, reason)
    res.json({ success: true })
  } catch (error) {
    console.error('Reject order error:', error.message)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/cases', async (req, res) => {
  try {
    const cases = await getSuccessCases()
    res.json({ success: true, cases })
  } catch (error) {
    console.error('Get cases error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/cases', async (req, res) => {
  try {
    const caseData = req.body
    const newCase = await createSuccessCase(caseData)
    res.json({ success: true, case: newCase })
  } catch (error) {
    console.error('Create case error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params
    const caseData = req.body
    await updateSuccessCase(id, caseData)
    res.json({ success: true })
  } catch (error) {
    console.error('Update case error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteSuccessCase(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete case error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/ai-models', async (req, res) => {
  try {
    const models = await getAIModels()
    res.json({ success: true, models })
  } catch (error) {
    console.error('Get AI models error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/ai-models', async (req, res) => {
  try {
    const modelData = req.body
    const model = await createAIModel(modelData)
    res.json({ success: true, model })
  } catch (error) {
    console.error('Create AI model error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/ai-models/:id', async (req, res) => {
  try {
    const { id } = req.params
    const modelData = req.body
    await updateAIModel(id, modelData)
    res.json({ success: true })
  } catch (error) {
    console.error('Update AI model error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/ai-models/:id/activate', async (req, res) => {
  try {
    const { id } = req.params
    await setActiveAIModel(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Activate AI model error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/ai-models/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteAIModelDB(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete AI model error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router
