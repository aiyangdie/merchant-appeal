const ACTION_SCHEMAS = {
  recharge: `actions 类型:
- confirm_recharge: { "orderIds": [1] } 确认待审核充值到账
- reject_recharge: { "orderIds": [1], "adminNote": "可选备注" } 拒绝充值`,

  orders: `actions 类型:
- update_order_status: { "orderIds": [1], "status": "paid|serving|completed|cancelled|pending" }`,

  analytics: `actions 类型:
- trigger_ai_insights: { "days": 30 } 生成 AI 经营洞察报告（异步，结果在数据分析页查看）`,

  knowledge: `actions 类型:
- generate_case 或 create_case: { "instruction": "管理员的完整描述" } 根据描述 AI 生成新案例并写入知识库（无现成案例 id 时使用）
- create_case: { "title": "标题", "industry": "行业", "problemType": "处罚类型", "successSummary": "成功要点", "adminNotes": "", "reportContent": "" } 字段齐全时直接入库
- delete_case: { "caseIds": [1] } 删除案例（需管理员二次确认）
- archive_case: { "caseIds": [1] } 归档案例`,

  ops: `actions 类型:
- create_quick_reply: { "text": "快捷回复内容" }
- delete_quick_reply: { "replyIds": [1] } 删除快捷回复（需确认）`,

  'session-chatboard': `actions 类型:
- trigger_chatboard_brief: { "days": 14 } 生成会话看板 AI 简报`,

  tokens: `actions 类型:
- trigger_token_analyze: { "days": 14 } 生成 Token 消耗 AI 监管报告`,

  evolution: `actions 类型:
- batch_analyze: { "limit": 10 } 批量分析未处理对话
- aggregate_metrics: {} 触发学习指标日聚合
- auto_promote: {} 自动升降级规则
- evaluate_rules: {} 评估规则效果`,

  schedule: `actions 类型:
- create_schedule: { "title": "标题", "scheduledTime": "2026-05-20T10:00", "description": "", "scheduleType": "reminder" }
- delete_schedule: { "scheduleIds": [1] } 删除日程（需确认）
- complete_schedule: { "scheduleIds": [1] } 标记完成`,

  backup: `actions 类型:
- run_backup: {} 立即执行数据库备份
- delete_backup: { "filename": "backup-xxx.sql.gz" } 删除备份文件（需确认）`,

  monitor: `actions 类型:
- health_check: {} 手动健康检测
- clear_alerts: {} 清空全部告警
- acknowledge_alert: { "alertId": "id" } 确认单条告警`,

  settings: `actions 类型:
- update_setting: { "key": "config_key", "value": "新值" } 仅可修改非 API 密钥类配置；禁止修改 deepseek_api_key 等密钥`,
}

const MODULE_TITLES = {
  recharge: '充值管理',
  orders: '订单管理',
  analytics: '数据分析',
  knowledge: '知识库',
  ops: '运营中心',
  'session-chatboard': '会话看板',
  tokens: '拓客明细（Token）',
  evolution: 'AI 进化',
  schedule: '日程安排',
  backup: '数据备份',
  monitor: '监控告警',
  settings: '系统设置',
}

export function buildSystemPrompt(module, catalog, meta = {}) {
  const title = MODULE_TITLES[module] || module
  const schema = ACTION_SCHEMAS[module] || 'actions 为空数组，仅在 reply 中回答'
  const metaStr = Object.keys(meta).length ? `\n## 附加统计\n${JSON.stringify(meta)}` : ''

  return `你是商户申诉平台管理后台「${title}」助手。管理员用自然语言操作后台。

## 当前数据目录
${catalog}
${metaStr}

## 输出格式（仅 JSON，无其它文字）
{
  "reply": "给管理员的中文回复",
  "actions": [ ... ]
}

## 可执行操作
${schema}

## 规则
1. ID 必须来自目录中存在的编号（#id）。
2. 查询、统计类问题 → actions 为空，在 reply 中根据目录回答。
3. 无法执行时 actions 为空并说明原因。
4. 不要编造不存在的 id 或文件名。
5. 批量操作可一次 actions 包含多个同类型项或合并 id 数组。
6. 每个 action 必须用字段 "type"，取值必须与上文「可执行操作」中的类型名完全一致（如 create_schedule、run_backup），不要用 action/name/operation 或其它别名。
7. 写操作类指令（创建、删除、备份、改状态等）必须给出非空 actions，不能只写在 reply 里。
8. 知识库：管理员要求「生成/新建/创建一个案例」且描述了场景时，使用 generate_case 并把完整用户描述放入 instruction；不要回复「只能管理现有案例」。`
}

export const VALID_MODULES = Object.keys(MODULE_TITLES)
export { MODULE_TITLES }
