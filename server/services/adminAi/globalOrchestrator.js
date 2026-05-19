/**
 * 全局万能 AI：将自然语言路由到各业务模块并串联执行
 */
import { getAIConfig } from '../../shared/aiConfig.js'
import { parseAiJson } from './shared.js'
import { MODULE_TITLES } from './prompts.js'

const ROUTABLE_MODULES = [
  ...Object.keys(MODULE_TITLES),
  'users',
  'mall',
]

const MODULE_HINTS = `
- recharge: 充值订单确认/拒绝、待审核列表
- orders: 申诉订单状态（待支付/服务中/已完成等）
- analytics: 经营数据查询、AI 经营洞察报告
- knowledge: 成功案例生成/归档/删除
- ops: 运营中心快捷回复
- session-chatboard: 会话看板统计、AI 简报
- tokens: Token 消耗统计、AI 监管报告
- evolution: 对话批量分析、规则评估与升降级
- schedule: 日程创建/完成/删除
- backup: 数据库备份与备份文件管理
- monitor: 健康检测、告警处理
- settings: 非密钥类系统配置查询与修改
- users: 用户列表、充值扣款、删除用户
- mall: 商城商品上架/下架/创建
`.trim()

const MODULE_TO_TAB = {
  ops: 'ops-center',
  'session-chatboard': 'session-chatboard',
  recharge: 'recharge',
  orders: 'orders',
  knowledge: 'knowledge',
  analytics: 'analytics',
  tokens: 'tokens',
  evolution: 'evolution',
  schedule: 'schedule',
  backup: 'backup',
  monitor: 'monitor',
  settings: 'settings',
  users: 'users',
  mall: 'mall',
}

function resolveNavigateTab(navigateTo, fallbackModule) {
  const raw = String(navigateTo || fallbackModule || '').trim()
  if (!raw) return undefined
  return MODULE_TO_TAB[raw] || raw
}

function buildRouterPrompt() {
  const titles = Object.entries(MODULE_TITLES)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return `你是商户申诉平台管理后台的「全能协调器」。管理员用一句自然语言可能涉及一个或多个后台模块。

## 模块列表
${titles}
users: 用户管理
mall: 商城商品

## 能力说明
${MODULE_HINTS}

## 输出格式（仅 JSON）
{
  "reply": "给管理员的中文说明（将执行什么）",
  "tasks": [
    { "module": "模块名", "instruction": "传给该模块助手的具体指令（中文，含必要 id）" }
  ],
  "navigateTo": "可选，建议管理员前往的 Tab：dashboard|recharge|orders|knowledge|schedule|tokens|evolution|backup|monitor|settings|users|mall|analytics|session-chatboard|ops-center 或空字符串"
}

## 规则
1. tasks 最多 3 项，按执行顺序排列；纯聊天或与后台无关时 tasks 为空。
2. module 必须是上述模块名之一；users/mall 用于用户与商城。
3. 每个 task.instruction 要自包含，模块助手看不到原始对话。
4. 删除类操作会在执行后由系统要求二次确认，照常下发 task。
5. 不要编造 id；不确定时 instruction 写「查询…」由模块助手根据目录回答。`
}

function guessTasksFromKeywords(text) {
  const rules = [
    { re: /充值|到账|待确认/, module: 'recharge' },
    { re: /订单|申诉.*状态/, module: 'orders' },
    { re: /备份/, module: 'backup', inst: '立即执行一次数据库备份' },
    { re: /健康检测|健康检查/, module: 'monitor', inst: '执行一次健康检测' },
    { re: /日程|提醒/, module: 'schedule' },
    { re: /案例|知识库/, module: 'knowledge' },
    { re: /Token|拓客/, module: 'tokens' },
    { re: /进化|规则/, module: 'evolution' },
    { re: /会话看板|简报/, module: 'session-chatboard' },
    { re: /经营|数据分析|洞察/, module: 'analytics' },
    { re: /快捷回复|运营/, module: 'ops' },
    { re: /系统配置|设置/, module: 'settings' },
    { re: /用户|余额|扣款/, module: 'users' },
    { re: /商城|商品/, module: 'mall' },
  ]
  for (const r of rules) {
    if (r.re.test(text)) {
      return [{ module: r.module, instruction: r.inst || text }]
    }
  }
  return []
}

function mergePending(a, b) {
  if (!b) return a
  const out = { ...(a || {}) }
  for (const [k, ids] of Object.entries(b)) {
    if (!ids?.length) continue
    out[k] = [...new Set([...(out[k] || []), ...ids])]
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * @param {string} instruction
 * @param {(mod: string, inst: string, ctx: object) => Promise<object>} runModule
 * @param {object} adminCtx
 */
export async function routeAndExecuteGlobal(instruction, runModule, adminCtx = {}) {
  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    return { reply: 'AI 服务未配置，请先在系统设置中配置模型', executed: [], module: 'global' }
  }

  const aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: buildRouterPrompt() },
        { role: 'user', content: instruction.trim() },
      ],
      temperature: 0.15,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '')
    return {
      reply: `路由 AI 调用失败: ${aiRes.status} ${errText.slice(0, 100)}`,
      executed: [],
      module: 'global',
    }
  }

  const data = await aiRes.json()
  const raw = data.choices?.[0]?.message?.content || ''
  let plan
  try {
    plan = parseAiJson(raw)
  } catch {
    return { reply: '无法理解指令，请换种说法', executed: [], module: 'global', raw: raw.slice(0, 300) }
  }

  let tasks = Array.isArray(plan.tasks) ? plan.tasks : []
  tasks = tasks
    .filter((t) => t && ROUTABLE_MODULES.includes(String(t.module || '').trim()))
    .slice(0, 3)
    .map((t) => ({
      module: String(t.module).trim(),
      instruction: String(t.instruction || instruction).trim(),
    }))

  if (!tasks.length) {
    tasks = guessTasksFromKeywords(instruction.trim())
  }

  if (!tasks.length) {
    return {
      reply: plan.reply || '请说明要在后台执行的操作，例如：待确认充值、创建日程、备份数据库等。',
      executed: [],
      module: 'global',
      navigateTo: plan.navigateTo || undefined,
    }
  }

  const allExecuted = []
  let mergedPending
  let mergedPendingDeletes = []
  const moduleReplies = []
  let lastModule

  for (const task of tasks) {
    const result = await runModule(task.module, task.instruction, adminCtx)
    lastModule = task.module
    if (result.reply) moduleReplies.push(`【${MODULE_TITLES[task.module] || task.module}】${result.reply}`)
    if (result.executed?.length) allExecuted.push(...result.executed.map((e) => ({ ...e, _module: task.module })))
    mergedPending = mergePending(mergedPending, result.pendingConfirms)
    if (result.pendingDeletes?.length) {
      mergedPendingDeletes = [...new Set([...mergedPendingDeletes, ...result.pendingDeletes])]
    }
  }

  const head = plan.reply ? plan.reply + '\n\n' : ''
  const body = moduleReplies.join('\n\n')

  return {
    reply: head + body || '已完成',
    executed: allExecuted,
    pendingConfirms: mergedPending,
    pendingDeletes: mergedPendingDeletes.length ? mergedPendingDeletes : undefined,
    module: 'global',
    routedModules: tasks.map((t) => t.module),
    confirmModule: lastModule,
    navigateTo: resolveNavigateTab(plan.navigateTo, tasks[0]?.module),
  }
}
