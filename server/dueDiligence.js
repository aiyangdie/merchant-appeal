import { getChannelMaterials, ONLINE_CHANNEL_DEFS } from './onlineChannels.js'

export function isDueDiligenceScenario(data = {}) {
  const pt = String(data.problem_type || '')
  const vr = String(data.violation_reason || '')
  const st = String(data.scenario_type || '')
  return st === 'due_diligence'
    || /尽职调查|尽调/.test(pt)
    || /尽职调查|尽调/.test(vr)
}

/** 智能识别微信支付商户号（10位，以1开头） */
export function parseMerchantId(text) {
  if (!text) return null
  const t = String(text)

  // 排除手机号干扰
  const noPhone = t.replace(/1[3-9]\d{9}/g, ' ')

  // 商户号：1114096895
  const inline = t.match(/商户号[：:是为]?\s*(1\d{9})/)
  if (inline) return inline[1]

  // 通知粘贴常见：商户号:\n（空）\n1114096895
  const multiline = t.match(/商户号[：:]\s*\n+\s*(1\d{9})\b/)
  if (multiline) return multiline[1]

  // 在「商户号」关键词后 120 字符内找
  const sectionIdx = t.search(/商户号/)
  if (sectionIdx >= 0) {
    const section = t.slice(sectionIdx, sectionIdx + 120)
    const inSection = section.match(/(?<![\d])1\d{9}(?![\d])/g)
    if (inSection?.length === 1) return inSection[0]
    if (inSection?.length > 1) {
      const afterLabel = section.replace(/商户号[：:]\s*/, '').match(/(?<![\d])1\d{9}(?![\d])/)
      if (afterLabel) return afterLabel[0]
    }
  }

  // 全文候选：1开头的10位数字，排除嵌入在微信订单号中
  const candidates = []
  const regex = /(?<![\d])1\d{9}(?![\d])/g
  let m
  while ((m = regex.exec(noPhone)) !== null) {
    const id = m[0]
    const idx = t.indexOf(id)
    const before = t.slice(Math.max(0, idx - 8), idx)
    if (/420000\d*$/.test(before)) continue
    candidates.push(id)
  }

  const unique = [...new Set(candidates)]
  if (unique.length === 1) return unique[0]

  // 多个候选：优先出现在通知/商户名称附近的
  if (/商户名称|尽职调查|商户号/.test(t) && unique.length > 0) {
    for (const id of unique) {
      const idx = t.indexOf(id)
      const ctx = t.slice(Math.max(0, idx - 40), idx + 50)
      if (/商户号|商户名称|尽职调查/.test(ctx)) return id
    }
    return unique[0]
  }

  return null
}

/** 从用户粘贴的通知/对话文本中解析尽调关键信息 */
export function parseNotificationText(text) {
  if (!text) return {}
  const out = {}
  const nameMatch = text.match(/商户名称[：:]\s*([^\n商户号]+)/)
  if (nameMatch) out.merchant_name = nameMatch[1].trim()
  const companyMatch = text.match(/公司名称[：:]\s*([^\n商户]+)/)
  if (companyMatch) out.company_name = companyMatch[1].trim()

  const merchantId = parseMerchantId(text)
  if (merchantId) out.merchant_id = merchantId

  const deadlineMatch = text.match(/截止时间[：:]\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/)
    || text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
  if (deadlineMatch) out.dd_deadline = deadlineMatch[1].trim()

  if (/尽职调查/.test(text)) {
    out.problem_type = '商户尽职调查通知'
    out.violation_reason = '商户尽职调查'
    out.scenario_type = 'due_diligence'
  }
  return out
}

