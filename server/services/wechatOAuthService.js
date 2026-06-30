import jwt from 'jsonwebtoken'
import { upgradeWechatAvatarUrl } from '../../shared/wechatAvatar.js'
import { getWechatOAuthConfig } from '../config/wechatOAuth.js'
import {
  findOrCreateWechatUser,
  formatUserForClient,
  incrementLoginCount,
  updateUserActivity,
  trackUserAction,
} from '../db.js'
import { signToken } from '../middleware/auth.js'

const JWT_SECRET = process.env.JWT_SECRET

/** 仅允许站内相对路径，防 open redirect */
export function safeReturnPath(path) {
  const p = String(path || '/chat/').trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('://')) return '/chat/'
  return p.split('?')[0] || '/chat/'
}

export function getWechatOAuthAdminInfo() {
  const cfg = getWechatOAuthConfig()
  let callbackHost = ''
  try {
    callbackHost = cfg.customerWebUrl ? new URL(cfg.customerWebUrl).host : ''
  } catch { /* ignore */ }
  return {
    enabled: cfg.enabled,
    appId: cfg.appId,
    mpName: cfg.mpName,
    scope: cfg.scope,
    proxyBase: cfg.proxyBase || null,
    callbackUrl: cfg.customerWebUrl ? `${cfg.customerWebUrl}/chat/auth/wechat/callback` : null,
    callbackHost,
    proxyRequired: !!cfg.proxyBase,
    openAdminUrl: cfg.proxyBase ? `${cfg.proxyBase.replace(/\/$/, '')}/admin` : 'https://open.aikex.ink/admin',
  }
}

export function getOAuthPublicConfig() {
  const cfg = getWechatOAuthConfig()
  return {
    enabled: cfg.enabled,
    appId: cfg.appId,
    mpName: cfg.mpName,
    scope: cfg.scope,
    callbackPath: '/auth/wechat/callback',
    proxyBase: cfg.proxyBase || null,
    customerWebUrl: cfg.customerWebUrl || null,
  }
}

export function buildOAuthAuthorizeUrl(returnPath = '/cases') {
  const cfg = getWechatOAuthConfig()
  if (!cfg.enabled) throw new Error('微信 OAuth 未配置')

  const safePath = safeReturnPath(returnPath)
  const callback = `${cfg.customerWebUrl}/chat/auth/wechat/callback`
  const state = jwt.sign(
    { returnPath: safePath, mode: 'customer' },
    JWT_SECRET,
    { expiresIn: '15m' }
  )

  const base = cfg.proxyBase || 'https://open.weixin.qq.com'
  const param = new URLSearchParams({
    appid: cfg.appId,
    redirect_uri: callback,
    response_type: 'code',
    scope: cfg.scope,
    state,
  })

  const path = cfg.proxyBase
    ? '/connect/oauth2/authorize'
    : '/connect/oauth2/authorize'

  return `${base}${path}?${param.toString()}#wechat_redirect`
}

export async function exchangeOAuthCode(code, meta = {}) {
  const cfg = getWechatOAuthConfig()
  if (!cfg.enabled) throw new Error('微信 OAuth 未配置')
  if (!code) throw new Error('缺少授权码 code')

  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
  tokenUrl.search = new URLSearchParams({
    appid: cfg.appId,
    secret: cfg.secret,
    code,
    grant_type: 'authorization_code',
  }).toString()

  const tokenRes = await fetch(tokenUrl)
  const tokenData = await tokenRes.json()
  if (tokenData.errcode) {
    const msg = tokenData.errmsg || '换取 access_token 失败'
    if (tokenData.errcode === 40163 || /code been used/i.test(msg)) {
      throw new Error('授权码已失效，请重新发起登录')
    }
    throw new Error(msg)
  }

  const { access_token, openid, unionid } = tokenData
  if (!openid) throw new Error('未获取到 openid')

  let nickname = '微信用户'
  let headimgurl = ''

  if (cfg.scope === 'snsapi_userinfo' && access_token) {
    const infoUrl = new URL('https://api.weixin.qq.com/sns/userinfo')
    infoUrl.search = new URLSearchParams({
      access_token,
      openid,
      lang: 'zh_CN',
    }).toString()
    const infoRes = await fetch(infoUrl)
    const info = await infoRes.json()
    if (!info.errcode) {
      nickname = info.nickname || nickname
      headimgurl = upgradeWechatAvatarUrl(info.headimgurl || '')
    }
  }

  const user = await findOrCreateWechatUser({
    openid,
    unionid: unionid || null,
    nickname,
    avatarUrl: headimgurl,
    oauthScope: cfg.scope,
    oauthProxy: cfg.proxyBase || '',
  })

  if (meta.ip) await updateUserActivity(user.id, meta.ip)
  await incrementLoginCount(user.id)
  await trackUserAction(
    user.id,
    'wechat_oauth_login',
    `openid:${openid.slice(0, 8)}...`,
    meta.ip || '',
    meta.userAgent || ''
  )

  const token = signToken({ userId: user.id, role: 'user' })
  const clientUser = formatUserForClient(user)
  const needsProfile = !isRealPhone(user.phone)

  return { token, user: clientUser, needsProfile }
}

function isRealPhone(phone) {
  return phone && /^1[3-9]\d{9}$/.test(String(phone).trim())
}

export function parseOAuthState(state) {
  if (!state) return { returnPath: '/cases' }
  try {
    const decoded = jwt.verify(state, JWT_SECRET)
    return { returnPath: safeReturnPath(decoded.returnPath) }
  } catch {
    return { returnPath: '/cases' }
  }
}
