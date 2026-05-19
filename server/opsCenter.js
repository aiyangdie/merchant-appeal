/**
 * 运营中心：全文搜索、日快照、周对比、质检抽样、卡点告警、Prompt 版本、快捷回复
 */
import { getPool, getSessionChatboardStats, getDashboardStats } from './db.js'
import { safeDecrypt } from './utils/crypto.js'
import { DEFAULT_COLLECTION_OVERLAY } from './prompts/collectionOverlayDefault.js'
import { invalidatePromptCache } from './prompts/promptLoader.js'

export async function initOpsCenterTables() {
  const pool = getPool()
  if (!pool) return

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chatboard_daily_snapshots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      snapshot_date DATE NOT NULL,
      days INT NOT NULL DEFAULT 7,
      payload JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_date (snapshot_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_quick_replies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(128) NOT NULL,
      content TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS session_qa_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      rating VARCHAR(16) DEFAULT 'pending',
      notes TEXT,
      sampled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      UNIQUE KEY uk_session (session_id),
      INDEX idx_rating (rating)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS system_prompt_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prompt_key VARCHAR(64) NOT NULL,
      title VARCHAR(128) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      version INT NOT NULL DEFAULT 1,
      published_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_key_status (prompt_key, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  try {
    await pool.execute('ALTER TABLE messages ADD FULLTEXT INDEX ft_messages_content (content)')
  } catch { /* 已存在或不支持 */ }

  const APPEAL_GUIDE_OVERLAY_SEED = `生成内容须紧扣客户行业与违规原因；投诉话术保留 24h 首次回复、72h 处理完成提醒；95017 话术需可照着念、包含材料清单摘要。`

  const seeds = [
    ['chat_collection', '对话收集指引', DEFAULT_COLLECTION_OVERLAY],
    ['appeal_guide_overlay', '申诉指导 AI 快照补充', APPEAL_GUIDE_OVERLAY_SEED],
    ['chatboard_weekly', '看板周报模板', '## 本周会话摘要\n- 消息量：\n- 主要客户诉求：\n- AI 追问优化：'],
    ['report_generation', '报告生成指引', '基于已收集信息生成正式申诉材料：案情评估、投诉处理、退款规则、业务模式、整改说明。语言正式、每段≤300字、可直接提交。严禁编造用户未提供的事实。'],
  ]
  for (const [key, title, content] of seeds) {
    const [rows] = await pool.execute(
      'SELECT id, LENGTH(content) AS len FROM system_prompt_versions WHERE prompt_key = ? AND status = ? LIMIT 1',
      [key, 'published']
    )
    if (rows.length === 0) {
      await pool.execute(
        `INSERT INTO system_prompt_versions (prompt_key, title, content, status, version, published_at)
         VALUES (?, ?, ?, 'published', 1, NOW())`,
        [key, title, content]
      )
    } else if (key === 'chat_collection' && Number(rows[0].len) < 300) {
      await pool.execute(
        `UPDATE system_prompt_versions SET content = ?, version = version + 1, updated_at = NOW() WHERE id = ?`,
        [content, rows[0].id]
      )
      invalidatePromptCache('chat_collection')
    }
  }

  const [qr] = await pool.execute('SELECT COUNT(*) AS c FROM admin_quick_replies')
  if (Number(qr[0]?.c) === 0) {
    const defaults = [
      ['补材料清单', '请补充：1）营业执照 2）法人身份证 3）经营场景说明 4）相关订单/流水截图'],
      ['进度说明', '您的申诉材料我们已收到，正在按微信审核要求整理，预计 1–2 个工作日给您反馈。'],
      ['行业追问', '方便说明一下主营行业、线下/线上占比，以及本次违规提示的具体文案吗？'],
    ]
    for (let i = 0; i < defaults.length; i++) {
      await pool.execute(
        'INSERT INTO admin_quick_replies (title, content, sort_order) VALUES (?, ?, ?)',
        [defaults[i][0], defaults[i][1], i]
      )
    }
  }
}

function likePattern(q) {
  const e = String(q || '').trim().slice(0, 200)
  if (!e) return null
  return `%${e.replace(/[%_\\]/g, '\\$&')}%`
}

/** 管理端全文搜索消息 */
export async function searchMessagesAdmin({ q, limit = 40, offset = 0 }) {
  const pool = getPool()
  const pattern = likePattern(q)
  if (!pattern || pattern.length < 3) {
    return { items: [], total: 0, q: String(q || '').trim() }
  }

  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 40, 1), 100)
  const off = Math.max(parseInt(String(offset), 10) || 0, 0)

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM messages m
     WHERE m.content LIKE ? ESCAPE '\\\\'`,
    [pattern]
  )
  const total = Number(countRows[0]?.c) || 0

  const [rows] = await pool.query(
    `SELECT m.id, m.session_id, m.role, m.created_at,
            LEFT(m.content, 320) AS excerpt,
            CHAR_LENGTH(m.content) AS content_len,
            s.step, s.status, s.order_no
     FROM messages m
     INNER JOIN sessions s ON s.id = m.session_id
     WHERE m.content LIKE ? ESCAPE '\\\\'
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [pattern, lim, off]
  )

  return {
    q: String(q).trim(),
    total,
    items: (rows || []).map((r) => ({
      messageId: r.id,
      sessionId: r.session_id,
      role: r.role,
      createdAt: r.created_at,
      excerpt: (r.excerpt || '').replace(/\s+/g, ' ').trim(),
      contentLen: r.content_len,
      step: r.step,
      status: r.status,
      orderNo: r.order_no,
    })),
  }
}

