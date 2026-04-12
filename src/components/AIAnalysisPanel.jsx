import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReportCard from './ReportCard'
import AnalysisVisualView from './AnalysisVisualView'

// 简单 Markdown 渲染器
function MarkdownRenderer({ text }) {
  const html = useMemo(() => {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^## (.*$)/gm, '<div class="mt-4 mb-2 flex items-center gap-2"><span class="w-1 h-4 rounded-full bg-indigo-500 flex-shrink-0"></span><h2 class="text-[13px] font-bold text-gray-900">$1</h2></div>')
      .replace(/^### (.*$)/gm, '<h3 class="text-[12px] font-semibold text-gray-700 mt-3 mb-1 pl-2 border-l-2 border-indigo-300">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
      .replace(/^ +[-·] (.*$)/gm, '<div class="flex gap-1.5 ml-5 my-0.5"><span class="text-gray-300 flex-shrink-0">·</span><span class="text-gray-600">$1</span></div>')
      .replace(/^- (.*$)/gm, '<div class="flex gap-1.5 ml-1.5 my-0.5"><span class="text-indigo-400 flex-shrink-0 mt-0.5">·</span><span>$1</span></div>')
      .replace(/^(\d+)\. (.*$)/gm, '<div class="flex gap-1.5 ml-1.5 my-0.5"><span class="text-indigo-500 font-bold flex-shrink-0 min-w-[16px]">$1.</span><span>$2</span></div>')
      .replace(/^---$/gm, '<hr class="my-3 border-gray-100"/>')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n\n/g, '<div class="h-2"></div>')
      .replace(/\n/g, '<br/>')
  }, [text])
  return <div className="text-[11px] text-gray-700 leading-relaxed break-words analysis-markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function AIAnalysisPanel({ sessionId, collectedData, onClose, refreshKey, userId, getAuthHeaders }) {
  const authHeaders = getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' }
  const [local, setLocal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState(null)
  const [billing, setBilling] = useState(null)
  const [streamingText, setStreamingText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [viewMode, setViewMode] = useState('text') // 'text' | 'visual'
  const abortRef = useRef(null)
  const streamEndRef = useRef(null)
  const contentRef = useRef(null)

  const filledCount = Object.keys(collectedData || {}).filter(k => !k.startsWith('_') && collectedData[k] && String(collectedData[k]).trim()).length
  const hasData = filledCount > 0

  // 加载已保存的深度分析
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/sessions/${sessionId}/deep-analysis-result`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.result) setFinalText(data.result) })
      .catch(() => {})
  }, [sessionId])

  // 本地分析（免费，自动触发）
  const fetchLocal = () => {
    if (!sessionId || filledCount < 1) { setLocal(null); return }
    setLoading(true)
    fetch(`/api/sessions/${sessionId}/analysis`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : Promise.reject('fetch failed'))
      .then(data => setLocal(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // AI流式深度分析（逐字输出中文报告）
  const fetchDeepAnalysis = async () => {
    if (!sessionId || filledCount < 1) return
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setAiLoading(true); setIsStreaming(true); setStreamingText(''); setFinalText(''); setError(null); setBilling(null)
    const url = `/api/sessions/${sessionId}/deep-analysis${userId ? `?userId=${userId}` : ''}`
    let accumulated = ''
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: authHeaders })
      if (!res.ok) throw new Error('fetch failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue
          try {
            const evt = JSON.parse(payload)
            if (evt.type === 'local') { setLocal(evt.localAnalysis) }
            else if (evt.type === 'chunk') { accumulated += evt.text; setStreamingText(accumulated) }
            else if (evt.type === 'done') {
              if (evt.billing) setBilling(evt.billing)
              setIsStreaming(false)
              setFinalText(accumulated)
              setStreamingText('')
            }
            else if (evt.type === 'error') {
              if (evt.reason === 'quota_exceeded') setError('本月AI分析额度已用完，下月自动重置')
              else if (evt.reason === 'no_balance') setError('余额不足，请充值后使用AI深度分析')
              else setError(evt.message || 'AI分析失败')
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError('AI分析请求失败')
      if (accumulated) { setFinalText(accumulated); setStreamingText('') }
    } finally {
      setAiLoading(false); setIsStreaming(false)
    }
  }

  // 自动滚动
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [streamingText])

  // 自动触发本地分析
  useEffect(() => {
    if (!sessionId || filledCount < 1) { setLocal(null); return }
    let cancelled = false
    const timer = setTimeout(() => { if (!cancelled) fetchLocal() }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId, filledCount, refreshKey])

  const handleRefresh = () => { fetchLocal(); fetchDeepAnalysis() }
  const displayText = isStreaming ? streamingText : finalText
  const hasDeepAnalysis = !!finalText || isStreaming

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[13px] font-semibold text-gray-900 leading-tight">AI 智能分析</h2>
                {hasDeepAnalysis && <span className="text-[8px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-bold">AI深度</span>}
                {!hasDeepAnalysis && hasData && !loading && <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">规则</span>}
              </div>
              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">实时申诉策略建议</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasData && (
              <button onClick={handleRefresh} disabled={aiLoading} className="h-7 px-2.5 flex items-center gap-1 text-[10px] text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 rounded-lg transition-all shadow-sm">
                <svg className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {aiLoading ? '分析中...' : '深度分析'}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!hasData && (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-[12px] text-gray-400 font-medium">等待数据收集</p>
            <p className="text-[11px] text-gray-300 mt-1">当用户开始填写信息后，AI会自动分析并给出申诉建议</p>
          </div>
        )}

        {/* 加载中（本地分析） */}
        {loading && hasData && !isStreaming && !hasDeepAnalysis && (
          <div className="text-center py-8">
            <div className="w-6 h-6 mx-auto mb-2 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[11px] text-indigo-400">正在分析案件...</p>
          </div>
        )}

        {/* 等待连接 */}
        {isStreaming && !streamingText && (
          <div className="text-center py-8">
            <div className="w-6 h-6 mx-auto mb-2 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[11px] text-indigo-400">正在连接 AI 分析服务...</p>
            <p className="text-[9px] text-gray-400 mt-0.5">基于收集数据 + 聊天记录</p>
          </div>
        )}

        {error && !loading && !isStreaming && <div className="text-center py-3 text-[11px] text-amber-500">{error}</div>}

        {/* AI 深度分析报告（流式/完成态共用） */}
        {displayText && (
          <div className="rounded-xl border border-indigo-100/80 overflow-hidden">
            {isStreaming && (
              <div className="border-b border-indigo-100/50">
                <div className="px-3 py-1.5 bg-indigo-50/60 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 " />
                  <span className="text-[10px] font-medium text-indigo-600">AI 正在生成分析报告...</span>
                  <span className="text-[9px] text-indigo-400 ml-auto">{displayText.length} 字</span>
                </div>
                <div className="h-0.5 bg-indigo-100 overflow-hidden"><div className="h-full bg-indigo-400 animate-[progress_2s_ease-in-out_infinite]" style={{width:'60%'}} /></div>
              </div>
            )}
            {!isStreaming && finalText && (
              <div className="px-3 py-1.5 bg-indigo-50/40 flex items-center justify-between border-b border-indigo-100/50 gap-1.5">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[10px] font-medium text-green-600">AI 深度报告</span>
                  <span className="text-[9px] text-gray-400">{finalText.length}字</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-white/80 rounded-md p-0.5 border border-indigo-100">
                    <button onClick={() => setViewMode('text')}
                      className={`h-5 px-2 text-[9px] rounded font-medium transition-all ${viewMode === 'text' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                      全文
                    </button>
                    <button onClick={() => setViewMode('visual')}
                      className={`h-5 px-2 text-[9px] rounded font-medium transition-all ${viewMode === 'visual' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                      清单
                    </button>
                  </div>
                  <button onClick={() => setShowReport(true)} className="h-5 px-2 flex items-center gap-1 text-[9px] text-indigo-600 hover:text-white hover:bg-indigo-500 bg-indigo-50 border border-indigo-200 rounded-md transition-all">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    报告
                  </button>
                </div>
              </div>
            )}
            {/* 全文模式 */}
            {(isStreaming || viewMode === 'text') && (
              <div className="px-4 py-3 animate-fadeIn">
                <MarkdownRenderer text={displayText} />
                {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-0.5 align-middle" />}
              </div>
            )}
            {/* 可视化清单模式 */}
            {!isStreaming && viewMode === 'visual' && finalText && (
              <div className="px-3 py-3 animate-fadeIn">
                <AnalysisVisualView text={finalText} />
              </div>
            )}
          </div>
        )}

        {/* 计费信息 */}
        {billing && !isStreaming && (
          <div className={`px-3 py-2 rounded-xl border text-[10px] ${
            billing.type === 'member_free' ? 'bg-green-50/50 border-green-100 text-green-600' :
            billing.type === 'token_charge' ? 'bg-blue-50/50 border-blue-100 text-blue-600' :
            'bg-gray-50 border-gray-100 text-gray-500'
          }`}>
            {billing.type === 'member_free' && '✓ 会员免费分析 · 本次不扣费'}
            {billing.type === 'token_charge' && `本次消耗 ¥${billing.cost?.toFixed(4) || '0'} · 剩余余额 ¥${parseFloat(billing.balance || 0).toFixed(2)}`}
          </div>
        )}

        {/* 本地规则分析（仅在没有深度分析时显示） */}
        {!hasDeepAnalysis && local && !loading && hasData && (
          <div className="space-y-2.5">
            {local.risk && (
              <div className="rounded-xl border border-gray-100/80 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-600">📊 风险评估（规则引擎）</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    (local.risk.riskScore || 0) >= 70 ? 'bg-red-50 text-red-600' :
                    (local.risk.riskScore || 0) >= 40 ? 'bg-orange-50 text-orange-600' :
                    'bg-green-50 text-green-600'
                  }`}>{local.risk.level}</span>
                </div>
                <div className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">难度评分</span>
                    <span className="text-[12px] font-bold text-gray-800">{local.risk.riskScore}/100</span>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 rounded-full ${
                      local.risk.riskScore >= 70 ? 'bg-red-400' : local.risk.riskScore >= 40 ? 'bg-orange-400' : 'bg-green-400'
                    }`} style={{ width: `${local.risk.riskScore}%` }} />
                  </div>
                  {local.risk.successRate && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">预估成功率</span>
                      <span className="text-[12px] font-bold text-green-600">{local.risk.successRate}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {local.strategy?.length > 0 && (
              <div className="rounded-xl border border-gray-100/80 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50/50">
                  <span className="text-[11px] font-semibold text-gray-600">🎯 策略建议</span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {local.strategy.map((s, i) => (
                    <div key={i} className={`flex gap-1.5 px-2 py-1.5 rounded-lg text-[11px] ${
                      s.type === 'warning' ? 'bg-red-50 text-red-600' : s.type === 'tip' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <span className="flex-shrink-0">{s.type === 'warning' ? '⚠️' : s.type === 'tip' ? '💡' : 'ℹ️'}</span>
                      <span>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasData && !hasDeepAnalysis && !isStreaming && (
              <div className="text-center py-3">
                <p className="text-[10px] text-gray-400 mb-2">以上为规则引擎分析，点击"深度分析"获取AI专家报告</p>
              </div>
            )}
          </div>
        )}
      </div>
      {showReport && finalText && (
        <ReportCard collectedData={collectedData} analysisText={finalText} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
