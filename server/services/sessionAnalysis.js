export function generateStrategy(d, risk, violation, industry) {
  const strategies = []
  const pt = (d.problem_type || '').toLowerCase()
  const vr = (d.violation_reason || '').toLowerCase()
  const ah = (d.appeal_history || '').toLowerCase()

  if (pt.includes('冻结') || pt.includes('延迟')) {
    strategies.push({ type: 'warning', text: '资金冻结案件需提供结算账户信息配合验证，建议拨打95017转3催促审核' })
  }
  if (pt.includes('封禁')) {
    strategies.push({ type: 'warning', text: '商户号封禁是最严重处罚，需准备全套材料，可能需要法人视频认证' })
  }

  if (violation) {
    strategies.push({ type: 'info', text: `违规类型「${violation.key}」预估成功率：${violation.estimated_success_rate}` })
    strategies.push({ type: 'tip', text: `申诉关键：${violation.success_key}` })
  }

  if (industry) {
    strategies.push({ type: 'info', text: `${industry.key}行业申诉要点：${industry.appealTips}` })
  }

  if (ah.includes('驳回') || ah.includes('失败') || ah.includes('拒绝')) {
    strategies.push({ type: 'warning', text: '有被驳回记录，建议先打95017转3查询具体驳回原因，针对性补充材料' })
    strategies.push({ type: 'tip', text: '二次申诉材料须比首次更详细，间隔3-5天再提交' })
  }

  const cs = (d.complaint_status || '').toLowerCase()
  if (cs.includes('有') || cs.includes('投诉') || cs.includes('未处理')) {
    strategies.push({ type: 'warning', text: '有未处理投诉会严重影响申诉成功率，建议先100%处理完投诉再申诉' })
  }

  strategies.push({ type: 'tip', text: '订单号必须是微信支付订单号（4开头28位），不是商户系统订单号' })
  strategies.push({ type: 'tip', text: '补充资料通道一般只开放24小时，请提前准备好材料' })

  return strategies
}

export async function buildSessionAnalysis(session) {
  const d = session.collected_data || {}
  const { matchViolation, matchBuiltInCases, assessRisk, generateMaterialChecklist } = await import('../knowledgeBase.js')
  const { matchIndustry } = await import('../localAI.js')
  const risk = assessRisk(d)
  const violation = matchViolation(d.violation_reason || '')
  const industry = matchIndustry(d.industry || '')
  const matchedCases = matchBuiltInCases(d.problem_type, d.industry, d.violation_reason)
  const checklist = generateMaterialChecklist(d)
  return {
    risk,
    violation: violation ? {
      key: violation.key,
      description: violation.description,
      estimated_success_rate: violation.estimated_success_rate,
      success_key: violation.success_key,
      appeal_key_points: violation.appeal_key_points,
      required_materials: violation.required_materials,
      common_rejection_reasons: violation.common_rejection_reasons,
    } : null,
    industry: industry ? {
      key: industry.key,
      appealTips: industry.appealTips,
      commonViolations: industry.commonViolations,
      businessModel: industry.businessModel,
    } : null,
    matchedCases: matchedCases.slice(0, 5).map(c => ({
      title: c.title,
      industry: c.industry,
      problem_type: c.problem_type,
      success_summary: c.success_summary,
      appeal_points: c.appeal_points,
    })),
    checklist,
    strategy: generateStrategy(d, risk, violation, industry),
  }
}
