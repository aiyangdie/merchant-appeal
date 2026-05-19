import {
  getRechargeOrders,
  getPendingRechargeCount,
  getOrders,
  getSuccessCases,
  getSchedules,
  getSystemConfigs,
  getUnanalyzedSessions,
} from '../../db.js'
import { getBackupStatus } from '../../backup.js'
import { getMonitorStatus, getAlerts } from '../../monitor.js'

function catalogLines(items, formatter, limit = 80) {
  if (!items?.length) return '（暂无记录）'
  return items.slice(0, limit).map(formatter).join('\n')
}

export async function buildModuleContext(module) {
  switch (module) {
    case 'recharge': {
      const [pending, all] = await Promise.all([
        getRechargeOrders('pending'),
        getRechargeOrders(null),
      ])
      const pendingCount = await getPendingRechargeCount()
      const cat = catalogLines(
        all,
        (o) =>
          `#${o.id} | ¥${parseFloat(o.amount).toFixed(2)} | ${o.status} | ${o.nickname || '-'} | ${o.payment_method || '-'}`
      )
      return { catalog: cat, meta: { pendingCount, total: all.length } }
    }
    case 'orders': {
      const orders = await getOrders({})
      const cat = catalogLines(
        orders,
        (o) =>
          `#${o.id} | ${o.status} | ¥${parseFloat(o.total_amount || o.amount || 0).toFixed(2)} | 用户#${o.user_id || '-'} | ${o.order_no || '-'}`
      )
      return { catalog: cat, meta: { total: orders.length } }
    }
    case 'analytics': {
      const { getAdminAnalytics } = await import('../analyticsStats.js')
      const analytics = await getAdminAnalytics({ days: 30 })
      const summary = {
        days: analytics.days,
        profit: analytics.dashboard?.profitAnalysis,
        tokenSummary: analytics.dashboard?.tokenSummary,
        topUsers: (analytics.dashboard?.topUsers || []).slice(0, 5),
        knowledgeCount: analytics.knowledge?.activeCases,
      }
      return { catalog: JSON.stringify(summary, null, 2), meta: summary }
    }
    case 'knowledge': {
      const cases = await getSuccessCases('active')
      const archived = await getSuccessCases('archived')
      const cat = catalogLines(
        [...cases, ...archived].slice(0, 100),
        (c) => `#${c.id} | ${c.status} | ${c.title || '-'} | ${c.industry || '-'}`
      )
      return { catalog: cat, meta: { active: cases.length, archived: archived.length } }
    }
    case 'ops': {
      const { getOpsScreenPayload, listQuickReplies } = await import('../../opsCenter.js')
      const [screen, replies] = await Promise.all([
        getOpsScreenPayload().catch(() => ({})),
        listQuickReplies().catch(() => []),
      ])
      const replyCat = catalogLines(replies, (r) => `#${r.id} | ${(r.title || '')} ${(r.content || '').slice(0, 50)}`)
      const compact = {
        pendingSessions: screen?.pendingCount,
        todayMessages: screen?.today?.messages,
        quickReplies: replies.length,
      }
      return {
        catalog: `运营快照:\n${JSON.stringify(compact, null, 2)}\n\n快捷回复:\n${replyCat}`,
        meta: compact,
      }
    }
    case 'session-chatboard': {
      const { getSessionChatboardStats } = await import('../chatboardStats.js')
      const days = 14
      const stats = await getSessionChatboardStats({ days })
      return {
        catalog: JSON.stringify(
          { days: stats.days, totals: stats.totals, sessionsByStep: stats.sessionsByStep },
          null,
          2
        ),
        meta: { days },
      }
    }
    case 'tokens': {
      const { getTokenUsageStats } = await import('../../db.js')
      const stats = await getTokenUsageStats()
      return {
        catalog: JSON.stringify(
          { totals: stats.totals, today: stats.today, byType: (stats.byType || []).slice(0, 12) },
          null,
          2
        ),
        meta: {},
      }
    }
    case 'evolution': {
      const unanalyzed = await getUnanalyzedSessions(15)
      const cat = catalogLines(
        unanalyzed,
        (s) => `${s.id?.slice?.(0, 12) || s.id} | 消息${s.message_count || '-'}`
      )
      return { catalog: `未分析会话（节选）:\n${cat}`, meta: { unanalyzedCount: unanalyzed.length } }
    }
    case 'schedule': {
      const schedules = await getSchedules()
      const cat = catalogLines(
        schedules,
        (s) => `#${s.id} | ${s.status} | ${s.title} | ${s.scheduled_time || s.scheduledTime || '-'}`
      )
      return { catalog: cat, meta: { total: schedules.length } }
    }
    case 'backup': {
      const status = getBackupStatus()
      const files = (status.files || []).map(
        (f) => `${f.filename} | ${f.sizeHuman || f.size} | ${f.createdAt || f.mtime}`
      )
      return {
        catalog: files.length ? files.join('\n') : '（暂无备份文件）',
        meta: { fileCount: files.length, isRunning: status.isRunning },
      }
    }
    case 'monitor': {
      const status = getMonitorStatus()
      const alerts = getAlerts(20)
      const alertCat = catalogLines(
        alerts,
        (a) => `${a.id} | ${a.level} | ${a.message?.slice?.(0, 80) || a.title}`
      )
      return {
        catalog: `健康: ${status.summary?.status || '-'}\n告警:\n${alertCat}`,
        meta: { alertCount: alerts.length },
      }
    }
    case 'settings': {
      const configs = await getSystemConfigs()
      const safe = configs
        .filter((c) => !['deepseek_api_key', 'zhipu_api_key', 'siliconflow_api_key', 'xianyu_app_secret'].includes(c.config_key))
        .slice(0, 60)
        .map((c) => `${c.config_key} = ${String(c.config_value || '').slice(0, 80)}`)
      return { catalog: safe.join('\n') || '（无配置）', meta: { count: configs.length } }
    }
    default:
      return { catalog: '（未知模块）', meta: {} }
  }
}
