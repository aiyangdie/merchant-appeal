/**
 * Token 消费类型元数据（Token 明细 / 仪表盘 / 模型面板共用）
 */
export const TOKEN_USAGE_TYPE_META = {
  chat: { label: '用户对话', icon: '💬', desc: '用户与AI的聊天交互', color: '#3b82f6', badge: 'bg-blue-50 text-blue-700' },
  chat_collection: { label: '信息收集', icon: '📋', desc: '引导用户提供申诉材料', color: '#06b6d4', badge: 'bg-cyan-50 text-cyan-700' },
  deep_analysis: { label: '深度分析', icon: '🔍', desc: '综合分析申诉方案', color: '#8b5cf6', badge: 'bg-purple-50 text-purple-700' },
  appeal_text: { label: '申诉文案', icon: '📝', desc: '生成专业申诉文书', color: '#f59e0b', badge: 'bg-orange-50 text-orange-700' },
  complaint_doc: { label: '投诉材料整理', icon: '📑', desc: '整理投诉/申诉材料文档', color: '#d97706', badge: 'bg-amber-50 text-amber-800' },
  report_retry: { label: '报告重试', icon: '🔄', desc: '用户触发重新生成报告', color: '#ef4444', badge: 'bg-yellow-50 text-yellow-700' },
  ai_extraction: { label: '字段提取', icon: '🏷️', desc: '从对话中提取关键信息', color: '#14b8a6', badge: 'bg-teal-50 text-teal-700' },
  field_extraction: { label: '字段提取', icon: '🏷️', desc: '从对话中提取关键信息（历史别名）', color: '#14b8a6', badge: 'bg-teal-50 text-teal-700' },
  industry_expansion: { label: '行业字段扩展', icon: '🏭', desc: '按行业生成动态收集字段', color: '#0d9488', badge: 'bg-emerald-50 text-emerald-700' },
  completeness_check: { label: '完成度评估', icon: '✓', desc: '评估材料收集完成度', color: '#6366f1', badge: 'bg-violet-50 text-violet-700' },
  copywriting: { label: '智能文案', icon: '✍️', desc: '多类型申诉文案生成', color: '#ec4899', badge: 'bg-pink-50 text-pink-700' },
  evolution_analysis: { label: '进化分析', icon: '🧬', desc: '系统自动学习优化', color: '#6366f1', badge: 'bg-indigo-50 text-indigo-700' },
  auto_review: { label: 'AI审批', icon: '✅', desc: '自动审核规则变更', color: '#10b981', badge: 'bg-emerald-50 text-emerald-700' },
  xianyu_dashboard_report: { label: '闲鱼运营日报', icon: '🐟', desc: '闲鱼看板 AI 运营分析', color: '#f97316', badge: 'bg-orange-50 text-orange-700' },
  admin_chatboard_brief: { label: '会话看板简报', icon: '📊', desc: '管理端会话统计 AI 简报', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_prompt_test: { label: 'Prompt测试', icon: '🧪', desc: '运营中心话术样例测试', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_xianyu_parse: { label: '闲管家配置解析', icon: '⚙️', desc: 'AI 解析闲管家配置文本', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_ai_assist: { label: 'AI辅助生成', icon: '🛠️', desc: '规则/名片/商品辅助生成', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  mall_bargain: { label: 'AI砍价', icon: '💰', desc: '商城砍价对话', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_persona: { label: '虚拟人设', icon: '👤', desc: '下单后生成服务人设', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_risk: { label: '风险评估', icon: '⚠️', desc: '违规风险等级评估', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_recommend: { label: '商品推荐', icon: '🛒', desc: 'AI 智能商品推荐', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_interest: { label: '兴趣画像', icon: '🎯', desc: '从对话提取用户兴趣', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_product_optimize: { label: '商品优化', icon: '📦', desc: 'AI 优化商品描述', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  mall_product_suggest: { label: '商品建议', icon: '💡', desc: 'AI 建议新商品', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  order_service_chat: { label: '订单服务对话', icon: '💬', desc: '购买后专属顾问对话', color: '#a855f7', badge: 'bg-purple-50 text-purple-700' },
  health_probe: { label: '健康探测', icon: '🔬', desc: '模型连通性检测（低消耗）', color: '#9ca3af', badge: 'bg-gray-50 text-gray-600' },
  admin_model_test: { label: '模型连接测试', icon: '🔌', desc: '管理端测试模型连通性', color: '#9ca3af', badge: 'bg-gray-50 text-gray-600' },
  admin_token_analyze: { label: 'Token AI 分析', icon: '🧠', desc: 'AI 监管消耗趋势报告', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_analytics_insights: { label: '数据分析 AI', icon: '📈', desc: '管理端数据分析页 AI 洞察', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_knowledge_ai: { label: '知识库 AI', icon: '📚', desc: '成功案例 AI 摘要/标签/生成案例', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  admin_ai_command: { label: '管理端 AI 指令', icon: '🎛️', desc: '各模块统一 AI 对话执行写操作', color: '#64748b', badge: 'bg-slate-50 text-slate-700' },
  appeal_guide_generate: { label: '申诉指导生成', icon: '🗺️', desc: '行业化申诉流程/话术 AI 快照', color: '#6366f1', badge: 'bg-indigo-50 text-indigo-700' },
  complaint_reply_ai: { label: '投诉话术增强', icon: '💬', desc: '行业化投诉回复话术 AI 补充', color: '#ec4899', badge: 'bg-pink-50 text-pink-700' },
}

/** 合并服务端注册表（API 返回）与本地兜底 */
export function mergeRegistryTypes(apiTypes = []) {
  const merged = { ...TOKEN_USAGE_TYPE_META }
  for (const t of apiTypes) {
    merged[t.id] = {
      label: t.label,
      icon: t.icon,
      desc: t.desc,
      color: t.color || merged[t.id]?.color || '#6b7280',
      badge: merged[t.id]?.badge || 'bg-gray-50 text-gray-600',
      category: t.category,
    }
  }
  return merged
}

export function getTokenTypeMeta(type) {
  if (!type) return { label: type, icon: '📦', desc: '', color: '#6b7280', badge: 'bg-gray-50 text-gray-600' }
  return TOKEN_USAGE_TYPE_META[type] || { label: type, icon: '📦', desc: '', color: '#6b7280', badge: 'bg-gray-50 text-gray-600' }
}

export function getTokenTypeLabel(type) {
  const m = getTokenTypeMeta(type)
  return `${m.icon} ${m.label}`
}