/** 从文本提取微信支付交易单号及商品名称 */
export function parseWechatOrders(text) {
  if (!text) return []
  const map = new Map()

  const add = (orderNo, goodsName = '') => {
    if (!orderNo) return
    const goods = String(goodsName || '').trim()
    const prev = map.get(orderNo)
    if (!prev) {
      map.set(orderNo, { orderNo, goodsName: goods })
    } else if (!prev.goodsName && goods) {
      map.set(orderNo, { orderNo, goodsName: goods })
    }
  }

  // 格式1：微信交易订单号：XXX / 订单商品/服务内容：YYY（最常见）
  const fullLineRegex = /微信交易订单号[：:]\s*(420000\d{22,26})\s*[\/／]?\s*订单商品[\/／]服务内容[：:]\s*([^\n]+)/gi
  let m
  while ((m = fullLineRegex.exec(text)) !== null) {
    add(m[1], m[2])
  }

  // 格式2：420000... - 商品名  或  420000... / 商品名
  const dashRegex = /(420000\d{22,26})\s*[-–—\/／]\s*([^/\n][^\n]*)/g
  while ((m = dashRegex.exec(text)) !== null) {
    let goods = m[2].trim().replace(/^订单商品[\/／]服务内容[：:]\s*/, '')
    if (goods && !/^420000/.test(goods)) add(m[1], goods)
  }

  // 格式3：【订单N】块
  const orderBlockRegex = /【订单\s*\d+】[\s\S]*?商品名称[：:]\s*([^\n]+)[\s\S]*?微信交易单号[：:]\s*(420000\d{22,26})/g
  while ((m = orderBlockRegex.exec(text)) !== null) {
    add(m[2], m[1])
  }

  // 格式4：仅有单号（最后补充）
  const bareRegex = /420000\d{22,26}/g
  const bareMatches = text.match(bareRegex) || []
  for (const orderNo of bareMatches) add(orderNo, '')

  return [...map.values()]
}

export function mergeOrderLists(existing = [], incoming = []) {
  const map = new Map()
  for (const o of existing) {
    if (!o?.orderNo) continue
    map.set(o.orderNo, { orderNo: o.orderNo, goodsName: o.goodsName || o.goods || '' })
  }
  for (const o of incoming) {
    if (!o?.orderNo) continue
    const prev = map.get(o.orderNo) || {}
    map.set(o.orderNo, {
      orderNo: o.orderNo,
      goodsName: (o.goodsName || o.goods || prev.goodsName || '').trim(),
    })
  }
  return [...map.values()]
}

/** 从 collected_data 读取结构化订单列表 */
export function getStoredOrders(data = {}) {
  if (data.wechat_orders) {
    try {
      const parsed = typeof data.wechat_orders === 'string' ? JSON.parse(data.wechat_orders) : data.wechat_orders
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(o => ({
          orderNo: o.orderNo,
          goodsName: o.goodsName || o.goods || '',
        }))
      }
    } catch { /* fall through */ }
  }
  return parseWechatOrders(data.order_info || '')
}

/** 格式化为分行展示（商品名称 + 微信交易单号） */
export function formatOrderInfo(orders) {
  if (!orders?.length) return ''
  return orders.map((o, i) => {
    const goods = o.goodsName || o.goods || '（待补充商品名称）'
    return `【订单${i + 1}】\n商品名称：${goods}\n微信交易单号：${o.orderNo}`
  }).join('\n\n')
}

/** 单笔订单复制文本 */
export function formatSingleOrder(o, index = 0) {
  const goods = o.goodsName || o.goods || '（待补充商品名称）'
  return `商品名称：${goods}\n微信交易单号：${o.orderNo}`
}

/** 规则提取：在 AI 提取之外补充订单号、商户号、尽调通知字段 */
export function applyMessageExtractions(userMessage, collectedData = {}) {
  const patches = {}
  const notif = parseNotificationText(userMessage)
  Object.assign(patches, notif)

  const incoming = parseWechatOrders(userMessage)
  if (incoming.length > 0) {
    const existing = getStoredOrders(collectedData)
    const merged = mergeOrderLists(existing, incoming)
    patches.wechat_orders = JSON.stringify(merged)
    patches.order_info = formatOrderInfo(merged)
  }

  if (!patches.merchant_id) {
    const id = parseMerchantId(userMessage)
    if (id) patches.merchant_id = id
  }

  if (patches.merchant_id) {
    const clean = String(patches.merchant_id).replace(/\D/g, '')
    if (/^1\d{9}$/.test(clean)) patches.merchant_id = clean
    else if (clean.length >= 10) {
      const ten = clean.match(/1\d{9}/)
      if (ten) patches.merchant_id = ten[0]
      else patches.merchant_id = null
    } else {
      patches.merchant_id = null
    }
  }

  if (isDueDiligenceScenario({ ...collectedData, ...patches }) && !patches.scenario_type) {
    patches.scenario_type = 'due_diligence'
  }

  return patches
}

