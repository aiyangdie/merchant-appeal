/**
 * AI 智能商城引擎
 * 
 * 核心功能：
 * 1. 商品目录感知 — 生成商品摘要注入对话System Prompt
 * 2. AI商品优化 — DeepSeek自动优化商品描述/标签/受众
 * 3. 智能推荐引擎 — 基于用户画像+对话上下文匹配商品
 * 4. 用户兴趣追踪 — 从对话中提取用户需求/行业/关键词
 */

import { getSystemConfig } from './db.js'
import {
  getActiveProductsForAI, getProducts, updateProduct, getProductById,
  upsertUserInterest, getUserInterest,
  createRecommendation, getRecommendations, incrementProductMetric,
} from './db.js'

// ========== 1. 商品目录 → System Prompt ==========

let _productCache = { data: null, prompt: '', ts: 0 }
const PRODUCT_CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

/**
 * 加载活跃商品目录，格式化为System Prompt片段
 */
export async function loadProductCatalogForPrompt() {
  if (_productCache.data && (Date.now() - _productCache.ts) < PRODUCT_CACHE_TTL) {
    return _productCache.prompt
  }

  const products = await getActiveProductsForAI()
  if (products.length === 0) {
    _productCache = { data: [], prompt: '', ts: Date.now() }
    return ''
  }

  let prompt = '\n\n## 🛒 智能商城商品目录\n'
  prompt += '以下是当前可推荐的服务/商品，当用户的需求与某个商品匹配时，你应该自然地推荐。推荐时使用格式: [推荐商品:ID] 来标记。\n\n'

  const byCategory = {}
  for (const p of products) {
    const cat = p.category || '其他'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  }

  for (const [category, items] of Object.entries(byCategory)) {
    prompt += `### ${category}\n`
    for (const p of items) {
      const desc = p.ai_description || p.description || ''
      const priceStr = parseFloat(p.price) > 0 ? `¥${p.price}` : '价格面议'
      const tags = (p.tags || []).join('/')
      prompt += `- **[ID:${p.id}] ${p.name}** (${priceStr})`
      if (tags) prompt += ` [${tags}]`
      if (desc) prompt += ` — ${desc.slice(0, 120)}`
      if (p.target_audience?.length) prompt += ` | 适合: ${p.target_audience.join(', ')}`
      prompt += '\n'
    }
  }

  prompt += '\n**推荐原则**: 只在用户需求明确匹配时推荐，不要强行推销。推荐时说明为什么适合该用户。\n'

  _productCache = { data: products, prompt, ts: Date.now() }
  return prompt
}

export function invalidateProductCache() {
  _productCache = { data: null, prompt: '', ts: 0 }
}

// ========== 2. AI 商品优化 ==========

/**
 * 用DeepSeek优化商品描述、标签、目标受众
 */
export async function aiOptimizeProduct(productId) {
  const product = await getProductById(productId)
  if (!product) return null

  const apiKey = await getSystemConfig('deepseek_api_key')
  if (!apiKey) return null
  const model = (await getSystemConfig('deepseek_model')) || 'deepseek-chat'

  const optimizePrompt = `你是商品营销优化专家。请优化以下商品信息，使其更吸引目标客户。输出严格JSON。

## 当前商品信息
- 名称: ${product.name}
- 类别: ${product.category || '未分类'}
- 价格: ¥${product.price}
- 描述: ${product.description || '无描述'}
- 当前标签: ${(product.tags || []).join(', ') || '无'}

## 这是一个商户申诉咨询平台的商城，商品主要面向：
- 被平台处罚的商户（支付机构违规、电商违规等）
- 需要申诉材料撰写、法律咨询、行业合规等服务的商户

## 输出JSON格式
{
  "aiDescription": "优化后的商品描述(100-200字，突出价值主张和痛点解决)",
  "optimizedTags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "targetAudience": ["目标客户群1", "目标客户群2", "目标客户群3"],
  "recommendationKeywords": ["触发推荐的关键词1", "关键词2", "关键词3"],
  "recommendationScore": 50-95之间的数字(基于商品质量和市场需求评估)
}`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, messages: [{ role: 'user', content: optimizePrompt }],
        temperature: 0.7, max_tokens: 1000,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''

    // 解析JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const result = JSON.parse(jsonMatch[0])

    // 更新商品
    await updateProduct(productId, {
      aiDescription: result.aiDescription || product.ai_description,
      tags: result.optimizedTags || product.tags,
      targetAudience: result.targetAudience || product.target_audience,
      recommendationScore: result.recommendationScore || 50,
      aiOptimizedAt: true,
    })

    invalidateProductCache()
    console.log(`[Mall] 商品优化完成: #${productId} ${product.name}`)
    return result
  } catch (err) {
    console.error('[Mall] AI优化商品失败:', err.message)
    return null
  }
}

/**
 * 批量优化所有活跃商品
 */
