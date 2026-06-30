/**
 * 统一字段提取与应用（收集阶段 + 收集完成后均生效）
 */
import { logFieldChange } from './db.js'
import { applyMessageExtractions } from './dueDiligence.js'
import { expandOnlineChannels } from './onlineChannels.js'
import {
  extractFieldsFromMessage,
  getAllCollectFields,
  getCollectionTotalSteps,
  findNextUnfilledStep,
} from './localAI.js'

export const FIELD_VALIDATORS = {
  merchant_id: v => /^1\d{9}$/.test(v.replace(/\s/g, '')),
  legal_id_last4: v => /^\d{3}[\dxX]$/.test(v.replace(/\s/g, '')),
  bank_account_last4: v => /^\d{4}$/.test(v.replace(/\s/g, '')),
  contact_phone: v => /^1[3-9]\d{9}$/.test(v.replace(/[\s\-]/g, '')),
  license_no: v => /^[0-9A-Z]{15,18}$/i.test(v.replace(/\s/g, '')),
  business_model: v => v.length <= 30,
  problem_type: v => v.length <= 40,
  industry: v => v.length <= 30,
  violation_reason: v => v.length <= 80,
  merchant_name: v => v.length <= 50,
  company_name: v => v.length <= 50 && !/^(就是|哎呀|那个|反正)/.test(v),
  legal_name: v => v.length >= 2 && v.length <= 10 && /^[\u4e00-\u9fff·]+$/.test(v),
  bank_name: v => v.length <= 20 && /银行|信用社|支付宝|财付通/.test(v) && !/[？?怎么吗呢呀吧]/.test(v),
  complaint_status: v => v.length <= 50 && !/[？?]$/.test(v.trim()),
  refund_policy: v => v.length <= 80 && !/[？?]$/.test(v.trim()),
  appeal_history: v => v.length <= 60 && !/[？?]$/.test(v.trim()),
  order_info: v => v.length <= 3000 && /420000/.test(v),
  wechat_orders: v => { try { const p = JSON.parse(v); return Array.isArray(p) && p.length > 0 } catch { return false } },
  channel: v => v.length <= 60,
  content_delivery_method: v => v.length <= 200,
  dd_deadline: v => /^\d{4}-\d{2}-\d{2}/.test(v),
  scenario_type: v => v.length <= 30,
  miniprogram_appid: v => /^wx[a-z0-9]{16}$/i.test(v.replace(/\s/g, '')),
  oa_id: v => /^wx[a-z0-9]{16}$/i.test(v.replace(/\s/g, '')),
  miniprogram_name: v => v.length <= 40,
  oa_name: v => v.length <= 40,
  website_url: v => v.length <= 200,
  website_name: v => v.length <= 40,
  website_icp: v => v.length <= 40,
}

const DD_FIELD_DEFS = [
  { key: 'order_info', label: '交易订单', group: '交易订单', icon: '🧾' },
  { key: 'channel', label: '经营渠道', group: '经营场景', icon: '📱' },
  { key: 'dd_deadline', label: '尽调截止时间', group: '尽调信息', icon: '⏰' },
  { key: 'scenario_type', label: '场景类型', group: '尽调信息', icon: '📋' },
]

function shouldUpdateField(key, existing, newVal, { correction = false } = {}) {
  if (correction) return true
  if (!existing || existing === '用户暂未提供' || existing === '⏳待补充') return true
  // 商户号：新值是10位且旧值不对 → 允许更正
  if (key === 'merchant_id' && /^1\d{9}$/.test(newVal) && existing !== newVal) return true
  return false
}

export async function applyValidatedFieldUpdates(sessionId, updatedData, extracted, options = {}) {
  const { correction = false, source = 'ai_extract' } = options
  const updates = []
  const allFieldDefs = [...getAllCollectFields(updatedData), ...DD_FIELD_DEFS]

  for (const [key, value] of Object.entries(extracted)) {
    if (key.startsWith('_') || value == null || value === '') continue
    let fieldDef = allFieldDefs.find(f => f.key === key)
    if (!fieldDef && key && value) {
      const v = String(value).trim()
      if (v.length > 0 && v.length <= 200) fieldDef = { key, label: key, group: '补充信息', icon: '📌', dynamic: true }
    }
    if (!fieldDef) continue
    const v = String(value).trim()
    if (!v) continue
    const validator = FIELD_VALIDATORS[key]
    if (validator && !validator(v)) continue
    const existing = updatedData[key]
    if (!shouldUpdateField(key, existing, v, { correction })) continue

    const oldVal = existing || ''
    const logSource = (existing && existing !== '用户暂未提供' && existing !== '⏳待补充' && source === 'ai_extract') ? 'ai_correction' : source
    const reason = logSource === 'ai_correction'
      ? `将"${fieldDef.label}"从"${oldVal}"更正为"${v}"`
      : logSource === 'regex_extract'
        ? `系统从用户消息中识别并提取了"${fieldDef.label}"`
        : `AI从用户对话中识别并提取了"${fieldDef.label}"`
    logFieldChange(sessionId, key, fieldDef.label, oldVal, v, logSource, reason).catch(() => {})
    updatedData[key] = v
    updates.push({ key, label: fieldDef.label, value: v, group: fieldDef.group || '补充信息', icon: fieldDef.icon || '📌' })
  }
  return updates
}

/**
 * 从用户消息提取并写入 session（规则引擎，不消耗 AI）
 */
export async function runRuleFieldExtractions(sessionId, userMessage, collectedData = {}) {
  const updatedData = { ...collectedData }

  const chExp = expandOnlineChannels(updatedData, userMessage)
  if (chExp.channels.length) {
    updatedData._online_channels = chExp.channels
    updatedData._channel_fields = chExp.allChannelFields
    if (chExp.channelTip) updatedData._channel_tip = chExp.channelTip
  }

  const localPatches = extractFieldsFromMessage(userMessage, updatedData)
  const ddPatches = applyMessageExtractions(userMessage, updatedData)
  const merged = { ...localPatches, ...ddPatches }

  const updates = await applyValidatedFieldUpdates(sessionId, updatedData, merged, { source: 'regex_extract' })
  const step = findNextUnfilledStep(0, updatedData)
  const totalSteps = getCollectionTotalSteps(updatedData)

  return { updatedData, updates, channelExpansion: chExp, step, totalSteps }
}

/** 判断 collected_data 是否有实质变更（含 _ 前缀内部字段） */
export function collectedDataChanged(before = {}, after = {}) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

export function notifyFieldUpdates(safeSend, updates, step, totalSteps, progress = null) {
  for (const upd of updates) {
    if (upd.key === 'wechat_orders') continue
    safeSend(`data: ${JSON.stringify({ type: 'info_update', ...upd, step, totalSteps, progress })}\n\n`)
  }
}

export function notifyChannelFields(safeSend, chExp, step, totalSteps) {
  for (const df of chExp.newFields || []) {
    safeSend(`data: ${JSON.stringify({
      type: 'info_update',
      key: df.key,
      label: df.label,
      value: '',
      group: df.group || df.channelLabel,
      icon: df.icon || '📱',
      step,
      totalSteps,
      dynamic: true,
      channel: df.channel,
    })}\n\n`)
  }
}
