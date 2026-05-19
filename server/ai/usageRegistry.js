/**
 * AI 功能类型注册表 — 新增 AI 功能时在此登记，Token 明细会自动展示中文名与分类。
 * 前端通过 GET /api/admin/token-usage/registry 同步，未知 type 仍会显示原始标识。
 *
 * 新 AI 功能三步：
 * 1. 在 AI_USAGE_TYPES 增加 type（label/icon/category/scope）
 * 2. 调用处使用 trackAIUsage 或 trackAIUsageFromRequest（勿仅 recordTokenUsage）
 * 3. 管理端「功能覆盖」Tab 会自动展示；未登记会在服务端 console.warn
 */
export const AI_USAGE_CATEGORIES = {
  appeal: { label: '申诉主流程', icon: '⚖️', order: 1 },
  admin: { label: '管理端/运营', icon: '🛡️', order: 2 },
  mall: { label: '商城/订单', icon: '🛒', order: 3 },
  system: { label: '系统/进化', icon: '🤖', order: 4 },
  infra: { label: '基础设施', icon: '🔧', order: 5 },
}

/** @type {Record<string, { label, icon, desc, category, scope: 'user'|'system'|'both', color?, badge? }>} */
export const AI_USAGE_TYPES = {
  chat: { label: '用户对话', icon: '💬', desc: '用户与AI的聊天交互', category: 'appeal', scope: 'user', color: '#3b82f6' },
  chat_collection: { label: '信息收集', icon: '📋', desc: '引导用户提供申诉材料', category: 'appeal', scope: 'user', color: '#06b6d4' },
  deep_analysis: { label: '深度分析', icon: '🔍', desc: '综合分析申诉方案', category: 'appeal', scope: 'user', color: '#8b5cf6' },
  appeal_text: { label: '申诉文案', icon: '📝', desc: '生成专业申诉文书', category: 'appeal', scope: 'user', color: '#f59e0b' },
  complaint_doc: { label: '投诉材料整理', icon: '📑', desc: '整理投诉/申诉材料文档', category: 'appeal', scope: 'user', color: '#d97706' },
  report_retry: { label: '报告重试', icon: '🔄', desc: '用户触发重新生成报告', category: 'appeal', scope: 'user', color: '#ef4444' },
  ai_extraction: { label: '字段提取', icon: '🏷️', desc: '从对话中提取关键信息', category: 'appeal', scope: 'user', color: '#14b8a6' },
  field_extraction: { label: '字段提取', icon: '🏷️', desc: '历史别名', category: 'appeal', scope: 'user', color: '#14b8a6' },
  industry_expansion: { label: '行业字段扩展', icon: '🏭', desc: '按行业生成动态收集字段', category: 'appeal', scope: 'user', color: '#0d9488' },
  completeness_check: { label: '完成度评估', icon: '✓', desc: '评估材料收集完成度', category: 'appeal', scope: 'user', color: '#6366f1' },
  copywriting: { label: '智能文案', icon: '✍️', desc: '多类型申诉文案生成', category: 'appeal', scope: 'user', color: '#ec4899' },
  evolution_analysis: { label: '进化分析', icon: '🧬', desc: '系统自动学习优化', category: 'system', scope: 'system', color: '#6366f1' },
  auto_review: { label: 'AI审批', icon: '✅', desc: '自动审核规则变更', category: 'system', scope: 'system', color: '#10b981' },
  xianyu_dashboard_report: { label: '闲鱼运营日报', icon: '🐟', desc: '闲鱼看板 AI 运营分析', category: 'admin', scope: 'system', color: '#f97316' },
  admin_chatboard_brief: { label: '会话看板简报', icon: '📊', desc: '管理端会话统计 AI 简报', category: 'admin', scope: 'system', color: '#64748b' },
  admin_prompt_test: { label: 'Prompt测试', icon: '🧪', desc: '运营中心话术样例测试', category: 'admin', scope: 'system', color: '#64748b' },
  admin_xianyu_parse: { label: '闲管家配置解析', icon: '⚙️', desc: 'AI 解析闲管家配置文本', category: 'admin', scope: 'system', color: '#64748b' },
  admin_ai_assist: { label: 'AI辅助生成', icon: '🛠️', desc: '规则/名片/商品辅助生成', category: 'admin', scope: 'system', color: '#64748b' },
  admin_model_test: { label: '模型连接测试', icon: '🔌', desc: '管理端测试模型连通性', category: 'infra', scope: 'system', color: '#9ca3af' },
  admin_token_analyze: { label: 'Token AI 分析', icon: '🧠', desc: 'AI 监管消耗趋势报告', category: 'admin', scope: 'system', color: '#64748b' },
  admin_analytics_insights: { label: '数据分析 AI', icon: '📈', desc: '管理端数据分析页 AI 洞察报告', category: 'admin', scope: 'system', color: '#64748b' },
  admin_knowledge_ai: { label: '知识库 AI', icon: '📚', desc: '成功案例摘要/标签/生成案例 AI', category: 'admin', scope: 'system', color: '#64748b' },
  admin_ai_command: { label: '管理端 AI 指令', icon: '🎛️', desc: '各模块统一 AI 对话执行操作', category: 'admin', scope: 'system', color: '#64748b' },
  mall_bargain: { label: 'AI砍价', icon: '💰', desc: '商城砍价对话', category: 'mall', scope: 'user', color: '#a855f7' },
  mall_persona: { label: '虚拟人设', icon: '👤', desc: '下单后生成服务人设', category: 'mall', scope: 'user', color: '#a855f7' },
  mall_risk: { label: '风险评估', icon: '⚠️', desc: '违规风险等级评估', category: 'mall', scope: 'user', color: '#a855f7' },
  mall_recommend: { label: '商品推荐', icon: '🛒', desc: 'AI 智能商品推荐', category: 'mall', scope: 'user', color: '#a855f7' },
  mall_interest: { label: '兴趣画像', icon: '🎯', desc: '从对话提取用户兴趣', category: 'mall', scope: 'user', color: '#a855f7' },
  mall_product_optimize: { label: '商品优化', icon: '📦', desc: 'AI 优化商品描述', category: 'mall', scope: 'system', color: '#a855f7' },
  mall_product_suggest: { label: '商品建议', icon: '💡', desc: 'AI 建议新商品', category: 'mall', scope: 'system', color: '#a855f7' },
  order_service_chat: { label: '订单服务对话', icon: '💬', desc: '购买后专属顾问对话', category: 'mall', scope: 'user', color: '#a855f7' },
  health_probe: { label: '健康探测', icon: '🔬', desc: '模型连通性检测（低消耗）', category: 'infra', scope: 'system', color: '#9ca3af' },
  appeal_guide_generate: { label: '申诉指导生成', icon: '🗺️', desc: '行业化申诉流程/话术/95017 AI 快照（含投诉话术增强）', category: 'appeal', scope: 'system', color: '#6366f1' },
  complaint_reply_ai: { label: '投诉话术增强', icon: '💬', desc: '历史别名，已并入 appeal_guide_generate', category: 'appeal', scope: 'system', color: '#ec4899' },
  phone_script_ai: { label: '95017 话术增强', icon: '📞', desc: '历史别名，已并入 appeal_guide_generate', category: 'appeal', scope: 'system', color: '#0ea5e9' },
}

export function getUsageTypeMeta(type) {
  const key = String(type || '').trim()
  if (!key) return defaultMeta('unknown')
  return AI_USAGE_TYPES[key] || defaultMeta(key)
}

function defaultMeta(type) {
  return {
    label: type,
    icon: '📦',
    desc: '未在注册表中登记的新功能，请在 server/ai/usageRegistry.js 补充',
    category: 'appeal',
    scope: 'user',
    color: '#6b7280',
    unregistered: true,
  }
}

export function listRegistryForApi() {
  const types = Object.entries(AI_USAGE_TYPES).map(([id, meta]) => ({
    id,
    ...meta,
    categoryLabel: AI_USAGE_CATEGORIES[meta.category]?.label || meta.category,
  }))
  const categories = Object.entries(AI_USAGE_CATEGORIES)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => a.order - b.order)
  return { types, categories, version: 1 }
}
