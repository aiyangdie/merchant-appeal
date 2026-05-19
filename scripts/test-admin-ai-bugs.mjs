/**
 * 回归：全局 AI pendingDeletes、空 ID 删除、未知 confirm kind
 */
import fs from 'fs'

const BASE = process.env.API_BASE || 'http://127.0.0.1:3003'
const LOG_PATH = '/root/.cursor/debug-48900f.log'

function log(id, msg, data) {
  const line = JSON.stringify({
    sessionId: '48900f',
    hypothesisId: id,
    location: 'test-admin-ai-bugs',
    message: msg,
    data,
    timestamp: Date.now(),
    runId: 'bugfix-v1',
  })
  fs.appendFileSync(LOG_PATH, line + '\n')
  console.log(msg, JSON.stringify(data))
}

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

try {
  fs.writeFileSync(LOG_PATH, '')
} catch {
  /* ignore */
}

const login = await api('POST', '/api/admin/login', { username: 'admin', password: 'admin123' })
if (!login.data.token) {
  log('H0', 'login failed', login)
  process.exit(1)
}
const token = login.data.token

// 空日程 ID：不应产生 pendingConfirms
const emptyDel = await api(
  'POST',
  '/api/admin/ai-command',
  { module: 'schedule', instruction: '删除日程' },
  token
)
const hasEmptyPending =
  emptyDel.data.pendingConfirms?.delete_schedule?.length > 0
log('H-empty-schedule', 'empty schedule delete', {
  ok: emptyDel.ok,
  hasEmptyPending,
  executed: emptyDel.data.executed,
  pendingConfirms: emptyDel.data.pendingConfirms,
})
if (hasEmptyPending) process.exit(1)

// 未知 confirm kind → 应 500
const badConfirm = await api(
  'POST',
  '/api/admin/ai-command/confirm',
  { module: 'schedule', kind: 'not_a_real_kind', payload: { ids: [1] } },
  token
)
log('H-bad-confirm', 'unknown confirm kind', {
  status: badConfirm.status,
  ok: badConfirm.ok,
  error: badConfirm.data.error,
})
if (badConfirm.ok) process.exit(1)

// global 路由到 schedule 且带 ID（仅检查结构，不真删）
const schedList = await api('GET', '/api/schedules', null, token)
const sid = schedList.data.schedules?.[0]?.id
if (sid) {
  const delReq = await api(
    'POST',
    '/api/admin/ai-command',
    { module: 'global', instruction: `删除日程 #${sid}` },
    token
  )
  const hasPending = !!delReq.data.pendingConfirms?.delete_schedule?.includes(sid)
  log('H-global-schedule', 'global delete schedule pending', {
    ok: delReq.ok,
    hasPending,
    navigateTo: delReq.data.navigateTo,
    confirmModule: delReq.data.confirmModule,
    pendingConfirms: delReq.data.pendingConfirms,
  })
  if (!hasPending) process.exit(1)
}

log('SUM', 'all bugfix checks passed', { pass: true })
process.exit(0)
