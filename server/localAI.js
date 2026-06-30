// ========== 本地规则引擎：信息收集 + 智能答疑（不消耗 AI Token） ==========

import { BUILT_IN_CASES, VIOLATION_KNOWLEDGE, matchViolation, matchBuiltInCases, assessRisk, generateMaterialChecklist } from './knowledgeBase.js'
import { isDueDiligenceScenario, parseMerchantId, parseWechatOrders, mergeOrderLists, getStoredOrders, formatOrderInfo, getDDRequiredKeys, assessDDCompleteness } from './dueDiligence.js'
import {
  CHANNEL_REPLACED_STATIC_KEYS,
  getChannelFieldDefs,
  expandOnlineChannels,
  extractChannelFieldsFromMessage,
  detectOnlineChannels,
} from './onlineChannels.js'

// 信息收集字段定义（顺序很重要：先了解业务 → 再了解问题 → 再收集详细信息）
const INFO_FIELDS = [
  // ===== 第一阶段：了解客户业务 =====
  { key: 'industry', label: '业务类型', group: '业务了解', icon: '💼',
    question: '您是做什么行业的？比如餐饮、电商、游戏、教育等，随便说就行~',
    why: '不同行业申诉策略完全不同。' },
  { key: 'business_model', label: '经营模式', group: '业务了解', icon: '💼',
    question: '您主要在哪做生意？\n① 线上（小程序/公众号/网店）\n② 线下实体店\n③ 都有',
    why: '线上线下需要的申诉材料不一样。' },

  // ===== 第二阶段：了解遇到的问题 =====
  { key: 'problem_type', label: '处罚类型', group: '问题信息', icon: '⚠️',
    question: '商户号现在是什么情况？\n① 付款被拦截\n② 收款限额\n③ 不能收款了\n④ 资金冻结\n⑤ 商户号被封\n\n说编号或自己描述都行~',
    why: '不同处罚类型的申诉方案完全不同。' },
  { key: 'violation_reason', label: '违规原因', group: '问题信息', icon: '📋',
    question: '微信给的违规原因是什么？\n\n在「商家助手」→ 风险处理 → 功能限制记录 里能看到。不知道的话，把收到的通知内容告诉我也行~',
    why: '申诉材料要针对具体违规原因来写，这是核心。' },

  // ===== 第三阶段：商户基本信息 =====
  { key: 'merchant_id', label: '商户号', group: '商户号信息', icon: '🏪',
    question: '商户号是多少？10位数字，在「商家助手」首页能看到~',
    why: '申诉必填项。' },
  { key: 'merchant_name', label: '商户名称', group: '商户号信息', icon: '🏪',
    question: '商户名称叫什么？就是注册微信支付时填的名字~',
    why: '审核会核对，必须和注册时一致。' },

  // ===== 第四阶段：企业和法人信息 =====
  { key: 'company_name', label: '公司全称', group: '企业信息', icon: '🏢',
    question: '营业执照上的公司全称是什么？个体户就写个体户名称~',
    why: '必须和营业执照完全一致。' },
  { key: 'license_no', label: '统一社会信用代码', group: '企业信息', icon: '🏢',
    question: '营业执照上的统一社会信用代码（18位），不知道可以说"跳过"~',
    why: '申诉时可能用到，非必填。' },
  { key: 'legal_name', label: '法人姓名', group: '法人信息', icon: '👤',
    question: '法人姓名是什么？',
    why: '审核需要确认申诉人身份。' },
  { key: 'legal_id_last4', label: '身份证后四位', group: '法人信息', icon: '👤',
    question: '法人身份证后4位？只要后4位，打95017催审时也要用~',
    why: '身份验证用，只收后4位。' },

  // ===== 第五阶段：经营场景信息（申诉表单必填） =====
  { key: 'business_scenario', label: '经营场景', group: '经营场景', icon: '🌐',
    question: '申诉表单要填经营场景：\n① 线上（小程序/公众号/网站/H5）\n② 线下（实体店）\n③ 都有',
    why: '申诉表单必填项。' },
  // 小程序/公众号/网站等专属字段 → 由 onlineChannels 根据对话动态生成

  // ===== 第六阶段：投诉与售后 =====
  { key: 'complaint_status', label: '投诉情况', group: '投诉与售后', icon: '📞',
    question: '有没有未处理的消费者投诉？有的话说下大概几个、什么原因。没有就说"没有"~',
    why: '投诉情况直接影响申诉成功率。' },
  { key: 'refund_policy', label: '退款政策', group: '投诉与售后', icon: '🔄',
    question: '您的退款政策是什么？比如几天内可退、怎么退。没有的话说"没有"，我帮您拟一个~',
    why: '申诉表单有"退款机制"栏，必须填写。' },

  // ===== 第七阶段：交易订单信息（申诉表单要求提供） =====
  { key: 'order_info', label: '交易订单', group: '交易订单', icon: '🧾',
    question: '提供2-3笔订单，格式如下：\n微信交易订单号：420000... / 订单商品/服务内容：商品名称\n\n也可直接粘贴账单截图文字，系统会自动识别商品名称和微信交易单号~',
    why: '尽调/申诉均需提供真实交易凭证，每笔订单分开展示。' },

  // ===== 第八阶段：结算和联系信息 =====
  { key: 'bank_name', label: '开户银行', group: '结算账户', icon: '🏦',
    question: '收款用的哪个银行？',
    why: '95017催审时需要提供。' },
  { key: 'bank_account_last4', label: '结算账户后四位', group: '结算账户', icon: '🏦',
    question: '银行卡号后4位？',
    why: '95017催审身份验证用。' },
  { key: 'contact_phone', label: '联系电话', group: '联系方式', icon: '📱',
    question: '留个手机号，审核可能会电话回访~',
    why: '接不到电话可能影响申诉结果。' },
  { key: 'appeal_history', label: '申诉历史', group: '申诉历史', icon: '📝',
    question: '之前申诉过吗？结果怎样？第一次就说"没有"~',
    why: '影响申诉策略选择。' },
]

const TOTAL_STEPS = INFO_FIELDS.length

/** 申诉场景下可跳过、不计入必收进度的字段 */
const APPEAL_OPTIONAL_KEYS = new Set([
  'license_no', 'legal_id_last4', 'bank_name', 'bank_account_last4', 'contact_phone', 'appeal_history',
])

/** 尽调场景不需要追问的申诉专用字段 */
const APPEAL_ONLY_KEYS = new Set([
  'business_scenario', 'complaint_status', 'refund_policy', 'bank_name', 'bank_account_last4',
  'contact_phone', 'appeal_history', 'license_no', 'legal_id_last4',
])

/** 渠道名称/链接类选填（有 AppID 即可） */
const CHANNEL_OPTIONAL_KEYS = new Set([
  'miniprogram_name', 'oa_name', 'fenchuan_name', 'fenchuan_link',
  'zhishixingqiu_name', 'zhishixingqiu_link', 'website_name', 'website_url', 'website_icp',
])

/** 通知解析自动带入，无需用户再填 */
const AUTO_FILLED_KEYS = new Set(['scenario_type', 'dd_deadline', 'violation_reason'])

export function isFieldOptionalForScenario(key, data = {}) {
  if (APPEAL_OPTIONAL_KEYS.has(key)) return true
  if (CHANNEL_OPTIONAL_KEYS.has(key)) return true
  if (isDueDiligenceScenario(data)) {
    if (APPEAL_ONLY_KEYS.has(key)) return true
    if (AUTO_FILLED_KEYS.has(key)) return true
  }
  return false
}

/** 尽调场景下不在面板展示申诉专用字段 */
export function isFieldHiddenForScenario(key, data = {}) {
  return isDueDiligenceScenario(data) && APPEAL_ONLY_KEYS.has(key)
}

/** 进度条统计用的必收字段（按场景过滤） */
export function getProgressFields(data = {}) {
  const allFields = getAllCollectFields(data)
  if (isDueDiligenceScenario(data)) {
    const requiredKeys = new Set([...getDDRequiredKeys(), 'legal_name'])
    for (const f of data._dynamic_fields || []) requiredKeys.add(f.key)
    return allFields.filter(f => requiredKeys.has(f.key))
  }
  return allFields.filter(f => !isFieldOptionalForScenario(f.key, data))
}

/** 客户信息面板进度（必收 / 选填分开统计） */
export function getCollectionProgress(data = {}) {
  const allFields = getAllCollectFields(data)
  const visibleFields = allFields.filter(f => !isFieldHiddenForScenario(f.key, data))
  const isDD = isDueDiligenceScenario(data)
  const requiredFields = getProgressFields(data)
  const optionalFields = visibleFields.filter(f => !requiredFields.some(r => r.key === f.key))
  const isFilled = (key) => data[key] && String(data[key]).trim()
  const filled = requiredFields.filter(f => isFilled(f.key)).length
  const optionalFilled = optionalFields.filter(f => isFilled(f.key)).length
  const ddAssess = isDD ? assessDDCompleteness(data) : null
  return {
    scenario: isDD ? 'due_diligence' : 'appeal',
    filled,
    total: requiredFields.length,
    optionalFilled,
    optionalTotal: optionalFields.length,
    coreComplete: isDD ? ddAssess?.ready : filled >= requiredFields.length,
    collectionComplete: data._collection_complete === true,
    missingRequired: requiredFields.filter(f => !isFilled(f.key)).map(f => f.label),
  }
}

const EXTRA_FIELD_LABELS = {
  oa_id: '公众号AppID',
  oa_name: '公众号名称',
  miniprogram_appid: '小程序AppID',
  miniprogram_name: '小程序名称',
  website_url: '网站地址',
  website_name: '网站名称',
  website_icp: 'ICP备案号',
  zhishixingqiu_name: '知识星球名称',
  zhishixingqiu_link: '知识星球链接',
  fenchuan_name: '纷传圈子名称',
  fenchuan_link: '纷传链接',
  dd_deadline: '尽调截止时间',
  scenario_type: '场景类型',
  service_scope_details: '服务权益明细',
  content_delivery_method: '商品/服务内容',
  refund_trigger_condition: '收费/退款说明',
  compliance_certifications: '资质证明',
  channel: '经营渠道',
}

/** 合并静态 + 渠道 + 行业字段，并补齐 collected_data 里已有值但无定义的项 */
export function getAllCollectFields(data = {}) {
  const channelText = [data.channel, data.industry, data.content_delivery_method, data.problem_type].filter(Boolean).join('\n')
  const channels = data._online_channels?.length
    ? data._online_channels
    : detectOnlineChannels(channelText, data)
  const staticFields = INFO_FIELDS.filter(f => {
    if (CHANNEL_REPLACED_STATIC_KEYS.has(f.key) && channels.length > 0) return false
    return true
  })
  const channelFields = data._channel_fields?.length
    ? data._channel_fields
    : getChannelFieldDefs(channels)
  const industryFields = data._dynamic_fields || []
  const seen = new Set()
  const result = []
  for (const f of [...staticFields, ...channelFields, ...industryFields]) {
    if (!f?.key || seen.has(f.key)) continue
    seen.add(f.key)
    result.push(f)
  }
  // 已有数据但不在字段表中的 key（如通知解析出的 AppID）也展示在客户信息
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_') || key === 'wechat_orders' || seen.has(key)) continue
    if (!val || !String(val).trim() || String(val).includes('用户暂未提供')) continue
    seen.add(key)
    result.push({
      key,
      label: EXTRA_FIELD_LABELS[key] || key,
      group: key.includes('order') ? '交易订单' : (key.includes('appid') || key.includes('oa_') ? '线上渠道' : '已识别信息'),
      icon: '📌',
    })
  }
  return result
}

export function getCollectionTotalSteps(data = {}) {
  return getProgressFields(data).length
}

// 找到下一个未填写的必收字段（跳过选填/申诉专用项）
function findNextUnfilledStep(fromStep, data) {
  const allFields = getAllCollectFields(data)
  for (let i = fromStep; i < allFields.length; i++) {
    const key = allFields[i].key
    if (isFieldOptionalForScenario(key, data)) continue
    if (!data[key] || !String(data[key]).trim()) return i
  }
  return allFields.length
}
const NUMERIC_FIELDS = new Set(['merchant_id', 'legal_id_last4', 'bank_account_last4', 'contact_phone', 'miniprogram_appid'])

// AI-First 欢迎消息（鼓励用户一次性说出多个信息）
const LOCAL_WELCOME = `您好！我是您的**微信支付商户号申诉顾问**，专门帮商家解决微信收款被限制、冻结、封禁等问题~

专注：交易拦截、收款限额、支付权限关闭、资金冻结、商户号封禁、尽职调查通知等，并帮您生成可提交到微信商户平台的申诉材料。

💼 **先说说您的情况吧：**

比如「我做餐饮的，微信商户号被冻结了」——随便说就行，我能听懂~

💡 有问题随时问我，比如「为什么要这个信息」。
🔒 您的信息只用于本次咨询，不会泄露。`

// "为什么"问题检测
const WHY_PATTERNS = [
  /为什么/, /为啥/, /干嘛/, /有什么用/, /为何/,
  /什么目的/, /什么意义/, /有必要/, /不想填/, /不方便/,
  /隐私/, /安全吗/, /泄露/, /能不填/, /可以跳过/,
  /这个信息/, /这些信息/, /用来干/, /拿来干/,
]

