import { upgradeWechatAvatarUrl } from '@shared/wechatAvatar.js'

const TOKEN_KEY = 'appeal_token'
const USER_KEY = 'appeal_user'
const OAUTH_REDIRECT_KEY = 'oauth_redirect_ts'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function authHeaders() {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export function upgradeAvatar(url) {
  return upgradeWechatAvatarUrl(url)
}

export function isWechat() {
  return /micromessenger/i.test(navigator.userAgent)
}

let onUnauthorized = null
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    clearAuth()
    if (onUnauthorized) onUnauthorized()
    throw new Error('登录已过期，请重新登录')
  }
  if (!res.ok) throw new Error(data.error || '请求失败')
  return data
}

export function canStartOAuthRedirect() {
  const ts = Number(sessionStorage.getItem(OAUTH_REDIRECT_KEY) || 0)
  if (Date.now() - ts < 8000) return false
  sessionStorage.setItem(OAUTH_REDIRECT_KEY, String(Date.now()))
  return true
}

export async function getOAuthConfig() {
  return api('/api/wechat/oauth/config')
}

export async function getOAuthUrl(returnPath = '/cases') {
  return api(`/api/wechat/oauth/url?returnPath=${encodeURIComponent(returnPath)}`)
}

export async function exchangeOAuthCode(code, state, returnPath) {
  const usedKey = `oauth_used_${code}`
  if (sessionStorage.getItem(usedKey)) {
    throw new Error('授权码已使用，请返回首页重新登录')
  }
  sessionStorage.setItem(usedKey, '1')
  return api('/api/wechat/oauth/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, state, returnPath }),
  })
}

export async function loginWithPhone(phone) {
  const data = await api('/api/user/login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
  setAuth(data.token, data.user)
  return data
}

export async function registerWithPhone(phone, nickname) {
  const data = await api('/api/user/register', {
    method: 'POST',
    body: JSON.stringify({ phone, nickname }),
  })
  setAuth(data.token, data.user)
  return data
}

export async function fetchProfile() {
  const data = await api('/api/user/profile')
  if (data.user) setAuth(getToken(), data.user)
  return data.user
}

export async function completeProfile(payload) {
  const data = await api('/api/user/complete-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setAuth(getToken(), data.user)
  return data.user
}

export async function fetchCases() {
  const data = await api('/api/user/cases')
  return data.sessions || []
}

export async function createSession() {
  return api('/api/sessions', { method: 'POST', body: JSON.stringify({}) })
}