/** 尽调场景必填字段 */
export function getDDRequiredKeys() {
  return [
    'merchant_id', 'merchant_name', 'company_name', 'industry', 'business_model',
    'channel', 'content_delivery_method', 'order_info',
  ]
}

export function assessDDCompleteness(data = {}) {
  const required = getDDRequiredKeys()
  const filled = required.filter(k => data[k] && String(data[k]).trim())
  const missing = required.filter(k => !data[k] || !String(data[k]).trim())
  const score = Math.round((filled.length / required.length) * 100)
  const orders = getStoredOrders(data)
  const hasValidOrders = orders.length >= 2
  const validMerchantId = data.merchant_id && /^1\d{9}$/.test(String(data.merchant_id))
  const ready = score >= 75 && filled.length >= 6 && hasValidOrders && validMerchantId
  return { score, ready, missing, filled: filled.length, total: required.length, orders }
}

/** 填写入口步骤（对应微信通知卡片点击后） */
export function getDDEntrySteps() {
  return [
    {
      id: 'open_notice',
      title: '点击微信服务通知',
      detail: '在微信「服务通知」中找到「商户尽职调查通知」卡片，点击底部「微信支付商户尽职调查」小程序链接。',
      icon: '📱',
    },
    {
      id: 'open_assistant',
      title: '进入商家助手',
      detail: '也可直接打开「微信支付商家助手」小程序 → 底部「风险处理」或「业务受限处理」。',
      icon: '🔔',
    },
    {
      id: 'find_task',
      title: '找到待办尽调单',
      detail: '在待处理事项中找到本次尽职调查任务，查看需要填写的资料项列表。',
      icon: '📋',
    },
    {
      id: 'fill_form',
      title: '按项填写并上传',
      detail: '小程序表单中每笔订单需分别填写「商品名称」和「微信交易单号」，下方订单卡片可逐项复制。',
      icon: '✍️',
    },
    {
      id: 'submit',
      title: '核对后提交',
      detail: '确认商户号、有效期、订单号与系统记录一致后再提交。提交后状态变为「审核中」，一般 3-5 个工作日。',
      icon: '✅',
    },
  ]
}

/** 生成标准格式填写内容（平台类型+商家名称+售卖商品/服务） */
export function buildDDStandardLine(data = {}) {
  const channel = data.channel || data.business_model || '线上平台'
  const name = data.merchant_name || data.company_name || '（商家名称）'
  const product = data.content_delivery_method || data.service_scope_details || data.industry || '（商品/服务）'
  let platform = '线上平台'
  if (/纷传|小程序/.test(channel)) platform = '微信小程序'
  else if (/知识星球/.test(channel)) platform = '知识星球平台'
  else if (/公众号/.test(channel)) platform = '微信公众号'
  return `${platform}+${name}+${product}`
}

/** 200 字经营说明 */
export function buildDDShortStatement(data = {}) {
  const company = data.company_name || data.merchant_name || '本公司'
  const product = data.content_delivery_method || '付费线上社群服务'
  const channel = data.channel ? `，主要通过${data.channel}` : ''
  const pricing = data.refund_trigger_condition?.includes('1500') ? '1500元及2500元两档一次性付费' : '一次性付费'
  return `${company}为合法注册企业，主营知识付费与社群运营${channel}。用户${pricing}获取长期社群准入权限，享受读书会、婚姻育儿、职业成长及日常互动等数字内容服务，无重复扣费、无分销返利。资金全额结算至公司对公账户，用于社群运营与人力成本。所有交易均为真实用户自愿消费，已留存支付凭证与服务交付记录，承诺合规经营。`
}

/** 完整经营业务描述 */
export function buildDDFullStatement(data = {}) {
  const company = data.company_name || data.merchant_name || '本公司'
  const channel = data.channel || '线上平台'
  const orders = getStoredOrders(data)
  const orderBlock = orders.length
    ? `\n\n【典型交易示例】\n${formatOrderInfo(orders)}`
    : (data.order_info ? `\n\n【典型交易示例】\n${data.order_info}` : '')
  return `一、平台类型与商家名称
本平台为线上知识付费社群服务平台，商家名称为：${company}。

二、售卖商品/服务内容
${data.content_delivery_method || data.service_scope_details || '付费线上社群服务，提供专栏内容与互动答疑。'}

三、收费与交付
采用一次性付费模式，无自动续费、无分销层级。用户付费后获得社群准入及数字内容服务，通过${channel}完成下单与权益发放。

四、资金用途
全部资金结算至公司对公账户，用于社群运营、平台服务费、人力成本及日常办公。

五、合规承诺
不存在虚假交易、套现、传销式分销或非法集资；所有交易均有真实用户消费记录与服务交付凭证。${orderBlock}`
}