// 行业知识库：每个行业的常见违规原因、申诉要点、业务模式描述模板
const INDUSTRY_KNOWLEDGE = {
  '餐饮': { aliases: ['餐饮', '外卖', '饭店', '餐厅', '小吃', '烧烤', '火锅', '奶茶', '咖啡', '面馆', '快餐', '便当', '甜品'],
    commonViolations: ['虚假交易', '交易异常', '投诉率过高', '退款率过高'],
    appealTips: '餐饮行业需突出食品安全许可证、卫生许可、门店实景照片、美团/饿了么店铺截图、顾客好评记录。强调"已优化出餐流程、加强食品质量管控"。',
    businessModel: '通过线下门店堂食和线上外卖平台（美团/饿了么/小程序点餐）向消费者提供餐饮服务。顾客通过微信扫码点餐或外卖平台下单，微信支付为主要收款方式。' },
  '零售': { aliases: ['零售', '服装', '鞋', '包', '饰品', '百货', '超市', '便利店', '日用', '家居', '母婴', '化妆品', '美妆', '护肤'],
    commonViolations: ['售假投诉', '虚假宣传', '退款纠纷', '发货延迟投诉'],
    appealTips: '零售行业需提供正品进货凭证、品牌授权书、产品质检报告、仓库实拍、物流合作合同。强调"已完善退换货流程、加强商品质量审核"。',
    businessModel: '通过线下实体门店和线上小程序商城向消费者销售正规渠道采购的商品。所有商品均有正规进货渠道和质检报告，支持7天无理由退换货。' },
  '教育': { aliases: ['教育', '培训', '课程', '教学', '辅导', '网课', '知识付费', '考试', '学习', '技能'],
    commonViolations: ['预付费投诉', '服务未兑现', '退费纠纷', '虚假宣传'],
    appealTips: '教育培训需提供办学许可证/备案证明、课程大纲、师资证明、学员好评截图、退费政策。强调"已完善课程服务体系、建立退费绿色通道"。',
    businessModel: '为学员提供专业的教育培训服务，包含线下面授和线上直播/录播课程。收费模式透明，课程内容与宣传一致，提供完善的退费政策。' },
  '电商': { aliases: ['电商', '网店', '淘宝', '拼多多', '直播带货', '微商', '代购', '跨境', '批发', '分销'],
    commonViolations: ['虚假交易', '刷单', '发货延迟', '商品质量投诉', '交易异常'],
    appealTips: '电商需提供店铺后台数据截图、物流发货记录、好评截图、进货合同/发票、售后聊天记录。强调"已优化供应链、缩短发货周期、加强售后响应"。',
    businessModel: '通过自有微信小程序商城/公众号向消费者销售商品，所有商品均为正规渠道采购，提供完整的售前咨询、物流追踪和售后服务体系。' },
  '美容': { aliases: ['美容', '美发', '美甲', '纹眉', '医美', '整形', 'spa', '养生', '按摩', '推拿', '足浴'],
    commonViolations: ['预付费投诉', '服务效果争议', '诱导消费投诉', '资质问题'],
    appealTips: '美容行业需提供卫生许可证、从业人员资质证书、门店实景、客户满意度记录、服务价格公示。强调"已规范服务流程、杜绝强制消费、完善售后保障"。',
    businessModel: '通过线下实体门店为消费者提供专业美容/美发/养生服务，所有从业人员持证上岗，价格公开透明，服务项目明码标价。' },
  '生活服务': { aliases: ['维修', '家政', '搬家', '保洁', '装修', '洗衣', '干洗', '宠物', '摄影', '婚庆', '家电', '回收'],
    commonViolations: ['服务未完成投诉', '价格争议', '服务质量投诉'],
    appealTips: '生活服务需提供服务人员资质、服务合同模板、客户评价、营业场所照片。强调"已标准化服务流程、明确服务标准和验收条件"。',
    businessModel: '面向本地居民提供专业的生活服务，包含上门服务和到店服务。服务前明确沟通服务内容和费用，服务后客户确认满意再完成支付。' },
  '旅游': { aliases: ['旅游', '旅行', '酒店', '民宿', '门票', '景区', '机票', '签证'],
    commonViolations: ['行程取消退款', '服务不符投诉', '预付费纠纷'],
    appealTips: '旅游行业需提供旅行社资质、旅游保险证明、行程合同模板、客户好评、合作景区/酒店协议。强调"已完善退改政策、购买旅游意外险、建立应急处理机制"。',
    businessModel: '为消费者提供旅游出行服务，包含线路规划、酒店预订、门票代购等。所有行程均签订正式旅游合同，购买旅游意外保险，提供7×24小时客服。' },
  '健康': { aliases: ['健康', '医疗', '药品', '药店', '诊所', '体检', '保健', '健身', '瑜伽', '中医', '理疗'],
    commonViolations: ['夸大宣传', '资质问题', '效果争议投诉', '退费纠纷'],
    appealTips: '健康行业需提供医疗机构执业许可/药品经营许可、从业人员资质、产品检测报告。强调"已规范宣传用语、杜绝夸大效果、严格遵守广告法"。',
    businessModel: '通过实体门店/诊所为消费者提供专业的健康服务/产品，所有从业人员持证上岗，产品均有合法资质和检验报告。' },
  '科技': { aliases: ['科技', '软件', 'saas', 'app', '小程序开发', '网站', '互联网', 'it', '技术服务', '系统开发', '平台', '工具'],
    commonViolations: ['服务未交付', '功能不符投诉', '续费纠纷'],
    appealTips: '科技公司需提供软件著作权、公司技术团队介绍、服务合同模板、客户验收报告。强调"已完善项目交付流程、建立里程碑验收机制"。',
    businessModel: '为企业客户提供专业的技术服务/软件产品，采用项目制或订阅制收费，提供完善的售前咨询、开发交付和售后技术支持。' },
  '财税服务': { aliases: ['年报', '财税', '记账', '报税', '财务', '会计', '税务', '审计', '代账', '工商注册', '工商代办', '企业服务', '代理记账'],
    commonViolations: ['服务未兑现投诉', '退费纠纷', '资质问题'],
    appealTips: '财税服务需提供代理记账许可证、服务合同模板、客户服务记录、公司资质。强调"已规范服务流程、提供标准化服务协议、客户可随时查看服务进度"。',
    businessModel: '为中小企业提供专业的财税代理服务，包含年报申报、代理记账、税务申报、工商变更等。通过自有小程序/平台接单，提供标准化的线上+线下服务流程。' },
  '物流': { aliases: ['物流', '快递', '配送', '货运', '运输', '仓储', '同城配送', '跑腿', '闪送'],
    commonViolations: ['服务延迟投诉', '货物损坏投诉', '费用争议'],
    appealTips: '物流行业需提供运输资质、车辆信息、保险凭证、服务合同。强调"已完善货物追踪系统、建立理赔快速通道"。',
    businessModel: '为商家和个人提供专业的物流配送服务，提供实时追踪、签收确认等功能，保障货物安全及时送达。' },
  '农业': { aliases: ['农业', '农产品', '水果', '蔬菜', '生鲜', '茶叶', '特产', '养殖', '种植', '农场'],
    commonViolations: ['商品质量投诉', '发货延迟', '退款纠纷'],
    appealTips: '农业需提供食品经营许可证、产品检测报告、产地证明、冷链物流合同。强调"已建立产品质量溯源体系、完善冷链配送保障"。',
    businessModel: '直接对接产地，为消费者提供新鲜优质的农产品/特产，通过小程序线上下单、冷链物流配送到家。' },
  '游戏': { aliases: ['游戏', '手游', '端游', '页游', '小游戏', '游戏代练', '游戏账号', '游戏交易', '点券', '钻石', '皮肤'],
    commonViolations: ['虚拟商品投诉', '充值纠纷', '未成年人消费投诉', '涉赌嫌疑'],
    appealTips: '游戏行业需提供游戏版号/软著、防沉迷系统截图、未成年人消费退款机制、实名认证系统说明。强调"已完善防沉迷机制、未成年人充值100%可退、所有虚拟商品明码标价"。',
    businessModel: '为用户提供正规合法的游戏娱乐服务/虚拟商品交易。已取得相关资质，实行实名认证和防沉迷系统，保障用户合法权益。' },
  '陪玩社交': { aliases: ['陪玩', '陪聊', '语音社交', '语音房', '直播', '主播', '秀场', '社交平台', '交友平台', '声优'],
    commonViolations: ['涉黄嫌疑', '诱导消费投诉', '虚假宣传', '退费纠纷'],
    appealTips: '陪玩社交需提供ICP备案、内容审核机制说明、主播/陪玩实名认证记录、用户投诉处理记录。强调"已建立7×24小时内容审核团队、严禁违规内容、完善退费机制"。',
    businessModel: '为用户提供合规的游戏陪玩/语音社交服务，所有陪玩人员均经过实名认证和培训。平台设有完善的内容审核机制和投诉处理流程。' },
  '盲盒潮玩': { aliases: ['盲盒', '潮玩', '手办', '公仔', '扭蛋', '抽奖', '福袋', '惊喜箱', '卡牌', '球星卡', '集换卡'],
    commonViolations: ['涉赌嫌疑', '虚假宣传', '概率不透明投诉', '退款纠纷'],
    appealTips: '盲盒行业需提供概率公示截图、产品质量检测报告、进货凭证、退换政策。强调"已严格公示抽取概率、单次消费限额、提供保底机制、支持无理由退款"。',
    businessModel: '为消费者提供正规的盲盒/潮玩商品销售服务。所有商品均为正规渠道采购，抽取概率公开透明，设有单次消费限额和保底机制，支持7天无理由退换。' },
  '汽车': { aliases: ['汽车', '车', '二手车', '汽修', '洗车', '保养', '车险', '驾校', '租车', '代驾', '加油', '充电桩', '新能源'],
    commonViolations: ['服务纠纷', '价格争议', '虚假车况投诉'],
    appealTips: '汽车行业需提供营业资质、维修资质证书、价目表公示、服务合同模板。强调"已规范服务价格公示、建立服务标准化流程、完善客户投诉处理机制"。',
    businessModel: '为车主提供专业的汽车相关服务，所有技术人员持证上岗，价格透明公示，服务内容和费用提前告知，确保消费者知情权。' },
  '房产租赁': { aliases: ['房产', '房地产', '租房', '租赁', '民宿', '公寓', '长租', '短租', '中介', '房屋', '物业', '写字楼'],
    commonViolations: ['押金退还纠纷', '虚假房源投诉', '服务费争议'],
    appealTips: '房产租赁需提供房屋租赁备案、营业资质、真实房源证明、合同模板、退款政策。强调"已确保所有房源真实可靠、签订标准租赁合同、退款流程透明"。',
    businessModel: '为用户提供真实可靠的房屋租赁/中介服务，所有房源经过实地验证，签订标准合同，押金退还有明确流程和时限。' },
  '知识付费': { aliases: ['知识付费', '付费课程', '会员', 'VIP', '专栏', '电子书', '读书会', '社群', '训练营', '咨询', '问答'],
    commonViolations: ['内容不符投诉', '退费纠纷', '虚假宣传', '效果不达预期'],
    appealTips: '知识付费需提供内容创作团队介绍、课程大纲、用户评价截图、退费政策。强调"已完善课程试看机制、建立7天退款通道、课程内容与宣传描述一致"。',
    businessModel: '为用户提供专业的知识内容服务，包含在线课程、专栏文章、社群服务等。提供课程试看/试读功能，支持不满意退款，内容质量有保障。' },
  '票务演出': { aliases: ['票务', '演出', '演唱会', '展览', '展会', '门票', '活动', '赛事', '话剧', '音乐节', '脱口秀'],
    commonViolations: ['退票纠纷', '活动取消投诉', '假票投诉', '座位不符'],
    appealTips: '票务行业需提供演出经营许可、合作场馆协议、票务来源证明、退票政策。强调"已与官方合作确保票源真实、建立活动取消全额退款机制"。',
    businessModel: '为消费者提供正规的票务代理/活动组织服务，票源均来自官方渠道或授权代理，提供电子票验证和退改签服务。' },
  '二手交易': { aliases: ['二手', '闲置', '回收', '转让', '旧货', '翻新', '以旧换新', '寄卖', '典当'],
    commonViolations: ['商品质量投诉', '描述不符', '售后纠纷', '涉嫌售假'],
    appealTips: '二手交易需提供验货流程说明、商品评估标准、交易合同模板、售后保障政策。强调"已建立专业验货团队、商品真实分级评估、提供退货保障"。',
    businessModel: '为用户提供二手商品交易/回收服务，所有商品经过专业验货评估，真实标注商品成色，提供交易保障和售后服务。' },
  '保险': { aliases: ['保险', '保险代理', '保险经纪', '车险', '寿险', '意外险', '健康险', '保险科技'],
    commonViolations: ['误导销售投诉', '理赔纠纷', '资质问题'],
    appealTips: '保险行业需提供保险代理/经纪牌照、合作保险公司协议、销售人员资质证明。强调"已规范销售话术、如实告知保险条款、建立理赔协助机制"。',
    businessModel: '为客户提供专业的保险咨询和代理服务，与正规保险公司合作，所有销售人员持证上岗，严格遵守保险销售规范。' },
  '珠宝饰品': { aliases: ['珠宝', '黄金', '白银', '钻石', '翡翠', '玉石', '首饰', '手表', '奢侈品', '名表', '名包'],
    commonViolations: ['售假投诉', '品质争议', '价格虚高投诉', '鉴定纠纷'],
    appealTips: '珠宝行业需提供品牌授权书、鉴定证书、进货发票、GIA/国检等权威鉴定报告。强调"所有商品均配有权威鉴定证书、支持复检、假一赔十"。',
    businessModel: '为消费者提供正品珠宝/饰品/奢侈品销售服务，所有商品均来自正规渠道，配有权威鉴定机构出具的鉴定证书，支持第三方复检。' },
  '宠物': { aliases: ['宠物', '宠物店', '宠物医院', '宠物美容', '宠物食品', '猫粮', '狗粮', '宠物用品', '萌宠', '猫', '狗'],
    commonViolations: ['活体交易纠纷', '健康问题投诉', '商品质量投诉'],
    appealTips: '宠物行业需提供动物诊疗许可（宠物医院）、检疫证明、健康保障协议、售后服务条款。强调"已建立宠物健康保障机制、提供售后跟踪服务"。',
    businessModel: '为宠物主人提供专业的宠物商品/服务，包含宠物用品销售、宠物美容/医疗等。所有商品均为正规品牌，服务人员均经过专业培训。' },
  '广告营销': { aliases: ['广告', '营销', '推广', '引流', 'SEO', 'SEM', '信息流', '公众号运营', '代运营', '新媒体', 'MCN', '网红'],
    commonViolations: ['效果不达标投诉', '虚假承诺', '费用纠纷'],
    appealTips: '广告营销需提供营业资质、服务合同模板、效果报告样例、客户评价。强调"已明确效果指标和免责条款、定期提供数据报告、建立退费机制"。',
    businessModel: '为企业客户提供专业的广告投放/营销推广服务，提供数据化效果追踪，定期出具效果报告，合同明确服务范围和考核标准。' },
}

// 根据用户输入匹配行业（优先匹配最长的别名，避免"知识付费"匹配到"教育"）
function matchIndustry(text) {
  const t = text.toLowerCase()
  let bestMatch = null
  let bestLen = 0
  for (const [key, info] of Object.entries(INDUSTRY_KNOWLEDGE)) {
    for (const a of info.aliases) {
      if (t.includes(a) && a.length > bestLen) {
        bestMatch = { key, ...info }
        bestLen = a.length
      }
    }
  }
  if (bestMatch) return bestMatch

  // 模糊匹配：通过关键词推断最接近的行业
  const FUZZY_KEYWORDS = {
    '科技': ['远程', '协助', '调试', '开发', '编程', '代码', '网站', '服务器', '技术', '运维', '部署', '数据', 'IT', 'OBS', 'API', 'SDK', '小程序开发'],
    '生活服务': ['上门', '到家', '安装', '清洁', '陪护', '跑腿', '代办', '家电维修', '管道', '开锁', '月嫂'],
    '电商': ['卖货', '卖东西', '带货', '直播卖', '线上卖', '网上卖', '朋友圈卖'],
    '教育': ['教人', '授课', '讲课', '辅导', '家教', '培训班', '网课'],
    '餐饮': ['做饭', '外卖', '点餐', '堂食', '食堂', '小吃'],
    '零售': ['开店', '实体店', '门店', '商店', '杂货', '文具', '数码产品'],
    '健康': ['看病', '问诊', '体检', '营养', '减肥', '中药'],
    '广告营销': ['接单', '设计', '海报', '视频剪辑', '文案', '策划', 'logo'],
  }
  let fuzzyMatch = null
  let fuzzyScore = 0
  for (const [indKey, keywords] of Object.entries(FUZZY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) score++
    }
    if (score > fuzzyScore) {
      fuzzyScore = score
      fuzzyMatch = indKey
    }
  }
  if (fuzzyMatch && fuzzyScore >= 1) {
    const info = INDUSTRY_KNOWLEDGE[fuzzyMatch]
    if (info) return { key: fuzzyMatch, ...info, _fuzzy: true }
  }
  return null
}

// ========== 灰色/敏感行业智能检测 ==========
const SENSITIVE_INDUSTRIES = [
  { patterns: [/棋牌/, /麻将/, /扑克/, /德州/, /炸金花/, /斗地主/, /捕鱼/, /电玩/, /游戏.*币/, /币.*游戏/, /博彩/, /彩票/, /竞猜/, /赌/, /菠菜/, /BC/i],
    category: '棋牌/博彩类', risk: '极高',
    warning: '棋牌博彩类是微信风控最严格的类目。申诉前需要确认：您的产品是否有真实货币兑换功能？是否有游戏版号或软件著作权？',
    followup: '请详细说明：\n\n① 具体是什么类型的游戏/平台？\n② 是否涉及真实货币充值和提现？\n③ 是否有游戏版号或软件著作权？\n④ 盈利模式是什么（广告/会员/道具）？' },
  { patterns: [/贷款/, /借贷/, /网贷/, /现金贷/, /信用贷/, /消费金融/, /小额贷/, /P2P/i, /放贷/, /助贷/, /融资/],
    category: '金融借贷类', risk: '高',
    warning: '金融借贷类需要持有相关金融牌照才能合规经营。',
    followup: '请详细说明：\n\n① 具体是什么金融服务（助贷、消费分期、企业融资）？\n② 是否持有金融牌照或与持牌机构合作？\n③ 资金来源是什么？\n④ 年化利率在什么范围？' },
  { patterns: [/虚拟货币/, /比特币/, /区块链/, /数字货币/, /加密/, /币圈/, /交易所/, /挖矿/, /NFT/i, /Web3/i, /USDT/i, /代币/],
    category: '虚拟货币/区块链类', risk: '极高',
    warning: '虚拟货币相关业务在国内属于严格监管领域，申诉难度极大。',
    followup: '请详细说明：\n\n① 具体是区块链技术服务还是虚拟货币交易？\n② 是否涉及人民币与虚拟货币的兑换？\n③ 公司注册地在哪里？\n④ 主要面向国内还是海外用户？' },
  { patterns: [/成人/, /情趣/, /两性/, /约/, /陪聊/, /陪玩.*异性/, /交友.*付费/, /色/, /荷官/],
    category: '成人/社交类', risk: '极高',
    warning: '涉及成人内容的业务在微信平台申诉成功率极低。',
    followup: '请详细说明：\n\n① 具体是什么产品/服务？\n② 是否有线下实体经营？\n③ 平台上是否有用户生成内容？\n④ 是否有内容审核机制？' },
  { patterns: [/减肥/, /丰胸/, /壮阳/, /保健品/, /祛斑/, /美白.*产品/, /中药.*调理/, /偏方/, /秘方/, /特效/],
    category: '保健品/功效类', risk: '中高',
    warning: '保健品功效宣传是常见违规原因，需要特别注意广告法合规。',
    followup: '请详细说明：\n\n① 具体销售什么产品？\n② 产品是否有食品/保健品批文（蓝帽子）？\n③ 宣传中是否有功效承诺？\n④ 产品进货渠道是什么？' },
  { patterns: [/电子烟/, /烟油/, /烟弹/, /雾化/, /尼古丁/],
    category: '电子烟类', risk: '高',
    warning: '电子烟在微信平台属于禁售类目，申诉难度较大。',
    followup: '请详细说明：\n\n① 是销售电子烟产品还是相关配件？\n② 是否有烟草专卖许可？\n③ 销售渠道是线上还是线下？' },
  { patterns: [/分销/, /代理/, /拉人/, /团队/, /返佣/, /裂变/, /多级/, /下线/, /推广.*赚/],
    category: '分销/代理类', risk: '中高',
    warning: '多级分销模式容易被判定为传销，微信只允许一级分销。',
    followup: '请详细说明：\n\n① 分销层级是几级（直推还是多级）？\n② 是否需要缴纳代理费/入门费？\n③ 分销员是否需要囤货？\n④ 佣金结构是怎样的？' },
  { patterns: [/仿/, /A货/, /高仿/, /复刻/, /原单/, /尾单/, /代购.*奢/, /外贸原单/],
    category: '仿品/侵权类', risk: '极高',
    warning: '销售仿品属于严重违规，申诉成功率极低。如果是正品，请准备好品牌授权证明。',
    followup: '请如实说明：\n\n① 销售的商品是正品还是仿品？\n② 是否有品牌授权书或进货发票？\n③ 商品来源是什么渠道？' },
  { patterns: [/刷单/, /刷量/, /刷粉/, /涨粉/, /买粉/, /数据.*服务/, /点赞/, /阅读量/],
    category: '数据造假/刷量类', risk: '高',
    warning: '刷单刷量服务违反平台规则，申诉难度很大。',
    followup: '请详细说明：\n\n① 具体提供什么服务？\n② 服务对象是哪些平台？\n③ 是否有其他正规业务？' },
  { patterns: [/充值/, /代充/, /游戏充值/, /话费充值/, /会员代开/, /低价.*会员/, /共享.*账号/],
    category: '虚拟充值/代充类', risk: '中',
    warning: '虚拟充值类需要确认货源合法性和是否有相关授权。',
    followup: '请详细说明：\n\n① 具体充值什么产品（游戏/话费/会员）？\n② 货源渠道是什么？\n③ 是否是官方授权的代理？' },
]

// 检测敏感行业
function matchSensitiveIndustry(text) {
  const t = text.toLowerCase()
  for (const si of SENSITIVE_INDUSTRIES) {
    if (si.patterns.some(p => p.test(t))) return si
  }
  return null
}

// 检测模糊/笼统的行业描述
function isVagueIndustry(text) {
  const t = text.trim()
  // 太短（< 4字且不是明确行业词）
  if (t.length < 4) {
    const knownShort = ['餐饮', '外卖', '零售', '教育', '美容', '美发', '物流', '快递', '农业', '茶叶', '水果']
    if (!knownShort.some(k => t.includes(k)) && !matchIndustry(t)) return true
  }
  // 极度笼统的描述
  const vagueTerms = [/^电商$/, /^互联网$/, /^科技$/, /^服务$/, /^商城$/, /^平台$/, /^软件$/, /^网站$/, /^app$/i, /^小程序$/, /^公众号$/, /^线上$/, /^线下$/, /^实体$/, /^卖东西/, /^做生意/, /^卖货/]
  if (vagueTerms.some(p => p.test(t))) return true
  return false
}

// 生成模糊行业的追问
function getVagueFollowup(text) {
  const t = text.trim()
  if (/电商|商城|平台|卖东西|卖货|做生意/.test(t)) {
    return `您说的是${t}，能再具体说说吗？\n\n比如：\n① 卖什么类型的商品（服装、食品、电子产品、日用品……）？\n② 货源是自己生产还是代理/批发？\n③ 主要在哪些平台卖（自有小程序、淘宝、拼多多）？\n\n了解越详细，我给您的申诉方案越精准~`
  }
  if (/互联网|科技|软件|网站|app|小程序|公众号/i.test(t)) {
    return `您说的是${t}，能具体描述一下吗？\n\n比如：\n① 提供什么具体服务或产品？\n② 面向的客户是个人还是企业？\n③ 怎么收费的（订阅制、按次收费、免费+增值）？\n\n不同类型的科技服务，申诉策略差别很大~`
  }
  if (/服务|线上|线下|实体/.test(t)) {
    return `您说的是${t}，范围有点广，能具体说说吗？\n\n比如：\n① 具体提供什么服务？\n② 面向什么客户群体？\n③ 怎么收费的？\n\n这样我才能帮您匹配最合适的申诉策略~`
  }
  return `「${t}」这个描述有点简短，能再详细说说吗？\n\n① 具体做什么业务/卖什么产品？\n② 面向什么客户？\n③ 怎么收费的？\n\n描述越详细，我给您的申诉方案和评估就越准确~`
}

// ========== 智能字段提取：从任意消息中识别多种数据 ==========
const BANK_NAMES = ['工商银行','建设银行','农业银行','中国银行','交通银行','招商银行','邮储银行','邮政储蓄','浦发银行','兴业银行','民生银行','中信银行','光大银行','华夏银行','平安银行','广发银行','北京银行','上海银行','南京银行','宁波银行','渤海银行','浙商银行','恒丰银行','徽商银行','农商银行','农村商业','信用社','村镇银行']

