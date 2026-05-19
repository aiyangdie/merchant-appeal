/**
 * 闲管家开放平台 API 集成模块（对齐 xgj-sdk-python-20260424）
 * 网关：https://open.goofish.pro
 * 签名（与官方 Python SDK 一致）：
 * - 4 段：md5(appKey,bodyMd5,timestamp,appSecret)
 * - 5 段（有 seller_id）：md5(appKey,bodyMd5,timestamp,sellerId,appSecret)
 * 可选 6 段（仅当 XIANYU_USE_MCH_SIGN=1 且配置了 mch 凭证）
 */
import crypto from 'crypto'
import { getPool } from './db.js'
import { safeDecrypt } from './utils/crypto.js'

const cache = new Map()

function getCache(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() > item.expireAt) { cache.delete(key); return null }
  return item.data
}

function setCache(key, data, ttl = 300) {
  cache.set(key, { data, expireAt: Date.now() + (ttl * 1000) })
}

// ========== 签名函数 ==========

function generateSign6Param(appId, appSecret, bodyJson, timestamp, mchId, mchSecret) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '{}').digest('hex')
  const signStr = `${appId},${appSecret},${bodyMd5},${timestamp},${mchId},${mchSecret}`
  return crypto.createHash('md5').update(signStr).digest('hex')
}

function generateSign4Param(appKey, bodyJson, timestamp, appSecret) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '{}').digest('hex')
  const signStr = `${appKey},${bodyMd5},${timestamp},${appSecret}`
  return crypto.createHash('md5').update(signStr).digest('hex')
}

function generateSign5Param(appKey, bodyJson, timestamp, sellerId, appSecret) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '{}').digest('hex')
  const signStr = `${appKey},${bodyMd5},${timestamp},${sellerId},${appSecret}`
  return crypto.createHash('md5').update(signStr).digest('hex')
}

/** 与 Python SDK 一致：紧凑 JSON，空对象为 {} */
function compactJson(body) {
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) return '{}'
  return JSON.stringify(body)
}

function resolveSellerId(shopId) {
  if (shopId == null || shopId === '') return null
  const n = Number(shopId)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

function buildPageBody({ page = 1, pageSize = 20, page_no, page_size } = {}) {
  return {
    page_no: Math.max(1, parseInt(page_no ?? page, 10) || 1),
    page_size: Math.min(100, Math.max(1, parseInt(page_size ?? pageSize, 10) || 20)),
  }
}

function buildCreateTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return null
  const toSec = (v) => {
    if (v == null || v === '') return null
    const n = Number(v)
    if (Number.isFinite(n) && n > 1e9) return n < 1e12 ? Math.floor(n) : Math.floor(n / 1000)
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? Math.floor(t / 1000) : null
  }
  const start = toSec(startTime) ?? 0
  const end = toSec(endTime) ?? Math.floor(Date.now() / 1000)
  return [start, end]
}

/** 商品列表 update_time 区间（秒），与官方 SDK 测试一致 */
function buildUpdateTimeRange(startTime, endTime, daysBack) {
  const now = Math.floor(Date.now() / 1000)
  if (daysBack != null && Number(daysBack) > 0) {
    return [now - Math.floor(Number(daysBack)) * 86400, now]
  }
  const range = buildCreateTimeRange(startTime, endTime)
  return range || null
}

// ========== 核心请求函数 ==========

