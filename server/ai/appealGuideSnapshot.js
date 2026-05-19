/**
 * 行业化申诉指导 AI 快照 — 在 readiness >= actionable 时生成并缓存
 */
import { getAIConfig } from '../ai.js'
import { buildSessionAppealContext, computeContextFingerprint } from './sessionAppealContext.js'
import { matchIndustry } from '../localAI.js'
import { getAppealGuideSnapshot, setAppealGuideSnapshot } from '../db.js'
import { getKnowledgeClusters } from '../db.js'
import { loadPublishedPrompt } from '../prompts/promptLoader.js'

const DEFAULT_APPEAL_GUIDE_OVERLAY = `生成内容须紧扣客户行业与违规原因；投诉话术保留 24h 首次回复、72h 处理完成提醒；95017 话术需可照着念、包含材料清单摘要。`

async function loadIndustryEvolutionHint(industryKey) {
  if (!industryKey) return null
  try {
    const clusters = await getKnowledgeClusters('industry_pattern', 0.3)
    const hit = clusters.find(c => c.cluster_key === industryKey || c.cluster_name?.includes(industryKey))
    if (!hit?.insight_data) return null
    const ins = hit.insight_data
    return ins.topSuggestions?.slice?.(0, 2)?.join('；') || ins.summary || null
  } catch {
    return null
  }
}

async function buildPrompt(ctx, complaintType) {
  const d = ctx.collected
  const ind = ctx.industry
  const viol = ctx.violation
  const opsOverlay = await loadPublishedPrompt('appeal_guide_overlay', DEFAULT_APPEAL_GUIDE_OVERLAY)
  return `你是微信商户申诉顾问。根据以下客户信息，输出严格 JSON（不要 markdown 代码块）。

## 运营补充要求
${opsOverlay}

## 客户信息
- 行业：${d.industry || '未知'}（标准化：${ind.key || '未识别'}）
- 处罚：${d.problem_type || '未知'}
- 违规原因：${d.violation_reason || '未知'}
- 商户号：${d.merchant_id || '待补充'}
- 法人：${d.legal_name || '待补充'}
- 投诉情况：${d.complaint_status || '未知'}

## 行业知识
${ind.appealTips ? `- 申诉要点：${ind.appealTips}` : '- 无行业知识库匹配'}
${ind.businessModel ? `- 经营模式：${ind.businessModel}` : ''}

## 违规知识
${viol ? `- 类型：${viol.key}；关键：${viol.success_key}` : '- 未匹配违规知识库'}

## 任务
生成「${complaintType || '综合'}」相关的行业化指导片段。

返回 JSON：
{
  "industry_steps": [
    {"title":"步骤标题","description":"针对该行业该违规的具体说明","priority":"urgent|required|recommended"}
  ],
  "complaint_templates": {
    "first_reply": "首次回复话术（24h内，含行业特点）",
    "resolution": "处理方案话术",
    "close": "结单引导话术"
  },
  "phone_script": {
    "opening": "首次致电开场白",
    "followup": "催审致电话术",
    "tips": ["注意1","注意2"]
  },
  "material_notes": ["该行业建议补充的材料说明1","说明2"]
}

要求：内容必须针对该客户的行业和违规原因，禁止泛泛的通用模板。投诉话术保留合规：24h首次回复、72h处理完成。`
}

async function callAI(prompt, trackAIUsage) {
  const cfg = await getAIConfig()
  if (!cfg?.apiKey) return null

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35,
      max_tokens: 2800,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`AI ${res.status}: ${t.slice(0, 150)}`)
  }

  const data = await res.json()
  if (data.usage && trackAIUsage) {
    await trackAIUsage({
      userId: 0,
      type: 'appeal_guide_generate',
      usage: data.usage,
      provider: cfg.provider,
      modelName: cfg.model,
    }).catch(() => {})
  }

  const raw = data.choices?.[0]?.message?.content || '{}'
  try {
    return JSON.parse(raw)
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  }
}

/**
 * 获取或生成申诉指导快照
 * @param {string} sessionId
 * @param {object} collectedData
 * @param {{ force?: boolean, trackAIUsage?: Function }} opts
 */
export async function ensureAppealGuideSnapshot(sessionId, collectedData, opts = {}) {
  const evolutionHint = await loadIndustryEvolutionHint(
    matchIndustry(collectedData?.industry || '')?.key || null
  )
  const ctx = buildSessionAppealContext(collectedData, { industryClusterInsight: evolutionHint })
  const fingerprint = ctx.completeness.fingerprint

  if (ctx.completeness.readiness === 'minimal' && !opts.force) {
    return { ctx, snapshot: null, generated: false, reason: 'not_ready' }
  }

  const cached = await getAppealGuideSnapshot(sessionId)
  if (cached?.fingerprint === fingerprint && cached?.payload && !opts.force) {
    return { ctx, snapshot: cached.payload, generated: false, reason: 'cache_hit' }
  }

  if (ctx.completeness.readiness === 'minimal') {
    return { ctx, snapshot: cached?.payload || null, generated: false, reason: 'minimal' }
  }

  let trackAIUsage = opts.trackAIUsage
  if (!trackAIUsage) {
    try {
      const mod = await import('./usageTracker.js')
      if (mod.isUsageTrackerReady()) trackAIUsage = mod.trackAIUsage
    } catch { /* ignore */ }
  }

  try {
    const payload = await callAI(await buildPrompt(ctx), trackAIUsage)
    if (!payload) return { ctx, snapshot: cached?.payload || null, generated: false, reason: 'no_ai' }

    await setAppealGuideSnapshot(sessionId, { fingerprint, payload, generatedAt: new Date().toISOString() })
    return { ctx, snapshot: payload, generated: true, reason: 'generated' }
  } catch (e) {
    console.error('[appealGuideSnapshot]', e.message)
    return { ctx, snapshot: cached?.payload || null, generated: false, reason: 'error', error: e.message }
  }
}

export { buildSessionAppealContext, computeContextFingerprint }
