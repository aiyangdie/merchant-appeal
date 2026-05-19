/**
 * 订单工具函数库
 * 
 * 功能说明：
 * - 提供订单状态映射、格式化、排序等常用操作
 * - 包含订单金额格式化、地址拼接、状态标签生成
 * - 提供退款状态映射和格式化
 * 
 * 使用场景：
 * - 订单列表渲染时的状态样式和标签显示
 * - 订单详情页的金额和地址格式化
 * - 订单排序（待发货订单优先显示）
 * - 申诉表单字段的标签映射
 */

/**
 * 订单状态常量
 * 
 * 说明：
 * - PENDING_SHIP (12): 待发货状态，用于排序时优先显示
 * - REFUNDED (23): 已退款状态，用于过滤或特殊处理
 * 
 * @constant {Object}
 */
export const ORDER_STATUS = {
  PENDING_SHIP: 12,  // 待发货
  REFUNDED: 23,      // 已退款
}

/**
 * 订单状态映射表
 * 
 * 说明：
 * - 键为订单状态码（数字）
 * - 值为包含 label（标签文本）、bg（背景色类名）、text（文字颜色类名）的对象
 * - 状态码来源于闲鱼 API 返回的 order_status 字段
 * 
 * 状态列表：
 * - 11: 待付款（黄色）
 * - 12: 待发货（绿色）
 * - 13: 待发货（绿色，部分场景使用）
 * - 21: 已发货（蓝色）
 * - 22: 已完成（翠绿色）
 * - 23: 已退款（灰色）
 * - 24: 已关闭（红色）
 * 
 * @constant {Object.<number, {label: string, bg: string, text: string}>}
 */
