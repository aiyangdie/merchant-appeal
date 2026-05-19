/**
 * 通用管理后台 AI 对话（按 module 调用 /api/admin/ai-command）
 */
import React, { useState, useRef, useEffect } from 'react'
import { ADMIN_AI_MODULE_CONFIG } from '../config/adminAiModules.js'

const CONFIRM_LABELS = {
  delete_case: '案例',
  delete_schedule: '日程',
  delete_backup: '备份文件',
  delete_quick_reply: '快捷回复',
}

function getModuleConfig(module) {
  const entry = Object.entries(ADMIN_AI_MODULE_CONFIG).find(
    ([key, c]) => key === module || c.module === module
  )
  if (entry) return entry[1]
  return { title: module, examples: [] }
}

function replaceLastAssistant(setMessages, text) {
  setMessages((m) => {
    const next = [...m]
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].role === 'assistant' && next[i]._pending) {
        next[i] = { role: 'assistant', text }
        return next
      }
    }
    return [...m, { role: 'assistant', text }]
  })
}

async function runHeavyHints(adminFetch, executed, setMessages) {
  for (const e of executed || []) {
    if (!e.ok || !e.hint) continue
    try {
      if (e.hint === 'use_analytics_panel') {
        setMessages((m) => [...m, { role: 'assistant', text: '⏳ 正在生成数据分析 AI 洞察…', _pending: true }])
        const res = await adminFetch('/api/admin/analytics/ai-insights', {
          method: 'POST',
          body: JSON.stringify({ days: e.days || 30 }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || '生成失败')
        replaceLastAssistant(
          setMessages,
          '✅ AI 洞察已生成。\n\n' +
            (d.markdown || '').slice(0, 800) +
            (d.markdown?.length > 800 ? '\n…' : '')
        )
      }
      if (e.hint === 'use_chatboard_brief') {
        setMessages((m) => [...m, { role: 'assistant', text: '⏳ 正在生成会话看板简报…', _pending: true }])
        const res = await adminFetch('/api/admin/sessions/chatboard/brief', {
          method: 'POST',
          body: JSON.stringify({ days: e.days || 14 }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || '生成失败')
        replaceLastAssistant(
          setMessages,
          '✅ 会话简报已生成。\n\n' +
            (d.markdown || '').slice(0, 800) +
            (d.markdown?.length > 800 ? '\n…' : '')
        )
      }
      if (e.hint === 'use_token_analyze') {
        setMessages((m) => [...m, { role: 'assistant', text: '⏳ 正在生成 Token 监管报告…', _pending: true }])
        const res = await adminFetch('/api/admin/token-usage/ai-analyze', {
          method: 'POST',
          body: JSON.stringify({ days: e.days || 14 }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || '生成失败')
        replaceLastAssistant(
          setMessages,
          '✅ Token 分析报告已生成。\n\n' +
            (d.markdown || '').slice(0, 800) +
            (d.markdown?.length > 800 ? '\n…' : '')
        )
      }
    } catch (err) {
      replaceLastAssistant(setMessages, '❌ 后台任务失败: ' + err.message)
    }
  }
}

export default function AdminAiChat({
  module,
  adminFetch,
  commandFetch,
  showToast,
  onRefresh,
  onMutationSuccess,
  loading: externalBusy,
  compact = false,
  welcomeText,
  examplePrompts,
  suppressSuccessToast = false,
}) {
  const cfg = getModuleConfig(module)
  const examples = examplePrompts?.length ? examplePrompts : cfg.examples || []
  const fetchAi = commandFetch || adminFetch

  const defaultWelcome =
    welcomeText ||
    `你好，我是「${cfg.title || module}」AI 助手。你可以用自然语言查询或操作当前模块。\n\n危险操作（删除等）需要二次确认。`

  const [messages, setMessages] = useState([{ role: 'assistant', text: defaultWelcome }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function runPendingUserDeletes(pendingDeletes) {
    if (!pendingDeletes?.length) return false
    const label = pendingDeletes.map((id) => `#${id}`).join(', ')
    if (!confirm(`确认删除用户 ${label}？此操作不可恢复！`)) {
      setMessages((m) => [...m, { role: 'assistant', text: '已取消删除用户。' }])
      return false
    }
    try {
      const res = await adminFetch('/api/admin/users/ai-command/confirm-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: pendingDeletes }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '删除失败')
      const lines = (d.executed || []).map((e) => `${e.ok ? '✅' : '❌'} ${e.message}`)
      setMessages((m) => [...m, { role: 'assistant', text: lines.join('\n') || '删除完成' }])
      showToast?.('用户删除操作已完成')
      onRefresh?.()
      return true
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: '❌ ' + e.message }])
      showToast?.('❌ ' + e.message)
      return false
    }
  }

  async function runPendingConfirms(pendingConfirms) {
    if (!pendingConfirms || typeof pendingConfirms !== 'object') return
    let refreshed = false
    for (const [kind, ids] of Object.entries(pendingConfirms)) {
      if (!ids?.length) continue
      const label = CONFIRM_LABELS[kind] || kind
      const desc =
        kind === 'delete_backup' ? ids.join(', ') : ids.map((id) => `#${id}`).join(', ')
      if (!confirm(`确认删除${label} ${desc}？此操作可能不可恢复。`)) {
        setMessages((m) => [...m, { role: 'assistant', text: `已取消删除${label}。` }])
        continue
      }
      const payload = kind === 'delete_backup' ? { filenames: ids } : { ids }
      try {
        const res = await adminFetch('/api/admin/ai-command/confirm', {
          method: 'POST',
          body: JSON.stringify({ module, kind, payload }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || '确认失败')
        const lines = (d.executed || []).map((e) => `${e.ok !== false ? '✅' : '❌'} ${e.message}`)
        setMessages((m) => [...m, { role: 'assistant', text: lines.join('\n') || '操作完成' }])
        refreshed = true
      } catch (e) {
        setMessages((m) => [...m, { role: 'assistant', text: '❌ ' + e.message }])
      }
    }
    if (refreshed) {
      showToast?.('列表已更新')
      onRefresh?.()
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || externalBusy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await fetchAi('/api/admin/ai-command', {
        method: 'POST',
        body: JSON.stringify({ module, instruction: text }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '请求失败')

      let assistantText = d.reply || '已完成'
      if (d.executed?.length) {
        const lines = d.executed.map(
          (e) => `${e.ok ? '✅' : e.needsConfirm ? '⚠️' : '❌'} ${e.message}`
        )
        assistantText += '\n\n' + lines.join('\n')
      }
      setMessages((m) => [...m, { role: 'assistant', text: assistantText }])

      const needsRefresh = d.executed?.some((e) => e.ok && !e.hint)
      if (needsRefresh) {
        if (onMutationSuccess) onMutationSuccess()
        else {
          onRefresh?.()
          if (!suppressSuccessToast) showToast?.('操作已完成')
        }
      }

      if (d.pendingConfirms) {
        await runPendingConfirms(d.pendingConfirms)
      }
      if (d.pendingDeletes?.length) {
        await runPendingUserDeletes(d.pendingDeletes)
      }

      await runHeavyHints(adminFetch, d.executed, setMessages)
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: '❌ ' + e.message }])
      showToast?.('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const minH = compact ? 'min-h-[280px]' : 'min-h-[420px]'

  return (
    <div className={`flex flex-col ${minH} bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden`}>
      <div className="px-4 py-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-purple-50/50">
        <h3 className="text-sm font-bold text-indigo-800">
          🤖 AI · {module === 'global' ? '全能助手' : cfg.title || module}
        </h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {module === 'global' ? '自然语言控制整个管理后台' : '自然语言查询与操作本模块'}
        </p>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 gpu-scroll ${compact ? 'min-h-[160px] max-h-[36vh]' : 'min-h-[280px] max-h-[50vh]'}`}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-indigo-500 animate-pulse px-2">AI 正在理解并执行指令…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading || externalBusy}
            onClick={() => setInput(ex)}
            className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
          >
            {ex.length > 28 ? ex.slice(0, 28) + '…' : ex}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          disabled={loading || externalBusy}
          rows={2}
          placeholder={externalBusy ? '加载中…' : '用自然语言描述你想做的操作…'}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || externalBusy || !input.trim()}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 self-end"
        >
          {loading ? '…' : '发送'}
        </button>
      </div>
    </div>
  )
}
