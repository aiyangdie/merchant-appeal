/**
 * 用户管理 AI 对话：自然语言充值、扣款、删除用户等
 */
import React, { useState, useRef, useEffect } from 'react'

const EXAMPLES = [
  '给用户 #1 充值 100 元',
  '扣减用户 #2 余额 50 元',
  '删除用户 #99',
  '给昵称里带「测试」的用户各充值 10 元',
]

export default function UsersAiChat({ adminFetch, showToast, onRefresh, loading: externalBusy }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '你好，我是用户管理助手。每个用户有唯一 ID（如 #12）。\n\n你可以用自然语言：充值/扣款、删除用户（删除需二次确认）、或询问用户列表信息。\n\n示例：「给 #3 充值 200 元」「扣减 #5 余额 30」「删除用户 #8」',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function runPendingDeletes(pendingDeletes) {
    if (!pendingDeletes?.length) return
    const label = pendingDeletes.map((id) => `#${id}`).join(', ')
    if (!confirm(`确认删除用户 ${label}？此操作不可恢复！`)) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: '已取消删除操作。' },
      ])
      return
    }
    try {
      const res = await adminFetch('/api/admin/users/ai-command/confirm-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: pendingDeletes }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '删除失败')
      const lines = (d.executed || []).map((e) => `${e.ok ? '✅' : '❌'} ${e.message}`)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: lines.length ? lines.join('\n') : '删除完成' },
      ])
      showToast?.('用户删除操作已完成')
      onRefresh?.()
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: '❌ ' + e.message }])
      showToast?.('❌ ' + e.message)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || externalBusy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/users/ai-command', {
        method: 'POST',
        body: JSON.stringify({ instruction: text }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '请求失败')

      let assistantText = d.reply || '已完成'
      if (d.executed?.length) {
        const lines = d.executed.map((e) => `${e.ok ? '✅' : e.needsConfirm ? '⚠️' : '❌'} ${e.message}`)
        assistantText += '\n\n' + lines.join('\n')
      }

      setMessages((m) => [...m, { role: 'assistant', text: assistantText }])

      const balanceOk = d.executed?.some((e) => e.ok && e.type === 'adjust_balance')
      if (balanceOk) {
        onRefresh?.()
        showToast?.('用户列表已更新')
      }

      if (d.pendingDeletes?.length) {
        await runPendingDeletes(d.pendingDeletes)
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: '❌ ' + e.message }])
      showToast?.('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[420px] bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-purple-50/50">
        <h3 className="text-sm font-bold text-indigo-800">🤖 AI 用户助手</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">自然语言充值、扣款、删除用户（删除需二次确认）</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 gpu-scroll min-h-[280px] max-h-[50vh]">
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
        {EXAMPLES.map((ex) => (
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
          placeholder={externalBusy ? '加载中，请稍候…' : '如：给 #1 充值 100 元；扣减 #2 余额 50；删除用户 #3…'}
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
