/**
 * 统一会话申诉上下文 — 行业/违规/材料/完整度，供申诉指导、投诉话术、深度分析共用
 */
import { matchIndustry, INFO_FIELDS } from '../localAI.js'
import { matchViolation, generateMaterialChecklist, assessRisk } from '../knowledgeBase.js'
import { checkWeightedCollectionReady } from '../prompts/collectionWeights.js'

const STANDARD_FIELD_KEYS = new Set(INFO_FIELDS.map(f => f.key))

const PLACEHOLDER = new Set(['用户暂未提供', '⏳待补充', '用户未提供'])

function isFilled(data, key) {
  const v = data?.[key]
  if (v == null) return false
  const s = String(v).trim()
  return !!s && !PLACEHOLDER.has(s)
}

/** 用于快照缓存失效 */
export function computeContextFingerprint(collectedData = {}) {
  const d = collectedData
  const keys = [
    'industry', 'problem_type', 'violation_reason', 'business_model', 'business_scenario',
    'merchant_id', 'merchant_name', 'company_name', 'legal_name', 'complaint_status',
    'refund_policy', 'appeal_history', 'bank_name', 'bank_account_last4', 'contact_phone',
  ]
  const parts = keys.map(k => `${k}:${String(d[k] || '').trim()}`)
  const extra = Object.keys(d)
    .filter(k => !k.startsWith('_') && !keys.includes(k))
    .sort()
    .slice(0, 12)
    .map(k => `${k}:${String(d[k] || '').trim().slice(0, 40)}`)
  return [...parts, ...extra].join('|')
}

function computeReadiness(collectedData, weighted) {
  const d = collectedData
  const hasCore =
    isFilled(d, 'industry') && isFilled(d, 'problem_type') && isFilled(d, 'violation_reason')
  if (!hasCore) return 'minimal'
  if (!weighted.ok) return 'minimal'
  const identityOk =
    isFilled(d, 'merchant_id') || isFilled(d, 'company_name') || isFilled(d, 'legal_name')
  const scenarioOk =
    isFilled(d, 'business_model') || isFilled(d, 'business_scenario') || isFilled(d, 'refund_policy')
  if (identityOk && scenarioOk) return 'report_ready'
  return 'actionable'
}

function materialsFromDynamicFields(collectedData = {}) {
  const fields = collectedData._dynamic_fields
  if (!Array.isArray(fields) || fields.length === 0) return []
  return fields
    .filter(f => f?.key && f?.label)
    .map(f => {
      const filled = isFilled(collectedData, f.key)
      return {
        name: f.label,
        required: false,
        note: filled ? `已收集：${String(collectedData[f.key]).slice(0, 40)}` : (f.hint || f.question || '行业扩展字段'),
        source: 'dynamic_field',
        filled,
      }
    })
}

function buildIndustryMaterials(industryProfile, collectedData) {
  const items = [...materialsFromDynamicFields(collectedData)]
  const key = industryProfile?.key || ''
  const indText = (collectedData.industry || key || '').toLowerCase()

  const industryRules = [
    { test: /食品|餐饮|外卖|饭店/, name: '食品经营许可证', required: true, note: '餐饮行业必备' },
    { test: /教育|培训|课程/, name: '办学许可证/教育资质备案', required: true, note: '教育培训行业' },
    { test: /医疗|药品|诊所|保健/, name: '医疗机构执业许可/药品经营许可', required: true, note: '医疗健康行业' },
    { test: /游戏|棋牌/, name: '游戏版号/文网文许可', required: true, note: '游戏行业' },
    { test: /电商|网店|直播/, name: '进货合同/供应商资质', required: true, note: '电商行业' },
    { test: /美容|美发|医美/, name: '卫生许可/从业人员资质', required: true, note: '美容美发行业' },
    { test: /财税|记账|报税|工商/, name: '代理记账许可/服务合同模板', required: true, note: '财税服务行业' },
    { test: /科技|软件|saas|app/, name: '软件著作权/服务合同', required: true, note: '科技服务行业' },
  ]

  for (const rule of industryRules) {
    if (rule.test.test(indText) || rule.test.test(key)) {
      items.push({ name: rule.name, required: rule.required, note: rule.note, source: 'industry' })
    }
  }

  if (industryProfile?.appealTips) {
    items.push({
      name: '行业申诉要点（摘要）',
      required: false,
      note: industryProfile.appealTips.slice(0, 120) + (industryProfile.appealTips.length > 120 ? '…' : ''),
      source: 'tips',
    })
  }

  return items
}

