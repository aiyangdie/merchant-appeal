import { getSession } from '../db.js'

/**
 * 校验会话归属：必须已登录，且 session.user_id === req.userId
 * 历史匿名会话（user_id 为空）拒绝访问
 */
export async function validateSessionOwnership(req, res, next) {
  try {
    const { id } = req.params
    const session = await getSession(id)
    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    if (!session.user_id) {
      return res.status(403).json({ error: '该会话已失效，请重新创建会话' })
    }
    if (String(session.user_id) !== String(req.userId)) {
      return res.status(403).json({ error: '无权访问此会话' })
    }
    req.session = session
    next()
  } catch (err) {
    console.error('Session ownership validation error:', err)
    res.status(500).json({ error: '服务器错误' })
  }
}
