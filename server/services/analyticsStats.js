import { getPool } from '../db/init.js'
import { getDashboardStats } from '../db.js'
import { getSessionChatboardStats } from './chatboardStats.js'

/**
 * 管理端数据分析：合并仪表盘、会话看板、行为与 Token 维度（指定天数窗口）
 */
export async function getAdminAnalytics(opts = {}) {
  const days = Math.min(Math.max(parseInt(String(opts.days || 30), 10) || 30, 7), 90)
  const pool = getPool()
  const windowSince = `DATE_SUB(NOW(), INTERVAL ${days} DAY)`

  const [dashboard, chatboard] = await Promise.all([
    getDashboardStats(),
    getSessionChatboardStats({ days: Math.min(days, 30) }).catch(() => null),
  ])

  const [actionBreakdown] = await pool.query(
    `SELECT a.action, COUNT(*) AS cnt
     FROM user_actions a
     WHERE a.created_at >= ${windowSince}
     GROUP BY a.action
     ORDER BY cnt DESC
     LIMIT 20`
  )

  const [dailySessions] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
     FROM sessions WHERE created_at >= ${windowSince}
     GROUP BY DATE(created_at) ORDER BY day ASC`
  )

  const [dailyMessages] = await pool.query(
    `SELECT DATE(m.created_at) AS day, COUNT(*) AS cnt
     FROM messages m
     INNER JOIN sessions s ON s.id = m.session_id
     WHERE m.created_at >= ${windowSince}
     GROUP BY DATE(m.created_at) ORDER BY day ASC`
  )

  const [dailyNewUsers] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
     FROM users WHERE created_at >= ${windowSince}
     GROUP BY DATE(created_at) ORDER BY day ASC`
  )

  const [dailyRecharge] = await pool.query(
    `SELECT DATE(confirmed_at) AS day, COALESCE(SUM(amount), 0) AS revenue, COUNT(*) AS orders
     FROM recharge_orders
     WHERE status = 'confirmed' AND confirmed_at >= ${windowSince}
     GROUP BY DATE(confirmed_at) ORDER BY day ASC`
  )

  const [tokenWindow] = await pool.query(
    `SELECT
       COUNT(*) AS requests,
       COALESCE(SUM(input_tokens), 0) AS input_tokens,
       COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(total_tokens), 0) AS total_tokens,
       COALESCE(SUM(cost), 0) AS user_cost,
       SUM(CASE WHEN user_id = 0 THEN 1 ELSE 0 END) AS system_requests,
       SUM(CASE WHEN user_id > 0 THEN 1 ELSE 0 END) AS user_requests
     FROM token_usage
     WHERE created_at >= ${windowSince}`
  )

  const [tokenByTypeWindow] = await pool.query(
    `SELECT type,
       COUNT(*) AS cnt,
       COALESCE(SUM(input_tokens), 0) AS input_tokens,
       COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(total_tokens), 0) AS tokens,
       COALESCE(SUM(cost), 0) AS cost
     FROM token_usage
     WHERE created_at >= ${windowSince}
     GROUP BY type
     ORDER BY tokens DESC`
  )

  const [[caseStats]] = await pool.query(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
     FROM success_cases`
  )

  const [[deepStats]] = await pool.query(
    `SELECT COUNT(*) AS sessions_with_deep
     FROM sessions
     WHERE deep_analysis_result IS NOT NULL AND TRIM(deep_analysis_result) != ''`
  )

  const tw = tokenWindow[0] || {}
  const inputTok = parseInt(tw.input_tokens, 10) || 0
  const outputTok = parseInt(tw.output_tokens, 10) || 0
  const aiCostWindow = (inputTok / 1000) * 0.001 + (outputTok / 1000) * 0.002

  return {
    days,
    generatedAt: new Date().toISOString(),
    dashboard,
    chatboard: chatboard
      ? {
          totals: chatboard.totals,
          metricDefinitions: chatboard.metricDefinitions,
          sessionsByStep: chatboard.sessionsByStep,
          orderBinding: chatboard.orderBinding,
        }
      : null,
    window: {
      dailySessions: dailySessions || [],
      dailyMessages: dailyMessages || [],
      dailyNewUsers: dailyNewUsers || [],
      dailyRecharge: dailyRecharge || [],
      actionBreakdown: actionBreakdown || [],
    },
    tokenWindow: {
      ...tw,
      aiCostEstimate: aiCostWindow,
      userCost: parseFloat(tw.user_cost || 0),
    },
    tokenByTypeWindow: tokenByTypeWindow || [],
    knowledge: {
      totalCases: parseInt(caseStats?.total, 10) || 0,
      activeCases: parseInt(caseStats?.active, 10) || 0,
    },
    product: {
      sessionsWithDeepAnalysis: parseInt(deepStats?.sessions_with_deep, 10) || 0,
    },
  }
}
