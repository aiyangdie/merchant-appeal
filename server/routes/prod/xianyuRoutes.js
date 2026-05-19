import xianyuApi from '../../xianyu-api.js'
import { getDashboardAnalytics } from '../../xianyu-dashboard.js'
import fetch from 'node-fetch'
/**
 * xianyuRoutes
 */
export function registerXianyuRoutes(app, ctx) {
  const {
    signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken,
    authLimiter,
  } = ctx

app.get('/api/orders/from-system', requireUser, async (req, res) => {
  const { page = 1, page_size = 20, status } = req.query

  try {
    console.log(`[API] 获取闲鱼管家订单: page=${page}, pageSize=${page_size}`)
    
    // 使用闲鱼管家API获取数据
    const result = await xianyuApi.getOrders({
      page: parseInt(page),
      pageSize: Math.min(parseInt(page_size), 100),
      status
    })
    
    const mappedList = result.list || []

    console.log(`[API] 成功获取 ${mappedList.length} 条订单`)
    if (mappedList.length > 0) {
      console.log(`[API] 首条订单金额: pay_amount=${mappedList[0].pay_amount}, price=${mappedList[0].price}`)
      console.log(`[API] 首条订单原始:`, JSON.stringify(result.list[0] || {}, null, 2))
      console.log(`[API] 首条订单转换后:`, JSON.stringify(mappedList[0], null, 2))
    }
    
    // Log raw response for debugging
    console.log(`[API] 原始API响应:`, JSON.stringify(result, null, 2).substring(0, 500))
    
    res.json({
      success: true,
      data: result,
      message: '获取成功'
    })
  } catch (error) {
    console.error('[API] 获取闲鱼管家订单失败:', error.message)
    
    // 如果是配置错误，返回友好提示
    if (error.message.includes('未配置') || error.message.includes('AppKey') || error.message.includes('AppSecret')) {
      return res.status(500).json({ 
        error: '闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置 AppKey 和 AppSecret',
        code: 'CONFIG_REQUIRED'
      })
    }
    
    // 如果是网络错误
    if (error.message.includes('fetch') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      return res.status(500).json({
        error: '连接闲管家API失败，请检查网络或API配置',
        code: 'NETWORK_ERROR'
      })
    }
    
    res.status(500).json({ 
      error: error.message || '获取订单失败，请稍后重试',
      code: 'API_ERROR'
    })
  }
})

// 从订单系统获取单个订单详情
app.get('/api/orders/from-system/:orderId', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params
    // TODO: shopId需要从用户当前选择的店铺获取，暂时传空让API自行处理
    const shopId = req.query.shopId || ''

    const detail = await xianyuApi.getOrderDetail(shopId, orderId)

    res.json({
      success: true,
      data: detail,
    })
  } catch (error) {
    console.error('[API] 获取订单详情失败:', error.message)
    res.status(500).json({ error: '获取订单详情失败，请稍后重试' })
  }
})

app.get('/api/admin/xianyu-orders', requireAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 50, order_status, refund_status, keyword, shopId, refresh } = req.query
    const page_no = parseInt(page, 10) || 1
    const ps = Math.min(parseInt(pageSize, 10) || 50, 100)
    if (refresh === '1') xianyuApi.clearCacheByPrefix('orders_')

    const t0 = Date.now()
    const result = await xianyuApi.getAllOrders({
      page_no,
      page_size: ps,
      shopId: shopId || undefined,
      order_status: order_status || undefined,
      refund_status: refund_status || undefined,
      keyword: keyword || undefined,
    })

    console.log(`[API] 闲鱼订单列表: shopId=${shopId || '全部'}, count=${result.list.length}, total=${result.total}, ${Date.now() - t0}ms`)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 管理后台获取闲鱼订单失败:', error.message)
    res.status(500).json({ success: false, error: error.message, data: { list: [], total: 0, page: 1, pageSize: 50 } })
  }
})