async function request(path, body = {}, options = {}) {
  const baseUrl = process.env.XIANYU_API_BASE_URL || 'https://open.goofish.pro'
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const credentials = await loadAppCredential()
  if (!credentials.appKey || !credentials.appSecret) {
    throw new Error('闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置凭证')
  }

  const bodyJson = compactJson(body)
  const sellerId = resolveSellerId(options.sellerId)
  let sign
  const queryParts = [
    `appid=${encodeURIComponent(credentials.appKey)}`,
    `timestamp=${timestamp}`,
  ]
  if (sellerId) queryParts.push(`seller_id=${sellerId}`)

  const useMchSign = process.env.XIANYU_USE_MCH_SIGN === '1'
    && credentials.mchId && credentials.mchSecret

  if (useMchSign) {
    sign = generateSign6Param(
      credentials.appKey, credentials.appSecret,
      bodyJson, timestamp,
      credentials.mchId, credentials.mchSecret,
    )
  } else if (sellerId) {
    sign = generateSign5Param(credentials.appKey, bodyJson, timestamp, sellerId, credentials.appSecret)
  } else {
    sign = generateSign4Param(credentials.appKey, bodyJson, timestamp, credentials.appSecret)
  }
  queryParts.push(`sign=${encodeURIComponent(sign)}`)

  const url = `${baseUrl}${path}?${queryParts.join('&')}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'sdk_version': 'xgj-sdk-node-v1',
      },
      body: bodyJson,
      signal: controller.signal,
    })

    const data = await response.json()
    if (data.code !== 0) {
      const errorMap = {
        401: '签名错误，请检查凭证配置',
        403: '访问IP不在白名单内',
        408: '时间戳已超过有效期',
        500: '系统异常，请重试',
        1000: '商户不存在',
        1001: '商户不可用',
        1002: '商户余额不足',
        1100: '商品不存在',
        1101: '商品不可用',
        1102: '商品库存不足',
        1200: '订单不存在',
        1201: '下单参数错误',
        1202: '下单金额低于成本价',
        1203: '管家订单号已存在',
        1209: '下单超时，请查单确认',
      }
      const errorMsg = errorMap[data.code] || data.msg || data.message || `API错误: ${data.code}`
      throw new Error(errorMsg)
    }
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

async function loadAppCredential() {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      "SELECT config_key, config_value FROM system_config WHERE config_key IN " +
      "('xianyu_app_key', 'xianyu_app_secret', 'xianyu_mch_id', 'xianyu_mch_secret')"
    )
    const rawKey = rows.find(r => r.config_key === 'xianyu_app_key')?.config_value || ''
    const rawSecret = rows.find(r => r.config_key === 'xianyu_app_secret')?.config_value || ''
    const rawMchId = rows.find(r => r.config_key === 'xianyu_mch_id')?.config_value || ''
    const rawMchSecret = rows.find(r => r.config_key === 'xianyu_mch_secret')?.config_value || ''

    return {
      appKey: rawKey || process.env.XIANYU_APP_ID || '',
      appSecret: safeDecrypt(rawSecret) || process.env.XIANYU_APP_SECRET || '',
      mchId: rawMchId || process.env.XIANYU_MCH_ID || '',
      mchSecret: safeDecrypt(rawMchSecret) || process.env.XIANYU_MCH_SECRET || ''
    }
  } catch (err) {
    return {
      appKey: process.env.XIANYU_APP_ID || process.env.XIANYU_APP_KEY || '',
      appSecret: process.env.XIANYU_APP_SECRET || '',
      mchId: process.env.XIANYU_MCH_ID || '',
      mchSecret: process.env.XIANYU_MCH_SECRET || ''
    }
  }
}

// ========== 辅助函数 ==========

function fenToYuan(fen) {
  const n = Number(fen)
  if (isNaN(n)) return 0
  return n / 100
}

function yuanToFen(yuan) {
  const n = Number(yuan)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

function toNumber(val, fallback = 0) {
  if (val == null) return fallback
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

/** 开放平台列表 total 字段可能缺失，用 list 长度兜底 */
function resolveListTotal(data, listLength) {
  const candidates = [data?.total, data?.total_count, data?.count, data?.total_num]
  for (const v of candidates) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  return listLength
}

/** 闲鱼 CDN 的 HEIC 在浏览器中无法直接显示，转为 JPG */
function alicdnBrowserImageUrl(url) {
  if (!url || !/\.heic(\?|$)/i.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}x-oss-process=image/format,jpg/quality,Q_85`
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return ''
  let u = url.trim()
  if (!u) return ''
  if (u.startsWith('//')) u = `https:${u}`
  if (!/^https?:\/\//i.test(u)) {
    u = `https://img.alicdn.com/${u.replace(/^\//, '')}`
  }
  u = u.startsWith('http://') ? u.replace('http://', 'https://') : u
  return alicdnBrowserImageUrl(u)
}

function parseDateTime(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') {
    const ts = val < 1e12 ? val * 1000 : val
    return new Date(ts).toISOString().replace('T', ' ').substring(0, 19)
  }
  return String(val)
}

// ========== 字段映射函数 ==========

function buildReceiverFullAddress(order) {
  if (!order) return ''
  if (order.receiver_full_address) return String(order.receiver_full_address).trim()

  const parts = [
    order.receiver_prov || order.receiver_province || order.ship_prov_name,
    order.receiver_city || order.ship_city_name,
    order.receiver_area || order.receiver_district || order.ship_area_name,
    order.receiver_town || order.receiver_street,
    order.receiver_address,
    order.receiver_address_detail,
    order.ship_address,
    order.address,
  ].filter(Boolean)
  return parts.join(' ')
}

function mapOrderGoods(goods) {
  if (!goods || typeof goods !== 'object') return null

  const images = []
  const pushUrl = (u) => {
    const normalized = normalizeImageUrl(u)
    if (!normalized) return
    if (!images.includes(normalized)) images.push(normalized)
  }

  if (Array.isArray(goods.images)) {
    goods.images.forEach((img) => {
      if (typeof img === 'string') pushUrl(img)
      else pushUrl(img?.src || img?.url || img?.image || img?.pic_url || '')
    })
  }
  pushUrl(goods.pic_path)
  pushUrl(goods.pic_url)
  pushUrl(goods.image)
  pushUrl(goods.cover)
  pushUrl(goods.main_pic)

  const priceFen = toNumber(goods.price)
  const title = goods.title || goods.product_title || goods.goods_title || ''

  return {
    title,
    images,
    quantity: toNumber(goods.quantity, 1),
    price_fen: priceFen,
    price: priceFen > 0 ? fenToYuan(priceFen) : toNumber(goods.price_yuan),
    sku_text: goods.sku_text || goods.sku_name || goods.sku || '',
    product_id: goods.product_id || goods.item_id || '',
    item_id: goods.item_id || '',
  }
}

