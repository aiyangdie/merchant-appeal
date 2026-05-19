/**
 * 用户管理自然语言指令：充值、扣款、删除用户等
 */
import { getAIConfig } from '../shared/aiConfig.js'
import { getAllUsers, getUserById, adjustUserBalance, deleteUser } from '../db.js'
import { logFinancialActivity } from './financialAudit.js'

function buildUserCatalog(users) {
  if (!users.length) return '（当前无任何用户）'
  return users
    .slice(0, 120)
    .map((u) => {
      const phone = u.phone_masked || u.phone || '-'
      const nick = u.nickname || '-'
      const bal = parseFloat(u.balance || 0).toFixed(2)
      return `#${u.id} | ${phone} | ${nick} | 余额¥${bal} | 消费¥${parseFloat(u.total_spent || 0).toFixed(2)}`
    })
    .join('\n')
}

function parseAiJson(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const text = jsonMatch ? jsonMatch[0] : raw
  return JSON.parse(text)
}

function normalizeUserIds(raw) {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return [...new Set(list.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))]
}

/**
 * @param {string} instruction 管理员自然语言指令
 * @returns {Promise<{ reply: string, executed: object[], pendingDeletes?: number[] }>}
 */
export async function executeUserAiCommand(instruction) {
  if (!instruction?.trim()) {
    return { reply: '请输入指令', executed: [] }
  }

  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    return { reply: 'AI 服务未配置，请先在系统设置中配置模型', executed: [] }
  }

  const users = await getAllUsers()
  const catalog = buildUserCatalog(users)

  const systemPrompt = `你是商户申诉平台「用户管理」助手。管理员用自然语言管理用户，每个用户有唯一数字 ID（目录中的 #id）。

## 当前用户目录（id | 手机号脱敏 | 昵称 | 余额 | 总消费）
${catalog}

## 输出格式（仅 JSON，无其它文字）
{
  "reply": "给管理员的中文回复",
  "actions": [
    { "type": "adjust_balance", "userIds": [1], "amount": 100, "balanceType": "add", "note": "管理员充值" },
    { "type": "adjust_balance", "userIds": [2, 3], "amount": 50, "balanceType": "deduct", "note": "扣款" },
    { "type": "delete_user", "userIds": [5] }
  ]
}

## 规则
1. userIds 必须来自目录中存在的 id；可按昵称、手机号片段、#id 匹配（如「用户 #3」「给 id 5 充值」）。
2. balanceType：add = 充值/增加余额；deduct = 扣款/扣除余额。amount 为正数。
3. 删除用户 → delete_user，只填 userIds，不要自行执行其它危险操作。
4. 查询类问题（如「谁余额最高」）→ actions 为空，在 reply 中根据目录回答。
5. 无法执行时 actions 为空，在 reply 说明原因。
6. 不要编造不存在的用户 id。`

  const aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction.trim() },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '')
    return { reply: `AI 调用失败: ${aiRes.status} ${errText.slice(0, 120)}`, executed: [] }
  }

  const data = await aiRes.json()
  const raw = data.choices?.[0]?.message?.content || ''

  let plan
  try {
    plan = parseAiJson(raw)
  } catch {
    return { reply: 'AI 返回格式无法解析，请换种说法重试', executed: [], raw: raw.slice(0, 500) }
  }

  const executed = []
  const pendingDeletes = []
  const actions = Array.isArray(plan.actions) ? plan.actions : []

  for (const action of actions) {
    if (action.type === 'delete_user') {
      const ids = normalizeUserIds(action.userIds)
      if (!ids.length) {
        executed.push({ type: 'delete_user', ok: false, message: '未指定要删除的用户 ID' })
        continue
      }
      const valid = []
      for (const id of ids) {
        const u = await getUserById(id)
        if (u) valid.push(id)
      }
      if (!valid.length) {
        executed.push({ type: 'delete_user', ok: false, message: '未找到对应用户' })
        continue
      }
      pendingDeletes.push(...valid)
      executed.push({
        type: 'delete_user',
        ok: false,
        needsConfirm: true,
        userIds: valid,
        message: `待确认：删除用户 #${valid.join(', #')}（需在界面确认）`,
      })
      continue
    }

    if (action.type === 'adjust_balance') {
      const ids = normalizeUserIds(action.userIds)
      const amount = Math.abs(parseFloat(action.amount))
      const balanceType = action.balanceType === 'deduct' ? 'deduct' : 'add'
      if (!ids.length || !amount || !Number.isFinite(amount)) {
        executed.push({ type: 'adjust_balance', ok: false, message: '缺少用户 ID 或有效金额' })
        continue
      }
      const delta = balanceType === 'deduct' ? -amount : amount
      const label = balanceType === 'deduct' ? '扣款' : '充值'
      for (const id of ids) {
        try {
          const before = await getUserById(id)
          if (!before) {
            executed.push({ type: 'adjust_balance', ok: false, userId: id, message: `用户 #${id} 不存在` })
            continue
          }
          const user = await adjustUserBalance(id, delta)
          const note = action.note || `管理员AI指令${label}`
          await logFinancialActivity({
            userId: id,
            type: balanceType === 'deduct' ? 'admin_deduct' : 'admin_recharge',
            amount: delta,
            balanceAfter: parseFloat(user.balance || 0),
            refId: 'user_ai_command',
            note,
          })
          executed.push({
            type: 'adjust_balance',
            ok: true,
            userId: id,
            message: `用户 #${id} ${label} ¥${amount.toFixed(2)}，当前余额 ¥${parseFloat(user.balance || 0).toFixed(2)}`,
            balanceType,
            amount,
          })
        } catch (e) {
          executed.push({ type: 'adjust_balance', ok: false, userId: id, message: e.message })
        }
      }
      continue
    }

    executed.push({ type: action.type || 'unknown', ok: false, message: '未知操作类型' })
  }

  return {
    reply: plan.reply || '指令已处理',
    executed,
    pendingDeletes: pendingDeletes.length ? [...new Set(pendingDeletes)] : undefined,
  }
}

/**
 * 确认并执行待删除用户（前端二次确认后调用）
 */
export async function executePendingUserDeletes(userIds) {
  const ids = normalizeUserIds(userIds)
  const executed = []
  for (const id of ids) {
    try {
      const u = await getUserById(id)
      if (!u) {
        executed.push({ type: 'delete_user', ok: false, userId: id, message: `用户 #${id} 不存在` })
        continue
      }
      await deleteUser(id)
      executed.push({ type: 'delete_user', ok: true, userId: id, message: `已删除用户 #${id}` })
    } catch (e) {
      executed.push({ type: 'delete_user', ok: false, userId: id, message: e.message })
    }
  }
  return { executed }
}