/** 带筛选的会话列表 */
export async function getAdminSessionsFiltered({ q, limit = 200, offset = 0 }) {
  const pool = getPool()
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 200, 1), 500)
  const off = Math.max(parseInt(String(offset), 10) || 0, 0)
  const pattern = likePattern(q)

  let where = `EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id AND m.role = 'user')`
  const params = []

  if (pattern) {
    where += ` AND (
      s.id LIKE ? ESCAPE '\\\\'
      OR s.order_no LIKE ? ESCAPE '\\\\'
      OR EXISTS (
        SELECT 1 FROM messages m2
        WHERE m2.session_id = s.id AND m2.content LIKE ? ESCAPE '\\\\'
      )
    )`
    params.push(pattern, pattern, pattern)
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM sessions s WHERE ${where}`,
    params
  )

  const [rows] = await pool.query(
    `SELECT s.*,
      u.phone as user_phone, u.nickname as user_nickname,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user'
       ORDER BY created_at ASC LIMIT 1) as first_message
     FROM sessions s
     LEFT JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, off]
  )

  return {
    total: Number(countRows[0]?.c) || 0,
    sessions: (rows || []).map((r) => ({
      ...r,
      user_phone: safeDecrypt(r.user_phone),
      user_nickname: safeDecrypt(r.user_nickname),
    })),
  }
}

export async function saveChatboardSnapshot(days = 7) {
  const pool = getPool()
  const stats = await getSessionChatboardStats({ days })
  const date = new Date().toISOString().slice(0, 10)
  await pool.execute(
    `INSERT INTO chatboard_daily_snapshots (snapshot_date, days, payload)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE days = VALUES(days), payload = VALUES(payload), created_at = NOW()`,
    [date, days, JSON.stringify(stats)]
  )
  return { snapshotDate: date, days }
}

export async function listChatboardSnapshots(limit = 30) {
  const pool = getPool()
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 30, 1), 90)
  const [rows] = await pool.query(
    `SELECT snapshot_date, days, created_at,
            JSON_EXTRACT(payload, '$.totals.messages_in_window') AS messages_in_window,
            JSON_EXTRACT(payload, '$.totals.sessions_started_in_window') AS sessions_started
     FROM chatboard_daily_snapshots
     ORDER BY snapshot_date DESC
     LIMIT ?`,
    [lim]
  )
  return rows || []
}

export async function getWeekCompare(days = 7) {
  const d = Math.min(Math.max(parseInt(String(days), 10) || 7, 1), 30)
  const current = await getSessionChatboardStats({ days: d })
  const previous = await getSessionChatboardStats({ days: d * 2 })
  const curMsg = Number(current.totals?.messages_in_window) || 0
  const curSess = Number(current.totals?.sessions_started_in_window) || 0
  const prevMsg = Number(previous.totals?.messages_in_window) || 0
  const prevSess = Number(previous.totals?.sessions_started_in_window) || 0
  const priorMsg = Math.max(prevMsg - curMsg, 0)
  const priorSess = Math.max(prevSess - curSess, 0)
  const pct = (cur, prior) => {
    if (prior <= 0) return cur > 0 ? 100 : 0
    return Math.round(((cur - prior) / prior) * 1000) / 10
  }
  return {
    days: d,
    current: { messages: curMsg, sessions: curSess },
    previousPeriod: { messages: priorMsg, sessions: priorSess },
    changePct: { messages: pct(curMsg, priorMsg), sessions: pct(curSess, priorSess) },
    generatedAt: new Date().toISOString(),
  }
}