export async function batchOptimizeProducts() {
  const products = await getProducts({ status: 'active' })
  let optimized = 0
  for (const p of products) {
    // 跳过24小时内已优化的
    if (p.ai_optimized_at && (Date.now() - new Date(p.ai_optimized_at).getTime()) < 24 * 60 * 60 * 1000) continue
    const result = await aiOptimizeProduct(p.id)
    if (result) optimized++
    // 避免API过热
    await new Promise(r => setTimeout(r, 2000))
  }
  return { optimized, total: products.length }
}

// ========== 3. 智能推荐引擎 ==========

/**
 * 基于用户画像和对话上下文推荐商品
 * @param {number|null} userId - 用户ID
 * @param {string} sessionId - 会话ID
 * @param {object} collectedData - 已收集的用户信息
 * @returns {Array} 推荐商品列表
 */
export async function getSmartRecommendations(userId, sessionId, collectedData = {}) {
  const products = await getActiveProductsForAI()
  if (products.length === 0) return []

  const industry = collectedData.industry || ''
  const problemType = collectedData.problem_type || collectedData.violation_reason || ''

  // 获取用户历史兴趣
  const userInterest = userId ? await getUserInterest(userId) : null

  // 对每个商品计算匹配分
  const scored = products.map(p => {
    let score = parseFloat(p.recommendation_score || 50)
    const tags = p.tags || []
    const audience = p.target_audience || []

    // 行业匹配
    if (industry) {
      if (tags.some(t => t.includes(industry)) || audience.some(a => a.includes(industry))) score += 20
      if ((p.ai_description || p.description || '').includes(industry)) score += 10
    }

    // 问题类型匹配
    if (problemType) {
      if (tags.some(t => t.includes(problemType)) || (p.ai_description || p.description || '').includes(problemType)) score += 15
    }

    // 用户历史兴趣匹配
    if (userInterest?.keywords?.length) {
      const matchedKeywords = userInterest.keywords.filter(kw =>
        tags.some(t => t.includes(kw)) || (p.name + (p.ai_description || '')).includes(kw)
      )
      score += matchedKeywords.length * 5
    }

    return { ...p, matchScore: Math.min(100, score) }
  })

  // 按匹配分排序，取前5
  const top = scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5).filter(p => p.matchScore >= 40)

  // 保存推荐记录
  for (const p of top) {
    await createRecommendation({
      userId, sessionId, productId: p.id,
      reason: `行业:${industry} 问题:${problemType}`,
      matchScore: p.matchScore,
    }).catch(() => {})
  }

  return top
}

// ========== 4. 用户兴趣追踪 ==========

/**
 * 从对话数据中提取用户兴趣并更新画像
 */
export async function updateUserInterestFromConversation(userId, sessionId, collectedData, messages = []) {
  if (!userId) return

  const industry = collectedData.industry || ''
  const problemType = collectedData.problem_type || collectedData.violation_reason || ''

  // 从消息中提取关键词
  const keywords = new Set()
  if (industry) keywords.add(industry)
  if (problemType) keywords.add(problemType)

  const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content).join(' ')
  // 简单关键词提取
  const keyPatterns = ['申诉', '处罚', '违规', '冻结', '限制', '封号', '罚款', '合规', '整改', '材料', '证据', '法律', '咨询']
  for (const kw of keyPatterns) {
    if (userMsgs.includes(kw)) keywords.add(kw)
  }

  // 提取需求标签
  const needTags = []
  if (userMsgs.includes('申诉') || userMsgs.includes('材料')) needTags.push('申诉服务')
  if (userMsgs.includes('法律') || userMsgs.includes('律师')) needTags.push('法律咨询')
  if (userMsgs.includes('合规') || userMsgs.includes('整改')) needTags.push('合规指导')
  if (userMsgs.includes('证据') || userMsgs.includes('材料')) needTags.push('材料准备')

  await upsertUserInterest(userId, {
    sessionId, industry, problemType,
    keywords: [...keywords],
    needTags,
    interestScore: { industry: industry ? 1 : 0, legal: needTags.includes('法律咨询') ? 1 : 0 },
  })
}

// ========== 5. 对话中解析推荐标记 ==========

/**
 * 解析AI回复中的 [推荐商品:ID] 标记，替换为商品卡片数据
 */
export async function parseProductRecommendations(aiReply) {
  const pattern = /\[推荐商品:(\d+)\]/g
  const matches = [...aiReply.matchAll(pattern)]
  if (matches.length === 0) return { text: aiReply, products: [] }

  const products = []
  let text = aiReply

  for (const match of matches) {
    const productId = parseInt(match[1])
    const product = await getProductById(productId)
    if (product && product.status === 'active') {
      products.push({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.original_price,
        description: product.ai_description || product.description,
        imageUrl: product.image_url,
        category: product.category,
        tags: product.tags,
      })
      await incrementProductMetric(productId, 'view_count').catch(() => {})
    }
    // 移除标记，让前端通过products数组渲染卡片
    text = text.replace(match[0], '')
  }

  return { text: text.trim(), products }
}
