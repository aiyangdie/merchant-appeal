/** 主壳 5 Tab 导航：刷新 / 返回时保持当前 Tab */

export const MOBILE_TABS = ['home', 'chat', 'tools', 'cases', 'me']
const TAB_KEY = 'appeal_mobile_tab'

export function isMobileTab(value) {
  return MOBILE_TABS.includes(value)
}

/** 从 hash (#chat) → query (?tab=cases) → sessionStorage 读取 Tab */
export function readMobileTab() {
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (isMobileTab(hash)) return hash

  const q = new URLSearchParams(window.location.search).get('tab')
  if (isMobileTab(q)) return q

  try {
    const saved = sessionStorage.getItem(TAB_KEY)
    if (isMobileTab(saved)) return saved
  } catch {}

  return 'home'
}

/** 持久化 Tab，并同步到 URL hash（首页不带 hash） */
export function writeMobileTab(tab) {
  if (!isMobileTab(tab)) return
  try {
    sessionStorage.setItem(TAB_KEY, tab)
  } catch {}

  const url = new URL(window.location.href)
  url.searchParams.delete('tab')
  const search = url.searchParams.toString()
  const base = url.pathname + (search ? `?${search}` : '')
  const target = tab === 'home' ? base : `${base}#${tab}`
  const current = `${url.pathname}${url.search}${url.hash}`
  if (current !== target) {
    window.history.replaceState({}, '', target)
  }
}

/** 清理 OAuth / 外链带入的一次性 query，保留 hash Tab */
export function consumeOneShotQuery(keys = ['sessionId', 'bindPhone', 'tab']) {
  const url = new URL(window.location.href)
  let changed = false
  for (const k of keys) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k)
      changed = true
    }
  }
  if (!changed) return
  const search = url.searchParams.toString()
  window.history.replaceState({}, '', url.pathname + (search ? `?${search}` : '') + url.hash)
}
