import { getPool } from '../db/init.js'

/** 看板指标口径（前端 tooltip / AI 简报共用） */
export const CHATBOARD_METRIC_DEFINITIONS = {
  messages_in_window: {
    label: '窗口消息',
    definition: '统计窗口内所有消息条数，且所属会话在数据库中仍存在（不含已删会话的孤儿消息）。',
  },
  sessions_with_messages_in_window: {
    label: '活跃会话',
    definition: '统计窗口内至少有一条消息的去重会话数，且会话仍存在。',
  },
  sessions_started_in_window: {
    label: '新建会话',
    definition: '统计窗口内创建的会话数（按 sessions.created_at），仅现存记录；含未发言的空会话。',
  },
  sessions_empty_in_window: {
    label: '空会话',
    definition: '窗口内新建、且窗口内没有用户消息的会话数（仅点开未说话等）。',
  },
  sessionDepth: {
    label: '新建会话深度',
    definition: '仅针对窗口内新建的会话：平均每会话消息条数及单会话峰值，不含更早创建的老会话。',
  },
}

/**
 * 会话看板：聚合消息与会话分布（仅统计仍存在的会话）
 */
export async function getSessionChatboardStats(opts = {}) {
  const days = Math.min(Math.max(parseInt(String(opts.days || 14), 10) || 14, 1), 90)
  const pool = getPool()
  // days 已钳制为 1–90 整数，可安全内联，避免多子查询时 ? 占位符数量不匹配
  const windowSince = `DATE_SUB(NOW(), INTERVAL ${days} DAY)`

  const [roleRows] = await pool.query(
    `SELECT m.role, COUNT(*) AS cnt
     FROM messages m
     INNER JOIN sessions s ON m.session_id = s.id
     WHERE m.created_at >= ${windowSince}
     GROUP BY m.role`
  )

  const [dailyMsg] = await pool.query(
    `SELECT DATE(m.created_at) AS d, COUNT(*) AS cnt
     FROM messages m
     INNER JOIN sessions s ON m.session_id = s.id
     WHERE m.created_at >= ${windowSince}
     GROUP BY DATE(m.created_at)
     ORDER BY d ASC`
  )

  const [dailySessions] = await pool.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS cnt
     FROM sessions
     WHERE created_at >= ${windowSince}
     GROUP BY DATE(created_at)
     ORDER BY d ASC`
  )

  const [stepRows] = await pool.query(
    `SELECT COALESCE(step, 0) AS step, COUNT(*) AS cnt
     FROM sessions
     WHERE created_at >= ${windowSince}
     GROUP BY COALESCE(step, 0)
     ORDER BY step ASC`
  )

  const [statusRows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(status), ''), 'active') AS status, COUNT(*) AS cnt
     FROM sessions
     WHERE created_at >= ${windowSince}
     GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'active')
     ORDER BY cnt DESC`
  )

  const [bindRows] = await pool.query(
    `SELECT
       SUM(CASE WHEN order_no IS NOT NULL AND TRIM(order_no) <> '' THEN 1 ELSE 0 END) AS bound,
       SUM(CASE WHEN order_no IS NULL OR TRIM(order_no) = '' THEN 1 ELSE 0 END) AS unbound
     FROM sessions
     WHERE created_at >= ${windowSince}`
  )

  const [lenBuckets] = await pool.query(
    `SELECT
       CASE
         WHEN CHAR_LENGTH(m.content) <= 20 THEN '1_short'
         WHEN CHAR_LENGTH(m.content) <= 100 THEN '2_medium'
         WHEN CHAR_LENGTH(m.content) <= 500 THEN '3_long'
         ELSE '4_xlong'
       END AS bucket,
       COUNT(*) AS cnt
     FROM messages m
     INNER JOIN sessions s ON m.session_id = s.id
     WHERE m.role = 'user' AND m.created_at >= ${windowSince}
     GROUP BY CASE
         WHEN CHAR_LENGTH(m.content) <= 20 THEN '1_short'
         WHEN CHAR_LENGTH(m.content) <= 100 THEN '2_medium'
         WHEN CHAR_LENGTH(m.content) <= 500 THEN '3_long'
         ELSE '4_xlong'
       END
     ORDER BY bucket ASC`
  )

  const [hourRows] = await pool.query(
    `SELECT HOUR(m.created_at) AS h, COUNT(*) AS cnt
     FROM messages m
     INNER JOIN sessions s ON m.session_id = s.id
     WHERE m.role = 'user' AND m.created_at >= ${windowSince}
     GROUP BY HOUR(m.created_at)
     ORDER BY h ASC`
  )

  const [topSessions] = await pool.query(
    `SELECT m.session_id AS id, COUNT(*) AS msg_cnt,
       (SELECT LEFT(m2.content, 80) FROM messages m2
        WHERE m2.session_id = m.session_id AND m2.role = 'user'
        ORDER BY m2.created_at ASC LIMIT 1) AS first_user_snippet
     FROM messages m
     INNER JOIN sessions s ON s.id = m.session_id
     WHERE m.created_at >= ${windowSince}
     GROUP BY m.session_id
     ORDER BY msg_cnt DESC
     LIMIT 25`
  )

  const [avgRow] = await pool.query(
    `SELECT AVG(mc) AS avg_msgs, MAX(mc) AS max_msgs
     FROM (
       SELECT COUNT(*) AS mc
       FROM messages m
       INNER JOIN sessions s ON m.session_id = s.id
       WHERE s.created_at >= ${windowSince}
       GROUP BY s.id
     ) t`
  )

  const [totalsRows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM messages m
        INNER JOIN sessions s ON s.id = m.session_id
        WHERE m.created_at >= ${windowSince}) AS messages_in_window,
       (SELECT COUNT(*) FROM sessions s WHERE s.created_at >= ${windowSince}) AS sessions_started_in_window,
       (SELECT COUNT(DISTINCT m.session_id) FROM messages m
        INNER JOIN sessions s ON s.id = m.session_id
        WHERE m.created_at >= ${windowSince}) AS sessions_with_messages_in_window,
       (SELECT COUNT(*) FROM sessions s
        WHERE s.created_at >= ${windowSince}
          AND NOT EXISTS (
            SELECT 1 FROM messages m
            WHERE m.session_id = s.id AND m.role = 'user'
              AND m.created_at >= ${windowSince}
          )) AS sessions_empty_in_window`
  )

  const [orphanRows] = await pool.query(
    `SELECT COUNT(*) AS orphan_messages_in_window
     FROM messages m
     LEFT JOIN sessions s ON s.id = m.session_id
     WHERE s.id IS NULL AND m.created_at >= ${windowSince}`
  )

  const [samples] = await pool.query(
    `SELECT s.id,
       (SELECT LEFT(m2.content, 160) FROM messages m2
        WHERE m2.session_id = s.id AND m2.role = 'user'
          AND m2.content IS NOT NULL AND TRIM(m2.content) != ''
        ORDER BY m2.created_at ASC LIMIT 1) AS first_user_snippet
     FROM sessions s
     WHERE s.created_at >= ${windowSince}
       AND EXISTS (
         SELECT 1 FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user'
           AND m.content IS NOT NULL AND TRIM(m.content) != ''
       )
     ORDER BY s.created_at DESC
     LIMIT 40`
  )

  const totals = totalsRows[0] || {}
  const orphanCount = Number(orphanRows[0]?.orphan_messages_in_window) || 0

  return {
    days,
    generatedAt: new Date().toISOString(),
    metricDefinitions: CHATBOARD_METRIC_DEFINITIONS,
    dataQuality: {
      orphanMessagesExcluded: true,
      orphanMessagesInWindow: orphanCount,
      statsScope: '仅统计数据库中仍存在的会话；管理端删除会话后刷新即不计入。',
    },
    totals,
    messagesByRole: roleRows || [],
    dailyMessages: dailyMsg || [],
    dailyNewSessions: dailySessions || [],
    sessionsByStep: stepRows || [],
    sessionsByStatus: statusRows || [],
    orderBinding: bindRows[0] || { bound: 0, unbound: 0 },
    userMessageLengthBuckets: lenBuckets || [],
    userMessagesByHour: hourRows || [],
    topSessionsByVolume: (topSessions || []).map((r) => ({
      id: r.id,
      msg_cnt: r.msg_cnt,
      first_user_snippet: (r.first_user_snippet || '').replace(/\s+/g, ' ').trim(),
      session_exists: true,
    })),
    sessionDepth: {
      ...(avgRow[0] || {}),
      scopeNote: CHATBOARD_METRIC_DEFINITIONS.sessionDepth.definition,
    },
    recentFirstUserSnippets: (samples || []).map((r) => ({
      sessionId: r.id,
      snippet: (r.first_user_snippet || '').replace(/\s+/g, ' ').trim(),
    })),
  }
}