function extractFieldsFromMessage(text, existingData = {}) {
  const extracted = {}
  const t = text.trim()

  // 手机号（11位，1开头）
  const phoneMatch = t.match(/1[3-9]\d{9}/)
  if (phoneMatch && !existingData.contact_phone) extracted.contact_phone = phoneMatch[0]

  // 商户号（10位，以1开头）
  if (!existingData.merchant_id) {
    const mid = parseMerchantId(t)
    if (mid) extracted.merchant_id = mid
  }

  // 微信交易订单（商品名称 + 交易单号）
  const incomingOrders = parseWechatOrders(t)
  if (incomingOrders.length > 0) {
    const existing = getStoredOrders(existingData)
    const merged = mergeOrderLists(existing, incomingOrders)
    extracted.wechat_orders = JSON.stringify(merged)
    extracted.order_info = formatOrderInfo(merged)
  }

  Object.assign(extracted, extractChannelFieldsFromMessage(t, existingData))

  // 统一社会信用代码（18位字母数字）
  const licenseMatch = t.match(/[0-9A-HJ-NP-Z]{18}/i)
  if (licenseMatch && !existingData.license_no && !/^wx/i.test(licenseMatch[0])) extracted.license_no = licenseMatch[0].toUpperCase()

  // 银行名称
  for (const bank of BANK_NAMES) {
    if (t.includes(bank) && !existingData.bank_name) { extracted.bank_name = bank; break }
  }

  // 公司全称（含 公司/有限/个体/商行/工作室）
  if (!existingData.company_name) {
    // 优先匹配"公司叫/公司是"等明确指示
    const namedMatch = t.match(/(?:公司|企业|主体)[叫是为：:]\s*([^\s,，。]{3,30}(?:有限公司|股份公司|公司|个体工商户|商行|商店|工作室|企业))/)
    if (namedMatch) {
      extracted.company_name = namedMatch[1]
    } else {
      // 通用匹配：至少含2个中文字+后缀，排除泛称
      const companyMatch = t.match(/[\u4e00-\u9fa5A-Za-z0-9]{3,}[\u4e00-\u9fa5](?:有限公司|股份公司|个体工商户|商行|工作室)/)
      if (companyMatch && !/^(我们|你们|他们|人家|这个|那个)/.test(companyMatch[0])) extracted.company_name = companyMatch[0]
    }
  }

  // 处罚类型关键词
  if (!existingData.problem_type) {
    const normalized = normalizeProblemType(t)
    if (normalized) extracted.problem_type = normalized
  }

  // 身份证后四位（明确提及身份证+4位数字）
  const idMatch = t.match(/(?:身份证|身份|证件)[号码：:]*.*?(\d{4})\b/)
  if (idMatch && !existingData.legal_id_last4) extracted.legal_id_last4 = idMatch[1]

  // 账户后四位（明确提及账户/银行卡+4位数字）
  const bankAccMatch = t.match(/(?:账户|账号|银行卡|卡号)[号码：:]*.*?(\d{4})\b/)
  if (bankAccMatch && !existingData.bank_account_last4) extracted.bank_account_last4 = bankAccMatch[1]

  // 行业提取（从自然对话中识别行业关键词）
  if (!existingData.industry) {
    for (const [indKey, indInfo] of Object.entries(INDUSTRY_KNOWLEDGE)) {
      for (const alias of indInfo.aliases) {
        if (t.includes(alias) && alias.length >= 2) {
          const normalized = matchIndustry(alias)
          if (normalized) { extracted.industry = normalized.key; break }
        }
      }
      if (extracted.industry) break
    }
  }

  // 违规原因提取（从自然对话中识别违规关键词）
  if (!existingData.violation_reason) {
    const violationPatterns = [
      /涉嫌[\u4e00-\u9fff]{2,10}/,
      /(?:违规原因|被处罚|原因是)[：:是为]?\s*(.{2,30})/,
    ]
    for (const pat of violationPatterns) {
      const vm = t.match(pat)
      if (vm) { extracted.violation_reason = (vm[1] || vm[0]).trim(); break }
    }
  }

  // 法人姓名
  if (!existingData.legal_name) {
    const legalPatterns = [
      /法人(?:名字|姓名)?[，,：:\s]+([\u4e00-\u9fff·]{2,6})/,
      /(?:法人|法定代表人|法代)[是为：:叫\s]+([\u4e00-\u9fff·]{2,6})/,
    ]
    for (const pat of legalPatterns) {
      const m = t.match(pat)
      if (m) { extracted.legal_name = m[1].trim(); break }
    }
  }

  // 商户名称（明确提及商户名+中文）
  if (!existingData.merchant_name) {
    const mnMatch = t.match(/(?:商户名称?|店铺名|店名)[是为叫：:]\s*([\u4e00-\u9fa5A-Za-z0-9]{2,20})/)
    if (mnMatch) extracted.merchant_name = mnMatch[1]
  }

  return extracted
}

// ========== 智能推断引擎：根据已有数据自动填充可推断的字段 ==========
const ONLINE_INDUSTRIES = ['游戏', '陪玩社交', '盲盒潮玩', '知识付费', '广告营销', '保险', '科技', '财税服务', '电商']
const OFFLINE_INDUSTRIES = ['餐饮', '美容', '汽车']
const HYBRID_INDUSTRIES = ['零售', '教育', '健康', '生活服务', '旅游', '物流', '农业', '房产租赁', '珠宝饰品', '宠物', '票务演出', '二手交易']

function inferFieldsFromData(data) {
  const inferred = {}
  const reasons = {}

  // 1. 行业 → 经营模式
  if (data.industry && !data.business_model) {
    const industryText = (data.industry || '').toLowerCase()
    const ind = matchIndustry(industryText)
    const indKey = ind ? ind.key : ''

    // 先看用户原始描述中有没有明确提到线上/线下
    const hasOnlineHint = /小程序|公众号|线上|网上|H5|app|网店|淘宝|拼多多|抖音|快手|直播|外卖平台/i.test(data.industry + (data._raw_industry || ''))
    const hasOfflineHint = /门店|实体|店铺|线下|档口|摊位|店面|柜台|写字楼|工作室/.test(data.industry + (data._raw_industry || ''))

    if (hasOnlineHint && hasOfflineHint) {
      inferred.business_model = '线上+线下结合'
      reasons.business_model = '您提到了线上和线下业务'
    } else if (hasOfflineHint && !hasOnlineHint) {
      inferred.business_model = '线下门店（实体店铺）'
      reasons.business_model = '您提到了实体经营'
    } else if (hasOnlineHint) {
      inferred.business_model = '纯线上（小程序/公众号/H5）'
      reasons.business_model = '您提到了线上业务'
    } else if (ONLINE_INDUSTRIES.includes(indKey)) {
      inferred.business_model = '纯线上（小程序/公众号/H5）'
      reasons.business_model = `${indKey}行业通常是线上经营`
    } else if (OFFLINE_INDUSTRIES.includes(indKey)) {
      inferred.business_model = '线上+线下结合'
      reasons.business_model = `${indKey}行业通常线上线下结合`
    } else if (HYBRID_INDUSTRIES.includes(indKey)) {
      inferred.business_model = '线上+线下结合'
      reasons.business_model = `${indKey}行业通常线上线下结合`
    }
  }

  // 2. 商户名称 ↔ 公司名称：智能互填
  if (data.company_name && !data.merchant_name) {
    inferred.merchant_name = data.company_name
    reasons.merchant_name = '通常与公司名称一致'
  }
  if (data.merchant_name && !data.company_name && /公司|有限|个体|商行|工作室|企业/.test(data.merchant_name)) {
    inferred.company_name = data.merchant_name
    reasons.company_name = '与商户名称一致'
  }

  // 3. 投诉/退款/申诉历史的默认推断：不推断，让用户自己说

  // 4. 从用户所有已有文本中提取更多字段（排除内部字段_开头，避免从原始输入中误提取）
  const allText = Object.entries(data).filter(([k, v]) => typeof v === 'string' && !k.startsWith('_')).map(([, v]) => v).join(' ')
  if (allText.length > 10) {
    const bonus = extractFieldsFromMessage(allText, data)
    for (const [key, value] of Object.entries(bonus)) {
      if (!data[key] && !inferred[key]) {
        inferred[key] = value
        reasons[key] = '从您之前的回答中识别到'
      }
    }
  }

  return { inferred, reasons }
}

// 判断消息是否明显不是回答当前问题（而是其他字段的数据）
function isAnswerForDifferentField(msg, currentFieldKey, existingData) {
  const extracted = extractFieldsFromMessage(msg, existingData)
  const extractedKeys = Object.keys(extracted)
  if (extractedKeys.length === 0) return null

  // 如果提取到的字段包含当前字段，说明用户在回答当前问题
  if (extracted[currentFieldKey]) return null

  // 如果提取到的是其他字段，说明用户在回答别的问题
  return extracted
}

// 常见问答（本地处理，不调 AI API）
const LOCAL_QA = [
  { patterns: [/多久/, /多长时间/, /几天/, /周期/], answer: '微信申诉审核一般需要3-5个工作日。如果材料齐全、逻辑清晰，部分案件可能更快。我们的目标是帮您一次性通过，减少反复提交的时间成本~' },
  { patterns: [/成功率/, /能成功/, /有把握/, /概率/], answer: '申诉成功率取决于多个因素：处罚类型、违规严重程度、材料完整度、整改诚意等。一般来说，首次申诉且材料专业的情况下，成功率在65%-90%之间。我们会尽力为您准备最优质的材料~' },
  { patterns: [/收费/, /多少钱/, /价格/, /费用/], answer: '信息收集和评估阶段是免费的。生成完整申诉材料后，您可以根据案件复杂度选择是否使用我们的专业服务。先让我了解您的情况，再给您具体的建议~' },
  { patterns: [/怎么提交/, /在哪里提交/, /提交申诉/, /申诉入口/], answer: '申诉提交有两种方式：\n\n① 微信支付商家助手小程序（推荐）→ 我是商家 → 风险处理 → 功能限制记录 → 发起申诉\n② 商户平台网页端 pay.weixin.qq.com → 账户中心 → 违约记录 → 提交申诉\n\n等我们收集完信息生成材料后，会有详细的提交指南~' },
  { patterns: [/95017/, /客服电话/, /人工客服/], answer: '微信支付官方客服电话是95017，工作时间9:00-22:00。不过电话客服通常只能查询状态，无法直接解决申诉问题。建议通过正式申诉渠道提交专业材料，效果更好~' },
  { patterns: [/你是谁/, /你是机器人/, /真人/, /人工/], answer: '我是AI申诉助手，基于大量成功申诉案例训练，能够快速收集信息并生成专业的申诉材料。信息收集阶段由我来处理，最终的申诉报告会调用专业AI模型生成，确保材料质量~' },
  { patterns: [/需要.*材料/, /准备什么/, /要带什么/, /需要.*证件/], answer: '申诉材料通常需要准备：\n\n① 营业执照照片\n② 法人身份证正反面\n③ 门店/经营场所照片\n④ 商品/服务相关凭证\n⑤ 整改措施说明\n\n具体材料会根据您的违规类型有所不同，我收集完信息后会给您详细的材料清单~' },
  { patterns: [/冻结.*资金/, /资金.*取出/, /钱.*取回/, /提现/], answer: '如果资金被冻结，通常需要先完成申诉解除处罚，之后资金会自动解冻返回商户账户。冻结期一般为180天，但成功申诉后可提前解冻。建议尽快准备材料申诉~' },
  { patterns: [/二次申诉/, /驳回.*再/, /再次申诉/, /被拒.*怎么/], answer: '如果首次申诉被驳回：\n\n① 仔细阅读驳回原因，针对性补充材料\n② 增加更详细的整改说明\n③ 补充经营合规证明（如进货凭证、资质证书）\n④ 两次申诉间隔建议3-5天\n\n我们会分析您的驳回原因，优化申诉材料~' },
  { patterns: [/投诉率/, /投诉.*处理/, /怎么.*降低.*投诉/], answer: '降低投诉率的关键措施：\n\n① 及时响应：24小时内回复所有投诉\n② 主动退款：对合理投诉优先退款处理\n③ 协商沟通：引导客户撤销投诉\n④ 优化服务：从根源减少投诉产生\n\n投诉率降至0.01%以下对申诉最有利~' },

  // ===== 新增QA =====
  { patterns: [/有救/, /还有希望/, /能不能恢复/, /还能用/], answer: '绝大多数商户号处罚都是可以通过申诉恢复的！关键在于：\n\n① 材料是否充分专业\n② 整改是否到位\n③ 申诉策略是否正确\n\n即使是支付权限关闭这种较重的处罚，只要材料准备得当，首次申诉成功率也在65%以上。我们先收集信息评估您的具体情况~' },
  { patterns: [/找律师/, /要不要请律师/, /法律/, /律师/], answer: '一般的商户申诉不需要请律师。微信支付申诉是平台内部的行政流程，关键是提交符合要求的申诉材料和整改证明。我们的AI系统基于大量成功案例，能生成专业级的申诉材料。\n\n只有在涉及大额资金纠纷或法律诉讼时才需要考虑律师~' },
  { patterns: [/代办/, /找人代/, /代理申诉/, /帮我申诉/], answer: '市面上确实有代办申诉的服务，但需注意：\n\n① 正规代办通常收费500-3000元不等\n② 骗子很多，承诺100%成功的基本是骗子\n③ 代办本质上也是帮你准备材料，核心还是材料质量\n\n我们的AI系统可以帮您生成专业的申诉材料，您自己提交即可，材料质量不输人工代办~' },
  { patterns: [/补充资料/, /补充材料/, /通道.*开放/, /24小时/], answer: '⚠️ 重要提醒：微信补充资料通道通常只开放24小时！\n\n收到补充资料通知后请立即准备并提交。超时未提交的，系统会自动维持原判。\n\n建议提前准备好常用材料（营业执照、身份证照片、门店照片等），收到通知后第一时间上传~' },
  { patterns: [/订单号.*哪/, /在哪.*订单号/, /怎么找.*订单/, /微信.*订单号/], answer: '微信支付订单号查找方式：\n\n① 商户平台：pay.weixin.qq.com → 交易中心 → 交易账单\n② 商家助手小程序：我是商家 → 收款记录\n③ 格式：以4开头的28位数字\n\n⚠️ 注意：申诉要填的是微信支付订单号，不是您店铺系统的订单号！两个是不一样的~' },
  { patterns: [/撤诉/, /撤销投诉/, /怎么让.*撤/, /客户.*撤/], answer: '引导消费者撤诉的方法：\n\n① 主动联系消费者，了解诉求并协商解决\n② 办理退款（原路全额退款最有效）\n③ 退款后引导消费者打开微信 → 我 → 支付 → 钱包 → 帮助中心 → 交易投诉\n④ 在投诉记录中留言「已解决，撤销投诉」\n\n💡 消费者撤诉对申诉成功率提升非常大！' },
  { patterns: [/结算账户/, /银行账户/, /账户.*在哪看/, /开户.*信息/], answer: '结算账户信息查看路径：\n\n① 商户平台：pay.weixin.qq.com → 账户中心 → 账户信息\n② 可以看到开户银行、账户号（部分隐藏）\n\n💡 资金冻结案件特别重要：拨打95017转3时需要提供商户号+结算账户后四位进行身份验证和催审~' },
  { patterns: [/资金.*解冻/, /什么时候.*解冻/, /解冻.*多久/, /钱.*什么时候/], answer: '资金解冻时间取决于案件类型：\n\n① 申诉成功后：通常3-5个工作日内资金自动解冻到结算账户\n② 未申诉：冻结期一般为180天，到期后自动解冻\n③ 部分冻结：可能分批解冻\n\n建议尽快申诉，成功后可大幅缩短等待时间。拨打95017转3可催促解冻进度~' },
  { patterns: [/跨类目/, /类目不符/, /经营范围/, /超范围/], answer: '跨类目经营申诉要点：\n\n① 确认营业执照经营范围是否包含实际业务\n② 如果包含：提供执照证明即可\n③ 如果不包含：先去工商变更经营范围，拿到新执照后再申诉\n④ 立即下架所有不符合注册类目的商品/服务\n⑤ 提交整改报告说明已梳理全部商品\n\n💡 先整改、再申诉，切勿边卖边诉~' },
  { patterns: [/封禁/, /永久/, /注销/, /商户号.*没了/], answer: '商户号封禁是最严重的处罚，但仍有申诉机会：\n\n① 材料要求最高：需要全套证件+详细业务说明+充分整改证据\n② 可能需要法人视频认证\n③ 建议先处理所有投诉，投诉清零后再申诉\n④ 如果申诉确实无法通过，可以考虑注销后用新主体重新申请商户号\n\n⚠️ 注销条件：无违规、无余额、无投诉、30天无交易~' },
  { patterns: [/交易异常/, /风控/, /被风控/, /触发风控/], answer: '交易异常是最常见的处罚原因，通常由以下原因触发：\n\n① 短时间交易量激增（新店开业、做活动）\n② 大额交易异常（单笔金额过大）\n③ 交易时间异常（深夜大量交易）\n④ 关联账户异常\n\n申诉关键：用数据和证据解释交易波动的合理原因，提供真实订单凭证。这类案件成功率较高~' },
  { patterns: [/多次申诉/, /申诉.*几次/, /反复.*驳回/, /一直被驳回/], answer: '⚠️ 重要警告：连续申诉5次不通过，可能被系统标记为「不支持申诉」！\n\n如果已被驳回多次：\n\n① 先停下来，不要急着再提交\n② 拨打95017转3查询具体驳回原因\n③ 针对性地补充驳回原因要求的材料\n④ 间隔5-7天后再提交\n⑤ 考虑换一个更专业的整改方案\n\n每次提交都要确保比上次更完善！' },
  { patterns: [/商家助手/, /小程序.*入口/, /怎么.*登录/, /商户平台/], answer: '微信支付商户相关入口：\n\n① 商家助手小程序：微信搜索「微信支付商家助手」\n② 商户平台网页：pay.weixin.qq.com\n③ 申诉入口：商家助手 → 我是商家 → 风险处理 → 申诉中心\n④ 违规记录：商家助手 → 风险处理 → 功能限制记录/违约处理记录\n\n💡 建议用法人微信登录，权限最全~' },
  { patterns: [/回访/, /电话回访/, /微信.*打电话/, /会不会.*联系/], answer: '微信审核团队在审核过程中可能会进行电话回访：\n\n① 一般在提交申诉后1-3个工作日内\n② 会核实商户基本信息、经营情况、整改措施\n③ 务必保持电话畅通，错过回访可能直接导致申诉失败\n④ 回访时态度要配合、诚恳，回答与提交材料一致\n\n💡 建议填写日常使用的手机号，确保能接听~' },
  { patterns: [/交易小票/, /交易凭证/, /什么.*凭证/, /凭证.*要求/], answer: '交易凭证要求：\n\n① 机打小票/电子订单（不接受手写单据）\n② 需包含：交易时间、金额、商品名称\n③ 小票上的订单号必须能在后台查到且为成功交易\n④ 至少提供3笔以上不同时间的交易凭证\n⑤ 线上订单：提供订单详情截图+发货/物流截图\n⑥ 线下订单：提供POS小票+商品照片\n\n⚠️ 照片必须清晰可辨！' },
  { patterns: [/拍照/, /照片.*要求/, /图片.*清晰/, /证件照/], answer: '申诉照片拍摄要求：\n\n① 证件类：正面拍摄，四角完整，文字清晰可辨\n② 门店照：门头要包含店名，内景要体现经营范围\n③ 手持证件：法人手持身份证，面部和证件都要清晰\n④ 格式：JPG/PNG，建议每张2MB以内\n⑤ 禁止P图：不要美化、裁剪或添加水印\n\n💡 自然光下拍摄效果最好，避免反光和阴影~' },
  { patterns: [/分销/, /一级分销/, /二级分销/, /分佣/], answer: '微信对分销模式的规定：\n\n① 只允许一级分销（只有直接推荐人获得佣金）\n② 禁止多级分销（A推荐B，B推荐C，A不能从C获利）\n③ 禁止入门费（不能要求缴费才能成为分销员）\n④ 禁止囤货要求\n\n如果被判定为多级分销，需要提供分销后台截图证明仅一级、提交分销规则文档、整改并关闭多级佣金功能~' },

  // ===== 投诉处理专项QA =====
  { patterns: [/投诉.*怎么回复/, /回复.*投诉/, /投诉.*话术/, /怎么.*回复.*客户/], answer: '投诉回复有严格的时间要求：\n\n⏰ **24小时内**必须首次回复（影响「1日回复率」指标）\n⏰ **72小时内**必须处理完毕并标记"处理完成"\n\n💡 点击顶部工具栏的 🗺️ **申诉指导** 按钮 → **投诉话术** Tab，可以直接获取5种投诉类型的专业回复模板，一键复制粘贴到商户后台！\n\n回复路径：商户平台 → 账户中心 → 消费者投诉 → 回复用户' },
  { patterns: [/投诉.*指标/, /服务质量/, /考核/, /1日回复率/, /3日.*完成率/, /重复投诉率/], answer: '微信商家服务质量考核三大指标：\n\n① **1日回复率**：投诉产生后24h内首次回复的比例\n② **3日处理完成率**：投诉产生后72h内标记"处理完成"的比例\n③ **重复投诉率**：7日内用户多次投诉的单量/商家结单总量\n\n⚠️ 指标差的商户会被：警告、限制新功能、在支付环节提示风险、限制部分权限\n\n💡 数据取7日前一周平均值，持续保持良好指标很重要！' },
  { patterns: [/投诉.*继续/, /处理完成.*继续/, /标记.*完成.*又/, /用户.*不满意/], answer: '标记"处理完成"后用户仍可继续投诉：\n\n① 商家标记完成 → 平台通知用户确认\n② 用户不认可 → 可选择"继续投诉"，状态回到"待处理"\n③ 商家需要继续处理\n\n💡 解决方法：\n- 标记完成前先确认用户满意\n- 退款到账后再标记\n- 引导用户在投诉页面确认"已解决"\n- 重复投诉会影响「重复投诉率」指标！' },
  { patterns: [/投诉.*入口/, /用户.*怎么投诉/, /投诉.*从哪/, /消费者.*投诉.*哪里/], answer: '消费者投诉入口：\n\n用户端：微信 → 我 → 服务 → 钱包 → 账单 → 点击某笔订单 → "对订单有疑惑" → "投诉商家"\n\n商家端查看：\n① 商户平台 pay.weixin.qq.com → 账户中心 → 消费者投诉\n② 微信支付商家助手小程序 → 消费者投诉\n\n💡 建议每天登录查看，及时处理！' },

  // ===== 95017详细QA =====
  { patterns: [/95017.*怎么打/, /95017.*流程/, /95017.*按几/, /怎么.*转人工/], answer: '95017详细拨打流程：\n\n📞 拨打 95017\n→ 按 **2**（商户服务）\n→ 输入 **商户号** 后按 **#** 确认\n→ 等待转接人工（5-15分钟）\n→ 人工接通后说明来意\n\n⚠️ 验证身份需要：商户号、法人姓名、身份证后四位、银行卡后四位\n\n💡 点击顶部 🗺️ **申诉指导** → **95017话术** Tab，有完整的个性化话术脚本！\n\n工作时间：9:00-22:00' },
  { patterns: [/95017.*催/, /催审/, /催.*进度/, /加快.*审核/], answer: '95017催审技巧：\n\n① 提交申诉后第2-3天致电\n② 按2→输商户号→转人工\n③ 话术："我是商户号XXX的法人XXX，已提交申诉材料，想咨询审核进度"\n④ 记录客服工号和回复内容\n⑤ 每隔2-3天跟进一次\n\n⚠️ 注意事项：\n- 语气礼貌诚恳，不要激动\n- 不要每天打，会被标记为骚扰\n- 如果客服说在审核中，问预计时间\n- 如果要求补充材料，尽快准备' },

  // ===== 申诉流程QA =====
  { patterns: [/申诉.*步骤/, /申诉.*流程/, /怎么.*申诉/, /申诉.*怎么做/], answer: '微信商户号申诉完整流程：\n\n**第1步**：处理所有消费者投诉（必须全部"已处理完成"）\n**第2步**：查看违约记录（商户平台→账户中心→违约记录）\n**第3步**：准备材料（身份证正反面+手持照、营业执照、交易凭证等）\n**第4步**：填写申诉表单并提交\n**第5步**：等待审核（1-7个工作日）+ 致电95017跟进\n**第6步**：如被驳回，补充材料后重新申诉\n\n💡 点击顶部 🗺️ **申诉指导** 按钮，可以看到根据您情况定制的详细流程！' },
  { patterns: [/违约记录/, /怎么.*查.*违规/, /在哪.*看.*处罚/, /处罚.*记录/], answer: '查看违约记录的3种方式：\n\n① **商户平台网页**：pay.weixin.qq.com → 账户中心 → 违约记录 → 商户管理记录\n② **商家助手小程序**：微信搜索"微信支付商家助手" → 风险处理 → 违约处理记录\n③ **商家助手公众号**：关注后 → 我的账号 → 我是商家 → 风险处理\n\n通知渠道：邮件、企业微信群、站内信、公众号\n\n💡 建议截图保存违约记录页面，申诉时参考！' },
  { patterns: [/整改/, /怎么.*整改/, /整改.*报告/, /整改.*措施/], answer: '整改报告撰写要点：\n\n① **承认问题**：正面承认存在的问题（但不要过度认错）\n② **分析原因**：说明问题产生的具体原因\n③ **已采取措施**：列出已经执行的整改动作\n④ **计划措施**：列出后续将执行的改进计划\n⑤ **防范机制**：说明如何避免再次发生\n\n💡 我们的申诉文案功能会自动帮您生成专业的整改内容，点击顶部 📄 **申诉文案** 按钮即可！' },
  { patterns: [/手持.*身份证/, /手持照/, /怎么拍.*手持/, /手持.*要求/], answer: '手持身份证照片拍摄要求：\n\n① 法人本人手持身份证**正面**\n② 面部和证件信息都要清晰可见\n③ 自然光下拍摄，避免反光\n④ 不要遮挡证件任何信息\n⑤ 背景干净，不要有杂物\n⑥ 不要P图、不要加滤镜\n⑦ 格式JPG/PNG，建议2MB以内\n\n💡 可以让别人帮忙拍，自拍容易模糊。拍完检查证件上的字是否清晰！' },
  { patterns: [/appid/, /AppID/, /小程序.*id/, /怎么.*查.*appid/], answer: '小程序AppID查看方法：\n\n① 登录微信公众平台 mp.weixin.qq.com\n② 左侧菜单 → 设置 → 基本设置\n③ 页面上方可以看到AppID（小程序ID）\n④ 格式：wx开头 + 16位字母数字（如wxfd87a8f24a3bc624）\n\n⚠️ 申诉表单中需要填写AppID，审核人员会核实！\n\n💡 如果是公众号，同样在公众平台→设置→基本设置中查看' },
]

