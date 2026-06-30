import { Router } from 'express'
import { requireUser } from '../middleware/auth.js'
import {
  getUserById,
  completeUserProfile,
  formatUserForClient,
} from '../db.js'

const router = Router()

router.get('/profile', requireUser, async (req, res) => {
  try {
    const user = await getUserById(req.userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: formatUserForClient(user) })
  } catch (err) {
    console.error('[profile] get error:', err)
    res.status(500).json({ error: '获取资料失败' })
  }
})

router.post('/complete-profile', requireUser, async (req, res) => {
  try {
    const { phone, nickname } = req.body || {}
    const user = await completeUserProfile(req.userId, { phone, nickname })
    res.json({ user: formatUserForClient(user) })
  } catch (err) {
    if (err.message === 'INVALID_PHONE') {
      return res.status(400).json({ error: '请输入正确的手机号' })
    }
    if (err.message === 'PHONE_REQUIRED') {
      return res.status(400).json({ error: '请绑定手机号' })
    }
    if (err.message === '该手机号已被其他账号绑定') {
      return res.status(400).json({ error: err.message })
    }
    if (err.message === 'CHINESE_NAME_REQUIRED') {
      return res.status(400).json({ error: '昵称必须为中文' })
    }
    console.error('[profile] complete error:', err)
    res.status(500).json({ error: err.message || '保存失败' })
  }
})

export default router
