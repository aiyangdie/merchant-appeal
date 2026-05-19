/**
 * 申诉结果反馈 → 行业知识簇（脱敏摘要）
 */
import { getKnowledgeClusters, upsertKnowledgeCluster } from '../db.js'
import { matchIndustry } from '../localAI.js'

function sanitizeSummary(collectedData = {}) {
  const d = collectedData
  return {
    industry: d.industry || '未知',
    problem_type: d.problem_type || '未知',
    violation_reason: String(d.violation_reason || '').slice(0, 80),
    complaint_status: d.complaint_status ? '已填写' : '未填',
    has_merchant_id: !!d.merchant_id,
    timestamp: new Date().toISOString(),
  }
}

/**
 * @param {'approved'|'rejected'} result
 * @param {object} collectedData
 * @param {{ rejectionReason?: string, feedback?: string }} meta
 */
export async function recordAppealOutcomeToCluster(result, collectedData, meta = {}) {
  const profile = matchIndustry(collectedData?.industry || '')
  const industryKey = profile?.key || collectedData?.industry || 'unknown'
  const violationKey = collectedData?.problem_type || 'unknown'
  const clusterKey = `appeal_outcome:${industryKey}`

  let existing = null
  try {
    const clusters = await getKnowledgeClusters('industry_pattern', 0)
    existing = clusters.find(c => c.cluster_key === clusterKey)
  } catch { /* ignore */ }

  const prev = existing?.insight_data || {}
  const approved = (prev.approvedCount || 0) + (result === 'approved' ? 1 : 0)
  const rejected = (prev.rejectedCount || 0) + (result === 'rejected' ? 1 : 0)
  const total = approved + rejected
  const positiveRate = total > 0 ? Math.round((approved / total) * 100) : 0

  const recentOutcomes = [...(prev.recentOutcomes || []), {
    result,
    violation: violationKey,
    summary: sanitizeSummary(collectedData),
    rejectionReason: meta.rejectionReason ? String(meta.rejectionReason).slice(0, 120) : undefined,
  }].slice(-8)

  const insights = {
    ...prev,
    approvedCount: approved,
    rejectedCount: rejected,
    positiveRate,
    lastResult: result,
    lastViolation: violationKey,
    recentOutcomes,
    topSuggestions: [
      result === 'approved'
        ? `${industryKey}行业申诉通过案例增加，材料齐全与投诉处理完毕是关键`
        : `${industryKey}行业驳回需重点回应：${meta.rejectionReason || '补充针对性材料'}`,
      ...(prev.topSuggestions || []).slice(0, 1),
    ].filter(Boolean).slice(0, 3),
    summary: `${industryKey}：累计通过 ${approved} / 驳回 ${rejected}（通过率约 ${positiveRate}%）`,
  }

  await upsertKnowledgeCluster('industry_pattern', clusterKey, {
    name: `${industryKey}申诉结果`,
    insights,
    sampleCount: total,
    confidence: Math.min(92, 45 + total * 6),
  })
}
