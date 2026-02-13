/**
 * 全面功能测试脚本
 * 测试所有核心API端点
 */
const BASE = 'http://localhost:3001'

async function req(method, path, body = null, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

let passed = 0, failed = 0, total = 0
function test(name, ok, detail = '') {
  total++
  if (ok) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${detail}`) }
}

async function run() {
  console.log('\n========== 1. 用户注册+聊天系统 ==========')
  const phone = 'test' + Date.now().toString().slice(-6)
  const reg = await req('POST', '/api/user/register', { phone, nickname: '测试商户' })
  test('用户注册', reg.status === 200 && reg.data.token, `status=${reg.status}`)
  const userToken = reg.data.token || ''

  const userId = reg.data.user?.id
  let sid = null
  if (userId) {
    const chat = await req('POST', '/api/chat', { content: '你好，我是做餐饮的商户，想申诉', userId })
    test('发送聊天(创建会话)', chat.status === 200 && chat.data.sessionId, `status=${chat.status}, err=${chat.data.error || ''}`)
    sid = chat.data.sessionId
  }

  if (sid) {
    const getInfo = await req('GET', `/api/sessions/${sid}/info`)
    test('获取会话信息', getInfo.status === 200)

    const updateField = await req('PUT', `/api/sessions/${sid}/field`, { key: 'industry', value: '餐饮' })
    test('更新字段', updateField.status === 200 && updateField.data.success)

    const updateField2 = await req('PUT', `/api/sessions/${sid}/field`, { key: 'industry', value: '电商零售' })
    test('再次更新字段(测试变更追踪)', updateField2.status === 200)

    const fieldHistory = await req('GET', `/api/sessions/${sid}/field-history?field=industry`)
    test('字段变更历史', fieldHistory.status === 200 && Array.isArray(fieldHistory.data.logs))
    test('变更记录数≥2', (fieldHistory.data.logs?.length || 0) >= 2, `logs=${fieldHistory.data.logs?.length}`)

    const analysis = await req('GET', `/api/sessions/${sid}/analysis`)
    test('获取分析摘要', analysis.status === 200)

    const messages = await req('GET', `/api/sessions/${sid}/messages`)
    test('获取消息历史', messages.status === 200 && messages.data.messages?.length > 0)
  }

  console.log('\n========== 2. 管理员登录 ==========')
  const login = await req('POST', '/api/admin/login', { username: 'admin', password: 'admin123' })
  test('管理员登录', login.status === 200 && login.data.token, `status=${login.status}`)
  const token = login.data.token || ''

  async function adminReq(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(BASE + path, opts)
    return { status: res.status, data: await res.json().catch(() => ({})) }
  }

  if (token) {
    console.log('\n========== 4. AI进化系统 ==========')
    const ruleStats = await adminReq('GET', '/api/admin/evolution/rules/stats')
    test('规则统计', ruleStats.status === 200)

    const rules = await adminReq('GET', '/api/admin/evolution/rules')
    test('获取规则列表', rules.status === 200 && Array.isArray(rules.data.rules))

    const analysisStats = await adminReq('GET', '/api/admin/evolution/analyses/stats')
    test('分析统计', analysisStats.status === 200)

    const analyses = await adminReq('GET', '/api/admin/evolution/analyses')
    test('分析列表', analyses.status === 200)

    const quality = await adminReq('GET', '/api/admin/evolution/quality-dashboard')
    test('质量仪表板', quality.status === 200)

    const metrics = await adminReq('GET', '/api/admin/evolution/metrics')
    test('学习指标', metrics.status === 200)

    const changelog = await adminReq('GET', '/api/admin/evolution/changelog')
    test('变更日志', changelog.status === 200)

    const tagStats = await adminReq('GET', '/api/admin/evolution/tags/stats')
    test('标签统计', tagStats.status === 200)

    const clusters = await adminReq('GET', '/api/admin/evolution/clusters')
    test('知识聚合', clusters.status === 200)

    const clusterStats = await adminReq('GET', '/api/admin/evolution/clusters/stats')
    test('聚合统计', clusterStats.status === 200)

    const experiments = await adminReq('GET', '/api/admin/evolution/experiments')
    test('探索实验', experiments.status === 200)

    const engineHealth = await adminReq('GET', '/api/admin/evolution/health')
    test('引擎健康', engineHealth.status === 200)

    const unanalyzed = await adminReq('GET', '/api/admin/evolution/unanalyzed')
    test('未分析对话', unanalyzed.status === 200)

    console.log('\n========== 5. AI进化操作 ==========')
    const evaluate = await adminReq('POST', '/api/admin/evolution/evaluate')
    test('规则效果评估', evaluate.status === 200)

    const promote = await adminReq('POST', '/api/admin/evolution/auto-promote')
    test('自动升降级', promote.status === 200)

    const aggregate = await adminReq('POST', '/api/admin/evolution/aggregate')
    test('每日聚合', aggregate.status === 200)

    const clusterRefresh = await adminReq('POST', '/api/admin/evolution/clusters/refresh')
    test('知识聚合刷新', clusterRefresh.status === 200)

    const batchReview = await adminReq('POST', '/api/admin/evolution/rules/batch-auto-review')
    test('AI批量审批', batchReview.status === 200)

    console.log('\n========== 6. AI商城 ==========')
    const products = await adminReq('GET', '/api/admin/mall/products')
    test('商品列表', products.status === 200)

    const productStats = await adminReq('GET', '/api/admin/mall/products/stats')
    test('商品统计', productStats.status === 200)

    const recStats = await adminReq('GET', '/api/admin/mall/recommendations/stats')
    test('推荐统计', recStats.status === 200)

    console.log('\n========== 7. 用户系统 ==========')
    const users = await adminReq('GET', '/api/admin/users')
    test('用户列表', users.status === 200)

    const sessions = await adminReq('GET', '/api/admin/sessions')
    test('会话列表', sessions.status === 200)

    const systemConfig = await adminReq('GET', '/api/admin/system-config')
    test('系统配置', systemConfig.status === 200 || systemConfig.status === 404)

    console.log('\n========== 8. 充值系统 ==========')
    const rechargeOrders = await adminReq('GET', '/api/admin/recharge-orders')
    test('充值订单', rechargeOrders.status === 200)

    console.log('\n========== 9. 成功案例 ==========')
    const cases = await adminReq('GET', '/api/admin/cases')
    test('案例列表', cases.status === 200)

    console.log('\n========== 10. Token统计 ==========')
    const tokenStats = await adminReq('GET', '/api/admin/token-usage')
    test('Token统计', tokenStats.status === 200)

  } else {
    console.log('  ⚠️  管理员登录失败，跳过管理员API测试')
  }

  console.log('\n' + '='.repeat(50))
  console.log(`测试结果: ${passed}/${total} 通过, ${failed} 失败`)
  console.log('='.repeat(50) + '\n')
}

run().catch(err => console.error('测试脚本错误:', err))