function mapOrderFields(order) {
  if (!order) return null

  const goodsMapped = mapOrderGoods(order.goods)
  const goodsPriceFen = toNumber(order.goods?.price)
  const totalAmountFen = toNumber(order.total_amount) || toNumber(order.order_price) || goodsPriceFen
  const payAmountFen = toNumber(order.pay_amount) || totalAmountFen

  const receiverFullAddress = buildReceiverFullAddress(order)
  const receiverMobile = order.receiver_mobile || order.receiver_phone || order.buyer_phone || order.customer_phone || ''

  return {
    order_no: order.order_no || '',
    order_status: toNumber(order.order_status),
    order_time: toNumber(order.order_time || order.create_time),
    order_time_formatted: parseDateTime(order.order_time || order.create_time),

    total_amount_fen: totalAmountFen,
    pay_amount_fen: payAmountFen,
    total_amount: fenToYuan(totalAmountFen),
    pay_amount: fenToYuan(payAmountFen),
    express_fee: fenToYuan(toNumber(order.express_fee)),

    pay_time: parseDateTime(order.pay_time),
    create_time: parseDateTime(order.create_time),

    buyer_nick: order.buyer_nick || order.buyer_name || '',
    buyer_eid: order.buyer_eid || '',
    buyer_phone: order.buyer_phone || '',
    buyer_message: order.buyer_message || order.seller_remark || '',

    receiver_name: order.receiver_name || order.ship_name || '',
    receiver_mobile: receiverMobile,
    receiver_phone: receiverMobile,
    receiver_prov: order.receiver_prov || order.receiver_province || order.ship_prov_name || '',
    receiver_city: order.receiver_city || order.ship_city_name || '',
    receiver_area: order.receiver_area || order.receiver_district || order.ship_area_name || '',
    receiver_town: order.receiver_town || order.receiver_street || '',
    receiver_address: order.receiver_address || order.ship_address || '',
    receiver_full_address: receiverFullAddress,

    express_company: order.express_name || order.express_code || '',
    express_name: order.express_name || '',
    express_code: order.express_code || '',
    express_no: order.waybill_no || '',
    waybill_no: order.waybill_no || '',
    consign_type: toNumber(order.consign_type),
    consign_time: parseDateTime(order.consign_time),
    deliver_time: parseDateTime(order.consign_time),
    express_info: order.express_name || order.waybill_no ? {
      expressCompany: order.express_name || '',
      expressNo: order.waybill_no || '',
      expressCode: order.express_code || '',
    } : null,

    refund_status: toNumber(order.refund_status),
    refund_amount: fenToYuan(toNumber(order.refund_amount)),
    refund_time: parseDateTime(order.refund_time),

    order_type: toNumber(order.order_type),
    cancel_reason: order.cancel_reason || '',
    cancel_time: parseDateTime(order.cancel_time),

    seller_name: order.seller_name || '',
    seller_id: order.seller_id || '',

    shop_name: order.shop_name || '',
    shop_id: String(order.seller_id ?? order.shop_id ?? order.shopId ?? ''),

    product_id: goodsMapped?.product_id || '',
    product_title: goodsMapped?.title || '',
    sku_spec: goodsMapped?.sku_text || '',
    goods: goodsMapped,
  }
}

function orderNeedsDetailEnrich(mapped) {
  if (!mapped?.order_no) return false
  const noAddr = !mapped.receiver_full_address && !mapped.receiver_name
  const noGoods = !mapped.goods?.title
  const noImg = !mapped.goods?.images?.length
  return noAddr || noGoods || noImg
}

function mergeOrderMapped(base, detail) {
  if (!detail) return base
  const merged = { ...base, ...detail }
  if (base.goods || detail.goods) {
    merged.goods = {
      ...(base.goods || {}),
      ...(detail.goods || {}),
      images: (detail.goods?.images?.length ? detail.goods.images : base.goods?.images) || [],
    }
  }
  if (!merged.receiver_full_address) merged.receiver_full_address = detail.receiver_full_address || base.receiver_full_address
  if (!merged.receiver_name) merged.receiver_name = detail.receiver_name || base.receiver_name
  return merged
}

async function enrichOrdersWithDetail(mappedList, shopId) {
  if (process.env.XIANYU_SKIP_ORDER_DETAIL_ENRICH === '1') return mappedList
  const need = mappedList.filter(orderNeedsDetailEnrich)
  if (!need.length) return mappedList

  const cap = parseInt(process.env.XIANYU_ORDER_DETAIL_ENRICH_LIMIT || String(mappedList.length), 10) || mappedList.length
  const batch = need.slice(0, Math.min(need.length, cap))

  for (let i = 0; i < batch.length; i += 5) {
    const chunk = batch.slice(i, i + 5)
    await Promise.all(chunk.map(async (o) => {
      try {
        const sellerId = shopId || o.shop_id || null
        const detail = await getOrderDetail(sellerId, o.order_no)
        const idx = mappedList.findIndex((x) => String(x.order_no) === String(o.order_no))
        if (idx >= 0) mappedList[idx] = mergeOrderMapped(mappedList[idx], detail)
      } catch { /* 单条详情失败不影响列表 */ }
    }))
  }
  return mappedList
}