export const ORDER_STATUS_MAP = {
  11: { label: '待付款', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  12: { label: '待发货', bg: 'bg-green-100', text: 'text-green-700' },
  13: { label: '待发货', bg: 'bg-green-100', text: 'text-green-700' },
  21: { label: '已发货', bg: 'bg-blue-100', text: 'text-blue-700' },
  22: { label: '已完成', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  23: { label: '已退款', bg: 'bg-gray-100', text: 'text-gray-500' },
  24: { label: '已关闭', bg: 'bg-red-100', text: 'text-red-500' },
}

/**
 * 退款状态映射表
 * 
 * 说明：
 * - 键为退款状态码（数字）
 * - 值为包含 label（标签文本）、bg（背景色类名）、text（文字颜色类名）的对象
 * - 状态码来源于闲鱼 API 返回的 refund_status 字段
 * 
 * 状态列表：
 * - 0: 未申请退款（浅灰色）
 * - 1: 退款申请待商家处理（橙色）
 * - 2: 待买家退货（黄色）
 * - 3: 待商家确认收货（琥珀色）
 * - 4: 退款关闭（灰色，如买家取消）
 * - 5: 退款成功（绿色）
 * - 6: 商家已拒绝退款（红色）
 * 
 * @constant {Object.<number, {label: string, bg: string, text: string}>}
 */
export const REFUND_STATUS_MAP = {
  0: { label: '未申请', bg: 'bg-gray-50', text: 'text-gray-400' },
  1: { label: '待商家处理', bg: 'bg-orange-100', text: 'text-orange-700' },
  2: { label: '待买家退货', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  3: { label: '待商家收货', bg: 'bg-amber-100', text: 'text-amber-700' },
  4: { label: '退款关闭', bg: 'bg-gray-100', text: 'text-gray-500' },
  5: { label: '退款成功', bg: 'bg-green-100', text: 'text-green-700' },
  6: { label: '已拒绝', bg: 'bg-red-100', text: 'text-red-500' },
}

/**
 * 订单排序函数
 * 
 * 功能说明：
 * - 将待发货订单（status=12）排在列表最前面
 * - 其他订单保持原有顺序
 * - 用于订单列表展示时优先显示需要处理的订单
 * 
 * @param {Array} orders - 订单数组
 * @returns {Array} 排序后的新订单数组（不修改原数组）
 * 
 * @example
 * const sorted = sortOrdersByStatus(orders)
 * // 待发货订单会排在最前面
 */
export function sortOrdersByStatus(orders) {
  // 如果输入不是数组，返回空数组
  if (!Array.isArray(orders)) return []
  
  // 创建新数组进行排序（不修改原数组）
  return [...orders].sort((a, b) => {
    // a 是待发货，b 不是，a 排前面
    if (a.order_status === ORDER_STATUS.PENDING_SHIP && b.order_status !== ORDER_STATUS.PENDING_SHIP) return -1
    // b 是待发货，a 不是，b 排前面
    if (b.order_status === ORDER_STATUS.PENDING_SHIP && a.order_status !== ORDER_STATUS.PENDING_SHIP) return 1
    // 其他情况保持原顺序
    return 0
  })
}

/**
 * 格式化订单金额
 * 
 * 功能说明：
 * - 优先使用分单位的字段（pay_amount_fen、total_amount_fen），除以 100 转换为元
 * - 如果没有分单位字段，使用元单位字段（pay_amount、price、total_amount）
 * - 处理各种边界情况（null、undefined、NaN）
 * 
 * 字段优先级：
 * 1. pay_amount_fen（实付金额，分）
 * 2. total_amount_fen（总金额，分）
 * 3. pay_amount（实付金额，元）
 * 4. price（价格，元）
 * 5. total_amount（总金额，元）
 * 6. goods.price（商品内嵌价格）
 * 
 * @param {Object|null} order - 订单对象
 * @returns {string} 格式化后的金额字符串，保留两位小数，如 '128.50'
 * 
 * @example
 * formatOrderAmount({ pay_amount_fen: 12850 })  // '128.50'
 * formatOrderAmount({ pay_amount: 128.5 })       // '128.50'
 * formatOrderAmount(null)                        // '0.00'
 */
export function formatOrderAmount(order) {
  // 空订单返回默认值
  if (!order) return '0.00'
  
  // 优先检查分单位字段
  if (order.pay_amount_fen != null) {
    const val = Number(order.pay_amount_fen)
    if (!isNaN(val)) return (val / 100).toFixed(2)
  }
  if (order.total_amount_fen != null) {
    const val = Number(order.total_amount_fen)
    if (!isNaN(val)) return (val / 100).toFixed(2)
  }
  
  // 使用元单位字段
  let amount = order.pay_amount ?? order.price ?? order.total_amount ?? order.goods?.price ?? 0
  // 处理非数字或 NaN 情况
  if (typeof amount !== 'number' || isNaN(amount)) {
    amount = 0
  }
  return amount.toFixed(2)
}

/**
 * 获取订单状态的样式配置
 * 
 * 功能说明：
 * - 优先使用 order_status 字段（数字状态码）查询 ORDER_STATUS_MAP
 * - 如果没有 order_status，使用 status 字段（可能是字符串标签）
 * - 返回包含标签文本、背景色、文字颜色的样式对象
 * 
 * @param {string|null} status - 订单状态标签（可选，用于覆盖默认标签文本）
 * @param {number|null} orderStatus - 订单状态码（优先使用）
 * @returns {{label: string, bg: string, text: string}} 样式配置对象
 * 
 * @example
 * getOrderStatusStyle('待付款', 12)  // { label: '待付款', bg: 'bg-green-100', text: 'text-green-700' }
 * getOrderStatusStyle(null, 23)      // { label: '已退款', bg: 'bg-gray-100', text: 'text-gray-500' }
 */
export function getOrderStatusStyle(status, orderStatus) {
  // 优先使用数字状态码
  if (orderStatus != null) {
    const entry = ORDER_STATUS_MAP[orderStatus]
    // 如果找到映射，返回样式（使用传入的 status 覆盖默认 label）
    if (entry) return { ...entry, label: status || entry.label }
  }
  // 回退到使用 status 字段
  return formatOrderStatusLabel(status)
}

/**
 * 格式化订单状态标签
 * 
 * 功能说明：
 * - 根据状态码或状态文本返回对应的样式配置
 * - 如果状态码不在映射表中，返回默认样式
 * 
 * @param {number|string|null} status - 订单状态码或状态文本
 * @returns {{label: string, bg: string, text: string}} 样式配置对象
 * 
 * @example
 * formatOrderStatusLabel(12)  // { label: '待发货', bg: 'bg-green-100', text: 'text-green-700' }
 * formatOrderStatusLabel('未知')  // { label: '未知', bg: 'bg-gray-50', text: 'text-gray-500' }
 */
export function formatOrderStatusLabel(status) {
  const entry = ORDER_STATUS_MAP[status]
  // 如果找到映射，返回副本
  if (entry) return { ...entry }
  // 未找到映射，返回默认样式
  return { label: status || '未知', bg: 'bg-gray-50', text: 'text-gray-500' }
}

/**
 * 格式化退款状态标签
 * 
 * 功能说明：
 * - 根据退款状态码返回对应的样式配置
 * - 如果状态码不在映射表中，返回默认样式
 * 
 * @param {number|null} status - 退款状态码（0-6）
 * @returns {{label: string, bg: string, text: string}} 样式配置对象
 * 
 * @example
 * formatRefundStatusLabel(1)  // { label: '待商家处理', bg: 'bg-orange-100', text: 'text-orange-700' }
 * formatRefundStatusLabel(5)  // { label: '退款成功', bg: 'bg-green-100', text: 'text-green-700' }
 */
export function formatRefundStatusLabel(status) {
  const entry = REFUND_STATUS_MAP[status]
  // 如果找到映射，返回副本
  if (entry) return { ...entry }
  // 未找到映射，返回默认样式
  return { label: status || '未知', bg: 'bg-gray-50', text: 'text-gray-500' }
}

/**
 * 格式化完整收货地址
 * 
 * 功能说明：
 * - 优先使用已拼接的完整地址字段（receiver_full_address）
 * - 如果没有完整地址，将省、市、区、镇、详细地址拼接
 * - 自动过滤空的地址部分
 * 
 * @param {Object|null} order - 订单对象
 * @returns {string} 完整的收货地址字符串
 * 
 * @example
 * formatFullAddress({ receiver_prov: '广东省', receiver_city: '深圳市', receiver_address: '南山区xxx' })
 * // '广东省 深圳市 南山区xxx'
 */
export function formatFullAddress(order) {
  if (!order) return ''
  // 优先使用已拼接的完整地址
  if (order.receiver_full_address) return order.receiver_full_address
  
  // 拼接各级地址
  const parts = [
    order.receiver_prov,    // 省
    order.receiver_city,    // 市
    order.receiver_area,    // 区
    order.receiver_town,    // 镇/街道
    order.receiver_address, // 详细地址
  ].filter(Boolean)  // 过滤空值
  
  return parts.join(' ')  // 用空格连接
}

/**
 * 格式化发货类型标签
 * 
 * 功能说明：
 * - 根据发货类型返回对应的标签文本
 * - 发货类型来源于闲鱼 API 的 consign_type 字段
 * 
 * @param {number|null} consignType - 发货类型码
 * @returns {{label: string}} 标签对象
 * 
 * @example
 * formatConsignLabel(1)  // { label: '物流发货' }
 * formatConsignLabel(2)  // { label: '虚拟发货' }
 */
export function formatConsignLabel(consignType) {
  if (consignType === 1) return { label: '物流发货' }
  if (consignType === 2) return { label: '虚拟发货' }
  return { label: '未发货' }
}

/**
 * 响应式断点常量
 * 
 * 说明：
 * - 用于媒体查询或响应式布局的断点值（像素）
 * - SM: 小屏幕（手机）
 * - LG: 大屏幕（平板/桌面）
 * - XL: 超大屏幕（桌面）
 * 
 * @constant {Object}
 */
export const BREAKPOINTS = {
  SM: 640,   // 小屏幕断点（640px）
  LG: 1024,  // 大屏幕断点（1024px）
  XL: 1280,  // 超大屏幕断点（1280px）
}

/**
 * 申诉表单字段标签映射表
 * 
 * 说明：
 * - 键为字段标识符（用于代码中引用）
 * - 值为显示给用户的中文标签
 * - 用于申诉表单的字段提示和标签显示
 * 
 * @constant {Object.<string, string>}
 */
export const FIELD_LABELS = {
  problem_type: '处罚类型',
  violation_reason: '违规原因',
  merchant_id: '商户号',
  merchant_name: '商户名称',
  company_name: '公司全称',
  license_no: '信用代码',
  legal_name: '法人姓名',
  legal_id_last4: '身份证后四位',
  industry: '所属行业',
  business_model: '经营模式',
  complaint_status: '投诉情况',
  refund_policy: '退款政策',
  bank_name: '开户银行',
  bank_account_last4: '账户后四位',
  contact_phone: '联系电话',
  appeal_history: '申诉历史',
  business_scenario: '经营场景',
  miniprogram_name: '小程序名称',
  miniprogram_appid: 'AppID',
  order_info: '订单信息',
}

/**
 * 检测字符串是否为纯中文
 * 
 * 功能说明：
 * - 使用正则表达式匹配中文字符（包括基本汉字和扩展区汉字）
 * - 支持 CJK 统一汉字的所有区段
 * - 自动去除首尾空白后检测
 * 
 * 覆盖的汉字范围：
 * - 基本汉字：\u4e00-\u9fff
 * - 扩展 A 区：\u3400-\u4dbf
 * - 扩展 B-I 区：\u{20000}-\u{2ebef}
 * - 扩展 CJK 区：\u{30000}-\u{3134f}
 * 
 * @param {string|null} str - 待检测的字符串
 * @returns {boolean} 是否为纯中文字符串
 * 
 * @example
 * isChinese('你好')      // true
 * isChinese('Hello')     // false
 * isChinese('你好123')   // false（包含数字）
 * isChinese('  中文  ')  // true（自动 trim）
 */
export function isChinese(str) {
  if (!str) return false
  // 匹配纯中文字符（包括扩展汉字）
  return /^[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}]+$/u.test(str.trim())
}

/**
 * 清洗采集的原始数据
 * 
 * 功能说明：
 * - 过滤掉以 _ 开头的内部字段（如 _source、_confidence）
 * - 将所有值转换为字符串类型
 * - 处理 null、undefined 等非字符串值
 * - 返回干净的键值对对象，用于后续处理
 * 
 * @param {Object|null} raw - 原始采集数据对象
 * @returns {Object} 清洗后的数据对象（只包含字符串值）
 * 
 * @example
 * sanitizeCollected({ name: '张三', _source: 'ocr', age: 25 })
 * // { name: '张三', age: '25' }
 * 
 * sanitizeCollected(null)
 * // {}
 */
export function sanitizeCollected(raw) {
  // 空值或非对象返回空对象
  if (!raw || typeof raw !== 'object') return {}
  
  const clean = {}
  for (const [k, v] of Object.entries(raw)) {
    // 跳过内部字段（以 _ 开头）
    if (k.startsWith('_')) continue
    // 转换为字符串，null/undefined 转为空字符串
    clean[k] = typeof v === 'string' ? v : v != null ? String(v) : ''
  }
  return clean
}

/**
 * 格式化时间戳/日期为本地时间字符串
 * 
 * 功能说明：
 * - 支持多种输入格式：时间戳（秒/毫秒）、日期字符串、Date 对象
 * - 使用中国本地时区格式（zh-CN）
 * - 处理无效日期，返回原始字符串的前16个字符
 * 
 * @param {number|string|Date|null} d - 时间戳、日期字符串或 Date 对象
 * @returns {string} 格式化后的时间字符串，如 '2024/1/15 14:30'
 * 
 * @example
 * fmtTime(1705305000000)       // '2024/1/15 14:30:00'
 * fmtTime('2024-01-15T14:30')  // '2024/1/15 14:30'
 * fmtTime(null)                // ''
 */
export function fmtTime(d) {
  if (!d) return ''
  try {
    const num = Number(d)
    if (Number.isFinite(num) && num > 0) {
      const ms = num < 1e12 ? num * 1000 : num
      const t = new Date(ms)
      if (!isNaN(t.getTime())) return t.toLocaleString('zh-CN')
    }
    const t = new Date(d)
    return isNaN(t.getTime()) ? String(d).slice(0, 19) : t.toLocaleString('zh-CN')
  } catch {
    return String(d)
  }
}