export async function getOpsAlerts() {
  const pool = getPool()
  const [oneShot] = await pool.query(
    `SELECT s.id, s.created_at, s.step,
       (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS msg_cnt
     FROM sessions s
     WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.role = 'user') = 1
       AND s.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY s.created_at DESC
     LIMIT 20`
  )
  const [stuck] = await pool.query(
    `SELECT s.id, s.step, s.created_at,
       (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS msg_cnt
     FROM sessions s
     WHERE s.status = 'active'
       AND COALESCE(s.step, 0) < 4
       AND s.created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
       AND (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) >= 2
     ORDER BY s.created_at ASC
     LIMIT 20`
  )
  const [draftPrompts] = await pool.query(
    `SELECT COUNT(*) AS c FROM system_prompt_versions WHERE status = 'draft'`
  )
  return {
    abandonedSessions: oneShot || [],
    stuckSessions: stuck || [],
    draftPromptCount: Number(draftPrompts[0]?.c) || 0,
  }
}

/** 清理会话已删除但质检表仍残留的孤儿记录 */
export async function purgeOrphanQAReviews() {
  const pool = getPool()
  const [result] = await pool.execute(
    `DELETE q FROM session_qa_reviews q
     LEFT JOIN sessions s ON s.id = q.session_id
     WHERE s.id IS NULL`
  )
  return result?.affectedRows ?? 0
}

/**
 * 随机抽取待质检会话
 * - 仅排除当前「待评 pending」队列中的会话（不再排除已 good/bad 的，可重新入队）
 * - 样本不足时自动放宽到 30 天窗口
 * - 仅抽取仍存在于 sessions 表中的会话
 */
export async function sampleSessionsForQA(count = 8) {
  const pool = getPool()
  const n = Math.min(Math.max(parseInt(String(count), 10) || 8, 1), 30)
  const purged = await purgeOrphanQAReviews()

  async function pickCandidates(days, limit) {
    const [rows] = await pool.query(
      `SELECT s.id FROM sessions s
       WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND EXISTS (
           SELECT 1 FROM messages m
           WHERE m.session_id = s.id AND m.role = 'user'
             AND m.content IS NOT NULL AND TRIM(m.content) != ''
         )
         AND s.id NOT IN (
           SELECT q.session_id FROM session_qa_reviews q
           INNER JOIN sessions s2 ON s2.id = q.session_id
           WHERE q.rating = 'pending'
         )
       ORDER BY RAND()
       LIMIT ?`,
      [days, limit]
    )
    return rows || []
  }

  let candidates = await pickCandidates(14, n)
  if (candidates.length < n) {
    const more = await pickCandidates(30, n - candidates.length)
    const seen = new Set(candidates.map((r) => r.id))
    for (const r of more) {
      if (!seen.has(r.id)) {
        candidates.push(r)
        seen.add(r.id)
      }
    }
  }

  let added = 0
  let requeued = 0
  for (const r of candidates) {
    const [result] = await pool.execute(
      `INSERT INTO session_qa_reviews (session_id, rating, sampled_at) VALUES (?, 'pending', NOW())
       ON DUPLICATE KEY UPDATE
         rating = 'pending',
         sampled_at = NOW(),
         reviewed_at = NULL,
         notes = NULL`,
      [r.id]
    )
    const aff = result?.affectedRows ?? 0
    if (aff === 1) added++
    else if (aff === 2) requeued++
  }

  const { items } = await listQAReviews('pending', 50, { skipPurge: true })
  const totalPurged = purged
  let message =
    added + requeued > 0
      ? `新增 ${added} 条${requeued ? `，重新入队 ${requeued} 条` : ''}`
      : candidates.length === 0
        ? '近 30 天内没有可抽取的会话（待评队列已满或会话无用户消息）'
        : '未写入新样本（请刷新列表查看当前待评）'
  if (totalPurged > 0) {
    message = `已清理 ${totalPurged} 条已删除会话的质检记录${message ? `；${message}` : ''}`
  }
  return {
    items,
    added,
    requeued,
    purged: totalPurged,
    requested: n,
    message,
  }
}

