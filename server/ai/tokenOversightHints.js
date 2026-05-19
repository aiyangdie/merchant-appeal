/**
 * Token 监管 → 收集字段缺口统计，驱动运营优化 chat_collection
 */
import { getPool } from '../db.js'

const PLACEHOLDER = new Set(['用户暂未提供', '⏳待补充', '用户未提供'])

function isEmptyVal(v) {
  if (v == null) return true
  const s = String(v).trim()
  return !s || PLACEHOLDER.has(s)
}

function parseCollected(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

/**
 * 抽样近期会话，统计核心字段缺失率
 * @param {{ sampleLimit?: number, days?: number }} opts
 */
export async function getCollectionFieldGapStats(opts = {}) {
  const sampleLimit = Math.min(500, Math.max(20, opts.sampleLimit || 120))
  const days = Math.min(30, Math.max(1, opts.days || 14))
  const pool = getPool()

  let rows = []
  try {
    const [r] = await pool.execute(
      `SELECT collected_data FROM sessions
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND collected_data IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`,
      [days, sampleLimit]
    )
    rows = r || []
  } catch {
    return { sampleSize: 0, gaps: [], days }
  }

  const counts = {
    total: 0,
    missing_industry: 0,
    missing_problem_type: 0,
    missing_violation_reason: 0,
    missing_merchant_identity: 0,
    missing_complaint_status: 0,
    has_industry_tip: 0,
    has_dynamic_fields: 0,
    collection_complete: 0,
  }

  for (const row of rows) {
    const d = parseCollected(row.collected_data)
    counts.total += 1
    if (isEmptyVal(d.industry)) counts.missing_industry += 1
    if (isEmptyVal(d.problem_type)) counts.missing_problem_type += 1
    if (isEmptyVal(d.violation_reason)) counts.missing_violation_reason += 1
    if (isEmptyVal(d.merchant_id) && isEmptyVal(d.company_name) && isEmptyVal(d.legal_name)) {
      counts.missing_merchant_identity += 1
    }
    const vr = String(d.violation_reason || '')
    if (/纠纷|投诉/.test(vr) && isEmptyVal(d.complaint_status)) counts.missing_complaint_status += 1
    if (d._industry_tip) counts.has_industry_tip += 1
    if (d._dynamic_fields?.length) counts.has_dynamic_fields += 1
    if (d._collection_complete) counts.collection_complete += 1
  }

  const pct = (n) => (counts.total ? Math.round((n / counts.total) * 100) : 0)
  const gaps = []

  if (pct(counts.missing_industry) >= 25) {
    gaps.push({
      field: 'industry',
      label: '业务类型/行业',
      missingRate: pct(counts.missing_industry),
      suggestion: '在 chat_collection 前 3 轮强化行业选择题追问；行业识别后再展开动态字段',
    })
  }
  if (pct(counts.missing_violation_reason) >= 20) {
    gaps.push({
      field: 'violation_reason',
      label: '违规原因原文',
      missingRate: pct(counts.missing_violation_reason),
      suggestion: '引导用户粘贴商户平台违约记录原文，勿概括',
    })
  }
  if (pct(counts.missing_merchant_identity) >= 30) {
    gaps.push({
      field: 'merchant_identity',
      label: '商户号/法人/公司名',
      missingRate: pct(counts.missing_merchant_identity),
      suggestion: '在信息较完整时主动索要商户号，便于 95017 话术与申诉表单',
    })
  }
  if (counts.total > 10 && pct(counts.has_industry_tip) < 15 && pct(counts.missing_industry) < 40) {
    gaps.push({
      field: 'industry_expansion',
      label: '行业扩展提示',
      missingRate: 100 - pct(counts.has_industry_tip),
      suggestion: '检查 industry_expansion 是否在行业识别后稳定触发；失败时回退本地 INDUSTRY_KNOWLEDGE',
    })
  }

  return { sampleSize: counts.total, days, counts, gaps }
}

export function formatGapStatsForPrompt(gapStats) {
  if (!gapStats?.sampleSize) return '（暂无近期会话样本）'
  const { counts, gaps, sampleSize, days } = gapStats
  const lines = [
    `近 ${days} 天抽样 ${sampleSize} 个会话：`,
    `- 缺行业 ${counts.missing_industry}（${Math.round((counts.missing_industry / sampleSize) * 100)}%）`,
    `- 缺处罚类型 ${counts.missing_problem_type}`,
    `- 缺违规原因 ${counts.missing_violation_reason}`,
    `- 缺商户身份标识 ${counts.missing_merchant_identity}`,
    `- 已触发行业扩展提示 ${counts.has_industry_tip}`,
    `- 收集完成标记 ${counts.collection_complete}`,
  ]
  if (gaps?.length) {
    lines.push('优先优化建议：')
    for (const g of gaps) lines.push(`- ${g.label}（缺失约 ${g.missingRate}%）：${g.suggestion}`)
  }
  return lines.join('\n')
}

export function gapStatsToOpsSuggestions(gapStats) {
  return (gapStats?.gaps || []).map(g => ({
    type: 'collection_gap',
    priority: g.missingRate >= 40 ? 'high' : 'medium',
    title: `收集缺口：${g.label}`,
    detail: `近 ${gapStats.days} 天抽样 ${gapStats.sampleSize} 会话，约 ${g.missingRate}% 缺失`,
    action: g.suggestion,
  }))
}
