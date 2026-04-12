import React, { useState, useEffect } from 'react'

const PRIORITY_COLORS = {
  urgent: 'bg-red-50 border-red-200 text-red-700',
  required: 'bg-blue-50 border-blue-200 text-blue-700',
  recommended: 'bg-green-50 border-green-200 text-green-700',
  important: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-gray-50 border-gray-200 text-gray-500',
}

const PRIORITY_LABELS = {
  urgent: '紧急', required: '必须', recommended: '建议', important: '重要', info: '了解',
}

const COMPLAINT_TYPES = ['退款', '服务不满意', '商品问题', '未收到货', '其他']

const APPEAL_STATUSES = [
  { key: 'generated', label: '已生成', icon: '📝', color: 'gray' },
  { key: 'submitted', label: '已提交', icon: '📤', color: 'blue' },
  { key: 'under_review', label: '审核中', icon: '⏳', color: 'amber' },
  { key: 'approved', label: '通过', icon: '✅', color: 'green' },
  { key: 'rejected', label: '驳回', icon: '❌', color: 'red' },
]

export default function AppealGuidePanel({ sessionId, onClose, getAuthHeaders }) {
  const [tab, setTab] = useState('guide') // guide | reply | phone
  const [guide, setGuide] = useState(null)
  const [reply, setReply] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedStep, setExpandedStep] = useState(null)
  const [checkedMaterials, setCheckedMaterials] = useState({})
  const [selectedComplaintType, setSelectedComplaintType] = useState('退款')
  const [copiedKey, setCopiedKey] = useState(null)
  const [appealProgress, setAppealProgress] = useState(null)
  const [progressUpdating, setProgressUpdating] = useState(false)
  const [rejectionInput, setRejectionInput] = useState('')
  const [showRejectionInput, setShowRejectionInput] = useState(false)
  const [resultFeedback, setResultFeedback] = useState(null) // {type, title, tips[]}
  const [resubmitStrategy, setResubmitStrategy] = useState(null)
  const [strategyLoading, setStrategyLoading] = useState(false)

  useEffect(() => {
    if (sessionId) {
      loadGuide()
      loadReply('退款')
      loadProgress()
    }
  }, [sessionId])

  async function loadProgress() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/appeal-progress`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.status) setAppealProgress(data)
    } catch {}
  }

  function generateResultFeedback(status, reason) {
    if (status === 'approved') {
      return {
        type: 'success',
        title: '🎉 恭喜！申诉已通过',
        tips: [
          '支付功能恢复后，建议先小额测试确认正常',
          '检查商户后台各项功能是否完全恢复',
          '如有资金冻结，通常会在3-5个工作日内解冻',
          '建议完善退款政策和售后流程，避免再次触发风控',
          '定期关注「微信支付商家助手」的风险通知',
          '如果觉得我们的服务有帮助，欢迎推荐给有需要的朋友~',
        ]
      }
    }
    if (status === 'rejected') {
      const baseTips = [
        '不要放弃！大部分商户在1-3次申诉内都能通过',
        '拨打95017转3，询问具体驳回原因和需要补充的材料',
        '重新生成申诉文案时，重点针对驳回原因进行说明',
        '每次重新申诉必须有新证据或新说明，不要重复提交相同材料',
      ]
      const reasonLower = (reason || '').toLowerCase()
      if (reasonLower.includes('材料') || reasonLower.includes('不完整') || reasonLower.includes('缺少')) {
        baseTips.push('💡 驳回原因涉及材料不足：请对照「申诉指导→材料清单」逐项补充')
      }
      if (reasonLower.includes('投诉') || reasonLower.includes('纠纷')) {
        baseTips.push('💡 驳回原因涉及投诉：请先处理完所有消费者投诉，使用「投诉话术」Tab的模板回复')
      }
      if (reasonLower.includes('真实') || reasonLower.includes('交易') || reasonLower.includes('虚假')) {
        baseTips.push('💡 驳回原因涉及交易真实性：补充更多物流签收记录、客户沟通截图、进货凭证')
      }
      if (reasonLower.includes('整改') || reasonLower.includes('违规')) {
        baseTips.push('💡 驳回原因涉及整改：提供整改前后对比截图和详细的整改措施说明')
      }
      baseTips.push('如果多次被驳回，建议考虑我们的专业代办服务，由经验丰富的团队协助处理')
      return { type: 'rejected', title: '😔 申诉被驳回，别灰心', tips: baseTips }
    }
    if (status === 'submitted') {
      return {
        type: 'info',
        title: '📤 已提交，请耐心等待',
        tips: [
          '微信审核通常需要5-7个工作日',
          '期间保持联系电话畅通，可能会有电话回访',
          '可以在3个工作日后拨打95017查询审核进度',
          '等待期间不要重复提交，以免影响审核',
        ]
      }
    }
    if (status === 'resubmitted') {
      return {
        type: 'info',
        title: '🔄 已重新提交',
        tips: [
          '重新提交后审核周期同样为5-7个工作日',
          '建议2-3天后拨打95017确认材料已被受理',
          '如果再次被驳回，建议寻求专业团队协助',
        ]
      }
    }
    return null
  }

  async function updateProgress(newStatus) {
    setProgressUpdating(true)
    try {
      const body = { status: newStatus }
      if (newStatus === 'rejected' && rejectionInput.trim()) {
        body.rejectionReason = rejectionInput.trim()
      }
      const res = await fetch(`/api/sessions/${sessionId}/appeal-progress`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        await loadProgress()
        setShowRejectionInput(false)
        const feedback = generateResultFeedback(newStatus, rejectionInput.trim())
        setResultFeedback(feedback)
        setRejectionInput('')
      }
    } catch {}
    finally { setProgressUpdating(false) }
  }

  async function loadResubmitStrategy() {
    setStrategyLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/resubmit-strategy`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!data.error) setResubmitStrategy(data)
    } catch {}
    finally { setStrategyLoading(false) }
  }

  async function loadGuide() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/appeal-guide`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGuide(data)
      if (data.steps?.length > 0) setExpandedStep(data.steps[0].id)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function loadReply(type) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/generate-complaint-reply`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaint_type: type })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReply(data)
    } catch (e) { console.error(e) }
  }

  function handleComplaintType(type) {
    setSelectedComplaintType(type)
    loadReply(type)
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  function toggleMaterial(name) {
    setCheckedMaterials(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const materialProgress = guide?.steps?.find(s => s.materials)?.materials
  const totalMaterials = materialProgress?.length || 0
  const checkedCount = materialProgress?.filter(m => checkedMaterials[m.name])?.length || 0

  // ========== 申诉流程指导 Tab ==========
  function renderGuide() {
    if (loading) return <div className="text-center py-16"><svg className="w-8 h-8 mx-auto animate-spin text-gray-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-sm text-gray-400 mt-2">加载中...</p></div>
    if (error) return <div className="text-center py-10"><p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3 mx-4">{error}</p><button onClick={loadGuide} className="mt-3 text-sm text-blue-500">重试</button></div>
    if (!guide) return null

    const { success_estimate, violation_info } = guide

    return (
      <div className="space-y-3">
        {/* 申诉进度追踪 */}
        {appealProgress && (
          <div className="rounded-xl p-4 border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
            <h3 className="text-xs font-bold text-gray-800 mb-3">📍 申诉进度追踪</h3>
            {/* 进度条 */}
            <div className="flex items-center gap-0.5 mb-3">
              {APPEAL_STATUSES.map((s, i) => {
                const currentIdx = APPEAL_STATUSES.findIndex(x => x.key === appealProgress.status)
                const isActive = i <= currentIdx
                const isCurrent = s.key === appealProgress.status
                const isRejected = appealProgress.status === 'rejected'
                const dotColor = isRejected && isCurrent ? 'bg-red-500' :
                  isActive ? (s.key === 'approved' ? 'bg-green-500' : 'bg-indigo-500') : 'bg-gray-200'
                const lineColor = isRejected && i === currentIdx ? 'bg-red-300' :
                  isActive ? 'bg-indigo-300' : 'bg-gray-200'
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex flex-col items-center" style={{ minWidth: 40 }}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${dotColor} ${isCurrent ? 'ring-2 ring-offset-1 ring-indigo-300 shadow-sm' : ''}`}>
                        {isCurrent ? <span>{s.icon}</span> : isActive ? <span className="text-white text-[9px]">✓</span> : <span className="text-gray-400 text-[9px]">{i + 1}</span>}
                      </div>
                      <span className={`text-[9px] mt-1 ${isCurrent ? 'font-bold text-indigo-700' : isActive ? 'text-gray-600' : 'text-gray-300'}`}>{s.label}</span>
                    </div>
                    {i < APPEAL_STATUSES.length - 1 && <div className={`flex-1 h-0.5 rounded ${lineColor} mt-[-10px]`} />}
                  </React.Fragment>
                )
              })}
            </div>
            {/* 状态详情 */}
            {appealProgress.submitted_at && (
              <p className="text-[10px] text-gray-400">提交时间: {new Date(appealProgress.submitted_at).toLocaleString('zh-CN')}</p>
            )}
            {appealProgress.result_at && (
              <p className="text-[10px] text-gray-400">结果时间: {new Date(appealProgress.result_at).toLocaleString('zh-CN')}</p>
            )}
            {appealProgress.rejection_reason && (
              <div className="mt-2 text-[11px] text-red-600 bg-red-50 rounded-lg p-2 border border-red-100">
                ❌ 驳回原因: {appealProgress.rejection_reason}
              </div>
            )}
            {appealProgress.resubmit_count > 0 && (
              <p className="text-[10px] text-amber-600 mt-1">已重新提交 {appealProgress.resubmit_count} 次</p>
            )}
            {/* 状态更新按钮 */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {appealProgress.status === 'generated' && (
                <button onClick={() => updateProgress('submitted')} disabled={progressUpdating}
                  className="px-3 py-1.5 text-[11px] font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                  📤 标记为已提交
                </button>
              )}
              {appealProgress.status === 'submitted' && (
                <button onClick={() => updateProgress('under_review')} disabled={progressUpdating}
                  className="px-3 py-1.5 text-[11px] font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                  ⏳ 标记为审核中
                </button>
              )}
              {(appealProgress.status === 'submitted' || appealProgress.status === 'under_review') && (
                <>
                  <button onClick={() => updateProgress('approved')} disabled={progressUpdating}
                    className="px-3 py-1.5 text-[11px] font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                    ✅ 申诉通过
                  </button>
                  <button onClick={() => setShowRejectionInput(true)} disabled={progressUpdating}
                    className="px-3 py-1.5 text-[11px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    ❌ 被驳回
                  </button>
                </>
              )}
              {appealProgress.status === 'rejected' && (
                <>
                  <button onClick={() => updateProgress('resubmitted')} disabled={progressUpdating}
                    className="px-3 py-1.5 text-[11px] font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50">
                    🔄 已重新提交
                  </button>
                  {!resubmitStrategy && (
                    <button onClick={loadResubmitStrategy} disabled={strategyLoading}
                      className="px-3 py-1.5 text-[11px] font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                      {strategyLoading ? '⏳ 生成中...' : '📋 生成改进方案'}
                    </button>
                  )}
                </>
              )}
            </div>
            {/* 智能重申策略 */}
            {resubmitStrategy && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-amber-100/50">
                  <h4 className="text-[11px] font-bold text-amber-800">📋 驳回改进方案</h4>
                  <button onClick={() => setResubmitStrategy(null)} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
                </div>
                <div className="p-3 space-y-2.5">
                  {/* 改进行动 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-600 mb-1.5">🎯 改进行动</p>
                    {resubmitStrategy.improvements.map((imp, i) => (
                      <div key={i} className="flex items-start gap-2 mb-1.5">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${
                          imp.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                          imp.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>{imp.priority === 'urgent' ? '紧急' : imp.priority === 'high' ? '重要' : '建议'}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-gray-700">{imp.action}</p>
                          <p className="text-[10px] text-gray-400 leading-relaxed">{imp.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 需要补充的材料 */}
                  {resubmitStrategy.new_materials.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 mb-1">📎 需要补充的材料</p>
                      {resubmitStrategy.new_materials.map((m, i) => (
                        <p key={i} className="text-[10px] text-gray-500 pl-3">☐ {m}</p>
                      ))}
                    </div>
                  )}
                  {/* 文案修改建议 */}
                  {resubmitStrategy.text_fixes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 mb-1">✏️ 文案修改建议</p>
                      {resubmitStrategy.text_fixes.map((t, i) => (
                        <p key={i} className="text-[10px] text-gray-500 pl-3">• {t}</p>
                      ))}
                    </div>
                  )}
                  {/* 时间建议 */}
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-100">
                    <span className="text-[10px] text-amber-600">⏰ {resubmitStrategy.timeline}</span>
                    <span className="text-[9px] text-gray-400">| {resubmitStrategy.tip}</span>
                  </div>
                </div>
              </div>
            )}
            {/* 驳回原因输入 */}
            {showRejectionInput && (
              <div className="mt-2 flex gap-1.5">
                <input value={rejectionInput} onChange={e => setRejectionInput(e.target.value)}
                  placeholder="输入驳回原因（可选）"
                  className="flex-1 text-[11px] px-2.5 py-1.5 border border-gray-200 rounded-lg focus:border-red-300 focus:outline-none" />
                <button onClick={() => updateProgress('rejected')} disabled={progressUpdating}
                  className="px-3 py-1.5 text-[11px] font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">确认</button>
                <button onClick={() => { setShowRejectionInput(false); setRejectionInput('') }}
                  className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-600">取消</button>
              </div>
            )}
            {/* 结果反馈建议 */}
            {resultFeedback && (
              <div className={`mt-3 rounded-lg p-3 border ${
                resultFeedback.type === 'success' ? 'bg-green-50 border-green-200' :
                resultFeedback.type === 'rejected' ? 'bg-red-50 border-red-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-[11px] font-bold ${
                    resultFeedback.type === 'success' ? 'text-green-700' :
                    resultFeedback.type === 'rejected' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>{resultFeedback.title}</h4>
                  <button onClick={() => setResultFeedback(null)} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
                </div>
                <div className="space-y-1.5">
                  {resultFeedback.tips.map((tip, i) => (
                    <p key={i} className={`text-[10px] leading-relaxed ${
                      resultFeedback.type === 'success' ? 'text-green-600' :
                      resultFeedback.type === 'rejected' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>{tip.startsWith('💡') ? tip : `${i + 1}. ${tip}`}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 成功率评估卡片 */}
        <div className={`rounded-xl p-4 border ${
          success_estimate.level === 'high' ? 'bg-green-50 border-green-200' :
          success_estimate.level === 'medium' ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-800">申诉成功率评估</h3>
            <div className={`text-2xl font-black ${
              success_estimate.level === 'high' ? 'text-green-600' :
              success_estimate.level === 'medium' ? 'text-amber-600' :
              'text-red-600'
            }`}>{success_estimate.rate}%</div>
          </div>
          {/* 进度条 */}
          <div className="w-full bg-white/60 rounded-full h-2.5 mb-3">
            <div className={`h-2.5 rounded-full transition-all duration-700 ${
              success_estimate.level === 'high' ? 'bg-green-500' :
              success_estimate.level === 'medium' ? 'bg-amber-500' :
              'bg-red-500'
            }`} style={{ width: `${success_estimate.rate}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-white/50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-gray-400">违规类型</p>
              <p className="font-semibold text-gray-700 mt-0.5 truncate">{violation_info.type}</p>
            </div>
            <div className="bg-white/50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-gray-400">行业</p>
              <p className="font-semibold text-gray-700 mt-0.5 truncate">{violation_info.industry}</p>
            </div>
            <div className="bg-white/50 rounded-lg px-2 py-1.5 text-center">
              <p className="text-gray-400">申诉次数</p>
              <p className="font-semibold text-gray-700 mt-0.5">{violation_info.is_first_appeal ? '首次' : '多次'}</p>
            </div>
          </div>
          {(success_estimate.risk_factors.length > 0 || success_estimate.positive_factors.length > 0) && (
            <div className="mt-2.5 space-y-1">
              {success_estimate.positive_factors.map((f, i) => (
                <p key={`p${i}`} className="text-[10px] text-green-700">✅ {f}</p>
              ))}
              {success_estimate.risk_factors.map((f, i) => (
                <p key={`r${i}`} className="text-[10px] text-red-600">⚠️ {f}</p>
              ))}
            </div>
          )}
        </div>

        {/* 流程步骤 */}
        <div className="space-y-2">
          {guide.steps.map((step, idx) => (
            <div key={step.id}
              className={`rounded-xl border transition-all ${expandedStep === step.id ? 'border-blue-200 shadow-sm' : 'border-gray-100'}`}>
              <button
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                className="w-full px-3.5 py-3 flex items-center gap-3 text-left">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{step.icon}</span>
                    <span className="text-xs font-semibold text-gray-800 truncate">{step.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-medium ${PRIORITY_COLORS[step.priority] || PRIORITY_COLORS.info}`}>
                      {PRIORITY_LABELS[step.priority] || '了解'}
                    </span>
                  </div>
                  {step.time_estimate && <p className="text-[10px] text-gray-400 mt-0.5">预计: {step.time_estimate}</p>}
                </div>
                <svg className={`w-4 h-4 text-gray-300 transition-transform ${expandedStep === step.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedStep === step.id && (
                <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-gray-50 pt-2.5">
                  <p className="text-xs text-gray-600">{step.description}</p>

                  {/* 材料清单（带勾选） */}
                  {step.materials && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-500">材料清单</p>
                        <p className="text-[10px] text-blue-500 font-medium">{checkedCount}/{totalMaterials} 已准备</p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: totalMaterials ? `${(checkedCount/totalMaterials)*100}%` : '0%' }} />
                      </div>
                      {step.materials.map((m, i) => (
                        <label key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                          checkedMaterials[m.name] ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                        }`}>
                          <input type="checkbox" checked={!!checkedMaterials[m.name]} onChange={() => toggleMaterial(m.name)}
                            className="mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs ${checkedMaterials[m.name] ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                              {m.required && <span className="text-red-400 mr-1">*</span>}{m.name}
                            </span>
                            <p className="text-[10px] text-gray-400">{m.note}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 操作步骤 */}
                  {step.actions && (
                    <div className="space-y-1">
                      {step.actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {step.tips && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-amber-700">💡 {step.tips}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ========== 投诉回复话术 Tab ==========
  function renderReply() {
    if (!reply) return <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>

    const REPLY_SECTIONS = [
      { key: 'first_reply', label: '首次回复（24h内发出）', icon: '⚡', urgency: '紧急' },
      { key: 'resolution', label: '处理方案回复', icon: '✅', urgency: '处理中' },
      { key: 'close', label: '结单引导话术', icon: '🎯', urgency: '收尾' },
    ]

    return (
      <div className="space-y-3">
        {/* 投诉类型选择 */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[10px] text-gray-500 font-medium mb-2">选择投诉类型，生成对应话术：</p>
          <div className="flex flex-wrap gap-1.5">
            {COMPLAINT_TYPES.map(t => (
              <button key={t} onClick={() => handleComplaintType(t)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  selectedComplaintType === t
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                }`}>{t}</button>
            ))}
          </div>
        </div>

        {/* 时间线提醒 */}
        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
          <h4 className="text-xs font-bold text-red-700 mb-1.5">⏰ 投诉处理时间要求</h4>
          {Object.entries(reply.timeline_tips).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 mb-1">
              <span className="text-[10px] font-bold text-red-500 flex-shrink-0 mt-0.5">{k}</span>
              <span className="text-[10px] text-red-600">{v}</span>
            </div>
          ))}
        </div>

        {/* 话术模板 */}
        {REPLY_SECTIONS.map(s => {
          const text = reply.templates?.[s.key] || ''
          const isCopied = copiedKey === s.key
          return (
            <div key={s.key} className="bg-white rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{s.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-md font-medium">{s.urgency}</span>
                </div>
                <button onClick={() => copyText(text, s.key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                    isCopied ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-blue-300'
                  }`}>{isCopied ? '✓ 已复制' : '复制'}</button>
              </div>
              <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{text}</div>
            </div>
          )
        })}

        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-[10px] text-amber-700">💡 话术中的 {'{}'} 部分需要根据实际情况替换。复制后粘贴到微信支付商户平台 → 账户中心 → 消费者投诉 → 回复用户。</p>
        </div>
      </div>
    )
  }

  // ========== 95017电话话术 Tab ==========
  function renderPhone() {
    if (!reply?.phone_script) return <div className="text-center py-10 text-gray-400 text-sm">请先收集商户信息</div>
    const ps = reply.phone_script

    return (
      <div className="space-y-3">
        {/* 准备信息 */}
        <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-100">
          <h4 className="text-xs font-bold text-blue-700 mb-2">📋 拨打前准备</h4>
          <div className="text-xs text-blue-800 whitespace-pre-wrap leading-relaxed">{ps.preparation}</div>
        </div>

        {/* 拨打步骤 */}
        <div className="bg-white rounded-xl p-3.5 border border-gray-100">
          <h4 className="text-xs font-bold text-gray-700 mb-2">📞 拨打步骤</h4>
          <div className="space-y-2">
            {ps.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                <span className="text-xs text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 话术脚本 */}
        <div className="bg-white rounded-xl p-3.5 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700">🎙️ 参考话术</h4>
            <button onClick={() => copyText(ps.script, 'phone_script')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                copiedKey === 'phone_script' ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-blue-300'
              }`}>{copiedKey === 'phone_script' ? '✓ 已复制' : '复制话术'}</button>
          </div>
          <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-green-50 rounded-lg p-3 border border-green-100">
            {ps.script}
          </div>
        </div>

        {/* 注意事项 */}
        <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
          <h4 className="text-xs font-bold text-amber-700 mb-2">⚠️ 注意事项</h4>
          <div className="space-y-1">
            {ps.tips.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-500 text-[10px] mt-0.5">•</span>
                <span className="text-[11px] text-amber-700">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 一键拨打 */}
        <a href="tel:95017" className="block w-full text-center py-3 bg-green-500 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all">
          📞 一键拨打 95017
        </a>
      </div>
    )
  }

  const TABS = [
    { key: 'guide', label: '申诉流程', icon: '🗺️' },
    { key: 'reply', label: '投诉话术', icon: '💬' },
    { key: 'phone', label: '95017话术', icon: '📞' },
  ]

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] z-50 flex flex-col bg-white shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div>
          <h2 className="text-sm font-bold text-gray-800">申诉全流程指导</h2>
          <p className="text-[10px] text-gray-400">流程指导 + 投诉话术 + 电话话术</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-white/50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${
              tab === t.key
                ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/30'
                : 'text-gray-400 hover:text-gray-600'
            }`}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {tab === 'guide' && renderGuide()}
        {tab === 'reply' && renderReply()}
        {tab === 'phone' && renderPhone()}
      </div>
    </div>
  )
}