function mapProductFields(product) {
  if (!product) return null

  const priceFen = toNumber(product.price)
  const images = extractProductImages(product)

  return {
    product_id: product.product_id || '',
    title: product.title || '',
    desc: product.desc || product.description || '',
    
    price_fen: priceFen,
    price: fenToYuan(priceFen),
    
    stock: toNumber(product.stock),
    product_status: toNumber(product.product_status),
    sale_status: toNumber(product.sale_status),
    outer_id: product.outer_id || '',
    category_id: product.category_id || '',
    
    images: images,
    first_image: images[0] || '',
    cover: product.cover || images[0] || '',
    
    sku_items: Array.isArray(product.sku_items) ? product.sku_items : [],
    publish_status: product.publish_status || '',
    publish_msg: product.publish_msg || ''
  }
}

function extractProductImages(product) {
  const images = []
  const pushUrl = (u) => {
    const normalized = normalizeImageUrl(u)
    if (!normalized) return
    if (!images.includes(normalized)) images.push(normalized)
  }

  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (typeof img === 'string') pushUrl(img)
      else pushUrl(img?.src || img?.url || img?.image || img?.pic_url || '')
    })
  }

  if (Array.isArray(product.detail_images)) {
    product.detail_images.forEach(img => {
      if (typeof img === 'string') pushUrl(img)
      else pushUrl(img?.src || img?.url || img?.image || img?.pic_url || '')
    })
  }

  if (Array.isArray(product.publish_shop)) {
    product.publish_shop.forEach(shop => {
      if (Array.isArray(shop?.images)) shop.images.forEach(pushUrl)
    })
  }

  if (product.pic_path) pushUrl(product.pic_path)
  if (product.cover) pushUrl(product.cover)
  if (product.image) pushUrl(product.image)
  if (product.main_pic) pushUrl(product.main_pic)

  return images
}

function mapShopFields(shop) {
  if (!shop) return null

  const now = Date.now() / 1000
  const expires = toNumber(shop.authorizeExpires || shop.authorize_expires, 0)
  const isValid = expires > now

  return {
    // 开放平台 authorize/list 返回 seller_id，非 shop_id
    shop_id: String(shop.seller_id ?? shop.shopId ?? shop.shop_id ?? ''),
    shop_name: shop.shop_name || shop.user_nick || shop.shopName || shop.shop_name || shop.user_name || '',
    user_id: shop.userId || shop.user_id || '',
    bind_time: parseDateTime(shop.bindTime || shop.bind_time),
    
    authorize_id: shop.authorizeId || shop.authorize_id || '',
    user_identity: shop.userIdentity || shop.user_identity || '',
    user_name: shop.userName || shop.user_name || '',
    is_pro: shop.isPro || shop.is_pro || false,
    is_valid: isValid,
    authorize_expires: expires,
    avatar: shop.avatar || ''
  }
}

// ========== 订单 API ==========

async function getOrders(options = {}) {
  const { page = 1, pageSize = 20, shopId, order_status, status, start_time, end_time, create_time_days } = options

  const credentials = await loadAppCredential()
  if (!credentials.appKey || !credentials.appSecret) {
    throw new Error('闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置凭证')
  }

  const cacheKey = `orders_${page}_${pageSize}_${shopId}_${order_status}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const body = buildPageBody({ page, pageSize })
  const statusVal = order_status ?? status
  if (statusVal !== undefined && statusVal !== '' && statusVal != null) {
    body.order_status = parseInt(statusVal, 10) || statusVal
  }
  const createDays = options.create_time_days ?? parseInt(process.env.XIANYU_ORDER_CREATE_DAYS || '180', 10)
  const createTime = buildUpdateTimeRange(start_time, end_time, createDays) || buildUpdateTimeRange(null, null, 180)
  if (createTime) body.create_time = createTime

  const response = await request('/api/open/order/list', body, { sellerId: shopId })
  const data = response.data || {}
  const rawList = data.list || []

  let mappedList = rawList
    .sort((a, b) => {
      const ta = toNumber(a.order_time || a.create_time, 0)
      const tb = toNumber(b.order_time || b.create_time, 0)
      return tb - ta
    })
    .map(mapOrderFields)
  mappedList = await enrichOrdersWithDetail(mappedList, shopId)

  const total = resolveListTotal(data, rawList.length)
  const withAddr = mappedList.filter((o) => o.receiver_full_address || o.receiver_name).length
  const withImg = mappedList.filter((o) => o.goods?.images?.length).length
  console.log(`[XianyuAPI] 订单列表: 页码=${page}, 返回${mappedList.length}条, 解析总数=${total}, 有地址=${withAddr}, 有图=${withImg}`)
  const result = { list: mappedList, total, page, pageSize }
  setCache(cacheKey, result)
  return result
}

async function getOrderDetail(shopId, orderNo) {
  if (!orderNo) throw new Error('订单号不能为空')

  const cacheKey = `order_detail_${shopId}_${orderNo}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const body = { order_no: String(orderNo) }

  const response = await request('/api/open/order/detail', body, { sellerId: shopId })
  const data = response.data || {}
  const mapped = mapOrderFields(data)
  
  setCache(cacheKey, mapped, 600)
  return mapped
}

