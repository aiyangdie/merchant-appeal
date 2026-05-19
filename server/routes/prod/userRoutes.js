import {
  registerUser, getUserByPhone, getUserById, updateUserApiMode, adjustUserBalance,
  getUserSessions, isChinese, trackUserAction, updateUserActivity, incrementLoginCount,
  getSystemConfig, getUserTokenUsage, getUserTokenStats, getUserRechargeOrders, getPool,
} from '../../db.js'
/**
 * userRoutes
 */
export function registerUserRoutes(app, ctx) {
  const {
    signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken,
    authLimiter,
  } = ctx

app.post('/api/user/register', authLimiter, async (req, res) => {
  try {
    const { phone, nickname, name } = req.body
    const userName = nickname || name  // 兼容前端发送的 name 或 nickname
    if (!phone || phone.trim().length < 2 || phone.trim().length > 20) return res.status(400).json({ error: '请输入有效的手机号' })
    if (!userName || !isChinese(userName.trim()) || userName.trim().length > 20) return res.status(400).json({ error: '名称必须为中文（不超过20字）' })
    const result = await registerUser(phone.trim(), userName.trim())
    const u = result.user
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    if (result.isNew) {
      // 新用户赠送试用余额（管理员可在后台配置 new_user_balance）
      const giftStr = await getSystemConfig('new_user_balance')
      const giftAmount = parseFloat(giftStr || '1.00')
      if (giftAmount > 0) {
        await adjustUserBalance(u.id, giftAmount)
        u.balance = giftAmount
      }
      await trackUserAction(u.id, 'register', `手机号: ${u.phone}, 赠送余额: ¥${giftAmount}`, ip, req.headers['user-agent'] || '')
    }
    await incrementLoginCount(u.id)
    await updateUserActivity(u.id, ip)
    const token = signToken({ userId: u.id, role: 'user' })
    res.json({ user: { id: u.id, phone: u.phone, nickname: u.nickname, balance: u.balance, api_mode: u.api_mode }, token, isNew: result.isNew })
  } catch (err) {
    if (err.message === 'CHINESE_NAME_REQUIRED') return res.status(400).json({ error: '名称必须为中文' })
    console.error('Register error:', err)
    res.status(500).json({ error: '注册失败' })
  }
})

app.post('/api/user/login', authLimiter, async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || phone.trim().length > 20) return res.status(400).json({ error: '请输入手机号' })
    const user = await getUserByPhone(phone.trim())
    if (!user) return res.status(401).json({ error: '手机号或密码错误' })
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
    await incrementLoginCount(user.id)
    await updateUserActivity(user.id, ip)
    await trackUserAction(user.id, 'login', '', ip, req.headers['user-agent'] || '')
    const token = signToken({ userId: user.id, role: 'user' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode }, token })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: '登录失败' })
  }
})

// 获取用户的所有聊天会话（需登录 + 只能查自己的）
app.get('/api/user/:id/sessions', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const sessions = await getUserSessions(req.params.id)
    res.json({ sessions })
  } catch (err) {
    console.error('Get user sessions error:', err)
    res.status(500).json({ error: '获取历史记录失败' })
  }
})

app.get('/api/user/:id', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const user = await getUserById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode } })
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

app.put('/api/user/:id/api-mode', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const { api_mode, custom_api_key } = req.body
    if (!['official', 'custom'].includes(api_mode)) return res.status(400).json({ error: '无效的API模式' })
    if (api_mode === 'custom' && (!custom_api_key || !custom_api_key.trim())) {
      return res.status(400).json({ error: '使用自定义API必须提供 API Key' })
    }
    if (custom_api_key && custom_api_key.length > 200) return res.status(400).json({ error: 'API Key 过长' })
    await updateUserApiMode(req.params.id, api_mode, custom_api_key || '')
    const user = await getUserById(req.params.id)
    res.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, balance: user.balance, api_mode: user.api_mode } })
  } catch (err) {
    res.status(500).json({ error: '更新失败' })
  }
})
app.get('/api/user/:id/appeal-records', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const uid = parseInt(req.params.id)
    const pool = getPool()
    const [rows] = await pool.execute(`
      SELECT at.session_id, at.appeal_status, at.submitted_at, at.result_at, at.rejection_reason, at.resubmit_count, at.created_at,
             s.collected_data
      FROM appeal_texts at
      LEFT JOIN sessions s ON at.session_id = s.session_id
      WHERE at.user_id = ?
      ORDER BY at.created_at DESC
      LIMIT 20
    `, [uid])
    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    const records = rows.map(r => {
      let info = {}
      try { info = typeof r.collected_data === 'string' ? JSON.parse(r.collected_data) : (r.collected_data || {}) } catch {}
      return {
        session_id: r.session_id,
        status: r.appeal_status || 'generated',
        label: statusLabels[r.appeal_status] || '已生成文案',
        merchant_name: info.merchant_name || info.company_name || '',
        problem_type: info.problem_type || '',
        violation_reason: info.violation_reason || '',
        submitted_at: r.submitted_at,
        result_at: r.result_at,
        rejection_reason: r.rejection_reason,
        resubmit_count: r.resubmit_count || 0,
        created_at: r.created_at,
      }
    })
    res.json({ records })
  } catch (err) {
    console.error('Get appeal records error:', err)
    res.status(500).json({ error: '获取申诉记录失败' })
  }
})

// ========== 用户消费明细 ==========

app.get('/api/user/:id/usage', requireUser, async (req, res) => {
  try {
    if (String(req.userId) !== String(req.params.id)) return res.status(403).json({ error: '无权访问' })
    const uid = parseInt(req.params.id)
    const [usage, stats, rechargeOrders] = await Promise.all([
      getUserTokenUsage(uid, 100),
      getUserTokenStats(uid),
      getUserRechargeOrders(uid),
    ])
    const user = await getUserById(uid)
    res.json({
      balance: user ? parseFloat(user.balance) : 0,
      totalSpent: user ? parseFloat(user.total_spent) : 0,
      stats,
      usage,
      rechargeOrders,
    })
  } catch (err) {
    console.error('Get usage error:', err)
    res.status(500).json({ error: '获取消费明细失败' })
  }
})
}
