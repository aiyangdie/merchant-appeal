/** 收集完成加权重校验（与 AI 完成度评估配合） */

const PLACEHOLDER = new Set(['用户暂未提供', '⏳待补充', '用户未提供'])

function isEmpty(data, key) {
  const v = data[key]
  if (v == null) return true
  const s = String(v).trim()
  return !s || PLACEHOLDER.has(s)
}

/**
 * @param {object} collectedData
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkWeightedCollectionReady(collectedData = {}) {
  const missing = []
  const d = collectedData

  if (isEmpty(d, 'industry')) missing.push('业务类型')
  if (isEmpty(d, 'problem_type')) missing.push('处罚类型')
  if (isEmpty(d, 'violation_reason')) missing.push('违规原因')

  const pt = String(d.problem_type || '')
  const vrFreeze = String(d.violation_reason || '')
  const needsSettlementInfo = /冻结|封禁|延迟结算|延迟/.test(pt) || /冻结|封禁|延迟结算|延迟/.test(vrFreeze)
  if (needsSettlementInfo) {
    if (isEmpty(d, 'bank_name')) missing.push('开户银行')
    if (isEmpty(d, 'bank_account_last4')) missing.push('结算账户后四位')
    if (isEmpty(d, 'contact_phone')) missing.push('联系电话')
  }

  const vr = String(d.violation_reason || '')
  if (/纠纷|投诉/.test(vr) && isEmpty(d, 'complaint_status')) {
    missing.push('投诉情况')
  }

  if (isEmpty(d, 'merchant_id') && isEmpty(d, 'company_name') && isEmpty(d, 'legal_name')) {
    missing.push('商户号/公司全称/法人姓名（至少一项）')
  }

  return { ok: missing.length === 0, missing }
}
