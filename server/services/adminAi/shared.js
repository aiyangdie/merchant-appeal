export function parseAiJson(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const text = jsonMatch ? jsonMatch[0] : raw
  return JSON.parse(text)
}

export function normalizeIds(raw) {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return [...new Set(list.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))]
}

export function normalizeStrings(raw) {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))]
}

const ACTION_TYPE_ALIASES = {
  evaluate_rule_effectiveness: 'evaluate_rules',
  evaluate_rules_effectiveness: 'evaluate_rules',
  rule_evaluate: 'evaluate_rules',
  batch_analyze_conversations: 'batch_analyze',
  aggregate_daily_metrics: 'aggregate_metrics',
  auto_promote_rules: 'auto_promote',
  trigger_ai_insight: 'trigger_ai_insights',
  trigger_insights: 'trigger_ai_insights',
  confirm_recharge_order: 'confirm_recharge',
  reject_recharge_order: 'reject_recharge',
  update_status: 'update_order_status',
  run_health_check: 'health_check',
  trigger_health_check: 'health_check',
  create_backup: 'run_backup',
  run_database_backup: 'run_backup',
  database_backup: 'run_backup',
  backup_now: 'run_backup',
  add_schedule: 'create_schedule',
  create_reminder: 'create_schedule',
  add_reminder: 'create_schedule',
  new_schedule: 'create_schedule',
  schedule_create: 'create_schedule',
  remove_schedule: 'delete_schedule',
  mark_schedule_complete: 'complete_schedule',
  complete_reminder: 'complete_schedule',
  confirm_recharge: 'confirm_recharge',
  reject_recharge: 'reject_recharge',
  update_order: 'update_order_status',
  change_order_status: 'update_order_status',
  generate_insights: 'trigger_ai_insights',
  ai_insights: 'trigger_ai_insights',
  chatboard_brief: 'trigger_chatboard_brief',
  token_analyze: 'trigger_token_analyze',
  generate_knowledge_case: 'generate_case',
  add_case: 'generate_case',
  new_case: 'generate_case',
  create_knowledge_case: 'generate_case',
}

/** 统一 action.type（兼容 action / name 字段与别名） */
export function resolveActionType(action) {
  let raw = String(action?.type || action?.action || action?.name || '').trim()
  if (!raw && action?.operation) raw = String(action.operation).trim()
  if (!raw) return ''
  const normalized = raw.replace(/\s+/g, '_').toLowerCase()
  return ACTION_TYPE_ALIASES[normalized] || ACTION_TYPE_ALIASES[raw] || normalized
}
