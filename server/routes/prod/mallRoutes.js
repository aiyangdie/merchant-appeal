import { getProducts, getProductById, incrementProductMetric, getRecommendations, updateRecommendationStatus } from '../../db.js'
import { aiBargain, aiGenerateVirtualPersona, aiAssessRisk } from '../../mall.js'
import { logAIActivity } from '../../db.js'
/**
 * mallRoutes
 */
export function registerMallRoutes(app, ctx) {
  const { requireUser, requireAdmin, optionalUser, authLimiter, riskAssessLimiter, ensureUserCanUseOfficialAI, recordAIUsageForRequest, unwrapMallUsagePayload, unwrapPersonaPayload, logFinancialActivity } = ctx

app.get('/api/mall/products', async (req, res) => {
  try {
    const { category, search } = req.query
    const products = await getProducts({ status: 'active', category, search, limit: 50 })
    res.json({ products: products.map(p => ({
      id: p.id, name: p.name, category: p.category, price: p.price, originalPrice: p.original_price,
      description: p.ai_description || p.description, imageUrl: p.image_url, tags: p.tags,
    })) })
  } catch (err) { res.status(500).json({ error: '获取商品失败' }) }
})

app.get('/api/mall/products/:id', async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在' })
    await incrementProductMetric(product.id, 'view_count').catch(() => {})
    res.json({ product: {
      id: product.id, name: product.name, category: product.category,
      price: product.price, originalPrice: product.original_price,
      description: product.ai_description || product.description, imageUrl: product.image_url, tags: product.tags,
    } })
  } catch (err) { res.status(500).json({ error: '获取商品失败' }) }
})

app.post('/api/mall/products/:id/click', async (req, res) => {
  try {
    await incrementProductMetric(parseInt(req.params.id), 'click_count')
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '记录失败' }) }
})

// --- 用户端: 个性化推荐 ---
app.get('/api/mall/recommendations', optionalUser, async (req, res) => {
  try {
    const { sessionId } = req.query
    const userId = req.userId || null
    const recs = await getRecommendations(userId, sessionId || null, 10)
    res.json({ recommendations: recs })
  } catch (err) { res.status(500).json({ error: '获取推荐失败' }) }
})

app.put('/api/mall/recommendations/:id/status', requireAdmin, async (req, res) => {
  try {
    await updateRecommendationStatus(parseInt(req.params.id), req.body.status || 'clicked')
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: '更新失败' }) }
})

// --- 公开: AI砍价 ---
app.post('/api/mall/products/:id/bargain', requireUser, ensureUserCanUseOfficialAI, async (req, res) => {
  const t0 = Date.now()
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product || product.status !== 'active') return res.status(404).json({ error: '商品不存在' })
    const { history, message } = req.body || {}
    const raw = await aiBargain(product, history || [], message || '')
    const { data: result, usage } = unwrapMallUsagePayload(raw)
    if (usage) await recordAIUsageForRequest(req, { type: 'mall_bargain', usage })
    logAIActivity({ action: 'AI砍价', category: 'bargain', detail: `商品"${product.name}" ${result.accepted ? '成交¥'+result.finalPrice : '议价中'}`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json(result)
  } catch (err) { res.json({ reply: '系统繁忙，请稍后再试', finalPrice: null, accepted: false }) }
})

// --- 公开: 下单后生成虚拟人设 ---
app.post('/api/mall/products/:id/persona', requireUser, ensureUserCanUseOfficialAI, async (req, res) => {
  const t0 = Date.now()
  try {
    const product = await getProductById(parseInt(req.params.id))
    if (!product) return res.status(404).json({ error: '商品不存在' })
    const { collectedData } = req.body || {}
    const { persona, usage } = unwrapPersonaPayload(await aiGenerateVirtualPersona(product, collectedData || {}))
    if (usage) await recordAIUsageForRequest(req, { type: 'mall_persona', usage })
    const p = persona || { name: '客服小助', title: '专属顾问', avatar: '👨‍💼', greeting: '您好，我是您的专属服务顾问！' }
    logAIActivity({ action: '生成虚拟人设', category: 'persona', detail: `${p.name}·${p.title} 服务商品"${product.name}"`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json({ persona: p })
  } catch (err) { res.json({ persona: { name: '客服小助', title: '专属顾问', avatar: '👨‍💼', greeting: '您好，我是您的专属服务顾问！' } }) }
})

// --- 需登录: AI风险评估（用户级限流 10次/分钟） ---
app.post('/api/risk-assess', requireUser, riskAssessLimiter, async (req, res) => {
  const t0 = Date.now()
  try {
    const { collectedData } = req.body || {}
    const raw = await aiAssessRisk(collectedData || {})
    const { data: result, usage } = unwrapMallUsagePayload(raw)
    if (usage) await recordAIUsageForRequest(req, { type: 'mall_risk', usage })
    logAIActivity({ action: 'AI风险评估', category: 'risk', detail: `${result.label}: ${result.description || ''}`, duration_ms: Date.now()-t0 }).catch(()=>{})
    res.json(result)
  } catch (err) { res.json({ level: 'medium', label: '评估中', description: '评估失败' }) }
})
}