export function buildDDGuide(data = {}) {
  const completeness = assessDDCompleteness(data)
  const orders = getStoredOrders(data)
  const deadline = data.dd_deadline
  let deadlineWarning = null
  if (deadline) {
    const dl = new Date(deadline.replace(' ', 'T'))
    const hoursLeft = (dl - Date.now()) / 3600000
    if (hoursLeft < 48) deadlineWarning = `⚠️ 距离截止时间不足 48 小时，请尽快提交`
    else if (hoursLeft < 0) deadlineWarning = `❌ 已过截止时间，请立即登录商家助手查看是否可补交`
  }

  const orderList = orders.map((o, i) => ({
    index: i + 1,
    goodsName: o.goodsName || '（待补充商品名称）',
    orderNo: o.orderNo,
    copyText: formatSingleOrder(o, i),
  }))

  const channelMaterials = getChannelMaterials(data._online_channels || [])
  const baseMaterials = [
    { id: 'license', label: '营业执照彩色照片（四角清晰）', required: true },
    { id: 'legal_id', label: '法人身份证正反面', required: true },
    { id: 'legal_hold', label: '法人手持身份证+营业执照合影', required: false },
  ]
  const channelMatItems = channelMaterials.map((m, i) => ({
    id: `ch_mat_${i}`,
    label: m.label,
    required: true,
    channel: m.channel,
  }))
  const materials_checklist = [
    ...baseMaterials,
    ...(channelMatItems.length ? channelMatItems : [
      { id: 'platform_screenshot', label: '线上经营页面截图（小程序/公众号/网站等）', required: true },
    ]),
    { id: 'delivery_proof', label: '用户入群/服务开通截图', required: true },
    { id: 'order_screenshot', label: '微信支付交易账单截图（2-3笔）', required: true },
    { id: 'service_agreement', label: '用户服务协议/社群公约截图', required: false },
  ]

  return {
    scenario: 'due_diligence',
    entry_steps: getDDEntrySteps(),
    orders: orderList,
    standard_line: buildDDStandardLine(data),
    short_statement: buildDDShortStatement(data),
    full_statement: buildDDFullStatement(data),
    fund_source_options: ['自有资金', '经营性收入'],
    fund_purpose_options: ['日常经营收款', '社群运营支出', '人力成本', '平台服务费'],
    materials_checklist,
    form_fields: [
      { key: 'platform_merchant_product', label: '平台类型+商家名称+售卖商品/服务', value: buildDDStandardLine(data), copyable: true },
      { key: 'business_desc_200', label: '经营说明（约200字）', value: buildDDShortStatement(data), copyable: true },
      { key: 'business_desc_full', label: '完整经营业务描述', value: buildDDFullStatement(data), copyable: true },
      { key: 'fund_source', label: '资金来源（勾选）', value: '自有资金 / 经营性收入', copyable: false },
      { key: 'fund_purpose', label: '资金用途（勾选）', value: '日常经营收款', copyable: false },
    ],
    reject_tips: [
      '证照有效期必须与影印件一致，无结束日期填「长期」',
      '图片需实拍，禁止翻拍屏幕或 PS',
      '每笔订单需分别填写商品名称和微信交易单号，不可混写',
      '订单号必须是微信商户平台能查到的真实交易号（420000开头）',
      '经营描述避免使用「分销、裂变、拉人头、私域变现」等敏感词',
    ],
    completeness,
    deadline: deadline || null,
    deadline_warning: deadlineWarning,
    merchant_id: data.merchant_id || null,
    merchant_name: data.merchant_name || data.company_name || null,
    order_info_summary: formatOrderInfo(orders) || null,
    online_channels: (data._online_channels || []).map(id => ({
      id,
      label: ONLINE_CHANNEL_DEFS[id]?.label || id,
      icon: ONLINE_CHANNEL_DEFS[id]?.icon || '📱',
    })),
  }
}
