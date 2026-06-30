export function isChinese(str) {
  if (!str) return false
  return /^[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}]+$/u.test(str.trim())
}

export function isDDScenario(data) {
  if (!data) return false
  const pt = String(data.problem_type || '')
  const vr = String(data.violation_reason || '')
  const st = String(data.scenario_type || '')
  return st === 'due_diligence' || /尽职调查|尽调/.test(pt) || /尽职调查|尽调/.test(vr)
}

export function sanitizeCollected(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const clean = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue
    if (k === 'wechat_orders') continue
    if (v == null) { clean[k] = ''; continue }
    if (typeof v === 'string') { clean[k] = v; continue }
    if (Array.isArray(v)) {
      clean[k] = v.every(item => typeof item === 'string') ? v.join('\n') : JSON.stringify(v)
      continue
    }
    if (typeof v === 'object') {
      clean[k] = JSON.stringify(v)
      continue
    }
    clean[k] = String(v)
  }
  return clean
}

export function formatOrderAmount(order) {
  if (order.pay_amount_fen) return parseFloat(order.pay_amount_fen / 100).toFixed(2)
  if (order.total_amount_fen) return parseFloat(order.total_amount_fen / 100).toFixed(2)
  let amount = order.pay_amount || order.total_amount || 0
  if (amount > 10000) amount = amount / 100
  return parseFloat(amount).toFixed(2)
}

export function smartFormatAmount(amount) {
  if (!amount && amount !== 0) return '0.00'
  amount = parseFloat(amount)
  if (isNaN(amount)) return '0.00'
  if (amount > 10000) return (amount / 100).toFixed(2)
  return amount.toFixed(2)
}

export function getOrderStatusStyle(status, orderStatus) {
  if (orderStatus === 12) return { bg: 'bg-green-100', text: 'text-green-700', label: status || '待发货' }
  if (orderStatus === 23 || status?.includes('退款') || status?.includes('关闭')) {
    return { bg: 'bg-gray-100', text: 'text-gray-500', label: status || '已关闭' }
  }
  return { bg: 'bg-gray-100', text: 'text-gray-500', label: status || '未知' }
}

export function fmtTime(d) {
  if (!d) return ''
  try {
    const t = new Date(d)
    return isNaN(t.getTime()) ? String(d).slice(0, 16) : t.toLocaleString('zh-CN')
  } catch {
    return String(d)
  }
}