async function getAllOrders(options = {}) {
  const {
    shopId,
    order_status,
    refund_status,
    keyword,
    page_no = 1,
    page_size = 50,
    start_time,
    end_time,
    create_time_days,
  } = options

  const credentials = await loadAppCredential()
  if (!credentials.appKey || !credentials.appSecret) {
    throw new Error('闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置凭证')
  }

  const body = buildPageBody({ page_no, page_size })
  if (order_status !== undefined && order_status !== '' && order_status != null) {
    body.order_status = parseInt(order_status, 10) || order_status
  }
  const createDays = create_time_days ?? parseInt(process.env.XIANYU_ORDER_CREATE_DAYS || '180', 10)
  const createTime = buildUpdateTimeRange(start_time, end_time, createDays) || buildUpdateTimeRange(null, null, 180)
  if (createTime) body.create_time = createTime

  const response = await request('/api/open/order/list', body, { sellerId: shopId })
  const data = response.data || {}
  let rawList = data.list || []
  rawList.sort((a, b) => {
    const ta = toNumber(a.order_time || a.create_time, 0)
    const tb = toNumber(b.order_time || b.create_time, 0)
    return tb - ta
  })

  let mappedList = rawList.map(mapOrderFields)
  mappedList = await enrichOrdersWithDetail(mappedList, shopId)

  if (refund_status !== undefined && refund_status !== '' && refund_status != null) {
    const rs = parseInt(refund_status, 10)
    mappedList = mappedList.filter((o) => toNumber(o.refund_status) === rs)
  }
  if (keyword) {
    const kw = keyword.toLowerCase()
    mappedList = mappedList.filter((o) => {
      const orderNo = (o.order_no || '').toLowerCase()
      const buyerNick = (o.buyer_nick || '').toLowerCase()
      const goodsTitle = (o.goods?.title || o.product_title || '').toLowerCase()
      const addr = (o.receiver_full_address || '').toLowerCase()
      return orderNo.includes(kw) || buyerNick.includes(kw) || goodsTitle.includes(kw) || addr.includes(kw)
    })
  }

  const total = resolveListTotal(data, rawList.length)
  const withAddr = mappedList.filter((o) => o.receiver_full_address || o.receiver_name).length
  const withImg = mappedList.filter((o) => o.goods?.images?.length).length
  console.log(`[XianyuAPI] getAllOrders: 返回${mappedList.length}条, 解析总数=${total}, 有地址=${withAddr}, 有图=${withImg}`)
  return {
    list: mappedList,
    total,
    page: page_no,
    pageSize: page_size,
  }
}

let _expressCompaniesCache = null
let _expressCompaniesCacheAt = 0

async function resolveExpressFields(expressCompany) {
  const raw = String(expressCompany || '').trim()
  if (!raw) throw new Error('物流公司不能为空')

  if (raw.includes('::')) {
    const [code, name] = raw.split('::')
    return { express_code: code.trim(), express_name: (name || code).trim() }
  }

  const now = Date.now()
  if (!_expressCompaniesCache || now - _expressCompaniesCacheAt > 86400000) {
    try {
      const response = await request('/api/open/express/companies', {})
      const data = response.data || {}
      _expressCompaniesCache = data.list || data.companies || (Array.isArray(data) ? data : [])
      _expressCompaniesCacheAt = now
    } catch {
      _expressCompaniesCache = []
    }
  }

  const found = (_expressCompaniesCache || []).find((c) => {
    if (typeof c === 'string') return c === raw
    const code = c.code || c.express_code || ''
    const name = c.name || c.express_name || c.company_name || ''
    return code === raw || name === raw
  })

  if (found && typeof found === 'object') {
    return {
      express_code: found.code || found.express_code || raw,
      express_name: found.name || found.express_name || found.company_name || raw,
    }
  }

  return { express_code: raw, express_name: raw }
}

