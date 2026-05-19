/**
 * 商城自然语言指令：解析用户意图并执行上架/下架/创建商品等
 */
import { getAIConfig } from '../shared/aiConfig.js'
import {
  getProducts,
  createProduct,
  batchUpdateProductsStatus,
  getProductById,
} from '../db.js'
import { invalidateProductCache } from '../mall.js'

const STATUS_LABEL = { active: '上架', archived: '已下架', draft: '草稿', sold_out: '售罄' }

function buildCatalogContext(products) {
  if (!products.length) return '（当前无任何商品）'
  return products
    .map((p) => {
      const st = STATUS_LABEL[p.status] || p.status
      const price = parseFloat(p.price) > 0 ? `¥${p.price}` : '面议'
      return `#${p.id} | ${st} | ${p.name} | ${p.category || '未分类'} | ${price}`
    })
    .join('\n')
}

function parseAiJson(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const text = jsonMatch ? jsonMatch[0] : raw
  return JSON.parse(text)
}

/**
 * @param {string} instruction 管理员自然语言指令
 * @returns {Promise<{ reply: string, executed: object[], triggerAutoGenerate?: boolean }>}
 */
export async function executeMallAiCommand(instruction) {
  if (!instruction?.trim()) {
    return { reply: '请输入指令', executed: [] }
  }

  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    return { reply: 'AI 服务未配置，请先在系统设置中配置模型', executed: [] }
  }

  const products = await getProducts({ limit: 150 })
  const catalog = buildCatalogContext(products)

  const systemPrompt = `你是商户申诉平台「商城管理」助手。管理员用自然语言管理商品，每个商品有唯一数字 ID（见目录中的 #id）。

## 当前商品目录（id | 状态 | 名称 | 分类 | 价格）
${catalog}

## 状态说明
- active = 上架（前台可见）
- archived = 下架
- draft = 草稿

## 输出格式（仅 JSON，无其它文字）
{
  "reply": "给管理员的中文回复，说明将要做什么",
  "actions": [
    { "type": "set_status", "productIds": [1, 2], "status": "active" },
    { "type": "set_status", "productIds": [3], "status": "archived" },
    {
      "type": "create_product",
      "product": {
        "name": "商品名",
        "category": "申诉服务",
        "price": 99,
        "originalPrice": 199,
        "description": "描述",
        "tags": ["标签"],
        "targetAudience": ["商户"],
        "status": "draft"
      }
    },
    { "type": "trigger_auto_generate" }
  ]
}

## 规则
1. productIds 必须来自目录中存在的 id；按用户描述匹配名称或「全部草稿」「全部上架」等。
2. 「上架」→ status active；「下架」→ archived；「恢复草稿」→ draft。
3. 用户描述新商品且要立刻创建 → create_product（默认 draft，用户明确上架则用 active）。
4. 用户说「自动分析对话生成商品」「AI自动生成」「根据对话生成」等 → trigger_auto_generate（不要同时 create_product）。
5. 可组合多个 set_status；create_product 可多条。
6. 无法执行时 actions 为空，在 reply 说明原因。`

  const aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction.trim() },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '')
    return { reply: `AI 调用失败: ${aiRes.status} ${errText.slice(0, 120)}`, executed: [] }
  }

  const data = await aiRes.json()
  const raw = data.choices?.[0]?.message?.content || ''

  let plan
  try {
    plan = parseAiJson(raw)
  } catch {
    return { reply: 'AI 返回格式无法解析，请换种说法重试', executed: [], raw: raw.slice(0, 500) }
  }

  const executed = []
  let triggerAutoGenerate = false
  const actions = Array.isArray(plan.actions) ? plan.actions : []

  for (const action of actions) {
    if (action.type === 'trigger_auto_generate') {
      triggerAutoGenerate = true
      executed.push({ type: 'trigger_auto_generate', ok: true, message: '将启动「AI 自动生成商品」任务' })
      continue
    }

    if (action.type === 'set_status') {
      const ids = (action.productIds || []).map((id) => parseInt(id, 10)).filter((n) => n > 0)
      const status = action.status
      if (!ids.length || !status) {
        executed.push({ type: 'set_status', ok: false, message: '缺少商品 ID 或状态' })
        continue
      }
      try {
        const { updated } = await batchUpdateProductsStatus(ids, status)
        executed.push({
          type: 'set_status',
          ok: updated > 0,
          message: `已更新 ${updated} 个商品为「${STATUS_LABEL[status] || status}」`,
          productIds: ids,
          status,
        })
      } catch (e) {
        executed.push({ type: 'set_status', ok: false, message: e.message })
      }
      continue
    }

    if (action.type === 'create_product') {
      const p = action.product || {}
      if (!p.name?.trim()) {
        executed.push({ type: 'create_product', ok: false, message: '缺少商品名称' })
        continue
      }
      try {
        const allowedStatus = ['active', 'draft', 'archived', 'sold_out']
        const st = allowedStatus.includes(p.status) ? p.status : 'draft'
        const result = await createProduct({
          name: p.name.trim(),
          category: p.category || '申诉服务',
          price: Number(p.price) || 0,
          originalPrice: Number(p.originalPrice) || 0,
          description: p.description || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          targetAudience: Array.isArray(p.targetAudience) ? p.targetAudience : [],
          status: st,
        })
        const row = await getProductById(result.id)
        executed.push({
          type: 'create_product',
          ok: true,
          message: `已创建商品 #${result.id}「${p.name}」（${STATUS_LABEL[st]}）`,
          productId: result.id,
          product: row,
        })
      } catch (e) {
        executed.push({ type: 'create_product', ok: false, message: e.message })
      }
      continue
    }

    executed.push({ type: action.type || 'unknown', ok: false, message: '未知操作类型' })
  }

  if (executed.some((e) => e.ok && (e.type === 'set_status' || e.type === 'create_product'))) {
    invalidateProductCache()
  }

  return {
    reply: plan.reply || '指令已处理',
    executed,
    triggerAutoGenerate,
  }
}
