/** 微信头像 URL 统一升 HTTPS，避免 Mixed Content */
export function upgradeWechatAvatarUrl(url) {
  if (!url || typeof url !== 'string') return ''
  return url.replace(/^http:\/\//i, 'https://')
}
