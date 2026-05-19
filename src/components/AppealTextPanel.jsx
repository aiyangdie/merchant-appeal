/**
 * 申诉文案面板组件
 * @description 生成、展示和管理微信商户申诉文案
 * 
 * 核心功能：
 * 1. 文案生成 — 调用 AI 生成申诉文案，流式渲染输出，支持强制重新生成
 * 2. 分段展示 — 按微信商户后台的 5 个表单字段分别展示（业务模式、退款机制、投诉原因、处理方法、补充说明）
 * 3. 一键复制 — 每段文案独立复制，带字符数限制提示（300字符）
 * 4. 进度跟踪 — 申诉状态流转（已生成→已提交→审核中→通过/驳回）
 * 5. 反馈收集 — 记录申诉结果（通过/驳回原因），帮助 AI 学习优化
 * 6. 计费展示 — 显示 Token 消耗和费用信息
 * 
 * 文案分段（SECTIONS）：
 * - business_model: 业务模式说明
 * - refund_rules: 退款机制与退款方式
 * - complaint_cause: 投诉产生原因及详细说明
 * - complaint_resolution: 投诉处理方法
 * - supplementary: 补充文字说明
 * 
 * @param {Object} props
 * @param {string} props.sessionId - 会话 ID
 * @param {string} props.userId - 用户 ID
 * @param {Function} [props.onClose] - 关闭面板回调（移动端）
 * @param {Function} props.getAuthHeaders - 获取认证请求头回调 () => {Authorization: 'Bearer xxx'}
 */
import React, { useState, useEffect, useRef } from 'react'

/**
 * 申诉文案分段定义
 * @constant {Array<{key: string, label: string, icon: string, dbKey: string, formField: string}>}
 * @description 对应微信商户后台申诉表单的 5 个填写栏
 */
const SECTIONS = [
  { key: 'business_model', label: '业务模式说明', icon: '💼', dbKey: 'business_model', formField: '对应表单「业务模式说明」' },
  { key: 'refund_rules', label: '退款机制与退款方式', icon: '💰', dbKey: 'refund_rules', formField: '对应表单「退款机制与退款方式」' },
  { key: 'complaint_cause', label: '投诉产生原因及详细说明', icon: '📋', dbKey: 'complaint_cause', formField: '对应表单「投诉产生原因及详细说明」' },
  { key: 'complaint_resolution', label: '投诉处理方法', icon: '🔧', dbKey: 'complaint_resolution', formField: '对应表单「投诉处理方法」' },
  { key: 'supplementary', label: '补充文字说明', icon: '📝', dbKey: 'supplementary', formField: '对应表单「补充文字说明」' },
]

/**
 * 申诉文案面板主组件
 * @description 完整的申诉文案生成、管理和提交流程面板
 * @param {Object} props
 * @param {string} props.sessionId - 会话 ID
 * @param {string} props.userId - 用户 ID
 * @param {Function} [props.onClose] - 关闭面板回调
 * @param {Function} props.getAuthHeaders - 获取认证请求头回调
 */
