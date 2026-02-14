import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function parseMarkdown(text) {
  if (!text) return ''
  let html = text
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-3 mb-1">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$1. $2</li>')
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">$1</code>')
  html = html.replace(/\n\n/g, '</p><p class="mt-2">')
  html = html.replace(/\n/g, '<br/>')
  return '<p>' + html + '</p>'
}

export default function ServicePage() {
  const { orderNo } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('appeal_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  // 加载订单详情
  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await fetch(`/api/orders/${orderNo}`, { headers: getAuthHeaders() })
        if (!res.ok) { setError('订单不存在或无权限'); setInitialLoading(false); return }
        const d = await res.json()
        setOrder(d.order)
        setMessages(d.order.messages || [])
      } catch { setError('加载订单失败') }
      setInitialLoading(false)
    }
    loadOrder()
  }, [orderNo, getAuthHeaders])

  // 自动滚动
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg, ts: Date.now() }])
    setLoading(true)

    try {
      const res = await fetch(`/api/orders/${orderNo}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ message: userMsg }),
      })
      const d = await res.json()
      if (d.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: d.reply, ts: Date.now() }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: d.error || '系统繁忙，请重试', ts: Date.now() }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络异常，请重试', ts: Date.now() }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
          </div>
          <p className="text-gray-500 text-sm">正在连接专属顾问...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          </div>
          <p className="text-gray-700 font-medium mb-2">{error}</p>
          <button onClick={() => navigate('/')} className="mt-4 px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors">返回首页</button>
        </div>
      </div>
    )
  }

  const persona = order?.persona || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col" style={{ height: '100dvh' }}>
      {/* 顶部导航 */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-100/80">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-lg shadow-sm flex-shrink-0">
            {persona.avatar || '👨‍💼'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-gray-900 truncate">{persona.name || '专属顾问'}</h1>
            <p className="text-[11px] text-gray-400 truncate">{persona.title || '服务顾问'} · {order?.productName}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-medium rounded-full border border-green-100">在线</span>
          </div>
        </div>
        {/* 服务信息条 */}
        <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto">
          <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded-md">{order?.productName}</span>
          <span className="flex-shrink-0 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded-md">¥{order?.price}</span>
          {persona.expertise?.map((e, i) => (
            <span key={i} className="flex-shrink-0 px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-medium rounded-md">{e}</span>
          ))}
        </div>
      </header>

      {/* 聊天区域 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* 顾问介绍卡片 */}
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">
                  {persona.avatar || '👨‍💼'}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{persona.name || '专属顾问'}</h3>
                  <p className="text-white/70 text-xs">{persona.title}</p>
                </div>
              </div>
              {persona.personality && <p className="text-white/60 text-[11px] mb-2">性格: {persona.personality}</p>}
              {persona.expertise && (
                <div className="flex gap-1.5 flex-wrap">
                  {persona.expertise.map((e, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white/15 rounded-full text-[10px] font-medium">{e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5">
                  {persona.avatar || '👨‍💼'}
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md shadow-sm'
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100/80'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="message-content prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0 mt-0.5">
                  我
                </div>
              )}
            </div>
          ))}

          {/* 打字指示器 */}
          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm flex-shrink-0">
                {persona.avatar || '👨‍💼'}
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100/80">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* 快捷操作 */}
      <div className="flex-shrink-0 px-4 pt-2 pb-0 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['帮我写申诉报告', '分析我的情况', '需要准备什么材料', '有什么申诉策略'].map((q, i) => (
            <button key={i} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200/80 text-gray-600 text-[11px] rounded-full hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all whitespace-nowrap">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 输入区 */}
      <footer className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-t border-gray-100/80 safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-2.5 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={`向${persona.name || '顾问'}提问...`}
                disabled={loading}
                rows={1}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200/80 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-200 resize-none placeholder:text-gray-400 disabled:opacity-50"
                style={{ maxHeight: '120px' }}
              />
            </div>
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                input.trim() && !loading
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md hover:shadow-lg active:scale-95'
                  : 'bg-gray-100 text-gray-300'
              }`}>
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
