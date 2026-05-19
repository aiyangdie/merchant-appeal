import {
  confirmRechargeOrder,
  rejectRechargeOrder,
  getUserById,
  updateOrderStatus,
  getOrderById,
  deleteSuccessCase,
  updateSuccessCase,
  createSuccessCase,
  createSchedule,
  deleteSchedule,
  updateSchedule,
  updateSystemConfigs,
} from '../../db.js'
import { logFinancialActivity } from '../financialAudit.js'
import { runBackup, deleteBackupFile } from '../../backup.js'
import { triggerHealthCheck, clearAlerts, acknowledgeAlert } from '../../monitor.js'
import { normalizeIds, normalizeStrings, resolveActionType } from './shared.js'

const SENSITIVE_KEYS = new Set([
  'deepseek_api_key',
  'zhipu_api_key',
  'siliconflow_api_key',
  'xianyu_app_secret',
])

/**
 * @param {string} module
 * @param {object[]} actions
 * @param {{ adminId: number }} ctx
 */
export async function executeModuleActions(module, actions, ctx) {
  const executed = []
  const pendingConfirms = []

  for (const action of actions) {
    try {
      const result = await runOneAction(module, action, ctx, pendingConfirms)
      executed.push(result)
    } catch (err) {
      executed.push({ type: action.type, ok: false, message: err.message || String(err) })
    }
  }

  return { executed, pendingConfirms }
}

