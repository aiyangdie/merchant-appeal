import fs from 'fs'

const BASE = process.env.API_BASE || 'http://127.0.0.1:3003'
const LOG_PATH = '/root/.cursor/debug-48900f.log'

function log(hypothesisId, location, message, data) {
  const line = JSON.stringify({
    sessionId: '48900f',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: 'audit-v1',
  })
  fs.appendFileSync(LOG_PATH, line + '\n')
  console.log(message, JSON.stringify(data))
}

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (token) opts.headers.Authorization = `Bearer ${token}`
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const login = await api('POST', '/api/admin/login', { username: 'admin', password: 'admin123' })
if (!login.data.token) {
  log('H0', 'test-http', 'login failed', login)
  process.exit(1)
}
const token = login.data.token
log('H0', 'test-http', 'login ok', { status: login.status })

const beforeSched = await api('GET', '/api/schedules', null, token)
log('H3', 'test-http', 'schedules before', { count: beforeSched.data.schedules?.length })

const tests = [
  { id: 'H1', module: 'schedule', instruction: '明天上午10点提醒我审核充值' },
  { id: 'H1b', module: 'schedule', instruction: '创建日程：标题「AI测试日程」，时间 2026-05-20T10:00:00' },
  { id: 'H2', module: 'backup', instruction: '立即执行一次数据库备份' },
  { id: 'H2', module: 'monitor', instruction: '执行一次健康检测' },
  { id: 'H4', module: 'analytics', instruction: '生成 AI 经营洞察报告' },
  { id: 'H4', module: 'settings', instruction: '当前系统配置有哪些？' },
  { id: 'H5', module: 'recharge', instruction: '有哪些待确认的充值订单？' },
]

for (const t of tests) {
  const r = await api(
    'POST',
    '/api/admin/ai-command',
    { module: t.module, instruction: t.instruction },
    token
  )
  log(t.id, 'ai-command', `${t.module}: ${t.instruction.slice(0, 40)}`, {
    ok: r.ok,
    status: r.status,
    reply: (r.data.reply || '').slice(0, 200),
    executed: r.data.executed,
    pendingConfirms: r.data.pendingConfirms,
    error: r.data.error,
  })
}

const afterSched = await api('GET', '/api/schedules', null, token)
log('H3', 'test-http', 'schedules after', {
  count: afterSched.data.schedules?.length,
  last: (afterSched.data.schedules || []).slice(-3).map((s) => ({
    id: s.id,
    title: s.title,
    time: s.scheduled_time,
  })),
})