async function shipOrder(shopId, orderNoOrId, expressNo, expressCompany, shipExtra = {}) {
  const order_no = String(orderNoOrId || '').trim()
  if (!order_no) throw new Error('订单号不能为空')
  if (!expressNo) throw new Error('物流单号不能为空')
  if (!expressCompany) throw new Error('物流公司不能为空')

  const { express_code, express_name } = await resolveExpressFields(expressCompany)
  const body = {
    order_no,
    waybill_no: String(expressNo).trim(),
    express_code,
    express_name,
  }
  if (shipExtra.ship_name) body.ship_name = shipExtra.ship_name
  if (shipExtra.ship_mobile) body.ship_mobile = shipExtra.ship_mobile
  if (shipExtra.ship_address) body.ship_address = shipExtra.ship_address
  if (shipExtra.ship_district_id) body.ship_district_id = shipExtra.ship_district_id

  console.log(`[XianyuAPI] 发货: 订单=${order_no}, 物流=${express_name} ${body.waybill_no}`)
  return await request('/api/open/order/ship', body, { sellerId: shopId })
}

async function updateOrderPrice(shopId, orderNoOrId, price, expressFeeYuan = 0) {
  const order_no = String(orderNoOrId || '').trim()
  if (!order_no) throw new Error('订单号不能为空')
  if (price == null) throw new Error('价格不能为空')

  const body = {
    order_no,
    order_price: yuanToFen(price),
    express_fee: yuanToFen(expressFeeYuan || 0),
  }

  console.log(`[XianyuAPI] 改价: 订单=${order_no}, 商品价=${price}元, 运费=${expressFeeYuan || 0}元`)
  return await request('/api/open/order/modify/price', body, { sellerId: shopId })
}

async function cancelOrder(shopId, orderNoOrId, cancelReason) {
  const order_no = String(orderNoOrId || '').trim()
  if (!order_no) throw new Error('订单号不能为空')
  const body = {
    order_no,
    cancel_reason: cancelReason || '商家取消',
  }
  console.log(`[XianyuAPI] 取消订单: ${order_no}`)
  return await request('/api/open/order/cancel', body, { sellerId: shopId })
}

async function getOrderCards(shopId, orderNoOrId) {
  const order_no = String(orderNoOrId || '').trim()
  if (!order_no) throw new Error('订单号不能为空')

  const body = { order_no }
  try {
    const response = await request('/api/open/order/cards', body, { sellerId: shopId })
    return response.data || { cards: [] }
  } catch (err) {
    // 扩展接口：部分环境仍识别 order_id
    const response = await request('/api/open/order/cards', { order_id: order_no }, { sellerId: shopId })
    return response.data || { cards: [] }
  }
}

// ========== 商品 API ==========

async function getProducts(options = {}) {
  const {
    page = 1,
    pageSize = 20,
    shopId,
    product_status,
    sale_status,
    keyword,
    update_time_start,
    update_time_end,
    update_time_days,
  } = options

  const credentials = await loadAppCredential()
  if (!credentials.appKey || !credentials.appSecret) {
    throw new Error('闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置凭证')
  }

  const cacheKey = `products_${page}_${pageSize}_${shopId}_${product_status}_${sale_status}_${update_time_days || ''}`
  const cached = getCache(cacheKey)
  if (cached) {
    return cached
  }

  const body = buildPageBody({ page, pageSize })
  if (product_status !== undefined && product_status !== '' && product_status != null) {
    body.product_status = parseInt(product_status, 10) || product_status
  }
  if (sale_status !== undefined && sale_status !== '' && sale_status != null) {
    body.sale_status = parseInt(sale_status, 10) || sale_status
  }

  // 官方文档：仅返回近 6 个月内修改过的商品；测试用例使用 30 天窗口
  const updateRange = buildUpdateTimeRange(update_time_start, update_time_end, update_time_days)
    || buildUpdateTimeRange(null, null, 180)
  if (updateRange) body.update_time = updateRange

  const response = await request('/api/open/product/list', body, { sellerId: shopId })
  const data = response.data || {}
  const rawList = data.list || []
  
  let mappedList = rawList.map(mapProductFields)

  // 列表接口仅返回基础字段，图片需从详情补全（官方文档说明）
  const needImages = mappedList.filter(p => !p.first_image && p.product_id)
  const enrichCap = parseInt(process.env.XIANYU_DETAIL_ENRICH_LIMIT || String(pageSize), 10) || pageSize
  const enrichLimit = Math.min(pageSize, enrichCap)
  if (needImages.length > 0 && process.env.XIANYU_SKIP_DETAIL_ENRICH !== '1') {
    const batch = needImages.slice(0, Math.min(needImages.length, enrichLimit))
    for (let i = 0; i < batch.length; i += 5) {
      const chunk = batch.slice(i, i + 5)
      await Promise.all(chunk.map(async (p) => {
        try {
          const detailRes = await request(
            '/api/open/product/detail',
            { product_id: Number(p.product_id) },
            { sellerId: shopId },
          )
          const detailData = detailRes.data?.product || detailRes.data || {}
          const imgs = extractProductImages(detailData)
          if (!imgs.length) return
          const idx = mappedList.findIndex(x => String(x.product_id) === String(p.product_id))
          if (idx >= 0) {
            mappedList[idx].images = imgs
            mappedList[idx].first_image = imgs[0]
            mappedList[idx].cover = imgs[0]
          }
        } catch { /* 单条详情失败不影响列表 */ }
      }))
    }
  }

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    mappedList = mappedList.filter(p =>
      (p.title || '').toLowerCase().includes(kw)
      || String(p.product_id || '').includes(kw)
      || (p.outer_id || '').toLowerCase().includes(kw),
    )
  }
  const total = keyword
    ? mappedList.length
    : resolveListTotal(data, rawList.length)
  const withImage = mappedList.filter(p => p.first_image).length
  console.log(`[XianyuAPI] 商品列表: 页码=${page}, 返回${mappedList.length}条, 解析总数=${total}, 有图=${withImage}`)
  const result = { list: mappedList, total, page, pageSize }
  // 不缓存空列表，避免错误 shopId / 凭证恢复后仍命中旧空结果
  if (mappedList.length > 0) setCache(cacheKey, result)
  return result
}