// 检测是否是"为什么"类问题
function isWhyQuestion(text) {
  const t = text.trim().toLowerCase()
  return WHY_PATTERNS.some(p => p.test(t))
}

// 检测是否是常见问答
function matchLocalQA(text) {
  const t = text.trim().toLowerCase()
  for (const qa of LOCAL_QA) {
    if (qa.patterns.some(p => p.test(t))) return qa.answer
  }
  return null
}

// 检测是否是"没有/不知道/无"类简短回答（这是有效回答，不是提问）
function isNegativeAnswer(text) {
  const t = text.trim()
  // 精确匹配短否定
  if (/^(没有|没|无|不知道|不清楚|不确定|不了解|暂无|不太清楚|0|暂时没有|目前没有|还没有|应该没有|什么都没|没什么|不太确定|忘了|忘记了|没有过|从来没|未|否|第一次|首次|N\/A|NA|无法提供)$/i.test(t)) return true
  if (/^没(有|什么)/.test(t) && t.length <= 6) return true
  if (/^不知道[，,。\s]/.test(t)) return true
  if (/^不清楚[，,。\s]/.test(t)) return true
  // 扩展：较长的否定/无法提供表达
  if (/^(我没有|没有这[些个]|拿不到|找不到|没法提供|提供不了|给不了|我不知道|我不清楚|没办法提供|查不到|看不到|登不上|进不去)[啊呢吧了哦哈~！!。.，,]*$/i.test(t)) return true
  return false
}

// 检测"稍后/延迟"类回答（用户暂时没有这个信息，不应存为字面值）
function isDeferAnswer(text) {
  const t = text.trim()
  if (/^.{0,6}(晚点|稍后|回头|等下|待会|一会|等一下|过后|之后|以后|下次).{0,6}(告诉|给|说|发|提供|补充|再说|再给|再发)/.test(t)) return true
  if (/^.{0,4}(忘了|忘记了|记不住|记不清|记不得|想不起).{0,10}(告诉|给|说|发|补|$)/.test(t)) return true
  if (/^(还没|暂时没|手头没|手上没|现在没).{0,6}(找到|拿到|查到|看到|有)/.test(t)) return true
  if (/^(我[去找查看翻]一下|我先[找查看翻]|容我|让我|我得).{0,8}(找|查|看|翻|确认)/.test(t)) return true
  if (/^(不在身边|不在手边|没带|没在|不在这)/.test(t)) return true
  return false
}

// 检测模糊/吐槽/非回答类内容（用户在发牢骚或说废话，不是在回答问题）
function isVagueNonAnswer(text, fieldKey) {
  const t = text.trim()
  // 明显的吐槽/抱怨（不是在回答问题）
  if (/^(已经|都).{0,4}(出来|问|说|填|回答|给).{0,4}(了|过).{0,6}(很多|不少|好多|太多|够多)/.test(t)) return true
  if (/^(问题.*太多|太多.*问题|怎么这么多|还有多少|还要问多少|没完没了|烦死|好烦|好累|不想填了|不想回答了)/.test(t)) return true
  // 敷衍回答（对于需要具体信息的字段）
  const detailFields = new Set(['refund_policy', 'complaint_status', 'violation_reason', 'business_model'])
  if (detailFields.has(fieldKey)) {
    if (/^(差不多|大概吧|就那样|一般般|还行|还好|正常|普通|一般|就这样|没什么特别|都有|都行|随便|你看着办)$/.test(t)) return true
  }
  return false
}

// 检测拒绝/回避型回答（如"这个不用和你说吧""不告诉你"）
function isRefusalAnswer(text) {
  const t = text.trim()
  if (/不用.{0,4}(说|告诉|提供|给)|不想.{0,4}(说|告诉|提供|给)|不方便.{0,4}(说|告诉|提供)|跟你没关系|与你无关|凭什么告诉|干嘛告诉|你管不着|不关你事|管好你自己|别管/.test(t)) return true
  if (/^(不用了|不用|不给|不说|不填|跳过|pass|skip)$/i.test(t)) return true
  return false
}

// 智能去除带情绪/不耐烦的前缀，提取实际数据（如"给你了1409570162"→"1409570162"）
function stripFrustrationPrefix(text) {
  const t = text.trim()
  const m = t.match(/^(给你了|告诉你了|告诉你|给你|都说了|我说了|前面说了|已经说了|刚才说了|说过了|跟你说了|不是说了吗|不是说了|说了是|说了呀|就是|就)[\uff0c,\s]*/)
  if (m) {
    const cleaned = t.slice(m[0].length).trim()
    if (cleaned.length > 0) return cleaned
  }
  return t
}

// 检测是否是与当前收集无关的闲聊/提问（而非回答问题）
function isQuestion(text) {
  const t = text.trim()
  // 短的否定回答不是提问
  if (isNegativeAnswer(t)) return false
  // 明确的问句标点
  if (t.endsWith('?') || t.endsWith('？')) return true
  // 中文疑问语气词结尾（吗/呢/嘛/么/吧 — 排除"没有吗"这类否定句式被误判）
  if (/[吗呢嘛么]$/.test(t) && !/^(没|不|无)/.test(t)) return true
  // 疑问语气词+你/啊/呀/哦 结尾（如"可以上网吗你""现在几点了呢啊"）
  if (/[吗呢嘛么][你啊呀哦呢吧嘛]*$/.test(t) && t.length < 30 && !/^(没|不|无)/.test(t)) return true
  // 以疑问词开头且不像是在回答问题（排除"什么都没有"这类）
  if (/^(请问|我想问|问一下|能不能告诉我|可以帮我|怎么|如何|哪里|为什么|凭什么|到底)/.test(t)) return true
  // "XX吗"在句中（如"可以上网吗你""能申诉吗这个"）
  if (t.length < 25 && /[吗呢嘛么].{0,3}$/.test(t) && !/做|卖|经营|业务|行业|商户|店|公司/.test(t)) return true
  return false
}

// 检测消息是否是用户对AI本身说话（而非在回答业务问题）
// 例如："你是那个模型吗"、"你到底懂不懂"、"你怎么这么笨"、"认真思考"等
function isDirectedAtAI(text) {
  const t = text.trim()
  // 以"你"开头 + 对AI的质疑/抱怨/提问/命令
  if (/^你(是|到底|怎么|没法|还是|能不能|可以|在说|在干|在做|喜欢|有没有|知道|理解|明白|听懂|看懂|觉得|认为|想|说|给我|帮我|告诉|回答)/.test(t)) {
    // 排除用户在回答问题时以"你"开头的合理情况（如 "你们公司叫XX"、"你说的那个是XXX"）
    if (/^你(们|的|说的|提到的|问的)(公司|商户|店|行业|业务|产品|服务)/.test(t)) return false
    return true
  }
  // 骂AI / 对AI不满
  if (/^(笨|傻|蠢|废物|垃圾|白痴|智障|有病|脑残|什么玩意|什么东西|搞什么|干什么|说什么|你是傻|傻逼|滚|闭嘴)/.test(t)) return true
  // 命令AI / 对AI的指令（不是回答问题）
  if (/^(认真|仔细|好好|用心|动脑|再想|重新)(思考|想想|想一想|听|看|分析|回答|理解)/.test(t)) return true
  // "不是XX"类纠正/争辩（如"不是乱讲""不是这样""不是我说的""不是这个意思"）
  if (/^不是(乱|胡|瞎|这样|这个|那个|我|你|说的|在说|这么|那么|吧|啊|呀)/.test(t) && t.length < 20) return true
  // 以"你"结尾的短消息+问句词（"可以上网吗你""能查到吗你""知道吗你"）
  if (t.length < 25 && /你$/.test(t) && /[吗呢嘛么]/.test(t)) return true
  // 短消息反问AI（"你说呢""你觉得呢""你猜""你看呢"）
  if (/^你(说|觉得|看|猜|想|认为)[呢吧啊嘛]?$/.test(t)) return true
  // 问AI身份 / 能力（开头匹配）
  if (/^(你是|这是|那个)(什么|啥|哪个|谁|AI|人工智能|机器人|模型|GPT|DeepSeek|程序|系统)/i.test(t)) return true
  // 消息任意位置包含问AI身份（覆盖"你好 你是那个模型"、"请问你是AI吗"等复合消息）
  if (t.length < 40 && /你是.{0,4}(什么|啥|谁|AI|人工智能|机器人|模型|GPT|DeepSeek|程序|系统|哪个模型|那个模型)/i.test(t)) return true
  // 短消息+明显不是数据（纯粹在跟AI聊天）
  if (t.length < 20 && /你(懂|笨|蠢|傻|行不行|能不能|会不会|有?病|烦不烦|好烦|太蠢|太笨|太傻|脑子|智商|水平|什么都不|啥都不)/.test(t)) return true
  // "我在问你XX" / "我说的是XX" 类纠正AI的话
  if (/^我(在|是)(问|说|告诉|跟)(你|AI)/.test(t)) return true
  // 纯问候/打招呼（任何字段下都不是有效答案）
  if (/^(你好|您好|hello|hi|嗨|哈喽|在吗|在不在|喂)[！!~。.，,\s]*$/i.test(t)) return true
  // 包含问候但不含任何业务关键词 → 闲聊（覆盖"你好 你是那个模型"、"hi 在吗"等）
  if (t.length < 30 && /你好|您好|hello|hi|嗨|哈喽/i.test(t) && !/做|卖|经营|业务|行业|商户|店|公司|服务|产品|外卖|零售|餐饮|教育|游戏|软件|科技|医疗|金融/.test(t)) return true
  return false
}

// ========== 输入标准化：将用户模糊输入映射为标准值 ==========
const PROBLEM_TYPE_MAP = {
  '1': '交易拦截', '交易拦截': '交易拦截', '拦截': '交易拦截', '付款异常': '交易拦截', '支付异常': '交易拦截', '无法付款': '交易拦截',
  '2': '收款限额', '收款限额': '收款限额', '限额': '收款限额', '额度': '收款限额', '限制': '收款限额', '额度限制': '收款限额', '收款受限': '收款限额',
  '3': '支付权限关闭', '支付权限关闭': '支付权限关闭', '权限关闭': '支付权限关闭', '关闭': '支付权限关闭', '无法收款': '支付权限关闭', '不能收款': '支付权限关闭', '收款关闭': '支付权限关闭', '被关了': '支付权限关闭', '被关闭': '支付权限关闭', '收款被关': '支付权限关闭', '没法收款': '支付权限关闭',
  '4': '资金冻结', '资金冻结': '资金冻结', '冻结': '资金冻结', '延迟结算': '资金冻结', '钱被冻了': '资金冻结', '钱冻了': '资金冻结', '冻结资金': '资金冻结', '钱取不出来': '资金冻结', '提不了现': '资金冻结', '被冻了': '资金冻结', '被冻结': '资金冻结', '资金被冻': '资金冻结',
  '5': '商户号封禁', '商户号封禁': '商户号封禁', '封禁': '商户号封禁', '封号': '商户号封禁', '被封': '商户号封禁', '被封了': '商户号封禁', '号封了': '商户号封禁', '永久封禁': '商户号封禁', '号被封': '商户号封禁',
}

// 标准化处罚类型
function normalizeProblemType(text) {
  const t = text.trim().toLowerCase()
  // 直接匹配（完全相等）
  if (PROBLEM_TYPE_MAP[t]) return PROBLEM_TYPE_MAP[t]
  // 单字符数字键只匹配纯数字输入（防止 "月流水50000" 匹配 '5' → 商户号封禁）
  if (/^\d$/.test(t) && PROBLEM_TYPE_MAP[t]) return PROBLEM_TYPE_MAP[t]
  // 模糊匹配：只用 ≥2字符 的关键词做子串匹配
  for (const [key, val] of Object.entries(PROBLEM_TYPE_MAP)) {
    if (key.length >= 2 && t.includes(key)) return val
  }
  return null
}

// ========== 跑题/无关输入检测：用户说的明显不是在回答当前问题 ==========
function isOffTopicInput(text, fieldKey) {
  const t = text.trim()
  // 数字型字段：纯数字输入永远不是跑题
  if (NUMERIC_FIELDS.has(fieldKey) && /^\d+$/.test(t)) return false
  // 用户在请求AI做事（写代码、写文章、翻译等）而非回答问题
  if (/^(请|帮我|帮忙|麻烦|能不能|可以|你能|能否|请帮|请给|我想让你|你帮我)(写|做|生成|翻译|画|设计|开发|编|搞|弄|创建|制作)/.test(t)) return true
  // 明显的闲聊/测试（排除纯数字，避免误杀身份证后四位等）
  if (/^(测试|test|abc|哈哈哈|啦啦啦|嘻嘻|无聊|没事)/i.test(t) && t.length < 15) return true
  // 与当前问题完全无关的技术请求
  if (/写.*代码|写.*程序|HTML|CSS|JavaScript|Python|Java|代码|编程|开发.*网站|开发.*app/i.test(t) && fieldKey !== 'industry') return true
  if (/写.*代码|写.*程序|HTML|CSS|JavaScript|Python|Java\b/i.test(t) && fieldKey === 'industry') return true
  return false
}

