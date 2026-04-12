// 内存数据库 - 用于快速开发和演示
// 数据会在服务器重启时重置，但适合测试和演示

let data = {
  sessions: [],
  messages: [],
  users: [],
  admins: [],
  system_config: [],
  token_usage: [],
  recharge_orders: [],
  success_cases: [],
  appeal_texts: [],
  ai_models: [],
  ai_rules: [],
  conversation_analyses: [],
  conversation_tags: [],
  knowledge_clusters: [],
  learning_metrics: [],
  rule_change_log: [],
  engine_health: [],
  exploration_experiments: [],
  mall_products: [],
  field_change_log: [],
  knowledge_snippets: [],
  orders: [],
  products: [],
  contact_cards: [],
  deepseek_accounts: [],
  user_actions: []
}

// 初始化默认数据
function initDefaults() {
  // 初始化管理员
  if (data.admins.length === 0) {
    data.admins.push({
      id: 1,
      username: 'admin',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyWJ2SqK5z7W', // admin123
      created_at: new Date()
    })
  }

  // 初始化 AI 模型
  if (data.ai_models.length === 0) {
    data.ai_models = [
      { id: 1, provider: 'zhipu', display_name: '智谱GLM-4-Flash（免费）', api_key: '', model_name: 'glm-4.7-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', is_active: 1, is_enabled: 1, is_free: 1, sort_order: 1, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, extra: null, created_at: new Date(), updated_at: new Date() },
      { id: 2, provider: 'deepseek', display_name: 'DeepSeek-Chat', api_key: '', model_name: 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions', is_active: 0, is_enabled: 1, is_free: 0, sort_order: 3, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, extra: null, created_at: new Date(), updated_at: new Date() },
      { id: 3, provider: 'custom', display_name: '自定义模型', api_key: '', model_name: 'custom-model', endpoint: 'https://your-api.com/v1/chat/completions', is_active: 0, is_enabled: 0, is_free: 0, sort_order: 99, health_status: 'unknown', last_check_at: null, last_error: null, consecutive_fails: 0, response_ms: null, extra: null, created_at: new Date(), updated_at: new Date() }
    ]
  }

  // 初始化系统配置
  if (data.system_config.length === 0) {
    data.system_config = [
      { config_key: 'site_name', config_value: '微信商户号申诉助手', config_label: '网站名称', config_group: 'general', sort_order: 1, updated_at: new Date() },
      { config_key: 'ai_provider', config_value: 'zhipu', config_label: 'AI服务商（deepseek / zhipu）', config_group: 'ai', sort_order: 9, updated_at: new Date() },
      { config_key: 'ai_temperature', config_value: '0.7', config_label: 'AI 回复温度（0-1）', config_group: 'ai', sort_order: 14, updated_at: new Date() },
      { config_key: 'cost_multiplier', config_value: '2', config_label: 'Token计费倍率（默认2倍）', config_group: 'ai', sort_order: 15, updated_at: new Date() },
      { config_key: 'new_user_balance', config_value: '1.00', config_label: '新用户注册赠送余额（元，0=不赠送）', config_group: 'ai', sort_order: 16, updated_at: new Date() }
    ]
  }
}

initDefaults()

// 模拟 MySQL 连接池的 API
export const memoryDB = {
  // 查询函数
  query: async (sql, params = []) => {
    console.log('[MemoryDB] Query:', sql.substring(0, 100) + '...')
    return []
  },

  // 执行函数
  execute: async (sql, params = []) => {
    console.log('[MemoryDB] Execute:', sql.substring(0, 100) + '...')
    return { insertId: Date.now(), affectedRows: 1 }
  },

  // 获取数据
  getData: (table) => data[table] || [],

  // 设置数据
  setData: (table, value) => {
    data[table] = value
  },

  // 添加记录
  addRecord: (table, record) => {
    if (!data[table]) data[table] = []
    const id = data[table].length > 0 ? Math.max(...data[table].map(r => r.id || 0)) + 1 : 1
    const newRecord = { ...record, id, created_at: new Date() }
    data[table].push(newRecord)
    return newRecord
  },

  // 更新记录
  updateRecord: (table, id, updates) => {
    if (!data[table]) return null
    const index = data[table].findIndex(r => r.id === id)
    if (index === -1) return null
    data[table][index] = { ...data[table][index], ...updates, updated_at: new Date() }
    return data[table][index]
  },

  // 删除记录
  deleteRecord: (table, id) => {
    if (!data[table]) return false
    const index = data[table].findIndex(r => r.id === id)
    if (index === -1) return false
    data[table].splice(index, 1)
    return true
  },

  // 查找记录
  findRecord: (table, predicate) => {
    if (!data[table]) return null
    return data[table].find(predicate)
  },

  // 过滤记录
  filterRecords: (table, predicate) => {
    if (!data[table]) return []
    return data[table].filter(predicate)
  }
}

export default memoryDB