async function getProductDetail(shopId, productId) {
  if (!productId) throw new Error('商品ID不能为空')

  const cacheKey = `product_detail_${shopId}_${productId}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const body = { product_id: Number(productId) }

  const response = await request('/api/open/product/detail', body, { sellerId: shopId })
  const data = response.data || {}
  const mapped = mapProductFields(data)
  
  setCache(cacheKey, mapped, 600)
  return mapped
}

async function getProductSkus(shopId, productId) {
  if (!productId) throw new Error('商品ID不能为空')

  const body = { product_id: [Number(productId)] }

  const response = await request('/api/open/product/sku/list', body, { sellerId: shopId })
  const data = response.data || {}
  return data.skus ? data : { skus: data.list || data.sku_items || [] }
}

async function createProduct(shopId, productData) {
  if (!productData || !productData.title) throw new Error('商品标题不能为空')
  if (!productData.price) throw new Error('商品价格不能为空')
  if (!productData.images || productData.images.length === 0) throw new Error('商品图片不能为空')

  const body = { ...productData }
  if (body.price && body.price < 100) body.price = yuanToFen(body.price)

  console.log(`[XianyuAPI] 创建商品: ${productData.title || productData.channel_cat_id}`)
  return await request('/api/open/product/create', body, { sellerId: shopId })
}

async function batchCreateProducts(shopId, products) {
  if (!Array.isArray(products) || products.length === 0) throw new Error('商品列表不能为空')

  const body = {
    product_data: products.map(p => ({
      ...p,
      price: p.price != null && p.price < 100 ? yuanToFen(p.price) : p.price,
    })),
  }

  console.log(`[XianyuAPI] 批量创建商品: ${products.length}个`)
  return await request('/api/open/product/batchCreate', body, { sellerId: shopId })
}

async function publishProduct(shopId, productId, userNames) {
  if (!productId) throw new Error('商品ID不能为空')
  if (!userNames || (Array.isArray(userNames) && userNames.length === 0)) {
    throw new Error('发布账号不能为空')
  }

  const body = { product_id: Number(productId) }
  if (Array.isArray(userNames)) {
    body.user_name = userNames
  } else {
    body.user_name = [userNames]
  }

  console.log(`[XianyuAPI] 上架商品: ${productId}`)
  return await request('/api/open/product/publish', body, { sellerId: shopId })
}

async function downShelfProduct(shopId, productId, userNames) {
  if (!productId) throw new Error('商品ID不能为空')

  const body = { product_id: Number(productId) }
  if (userNames) {
    body.user_name = Array.isArray(userNames) ? userNames : [userNames]
  }

  console.log(`[XianyuAPI] 下架商品: ${productId}`)
  return await request('/api/open/product/downShelf', body, { sellerId: shopId })
}

async function updateProduct(shopId, productId, data) {
  if (!productId) throw new Error('商品ID不能为空')

  const body = { product_id: Number(productId) }
  if (data.price != null) {
    body.price = Number(data.price) < 100 ? yuanToFen(data.price) : Number(data.price)
  }
  if (data.stock != null && Number(data.stock) > 0) {
    body.stock = Number(data.stock)
  }

  const title = data.title?.trim()
  const images = Array.isArray(data.images) ? data.images.map(normalizeImageUrl).filter(Boolean) : null

  if (title || (images && images.length)) {
    const detailRes = await request(
      '/api/open/product/detail',
      { product_id: Number(productId) },
      { sellerId: shopId },
    )
    const detail = detailRes.data || {}
    const baseShop = Array.isArray(detail.publish_shop) && detail.publish_shop[0]
      ? { ...detail.publish_shop[0] }
      : {}
    if (title) baseShop.title = title
    if (images?.length) baseShop.images = images
    if (!baseShop.content || String(baseShop.content).length < 5) {
      baseShop.content = detail.desc || detail.description || title || baseShop.title || '商品描述'
    }
    body.publish_shop = [baseShop]
    if (images?.length && !body.publish_shop[0].images?.length) {
      body.detail_images = images.map(url => ({ src: url, width: 800, height: 800 }))
    }
  }

  console.log(`[XianyuAPI] 编辑商品: ${productId}, fields=${Object.keys(body).join(',')}`)
  return await request('/api/open/product/edit', body, { sellerId: shopId })
}

async function updateStock(shopId, productId, stock, skuId) {
  if (!productId) throw new Error('商品ID不能为空')
  if (stock == null || stock < 0) throw new Error('库存数量不能为空')

  const body = { product_id: Number(productId), stock: Number(stock) }
  if (skuId) {
    body.sku_items = [{ sku_id: Number(skuId), stock: Number(stock) }]
  }

  console.log(`[XianyuAPI] 修改库存: 商品=${productId}, 库存=${stock}`)
  return await request('/api/open/product/edit/stock', body, { sellerId: shopId })
}

async function deleteProduct(shopId, productId) {
  if (!productId) throw new Error('商品ID不能为空')

  const body = { product_id: Number(productId) }

  console.log(`[XianyuAPI] 删除商品: ${productId}`)
  return await request('/api/open/product/delete', body, { sellerId: shopId })
}

// ========== 店铺/用户 API ==========

async function getShops(options = {}) {
  const { pageNum = 1, pageSize = 20 } = options

  const credentials = await loadAppCredential()
  if (!credentials.appKey || !credentials.appSecret) {
    throw new Error('闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置凭证')
  }

  const cacheKey = `shops_${pageNum}_${pageSize}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const response = await request('/api/open/user/authorize/list', {}, { sellerId: null })
  const data = response.data || {}
  const rawList = data.list || []
  
  console.log(`[XianyuAPI] 店铺列表: 返回${rawList.length}条, 总数=${data.total || 0}`)

  const mappedList = rawList.map(mapShopFields)
  const result = { list: mappedList, total: resolveListTotal(data, mappedList.length) }
  setCache(cacheKey, result)
  return result
}