// ========== 无效/垃圾回答检测（fieldKey用于区分数字型字段） ==========
function isMeaninglessInput(text, fieldKey) {
  const t = text.trim()
  // 数字型字段：纯数字输入永远不是垃圾
  if (NUMERIC_FIELDS.has(fieldKey) && /^\d+$/.test(t)) return false
  // 明确表示不知道怎么回答
  if (/^(不知道说啥|不知道怎么说|不知道怎么回答|不会说|说不清|不好说|不知道填什么|不清楚怎么填|不知道写什么|不懂|看不懂|啥意思|什么意思啊|不理解|随便|算了|跳过吧|下一个|过|略|不想说|懒得说|不想填|emmm|嗯嗯|哦哦|哦|嗯|啊|呃|额|好吧|行吧|ok|OK|Ok|\.+|。+|…+|~+|\?+|？+|！+|!+|呵呵|哈哈|嘿嘿)$/i.test(t)) return true
  // 口头敷衍/应付式短回答（嗯嗯好的吧、好吧好吧、哦哦好的、嗯嗯知道了等）
  if (t.length <= 10 && /^(嗯+|哦+|啊+|呃+|额+)(好的?|行|吧|呢|啊|哦|嘛|了|知道了?|明白了?|可以|没问题|看到了?|收到|OK|ok)*[吧呢啊哦嘛了~！!。.]*$/i.test(t)) return true
  if (t.length <= 10 && /^(好[吧的啊呢嘛]|行[吧了啊]|可以[吧了]|没问题|收到|知道了|明白了|看到了|了解了|OK了?|ok了?)[吧呢啊哦嘛了~！!。.]*$/i.test(t)) return true
  // 纯标点/表情/数字（非选项数字，且非数字型字段）
  if (/^[.,。，！!？?~…\s\d]+$/.test(t) && !/^[1-5]$/.test(t)) return true
  // 极短且无实质内容
  if (t.length <= 2 && !/^[1-5]$/.test(t) && !/[\u4e00-\u9fff]{2}/.test(t)) return true
  return false
}

// ========== 字段值智能标准化：将口语化描述转为专业表述 ==========
function normalizeFieldValue(key, rawValue, existingData = {}) {
  const v = rawValue.trim()
  if (!v) return v

  switch (key) {
    case 'industry': {
      // 用 matchIndustry 标准化行业名称
      const ind = matchIndustry(v)
      if (ind) return ind.key  // "我卖衣服的" → "零售"
      // 去掉口语化前缀
      return v.replace(/^(我是|我们是|我做|我们做|我搞|就是|主要是|我的是|属于)/, '')
               .replace(/(的|吧|啊|呢|嘛|哦|呀)$/g, '').trim() || v
    }
    case 'business_model': {
      // 标准化经营模式
      if (/^1$|纯线上|只.*线上|网上|小程序|公众号|H5|网店/.test(v)) return '纯线上（小程序/公众号/H5）'
      if (/^2$|线下|门店|实体|店铺|开店/.test(v)) return '线下门店（实体店铺）'
      if (/^3$|线上.*线下|线下.*线上|都有|结合|两个都/.test(v)) return '线上+线下结合'
      return v.replace(/^(我是|我们是|就是|主要是)/, '').trim() || v
    }
    case 'violation_reason': {
      // 去掉口语化前缀，保留原始描述
      return v.replace(/^(就是|他说|微信说|上面写的是|写的是|显示)/, '').trim() || v
    }
    case 'merchant_name':
    case 'company_name': {
      // 去掉口语化包裹和常见无用前缀
      return v.replace(/^(企业[，,\s]*|公司[，,\s]*|个体[，,\s]*|叫|叫做|名字是|名称是|是|我叫)/, '').replace(/(吧|啊|呢)$/g, '').trim() || v
    }
    case 'legal_name': {
      // 去掉口语化包裹
      return v.replace(/^(叫|叫做|名字是|名称是|是|我叫)/, '').replace(/(吧|啊|呢)$/g, '').trim() || v
    }
    case 'complaint_status': {
      if (/没有|无|没|0/.test(v) && v.length < 8) return '没有未处理投诉'
      if (/有|好几个|一些|几个/.test(v) && !/没/.test(v)) {
        return v.replace(/^(有|是)/, '').trim() ? `有未处理投诉：${v.replace(/^(有|是)/, '').trim()}` : v
      }
      return v
    }
    case 'refund_policy': {
      if (/没有|无|没|没弄|还没/.test(v) && v.length < 8) return '暂无完善退款政策'
      return v
    }
    case 'appeal_history': {
      if (/^1$/.test(v)) return '首次申诉'
      if (/^2$/.test(v)) return '申诉过，被驳回'
      if (/^3$/.test(v)) return '申诉过，等待中/无结果'
      if (/没有|无|没|第一次|首次|从来没/.test(v) && v.length < 10) return '首次申诉'
      if (/驳回|拒绝|失败|不通过|被拒|没通过/.test(v)) return `申诉过，被驳回（${v}）`
      if (/等待|处理中|没结果|没回复/.test(v)) return `申诉过，等待中（${v}）`
      return v
    }
    default:
      return v
  }
}

// ========== 输入校验器：每个关键字段有校验规则 ==========
const FIELD_VALIDATORS = {
  merchant_id: (v) => {
    const cleaned = v.replace(/\s+/g, '')
    if (/^1\d{9}$/.test(cleaned)) return { valid: true, cleaned }
    const tenDigit = cleaned.match(/(?<![\d])1\d{9}(?![\d])/)
    if (tenDigit) return { valid: true, cleaned: tenDigit[0], hint: `已提取商户号：${tenDigit[0]}` }
    return { valid: false, message: '⚠️ 商户号格式似乎不太对，微信支付商户号通常是10位数字且以1开头（如1114096895）。\n\n可在商户平台 pay.weixin.qq.com → 账户中心 → 商户信息 中查看。\n\n请重新输入您的商户号~' }
  },
  legal_id_last4: (v) => {
    const cleaned = v.replace(/\s+/g, '')
    if (/^\d{4}$/.test(cleaned)) return { valid: true, cleaned }
    if (/^\d{1,3}$/.test(cleaned)) return { valid: false, message: '⚠️ 请输入身份证号的后四位数字（4位），您输入的位数不够~' }
    if (/\d{4}/.test(cleaned)) {
      const last4 = cleaned.slice(-4)
      if (/^\d{4}$/.test(last4)) return { valid: true, cleaned: last4, hint: `已提取后四位：${last4}` }
    }
    // Accept X ending (some IDs end with X)
    if (/^\d{3}[xX]$/.test(cleaned)) return { valid: true, cleaned: cleaned.toUpperCase() }
    return { valid: false, message: '⚠️ 身份证后四位格式不对，请输入4位数字（如果末尾是X也可以）~' }
  },
  bank_account_last4: (v) => {
    const cleaned = v.replace(/\s+/g, '')
    if (/^\d{4}$/.test(cleaned)) return { valid: true, cleaned }
    if (/^\d{1,3}$/.test(cleaned)) return { valid: false, message: '⚠️ 请输入结算账户号的后四位数字（4位），您输入的位数不够~' }
    if (/\d{4}$/.test(cleaned)) {
      const last4 = cleaned.slice(-4)
      return { valid: true, cleaned: last4, hint: `已提取后四位：${last4}` }
    }
    return { valid: false, message: '⚠️ 请输入结算账户号的后四位数字（4位）。\n\n可在商户平台 → 账户中心 → 账户信息 中查看~' }
  },
  contact_phone: (v) => {
    const cleaned = v.replace(/[\s\-()（）]/g, '')
    if (/^1[3-9]\d{9}$/.test(cleaned)) return { valid: true, cleaned }
    if (/^0\d{2,3}\d{7,8}$/.test(cleaned)) return { valid: true, cleaned } // 固话
    if (/^\d{7,8}$/.test(cleaned)) return { valid: true, cleaned } // 短号
    if (/1[3-9]\d{9}/.test(cleaned)) {
      const match = cleaned.match(/1[3-9]\d{9}/)
      return { valid: true, cleaned: match[0], hint: `已提取手机号：${match[0]}` }
    }
    return { valid: false, message: '⚠️ 手机号格式似乎不太对。请输入11位手机号（如13812345678）。\n\n这个号码很重要，微信审核团队可能会进行电话回访~' }
  },
  company_name: (v) => {
    const cleaned = v.trim()
    // 如果看起来像个人名（2-3个汉字，不含公司/商行等关键词），提醒用户
    if (/^[\u4e00-\u9fff]{2,3}$/.test(cleaned) && !/公司|商行|工作室|个体|店|部|厂|社|所|馆|院|堂|行|铺|坊|号|网络|科技|贸易|商贸/.test(cleaned)) {
      return { valid: false, message: `🤔 「${cleaned}」看起来像个人姓名。这里需要的是营业执照上的公司/个体户全称，比如"XX网络科技有限公司"或"XX市XX商行"。\n\n如果您是个体户且执照上就是个人名字，请输入"个体户 ${cleaned}"确认~` }
    }
    return { valid: true, cleaned }
  },
  legal_name: (v) => {
    const cleaned = v.trim()
    // 如果看起来像公司名（含有限公司/工作室/商行等），提醒用户
    if (/有限公司|工作室|商行|个体|企业|集团|股份|合伙|事务所/.test(cleaned)) {
      return { valid: false, message: `🤔 「${cleaned}」看起来像公司名称。这里需要的是法人代表的个人姓名（营业执照上"法定代表人"一栏）。\n\n如果您的法人姓名确实包含这些字，请再输入一次确认~` }
    }
    return { valid: true, cleaned }
  },
  violation_reason: (v) => {
    const cleaned = v.trim()
    // 短文本必须包含违规相关关键词，否则很可能是用户在回答其他问题
    const violationKeywords = /涉嫌|违规|异常|欺诈|售假|套现|赌博|色情|洗钱|非法|虚假|交易|纠纷|投诉|分销|传销|拦截|冻结|封禁|限额|关闭|处罚|风险|被封|被冻|被关|被限|侵权|仿冒|盗版|跑分|资金|信用卡/
    if (cleaned.length <= 5 && !violationKeywords.test(cleaned)) {
      return { valid: false, message: `🤔 「${cleaned}」似乎不是违规原因描述。\n\n请提供微信官方给出的具体违规原因，通常在"商家助手小程序 → 风险处理 → 功能限制记录"中可以看到。\n\n比如：涉嫌交易异常、涉嫌欺诈、涉嫌信用卡套现等~` }
    }
    return { valid: true, cleaned }
  },
  license_no: (v) => {
    const cleaned = v.replace(/\s+/g, '')
    // 统一社会信用代码：18位
    if (/^[0-9A-Z]{18}$/i.test(cleaned)) return { valid: true, cleaned: cleaned.toUpperCase() }
    // 15位工商注册号
    if (/^\d{15}$/.test(cleaned)) return { valid: true, cleaned }
    // 用户可能输入了"没有"等
    if (isNegativeAnswer(cleaned)) return { valid: true, cleaned: v.trim() }
    // 长度不对但像是在尝试输入
    if (/^[0-9A-Z]{10,}$/i.test(cleaned)) return { valid: false, message: `⚠️ 统一社会信用代码通常是18位字母+数字（如91110105MA01234X56），您输入了${cleaned.length}位，请核对后重新输入~` }
    return { valid: true, cleaned: v.trim() } // 其他格式放过
  },
}

// 验证字段输入
function validateField(key, value) {
  const validator = FIELD_VALIDATORS[key]
  if (!validator) return { valid: true, cleaned: value.trim() }
  return validator(value)
}

/**
 * @deprecated AI-First 架构已废弃此函数。对话控制已统一由 AI 驱动。
 * 保留代码供参考，将在 Phase 5 清理阶段移除。
 * 
 * 本地规则引擎处理用户消息（已废弃）
 * @param {string} userMessage 用户输入
 * @param {number} step 当前收集步骤 (0-based)
 * @param {object} data 已收集的数据
 * @returns {{ response: string, nextStep: number, collectedData: object, infoUpdate: object|null, needAI: boolean, allCollected: boolean }}
 */
