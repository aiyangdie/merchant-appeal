/**
 * 复现知识库 ai-enhance 全流程并写入 debug-48900f.log
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env'), override: true })

const { initDatabase, getSession, getMessages, getDeepAnalysisResult, getAppealText } = await import('../db.js')
const { getAIConfig } = await import('../shared/aiConfig.js')
const { agentDebugLog } = await import('../utils/agentDebugLog.js')
const { getPool } = await import('../db/init.js')

await initDatabase()
const pool = getPool()

const [rows] = await pool.query(
  `SELECT s.id FROM sessions s
   INNER JOIN messages m ON m.session_id = s.id
   GROUP BY s.id ORDER BY MAX(m.created_at) DESC LIMIT 1`,
)
const sessionId = rows[0]?.id
agentDebugLog('debug-knowledge-ai.mjs', 'start', { sessionId: sessionId?.slice(0, 12) || null }, 'H1')

if (!sessionId) {
  agentDebugLog('debug-knowledge-ai.mjs', 'no session', {}, 'H2')
  process.exit(1)
}

const session = await getSession(sessionId)
const msgs = await getMessages(sessionId)
const deep = await getDeepAnalysisResult(sessionId).catch(() => null)
const appeal = await getAppealText(sessionId).catch(() => null)
const appealText = appeal
  ? [appeal.complaint_cause, appeal.complaint_resolution, appeal.supplementary, appeal.business_model, appeal.refund_rules].filter(Boolean).join('\n')
  : ''
const reportMsg = [...msgs].reverse().find((m) => m.role === 'assistant' && m.content)
const userSnippet = msgs.filter((m) => m.role === 'user' && m.content).slice(0, 5).map((m) => m.content).join('\n').slice(0, 2000)
const reportBody = String(reportMsg?.content || appealText || deep || '').slice(0, 6000)
const materialLen = reportBody.length + userSnippet.length + (deep ? String(deep).length : 0)

agentDebugLog('debug-knowledge-ai.mjs', 'material', {
  reportLen: reportBody.length,
  snippetLen: userSnippet.length,
  deepLen: deep ? String(deep).length : 0,
  materialLen,
}, 'H2')

const cfg = await getAIConfig()
if (!cfg?.apiKey) {
  agentDebugLog('debug-knowledge-ai.mjs', 'no ai key', { provider: cfg?.provider }, 'H3')
  process.exit(1)
}

const context = {
  title: session.collected_data?.company_name || '',
  industry: session.collected_data?.industry || '',
  problemType: session.collected_data?.problem_type || '',
  reportContent: reportBody,
  successSummary: '',
  sessionSnippet: userSnippet,
  deepAnalysis: deep ? String(deep).slice(0, 3000) : '',
}

const systemPrompt = `你是商户申诉成功案例编辑。根据用户 JSON 中的 reportContent、sessionSnippet、deepAnalysis 归纳案例字段。
输出严格 JSON（无 markdown 代码块），字段：
{"title":"案例标题(12-24字)","industry":"行业","problemType":"处罚/问题类型","successSummary":"成功要点(80-150字，写可复用的经验)","adminNotes":"管理员内部备注(可选,60字内)"}
规则：只根据材料写，不编造金额/判决；每个字段必须有实质内容；禁止输出「待补充」「示例」等占位语。`

const aiBodyBase = {
  model: cfg.model,
  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify(context) }],
  temperature: 0.25,
  max_tokens: 1000,
}

let aiRes = await fetch(cfg.endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
  body: JSON.stringify({ ...aiBodyBase, response_format: { type: 'json_object' } }),
  signal: AbortSignal.timeout(60000),
})
let usedRetry = false
if (!aiRes.ok) {
  usedRetry = true
  aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(aiBodyBase),
    signal: AbortSignal.timeout(60000),
  })
}

if (!aiRes.ok) {
  const t = await aiRes.text()
  agentDebugLog('debug-knowledge-ai.mjs', 'ai fail', { status: aiRes.status, usedRetry, detail: t.slice(0, 150) }, 'H3')
  process.exit(1)
}

const data = await aiRes.json()
const raw = data.choices?.[0]?.message?.content || ''
let parsed = {}
try {
  const m = raw.match(/\{[\s\S]*\}/)
  parsed = m ? JSON.parse(m[0]) : JSON.parse(raw || '{}')
} catch (e) {
  agentDebugLog('debug-knowledge-ai.mjs', 'parse fail', { rawLen: raw.length, err: e.message }, 'H4')
  process.exit(1)
}

const norm = {
  title: parsed.title || parsed.标题 || '',
  industry: parsed.industry || parsed.行业 || '',
  problemType: parsed.problemType || parsed.问题类型 || '',
  successSummary: parsed.successSummary || parsed.成功要点 || '',
  adminNotes: parsed.adminNotes || parsed.备注 || '',
}

agentDebugLog('debug-knowledge-ai.mjs', 'success', {
  usedRetry,
  model: cfg.model,
  filled: Object.entries(norm).filter(([, v]) => String(v).trim()).map(([k]) => k),
  titlePreview: String(norm.title).slice(0, 30),
}, 'H4')

console.log('OK', norm.title)
process.exit(0)
