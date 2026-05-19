import { getPool } from '../db/init.js'

const SCOPES = new Set([
  'analytics_insights',
  'session_chatboard_brief',
  'token_ai_analyze',
])

/**
 * 保存或更新管理端 AI 简报（每个 scope + context_key 仅保留最新一条）
 */
export async function saveAdminAiReport(scope, contextKey, markdown, meta = null) {
  if (!SCOPES.has(scope)) throw new Error('invalid scope')
  const key = String(contextKey || 'default').slice(0, 64)
  const pool = getPool()
  const metaJson = meta ? JSON.stringify(meta) : null
  await pool.execute(
    `INSERT INTO admin_ai_reports (scope, context_key, markdown, meta_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       markdown = VALUES(markdown),
       meta_json = VALUES(meta_json),
       updated_at = CURRENT_TIMESTAMP`,
    [scope, key, markdown, metaJson],
  )
}

export async function getLatestAdminAiReport(scope, contextKey) {
  if (!SCOPES.has(scope)) return null
  const key = String(contextKey || 'default').slice(0, 64)
  const pool = getPool()
  const [rows] = await pool.execute(
    `SELECT markdown, meta_json, created_at, updated_at
     FROM admin_ai_reports WHERE scope = ? AND context_key = ? LIMIT 1`,
    [scope, key],
  )
  if (!rows.length) return null
  const r = rows[0]
  let meta = null
  if (r.meta_json) {
    try {
      meta = typeof r.meta_json === 'string' ? JSON.parse(r.meta_json) : r.meta_json
    } catch { meta = null }
  }
  return {
    markdown: r.markdown,
    meta,
    generatedAt: r.updated_at || r.created_at,
  }
}

export async function deleteAdminAiReport(scope, contextKey) {
  if (!SCOPES.has(scope)) return
  const pool = getPool()
  await pool.execute(
    'DELETE FROM admin_ai_reports WHERE scope = ? AND context_key = ?',
    [scope, String(contextKey || 'default').slice(0, 64)],
  )
}