export function processLocal(userMessage, step, data) {
  const d = { ...data }
  const currentField = INFO_FIELDS[step] || INFO_FIELDS[INFO_FIELDS.length - 1]
  const msg = userMessage.trim()

  // 0. 空消息保护
  if (!msg) {
    return { response: `请回答当前问题：\n\n${currentField.question}`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 1. 检测"为什么"类问题
  if (isWhyQuestion(msg)) {
    const explanation = currentField.why
    const response = `为什么需要「${currentField.label}」？\n\n${explanation}\n\n🔒 您的所有信息仅用于生成申诉材料，我们不会用于任何其他用途。\n\n请继续回答上面的问题：\n\n${currentField.question}`
    return { response, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 2. 检测本地可回答的常见问题（但不能是短回答被误匹配）
  // 当在violation_reason步骤且消息包含违规相关内容时，跳过QA匹配，优先提取违规原因
  const skipQA = currentField.key === 'violation_reason' && /涉嫌|限制功能|限制时间|功能限制|违规|处罚|关闭.*功能|出款|收款/.test(msg)
  // 长消息（>30字符）且包含字段数据特征（商户号/公司名/数字ID/行业关键词等）时跳过QA，优先提取字段
  const hasFieldData = msg.length > 30 && (/\d{8,12}/.test(msg) || /公司|有限|商户|商行|工作室|个体/.test(msg) || /做|卖|经营|业务/.test(msg))
  if (!isNegativeAnswer(msg) && !skipQA && !hasFieldData) {
    const qaAnswer = matchLocalQA(msg)
    if (qaAnswer) {
      const response = `${qaAnswer}\n\n好的，我们继续收集信息。当前问题：\n\n${currentField.question}`
      return { response, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
    }
  }

  // 2.5 检测是否是对AI本身说话（而非回答业务问题）→ 交给AI自然回应
  if (isDirectedAtAI(msg)) {
    return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }

  // 2.6 检测用户是否在纠正/补充已被自动推断的字段（防止答案被存入错误的下一个字段）
  // 场景：industry 回答后 business_model 被自动推断为"纯线上"，但用户紧接着说"线上线下都有"
  // 此时 step 已跳到 problem_type，但用户的回答应该更新 business_model 而非存为 problem_type
  if (step > 0) {
    const autoInferableFields = { business_model: /线上|线下|门店|实体|小程序|公众号|H5|网上|网店|结合|都有|两个都|app/i }
    for (const [fieldKey, pattern] of Object.entries(autoInferableFields)) {
      // 只在该字段已有值、且在当前字段之前、且用户消息明确匹配该字段时触发
      // 但如果消息同时包含当前字段的关键词（如"小程序被关了"同时含小程序+关闭），优先视为当前字段的回答
      const currentFieldKeywords = { problem_type: /关闭|冻结|封禁|拦截|限额|限制|被封|权限|收款/, violation_reason: /涉嫌|违规|异常|处罚|套现|欺诈|赌博/ }
      const currentHasKeyword = currentFieldKeywords[currentField.key] && currentFieldKeywords[currentField.key].test(msg)
      if (d[fieldKey] && fieldKey !== currentField.key && pattern.test(msg) && !currentHasKeyword) {
        const fieldIdx = INFO_FIELDS.findIndex(f => f.key === fieldKey)
        if (fieldIdx >= 0 && fieldIdx < step) {
          // 用户在纠正/补充之前被自动推断的字段
          const newValue = normalizeFieldValue(fieldKey, stripFrustrationPrefix(msg), d)
          const oldValue = d[fieldKey]
          if (newValue !== oldValue) {
            d[fieldKey] = newValue
            const fieldDef = INFO_FIELDS[fieldIdx]
            const response = `✅ 已更新${fieldDef.label}：${oldValue} → ${newValue}\n\n我们继续~ 当前问题：\n\n${currentField.question}`
            return { response, nextStep: step, collectedData: d, infoUpdate: { key: fieldKey, label: fieldDef.label, value: newValue, group: fieldDef.group, icon: fieldDef.icon }, needDeepSeek: false, allCollected: false }
          } else {
            // 值相同但消息明确匹配其他字段 → 交给AI确认，不要存入当前字段
            return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
          }
        }
      }
    }
  }

  // 3. [已移除本地regex跨字段提取] 所有字段提取统一由AI API完成

  // 3.45 短消息反驳/争辩检测（"不是乱讲""你错了""我没说过""说的不对"等）→ 不是字段数据
  // 排除合法的否定回答（如"没有"用于回答"有没有投诉/申诉历史"）
  if (msg.length < 20 && !isNegativeAnswer(msg) && /^(不是|没有|我没|你错|说的不|搞错|弄错|瞎说|胡说|乱说|放屁|扯淡|骗人|忽悠)/.test(msg)) {
    return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }
  // 3.5 检测是否是提问/情绪化表达/复杂消息 → 交给 AI
  if (isQuestion(msg) && msg.length < 60) {
    return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }
  // 长消息中包含情绪/求助/抱怨且不像在回答问题 → 交给 AI（AI负责提取有用数据）
  if (msg.length > 15 && /怎么办|急|帮帮|救|害怕|担心|气死|坑|骗|不公平|投诉你|什么意思|搞不懂|太难了/.test(msg) && !isNegativeAnswer(msg)) {
    return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }
  // 3.55 短的求助/抱怨/纠错：如"怎么办啊"、"没有这些怎么办"、"你写错了吧"、"搞错了"
  if (/怎么办|你写错|搞错了|弄错了|不对吧|错了吧|有问题/.test(msg) && msg.length <= 15) {
    return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }

  // 3.8 跑题/无关输入检测：用户说的不是在回答当前问题
  if (isOffTopicInput(msg, currentField.key)) {
    return { response: `😊 您好！我是商户号申诉专家，目前正在帮您收集申诉所需的信息~\n\n我们先继续完成当前问题：\n\n${currentField.question}`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 3.85 拒绝/回避型回答检测：用户明确拒绝提供信息
  if (isRefusalAnswer(msg)) {
    // 非必填字段（可跳过）：存默认值，继续下一题
    const skippableFields = { license_no: '用户未提供', legal_id_last4: '用户未提供', bank_account_last4: '用户未提供', appeal_history: '首次申诉' }
    if (skippableFields[currentField.key]) {
      d[currentField.key] = skippableFields[currentField.key]
      const rawNext = step + 1
      const nextS = findNextUnfilledStep(rawNext, d)
      if (nextS >= TOTAL_STEPS) return { response: '没关系，我们继续~', nextStep: nextS, collectedData: d, infoUpdate: { key: currentField.key, label: currentField.label, value: skippableFields[currentField.key], group: currentField.group, icon: currentField.icon }, needDeepSeek: false, allCollected: true }
      const nf = INFO_FIELDS[nextS]
      return { response: `没关系，这个信息可以后续补充~\n\n${nf.question}`, nextStep: nextS, collectedData: d, infoUpdate: { key: currentField.key, label: currentField.label, value: skippableFields[currentField.key], group: currentField.group, icon: currentField.icon }, needDeepSeek: false, allCollected: false }
    }
    // 必填字段：友好解释为什么需要，重新提问
    return { response: `😊 理解您的顾虑~ 不过「${currentField.label}」是申诉材料中必需的信息，缺少的话会影响申诉成功率。\n\n🔒 您的信息仅用于本次申诉，我们不会泄露或用于其他用途。\n\n${currentField.question}`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 3.88 处罚类型追问状态：提前处理，防止被 meaningless 检测拦截
  if (currentField.key === 'problem_type' && d._problem_followup_asked) {
    // 检测是否是违规原因的多选格式（如 "6.7"、"6，7"、"6和7"、"①⑥"）
    const violationOptionMap = {
      '1': '涉嫌交易异常', '①': '涉嫌交易异常',
      '2': '涉嫌交易纠纷/投诉过多', '②': '涉嫌交易纠纷/投诉过多',
      '3': '涉嫌跨类目经营', '③': '涉嫌跨类目经营',
      '4': '涉嫌信用卡套现', '④': '涉嫌信用卡套现',
      '5': '涉嫌多级分销/传销', '⑤': '涉嫌多级分销/传销',
      '6': '涉嫌欺诈/售假', '⑥': '涉嫌欺诈/售假',
      '7': '涉嫌赌博/色情/非法内容', '⑦': '涉嫌赌博/色情/非法内容',
    }
    // 解析多选：支持 "6.7"、"6，7"、"6和7"、"6 7"、"67" 等格式
    const nums = msg.replace(/[.，,、和与及\s]+/g, ' ').trim().split(/\s+/).flatMap(s => {
      // 处理 "67" 这种连写
      if (/^\d{2,}$/.test(s)) return s.split('')
      return [s]
    })
    const reasons = nums.map(n => violationOptionMap[n]).filter(Boolean)
    if (reasons.length > 0) {
      delete d._problem_followup_asked
      d.violation_reason = reasons.join('、')
      const rawNext = step + 1
      const nextS = findNextUnfilledStep(rawNext, d)
      // 跳过 violation_reason 步骤（已填充）
      const afterViolation = findNextUnfilledStep(nextS, d)
      const nf = INFO_FIELDS[afterViolation] || INFO_FIELDS[nextS]
      const targetStep = afterViolation < TOTAL_STEPS ? afterViolation : nextS
      const infoUpdate = { key: 'violation_reason', label: '违规原因', value: d.violation_reason, group: 'problem', icon: '📋' }
      return { response: `✅ 已记录违规原因：${d.violation_reason}\n\n${nf ? nf.question : '继续下一步~'}`, nextStep: targetStep, collectedData: d, infoUpdate, needDeepSeek: false, allCollected: targetStep >= TOTAL_STEPS }
    }
    // 非多选格式，作为追问的回答处理（正常流程）
    delete d._problem_followup_asked
    d._problem_detail = msg
    const rawNext = step + 1
    const nextS = findNextUnfilledStep(rawNext, d)
    if (nextS >= TOTAL_STEPS) return { response: '✅ 感谢补充！', nextStep: nextS, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: true }
    const nf = INFO_FIELDS[nextS]
    return { response: `感谢补充！这些信息对制定申诉策略非常有帮助~\n\n${nf.question}`, nextStep: nextS, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 3.9 无效/垃圾回答检测：不存为字段值，友好引导重新回答
  if (isMeaninglessInput(msg, currentField.key) && !isNegativeAnswer(msg)) {
    const fieldHints = {
      industry: '比如您是做餐饮外卖、服装零售、教育培训、游戏、盲盒、SaaS软件……用自己的话说就行~',
      business_model: '比如：纯线上（小程序/H5）、线下门店、还是线上+线下结合？简单说说就好~',
      problem_type: '比如：交易拦截、收款限额、支付权限关闭、资金冻结、商户号封禁？输入数字也行~',
      violation_reason: '您可以打开「微信支付商家助手」→ 风险处理 → 功能限制记录，把上面显示的原因发给我~',
      merchant_id: '商户号一般是10位数字，可在商户平台 pay.weixin.qq.com → 账户中心 查看~',
      merchant_name: '就是您的商户号显示的名称，比如"XX小吃店"~',
      company_name: '营业执照上的公司全称，比如"XX市XX科技有限公司"~',
      legal_name: '营业执照上的法定代表人姓名~',
      bank_name: '您商户号绑定的结算银行，比如"招商银行"、"工商银行"~',
    }
    const hint = fieldHints[currentField.key] || '请根据您的实际情况回答，不确定的可以大概说说~'
    return { response: `😊 没关系，不用紧张！这个问题其实很简单：\n\n${currentField.question}\n\n💡 ${hint}`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 3.10 延迟/推脱回答：「忘了晚点告诉你」→存为待补充
  if (isDeferAnswer(msg)) {
    const deferrable = new Set(['license_no', 'legal_id_last4', 'bank_account_last4', 'merchant_id', 'company_name', 'merchant_name', 'bank_name', 'contact_phone', 'legal_name'])
    if (deferrable.has(currentField.key)) {
      d[currentField.key] = '⏳待补充'
      const rawNext = step + 1
      const nextS = findNextUnfilledStep(rawNext, d)
      const iu = { key: currentField.key, label: currentField.label, value: '⏳待补充', group: currentField.group, icon: currentField.icon }
      if (nextS >= TOTAL_STEPS) return { response: '好的，这个信息您可以稍后在右侧面板补充~', nextStep: nextS, collectedData: d, infoUpdate: iu, needDeepSeek: false, allCollected: true }
      const nf = INFO_FIELDS[nextS]
      return { response: `没问题，「${currentField.label}」您可以稍后在右侧面板补充~\n\n我们先继续 👇\n\n${nf.question}`, nextStep: nextS, collectedData: d, infoUpdate: iu, needDeepSeek: false, allCollected: false }
    }
    return { response: `😊 理解~ 不过「${currentField.label}」对申诉很重要，缺少会影响成功率。\n\n能尽量提供一下吗？\n\n${currentField.question}`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 3.11 模糊/吐槽检测：「已经出来了很多了」→不当有效答案
  if (isVagueNonAnswer(msg, currentField.key)) {
    const remaining = TOTAL_STEPS - step
    return { response: `😊 理解您的心情~ 还剩${remaining}个问题就完成了，每个都会直接影响您的申诉结果哦！\n\n${currentField.question}\n\n💡 请尽量具体描述，这样生成的申诉材料才更有针对性~`, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 4. 输入标准化（特定字段做智能映射）
  let finalValue = stripFrustrationPrefix(msg)

  // 4.0 违规原因字段：从长文本中智能提取核心违规原因 + 自动识别处罚类型
  if (currentField.key === 'violation_reason' && msg.length > 15) {
    const violations = []
    const vMatches = msg.match(/涉嫌[\u4e00-\u9fff]{2,10}/g)
    if (vMatches) violations.push(...vMatches)
    const commonViolations = ['交易异常', '欺诈', '信用卡套现', '虚假交易', '涉嫌赌博', '色情', '传销', '洗钱', '售假', '侵权', '违反法律法规', '交易纠纷', '跨类目经营', '多级分销']
    for (const cv of commonViolations) {
      if (msg.includes(cv) && !violations.some(v => v.includes(cv))) violations.push(cv)
    }
    if (violations.length > 0) {
      finalValue = [...new Set(violations)].join('、')
    }
    // 提取处罚时间
    const timeMatches = msg.match(/\d{4}[/年.-]\d{1,2}[/月.-]\d{1,2}/g)
    if (timeMatches) d._violation_times = timeMatches.join('、')
    // 智能推断problem_type（如果还没填）
    if (!d.problem_type) {
      if (/关闭.*收款.*功能|关闭商户收款|收款功能.*关闭/.test(msg)) {
        d.problem_type = '支付权限关闭'
      } else if (/关闭.*出款|出款.*关闭/.test(msg) && /关闭.*收款|收款.*关闭/.test(msg)) {
        d.problem_type = '支付权限关闭'
      } else if (/冻结|延迟结算/.test(msg)) {
        d.problem_type = '资金冻结'
      } else if (/封禁|永久限制/.test(msg)) {
        d.problem_type = '商户号封禁'
      } else if (/限额|额度/.test(msg)) {
        d.problem_type = '收款限额'
      } else if (/拦截/.test(msg)) {
        d.problem_type = '交易拦截'
      }
    }
    // 提取限制范围详情
    const restrictions = []
    if (/关闭.*收款/.test(msg)) restrictions.push('关闭收款')
    if (/关闭.*出款/.test(msg)) restrictions.push('关闭出款')
    if (/保留.*提现/.test(msg)) restrictions.push('仅保留提现')
    if (/保留.*退款/.test(msg)) restrictions.push('仅保留退款')
    if (restrictions.length > 0) d._restriction_details = restrictions.join('、')
  }

  if (currentField.key === 'problem_type' && !d._problem_followup_asked) {
    const normalized = normalizeProblemType(msg)
    if (normalized) {
      finalValue = normalized
    }
    // 如果用户输入完全无法识别为任何处罚类型，交给DeepSeek处理（可能包含其他字段数据）
    if (!normalized && !/[冻结封禁拦截限额关闭权限]/.test(msg)) {
      return { response: null, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
    }
  }

  // 5. 输入校验（格式类字段做验证）
  let validation = validateField(currentField.key, finalValue)
  if (!validation.valid) {
    // 5.1 智能重试：去掉情绪前缀再验证（如"给你了1409570162"→"1409570162"）
    const stripped = stripFrustrationPrefix(finalValue)
    if (stripped !== finalValue) {
      const retryValidation = validateField(currentField.key, stripped)
      if (retryValidation.valid) {
        validation = retryValidation
        finalValue = stripped
      }
    }
  }
  if (!validation.valid) {
    // 校验失败：交给DeepSeek判断是否是其他字段的数据
    return { response: validation.message, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: true, allCollected: false }
  }
  // 使用清理后的值
  finalValue = validation.cleaned || finalValue
  if (validation.hint) {
    // 有自动提取提示（如从长文本中提取了手机号）
  }

  // 5.5 [已移除本地regex多字段提取] 跨字段提取统一由DeepSeek API完成

  // 6. "没有/不知道"类回答的智能处理
  if (isNegativeAnswer(msg)) {
    const negativeFieldMap = {
      complaint_status: '没有未处理投诉',
      refund_policy: '暂无完善退款政策',
      appeal_history: '首次申诉',
      license_no: '用户暂未提供',
      legal_id_last4: '用户暂未提供',
      bank_account_last4: '用户暂未提供',
      merchant_name: '用户暂未提供',
      legal_name: '用户暂未提供',
      company_name: '用户暂未提供',
      bank_name: '用户暂未提供',
      contact_phone: '用户暂未提供',
    }
    if (negativeFieldMap[currentField.key]) {
      finalValue = negativeFieldMap[currentField.key]
    }
  }

  // 6.1 处罚类型追问：了解时间线和影响
  if (currentField.key === 'problem_type' && !d._problem_followup_asked) {
    d._problem_followup_asked = true
    d[currentField.key] = finalValue
    let followup = `收到，您遇到的是「${finalValue}」。\n\n为了更好地帮您制定申诉策略，再了解两个关键信息：\n\n① 大概是什么时候收到的处罚通知？（比如：昨天、上周、一个月前）\n② `
    if (/冻结/.test(finalValue)) followup += '大概冻结了多少资金？这会影响申诉的优先级和策略。'
    else if (/封禁/.test(finalValue)) followup += '封禁前商户号使用了多长时间？日均交易额大概多少？'
    else if (/关闭/.test(finalValue)) followup += '关闭前每天大概有多少笔收款？对您的经营影响大吗？'
    else followup += '目前对您的经营影响大吗？'
    followup += '\n\n（简单说说就行，这些信息会让申诉材料更有针对性~）'
    const infoUpdate = { key: currentField.key, label: currentField.label, value: finalValue, group: currentField.group, icon: currentField.icon }
    return { response: followup, nextStep: step, collectedData: d, infoUpdate, needDeepSeek: false, allCollected: false }
  }
  // （处罚类型追问的回答已在 section 3.88 提前处理，此处不再重复）

  // 6.2 申诉历史追问：只要有过申诉经历就追问详情（支持数字选项：2=驳回，3=等待中）
  if (currentField.key === 'appeal_history' && !d._appeal_followup_asked && (/^[23]$/.test(finalValue) || /有|申诉过|提交过|试过|驳回|拒绝|失败|不通过|被拒/.test(finalValue)) && !/没|无|否|首次|第一次|N\/A/.test(finalValue)) {
    d._appeal_followup_asked = true
    const normalizedAppeal = normalizeFieldValue('appeal_history', finalValue, d)
    d[currentField.key] = normalizedAppeal
    const infoUpdate = { key: currentField.key, label: currentField.label, value: normalizedAppeal, group: currentField.group, icon: currentField.icon }
    let followup = `了解了，之前有申诉过。这个信息很关键！\n\n请帮我补充一下：\n\n① 一共申诉过几次？\n② 最近一次的结果是什么？（通过/驳回/等待中）\n③ 如果被驳回过，还记得驳回原因吗？\n\n（简单说说就行，这些信息会直接影响新的申诉策略~）`
    return { response: followup, nextStep: step, collectedData: d, infoUpdate, needDeepSeek: false, allCollected: false }
  }
  if (currentField.key === 'appeal_history' && d._appeal_followup_asked) {
    delete d._appeal_followup_asked
    d._appeal_reject_reason = finalValue  // 保存驳回原因
    const rawNext = step + 1
    const nextS = findNextUnfilledStep(rawNext, d)
    if (nextS >= TOTAL_STEPS) return { response: '✅ 感谢！', nextStep: nextS, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: true }
    const nf = INFO_FIELDS[nextS]
    let tip = ''
    if (!/不记得|不知道|忘了/.test(finalValue)) tip = '\n\n💡 有了驳回原因，我会在新的申诉材料中针对性地补强这些薄弱点。'
    return { response: `明白了，我记下了。${tip}\n\n${nf.question}`, nextStep: nextS, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
  }

  // 6.3 投诉情况追问：回答「有」但没给详情时，追问关键信息
  if (currentField.key === 'complaint_status' && !d._complaint_followup_asked && /有|存在/.test(finalValue) && !/没|无|否|0/.test(finalValue) && finalValue.length < 15) {
    d._complaint_followup_asked = true
    d[currentField.key] = finalValue
    const infoUpdate = { key: currentField.key, label: currentField.label, value: '有未处理投诉', group: currentField.group, icon: currentField.icon }
    const followup = `收到！有投诉的话，处理状态会直接影响申诉结果。请补充一下：\n\n① 大概有几个未处理投诉？\n② 投诉原因主要是什么？（退款纠纷/服务不满意/未收到货等）\n③ 目前有在处理吗？\n\n⚠️ 重要提示：建议先100%处理完投诉再提交申诉，投诉率过高会直接被驳回。`
    return { response: followup, nextStep: step, collectedData: d, infoUpdate, needDeepSeek: false, allCollected: false }
  }
  if (currentField.key === 'complaint_status' && d._complaint_followup_asked) {
    delete d._complaint_followup_asked
    d[currentField.key] = `有未处理投诉：${finalValue}`
    const rawNext = step + 1
    const nextS = findNextUnfilledStep(rawNext, d)
    const iu = { key: currentField.key, label: currentField.label, value: d[currentField.key], group: currentField.group, icon: currentField.icon }
    if (nextS >= TOTAL_STEPS) return { response: '✅ 投诉详情已记录！', nextStep: nextS, collectedData: d, infoUpdate: iu, needDeepSeek: false, allCollected: true }
    const nf = INFO_FIELDS[nextS]
    return { response: `感谢补充！投诉详情已记录，我会在申诉材料中针对性地制定投诉处理方案。\n\n${nf.question}`, nextStep: nextS, collectedData: d, infoUpdate: iu, needDeepSeek: false, allCollected: false }
  }

  // 6.5 行业字段智能追问：模糊回答 / 敏感行业检测
  if (currentField.key === 'industry') {
    // 如果是追问后的第二次回答，合并信息继续
    if (d._industry_detail_asked) {
      delete d._industry_detail_asked
      // 合并第一次和第二次的回答
      const firstAnswer = d._industry_first_answer || ''
      delete d._industry_first_answer
      finalValue = firstAnswer ? `${firstAnswer}（${finalValue}）` : finalValue
      // 敏感行业追问后，再检测一次，记录风险标记
      const sensitive = matchSensitiveIndustry(finalValue)
      if (sensitive) {
        d._sensitive_industry = sensitive.category
        d._sensitive_risk = sensitive.risk
      }
    } else {
      // 第一次回答：检测敏感行业
      const sensitive = matchSensitiveIndustry(finalValue)
      if (sensitive) {
        d._industry_detail_asked = true
        d._industry_first_answer = finalValue
        d._sensitive_industry = sensitive.category
        d._sensitive_risk = sensitive.risk
        const response = `⚠️ 检测到您的业务可能属于「${sensitive.category}」，风险等级：${sensitive.risk}\n\n${sensitive.warning}\n\n${sensitive.followup}\n\n💡 请如实描述，我会根据实际情况给您最专业的申诉建议。即使是高风险类目，只要业务合规，也有申诉成功的案例~`
        return { response, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
      }
      // 检测模糊回答
      if (isVagueIndustry(finalValue)) {
        d._industry_detail_asked = true
        d._industry_first_answer = finalValue
        const response = getVagueFollowup(finalValue)
        return { response, nextStep: step, collectedData: d, infoUpdate: null, needDeepSeek: false, allCollected: false }
      }
    }
  }

  // 7. 正常收集信息（先做智能标准化）
  finalValue = normalizeFieldValue(currentField.key, finalValue, d)
  // 保存原始输入用于后续推断（如从 "我在小程序上卖盲盒" 推断经营模式）
  if (currentField.key === 'industry') d._raw_industry = msg
  d[currentField.key] = finalValue

  // 7.5 [已移除本地自动推断] 字段推断统一由DeepSeek API完成

  const rawNextStep = step + 1
  const nextStep = findNextUnfilledStep(rawNextStep, d)
  const infoUpdate = { key: currentField.key, label: currentField.label, value: finalValue, group: currentField.group, icon: currentField.icon }
  const allInfoUpdates = [infoUpdate]
  const autoFilledFields = [] // 自动推断已移至DeepSeek API，本地保留空数组兼容
  const allAutoFields = autoFilledFields
  const reasons = {}

  // 检查是否全部收集完毕
  if (nextStep >= TOTAL_STEPS) {
    // 生成数据摘要让用户确认（带质量标注）
    let dataSummary = ''
    const fieldLabels = { problem_type: '处罚类型', violation_reason: '违规原因', merchant_id: '商户号', merchant_name: '商户名称', company_name: '公司全称', license_no: '信用代码', legal_name: '法人姓名', legal_id_last4: '身份证后四位', industry: '所属行业', business_model: '经营模式', complaint_status: '投诉情况', refund_policy: '退款政策', bank_name: '开户银行', bank_account_last4: '账户后四位', contact_phone: '联系电话', appeal_history: '申诉历史' }
    let idx = 1
    const pendingFields = []
    const essentialFields = ['problem_type', 'violation_reason', 'merchant_id', 'company_name', 'legal_name', 'contact_phone']
    for (const [key, value] of Object.entries(d)) {
      if (value != null && String(value).trim() && fieldLabels[key]) {
        const display = value.length > 20 ? value.slice(0, 20) + '...' : value
        const isPending = value.includes('⏳待补充') || value === '用户暂未提供'
        if (isPending) {
          dataSummary += `${idx}. ${fieldLabels[key]}：⚠️ ${display}（需补充）\n`
          pendingFields.push(fieldLabels[key])
        } else {
          dataSummary += `${idx}. ${fieldLabels[key]}：${display}\n`
        }
        idx++
      }
    }
    // 完整度评分
    const totalFields = Object.keys(fieldLabels).length
    const filledCount = totalFields - pendingFields.length
    let qualityNote = ''
    if (pendingFields.length > 0) {
      const isEssentialMissing = pendingFields.some(f => essentialFields.some(e => fieldLabels[e] === f))
      qualityNote = `\n\n⚠️ 有${pendingFields.length}项待补充：${pendingFields.join('、')}。\n${isEssentialMissing ? '🔴 其中包含关键必填项，缺少会严重影响申诉成功率！请尽快在右侧面板补充。' : '💡 这些信息不影响报告生成，但补充后申诉材料会更完整。'}`
    }
    // 风险评估
    const risk = assessRisk(d)
    let riskSection = `\n\n**风险评估**：难度${risk.level}（${risk.riskScore}/100），预估成功率${risk.successRate}`
    if (risk.factors.length > 0) riskSection += `\n关键因素：${risk.factors.join('；')}`
    if (risk.tips.length > 0) riskSection += `\n${risk.tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

    // 匹配内置成功案例
    const matchedCases = matchBuiltInCases(d.problem_type, d.industry, d.violation_reason)
    let caseSection = ''
    if (matchedCases.length > 0) {
      caseSection = `\n\n**类似成功案例**：\n${matchedCases.map(c => `- ${c.title}：${c.success_summary}`).join('\n')}`
    }

    // 材料清单
    const checklist = generateMaterialChecklist(d)
    const requiredItems = checklist.filter(c => c.required)
    let checklistSection = `\n\n**需要准备的材料**（${requiredItems.length}项）：\n`
    const groups = {}
    requiredItems.forEach(c => { if (!groups[c.category]) groups[c.category] = []; groups[c.category].push(c.item) })
    for (const [cat, items] of Object.entries(groups)) {
      checklistSection += `\n${cat}：\n${items.map(i => `☐ ${i}`).join('\n')}\n`
    }

    // 工具指引
    const toolGuide = `\n\n**接下来可以用顶部工具栏：**
📄 **申诉文案** — 生成可直接复制到微信后台的申诉材料
📋 **投诉材料** — 生成完整申诉文书
🗺️ **申诉指导** — 流程 + 话术 + 材料清单 + 进度追踪

建议顺序：处理投诉 → 准备材料 → 生成文案 → 提交 → 电话跟进`

    const response = `信息收集完毕（共${TOTAL_STEPS}项）。\n\n${dataSummary}${qualityNote}${riskSection}${caseSection}${checklistSection}${toolGuide}\n\n数据仅用于本次咨询。正在生成评估报告，请稍候...`
    return { response, nextStep, collectedData: d, infoUpdate: allInfoUpdates, needDeepSeek: false, allCollected: true }
  }

  // 还有下一个问题
  const nextField = INFO_FIELDS[nextStep]
  // 自然过渡语（取代机械的[X/16]格式）
  const progressPct = Math.round((nextStep / TOTAL_STEPS) * 100)
  let progress = ''

  // ===== 特殊处理：业务了解阶段结束后，AI主动确认理解 =====
  if (currentField.key === 'business_model' && d.industry) {
    const ind = matchIndustry(d.industry)
    let bizSummary = ''
    if (ind) {
      bizSummary = `\n\n了解了，${ind.key}行业、${d.business_model}。${ind.appealTips ? `这类案件的关键：${ind.appealTips}` : ''}`
    } else {
      bizSummary = `\n\n了解了，${d.industry}、${d.business_model}。`
    }

    const confirm = generateConfirmation(currentField.key, finalValue, msg, d)
    const response = `${confirm}${bizSummary}\n\n业务情况清楚了，看看具体遇到了什么问题。\n\n${nextField.question}`
    return { response, nextStep, collectedData: d, infoUpdate: allInfoUpdates, needDeepSeek: false, allCollected: false }
  }

  // ===== 特殊处理：industry 回答后如果 business_model 被自动推断，显示业务总结 =====
  if (currentField.key === 'industry' && d.business_model && autoFilledFields.some(f => f.key === 'business_model')) {
    const ind = matchIndustry(d.industry)
    const autoFillNote = `\n\n已自动识别经营模式：${d.business_model}（不对的话右侧面板可改）`
    let bizSummary = ind ? `\n\n${ind.key}行业，${ind.appealTips ? `关键：${ind.appealTips}` : '了解了。'}` : ''

    const confirm = generateConfirmation(currentField.key, finalValue, msg, d)
    const response = `${confirm}${autoFillNote}${bizSummary}\n\n业务清楚了，看看遇到了什么问题。\n\n${nextField.question}`
    return { response, nextStep, collectedData: d, infoUpdate: allInfoUpdates, needDeepSeek: false, allCollected: false }
  }

  // 生成确认 + 下一个问题（根据已知业务类型智能调整措辞）
  let confirm = generateConfirmation(currentField.key, finalValue, msg, d)
  let nextQuestion = nextField.question

  // 根据已知信息定制后续问题措辞
  if (d.industry && nextField.key === 'complaint_status') {
    const ind = matchIndustry(d.industry)
    if (ind && ind.commonViolations.length > 0) {
      nextQuestion = `有没有未处理的消费者投诉？${ind.key}行业常见的有：${ind.commonViolations.join('、')}。没有就说"没有"~`
    }
  }
  if (d.industry && nextField.key === 'violation_reason') {
    const ind = matchIndustry(d.industry)
    if (ind && ind.commonViolations.length > 0) {
      nextQuestion = `微信给的违规原因是什么？${ind.key}行业常见：${ind.commonViolations.join('、')}\n\n在「商家助手」→ 风险处理 → 功能限制记录 里看~`
    }
  }
  if (d.problem_type && /冻结/.test(d.problem_type) && nextField.key === 'bank_name') {
    nextQuestion = `收款用的哪个银行？资金冻结案件打95017催审时必须提供~`
  }
  if (d.problem_type && /冻结/.test(d.problem_type) && nextField.key === 'bank_account_last4') {
    nextQuestion = `银行卡号后4位？资金冻结打95017催审的必备验证信息~`
  }

  // 自然过渡语 + 阶段性分析
  let encouragement = ''
  if (nextStep === 4) {
    encouragement = `\n\n接下来需要几个证件信息，申诉材料必需的。`
  } else if (nextStep === 8) {
    const risk = assessRisk(d)
    let midAnalysis = ''
    if (risk && d.problem_type) {
      midAnalysis = `\n\n目前看，案件难度${risk.level}，预估成功率${risk.successRate}。继续完善信息，最终报告会更精准。`
      if (risk.riskScore >= 65) {
        midAnalysis += `\n\n案件难度较高，自己操作有困难的话，也有专业团队可以协助~`
      }
    }
    const cs = (d.complaint_status || '').toLowerCase()
    if (cs && !cs.includes('没有') && !cs.includes('无') && !cs.includes('已处理') && !cs.includes('0')) {
      midAnalysis += `\n\n注意：有未处理投诉是驳回第一大原因。顶部 **申诉指导** → **投诉话术** 有回复模板~`
    }
    encouragement = midAnalysis || '\n\n基本信息差不多了，再几个问题就能生成报告。'
  } else if (nextStep === 12) {
    encouragement = `\n\n快完成了，还剩${TOTAL_STEPS - nextStep}个~`
  } else if (nextStep === 15) {
    encouragement = '\n\n最后一个问题了。'
  }

  // 如果有自动推断/提取的字段，在确认消息中提示
  let autoFillNote = ''
  if (allAutoFields.length > 0) {
    const parts = allAutoFields.map(f => `${f.label}→${f.value}`)
    autoFillNote = `\n\n自动识别：${parts.join('、')}（不对可在右侧面板改）`
  }

  const response = `${confirm}${autoFillNote}${encouragement}\n\n${nextQuestion}`

  return { response, nextStep, collectedData: d, infoUpdate: allInfoUpdates, needDeepSeek: false, allCollected: false }
}

// 根据字段类型生成个性化确认回复（value = finalValue after normalization, data = 已收集数据上下文）
function generateConfirmation(key, value, rawInput, data = {}) {
  const v = value.trim()
  const raw = (rawInput || v).trim()
  const wasNormalized = v !== raw // 是否经过了标准化

  switch (key) {
    case 'problem_type': {
      const vl = v.toLowerCase()
      let tip = ''
      if (vl.includes('冻结')) tip = '资金冻结比较严重，但专业申诉恢复空间很大，建议同步拨打95017转3催审。'
      else if (vl.includes('关闭') || vl.includes('无法收款')) tip = '支付关闭影响大，但这类申诉成功率较高。'
      else if (vl.includes('限额') || vl.includes('限制')) tip = '限额通常是风控自动触发，申诉相对好处理。'
      else if (vl.includes('拦截')) tip = '交易拦截一般是阶段性风控，及时申诉都能解决。'
      else if (vl.includes('封禁')) tip = '封禁是最严重的处罚，需要非常充分的材料。'
      const normalized = wasNormalized ? `（识别为：${v}）` : ''
      return `收到，${v}${normalized}。${tip ? `\n\n${tip}` : ''}`
    }
    case 'violation_reason': {
      const viol = matchViolation(v)
      const ind = data.industry ? matchIndustry(data.industry) : null
      let response = `收到，违规原因：「${v.slice(0, 30)}${v.length > 30 ? '...' : ''}」`
      if (viol) {
        response += `\n\n${viol.description}\n预估成功率：${viol.estimated_success_rate}，关键：${viol.success_key}`
        if (viol.severity >= 4) {
          response += `\n\n可以点顶部 **申诉指导** 查看针对性的申诉流程。`
        }
      }
      if (ind) {
        response += `\n\n${ind.key}行业要点：${ind.appealTips}`
      }
      return response
    }
    case 'merchant_id':
      return `收到，商户号：${v}`
    case 'merchant_name':
      return `好的，${v}。`
    case 'company_name':
      return `好的，${v}。`
    case 'license_no':
      return `收到${v.length === 18 ? '，18位信用代码' : ''}。`
    case 'legal_name':
      return `好的，${v}。`
    case 'legal_id_last4':
      return `收到，****${v}。`
    case 'industry': {
      const ind = matchIndustry(v)
      if (ind) return `${ind.key}行业，了解了，这类案件我比较熟悉~`
      return `${v}，了解了。`
    }
    case 'business_model':
      return `好的。`
    case 'complaint_status': {
      if (/没有|无|暂无/.test(v)) return `没有投诉，这对申诉很有利。`
      return `收到。有未处理投诉的话，建议优先处理完再提交申诉。\n\n顶部 **申诉指导** → **投诉话术** 有专业回复模板可以直接用~`
    }
    case 'refund_policy': {
      if (/没有|暂无/.test(v)) return `没关系，我会在申诉材料里帮您拟一份退款政策。`
      return `好的。`
    }
    case 'contact_phone':
      return `收到，${v}。保持畅通，审核可能会电话回访。`
    case 'bank_name':
      return `好的，${v}。`
    case 'bank_account_last4':
      return `收到，****${v}。`
    case 'appeal_history': {
      if (/首次|没有|无|没/.test(v)) return `首次申诉，成功率相对更高，关键是一次性把材料备齐。`
      if (/驳回|拒绝|失败|不通过/.test(v)) return `有驳回记录。二次申诉需要更充分的材料，建议先打95017转3问清驳回原因。\n\n顶部 **申诉指导** → **95017话术** 有完整话术脚本~`
      return `好的。`
    }
    default:
      return `好的。`
  }
}

/**
 * 构建信息收集阶段 DeepSeek 的富上下文
 * 让 AI 了解完整的收集进度、已有分析、行业知识，从而像真人顾问一样自然对话
 * @param {object} data 收集的数据
 * @param {number} currentStep 当前步骤
 * @param {object} orderInfo 绑定的订单信息（可选）
 */
export function buildCollectionContext(data, currentStep, orderInfo = null) {
  const allFields = getAllCollectFields(data)
  const collected = []
  const remaining = []

  for (const field of allFields) {
    const value = data[field.key]
    if (value && String(value).trim() && !String(value).includes('⏳待补充') && !String(value).includes('用户暂未提供') && !String(value).includes('用户未提供')) {
      collected.push(`• ${field.label}: ${value}`)
    } else {
      const q = field.question ? field.question.split('\n')[0].replace(/^[^\s]*\s/, '') : field.label
      remaining.push(`• ${field.label} — ${q}`)
    }
  }

  let ctx = `\n\n===== 信息收集进度 (${collected.length}/${allFields.length}) =====\n`
  if (collected.length > 0) {
    ctx += `\n【已收集】\n${collected.join('\n')}\n`
  }
  if (remaining.length > 0) {
    const show = remaining.slice(0, 4)
    ctx += `\n【待收集（按优先级）】\n${show.join('\n')}\n`
    if (remaining.length > 4) ctx += `...还有${remaining.length - 4}项\n`
  }

  if (isDueDiligenceScenario(data)) {
    ctx += `\n\n===== 【商户尽职调查场景 — 重要】=====\n`
    ctx += `用户收到「商户尽职调查通知」，核心任务是协助填写「微信支付商家助手」小程序中的尽调表单，不是写申诉书。\n`
    ctx += `引导重点：经营说明（200字）、平台类型+商家名称+售卖商品/服务、资金来源/用途、2-3笔真实微信交易单号。\n`
    ctx += `不要追问违规原因细节或申诉历史；告知用户可在顶部工具栏打开「尽调填写」面板复制标准表述。\n`
    if (data.dd_deadline) ctx += `截止时间：${data.dd_deadline}，请提醒用户尽快提交。\n`
  }

  if (data._online_channels?.length) {
    const labels = (data._channel_fields || [])
      .reduce((acc, f) => { if (f.channelLabel && !acc.includes(f.channelLabel)) acc.push(f.channelLabel); return acc }, [])
    ctx += `\n\n===== 【已识别线上经营渠道】=====\n`
    ctx += `${labels.join('、') || data._online_channels.join('、')}\n`
    ctx += `只收集上述渠道相关信息，不要追问用户未提及的其他平台（如用户只有公众号就不要问小程序AppID）。\n`
    if (data._channel_tip) ctx += `${data._channel_tip}\n`
  } else if (/纯线上|线上|网上|网店/.test(data.business_model || '')) {
    ctx += `\n\n===== 【线上经营 — 待确认渠道】=====\n`
    ctx += `用户说是线上经营，但尚未明确具体渠道。请自然地问：主要通过什么线上方式经营？如微信小程序、公众号、网站、知识星球、纷传、抖音等。\n`
  }

  // 订单上下文 - 如果绑定了订单，AI需要知道
  if (orderInfo) {
    const orderAmount = orderInfo.total_amount > 10000 ? (orderInfo.total_amount / 100).toFixed(2) : orderInfo.total_amount
    ctx += `\n\n===== 当前处理订单 =====\n`
    ctx += `【订单信息】\n`
    ctx += `• 订单号: ${orderInfo.order_no || '未知'}\n`
    if (orderInfo.buyer_nick || orderInfo.customer_name) ctx += `• 买家昵称: ${orderInfo.buyer_nick || orderInfo.customer_name}\n`
    if (orderInfo.receiver_mobile || orderInfo.buyer_phone || orderInfo.customer_phone) ctx += `• 联系电话: ${orderInfo.receiver_mobile || orderInfo.buyer_phone || orderInfo.customer_phone}\n`
    if (orderInfo.goods?.title || orderInfo.product_name) ctx += `• 商品名称: ${orderInfo.goods?.title || orderInfo.product_name}\n`
    ctx += `• 订单金额: ¥${orderAmount}\n`
    if (orderInfo.status) ctx += `• 订单状态: ${orderInfo.status}\n`
    if (orderInfo.receiver_address) ctx += `• 收货地址: ${orderInfo.receiver_address}\n`
    ctx += `\n请根据以上订单信息，结合商户违规情况，为用户提供专业的申诉建议。\n`
  }

  // 风险评估
  if (data.problem_type) {
    const risk = assessRisk(data)
    if (risk) {
      ctx += `\n【风险评估】难度: ${risk.level}(${risk.riskScore}/100)  成功率: ${risk.successRate}\n`
      if (risk.factors.length > 0) ctx += `关键因素: ${risk.factors.join('；')}\n`
    }
  }

  // 行业分析
  if (data.industry) {
    const industry = matchIndustry(data.industry)
    if (industry) {
      ctx += `\n【行业分析】${industry.key}\n申诉要点: ${industry.appealTips}\n常见违规: ${industry.commonViolations?.join('、')}\n`
    }
    const sensitive = matchSensitiveIndustry(data.industry)
    if (sensitive) {
      ctx += `⚠️ 敏感行业: ${sensitive.category}，风险: ${sensitive.risk}\n`
    }
  }

  // 违规分析
  if (data.violation_reason) {
    const violation = matchViolation(data.violation_reason)
    if (violation) {
      ctx += `\n【违规分析】${violation.key}: ${violation.description}\n`
      if (violation.appeal_key_points) ctx += `申诉关键: ${violation.appeal_key_points.join('、')}\n`
      if (violation.estimated_success_rate) ctx += `预估成功率: ${violation.estimated_success_rate}\n`
    }
  }

  // 待收集字段的详细说明（帮助DeepSeek理解每个字段的重要性和如何自然地获取）
  const fieldGuide = {
    industry: '行业类型 — 决定申诉策略方向，不同行业需要的证明材料完全不同。自然地问"您是做什么业务的"',
    business_model: '经营模式 — 线上/线下/结合，影响交易凭证准备方式',
    problem_type: '处罚类型 — 交易拦截/收款限额/权限关闭/资金冻结/封禁，决定申诉难度和方案',
    violation_reason: '违规原因 — 微信官方给出的处罚理由，是申诉材料的核心。让用户在"商家助手→风险处理→功能限制记录"中查看',
    merchant_id: '商户号 — 10位数字，在pay.weixin.qq.com或商家助手小程序中查看',
    merchant_name: '商户名称 — 微信支付后台显示的名称',
    company_name: '公司全称 — 营业执照上的名称',
    license_no: '统一社会信用代码 — 18位，营业执照上的编码（可跳过）',
    legal_name: '法人姓名 — 营业执照上的法定代表人',
    legal_id_last4: '身份证后4位 — 用于95017催审身份验证（只需后4位，可跳过）',
    complaint_status: '投诉情况 — 是否有未处理投诉，投诉率影响申诉成功率',
    refund_policy: '退款政策 — 商户的退款流程，没有的话AI会帮拟定',
    bank_name: '开户银行 — 结算账户的银行名称，资金冻结案件必需',
    bank_account_last4: '结算账户后4位 — 拨打95017催审的验证信息（可跳过）',
    contact_phone: '联系电话 — 审核可能电话回访',
    appeal_history: '申诉历史 — 是否申诉过、是否被驳回，影响二次申诉策略',
  }

  // 只为待收集的字段提供指南
  const remainingGuides = []
  for (let i = 0; i < INFO_FIELDS.length; i++) {
    const field = INFO_FIELDS[i]
    const value = data[field.key]
    if (!value || !String(value).trim() || String(value).includes('⏳待补充') || String(value).includes('用户未提供')) {
      if (fieldGuide[field.key]) remainingGuides.push(fieldGuide[field.key])
    }
  }
  if (remainingGuides.length > 0) {
    ctx += `\n【字段收集指南（按优先级）】\n${remainingGuides.slice(0, 5).join('\n')}\n`
  }

  ctx += `\n===== 对话指导 =====\n`
  if (isDueDiligenceScenario(data)) {
    ctx += `你是一位微信支付商户尽职调查填写顾问，正在帮客户准备商家助手小程序的尽调材料。\n`
    ctx += `核心原则：\n`
    ctx += `1. 确认已获取的商户号、公司名称、经营渠道、订单号\n`
    ctx += `2. 引导用户提供2-3笔微信交易单号（420000开头）及对应商品/服务\n`
    ctx += `3. 信息足够时提示用户打开「尽调填写」面板，按步骤复制内容到小程序表单\n`
    ctx += `4. 不要生成申诉书，不要追问「违规原因」\n`
    ctx += `5. 用户粘贴尽调通知时，主动解析商户名称、商户号、截止时间\n`
  } else {
    ctx += `你是一位资深微信商户号申诉顾问（5年经验，处理过数百起案件），正在与客户一对一咨询。\n`
    ctx += `核心原则：\n`
    ctx += `1. 每次回复先确认刚获取的信息，给出相关的专业见解，再自然引导下一个话题\n`
    ctx += `2. 收集到行业+处罚类型+违规原因后，必须主动给出初步风险评估和成功率判断\n`
    ctx += `3. 每次只引导1-2个信息，像专业咨询不像填表\n`
    ctx += `4. 优先收集：行业→经营模式→处罚类型→违规原因（这4个是分析基础）\n`
    ctx += `5. 如果用户一次性提供了多个信息，全部确认并给出综合分析\n`
    ctx += `6. 用户有情绪/焦虑时先安抚，给出专业判断让用户安心\n`
    ctx += `7. 不要用[X/16]格式，不要说"当前问题"，像真人顾问一样自然对话\n`
    ctx += `8. 对于可跳过的字段（信用代码、身份证后四位、账户后四位），如果用户不方便提供可以跳过\n`
  }

  return ctx
}

/**
 * 构建 AI 生成报告所需的上下文 prompt
 * @param {object} collectedData 收集的商户信息
 * @param {Array} successCases 相关成功案例（从知识库查询）
 * @param {object} orderInfo 绑定的订单信息（可选）
 */
export function buildReportPrompt(collectedData, successCases = [], orderInfo = null) {
  const d = collectedData

  // 订单上下文 - 如果绑定了订单
  let orderSection = ''
  if (orderInfo) {
    const orderAmount = orderInfo.total_amount > 10000 ? (orderInfo.total_amount / 100).toFixed(2) : orderInfo.total_amount
    orderSection = `
## 当前处理订单信息

- **订单号**: ${orderInfo.order_no || '未知'}
${orderInfo.buyer_nick || orderInfo.customer_name ? `- **买家昵称**: ${orderInfo.buyer_nick || orderInfo.customer_name}` : ''}
${orderInfo.receiver_mobile || orderInfo.buyer_phone || orderInfo.customer_phone ? `- **联系电话**: ${orderInfo.receiver_mobile || orderInfo.buyer_phone || orderInfo.customer_phone}` : ''}
${orderInfo.goods?.title || orderInfo.product_name ? `- **商品名称**: ${orderInfo.goods?.title || orderInfo.product_name}` : ''}
- **订单金额**: ¥${orderAmount}
${orderInfo.status ? `- **订单状态**: ${orderInfo.status}` : ''}
${orderInfo.receiver_address ? `- **收货地址**: ${orderInfo.receiver_address}` : ''}

请在生成申诉材料时，结合以上订单信息给出更有针对性的建议。
`
  }

  // 匹配行业知识
  const ind = matchIndustry(d.industry || '')
  let industrySection = ''
  if (ind) {
    industrySection = `
## 行业专业知识（${ind.key}行业）

- **常见违规类型**：${ind.commonViolations.join('、')}
- **申诉要点**：${ind.appealTips}
- **参考业务模式描述**：${ind.businessModel}

请根据以上行业特点，生成更有针对性的申诉材料。`
  }

  // 匹配违规原因知识
  const viol = matchViolation(d.violation_reason || '')
  let violationSection = ''
  if (viol) {
    violationSection = `
## 违规类型专业知识（${viol.key}）

- **描述**：${viol.description}
- **申诉要点**：${viol.appeal_key_points.join('；')}
- **必需材料**：${viol.required_materials.join('、')}
- **常见驳回原因**：${viol.common_rejection_reasons.join('、')}
- **成功关键**：${viol.success_key}

请在生成材料时，重点围绕以上申诉要点撰写，并规避常见驳回原因。`
  }

  // 风险评估
  const risk = assessRisk(d)
  let riskSection = `
## 风险评估结果

- **难度等级**：${risk.level}（评分${risk.riskScore}/100）
- **预估成功率**：${risk.successRate}
- **关键因素**：${risk.factors.join('；')}
${risk.tips.length > 0 ? `- **特别提醒**：${risk.tips.join('；')}` : ''}`

  // 申诉历史策略
  let appealHistorySection = ''
  const ah = (d.appeal_history || '').toLowerCase()
  if (ah.includes('驳回') || ah.includes('失败') || ah.includes('拒绝')) {
    appealHistorySection = `
## 二次申诉策略（重要！）

此用户之前有被驳回的申诉历史，请在生成材料时：
1. 比首次申诉更加详细和专业
2. 针对可能的驳回原因（投诉未处理、材料不足、业务模式不清）逐条加强说明
3. 在整改说明中体现"持续改进"的态度
4. 建议用户先拨打95017转3查询具体驳回原因后再提交`
  }

  // 合并所有成功案例（数据库案例 + 内置匹配案例）
  const builtInMatched = matchBuiltInCases(d.problem_type, d.industry, d.violation_reason)
  const allCases = [...successCases]
  builtInMatched.forEach(bc => {
    if (!allCases.some(c => c.title === bc.title)) {
      allCases.push({
        title: bc.title,
        industry: bc.industry,
        problem_type: bc.problem_type,
        success_summary: bc.success_summary,
        report_content: bc.appeal_points ? bc.appeal_points.join('；') : ''
      })
    }
  })

  let casesSection = ''
  if (allCases.length > 0) {
    casesSection = `
## 成功案例参考

以下是与本案类似的已成功申诉案例，请参考其策略和措辞风格：

${allCases.slice(0, 5).map((c, i) => `### 案例${i + 1}：${c.title}
- **行业**：${c.industry || '未知'}
- **处罚类型**：${c.problem_type || '未知'}
- **成功要点**：${c.success_summary || '材料充分、整改到位'}
${c.report_content ? `- **申诉材料参考**：${c.report_content.slice(0, 500)}` : ''}
`).join('\n')}

请吸取以上成功案例的经验，在生成材料时参考其策略。`
  }

  // ===== 动态构建违规专项写作策略 =====
  const vr = (d.violation_reason || '').toLowerCase()
  let violationWritingStrategy = ''
  if (vr.includes('交易异常') || vr.includes('异常交易')) {
    violationWritingStrategy = `\n## 【交易异常】专项写作策略\n申诉材料核心论证逻辑：交易波动有合理商业原因→用数据证明→提供完整交易闭环\n- 业务模式部分：重点阐述交易模式的合理性，解释为什么会出现交易波动（促销活动/季节旺季/新品上市/媒体曝光引流）\n- 整改说明：强调交易监控机制和风控合规意识\n- 证据链组织：按"交易单号→商品详情→付款凭证→发货记录→物流签收"顺序组织\n`
  } else if (vr.includes('纠纷') || vr.includes('投诉')) {
    violationWritingStrategy = `\n## 【交易纠纷】专项写作策略\n申诉材料核心论证逻辑：投诉已100%处理→分析投诉根因→展示整改成效→承诺持续优化\n- 投诉处理部分：必须逐条说明每笔投诉的处理结果（退款金额、处理日期、用户确认状态）\n- 退款规则部分：展示完善的退款流程，体现商户诚意\n- 整改说明：围绕降低投诉率的具体措施（售前告知、售后响应时效、退款通道优化）\n`
  } else if (vr.includes('套现') || vr.includes('信用卡')) {
    violationWritingStrategy = `\n## 【信用卡套现嫌疑】专项写作策略\n申诉材料核心论证逻辑：每笔交易都有真实商品/服务交付→交易双方无关联→资金流向合理\n- 业务模式部分：详细说明商品/服务交付流程，强调交易的真实性\n- 证据链组织：每笔被质疑交易都需"订单→商品→付款→发货→物流→签收"完整链路\n- 关键论点：交易对手分散（不同收货地址）、商品价值与金额匹配、无快速退款行为\n`
  } else if (vr.includes('跨类目') || vr.includes('类目')) {
    violationWritingStrategy = `\n## 【跨类目经营】专项写作策略\n申诉材料核心论证逻辑：已整改到位→营业执照经营范围已覆盖→商户类目已变更/申请变更\n- 业务模式部分：详细说明当前实际经营范围，与营业执照的对应关系\n- 整改说明：展示已下架不符商品的截图、已变更或正在变更经营范围的凭证\n`
  } else if (vr.includes('欺诈') || vr.includes('售假') || vr.includes('虚假')) {
    violationWritingStrategy = `\n## 【欺诈/售假嫌疑】专项写作策略\n申诉材料核心论证逻辑：商品为正品→有完整授权链条→有质检报告→已修正所有宣传内容\n- 业务模式部分：展示品牌授权链条（品牌方→总代→经销商→本商户）\n- 证据链组织：品牌授权书→进货发票→质检报告→实物拍摄→物流签收\n- 如有虚假宣传历史：坦诚承认并展示已修改的宣传内容截图\n`
  } else if (vr.includes('分销') || vr.includes('传销')) {
    violationWritingStrategy = `\n## 【多级分销嫌疑】专项写作策略\n申诉材料核心论证逻辑：仅一级分销→无入门费→无囤货→分销员可随时退出\n- 业务模式部分：清晰描述分销模式，用图表展示佣金结构（仅直推一层）\n- 整改说明：如果之前有多级，展示已关闭多级功能的后台截图和新规则\n`
  }

  // ===== 动态构建证据链组织指导 =====
  let evidenceGuide = ''
  const pt = (d.problem_type || '').toLowerCase()
  if (d.industry) {
    const ind_lower = d.industry.toLowerCase()
    if (ind_lower.includes('餐饮') || ind_lower.includes('外卖')) {
      evidenceGuide = '\n## 证据组织建议（餐饮行业）\n按以下顺序组织证据：①门店实景照片（至少6张，含门头、内部、后厨、菜品）→②食品经营许可证→③外卖平台店铺截图→④真实订单+配送记录→⑤好评截图\n'
    } else if (ind_lower.includes('游戏') || ind_lower.includes('陪玩')) {
      evidenceGuide = '\n## 证据组织建议（游戏/陪玩行业）\n按以下顺序组织证据：①平台入驻/软著证明→②实名认证+防沉迷系统截图→③接单记录+对局截图→④客户评价→⑤内容审核机制说明\n'
    } else if (ind_lower.includes('电商') || ind_lower.includes('零售') || ind_lower.includes('直播')) {
      evidenceGuide = '\n## 证据组织建议（电商/零售行业）\n按以下顺序组织证据：①店铺后台数据截图→②进货合同/发票→③商品实拍→④订单+物流发货记录→⑤客户好评/签收截图→⑥如有直播：直播录屏\n'
    } else if (ind_lower.includes('教育') || ind_lower.includes('知识') || ind_lower.includes('培训')) {
      evidenceGuide = '\n## 证据组织建议（教育/知识付费行业）\n按以下顺序组织证据：①办学许可/ICP备案→②课程大纲+师资证明→③课程交付截图（学员学习记录）→④学员评价→⑤退费政策+退款处理记录\n'
    } else if (ind_lower.includes('美容') || ind_lower.includes('医美')) {
      evidenceGuide = '\n## 证据组织建议（美容/医美行业）\n按以下顺序组织证据：①卫生许可证→②从业人员资质证书→③门店实景+价目表→④服务记录+客户知情同意书→⑤好评截图\n'
    } else if (ind_lower.includes('科技') || ind_lower.includes('saas') || ind_lower.includes('软件')) {
      evidenceGuide = '\n## 证据组织建议（SaaS/科技行业）\n按以下顺序组织证据：①软件著作权证书→②客户服务合同（脱敏）→③系统后台/产品截图→④客户验收报告→⑤客户使用反馈\n'
    }
  }

  return `你是专为商家打造的**微信支付商户号申诉**战略专家AI，拥有8年微信支付风控申诉实战经验，以最高申诉成功率为唯一目标。请根据以下商户信息，生成一份完整的微信商户申诉评估报告和可直接提交到 pay.weixin.qq.com 的申诉材料。

████████████████████████████████████████████
█ 【最高优先级 — 反幻觉铁律，违反即报废】 █
████████████████████████████████████████████

⛔ 所有输出100%只能基于下方"商户收集信息"中用户实际提供的内容！
⛔ "未提供"的字段 = 不存在，严禁在报告中编造、脑补、填充！
⛔ 用户说"游戏陪练"→只能写"游戏陪练"，绝不能添加"王者荣耀""和平精英"等具体游戏名！
⛔ 用户说"有"/"已经有了"→只能写"已建立相关机制"，绝不能编造"7×24小时审核""敏感词过滤""AI巡查"等具体措施！
⛔ 用户没说的=不存在。禁止"合理推测""行业惯例补充""为了可信度添加细节"！
⛔ 申诉材料中的每一句话都必须能在用户原始输入中找到依据，无依据的内容一律删除！
⛔ 宁可简短真实，也不要丰富但虚假！
⛔ 审核人员能看到商户的真实交易数据，编造的数字会被识破并导致申诉失败！

## 商户收集信息（以下为用户实际提供的全部信息，"未提供"表示用户没说过）

- **处罚类型**：${d.problem_type || '未提供'}
- **违规原因**：${d.violation_reason || '未提供'}
- **商户号**：${d.merchant_id || '未提供'}
- **商户名称**：${d.merchant_name || '未提供'}
- **公司全称**：${d.company_name || '未提供'}
- **统一社会信用代码**：${d.license_no || '未提供'}
- **法人姓名**：${d.legal_name || '未提供'}
- **身份证后四位**：${d.legal_id_last4 || '未提供'}
- **所属行业**：${d.industry || '未提供'}
- **经营模式**：${d.business_model || '未提供'}
- **投诉情况**：${d.complaint_status || '未提供'}
- **退款政策**：${d.refund_policy || '未提供'}
- **开户银行**：${d.bank_name || '未提供'}
- **结算账户后四位**：${d.bank_account_last4 || '未提供'}
- **联系电话**：${d.contact_phone || '未提供'}
- **申诉历史**：${d.appeal_history || '未提供'}
${industrySection}${violationSection}${riskSection}${appealHistorySection}${casesSection}${violationWritingStrategy}${evidenceGuide}
## 写作总原则

1. **站在审核人员角度写**：审核员每天处理50-80个案件，材料要让他一眼看到重点，逻辑清晰、证据充分
2. **论证逻辑**：每部分围绕"事实陈述→原因分析→证据支撑→整改承诺"的逻辑链展开
3. **语言风格**：正式严谨但不生硬，体现商户的专业性和诚意，避免情绪化表达和过度辩解
4. **证据引用**：提到的证据必须是用户可以实际提供的，不要引用不存在的文件或数据
5. **措辞技巧**：用"经核实""经排查""已完成""将持续"等正式用语；避免"绝对""从不"等极端词

## 输出要求

请生成以下完整报告，**每部分≤300字**，语言正式、严谨、措辞合理，不使用任何标点符号装饰（如emoji），内容可直接复制粘贴到微信申诉表单对应位置使用。
**再次强调：只使用用户实际提供的信息，"未提供"字段不得在报告正文中出现或被编造填充。**

### 案情评估
分析处罚原因、案件难度、预估成功率和参考价格。只基于已知信息评估。
需包含：①风控触发原因分析（推测是规则引擎/模型层/人工审核哪层触发）②难度评级和成功率预估 ③关键风险点和注意事项 ④参考价格区间

### 一、投诉处理方法
根据商户实际提供的投诉情况说明处理措施。如用户说无投诉，则如实说明无投诉。不得编造投诉处理细节。
有投诉时的写作框架：①投诉概况（数量、类型）→②已采取的处理措施（逐条说明）→③处理结果（退款金额、用户确认状态）→④预防措施

### 二、退款规则
根据商户实际提供的退款信息整理为正式文本。如用户未提供退款政策，只写"商户承诺建立完善退款流程"，不得编造具体退款天数、比例等细节。
写作要点：退款条件→退款流程→退款时效→争议处理→联系方式

### 三、投诉生成原因及详情
基于用户实际描述的违规/投诉情况，客观陈述事实。只使用用户告诉你的原因，不得添加用户未提及的情节。
写作框架：①客观描述被处罚的事实→②分析可能的触发原因（基于行业特点和交易模式）→③如为误判，说明误判的合理推断→④表达配合审核的态度

### 四、业务模式
严格基于用户提供的行业、经营模式信息撰写。用户说"游戏陪练"就只写"游戏陪练服务"，不得添加用户未提及的具体游戏名称、具体服务场景、具体技术系统等细节。用户说"纯线上"就写"纯线上经营"，不得编造具体的线上渠道细节。
写作框架：①企业基本信息→②主营业务描述→③经营模式（线上/线下/结合）→④交易流程概述→⑤合规资质说明

### 五、整改说明
基于用户实际提供的信息制定整改方案。用户说"有实名认证"就写"已建立实名认证机制"，不得编造"7×24小时审核团队""AI内容审核系统""敏感词过滤"等用户未提及的具体措施。承诺部分可以写"将持续完善"，但已完成部分只能写用户确认过的。
写作框架：①问题认识和反思→②已完成的整改措施（仅基于用户提供的信息）→③后续改进计划（可用"将持续完善""计划建立"等承诺性表述）→④合规运营承诺
${(d.problem_type || '').includes('冻结') || (d.problem_type || '').includes('延迟') ? `
### 六、资金解冻说明
此案件涉及资金冻结/延迟结算，请额外生成：
- 资金来源合法性说明（基于业务模式说明资金均来自正常经营收入）
- 结算账户验证配合声明（开户银行：${d.bank_name || '待提供'}，账户后四位：${d.bank_account_last4 || '待提供'}）
- 解冻后资金用途说明（用于日常经营、供应商结算、员工薪资等合理用途）
- 配合审核承诺：愿意配合提供任何所需的补充材料和信息
- 建议用户拨打95017转3，提供商户号和结算账户后四位催促审核
` : ''}
---

### 申诉材料清单（帮用户列出需要准备的材料）

根据本案的行业、违规类型和处罚类型，列出用户需要准备的全部材料清单，分为：
1. **必需材料**（缺一不可）：证件类+交易凭证类
2. **强烈建议**（显著提升成功率）：行业资质+经营证明
3. **加分材料**（锦上添花）：客户评价、经营数据等
每项材料注明：名称、用途说明、获取方式

### 申诉提交指南

请根据用户的平台类型（微信/支付宝/抖音/快手/美团等），生成对应的申诉提交指南。
如用户未明确平台，默认按微信支付生成。

**微信支付申诉路径：**
1. **提交方式**：微信支付商家助手小程序 → 风险处理 → 申诉中心 → 发起申诉
2. **材料上传要求**：照片清晰、文字可辨、建议用PDF/Word整理（更专业，审核员更容易阅读）
3. **订单号格式**：必须是微信支付订单号（4开头28位），不是商户系统订单号
4. **最佳提交时间**：工作日上午9-11点（避开周末和节假日，无人审核）
5. **时间提醒**：补充资料通道通常只开放24小时，审核3-7个工作日
6. **催审策略**：提交后第3个工作日拨打95017转3催审，准备好商户号+结算账户后四位
7. **被驳回处理**：先打95017转3查询具体原因，间隔3-5天后针对性补充增量材料重新提交
8. **重要警告**：连续申诉5次不通过可能被标记为"不支持申诉"，务必每次都充分准备

**支付宝申诉路径（如适用）：** 支付宝商家中心(b.alipay.com) → 账户管理 → 申诉，或拨打95188转商户服务
**抖音/快手申诉路径（如适用）：** 对应平台商家后台 → 店铺管理/违规管理 → 申诉中心，或联系飞鸽客服
**美团申诉路径（如适用）：** 美团商家版APP → 店铺 → 违规管理 → 申诉

### 迭代优化建议

请根据本案情况，输出以下迭代记录供系统学习：
1. **违规类型归档**：本案属于哪类违规（交易异常/资金冻结/投诉过多/内容违规等）
2. **方案有效性评估**：本方案的预估成功率和关键策略
3. **优化建议**：如果申诉失败，下次应该重点补充哪些材料或调整哪些策略
4. **二次申诉预案**：若首次被驳回，建议的增量证据和策略调整方向`
}

export { INFO_FIELDS, TOTAL_STEPS, LOCAL_WELCOME, INDUSTRY_KNOWLEDGE, matchIndustry, normalizeFieldValue, matchViolation, matchBuiltInCases, assessRisk, generateMaterialChecklist, findNextUnfilledStep, extractFieldsFromMessage }
