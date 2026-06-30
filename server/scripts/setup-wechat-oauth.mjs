/**
 * 初始化微信 OAuth 相关数据库字段与配置检查
 * 用法: node server/scripts/setup-wechat-oauth.mjs
 */
import 'dotenv/config'
import { initDatabase } from '../db.js'
import { getWechatOAuthConfig } from '../config/wechatOAuth.js'

await initDatabase()

const cfg = getWechatOAuthConfig()
console.log('\n=== 微信 OAuth 配置检查 ===')
console.log('CUSTOMER_WEB_URL:', cfg.customerWebUrl || '(未设置)')
console.log('WECHAT_OAUTH_PROXY_BASE:', cfg.proxyBase || '(未设置，将直连微信)')
console.log('WECHAT_OAUTH_APPID:', cfg.appId || '(未设置)')
console.log('WECHAT_OAUTH_SECRET:', cfg.secret ? '已设置' : '(未设置)')
console.log('enabled:', cfg.enabled)

if (!cfg.enabled) {
  console.warn('\n⚠️  OAuth 未完全启用，请检查 .env 中的 CUSTOMER_WEB_URL、APPID、SECRET')
  process.exit(1)
}

console.log('\n✅ 数据库字段已就绪，OAuth 配置有效\n')