async function runOneAction(module, action, ctx = {}, pendingConfirms) {
  const type = resolveActionType(action)
  if (!type) {
    return { type: 'unknown', ok: false, message: 'AI 未指定操作类型，请换种说法或更明确指令' }
  }

  if (module === 'recharge') {
    if (type === 'confirm_recharge') {
      const ids = normalizeIds(action.orderIds)
      const results = []
      for (const id of ids) {
        const order = await confirmRechargeOrder(id, ctx.adminId, action.adminNote || '')
        if (!order) {
          results.push(`#${id} 跳过（不存在或已处理）`)
          continue
        }
        const user = await getUserById(order.user_id)
        if (user) {
          await logFinancialActivity({
            userId: order.user_id,
            type: 'recharge_confirm',
            amount: parseFloat(order.amount),
            balanceAfter: parseFloat(user.balance || 0),
            refId: order.order_no || order.id,
            note: `AI确认充值 ¥${order.amount}`,
          })
        }
        results.push(`#${id} 已确认`)
      }
      return { type, ok: true, message: results.join('；') || '无有效订单' }
    }
    if (type === 'reject_recharge') {
      const ids = normalizeIds(action.orderIds)
      for (const id of ids) {
        await rejectRechargeOrder(id, ctx.adminId, action.adminNote || 'AI拒绝')
      }
      return { type, ok: true, message: `已拒绝 ${ids.length} 笔订单` }
    }
  }

  if (module === 'orders' && type === 'update_order_status') {
    const ids = normalizeIds(action.orderIds)
    const status = String(action.status || '').trim()
    const valid = ['pending', 'paid', 'serving', 'completed', 'cancelled']
    if (!valid.includes(status)) {
      return { type, ok: false, message: `无效状态: ${status}` }
    }
    let n = 0
    for (const id of ids) {
      const o = await getOrderById(id)
      if (!o) continue
      await updateOrderStatus(id, status)
      n++
    }
    return { type, ok: true, message: `已更新 ${n} 个订单为 ${status}` }
  }

  if (module === 'analytics' && type === 'trigger_ai_insights') {
    const days = Math.min(90, Math.max(7, parseInt(action.days, 10) || 30))
    return {
      type,
      ok: true,
      message: `正在生成 ${days} 天 AI 经营洞察…`,
      hint: 'use_analytics_panel',
      days,
    }
  }

  if (module === 'knowledge') {
    if (type === 'create_case' || type === 'generate_case') {
      const title = String(action.title || '').trim()
      const successSummary = String(action.successSummary || action.success_summary || '').trim()
      const hasDirectFields = title && successSummary

      if (hasDirectFields) {
        const id = await createSuccessCase({
          sessionId: action.sessionId || null,
          title,
          industry: action.industry || '',
          problemType: action.problemType || action.problem_type || '',
          collectedData: action.collectedData || {},
          reportContent: action.reportContent || action.report_content || '',
          successSummary,
          adminNotes: action.adminNotes || action.admin_notes || '',
        })
        return { type, ok: true, message: `已创建案例 #${id}：${title}` }
      }

      const instruction =
        String(action.instruction || action.description || ctx.instruction || '').trim() || title
      if (!instruction) {
        return { type, ok: false, message: '请说明要生成的案例内容（行业、违规类型、成功要点等）' }
      }
      const { generateAndCreateKnowledgeCase } = await import('./knowledgeGenerate.js')
      const created = await generateAndCreateKnowledgeCase(instruction, ctx)
      return {
        type,
        ok: true,
        message: `已 AI 生成并入库案例 #${created.id}：${created.title}`,
      }
    }
    if (type === 'delete_case') {
      const ids = normalizeIds(action.caseIds)
      if (!ids.length) return { type, ok: false, message: '未指定案例 ID' }
      pendingConfirms.push({ kind: 'delete_case', ids })
      return { type, ok: false, needsConfirm: true, message: `待确认删除案例: ${ids.map((i) => `#${i}`).join(', ')}` }
    }
    if (type === 'archive_case') {
      const ids = normalizeIds(action.caseIds)
      for (const id of ids) await updateSuccessCase(id, { status: 'archived' })
      return { type, ok: true, message: `已归档 ${ids.length} 个案例` }
    }
  }

  if (module === 'ops') {
    if (type === 'create_quick_reply') {
      const text = String(action.text || '').trim()
      if (!text) return { type, ok: false, message: '快捷回复内容为空' }
      const { saveQuickReply } = await import('../../opsCenter.js')
      await saveQuickReply({ title: text.slice(0, 40), content: text })
      return { type, ok: true, message: '已添加快捷回复' }
    }
    if (type === 'delete_quick_reply') {
      const ids = normalizeIds(action.replyIds)
      if (!ids.length) return { type, ok: false, message: '未指定快捷回复 ID' }
      pendingConfirms.push({ kind: 'delete_quick_reply', ids })
      return { type, ok: false, needsConfirm: true, message: `待确认删除快捷回复: ${ids.map((i) => `#${i}`).join(', ')}` }
    }
  }

  if (module === 'session-chatboard' && type === 'trigger_chatboard_brief') {
    const days = Math.min(90, Math.max(1, parseInt(action.days, 10) || 14))
    return {
      type,
      ok: true,
      message: `已请求生成 ${days} 天会话简报，请在会话看板页查看「AI 简报」`,
      hint: 'use_chatboard_brief',
      days,
    }
  }

  if (module === 'tokens' && type === 'trigger_token_analyze') {
    const days = Math.min(90, Math.max(7, parseInt(action.days, 10) || 14))
    return {
      type,
      ok: true,
      message: `已请求 Token AI 分析（${days} 天），请在拓客明细页查看报告`,
      hint: 'use_token_analyze',
      days,
    }
  }

  if (module === 'evolution') {
    const { batchAnalyzeConversations, aggregateDailyMetrics, autoPromoteRules, evaluateRuleEffectiveness } =
      await import('../../evolution.js')
    if (type === 'batch_analyze') {
      const limit = parseInt(action.limit, 10) || 10
      const count = await batchAnalyzeConversations(limit)
      return { type, ok: true, message: `批量分析完成，处理 ${count} 个会话` }
    }
    if (type === 'aggregate_metrics') {
      await aggregateDailyMetrics()
      return { type, ok: true, message: '学习指标日聚合已完成' }
    }
    if (type === 'auto_promote') {
      const r = await autoPromoteRules()
      return { type, ok: true, message: `规则升降级完成: ${JSON.stringify(r).slice(0, 120)}` }
    }
    if (type === 'evaluate_rules') {
      await evaluateRuleEffectiveness()
      return { type, ok: true, message: '规则效果评估已完成' }
    }
  }

  if (module === 'schedule') {
    if (type === 'create_schedule') {
      const title = String(action.title || action.name || '').trim()
      const scheduledTime = String(
        action.scheduledTime || action.scheduled_time || action.time || action.datetime || ''
      ).trim()
      if (!title || !scheduledTime) return { type, ok: false, message: '标题和时间为必填' }
      const id = await createSchedule({
        title,
        scheduledTime,
        description: action.description || '',
        type: action.scheduleType || action.reminderType || 'reminder',
        status: 'pending',
      })
      return { type, ok: true, message: `已创建日程 #${id}` }
    }
    if (type === 'delete_schedule') {
      const ids = normalizeIds(action.scheduleIds || action.schedule_ids || action.ids)
      if (!ids.length) return { type, ok: false, message: '未指定日程 ID' }
      pendingConfirms.push({ kind: 'delete_schedule', ids })
      return { type, ok: false, needsConfirm: true, message: `待确认删除日程: ${ids.map((i) => `#${i}`).join(', ')}` }
    }
    if (type === 'complete_schedule') {
      const ids = normalizeIds(action.scheduleIds || action.schedule_ids || action.ids)
      for (const id of ids) await updateSchedule(id, { status: 'completed' })
      return { type, ok: true, message: `已标记 ${ids.length} 个日程为完成` }
    }
  }

  if (module === 'backup') {
    if (type === 'run_backup') {
      const result = await runBackup({ type: 'manual' })
      return { type, ok: true, message: `备份完成: ${result.filename || result.message || '成功'}` }
    }
    if (type === 'delete_backup') {
      const fn = String(action.filename || '').trim()
      if (!fn) return { type, ok: false, message: '未指定备份文件名' }
      pendingConfirms.push({ kind: 'delete_backup', filenames: [fn] })
      return { type, ok: false, needsConfirm: true, message: `待确认删除备份: ${fn}` }
    }
  }

  if (module === 'monitor') {
    if (type === 'health_check') {
      await triggerHealthCheck()
      return { type, ok: true, message: '健康检测已执行' }
    }
    if (type === 'clear_alerts') {
      const n = clearAlerts()
      return { type, ok: true, message: `已清空 ${n} 条告警` }
    }
    if (type === 'acknowledge_alert') {
      const id = String(action.alertId || '').trim()
      const ok = acknowledgeAlert(id)
      return { type, ok, message: ok ? `已确认告警 ${id}` : `未找到告警 ${id}` }
    }
  }

  if (module === 'settings' && type === 'update_setting') {
    const key = String(action.key || action.config_key || '').trim()
    const value = action.value != null ? String(action.value) : ''
    if (!key) return { type, ok: false, message: '未指定配置键' }
    if (SENSITIVE_KEYS.has(key)) {
      return { type, ok: false, message: `${key} 为敏感密钥，请在系统设置页手动修改` }
    }
    await updateSystemConfigs([{ config_key: key, config_value: value }])
    return { type, ok: true, message: `已更新 ${key}` }
  }

  return { type: type || 'unknown', ok: false, message: `未知操作类型: ${type}` }
}

export async function executeConfirmedAction(kind, payload, ctx) {
  const executed = []
  if (kind === 'delete_case') {
    for (const id of payload.ids || []) {
      await deleteSuccessCase(id)
      executed.push({ ok: true, message: `案例 #${id} 已删除` })
    }
  } else if (kind === 'delete_schedule') {
    for (const id of payload.ids || []) {
      await deleteSchedule(id)
      executed.push({ ok: true, message: `日程 #${id} 已删除` })
    }
  } else if (kind === 'delete_backup') {
    for (const fn of payload.filenames || []) {
      const r = deleteBackupFile(fn)
      executed.push({ ok: r.success, message: r.success ? `已删除 ${fn}` : r.error || '删除失败' })
    }
  } else if (kind === 'delete_quick_reply') {
    const { deleteQuickReply } = await import('../../opsCenter.js')
    for (const id of payload.ids || []) {
      await deleteQuickReply(id)
      executed.push({ ok: true, message: `快捷回复 #${id} 已删除` })
    }
  }
  if (!executed.length) {
    throw new Error(`未知的确认类型: ${kind}`)
  }
  return executed
}

/** 服务端直接触发重型 AI 任务（供路由或后续扩展） */
export async function runHeavyAiTask(module, action) {
  const { getAIConfig } = await import('../../shared/aiConfig.js')
  const cfg = await getAIConfig()
  if (!cfg?.apiKey) throw new Error('AI 未配置')

  if (module === 'analytics' && action.type === 'trigger_ai_insights') {
    const { getAdminAnalytics } = await import('../analyticsStats.js')
    const days = action.days || 30
    const analytics = await getAdminAnalytics({ days })
    return { triggered: true, module, days, note: '完整洞察请使用数据分析页按钮' }
  }
  return null
}
