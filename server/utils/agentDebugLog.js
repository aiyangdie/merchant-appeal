import fs from 'fs'

const LOG_PATH = '/root/.cursor/debug-48900f.log'
const INGEST = 'http://localhost:7822/ingest/018bf018-a48c-4eaa-9127-55349663cb6a'
const SESSION_ID = '48900f'

/** @param {string} location @param {string} message @param {Record<string, unknown>} data @param {string} hypothesisId */
export function agentDebugLog(location, message, data = {}, hypothesisId = '') {
  const payload = { sessionId: SESSION_ID, location, message, data, hypothesisId, timestamp: Date.now() }
  const line = `${JSON.stringify(payload)}\n`
  // #region agent log
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => {})
  try { fs.appendFileSync(LOG_PATH, line) } catch { /* ignore */ }
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[debug-48900f] ${location} ${message}`, JSON.stringify(data))
  }
  // #endregion
}
