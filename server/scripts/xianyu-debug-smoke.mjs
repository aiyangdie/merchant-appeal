/**
 * 闲管家 API 冒烟测试（写入 debug NDJSON）
 * 用法: cd server && node scripts/xianyu-debug-smoke.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const { initDatabase } = await import('../db.js')
const { default: xianyuApi } = await import('../xianyu-api.js')

const LOG_PATH = '/root/.cursor/debug-5a83ff.log'
const SESSION = '5a83ff'

function dbg(hypothesisId, location, message, data = {}) {
  const line = JSON.stringify({
    sessionId: SESSION,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: 'smoke',
  })
  fs.appendFileSync(LOG_PATH, line + '\n')
  console.log(`[${hypothesisId}] ${message}`, JSON.stringify(data))
}

await initDatabase()

xianyuApi.clearCache()
try {
  const cred = await xianyuApi.loadAppCredential()
  dbg('H1', 'smoke:cred', 'credentials loaded', {
    hasKey: !!cred.appKey,
    keyLen: cred.appKey?.length || 0,
    hasSecret: !!cred.appSecret,
    hasMch: !!(cred.mchId && cred.mchSecret),
    useMchSign: process.env.XIANYU_USE_MCH_SIGN === '1',
  })
} catch (e) {
  dbg('H1', 'smoke:cred', 'credentials failed', { error: e.message })
  process.exit(1)
}

try {
  const shops = await xianyuApi.getShops({ pageNum: 1, pageSize: 10 })
  dbg('H4', 'smoke:shops', 'shops result', { count: shops.list?.length || 0, total: shops.total })
} catch (e) {
  dbg('H4', 'smoke:shops', 'shops error', { error: e.message })
}

try {
  const orders = await xianyuApi.getAllOrders({ page_no: 1, page_size: 5 })
  dbg('H1', 'smoke:orders', 'orders result', {
    count: orders.list?.length || 0,
    total: orders.total,
    firstOrderNo: orders.list?.[0]?.order_no,
  })
} catch (e) {
  dbg('H1', 'smoke:orders', 'orders error', { error: e.message })
}

try {
  const products = await xianyuApi.getProducts({ page: 1, pageSize: 5 })
  const raw0 = products.list?.[0]
  dbg('H2', 'smoke:products', 'products result', {
    count: products.list?.length || 0,
    total: products.total,
    firstId: raw0?.product_id,
    firstImage: raw0?.first_image || null,
    imageCount: raw0?.images?.length || 0,
  })
} catch (e) {
  dbg('H2', 'smoke:products', 'products error', { error: e.message })
}

try {
  const now = Math.floor(Date.now() / 1000)
  const bodyWithTime = {
    page_no: 1,
    page_size: 5,
    update_time: [now - 30 * 86400, now],
  }
  const resp = await xianyuApi.request('/api/open/product/list', bodyWithTime, {})
  const list = resp.data?.list || []
  dbg('H2', 'smoke:products-sdk-body', 'product list with SDK update_time', {
    count: list.length,
    total: resp.data?.total || 0,
    firstId: list[0]?.product_id,
  })
} catch (e) {
  dbg('H2', 'smoke:products-sdk-body', 'sdk body error', { error: e.message })
}
