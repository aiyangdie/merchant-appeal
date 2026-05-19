/**
 * Token 使用说明 — 供管理端「使用指南」与明细摘要生成
 */
import { AI_USAGE_CATEGORIES, AI_USAGE_TYPES } from './usageRegistry.js'

/** 各功能触发位置与计费说明（人工维护，与代码路径对应） */
export const USAGE_TRIGGER_MAP = {
  chat: {
    where: '用户端 · 申诉对话',
    path: 'handlers/chatStreamHandler.js → trackAIUsageFromRequest',
    billing: '官方模式：按倍率扣余额并记入 token_usage；自定义 Key：仅记日志',
  },
  chat_collection: {
    where: '用户端 · 信息收集轮次',
    path: 'handlers/chatStreamHandler.js（收集阶段）',
    billing: '同 chat',
  },
  deep_analysis: {
    where: '用户端 · 深度分析',
    path: 'handlers/appealGuideApi.js / 分析接口',
    billing: '用户扣费 + 双写 token_usage_logs',
  },
  appeal_text: {
    where: '用户端 · 生成申诉文案',
    path: 'ai/core/llm.js（流式）',
    billing: '用户扣费；流式结束写入 usage',
  },
  complaint_doc: {
    where: '用户端 · 投诉材料整理',
    path: 'ai/core/llm.js',
    billing: '同 appeal_text',
  },
  report_retry: {
    where: '用户端 · 重新生成报告',
    path: '申诉报告生成流程',
    billing: '用户扣费',
  },
  ai_extraction: {
    where: '用户端 · 对话字段提取',
    path: '聊天后处理 / 提取任务',
    billing: '用户扣费',
  },
  field_extraction: { where: '历史别名', path: '同 ai_extraction', billing: '同 ai_extraction' },
  industry_expansion: {
    where: '用户端 · 行业字段扩展',
    path: '行业模板扩展',
    billing: '用户或系统',
  },
  completeness_check: {
    where: '用户端 · 材料完成度',
    path: '完成度评估接口',
    billing: '用户扣费',
  },
  copywriting: {
    where: '用户端 · 智能文案',
    path: 'routes/copywritingRoutes.js',
    billing: '用户扣费；部分直连 token_usage_logs',
  },
  evolution_analysis: {
    where: '管理端 · AI 进化',
    path: 'evolution.js',
    billing: '系统承担 user_id=0',
  },
  auto_review: {
    where: '管理端 · 规则自动审批',
    path: 'evolution.js',
    billing: '系统承担',
  },
  xianyu_dashboard_report: {
    where: '闲鱼看板',
    path: 'xianyu-dashboard.js',
    billing: '系统承担',
  },
  admin_chatboard_brief: {
    where: '管理端 · 会话看板',
    path: 'adminRoutes.js',
    billing: '系统承担',
  },
  admin_prompt_test: {
    where: '运营中心 · Prompt 测试',
    path: 'adminRoutes.js',
    billing: '系统承担',
  },
  admin_xianyu_parse: {
    where: '闲管家配置解析',
    path: 'adminRoutes.js',
    billing: '系统承担',
  },
  admin_ai_assist: {
    where: '管理端 · AI 辅助生成',
    path: 'adminRoutes.js',
    billing: '系统承担',
  },
  admin_model_test: {
    where: '系统设置 · 模型测试',
    path: 'modelHealth.js / adminRoutes',
    billing: '系统承担，低消耗',
  },
  admin_token_analyze: {
    where: 'Token 明细 · AI 监管报告',
    path: 'POST /api/admin/token-usage/ai-analyze',
    billing: '系统承担',
  },
  admin_analytics_insights: {
    where: '数据分析 · AI 洞察',
    path: 'adminRoutes.js',
    billing: '系统承担',
  },
  admin_knowledge_ai: {
    where: '知识库 · AI 生成/增强案例',
    path: 'adminAi/knowledgeGenerate.js、cases/ai-enhance',
    billing: '系统承担',
  },
  admin_ai_command: {
    where: '各模块 · 统一 AI 指令',
    path: 'services/adminAi → trackAIUsage（按模块）',
    billing: '系统承担',
  },
  mall_bargain: { where: '商城 · 砍价', path: 'mall.js', billing: '用户或系统' },
  mall_persona: { where: '商城 · 人设', path: 'mall.js', billing: '用户' },
  mall_risk: { where: '商城 · 风控', path: 'mall.js', billing: '用户' },
  mall_recommend: { where: '商城 · 推荐', path: 'mall.js', billing: '用户' },
  mall_interest: { where: '商城 · 兴趣画像', path: 'mall.js', billing: '用户' },
  mall_product_optimize: { where: '商城 · 商品优化', path: 'mall.js', billing: '系统' },
  mall_product_suggest: { where: '商城 · 商品建议', path: 'mall.js', billing: '系统' },
  order_service_chat: { where: '订单服务对话', path: '订单服务模块', billing: '用户' },
  health_probe: { where: '模型健康探测', path: 'modelHealth.js', billing: '系统' },
  appeal_guide_generate: {
    where: '申诉指导快照',
    path: 'ai/appealGuideSnapshot.js',
    billing: '系统承担',
  },
  complaint_reply_ai: { where: '历史别名', path: '并入 appeal_guide_generate', billing: '系统' },
  phone_script_ai: { where: '历史别名', path: '并入 appeal_guide_generate', billing: '系统' },
}

