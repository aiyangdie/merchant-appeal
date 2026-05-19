#!/usr/bin/env node
/**
 * 初始化/同步支付配置（回调 URL、.env → 数据库）
 * 用法: node scripts/setup-payment.mjs
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server')
dotenv.config({ path: path.join(serverDir, '.env') })
dotenv.config({ path: path.join(serverDir, 'payment.secrets.env') })

const { initDatabase } = await import(path.join(serverDir, 'db.js'))
const { loadPaymentSecretsEnv, syncPaymentEnvToDb, ensureRechargeDefaults, getPaymentSiteBase } = await import(path.join(serverDir, 'paymentEnvSync.js'))

await initDatabase()
const hadSecrets = loadPaymentSecretsEnv()
await ensureRechargeDefaults()
const result = await syncPaymentEnvToDb({ forceSecrets: hadSecrets })

console.log('\n=== 支付配置同步结果 ===')
console.log('站点:', getPaymentSiteBase())
console.log('已更新:', result.updated.length ? result.updated.join(', ') : '(无变更)')
console.log('渠道:', result.channels)
console.log('微信参数齐全:', result.wechatReady ? '是' : '否 — 请填写 payment.secrets.env 或后台')
console.log('支付宝参数齐全:', result.alipayReady ? '是' : '否 — 请填写 payment.secrets.env 或后台')
if (!result.wechatReady || !result.alipayReady) {
  console.log('\n下一步:')
  console.log('  cp server/payment.secrets.env.example server/payment.secrets.env')
  console.log('  编辑密钥后执行: node scripts/setup-payment.mjs')
  console.log('  pm2 restart merchant-appeal')
}
console.log('')