// ========== 其他 API ==========

async function getCategories() {
  const cacheKey = 'categories'
  const cached = getCache(cacheKey)
  if (cached) return cached

  const response = await request('/api/open/product/category/list', {
    item_biz_type: 2,
    sp_biz_type: 1,
  })
  const data = response.data || {}
  const result = data.list || data.categories || []
  setCache(cacheKey, result, 3600)
  return result
}

async function getProductAttributes(categoryId, options = {}) {
  if (!categoryId) throw new Error('类目ID不能为空')

  const body = {
    item_biz_type: options.item_biz_type ?? 2,
    sp_biz_type: options.sp_biz_type ?? 1,
    channel_cat_id: Number(categoryId),
  }
  if (options.sub_property_id) body.sub_property_id = options.sub_property_id

  const response = await request('/api/open/product/pv/list', body, { sellerId: options.shopId })
  return response.data || { attributes: [], list: [] }
}

function normalizeExpressCompanies(data) {
  const raw = data?.list || data?.companies || (Array.isArray(data) ? data : [])
  return raw.map((c) => {
    if (typeof c === 'string') return { code: c, name: c }
    return {
      code: c.code || c.express_code || '',
      name: c.name || c.express_name || c.company_name || c.code || '',
      ...c,
    }
  })
}

async function getLogisticsCompanies() {
  const cacheKey = 'logistics_companies'
  const cached = getCache(cacheKey)
  if (cached) return cached

  const response = await request('/api/open/express/companies', {})
  const result = normalizeExpressCompanies(response.data || {})
  setCache(cacheKey, result, 86400)
  _expressCompaniesCache = result
  _expressCompaniesCacheAt = Date.now()
  return result
}

async function queryBalance() {
  const response = await request('/api/open/mch/balance', {})
  return response.data || {}
}

async function placeOrder(goodsNo, goodsType, buyerNick, buyerId, orderNo, price) {
  if (!goodsNo) throw new Error('商品编号不能为空')
  if (!buyerNick) throw new Error('买家昵称不能为空')
  if (!orderNo) throw new Error('订单号不能为空')
  if (!price) throw new Error('价格不能为空')

  const body = {
    goods_no: goodsNo,
    goods_type: goodsType || 1,
    buyer_nick: buyerNick,
    buyer_id: buyerId || '',
    order_no: orderNo,
    price: yuanToFen(price)
  }

  console.log(`[XianyuAPI] 下单: 商品=${goodsNo}, 订单=${orderNo}`)
  return await request('/api/open/order/place', body)
}

// ========== 缓存控制 ==========

function clearCache() {
  cache.clear()
  _expressCompaniesCache = null
  _expressCompaniesCacheAt = 0
}

function clearCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

// ========== 导出 ==========

export default {
  getOrders,
  getOrderDetail,
  getAllOrders,
  shipOrder,
  updateOrderPrice,
  cancelOrder,
  getOrderCards,
  getProducts,
  getProductDetail,
  getProductSkus,
  createProduct,
  batchCreateProducts,
  publishProduct,
  downShelfProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  getShops,
  getCategories,
  getProductAttributes,
  getLogisticsCompanies,
  queryBalance,
  placeOrder,
  clearCache,
  clearCacheByPrefix,
  loadAppCredential,
  mapOrderFields,
  mapProductFields,
  mapShopFields,
  request,
}