export const TOKEN_BILLING_DOC = {
  tables: [
    {
      name: 'token_usage',
      label: '计费明细（用户扣费 / 系统记账）',
      fields: 'user_id, session_id, type, input/output/total_tokens, cost, multiplier, api_mode, detail_summary',
    },
    {
      name: 'token_usage_logs',
      label: '模型调用日志（每次 API 返回 usage）',
      fields: 'provider, model_name, prompt/completion/total_tokens, request_type, cost_yuan, detail_summary',
    },
  ],
  flow: [
    '所有 AI 调用应走 trackAIUsage（server/ai/usageTracker.js）',
    '同时写入 token_usage（按用户/系统计费）与 token_usage_logs（模型维度）',
    '用户官方模式：cost = (输入/1000×0.001 + 输出/1000×0.002) × 倍率，并扣余额',
    '系统任务 user_id=0：cost=0，仍记录 Token 便于监管',
    '「全部流水」Tab 会合并两表并去重（3 秒内同类型同 Token）',
  ],
  pricing: {
    userReference: '输入 ¥0.001/1K · 输出 ¥0.002/1K（×倍率后向用户收取）',
    logCostYuan: '日志侧按供应商单价估算（volcengine/deepseek 等，见 usageTracker.logModelUsage）',
  },
}

export function buildDetailSummary(type, extra = '') {
  const meta = AI_USAGE_TYPES[type]
  const trigger = USAGE_TRIGGER_MAP[type]
  const base = meta ? `${meta.icon} ${meta.label}` : type
  const where = trigger?.where ? ` @ ${trigger.where}` : ''
  const tail = extra ? ` — ${String(extra).slice(0, 200)}` : ''
  return `${base}${where}${tail}`.slice(0, 500)
}

export function listUsageGuideForApi() {
  const types = Object.entries(AI_USAGE_TYPES).map(([id, meta]) => ({
    id,
    ...meta,
    categoryLabel: AI_USAGE_CATEGORIES[meta.category]?.label || meta.category,
    trigger: USAGE_TRIGGER_MAP[id] || {
      where: '未文档化',
      path: '请查 trackAIUsage 调用处',
      billing: meta.scope === 'system' ? '通常系统承担' : '通常用户扣费',
    },
  }))
  return {
    billing: TOKEN_BILLING_DOC,
    types,
    categories: Object.entries(AI_USAGE_CATEGORIES)
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => a.order - b.order),
  }
}