export async function listQAReviews(rating = '', limit = 50, { skipPurge = false } = {}) {
  const pool = getPool()
  const purged = skipPurge ? 0 : await purgeOrphanQAReviews()
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100)
  let sql = `SELECT q.*,
      (SELECT LEFT(m.content, 120) FROM messages m
       WHERE m.session_id = q.session_id AND m.role = 'user'
         AND m.content IS NOT NULL AND TRIM(m.content) != ''
       ORDER BY m.created_at ASC LIMIT 1) AS first_snippet,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = q.session_id) AS message_count,
      s.created_at AS session_created_at,
      s.status AS session_status
     FROM session_qa_reviews q
     INNER JOIN sessions s ON s.id = q.session_id`
  const params = []
  if (rating) {
    sql += ' WHERE q.rating = ?'
    params.push(rating)
  }
  sql += ' ORDER BY q.sampled_at DESC LIMIT ?'
  params.push(lim)
  const [rows] = await pool.query(sql, params)
  return { items: rows || [], purged }
}

export async function updateQAReview(sessionId, { rating, notes }) {
  const pool = getPool()
  const [sess] = await pool.execute('SELECT id FROM sessions WHERE id = ? LIMIT 1', [sessionId])
  if (!sess?.length) {
    await pool.execute('DELETE FROM session_qa_reviews WHERE session_id = ?', [sessionId])
    const err = new Error('会话已删除')
    err.code = 'SESSION_GONE'
    throw err
  }
  await pool.execute(
    `UPDATE session_qa_reviews SET rating = ?, notes = ?, reviewed_at = NOW()
     WHERE session_id = ?`,
    [rating || 'pending', notes || '', sessionId]
  )
}

export async function listQuickReplies() {
  const pool = getPool()
  const [rows] = await pool.execute(
    'SELECT * FROM admin_quick_replies ORDER BY sort_order ASC, id ASC'
  )
  return rows || []
}

export async function saveQuickReply({ id, title, content, sortOrder }) {
  const pool = getPool()
  if (id) {
    await pool.execute(
      'UPDATE admin_quick_replies SET title = ?, content = ?, sort_order = ? WHERE id = ?',
      [title, content, sortOrder ?? 0, id]
    )
    return { id }
  }
  const [r] = await pool.execute(
    'INSERT INTO admin_quick_replies (title, content, sort_order) VALUES (?, ?, ?)',
    [title, content, sortOrder ?? 0]
  )
  return { id: r.insertId }
}

export async function deleteQuickReply(id) {
  await getPool().execute('DELETE FROM admin_quick_replies WHERE id = ?', [id])
}

export async function listPrompts() {
  const pool = getPool()
  const [rows] = await pool.query(
    `SELECT id, prompt_key, title, status, version, published_at, updated_at,
            LEFT(content, 200) AS preview
     FROM system_prompt_versions
     ORDER BY prompt_key ASC, status DESC, version DESC`
  )
  return rows || []
}

export async function getPromptByKey(promptKey, status = 'published') {
  const pool = getPool()
  const [rows] = await pool.execute(
    `SELECT * FROM system_prompt_versions
     WHERE prompt_key = ? AND status = ?
     ORDER BY version DESC LIMIT 1`,
    [promptKey, status]
  )
  return rows[0] || null
}

export async function savePromptDraft({ promptKey, title, content }) {
  const pool = getPool()
  const [maxV] = await pool.execute(
    'SELECT COALESCE(MAX(version), 0) AS v FROM system_prompt_versions WHERE prompt_key = ?',
    [promptKey]
  )
  const nextV = Number(maxV[0]?.v) + 1
  const [r] = await pool.execute(
    `INSERT INTO system_prompt_versions (prompt_key, title, content, status, version)
     VALUES (?, ?, ?, 'draft', ?)`,
    [promptKey, title, content, nextV]
  )
  return { id: r.insertId, version: nextV }
}

export async function publishPrompt(id) {
  const pool = getPool()
  const [rows] = await pool.execute('SELECT * FROM system_prompt_versions WHERE id = ?', [id])
  if (!rows.length) throw new Error('Prompt 不存在')
  const row = rows[0]
  await pool.execute(
    `UPDATE system_prompt_versions SET status = 'archived'
     WHERE prompt_key = ? AND status = 'published'`,
    [row.prompt_key]
  )
  await pool.execute(
    `UPDATE system_prompt_versions SET status = 'published', published_at = NOW() WHERE id = ?`,
    [id]
  )
  invalidatePromptCache(row.prompt_key)
  return row
}

