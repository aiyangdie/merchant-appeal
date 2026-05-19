/**
 * 商城 AI 对话：自然语言创建/上架/下架商品，或触发自动生成任务
 */
import React, { useState, useRef, useEffect } from 'react'

const EXAMPLES = [
  '把商品 #2 和 #3 上架',
  '下架所有草稿商品',
  '创建一个「微信支付申诉加急包」，售价 199 元，先保存为草稿',
  '根据最近用户对话自动生成一批商品',
]

export default function MallAiChat({ adminFetch, showToast, onRefresh, onTriggerAutoGenerate, jobBusy }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '你好，我是商城管理助手。你可以用自然语言操作商品（每个商品有唯一 ID，如 #12）。\n\n例如：上架/下架指定商品、批量操作、描述新商品并创建、或触发「根据对话分析自动生成商品」。',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || jobBusy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/mall/products/ai-command', {
        method: 'POST',
        body: JSON.stringify({ instruction: text }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '请求失败')
      // #region agent log
      fetch('http://localhost:7822/ingest/018bf018-a48c-4eaa-9127-55349663cb6a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'48900f'},body:JSON.stringify({sessionId:'48900f',location:'MallAiChat:handleSend',message:'ai-command ok',data:{triggerAutoGenerate:!!d.triggerAutoGenerate,executedTypes:(d.executed||[]).map(e=>e.type)},hypothesisId:'H-FE-chat',timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      let assistantText = d.reply || '已完成'
      if (d.executed?.length) {
        const lines = d.executed.map((e) => `${e.ok ? '✅' : '❌'} ${e.message}`)
        assistantText += '\n\n' + lines.join('\n')
      }

      setMessages((m) => [...m, { role: 'assistant', text: assistantText, executed: d.executed }])

      if (d.executed?.some((e) => e.ok && (e.type === 'set_status' || e.type === 'create_product'))) {
        onRefresh?.()
        showToast?.('商品列表已更新')
      }
      if (d.triggerAutoGenerate) {
        setMessages((m) => {
          const last = m[m.length - 1]
          if (last?.role === 'assistant' && !last.text.includes('进度弹窗')) {
            return [
              ...m.slice(0, -1),
              {
                ...last,
                text: `${last.text}\n\n⏳ 正在启动「AI 自动生成商品」任务，请关注页面上的进度弹窗。`,
              },
            ]
          }
          return m
        })
        await Promise.resolve(onTriggerAutoGenerate?.())
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
        <h3 className="text-sm font-bold text-indigo-800">🤖 AI 商品助手</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">用自然语言管理商品 ID、上架下架、创建商品或触发自动生成</p>
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
            disabled={loading || jobBusy}
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
          disabled={loading || jobBusy}
          rows={2}
          placeholder={jobBusy ? '有任务进行中，请稍候…' : '输入指令，如：把 #1 上架；下架所有草稿；创建xxx商品…'}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || jobBusy || !input.trim()}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 self-end"
        >
          {loading ? '…' : '发送'}
        </button>
      </div>
    </div>
  )
}
