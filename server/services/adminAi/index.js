import { getAIConfig } from '../../shared/aiConfig.js'
import { executeUserAiCommand } from '../userAiCommand.js'
import { executeMallAiCommand } from '../mallAiCommand.js'
import { buildModuleContext } from './contexts.js'
import { buildSystemPrompt, VALID_MODULES } from './prompts.js'
import { parseAiJson, resolveActionType } from './shared.js'
import { executeModuleActions, executeConfirmedAction } from './executors.js'
import { routeAndExecuteGlobal } from './globalOrchestrator.js'

export { VALID_MODULES }

async function runModuleCommand(mod, instruction, adminCtx) {
  return executeAdminAiCommand(mod, instruction, { ...adminCtx, _skipGlobal: true })
}

export async function executeAdminAiCommand(module, instruction, adminCtx = {}) {
  const mod = String(module || '').trim()
  if (!instruction?.trim()) {
    return { reply: '请输入指令', executed: [] }
  }

  if (mod === 'global' && !adminCtx._skipGlobal) {
    return routeAndExecuteGlobal(instruction, runModuleCommand, adminCtx)
  }

  if (mod === 'users') {
    return executeUserAiCommand(instruction)
  }
  if (mod === 'mall') {
    return executeMallAiCommand(instruction)
  }

  if (!VALID_MODULES.includes(mod)) {
    return { reply: `不支持的模块: ${mod}`, executed: [] }
  }

  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    return { reply: 'AI 服务未配置，请先在系统设置中配置模型', executed: [] }
  }

  const { catalog, meta } = await buildModuleContext(mod)
  const systemPrompt = buildSystemPrompt(mod, catalog, meta)

  const aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction.trim() },
      ],
      temperature: 0.2,
      max_tokens: 2200,
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '')
    return { reply: `AI 调用失败: ${aiRes.status} ${errText.slice(0, 120)}`, executed: [] }
  }

  const data = await aiRes.json()
  const raw = data.choices?.[0]?.message?.content || ''

  let plan
  try {
    plan = parseAiJson(raw)
  } catch {
    return { reply: 'AI 返回格式无法解析，请换种说法重试', executed: [], raw: raw.slice(0, 500) }
  }

  let actions = Array.isArray(plan.actions) ? plan.actions : []
  actions = actions.filter((a) => resolveActionType(a))
  actions = applyIntentFallback(mod, instruction.trim(), actions)

  const { executed, pendingConfirms } = await executeModuleActions(mod, actions, {
    adminId: adminCtx.adminId || 0,
    instruction: instruction.trim(),
  })

  const pending = flattenPendingConfirms(pendingConfirms)

  return {
    reply: plan.reply || '已完成',
    executed,
    pendingConfirms: pending,
    module: mod,
  }
}

/** 当 LLM 只回复文字未给 actions 时，按关键词补全常见操作 */
function applyIntentFallback(module, instruction, actions) {
  if (actions.length > 0) return actions
  const t = instruction
  if (module === 'evolution') {
    if (/批量分析|分析未处理/.test(t)) return [{ type: 'batch_analyze', limit: 10 }]
    if (/规则效果|效果评估|evaluate/.test(t)) return [{ type: 'evaluate_rules' }]
    if (/升降级|自动晋升|promote/.test(t)) return [{ type: 'auto_promote' }]
    if (/聚合|aggregate/.test(t)) return [{ type: 'aggregate_metrics' }]
  }
  if (module === 'analytics' && /洞察|分析报告|AI.*分析/.test(t)) {
    return [{ type: 'trigger_ai_insights', days: 30 }]
  }
  if (module === 'session-chatboard' && /简报/.test(t)) {
    return [{ type: 'trigger_chatboard_brief', days: 14 }]
  }
  if (module === 'tokens' && /监管|分析报告|Token.*分析/.test(t)) {
    return [{ type: 'trigger_token_analyze', days: 14 }]
  }
  if (module === 'backup' && /备份|立即备份/.test(t)) return [{ type: 'run_backup' }]
  if (module === 'monitor' && /健康检测|立即检测/.test(t)) return [{ type: 'health_check' }]
  if (module === 'knowledge') {
    if (/生成|新建|创建|添加|写一?个?|来一?个?|做一个/.test(t) && /案例|知识库|成功/.test(t)) {
      return [{ type: 'generate_case', instruction: t }]
    }
    if (/^你?生成/.test(t) || /新的.*案例/.test(t) || /案例.*生成/.test(t)) {
      return [{ type: 'generate_case', instruction: t }]
    }
  }
  if (module === 'schedule') {
    if (/删除日程|删掉日程/.test(t)) {
      const m = t.match(/#?(\d+)/)
      if (m) return [{ type: 'delete_schedule', scheduleIds: [parseInt(m[1], 10)] }]
    }
    if (/完成|标记完成/.test(t) && /日程|#/.test(t)) {
      const m = t.match(/#?(\d+)/)
      if (m) return [{ type: 'complete_schedule', scheduleIds: [parseInt(m[1], 10)] }]
    }
    if (/提醒|日程|安排|创建|添加/.test(t)) {
      const titleMatch = t.match(/[「『]([^」』]+)[」』]|标题[是为：:]\s*([^\s，,。]+)/)
      const isoMatch = t.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/)
      let title = titleMatch?.[1] || titleMatch?.[2] || ''
      if (!title) {
        const m = t.match(/提醒我?(.+?)(?:$|，|。)/)
        title = (m?.[1] || '').replace(/明天|上午|下午|上午|点/g, '').trim()
      }
      title = (title || 'AI 提醒').slice(0, 80)
      let scheduledTime = isoMatch?.[0] || ''
      if (!scheduledTime && /明天/.test(t)) {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        const h = (t.match(/(\d{1,2})\s*点/) || [])[1] || '10'
        scheduledTime = `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:00:00`
      }
      if (scheduledTime) return [{ type: 'create_schedule', title, scheduledTime, description: t }]
    }
  }
  return actions
}

function flattenPendingConfirms(list) {
  const out = { delete_case: [], delete_schedule: [], delete_backup: [], delete_quick_reply: [] }
  for (const item of list) {
    if (item.kind === 'delete_case') out.delete_case.push(...(item.ids || []))
    if (item.kind === 'delete_schedule') out.delete_schedule.push(...(item.ids || []))
    if (item.kind === 'delete_backup') out.delete_backup.push(...(item.filenames || []))
    if (item.kind === 'delete_quick_reply') out.delete_quick_reply.push(...(item.ids || []))
  }
  const compact = {}
  for (const [k, v] of Object.entries(out)) {
    if (v.length) compact[k] = [...new Set(v)]
  }
  return Object.keys(compact).length ? compact : undefined
}

export async function confirmAdminAiAction(module, kind, payload, adminCtx = {}) {
  const executed = await executeConfirmedAction(kind, payload, adminCtx)
  return { reply: '确认操作已完成', executed, module }
}
