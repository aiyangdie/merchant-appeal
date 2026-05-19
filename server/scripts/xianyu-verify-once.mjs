/**
 * 闲管家冒烟（须先加载 .env，再 import db，否则 DB_CONFIG 密码为空）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG = '/root/.cursor/debug-5a83ff.log'

dotenv.config({ path: path.join(__dirname, '../.env') })

function log(msg, data) {
  const line = { sessionId: '5a83ff', ts: Date.now(), msg, ...data }
  fs.appendFileSync(LOG, `${JSON.stringify(line)}\n`)
}

const { initDatabase } = await import('../db.js')
const { default: xianyuApi } = await import('../xianyu-api.js')

await initDatabase()

try {
  xianyuApi.clearCache()
  const cred = await xianyuApi.loadAppCredential()
  log('credentials', {
    hasKey: !!cred.appKey,
    keyLen: cred.appKey?.length || 0,
    hasSecret: !!cred.appSecret,
    secretLen: cred.appSecret?.length || 0,
  })

  const products = await xianyuApi.getProducts({ page: 1, pageSize: 5 })
  const withImg = products.list.filter(p => p.first_image).length
  log('verify products', {
    count: products.list.length,
    total: products.total,
    withImage: withImg,
    firstImage: products.list[0]?.first_image?.slice(0, 80) || null,
  })

  const orders = await xianyuApi.getAllOrders({ page_no: 1, page_size: 5 })
  log('verify orders', { count: orders.list.length, total: orders.total })

  fs.writeFileSync('/tmp/xianyu-verify-result.json', JSON.stringify({ products, orders }, null, 2))
  console.log(JSON.stringify({
    ok: true,
    products: { count: products.list.length, total: products.total, withImage: withImg },
    orders: { count: orders.list.length, total: orders.total },
  }))
  process.exit(0)
} catch (e) {
  log('verify error', { error: e.message })
  console.log(JSON.stringify({ ok: false, error: e.message }))
  process.exit(1)
}
