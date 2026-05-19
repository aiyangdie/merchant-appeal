import {
  getPool, getUserById, getProductById, deductBalance, incrementProductMetric,
  createOrder, updateOrderStatus, appendServiceMessage, getUserOrders, getOrdersByUser,
  getOrderByNo, logAIActivity,
} from '../../db.js'
import { aiGenerateVirtualPersona } from '../../mall.js'
import { getAIConfig } from '../../ai.js'
/**
 * orderRoutes
 */
export function registerOrderRoutes(app, ctx) {
  const { signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken, authLimiter, chatLimiter, ensureUserCanUseOfficialAI, recordAIUsageForRequest, logFinancialActivity, unwrapMallUsagePayload, unwrapPersonaPayload } = ctx

app.post('/api/orders/purchase', requireUser, async (req, res) => {
  const t0 = Date.now()
  const conn = await getPool().getConnection()
  try {
    await conn.query('START TRANSACTION')

    const user = await getUserById(req.userId)
    if (!user) return res.status(401).json({ error: '用户不存在' })

    const { productId, collectedData, price: overridePrice } = req.body || {}
    const product = await getProductById(parseInt(productId))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在或已下架' })

    const price = overridePrice ? parseFloat(overridePrice) : parseFloat(product.price)
    const balance = parseFloat(user.balance || 0)
    if (balance < price) return res.status(400).json({ error: '余额不足', needRecharge: true, balance, price })

    await deductBalance(user.id, price, conn)
    await incrementProductMetric(product.id, 'purchase_count', conn)

    // 创建订单（初始状态: created）
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const order = await createOrder({
      orderNo, userId: user.id, productId: product.id, productName: product.name,
      price, persona: {}, collectedData: collectedData || {},
      status: 'created',
    }, conn)

    // 扣款成功 → 已支付
    await updateOrderStatus(order.id, 'paid', conn)

    // 生成虚拟人设
    const { persona: personaRaw, usage: personaUsage } = unwrapPersonaPayload(await aiGenerateVirtualPersona(product, collectedData || {}))
    if (personaUsage) await recordAIUsageForRequest(req, { type: 'mall_persona', usage: personaUsage })
    const p = personaRaw ? { ...personaRaw, source: personaRaw.source || 'ai' } : { name: '客服小助', title: '专属服务顾问', avatar: '👨‍💼', personality: '专业、耐心', greeting: `您好！我是您的专属服务顾问，将全程协助您处理"${product.name}"相关事宜。`, source: 'fallback' }

    // 更新人设到订单
    await conn.query('UPDATE orders SET persona = ? WHERE id = ?', [JSON.stringify(p), order.id])

    // 写入首条服务消息（AI打招呼）
    await appendServiceMessage(order.id, { role: 'assistant', content: p.greeting, ts: Date.now() }, conn)
    await updateOrderStatus(order.id, 'serving', conn)

    // 记录资金审计日志
    const updatedUser = await getUserById(req.userId)
    await logFinancialActivity({
      userId: req.userId,
      type: 'purchase_deduct',
      amount: -price,
      balanceAfter: parseFloat(updatedUser?.balance || 0),
      refId: orderNo,
      note: `购买商品"${product.name}"`,
    })

    await conn.query('COMMIT')

    logAIActivity({ action: '商品购买+生成人设', category: 'purchase', detail: `${user.nickname||user.id}购买"${product.name}" ¥${price} → ${p.name}·${p.title}`, duration_ms: Date.now()-t0 }).catch(()=>{})

    res.json({ success: true, orderNo: order.orderNo, orderId: order.id, persona: p })
  } catch (err) {
    console.error('[Purchase]', err)
    try { await conn.query('ROLLBACK') } catch (_) {}
    res.status(500).json({ error: '购买失败: ' + err.message })
  } finally {
    conn.release()
  }
})

// --- 用户端: 我的订单列表 ---
app.get('/api/orders', requireUser, async (req, res) => {
  try {
    const orders = await getUserOrders(req.userId)
    res.json({ orders: orders.map(o => ({
      id: o.id, orderNo: o.order_no, productName: o.product_name, price: o.price,
      status: o.status, persona: o.persona, createdAt: o.created_at,
    })) })
  } catch (err) { res.status(500).json({ error: '获取订单失败' }) }
})

// --- 用户端: 创建订单（申诉流程完成后） ---
app.post('/api/orders', requireUser, async (req, res) => {
  try {
    const { product_id, product_name, amount, session_id } = req.body
    if (!product_id || !product_name || amount == null) {
      return res.status(400).json({ error: '缺少必要参数：product_id, product_name, amount' })
    }
    const order = await createOrder({
      user_id: req.userId,
      product_id,
      product_name,
      amount,
      session_id: session_id || null,
    })
    res.json({ success: true, order: { id: order.id, orderNo: order.orderNo } })
  } catch (err) {
    console.error('创建订单失败:', err)
    res.status(500).json({ error: '创建订单失败' })
  }
})

// --- 用户端: 我的订单列表（推荐路径） ---
app.get('/api/orders/my', requireUser, async (req, res) => {
  try {
    const orders = await getOrdersByUser(req.userId)
    res.json({ orders: orders.map(o => ({
      id: o.id, orderNo: o.order_no, productName: o.product_name, amount: o.amount,
      status: o.status, sessionId: o.session_id, createdAt: o.created_at,
    })) })
  } catch (err) { res.status(500).json({ error: '获取订单失败' }) }
})

// --- 用户端: 订单详情 ---
app.get('/api/orders/:orderNo', requireUser, async (req, res) => {
  try {
    const order = await getOrderByNo(req.params.orderNo)
    if (!order || order.user_id !== req.userId) return res.status(404).json({ error: '订单不存在' })
    const product = await getProductById(order.product_id)
    res.json({
      order: {
        id: order.id, orderNo: order.order_no, productName: order.product_name,
        productCategory: product?.category || '', price: order.price, status: order.status,
        persona: order.persona, collectedData: order.collected_data,
        messages: order.service_messages || [], createdAt: order.created_at,
      }
    })
  } catch (err) { res.status(500).json({ error: '获取订单详情失败' }) }
})

// --- 用户端: 订单AI服务对话 ---
app.post('/api/orders/:orderNo/chat', requireUser, async (req, res) => {
  const t0 = Date.now()
  try {
    const order = await getOrderByNo(req.params.orderNo)
    if (!order || order.user_id !== req.userId) return res.status(404).json({ error: '订单不存在' })
    if (order.status === 'refunded') return res.status(400).json({ error: '该订单已退款' })

    const { message } = req.body || {}
    if (!message?.trim()) return res.status(400).json({ error: '消息不能为空' })

    // 记录用户消息
    await appendServiceMessage(order.id, { role: 'user', content: message.trim(), ts: Date.now() })

    // 构建AI对话
    const persona = order.persona || {}
    const collectedData = order.collected_data || {}
    const userContext = Object.entries(collectedData).filter(([k,v]) => v && !k.startsWith('_')).map(([k,v]) => `${k}: ${v}`).join('\n')

    const systemPrompt = `你是${persona.name || '专属服务顾问'}，${persona.title || '客服顾问'}。
${persona.systemPrompt || '你专业、耐心、有经验，帮助用户解决商户申诉相关问题。'}

## 你的性格
${persona.personality || '专业、温暖、有耐心'}

## 用户购买的服务
${order.product_name}

## 用户已知情况
${userContext || '暂无详细信息'}

## 你的核心职责
1. 根据用户的具体情况，帮助分析问题、制定申诉策略
2. 如果用户需要，帮助撰写申诉报告、申诉文案、证据整理方案
3. 解答用户的疑问，提供专业建议
4. 用第一人称，像真人顾问一样自然沟通，不要暴露自己是AI
5. 主动推进问题解决进度，每次回复都要有实质性帮助

## 重要
- 直接帮用户做事，不要只给建议
- 如果用户要你写报告/申诉书，直接写出来
- 语气温暖但专业`

    const historyMsgs = (order.service_messages || []).slice(-20).map(m => ({ role: m.role, content: m.content }))

    const cfg = await getAIConfig()
    const aiMessages = [{ role: 'system', content: systemPrompt }, ...historyMsgs, { role: 'user', content: message.trim() }]

    const aiRes = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: aiMessages, temperature: 0.3, top_p: 0.7, max_tokens: 2000 }),
      signal: AbortSignal.timeout(30000),
    })

    let reply = '抱歉，系统繁忙，请稍后再试。'
    if (aiRes.ok) {
      const data = await aiRes.json()
      reply = data.choices?.[0]?.message?.content || reply
      if (data.usage) await recordAIUsageForRequest(req, { type: 'order_service_chat', usage: data.usage })
    }

    await appendServiceMessage(order.id, { role: 'assistant', content: reply, ts: Date.now() })
    logAIActivity({ action: '服务对话', category: 'service', detail: `订单${order.order_no}: ${message.trim().slice(0,50)}`, duration_ms: Date.now()-t0 }).catch(()=>{})

    res.json({ reply })
  } catch (err) {
    console.error('[ServiceChat]', err)
    res.status(500).json({ error: '对话失败: ' + err.message })
  }
})
}