app.get('/api/admin/xianyu-dashboard', requireAdmin, async (req, res) => {
  try {
    const { shopId, days, refresh } = req.query
    const t0 = Date.now()
    const data = await getDashboardAnalytics({
      shopId: shopId || undefined,
      days: days || 30,
      refresh,
    })
    console.log(`[API] 闲鱼看板: days=${data.days}, orders=${data.summary.orderCount}, ${Date.now() - t0}ms`)
    res.json({ success: true, data })
  } catch (error) {
    console.error('[API] 闲鱼看板失败:', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 闲鱼订单 API ==========

app.post('/api/xianyu/orders/ship', requireAdmin, async (req, res) => {
  try {
    const { shopId, orderId, expressNo, expressCompany } = req.body
    if (!orderId || !expressNo || !expressCompany) {
      return res.status(400).json({ success: false, error: '订单ID、物流单号、物流公司不能为空' })
    }
    const result = await xianyuApi.shipOrder(shopId, orderId, expressNo, expressCompany)
    xianyuApi.clearCacheByPrefix('orders_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 订单发货失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/orders/update-price', requireAdmin, async (req, res) => {
  try {
    const { shopId, orderId, price, expressFee } = req.body
    if (!orderId || price == null) {
      return res.status(400).json({ success: false, error: '订单ID和价格不能为空' })
    }
    const result = await xianyuApi.updateOrderPrice(shopId, orderId, price, expressFee ?? 0)
    xianyuApi.clearCacheByPrefix('orders_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 订单改价失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/orders/cancel', requireAdmin, async (req, res) => {
  try {
    const { shopId, orderId, cancelReason } = req.body
    if (!orderId) {
      return res.status(400).json({ success: false, error: '订单号不能为空' })
    }
    const result = await xianyuApi.cancelOrder(shopId, orderId, cancelReason)
    xianyuApi.clearCacheByPrefix('orders_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 订单取消失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.get('/api/xianyu/orders/:orderId/cards', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params
    const { shopId } = req.query
    if (!orderId) {
      return res.status(400).json({ success: false, error: '订单ID不能为空' })
    }
    const result = await xianyuApi.getOrderCards(shopId, orderId)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取订单卡密失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

// ========== 闲鱼商品 API ==========

app.get('/api/xianyu/products', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      shopId,
      product_status,
      sale_status,
      keyword,
      update_time_days,
      refresh,
    } = req.query
    if (refresh === '1' || refresh === 'true') xianyuApi.clearCacheByPrefix('products_')
    const t0 = Date.now()
    const result = await xianyuApi.getProducts({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      shopId: shopId || undefined,
      product_status: product_status || undefined,
      sale_status: sale_status || undefined,
      keyword: keyword || undefined,
      update_time_days: update_time_days ? parseInt(update_time_days, 10) : undefined,
    })
    console.log(`[API] 闲鱼商品列表: shopId=${shopId || '全部'}, count=${result.list.length}, total=${result.total}, ${Date.now() - t0}ms`)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取商品列表失败:', error.message)
    res.json({ success: false, error: error.message, data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

app.get('/api/xianyu/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId } = req.query
    if (!id) {
      return res.status(400).json({ success: false, error: '商品ID不能为空' })
    }
    const result = await xianyuApi.getProductDetail(shopId, id)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取商品详情失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.get('/api/xianyu/products/:id/skus', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId } = req.query
    if (!id) {
      return res.status(400).json({ success: false, error: '商品ID不能为空' })
    }
    const result = await xianyuApi.getProductSkus(shopId, id)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取商品SKU失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/products', requireAdmin, async (req, res) => {
  try {
    const { shopId, ...productData } = req.body
    if (!productData.title || !productData.price || !productData.images) {
      return res.status(400).json({ success: false, error: '商品标题、价格、图片不能为空' })
    }
    const result = await xianyuApi.createProduct(shopId, productData)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 创建商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/products/batch', requireAdmin, async (req, res) => {
  try {
    const { shopId, products } = req.body
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: '商品列表不能为空' })
    }
    const result = await xianyuApi.batchCreateProducts(shopId, products)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 批量创建商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/products/:id/publish', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId, userNames } = req.body
    if (!id || !userNames) {
      return res.status(400).json({ success: false, error: '商品ID和发布账号不能为空' })
    }
    const result = await xianyuApi.publishProduct(shopId, id, userNames)
    xianyuApi.clearCacheByPrefix('products_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 上架商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.post('/api/xianyu/products/:id/unpublish', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId, userNames } = req.body
    if (!id) {
      return res.status(400).json({ success: false, error: '商品ID不能为空' })
    }
    const result = await xianyuApi.downShelfProduct(shopId, id, userNames)
    xianyuApi.clearCacheByPrefix('products_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 下架商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.put('/api/xianyu/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId, ...data } = req.body
    if (!id) {
      return res.status(400).json({ success: false, error: '商品ID不能为空' })
    }
    const result = await xianyuApi.updateProduct(shopId, id, data)
    xianyuApi.clearCacheByPrefix('products_')
    xianyuApi.clearCacheByPrefix('product_detail_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 更新商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.put('/api/xianyu/products/:id/stock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId, stock, skuId } = req.body
    if (!id || stock == null) {
      return res.status(400).json({ success: false, error: '商品ID和库存不能为空' })
    }
    const result = await xianyuApi.updateStock(shopId, id, stock, skuId)
    xianyuApi.clearCacheByPrefix('products_')
    xianyuApi.clearCacheByPrefix('product_detail_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 更新库存失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.delete('/api/xianyu/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { shopId } = req.query
    if (!id) {
      return res.status(400).json({ success: false, error: '商品ID不能为空' })
    }
    const result = await xianyuApi.deleteProduct(shopId, id)
    xianyuApi.clearCacheByPrefix('products_')
    xianyuApi.clearCacheByPrefix('product_detail_')
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 删除商品失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

// ========== 闲鱼店铺 API ==========

app.get('/api/xianyu/shops', requireAdmin, async (req, res) => {
  try {
    if (req.query.refresh === '1' || req.query.refresh === 'true') {
      xianyuApi.clearCacheByPrefix('shops_')
    }
    const { page = 1, pageSize = 20 } = req.query
    const result = await xianyuApi.getShops({
      pageNum: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取店铺列表失败:', error.message)
    res.json({ success: false, error: error.message, data: { list: [], total: 0 } })
  }
})

// ========== 闲鱼其他 API ==========

app.get('/api/xianyu/categories', requireAdmin, async (req, res) => {
  try {
    const result = await xianyuApi.getCategories()
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取类目失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.get('/api/xianyu/categories/:id/attributes', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ success: false, error: '类目ID不能为空' })
    }
    const result = await xianyuApi.getProductAttributes(id)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取类目属性失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.get('/api/xianyu/logistics/companies', requireAdmin, async (req, res) => {
  try {
    const result = await xianyuApi.getLogisticsCompanies()
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取物流公司失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

app.get('/api/xianyu/balance', requireAdmin, async (req, res) => {
  try {
    const result = await xianyuApi.queryBalance()
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[API] 获取余额失败:', error.message)
    res.json({ success: false, error: error.message })
  }
})

const XIANYU_IMAGE_HOSTS = ['img.alicdn.com', 'cdn.goofish.pro', 'gw.alicdn.com', 'img.goofish.com']

app.get('/api/xianyu/image-proxy', requireAdminOrQueryToken, async (req, res) => {
  try {
    const raw = String(req.query.url || '').trim()
    if (!raw.startsWith('https://')) {
      return res.status(400).json({ success: false, error: '无效图片地址' })
    }
    const host = new URL(raw).hostname
    if (!XIANYU_IMAGE_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) {
      return res.status(403).json({ success: false, error: '不允许的图片域名' })
    }
    const fetchUrl = /\.heic(\?|$)/i.test(raw)
      ? `${raw}${raw.includes('?') ? '&' : '?'}x-oss-process=image/format,jpg/quality,Q_85`
      : raw
    const upstream = await fetch(fetchUrl, {
      headers: {
        Referer: 'https://www.goofish.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; merchant-appeal/1.0)',
      },
    })
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: `上游 ${upstream.status}` })
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(buf)
  } catch (error) {
    console.error('[API] 图片代理失败:', error.message)
    res.status(502).json({ success: false, error: error.message })
  }
})

app.get('/api/admin/xianyu-verify', requireAdmin, async (req, res) => {
  try {
    xianyuApi.clearCache()
    const products = await xianyuApi.getProducts({ page: 1, pageSize: 5 })
    const orders = await xianyuApi.getAllOrders({ page_no: 1, page_size: 5 })
    res.json({
      success: true,
      data: {
        products: {
          count: products.list.length,
          total: products.total,
          withImage: products.list.filter(p => p.first_image).length,
        },
        orders: { count: orders.list.length, total: orders.total },
      },
    })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

}
