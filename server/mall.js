/**
 * AI 智能商城引擎
 * 
 * 核心功能：
 * 1. 商品目录感知 — 生成商品摘要注入对话System Prompt
 * 2. AI商品优化 — DeepSeek自动优化商品描述/标签/受众
 * 3. 智能推荐引擎 — 基于用户画像+对话上下文匹配商品
 * 4. 用户兴趣追踪 — 从对话中提取用户需求/行业/关键词
 */

import { getSystemConfig, getActiveAIModel } from './db.js'

// 内联 AI provider 配置（避免循环依赖）
async function _getAIConfig() {
  const active = await getActiveAIModel()
  if (active) return { provider: active.provider, apiKey: active.api_key, model: active.model_name, endpoint: active.endpoint }
  const provider = (await getSystemConfig('ai_provider')) || 'deepseek'
  if (provider === 'zhipu') return { provider, apiKey: await getSystemConfig('zhipu_api_key'), model: (await getSystemConfig('zhipu_model')) || 'glm-4.7-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' }
  return { provider, apiKey: await getSystemConfig('deepseek_api_key'), model: (await getSystemConfig('deepseek_model')) || 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions' }
}
import {
  getActiveProductsForAI, getProducts, updateProduct, getProductById, createProduct,
  upsertUserInterest, getUserInterest,
  createRecommendation, getRecommendations, incrementProductMetric,
  getActiveContactCards, incrementCardMetric,
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
  prompt += '\n**智能推荐时机**（在以下节点自然推荐匹配商品）:\n'
  prompt += '- 诊断完成后（告知用户案件难度和成功率时）：如案件复杂，推荐专业服务\n'
  prompt += '- 生成申诉文案后：推荐人工审核/优化服务\n'
  prompt += '- 用户表示不会操作/没时间/太复杂时：推荐代办或一对一指导\n'
  prompt += '- 用户被驳回多次、案件极难时：推荐专业法律/申诉服务\n'
  prompt += '- 用户主动问"有没有人帮忙"时：直接推荐最匹配的服务\n'
  prompt += '- 信息收集全部完成时：在总结中顺带提一句相关服务\n'

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

  const _cfg = await _getAIConfig()
  if (!_cfg.apiKey) return null

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
    const res = await fetch(_cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_cfg.apiKey}` },
      body: JSON.stringify({
        model: _cfg.model, messages: [{ role: 'user', content: optimizePrompt }],
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

// ========== 3. AI智能推荐引擎（全AI驱动，无写死规则）==========

/**
 * AI驱动的智能推荐：让AI评估每个商品与用户需求的匹配度
 */
export async function getSmartRecommendations(userId, sessionId, collectedData = {}) {
  const products = await getActiveProductsForAI()
  if (products.length === 0) return []

  const industry = collectedData.industry || ''
  const problemType = collectedData.problem_type || collectedData.violation_reason || ''
  const userInterest = userId ? await getUserInterest(userId) : null

  // 尝试用AI做智能匹配
  const cfg = await _getAIConfig()
  if (cfg.apiKey && products.length > 0) {
    try {
      const aiResult = await _aiMatchProducts(cfg, products, { industry, problemType, userInterest, collectedData })
      if (aiResult?.length > 0) {
        // 保存AI推荐记录
        for (const rec of aiResult) {
          await createRecommendation({
            userId, sessionId, productId: rec.id,
            reason: rec.reason || `AI推荐`,
            matchScore: rec.matchScore || 80,
          }).catch(() => {})
        }
        return aiResult
      }
    } catch (err) {
      console.error('[Mall] AI推荐失败，使用基础排序:', err.message)
    }
  }

  // AI不可用时：按推荐分排序（不做任何规则匹配）
  const fallback = products
    .map(p => ({ ...p, matchScore: parseFloat(p.recommendation_score || 50) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)

  for (const p of fallback) {
    await createRecommendation({
      userId, sessionId, productId: p.id,
      reason: `基础推荐(AI不可用)`,
      matchScore: p.matchScore,
    }).catch(() => {})
  }
  return fallback
}

/**
 * AI评估商品与用户的匹配度
 */
async function _aiMatchProducts(cfg, products, context) {
  const productList = products.map(p =>
    `[ID:${p.id}] ${p.name} (${p.category || '未分类'}) ¥${p.price} — ${(p.ai_description || p.description || '').slice(0, 80)} | 标签:${(p.tags || []).join(',')} | 受众:${(p.target_audience || []).join(',')}`
  ).join('\n')

  const userProfile = [
    context.industry ? `行业: ${context.industry}` : '',
    context.problemType ? `问题类型: ${context.problemType}` : '',
    context.userInterest?.keywords?.length ? `历史关键词: ${context.userInterest.keywords.join(', ')}` : '',
    context.userInterest?.need_tags?.length ? `需求标签: ${context.userInterest.need_tags.join(', ')}` : '',
    context.collectedData?.violation_reason ? `违规原因: ${context.collectedData.violation_reason}` : '',
    context.collectedData?.business_model ? `经营模式: ${context.collectedData.business_model}` : '',
  ].filter(Boolean).join('\n') || '暂无用户信息'

  const prompt = `你是商品推荐AI。根据用户画像，从商品列表中选出最匹配的1-5个商品。

## 用户画像
${userProfile}

## 商品列表
${productList}

## 输出JSON（只输出JSON）
[
  {"id": 商品ID, "matchScore": 0-100匹配度, "reason": "推荐理由(一句话)"}
]

要求：
- 只推荐真正与用户需求匹配的商品，不要凑数
- matchScore>=60才算值得推荐
- reason要具体说明为什么适合这个用户
- 如果没有匹配的商品，返回空数组 []`

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null

  const recs = JSON.parse(jsonMatch[0])
  // 将AI推荐结果与商品数据合并
  return recs
    .filter(r => r.matchScore >= 60)
    .map(r => {
      const product = products.find(p => p.id === r.id)
      if (!product) return null
      return { ...product, matchScore: r.matchScore, reason: r.reason }
    })
    .filter(Boolean)
    .slice(0, 5)
}

// ========== 4. AI用户兴趣追踪（全AI驱动）==========

/**
 * AI从对话中提取用户兴趣并更新画像
 */
export async function updateUserInterestFromConversation(userId, sessionId, collectedData, messages = []) {
  if (!userId) return

  const industry = collectedData.industry || ''
  const problemType = collectedData.problem_type || collectedData.violation_reason || ''

  // 尝试AI提取兴趣
  const cfg = await _getAIConfig()
  if (cfg.apiKey && messages.length >= 2) {
    try {
      const aiInterest = await _aiExtractInterest(cfg, collectedData, messages)
      if (aiInterest) {
        await upsertUserInterest(userId, {
          sessionId, industry, problemType,
          keywords: aiInterest.keywords || [],
          needTags: aiInterest.needTags || [],
          interestScore: aiInterest.interestScore || {},
        })
        return
      }
    } catch (err) {
      console.error('[Mall] AI兴趣提取失败:', err.message)
    }
  }

  // AI不可用：仅保存客观数据
  const basicKeywords = [industry, problemType].filter(Boolean)
  await upsertUserInterest(userId, {
    sessionId, industry, problemType,
    keywords: basicKeywords,
    needTags: [],
    interestScore: {},
  })
}

/**
 * AI分析对话提取用户兴趣画像
 */
async function _aiExtractInterest(cfg, collectedData, messages) {
  const userMsgs = messages.filter(m => m.role === 'user').slice(-10)
  const conversationSnippet = userMsgs.map(m => m.content?.slice(0, 200) || '').join('\n')

  const prompt = `从以下商户申诉对话中提取用户兴趣画像。输出严格JSON。

## 用户已提供信息
${Object.entries(collectedData).filter(([k, v]) => v && !k.startsWith('_')).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '无'}

## 用户消息
${conversationSnippet}

## 输出JSON
{
  "keywords": ["从对话中提取的关键词，如行业名、问题类型、具体需求等"],
  "needTags": ["用户的服务需求标签，如：申诉服务、法律咨询、合规指导、材料准备、账户解冻、资质办理等"],
  "interestScore": {
    "urgency": 0-100,
    "willingness_to_pay": 0-100,
    "complexity": 0-100
  }
}
只输出JSON`

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  return JSON.parse(jsonMatch[0])
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

// ========== 6. AI自动商品生成（基于对话模式发现需求缺口）==========

/**
 * AI分析用户对话模式，自动建议新商品/服务
 * 适合在批处理中定期调用（如每日）
 */
export async function aiSuggestNewProducts(recentAnalyses = []) {
  const cfg = await _getAIConfig()
  if (!cfg.apiKey) return null

  const existingProducts = await getProducts({ status: 'active' })
  const existingNames = existingProducts.map(p => p.name).join(', ') || '暂无商品'

  // 构建用户需求摘要
  const needsSummary = recentAnalyses.slice(0, 20).map(a => {
    const parts = []
    if (a.industry) parts.push(`行业:${a.industry}`)
    if (a.problem_type) parts.push(`问题:${a.problem_type}`)
    if (a.user_sentiment === 'negative' || a.user_sentiment === 'slightly_negative') parts.push('用户不满')
    return parts.join(' ')
  }).filter(Boolean).join('\n') || '暂无分析数据'

  const prompt = `你是商户申诉平台的商品策划AI。根据近期用户对话分析，建议平台应该上架哪些新商品/服务。

## 平台定位
帮助被处罚的商户进行申诉，提供申诉材料撰写、法律咨询、合规指导等服务。

## 现有商品
${existingNames}

## 近期用户需求摘要
${needsSummary}

## 输出JSON（只输出JSON）
[
  {
    "name": "商品名称",
    "category": "分类（如：申诉服务、法律咨询、合规指导、材料准备、VIP服务）",
    "price": 价格数字,
    "description": "商品描述(50-100字)",
    "tags": ["标签1", "标签2"],
    "targetAudience": ["目标客户1", "目标客户2"],
    "reason": "为什么建议上架此商品（基于用户需求分析）"
  }
]

要求：
- 只建议与现有商品不重复的新商品
- 价格合理（几十到几千元）
- 基于真实用户需求，不凭空捏造
- 如果没有明显需求缺口，返回空数组 []
- 最多建议3个商品`

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 1500 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null

    const suggestions = JSON.parse(jsonMatch[0])
    console.log(`[Mall] AI建议${suggestions.length}个新商品`)
    return suggestions
  } catch (err) {
    console.error('[Mall] AI商品建议失败:', err.message)
    return null
  }
}

/**
 * AI自动创建商品（将建议转为草稿商品）
 */
export async function aiAutoCreateProducts(recentAnalyses = []) {
  const suggestions = await aiSuggestNewProducts(recentAnalyses)
  if (!suggestions?.length) return { created: 0, suggestions: [] }

  const created = []
  for (const s of suggestions) {
    try {
      const result = await createProduct({
        name: s.name,
        category: s.category || '其他',
        price: s.price || 0,
        description: s.description || '',
        tags: s.tags || [],
        targetAudience: s.targetAudience || [],
        status: 'draft', // 自动创建为草稿，管理员审核后上架
      })
      created.push({ ...result, name: s.name, reason: s.reason })

      // 自动AI优化描述
      await aiOptimizeProduct(result.id).catch(() => {})
    } catch (err) {
      console.error('[Mall] 自动创建商品失败:', s.name, err.message)
    }
  }

  invalidateProductCache()
  console.log(`[Mall] AI自动创建${created.length}个商品草稿`)
  return { created: created.length, suggestions: created }
}

// ========== 7. AI名片推荐（根据用户需求推荐合适的联系人）==========

// ========== 8. AI风险评估（根据用户违规信息评估风险等级）==========

/**
 * 规则引擎快速风险评估（毫秒级，不调用 AI）
 */
export function heuristicAssessRisk(collectedData = {}) {
  const vr = String(collectedData.violation_reason || collectedData.problem_type || '').toLowerCase()
  const pt = String(collectedData.penalty_type || '').toLowerCase()
  const combined = `${vr} ${pt}`

  if (/涉嫌|诈骗|赌博|洗钱|违法|犯罪/.test(combined)) {
    return { level: 'severe', label: '严重风险', description: '涉及法律或重大违规，建议寻求专业支持', confidence: 0.55, source: 'heuristic' }
  }
  if (/永久|封号|封禁|关闭|冻结|限制交易|止付/.test(combined)) {
    return { level: 'high', label: '高风险', description: '账户或资金受限，需尽快准备申诉材料', confidence: 0.55, source: 'heuristic' }
  }
  if (/警告|限额|首次|一般违规|限制收款/.test(combined)) {
    return { level: 'medium', label: '中等风险', description: '存在违规记录，可通过申诉争取恢复', confidence: 0.45, source: 'heuristic' }
  }
  if (vr || pt) {
    return { level: 'medium', label: '待评估', description: '已记录违规信息，继续补充细节可提升判断准确度', confidence: 0.35, source: 'heuristic' }
  }
  return { level: 'low', label: '信息不足', description: '请补充违规原因与处罚类型', confidence: 0.2, source: 'heuristic' }
}

/**
 * AI评估违规风险等级：severe/high/medium/low
 * 优先返回规则结果；AI 在时限内成功则覆盖
 */
export async function aiAssessRisk(collectedData = {}) {
  const heuristic = heuristicAssessRisk(collectedData)
  const cfg = await _getAIConfig()
  if (!cfg.apiKey) return heuristic

  const context = Object.entries(collectedData)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '暂无信息'

  const prompt = `你是商户申诉风险评估AI。根据以下用户信息评估其违规解除的风险等级。

## 用户信息
${context}

## 输出JSON（只输出JSON）
{
  "level": "severe|high|medium|low",
  "label": "风险等级中文标签",
  "description": "一句话描述风险状况和原因",
  "factors": ["风险因素1", "风险因素2"],
  "suggestion": "给用户的建议"
}

评估标准：
- severe：涉嫌违法犯罪（赌博、诈骗、洗钱等）、多次处罚、永久封禁
- high：账户冻结、交易限制、重大违规、涉及大额资金
- medium：一般违规、首次处罚、限额限制、可申诉
- low：轻微违规、警告提醒、误判可能性大`

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 300 }),
      signal: AbortSignal.timeout(4500),
    })
    if (!res.ok) return heuristic

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return heuristic

    const result = JSON.parse(jsonMatch[0])
    return { ...result, confidence: 0.9, source: 'ai' }
  } catch (err) {
    console.error('[Mall] AI风险评估失败:', err.message)
    return heuristic
  }
}

// ========== 9. AI生成名片 ==========

/**
 * AI根据业务需求自动生成名片内容
 */
export async function aiGenerateContactCard(context = {}) {
  const cfg = await _getAIConfig()
  if (!cfg.apiKey) return null

  const prompt = `你是商户申诉平台的名片设计AI。根据以下需求生成一个专业的联系人名片。

## 需求
${context.description || '为商户申诉平台生成一个专业的技术支持人员名片'}
类型偏好: ${context.category || '自动选择'}

## 输出JSON
{
  "name": "真实感的中文姓名",
  "title": "职位头衔（如：资深申诉顾问、法律合规专家等）",
  "description": "一句话个人介绍（突出专业能力和服务承诺）",
  "category": "general|legal|tech|sales|vip",
  "tags": ["专业标签1", "专业标签2", "专业标签3"],
  "targetAudience": ["目标客户1", "目标客户2"]
}
只输出JSON，名字要有真实感`

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 400 }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('[Mall] AI名片生成失败:', err.message)
    return null
  }
}

/**
 * AI根据用户对话上下文推荐最合适的名片
 */
export async function aiRecommendContactCard(collectedData = {}, messages = []) {
  const cards = await getActiveContactCards()
  if (cards.length <= 1) return cards[0] || null // 只有一张或没有，直接返回

  const cfg = await _getAIConfig()
  if (!cfg.apiKey) return cards[0] // AI不可用，返回第一张

  const cardList = cards.map(c =>
    `[ID:${c.id}] ${c.name} (${c.title || '无头衔'}) | 分类:${c.category} | 标签:${(c.tags || []).join(',')} | 描述:${(c.description || '').slice(0, 60)}`
  ).join('\n')

  const userContext = [
    collectedData.industry ? `行业: ${collectedData.industry}` : '',
    collectedData.problem_type ? `问题: ${collectedData.problem_type}` : '',
    collectedData.violation_reason ? `违规: ${collectedData.violation_reason}` : '',
  ].filter(Boolean).join(', ') || '暂无信息'

  const prompt = `从以下联系人名片中，选出最适合当前用户的一个。

用户情况: ${userContext}

名片列表:
${cardList}

输出JSON: {"id": 最匹配的名片ID, "reason": "推荐理由"}
只输出JSON`

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 200 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return cards[0]

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return cards[0]

    const result = JSON.parse(jsonMatch[0])
    const matched = cards.find(c => c.id === result.id)
    if (matched) {
      await incrementCardMetric(matched.id, 'view_count').catch(() => {})
      return { ...matched, aiReason: result.reason }
    }
    return cards[0]
  } catch {
    return cards[0]
  }
}

// ========== 10. AI砍价助手 ==========

/**
 * AI砍价：模拟真人卖家与买家议价
 * @param {Object} product - 商品信息
 * @param {Array} bargainHistory - 砍价对话历史 [{role, content}]
 * @param {string} userMessage - 用户最新砍价消息
 */
export async function aiBargain(product, bargainHistory = [], userMessage = '') {
  const cfg = await _getAIConfig()
  const minPrice = Math.max(product.price * 0.6, 1) // 底线：6折
  const currentOffer = product.price

  if (!cfg.apiKey) {
    // AI不可用时的简单砍价逻辑
    const discount = Math.round(product.price * 0.85)
    return {
      reply: `亲，这个价格已经很实惠了~最多给您优惠到 ¥${discount}，不能再低了哦！`,
      finalPrice: null,
      accepted: false,
    }
  }

  const systemPrompt = `你是一个商户申诉平台的销售顾问，正在和客户就一件商品进行砍价。
你的角色是"卖方"，需要维护平台利益但也要灵活。

## 商品信息
- 名称: ${product.name}
- 原价: ¥${product.original_price || product.price}
- 当前售价: ¥${product.price}
- 分类: ${product.category}
- 描述: ${(product.ai_description || product.description || '').slice(0, 100)}

## 砍价规则（你内心知道但不直接告诉客户）
- 绝对底线: ¥${minPrice.toFixed(0)}（不能低于此价格）
- 首次让利不超过10%
- 每次让步幅度递减
- 如果客户出价在底线之上且合理，可以成交
- 用自然、有温度的语气，像朋友一样沟通
- 适当强调商品价值和服务质量

## 输出JSON
{
  "reply": "你的回复内容",
  "finalPrice": null或成交价格数字,
  "accepted": false或true,
  "counterOffer": null或你的还价数字
}
只输出JSON`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...bargainHistory.slice(-8),
    { role: 'user', content: userMessage },
  ]

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.7, max_tokens: 400 }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { reply: '系统忙，请稍后再试~', finalPrice: null, accepted: false }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { reply: '让我想想...稍等一下~', finalPrice: null, accepted: false }

    const result = JSON.parse(jsonMatch[0])
    // 安全校验：确保不会低于底线
    if (result.finalPrice && result.finalPrice < minPrice) {
      result.finalPrice = Math.round(minPrice)
      result.reply = result.reply.replace(/\d+(\.\d+)?/, String(result.finalPrice))
    }
    return result
  } catch {
    return { reply: '网络不太好，我们换个时间聊~', finalPrice: null, accepted: false }
  }
}

// ========== 11. 虚拟名片人设生成 ==========

/**
 * 下单成功后，AI生成一个虚拟人设名片
 * 这个"人"后续会以此人设与客户沟通帮助解决问题
 */
export async function aiGenerateVirtualPersona(product, collectedData = {}) {
  const cfg = await _getAIConfig()
  if (!cfg.apiKey) {
    return {
      name: '客服小助',
      title: '专属服务顾问',
      avatar: '👨‍💼',
      personality: '专业、耐心、有经验',
      greeting: `您好！我是您的专属服务顾问，已经了解了您的情况，接下来我会全程协助您处理"${product.name}"相关事宜。有任何问题随时问我~`,
      systemPrompt: '',
    }
  }

  const userContext = Object.entries(collectedData)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const prompt = `用户购买了"${product.name}"(${product.category})服务。
用户情况: ${userContext || '暂无详细信息'}

请生成一个虚拟客服人设，这个人设将在后续以真人身份帮用户处理问题。

输出JSON:
{
  "name": "真实感的中文姓名",
  "title": "职位头衔",
  "avatar": "一个表情符号作为头像",
  "personality": "性格特征描述（20字内）",
  "expertise": ["擅长领域1", "擅长领域2"],
  "greeting": "首次打招呼的话（自然、温暖、专业，提到用户的具体情况，100字左右）",
  "systemPrompt": "这个人设在后续对话中应该遵循的行为准则（50字内）"
}
只输出JSON`

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('[Mall] 虚拟人设生成失败:', err.message)
    return null
  }
}