export default function AppealTextPanel({ sessionId, userId, onClose, getAuthHeaders }) {
  const [appealText, setAppealText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)
  const [cost, setCost] = useState(null)
  const [costInfo, setCostInfo] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const abortRef = useRef(null)

  useEffect(() => {
    if (sessionId) loadExisting()
  }, [sessionId])

  async function loadExisting() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/appeal-text`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.appealText) setAppealText(data.appealText)
    } catch {}
  }

  async function generate(force = false, retryCount = 0) {
    if (!sessionId) {
      setError('缺少会话信息，请刷新页面后重试')
      return
    }
    setLoading(true)
    setError('')
    setStreamingText('')
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/sessions/${sessionId}/generate-appeal-text`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ force, stream: true }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let errMsg = `服务器错误(${res.status})`
        try {
          const errData = await res.json()
          if (errData.error) errMsg = errData.error
        } catch {
          const text = await res.text().catch(() => '')
          if (res.status === 502 || res.status === 504) errMsg = '后端服务未启动或响应超时，请检查服务器状态'
          else if (text.length < 200) errMsg = text || errMsg
        }
        setError(errMsg)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'start') {
              continue
            }

            if (parsed.choices?.[0]?.delta?.content) {
              accumulated += parsed.choices[0].delta.content
              setStreamingText(accumulated)
            }

            if (parsed.choices?.[0]?.delta?.reasoning_content) {
              continue
            }

            if (parsed.type === 'done') {
              if (parsed.appealText) {
                setAppealText(parsed.appealText)
                setCostInfo({
                  cost: parsed.cost || 0,
                  isOfficialMode: parsed.isOfficialMode,
                  cached: parsed.cached || false,
                  inputTokens: parsed.inputTokens || 0,
                  outputTokens: parsed.outputTokens || 0,
                })
              } else if (parsed.error) {
                setError(parsed.error)
              }
              setStreamingText('')
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求已取消')
      } else if (retryCount < 1) {
        console.warn('Appeal text generate failed, retrying...', err.message)
        return generate(force, retryCount + 1)
      } else {
        setError(`生成失败：${err.message || '网络错误，请检查后端服务是否正常运行'}`)
      }
    } finally {
      setLoading(false)
      abortRef.current = null
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

  async function updateStatus(newStatus, feedback = '') {
    if (!sessionId) return
    setStatusLoading(true)
    try {
      const body = { status: newStatus }
      if (feedback) {
        if (newStatus === 'rejected') body.rejectionReason = feedback
        else body.feedback = feedback
      }
      if (newStatus === 'rejected' && appealText?.resubmit_count > 0) body.status = 'rejected'
      const res = await fetch(`/api/sessions/${sessionId}/appeal-feedback`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.appealText) setAppealText(data.appealText)
    } catch (e) { console.error('Update status failed:', e) }
    setStatusLoading(false)
  }

  function charCount(text) {
    return text ? text.length : 0
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">申诉文案</h2>
            <p className="text-[10px] text-gray-400">可直接复制提交</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-50 lg:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {streamingText && !appealText ? (
          <div className="space-y-3">
            <div className="text-center py-3">
              <div className="flex items-center justify-center gap-2 text-sm text-orange-500 font-medium">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                AI正在生成申诉文案...
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3.5 border border-orange-100">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words font-sans max-h-[60vh] overflow-y-auto">{streamingText}</pre>
            </div>
          </div>
        ) : !appealText ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">生成申诉文案</h3>
            <p className="text-xs text-gray-400 mb-1 px-6">对应微信商户后台真实申诉表单的5个填写栏</p>
            <p className="text-xs text-gray-400 mb-4 px-6">每段300字符内，可<b className="text-gray-600">直接复制粘贴</b>到申诉表单提交</p>
            <div className="space-y-2">
              {SECTIONS.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-xs text-gray-500 px-4">
                  <span>{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-gray-300 text-[10px]">300字符</span>
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-red-500 mt-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={() => generate()} disabled={loading || !sessionId}
              className="mt-5 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  AI生成中...
                </span>
              ) : '🚀 一键生成申诉文案'}
            </button>
            <p className="text-[10px] text-gray-300 mt-2">使用官方API将按实际Token消耗计费，自定义API Key则免费</p>
          </div>
        ) : (
          <>
            {costInfo && (
              <div className="text-[10px] text-gray-400 text-center bg-gray-50 rounded-lg py-1.5">
                {costInfo.cached ? '已缓存，本次未产生费用' :
                  costInfo.cost > 0 ? `本次消耗 ¥${parseFloat(costInfo.cost).toFixed(4)}（输入${costInfo.inputTokens} + 输出${costInfo.outputTokens} tokens）` :
                  '本次生成免费（自定义API Key）'}
              </div>
            )}
            {SECTIONS.map(s => {
              const text = appealText[s.dbKey] || ''
              const count = charCount(text)
              const isCopied = copiedKey === s.key
              return (
                <div key={s.key} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{s.icon}</span>
                        <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                      </div>
                      {s.formField && <p className="text-[10px] text-gray-400 mt-0.5 ml-6">{s.formField}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${count > 300 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                        {count}/300
                      </span>
                      <button onClick={() => copyText(text, s.key)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                          isCopied
                            ? 'bg-green-500 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                        }`}>
                        {isCopied ? '✓ 已复制' : '复制'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap select-all">{text || '（未生成）'}</p>
                </div>
              )
            })}
            {/* 申诉进度跟踪 */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3.5 border border-indigo-100">
              <h4 className="text-xs font-semibold text-indigo-700 mb-2">📋 申诉进度跟踪</h4>
              <p className="text-[10px] text-indigo-400 mb-2.5">复制文案提交后，请更新进度，帮助AI学习优化</p>
              {(() => {
                const st = appealText.appeal_status || 'generated'
                const STATUS_FLOW = [
                  { key: 'submitted', label: '已提交申诉', icon: '📤', color: 'bg-blue-500', desc: '已将文案提交到微信商户后台' },
                  { key: 'under_review', label: '审核中', icon: '⏳', color: 'bg-yellow-500', desc: '微信正在审核我的申诉' },
                  { key: 'approved', label: '申诉通过 🎉', icon: '✅', color: 'bg-green-500', desc: '太好了！商户号已恢复' },
                  { key: 'rejected', label: '申诉被驳回', icon: '❌', color: 'bg-red-500', desc: '很遗憾，本次申诉未通过' },
                ]
                const currentIdx = STATUS_FLOW.findIndex(s => s.key === st)
                return (
                  <div className="space-y-1.5">
                    {/* Progress bar */}
                    <div className="flex items-center gap-1 mb-3">
                      {STATUS_FLOW.map((s, i) => (
                        <React.Fragment key={s.key}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                            st === s.key ? `${s.color} text-white` : i <= currentIdx ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>{st === s.key ? s.icon : i <= currentIdx ? '✓' : i+1}</div>
                          {i < STATUS_FLOW.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-green-300' : 'bg-gray-200'}`} />}
                        </React.Fragment>
                      ))}
                    </div>
                    {/* Action buttons */}
                    {(st === 'generated' || st === 'rejected') && (
                      <button onClick={() => updateStatus('submitted')} disabled={statusLoading}
                        className="w-full py-2 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                        📤 {st === 'rejected' ? '重新提交申诉' : '我已提交申诉'}
                      </button>
                    )}
                    {st === 'submitted' && (
                      <button onClick={() => updateStatus('under_review')} disabled={statusLoading}
                        className="w-full py-2 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                        ⏳ 微信正在审核中
                      </button>
                    )}
                    {(st === 'submitted' || st === 'under_review') && (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button onClick={() => setShowFeedback('approved')} disabled={statusLoading}
                          className="py-2 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                          ✅ 申诉通过了！
                        </button>
                        <button onClick={() => setShowFeedback('rejected')} disabled={statusLoading}
                          className="py-2 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                          ❌ 申诉被驳回
                        </button>
                      </div>
                    )}
                    {st === 'approved' && (
                      <div className="text-center py-2 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-sm">🎉</span>
                        <p className="text-xs font-semibold text-green-700 mt-1">恭喜！申诉通过</p>
                        {appealText.user_feedback && <p className="text-[10px] text-green-500 mt-0.5">{appealText.user_feedback}</p>}
                      </div>
                    )}
                    {st === 'rejected' && (
                      <div className="text-center py-2 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs font-semibold text-red-600">申诉被驳回</p>
                        {appealText.rejection_reason && <p className="text-[10px] text-red-400 mt-0.5">原因: {appealText.rejection_reason}</p>}
                        {appealText.resubmit_count > 0 && <p className="text-[10px] text-red-300 mt-0.5">已重新提交 {appealText.resubmit_count} 次</p>}
                      </div>
                    )}
                    {/* Feedback form */}
                    {showFeedback && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 space-y-2">
                        <p className="text-[11px] font-medium text-gray-700">{showFeedback === 'approved' ? '🎉 太好了！请分享一下：' : '😔 请告诉我们驳回原因：'}</p>
                        <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                          placeholder={showFeedback === 'approved' ? '申诉成功的关键是什么？（可选）' : '微信给的驳回原因是什么？'}
                          className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" rows={2} />
                        <div className="flex gap-2">
                          <button onClick={() => { updateStatus(showFeedback, feedbackText); setShowFeedback(null); setFeedbackText('') }}
                            disabled={statusLoading}
                            className={`flex-1 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 ${showFeedback === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}>
                            确认提交
                          </button>
                          <button onClick={() => { setShowFeedback(null); setFeedbackText('') }}
                            className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg">取消</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <button onClick={() => { setAppealText(null); setCostInfo(null); setTimeout(() => generate(true), 100) }}
              className="w-full py-2 text-xs text-orange-500 bg-orange-50 rounded-lg font-medium hover:bg-orange-100 transition-colors">
              重新生成文案
            </button>
          </>
        )}
      </div>
    </div>
  )
}