/** 行业扩展字段 → 材料清单项（与指导面板勾选联动） */
function buildExpansionMaterials(collectedData) {
  const items = []
  for (const [key, val] of Object.entries(collectedData || {})) {
    if (key.startsWith('_') || STANDARD_FIELD_KEYS.has(key)) continue
    if (!isFilled(collectedData, key)) continue
    const label = key.replace(/_/g, ' ')
    items.push({
      name: `行业补充：${label}`,
      required: false,
      note: String(val).slice(0, 80),
      source: 'expansion',
      fieldKey: key,
    })
  }
  return items
}

/** 已收集信息可自动勾选的标准材料名 */
function inferAutoCheckedMaterials(collectedData, materials = []) {
  const checked = []
  const blob = JSON.stringify(collectedData).toLowerCase()
  for (const m of materials) {
    const name = m.name || ''
    if (m.source === 'expansion' && m.fieldKey && isFilled(collectedData, m.fieldKey)) {
      checked.push(name)
      continue
    }
    if (/食品|餐饮/.test(name) && /食品|餐饮|外卖/.test(blob)) checked.push(name)
    if (/教育|办学/.test(name) && /教育|培训|课程/.test(blob)) checked.push(name)
    if (/游戏|版号/.test(name) && /游戏|棋牌/.test(blob)) checked.push(name)
    if (/医疗|药品/.test(name) && /医疗|药品|诊所/.test(blob)) checked.push(name)
    if (/身份证/.test(name) && (collectedData.legal_name || collectedData.legal_id_last4)) checked.push(name)
    if (/营业执照/.test(name) && (collectedData.company_name || collectedData.business_license)) checked.push(name)
    if (/投诉.*完成|处理完成/.test(name) && /处理完|已解决|已退款/.test(collectedData.complaint_status || '')) {
      checked.push(name)
    }
  }
  return [...new Set(checked)]
}

/**
 * @param {object} collectedData - sessions.collected_data
 * @param {object} [opts]
 * @param {object} [opts.industryClusterInsight] - 来自 knowledge_clusters 的进化洞察
 */
export function buildSessionAppealContext(collectedData = {}, opts = {}) {
  const d = typeof collectedData === 'string'
    ? (() => { try { return JSON.parse(collectedData) } catch { return {} } })()
    : (collectedData || {})

  const industryProfile = matchIndustry(d.industry || '')
  const violationProfile = matchViolation(d.violation_reason || '')
  const checklist = generateMaterialChecklist(d)
  const expansionMaterials = buildExpansionMaterials(d)
  const weighted = checkWeightedCollectionReady(d)
  const risk = assessRisk(d)
  const readiness = computeReadiness(d, weighted)

  const industryContext = industryProfile
    ? {
        key: industryProfile.key,
        rawIndustry: d.industry || '',
        appealTips: industryProfile.appealTips,
        commonViolations: industryProfile.commonViolations,
        businessModel: industryProfile.businessModel,
        materials: [...buildIndustryMaterials(industryProfile, d), ...expansionMaterials],
        evolutionHint: opts.industryClusterInsight || null,
      }
    : {
        key: null,
        rawIndustry: d.industry || '',
        appealTips: null,
        commonViolations: [],
        businessModel: null,
        materials: expansionMaterials,
        evolutionHint: null,
      }

  const violationContext = violationProfile
    ? {
        key: violationProfile.key,
        description: violationProfile.description,
        estimated_success_rate: violationProfile.estimated_success_rate,
        success_key: violationProfile.success_key,
        appeal_key_points: violationProfile.appeal_key_points || [],
        required_materials: violationProfile.required_materials || [],
        common_rejection_reasons: violationProfile.common_rejection_reasons || [],
      }
    : null

  const completeness = {
    readiness,
    weightedReady: weighted.ok,
    missingCritical: weighted.missing,
    filledCount: Object.keys(d).filter(k => !k.startsWith('_') && isFilled(d, k)).length,
    fingerprint: computeContextFingerprint(d),
  }

  const mergedMaterials = checklistToGuideMaterials(checklist, industryContext.materials)
  const suggestedChecks = suggestMaterialChecks(d, mergedMaterials)
  const fromSuggest = Object.keys(suggestedChecks).filter(k => suggestedChecks[k])
  const autoCheckedMaterials = [...new Set([...inferAutoCheckedMaterials(d, mergedMaterials), ...fromSuggest])]

  return {
    collected: d,
    industry: industryContext,
    violation: violationContext,
    checklist,
    autoCheckedMaterials,
    risk: {
      level: risk.level,
      successRate: risk.successRate,
      riskScore: risk.riskScore,
      factors: risk.factors,
      tips: risk.tips,
    },
    completeness,
    phoneTalkingPoints: buildPhoneTalkingPoints(d, industryContext, violationContext),
    complaintHints: buildComplaintHints(d, industryContext),
  }
}

