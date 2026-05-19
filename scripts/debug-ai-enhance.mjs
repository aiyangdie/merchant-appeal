/**
 * 本地调试：模拟知识库 ai-enhance 材料检测（写入 debug-48900f.log）
 */
import { getPool } from '../server/db/init.js'
import { getSession, getMessages, getDeepAnalysisResult, getAppealText } from '../server/db.js'
import { agentDebugLog } from '../server/utils/agentDebugLog.js'

const pool = getPool()
const [rows] = await pool.query(
  `SELECT s.id FROM sessions s
   INNER JOIN messages m ON m.session_id = s.id
   GROUP BY s.id ORDER BY MAX(m.created_at) DESC LIMIT 1`,
)
const sessionId = rows[0]?.id
if (!sessionId) {
  agentDebugLog('debug-ai-enhance.mjs', 'no session', {}, 'H2')
  process.exit(1)
}

const session = await getSession(sessionId)
const msgs = await getMessages(sessionId)
const deep = await getDeepAnalysisResult(sessionId).catch(() => null)
const reportMsg = [...msgs].reverse().find((m) => m.role === 'assistant' && m.content)
const userSnippet = msgs.filter((m) => m.role === 'user' && m.content).slice(0, 5).map((m) => m.content).join('\n')
const reportBody = String(reportMsg?.content || deep || userSnippet || '').slice(0, 6000)
const materialLen = reportBody.length + userSnippet.length + (deep ? String(deep).length : 0)

agentDebugLog('debug-ai-enhance.mjs', 'session probe', {
  sessionId: sessionId.slice(0, 8),
  msgCount: msgs.length,
  reportLen: reportBody.length,
  snippetLen: userSnippet.length,
  deepLen: deep ? String(deep).length : 0,
  materialLen,
  hasCollected: !!session?.collected_data,
}, 'H2')

console.log('logged session', sessionId.slice(0, 8), 'materialLen', materialLen)
process.exit(0)
