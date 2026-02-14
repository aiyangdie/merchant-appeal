import React, { useState, useEffect } from 'react'

const SECTIONS = [
  { key: 'complaint_summary', label: '案件概述', icon: '📋', desc: '事件全貌+核心诉求' },
  { key: 'merchant_info', label: '商户与经营信息', icon: '🏪', desc: '结构化资料（含经营场景/AppID）' },
  { key: 'violation_detail', label: '违规详情+订单信息', icon: '⚠️', desc: '处罚原因+交易订单号' },
  { key: 'evidence_list', label: '证据材料清单', icon: '📎', desc: '身份证/营业执照/订单截图等' },
  { key: 'timeline', label: '事件时间线', icon: '🕐', desc: '按时间顺序梳理关键节点' },
  { key: 'appeal_points', label: '申诉要点与策略', icon: '💡', desc: '核心论点+驳回应对预案' },
]

export default function ComplaintDocPanel({ sessionId, userId, onClose, getAuthHeaders }) {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)
  const [costInfo, setCostInfo] = useState(null)
  const [expandedFull, setExpandedFull] = useState(false)

  useEffect(() => {
    if (sessionId) loadExisting()
  }, [sessionId])

  async function loadExisting() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complaint-doc`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.doc) setDoc(data.doc)
    } catch {}
  }

  async function generate(force = false, retryCount = 0) {
    if (!sessionId || !userId) {
      setError('缺少会话信息，请刷新页面后重试')
      return
    }
    setLoading(true)
    setError('')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 130000)
      const res = await fetch(`/api/sessions/${sessionId}/generate-complaint-doc`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, force }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        let errMsg = `服务器错误(${res.status})`
        try {
          const errData = await res.json()
          if (errData.error) errMsg = errData.error
        } catch {
          if (res.status === 502 || res.status === 504) errMsg = '后端服务未启动或响应超时'
        }
        setError(errMsg)
        return
      }

      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setDoc(data.doc)
      setCostInfo({
        cost: data.cost || 0,
        isOfficialMode: data.isOfficialMode,
        cached: data.cached,
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求超时，AI整理材料需要较长时间，请稍后重试')
      } else if (retryCount < 1) {
        return generate(force, retryCount + 1)
      } else {
        setError(`生成失败：${err.message || '网络错误'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }

  function copyAll() {
    if (!doc) return
    const parts = [
      doc.doc_title ? `【${doc.doc_title}】\n` : '',
      doc.complaint_summary ? `一、案件概述\n${doc.complaint_summary}\n` : '',
      doc.merchant_info ? `二、商户基本信息\n${doc.merchant_info}\n` : '',
      doc.violation_detail ? `三、违规/处罚详情\n${doc.violation_detail}\n` : '',
      doc.evidence_list ? `四、证据材料清单\n${doc.evidence_list}\n` : '',
      doc.timeline ? `五、事件时间线\n${doc.timeline}\n` : '',
      doc.appeal_points ? `六、申诉要点\n${doc.appeal_points}` : '',
    ].filter(Boolean).join('\n')
    copyText(parts, 'all')
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">投诉材料整理</h2>
            <p className="text-[10px] text-gray-400">AI智能整理，可直接复制使用</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!doc ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">AI 投诉材料整理</h3>
            <p className="text-xs text-gray-400 mb-1 px-4">根据您提供的信息，AI将为您整理一份完整的投诉/申诉材料文档</p>
            <p className="text-xs text-gray-400 mb-4 px-4">包含案件概述、证据清单、时间线、申诉要点等，可直接复制到Word使用</p>
            <div className="space-y-1.5 mb-5 px-4">
              {SECTIONS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-gray-300">— {s.desc}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>📄</span>
                <span className="font-medium">完整文书</span>
                <span className="text-gray-300">— 可直接复制到Word</span>
              </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-3 bg-red-50 rounded-lg px-3 py-2 mx-4">{error}</p>}
            <button onClick={() => generate()} disabled={loading || !sessionId}
              className="mt-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  AI整理中...
                </span>
              ) : '📋 一键整理投诉材料'}
            </button>
            <p className="text-[10px] text-gray-300 mt-2">使用官方API按实际Token消耗计费</p>
          </div>
        ) : (
          <>
            {/* 标题 */}
            {doc.doc_title && (
              <div className="text-center pb-2">
                <h3 className="text-sm font-bold text-gray-800">{doc.doc_title}</h3>
              </div>
            )}

            {/* 费用信息 */}
            {costInfo && (
              <div className="text-[10px] text-gray-400 text-center bg-gray-50 rounded-lg py-1.5">
                {costInfo.cached ? '已缓存，本次未产生费用' :
                  costInfo.cost > 0 ? `本次消耗 ¥${parseFloat(costInfo.cost).toFixed(4)}（${costInfo.inputTokens}+${costInfo.outputTokens} tokens）` :
                  '本次生成免费'}
              </div>
            )}

            {/* 一键复制全部 */}
            <button onClick={copyAll}
              className={`w-full py-2.5 text-xs font-semibold rounded-xl transition-all ${
                copiedKey === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-md'
              }`}>
              {copiedKey === 'all' ? '✓ 已复制全部内容' : '📋 一键复制全部（分段格式）'}
            </button>

            {/* 各段落卡片 */}
            {SECTIONS.map(s => {
              const text = doc[s.key] || ''
              if (!text) return null
              const isCopied = copiedKey === s.key
              return (
                <div key={s.key} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                    </div>
                    <button onClick={() => copyText(text, s.key)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                        isCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}>
                      {isCopied ? '✓ 已复制' : '复制'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap select-all">{text}</p>
                </div>
              )
            })}

            {/* 完整文书（可展开） */}
            {doc.full_document && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3.5 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📄</span>
                    <span className="text-xs font-semibold text-blue-700">完整申诉文书</span>
                    <span className="text-[10px] text-blue-400 ml-1">可直接复制到Word</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => copyText(doc.full_document, 'full')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                        copiedKey === 'full'
                          ? 'bg-green-500 text-white'
                          : 'bg-white text-blue-600 border border-blue-200 hover:border-blue-400'
                      }`}>
                      {copiedKey === 'full' ? '✓ 已复制' : '复制全文'}
                    </button>
                    <button onClick={() => setExpandedFull(!expandedFull)}
                      className="px-2 py-1 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                      {expandedFull ? '收起' : '展开'}
                    </button>
                  </div>
                </div>
                {expandedFull ? (
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-all mt-2 bg-white/60 rounded-lg p-3">{doc.full_document}</p>
                ) : (
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 select-all">{doc.full_document.slice(0, 150)}...</p>
                )}
              </div>
            )}

            {/* 重新生成 */}
            <button onClick={() => { setDoc(null); setCostInfo(null); setTimeout(() => generate(true), 100) }}
              className="w-full py-2 text-xs text-blue-500 bg-blue-50 rounded-lg font-medium hover:bg-blue-100 transition-colors">
              重新整理材料
            </button>
          </>
        )}
      </div>
    </div>
  )
}
