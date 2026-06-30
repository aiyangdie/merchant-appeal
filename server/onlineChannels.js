/**
 * 线上经营渠道识别 + 动态字段扩展
 * 根据对话内容自动识别公众号/小程序/网站等，只收集相关字段
 */

/** 线上渠道定义：关键词 → 专属采集字段 */
export const ONLINE_CHANNEL_DEFS = {
  miniprogram: {
    id: 'miniprogram',
    label: '微信小程序',
    icon: '📱',
    group: '微信小程序',
    keywords: [/微信小程序/, /微信.*小程序/, /小程序商城/, /小程序店铺/],
    weakKeywords: [/小程序(?!开发)/, /wx小程序/i],
    fields: [
      { key: 'miniprogram_name', label: '小程序名称', icon: '📱',
        question: '微信小程序叫什么名字？在公众平台或商家助手能看到~',
        why: '审核会核对小程序与商户主体关系。' },
      { key: 'miniprogram_appid', label: '小程序AppID', icon: '🔑',
        question: '小程序AppID是多少？wx开头16位，在 mp.weixin.qq.com → 设置 → 基本设置 查看，不知道可跳过~',
        why: '申诉/尽调表单常需填写，审核会核实。' },
    ],
  },
  official_account: {
    id: 'official_account',
    label: '微信公众号',
    icon: '💬',
    group: '微信公众号',
    keywords: [/微信公众号/, /公众号(?!助手|通知)/, /订阅号/, /服务号/, /企业号/],
    fields: [
      { key: 'oa_name', label: '公众号名称', icon: '💬',
        question: '公众号叫什么名字？（订阅号或服务号）',
        why: '证明线上经营场景，审核会搜索核验。' },
      { key: 'oa_id', label: '公众号原始ID/微信号', icon: '🔑',
        question: '公众号原始ID或微信号是什么？公众平台→设置→基本设置，不知道可跳过~',
        why: '用于核验公众号归属。' },
    ],
  },
  website: {
    id: 'website',
    label: '网站/H5',
    icon: '🌐',
    group: '网站/H5',
    keywords: [/官方网站/, /官网/, /H5页面/, /PC网站/, /独立站/, /企业网站/],
    weakKeywords: [/网站(?!站)/, /网页/, /域名/, /\.com\b/i, /\.cn\b/i, /https?:\/\//],
    fields: [
      { key: 'website_name', label: '网站名称', icon: '🌐',
        question: '网站/官网叫什么名字？',
        why: '线上经营场景证明。' },
      { key: 'website_url', label: '网站地址', icon: '🔗',
        question: '网站域名或访问链接？如 https://www.example.com',
        why: '审核可能访问查验。' },
      { key: 'website_icp', label: 'ICP备案号', icon: '📋',
        question: '网站ICP备案号？在网站底部或备案系统查看，没有可跳过~',
        why: '国内网站经营通常需备案。' },
    ],
  },
  app: {
    id: 'app',
    label: 'APP应用',
    icon: '📲',
    group: 'APP应用',
    keywords: [/手机APP/, /移动应用/, /安卓APP/, /iOS应用/, /应用商店/],
    weakKeywords: [/\bAPP\b/i, /应用(?!服务)/],
    fields: [
      { key: 'app_name', label: 'APP名称', icon: '📲',
        question: 'APP叫什么名字？',
        why: '证明APP经营场景。' },
      { key: 'app_platform', label: '上架平台', icon: '🏪',
        question: 'APP在哪些平台上架？如苹果App Store、华为应用市场、小米等',
        why: '审核会核对应用信息。' },
    ],
  },
  zhishixingqiu: {
    id: 'zhishixingqiu',
    label: '知识星球',
    icon: '⭐',
    group: '知识星球',
    keywords: [/知识星球/],
    fields: [
      { key: 'zhishixingqiu_name', label: '星球名称', icon: '⭐',
        question: '知识星球圈子叫什么名字？',
        why: '证明第三方平台经营场景。' },
      { key: 'zhishixingqiu_link', label: '星球链接/ID', icon: '🔗',
        question: '知识星球圈子链接或星球号，不知道可跳过~',
        why: '审核核验用。' },
    ],
  },
  fenchuan: {
    id: 'fenchuan',
    label: '纷传',
    icon: '📦',
    group: '纷传平台',
    keywords: [/纷传/],
    fields: [
      { key: 'fenchuan_name', label: '纷传圈子名称', icon: '📦',
        question: '纷传圈子/社群叫什么名字？',
        why: '证明纷传平台经营场景。' },
      { key: 'fenchuan_link', label: '纷传链接', icon: '🔗',
        question: '纷传圈子链接或分享页地址，不知道可跳过~',
        why: '审核核验用。' },
    ],
  },
  douyin: {
    id: 'douyin',
    label: '抖音/抖店',
    icon: '🎵',
    group: '抖音/抖店',
    keywords: [/抖音小店/, /抖店/, /抖音店铺/, /抖音电商/],
    weakKeywords: [/抖音(?!支付)/],
    fields: [
      { key: 'douyin_shop_name', label: '抖音店铺/账号名', icon: '🎵',
        question: '抖音店铺名称或抖音号叫什么？',
        why: '证明抖音渠道经营。' },
      { key: 'douyin_account_id', label: '抖音号/店铺ID', icon: '🔑',
        question: '抖音号或抖店ID，不知道可跳过~',
        why: '核验店铺信息。' },
    ],
  },
  kuaishou: {
    id: 'kuaishou',
    label: '快手',
    icon: '📹',
    group: '快手小店',
    keywords: [/快手小店/, /快手店铺/, /快手电商/],
    weakKeywords: [/快手(?!手)/],
    fields: [
      { key: 'kuaishou_shop_name', label: '快手店铺/账号名', icon: '📹',
        question: '快手小店名称或快手号叫什么？',
        why: '证明快手渠道经营。' },
    ],
  },
  taobao: {
    id: 'taobao',
    label: '淘宝/天猫',
    icon: '🛒',
    group: '淘宝/天猫',
    keywords: [/淘宝店铺/, /天猫店铺/, /千牛/, /淘宝网店/],
    weakKeywords: [/淘宝(?!宝)/, /天猫/],
    fields: [
      { key: 'taobao_shop_name', label: '店铺名称', icon: '🛒',
        question: '淘宝/天猫店铺叫什么名字？',
        why: '证明电商平台经营。' },
      { key: 'taobao_shop_url', label: '店铺链接', icon: '🔗',
        question: '店铺链接或旺旺名，不知道可跳过~',
        why: '审核核验用。' },
    ],
  },
  pdd: {
    id: 'pdd',
    label: '拼多多',
    icon: '🛍️',
    group: '拼多多',
    keywords: [/拼多多店铺/, /拼多多网店/],
    weakKeywords: [/拼多多/],
    fields: [
      { key: 'pdd_shop_name', label: '拼多多店铺名', icon: '🛍️',
        question: '拼多多店铺叫什么名字？',
        why: '证明拼多多渠道经营。' },
    ],
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    label: '小红书',
    icon: '📕',
    group: '小红书',
    keywords: [/小红书店铺/, /小红书商城/],
    weakKeywords: [/小红书/, /红薯/],
    fields: [
      { key: 'xhs_account_name', label: '小红书账号/店铺名', icon: '📕',
        question: '小红书账号或店铺叫什么名字？',
        why: '证明小红书渠道经营。' },
    ],
  },
  channels: {
    id: 'channels',
    label: '微信视频号',
    icon: '📺',
    group: '微信视频号',
    keywords: [/微信视频号/, /视频号直播/, /视频号小店/],
    weakKeywords: [/视频号/],
    fields: [
      { key: 'channels_name', label: '视频号名称', icon: '📺',
        question: '微信视频号叫什么名字？',
        why: '证明视频号经营场景。' },
    ],
  },
  meituan: {
    id: 'meituan',
    label: '美团',
    icon: '🍜',
    group: '美团',
    keywords: [/美团店铺/, /美团外卖/, /大众点评店铺/],
    weakKeywords: [/美团/, /大众点评/],
    fields: [
      { key: 'meituan_shop_name', label: '美团店铺名', icon: '🍜',
        question: '美团/大众点评店铺叫什么名字？',
        why: '证明本地生活平台经营。' },
    ],
  },
}

/** 静态 INFO_FIELDS 中已由渠道字段替代的 key（不再默认追问） */
export const CHANNEL_REPLACED_STATIC_KEYS = new Set([
  'miniprogram_name', 'miniprogram_appid',
])

/** 从文本和已收集数据识别线上渠道 */
export function detectOnlineChannels(text, collectedData = {}) {
  const corpus = [
    text || '',
    collectedData.channel || '',
    collectedData.business_model || '',
    collectedData.business_scenario || '',
    collectedData.industry || '',
    collectedData.content_delivery_method || '',
  ].join('\n')

  const detected = new Set(collectedData._online_channels || [])

  for (const def of Object.values(ONLINE_CHANNEL_DEFS)) {
    const strong = def.keywords?.some(r => r.test(corpus))
    const weak = def.weakKeywords?.some(r => r.test(corpus))
    if (strong || weak) detected.add(def.id)
  }

  // 纯线上但未指明渠道 → 先问经营渠道汇总
  if (detected.size === 0 && /纯线上|线上经营|网上卖|网店|线上平台/.test(corpus)) {
    if (!collectedData.online_channels_summary) {
      // 不自动加渠道，等用户说明
    }
  }

  return [...detected]
}

/** 获取已识别渠道的全部字段定义 */
export function getChannelFieldDefs(channelIds = []) {
  const fields = []
  const seen = new Set()
  for (const id of channelIds) {
    const def = ONLINE_CHANNEL_DEFS[id]
    if (!def) continue
    for (const f of def.fields) {
      if (seen.has(f.key)) continue
      seen.add(f.key)
      fields.push({
        ...f,
        group: def.group,
        icon: f.icon || def.icon,
        channel: id,
        channelLabel: def.label,
        dynamic: true,
      })
    }
  }
  return fields
}

/** 合并渠道字段到 session，返回新增项 */
export function expandOnlineChannels(collectedData = {}, userMessage = '') {
  const detected = detectOnlineChannels(userMessage, collectedData)
  const prevChannels = collectedData._online_channels || []
  const mergedChannels = [...new Set([...prevChannels, ...detected])]

  const allChannelFields = getChannelFieldDefs(mergedChannels)
  const prevFieldKeys = new Set((collectedData._channel_fields || []).map(f => f.key))
  const newFields = allChannelFields.filter(f => !prevFieldKeys.has(f.key))

  const channelLabels = mergedChannels.map(id => ONLINE_CHANNEL_DEFS[id]?.label || id)

  return {
    channels: mergedChannels,
    channelLabels,
    allChannelFields,
    newChannels: mergedChannels.filter(c => !prevChannels.includes(c)),
    newFields,
    channelTip: channelLabels.length
      ? `已识别线上渠道：${channelLabels.join('、')}。请重点收集对应平台信息，不要追问未提及的渠道。`
      : null,
  }
}

/** 从消息中提取渠道专属字段 */
export function extractChannelFieldsFromMessage(text, existingData = {}) {
  if (!text) return {}
  const out = {}
  const t = text.trim().replace(/[`'']/g, '')

  const oaAppid = t.match(/公众号[\s\S]{0,60}?(wx[a-z0-9]{16})/i)
  const mpAppid = t.match(/微信小程序[\s\S]{0,60}?(wx[a-z0-9]{16})/i)
  if (oaAppid && !existingData.oa_id) out.oa_id = oaAppid[1]
  if (mpAppid && !existingData.miniprogram_appid) out.miniprogram_appid = mpAppid[1]

  const allAppids = [...t.matchAll(/\b(wx[a-z0-9]{16})\b/gi)].map(m => m[1])
  if (allAppids.length === 1) {
    if (/公众号/.test(t) && !existingData.oa_id && !out.oa_id) out.oa_id = allAppids[0]
    else if (/小程序/.test(t) && !existingData.miniprogram_appid && !out.miniprogram_appid) out.miniprogram_appid = allAppids[0]
  } else if (allAppids.length >= 2 && /公众号/.test(t) && /小程序/.test(t)) {
    const oaPos = t.search(/公众号/)
    const mpPos = t.search(/微信小程序|小程序/)
    for (const id of allAppids) {
      const pos = t.indexOf(id)
      if (oaPos >= 0 && pos >= oaPos && (mpPos < 0 || pos < mpPos) && !existingData.oa_id && !out.oa_id) out.oa_id = id
      if (mpPos >= 0 && pos >= mpPos && !existingData.miniprogram_appid && !out.miniprogram_appid) out.miniprogram_appid = id
    }
  }

  const urlMatch = t.match(/https?:\/\/[^\s,，。]+/i)
  if (urlMatch && !existingData.website_url) out.website_url = urlMatch[0]

  const icpMatch = t.match(/ICP备[^\s,，。]+/i) || t.match(/\b\d{8,}号?-\d+/)
  if (icpMatch && !existingData.website_icp) out.website_icp = icpMatch[0]

  const oaNamed = t.match(/公众号[叫名为：:]\s*([^\n,，。]{2,30})/)
  if (oaNamed && !existingData.oa_name) out.oa_name = oaNamed[1].trim()

  const mpNamed = t.match(/小程序[叫名为：:]\s*([^\n,，。]{2,30})/)
  if (mpNamed && !existingData.miniprogram_name) out.miniprogram_name = mpNamed[1].trim()

  return out
}

/** 构建渠道材料清单（尽调/申诉用） */
export function getChannelMaterials(channelIds = []) {
  const items = []
  for (const id of channelIds) {
    const def = ONLINE_CHANNEL_DEFS[id]
    if (!def) continue
    switch (id) {
      case 'miniprogram':
        items.push({ label: '微信小程序页面截图（首页+商品/服务页）', channel: def.label })
        break
      case 'official_account':
        items.push({ label: '公众号主页截图+近期文章/菜单页', channel: def.label })
        break
      case 'website':
        items.push({ label: '网站首页截图+ICP备案截图', channel: def.label })
        break
      case 'app':
        items.push({ label: 'APP应用商店详情页截图', channel: def.label })
        break
      case 'zhishixingqiu':
        items.push({ label: '知识星球圈子页面截图', channel: def.label })
        break
      case 'fenchuan':
        items.push({ label: '纷传圈子页面截图', channel: def.label })
        break
      default:
        items.push({ label: `${def.label}经营页面截图`, channel: def.label })
    }
  }
  return items
}

export function listOnlineChannelOptions() {
  return Object.values(ONLINE_CHANNEL_DEFS).map(d => ({ id: d.id, label: d.label, icon: d.icon }))
}