/** 运营数据 → Prompt 修订建议（人工采纳后发布） */
export async function getPromptRevisionSuggestions() {
  const pool = getPool()
  const suggestions = []

  try {
    const { getCollectionFieldGapStats, gapStatsToOpsSuggestions } = await import('./ai/tokenOversightHints.js')
    const gapStats = await getCollectionFieldGapStats({ days: 14, sampleLimit: 150 })
    suggestions.push(...gapStatsToOpsSuggestions(gapStats))
  } catch (e) {
    console.warn('[OpsCenter] collection gap stats:', e.message)
  }

  try {
    const stats = await getSessionChatboardStats({ days: 7 })
    const topSamples = (stats.recentFirstUserSnippets || []).slice(0, 5)
    if (topSamples.length) {
      suggestions.push({
        type: 'opening',
        priority: 'medium',
        title: '优化首句引导',
        detail: `近7天用户首句样本：${topSamples.map((s) => `"${String(s.snippet || '').slice(0, 40)}"`).join('；')}`,
        action: '在 chat_collection 欢迎/开场中增加对应场景的追问模板',
      })
    }
    const avgMsgs = Number(stats.sessionDepth?.avg_msgs) || 0
    if (avgMsgs > 25) {
      suggestions.push({
        type: 'efficiency',
        priority: 'high',
        title: '会话轮次偏高',
        detail: `近7天平均每会话 ${avgMsgs} 条消息，可能存在重复追问`,
        action: '强化「不重复问已填字段」与一次多问复合信息',
      })
    }
  } catch (e) {
    console.warn('[OpsCenter] chatboard stats for suggestions:', e.message)
  }

  try {
    const { getCollectionFieldGapStats } = await import('./ai/tokenOversightHints.js')
    const gaps = await getCollectionFieldGapStats({ days: 7, sampleLimit: 150 })
    const indGap = gaps.gaps?.find(g => g.field === 'industry')
    if (gaps.sampleSize >= 5 && indGap && indGap.missingRate >= 35) {
      suggestions.push({
        type: 'collection_gap',
        priority: 'high',
        title: '行业信息收集不足',
        detail: `近7天抽样 ${gaps.sampleSize} 个会话，约 ${indGap.missingRate}% 未填写行业`,
        action: '强化 chat_collection 前 3 轮行业/场景选择题追问；引导用户打开申诉指导前补齐核心三要素',
      })
    }
  } catch (e) {
    console.warn('[OpsCenter] collection gap suggestions:', e.message)
  }

  try {
    const [badRows] = await pool.query(
      `SELECT s.id, s.collected_data, q.notes
       FROM session_qa_reviews q
       JOIN sessions s ON s.id = q.session_id
       WHERE q.rating = 'bad'
       ORDER BY q.sampled_at DESC LIMIT 8`
    )
    for (const row of badRows || []) {
      const note = String(row.notes || '').trim()
      if (note) {
        suggestions.push({
          type: 'qa_bad',
          priority: 'high',
          title: `质检问题会话 ${String(row.id).slice(0, 8)}`,
          detail: note.slice(0, 200),
          action: '考虑写入 evolution 规则（collection_strategy）或修订 chat_collection',
        })
      }
    }
  } catch (e) {
    console.warn('[OpsCenter] QA suggestions:', e.message)
  }

  try {
    const [draftCount] = await pool.execute(
      `SELECT COUNT(*) AS c FROM system_prompt_versions WHERE status = 'draft'`
    )
    if (Number(draftCount[0]?.c) > 0) {
      suggestions.push({
        type: 'ops',
        priority: 'low',
        title: '有待发布 Prompt 草稿',
        detail: `${draftCount[0].c} 条草稿未发布`,
        action: '在 Prompt 中心审核后发布',
      })
    }
  } catch { /* ignore */ }

  return { suggestions, generatedAt: new Date().toISOString() }
}

/** 大屏聚合数据 */
export async function getOpsScreenPayload() {
  const [stats, chatboard, week, alerts, snapshots] = await Promise.all([
    getDashboardStats().catch(() => null),
    getSessionChatboardStats({ days: 7 }),
    getWeekCompare(7),
    getOpsAlerts(),
    listChatboardSnapshots(14),
  ])
  return { stats, chatboard, week, alerts, snapshots, generatedAt: new Date().toISOString() }
}
