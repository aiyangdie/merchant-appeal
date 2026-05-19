/** 各管理 Tab 对应的 AI 模块与示例话术 */
export const ADMIN_AI_MODULE_CONFIG = {
  global: {
    title: '全能 AI',
    examples: [
      '有哪些待确认的充值？',
      '明天上午10点提醒我审核充值',
      '立即备份数据库',
      '生成一个新餐饮申诉成功案例',
    ],
  },
  recharge: {
    title: '充值管理',
    examples: [
      '有哪些待确认的充值订单？',
      '确认充值订单 #3 到账',
      '拒绝订单 #5，备注：凭证不符',
    ],
  },
  orders: {
    title: '订单管理',
    examples: [
      '列出所有待支付订单',
      '把订单 #12 标记为已完成',
      '订单 #8 改为服务中',
    ],
  },
  analytics: {
    title: '数据分析',
    examples: [
      '最近30天经营情况怎么样？',
      '生成 AI 经营洞察报告',
      '哪个用户消费最高？',
    ],
  },
  knowledge: {
    title: '知识库',
    examples: [
      '生成一个新案例：餐饮商户因虚假宣传被处罚，通过补充资质与整改说明成功申诉',
      '有哪些成功案例？',
      '归档案例 #2',
      '删除案例 #99',
    ],
  },
  'ops-center': {
    module: 'ops',
    title: '运营中心',
    examples: [
      '运营中心现在什么情况？',
      '添加快捷回复：您好，已收到您的申诉材料',
      '删除快捷回复 #3',
    ],
  },
  'session-chatboard': {
    title: '会话看板',
    examples: [
      '最近14天会话总览',
      '生成会话看板 AI 简报',
    ],
  },
  tokens: {
    title: 'Token 费用明细',
    examples: [
      '各功能 Token 消耗排行',
      '生成 Token AI 监管分析报告',
      '最近知识库 AI 用了多少 Token',
    ],
  },
  evolution: {
    title: 'AI 进化',
    examples: [
      '批量分析10个未处理对话',
      '执行规则效果评估',
      '自动升降级规则',
    ],
  },
  schedule: {
    title: '日程安排',
    examples: [
      '明天上午10点提醒我审核充值',
      '把日程 #2 标记为完成',
      '删除日程 #5',
    ],
  },
  backup: {
    title: '数据备份',
    examples: [
      '立即执行一次数据库备份',
      '当前有哪些备份文件？',
    ],
  },
  monitor: {
    title: '监控告警',
    examples: [
      '执行一次健康检测',
      '清空所有告警',
    ],
  },
  settings: {
    title: '系统设置',
    examples: [
      '当前系统配置有哪些？',
      '把最低充值金额改成 10',
    ],
  },
}

export function getAiModuleForTab(activeTab) {
  const cfg = ADMIN_AI_MODULE_CONFIG[activeTab]
  if (!cfg) return null
  return {
    module: cfg.module || activeTab,
    ...cfg,
  }
}
