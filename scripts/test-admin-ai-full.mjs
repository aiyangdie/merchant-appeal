/**
 * 全量管理后台 AI 模块冒烟测试（含 global 万能路由）
 */
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
    runId: 'full-audit',
  })
  fs.appendFileSync(LOG_PATH, line + '\n')
  const ok = data?.ok !== false && !data?.error
  console.log(ok ? '✓' : '✗', message, data?.status || '', (data?.reply || data?.error || '').slice(0, 80))
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
  log('H0', 'login', 'login failed', login)
  process.exit(1)
}
const token = login.data.token
log('H0', 'login', 'login ok', { status: login.status })

const modules = [
  { module: 'recharge', instruction: '有哪些待确认的充值订单？' },
  { module: 'orders', instruction: '列出最近待支付订单' },
  { module: 'analytics', instruction: '最近7天概况' },
  { module: 'knowledge', instruction: '有哪些成功案例？' },
  { module: 'ops', instruction: '运营中心现在什么情况？' },
  { module: 'session-chatboard', instruction: '最近14天会话总览' },
  { module: 'tokens', instruction: '各功能 Token 消耗排行' },
  { module: 'evolution', instruction: '进化模块当前状态' },
  { module: 'schedule', instruction: '列出所有日程' },
  { module: 'backup', instruction: '当前有哪些备份文件？' },
  { module: 'monitor', instruction: '执行一次健康检测' },
  { module: 'settings', instruction: '当前系统配置有哪些？' },
  { module: 'users', instruction: '列出前5个用户' },
  { module: 'mall', instruction: '列出商城商品' },
]

let pass = 0
let fail = 0

for (const t of modules) {
  const r = await api('POST', '/api/admin/ai-command', { module: t.module, instruction: t.instruction }, token)
  const ok = r.ok && r.data.reply
  if (ok) pass++
  else fail++
  log('MOD', `ai:${t.module}`, t.instruction.slice(0, 36), {
    ok,
    status: r.status,
    reply: (r.data.reply || '').slice(0, 120),
    executed: (r.data.executed || []).length,
    error: r.data.error,
  })
}

const globalTests = [
  '有哪些待确认的充值？',
  '立即执行一次数据库备份',
  '当前系统配置有哪些？',
]

for (const instruction of globalTests) {
  const r = await api('POST', '/api/admin/ai-command', { module: 'global', instruction }, token)
  const ok = r.ok && r.data.reply
  if (ok) pass++
  else fail++
  log('GLOBAL', 'ai:global', instruction.slice(0, 36), {
    ok,
    status: r.status,
    reply: (r.data.reply || '').slice(0, 120),
    routedModules: r.data.routedModules,
    executed: (r.data.executed || []).map((e) => e.type),
    error: r.data.error,
  })
}

log('SUM', 'summary', `pass=${pass} fail=${fail}`, { pass, fail, total: pass + fail })
process.exit(fail > 0 ? 1 : 0)
