export function getWechatOAuthConfig() {
  const appId = process.env.WECHAT_OAUTH_APPID || process.env.WECHAT_APP_ID || ''
  const secret = process.env.WECHAT_OAUTH_SECRET || process.env.WECHAT_APP_SECRET || ''
  const proxyBase = (process.env.WECHAT_OAUTH_PROXY_BASE || '').replace(/\/$/, '')
  const customerWebUrl = (process.env.CUSTOMER_WEB_URL || '').replace(/\/$/, '')
  const mpName = process.env.WECHAT_MP_NAME || '艾科技云服务'
  const scope = process.env.WECHAT_OAUTH_SCOPE || 'snsapi_userinfo'
  const enabled = !!(appId && secret && customerWebUrl)
  return { appId, secret, proxyBase, customerWebUrl, mpName, scope, enabled }
}
