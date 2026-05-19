import { getPool } from '../db/init.js'
import { getSession, getMessages, getDeepAnalysisResult, getAppealText, getConversationAnalysisById } from '../db.js'

function aggregateParts({ msgs, deep, ca, appeal, cd }) {
  const appealText = appeal
    ? [appeal.complaint_cause, appeal.complaint_resolution, appeal.supplementary, appeal.business_model, appeal.refund_rules]
      .filter(Boolean)
      .join('\n')
    : ''

  const reportMsg = [...msgs].reverse().find((m) => {
    if (m.role !== 'assistant' || !m.content) return false
    return m.content.length > 80 || (m.content.match(/^###\s+/gm) || []).length >= 2
  }) || [...msgs].reverse().find((m) => m.role === 'assistant' && m.content)

  const userSnippet = msgs
    .filter((m) => m.role === 'user' && m.content)
    .slice(0, 5)
    .map((m) => m.content)
    .join('\n')
    .slice(0, 2000)

  const parts = []
  const sources = []

  if (reportMsg?.content) {
    parts.push(`【会话助手回复】\n${reportMsg.content}`)
    sources.push('messages')
  }
  if (deep) {
    parts.push(`【深度分析】\n${String(deep).slice(0, 4000)}`)
    sources.push('deep_analysis')
  }
  if (ca?.raw_analysis) {
    parts.push(`【对话分析】\n${String(ca.raw_analysis).slice(0, 5000)}`)
    sources.push('conversation_analysis')
  }
  if (appealText) {
    parts.push(`【申诉文案】\n${appealText}`)
    sources.push('appeal_text')
  }
  if (userSnippet) {
    parts.push(`【用户对话摘录】\n${userSnippet}`)
    sources.push('user_messages')
  }
  const cdStr = JSON.stringify(cd || {})
  if (cdStr && cdStr !== '{}' && cdStr.length > 10) {
    parts.push(`【收集字段】\n${cdStr}`)
    sources.push('collected_data')
  }

  const reportContent = parts.join('\n\n').slice(0, 8000)
  const industry = cd?.industry || cd?.business_type || ca?.industry || ''
  const problemType = cd?.problem_type || cd?.violation_type || ca?.problem_type || ''

  return {
    reportContent,
    sources,
    materialLen: reportContent.length,
    industry,
    problemType,
    title: cd?.company_name || cd?.merchant_name || '',
  }
}

/**
 * 聚合会话内可用于知识库案例 AI 的材料（不要求 sessions 行仍存在）
 */
export async function buildCaseMaterialFromSession(sessionId) {
  if (!sessionId) {
    return { reportContent: '', sources: [], materialLen: 0, industry: '', problemType: '', title: '' }
  }

  const session = await getSession(sessionId).catch(() => null)
  const cd = session?.collected_data || {}
  const msgs = await getMessages(sessionId).catch(() => [])
  const deep = session
    ? await getDeepAnalysisResult(sessionId).catch(() => null)
    : null
  const appeal = await getAppealText(sessionId).catch(() => null)

  const pool = getPool()
  const [caRows] = await pool.execute(
    `SELECT raw_analysis, industry, problem_type
     FROM conversation_analyses WHERE session_id = ? AND raw_analysis IS NOT NULL AND TRIM(raw_analysis) != ''
     ORDER BY analyzed_at DESC LIMIT 1`,
    [sessionId],
  )
  const ca = caRows[0] || null

  return {
    ...aggregateParts({ msgs, deep, ca, appeal, cd }),
    sessionExists: !!session,
    sessionId,
  }
}

/** 从单条进化「对话分析」记录构建案例材料（适用于会话已删但分析仍在） */
export async function buildCaseMaterialFromAnalysisId(analysisId) {
  const ca = await getConversationAnalysisById(analysisId)
  if (!ca) {
    return { reportContent: '', sources: [], materialLen: 0, industry: '', problemType: '', title: '' }
  }

  const sessionId = ca.session_id
  const session = sessionId ? await getSession(sessionId).catch(() => null) : null
  const cd = session?.collected_data || {}
  const msgs = sessionId ? await getMessages(sessionId).catch(() => []) : []
  const deep = sessionId && session
    ? await getDeepAnalysisResult(sessionId).catch(() => null)
    : null
  const appeal = sessionId ? await getAppealText(sessionId).catch(() => null) : null

  const bundle = aggregateParts({
    msgs,
    deep,
    ca: { raw_analysis: ca.raw_analysis, industry: ca.industry, problem_type: ca.problem_type },
    appeal,
    cd,
  })

  return {
    ...bundle,
    sessionId: sessionId || null,
    analysisId,
    sessionExists: !!session,
    industry: bundle.industry || ca.industry || '',
    problemType: bundle.problemType || ca.problem_type || '',
  }
}