function buildPhoneTalkingPoints(d, industry, violation) {
  const points = []
  if (industry?.appealTips) {
    points.push(`强调${industry.key || industry.rawIndustry}行业合规经营：${industry.appealTips.slice(0, 80)}…`)
  }
  if (violation?.success_key) points.push(`针对「${violation.key}」：${violation.success_key}`)
  if (violation?.appeal_key_points?.length) {
    points.push(`可提及已准备：${violation.appeal_key_points.slice(0, 2).join('；')}`)
  }
  if (/处理完|已解决|已退款/.test(d.complaint_status || '')) {
    points.push('说明所有消费者投诉已妥善处理完毕')
  }
  return points
}

function buildComplaintHints(d, industry) {
  const hints = []
  if (industry?.businessModel) {
    hints.push(`结单时可简述经营模式：${industry.businessModel.slice(0, 100)}…`)
  }
  if (industry?.appealTips) {
    hints.push(`行业注意：${industry.appealTips.slice(0, 90)}…`)
  }
  if (d.refund_policy) {
    hints.push(`可引用已告知用户的退款政策：${String(d.refund_policy).slice(0, 60)}…`)
  }
  return hints
}

export function checklistToGuideMaterials(checklist = [], industryMaterials = []) {
  const fromChecklist = checklist.map(c => ({
    name: c.item,
    required: !!c.required,
    note: c.category || '',
    source: 'checklist',
  }))
  const seen = new Set()
  const merged = []
  for (const m of [...industryMaterials, ...fromChecklist]) {
    const k = m.name
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(m)
  }
  return merged
}

/** 根据已收集字段与行业扩展字段，建议预勾选的材料项 */
export function suggestMaterialChecks(collectedData = {}, materials = []) {
  const d = collectedData
  const checks = {}
  const filledText = Object.entries(d)
    .filter(([k, v]) => !k.startsWith('_') && isFilled(d, k))
    .map(([, v]) => String(v).toLowerCase())
    .join(' ')

  const dynamicFields = Array.isArray(d._dynamic_fields) ? d._dynamic_fields : []
  for (const df of dynamicFields) {
    if (!isFilled(d, df.key)) continue
    const label = String(df.label || df.key || '')
    for (const m of materials) {
      const name = m.name || ''
      if (label && (name.includes(label) || label.includes(name.slice(0, 4)))) {
        checks[name] = true
      }
    }
  }

  const keywordRules = [
    { keys: ['food_license', 'catering_license'], material: /食品经营|餐饮许可/ },
    { keys: ['education_license', 'school_license'], material: /办学|教育资质/ },
    { keys: ['game_license', 'version_number'], material: /游戏版号|文网文/ },
    { keys: ['medical_license'], material: /医疗|执业许可|药品/ },
    { keys: ['miniprogram_appid', 'miniprogram_name'], material: /小程序|公众号/ },
    { keys: ['store_photo', 'door_photo'], material: /门头|内景/ },
    { keys: ['order_info', 'transaction'], material: /交易订单/ },
    { keys: ['complaint_status'], material: /投诉处理/ },
    { keys: ['refund_policy', 'refund'], material: /退款/ },
  ]

  for (const rule of keywordRules) {
    const hasKey = rule.keys.some(k => isFilled(d, k))
    if (!hasKey) continue
    for (const m of materials) {
      if (rule.material.test(m.name || '')) checks[m.name] = true
    }
  }

  if (d._industry_tip && filledText) {
    for (const m of materials) {
      if (m.source === 'tips' || m.source === 'industry') {
        const frag = String(m.note || m.name).slice(0, 6)
        if (frag && filledText.includes(frag.toLowerCase())) checks[m.name] = true
      }
    }
  }

  return checks
}
