import React from 'react'

const TITLES = {
  home: '微信商户申诉',
  chat: '微信商户申诉',
  tools: '申诉工具',
  cases: '我的案件',
  me: '个人中心',
  pro: '微信申诉工作台',
}

export default function ChatHeader({
  tab = 'chat',
  isProfessionalMode,
  infoProgress,
  collectedInfo,
  infoTotal,
  boundOrder,
  onOpenHistory,
  onOpenMore,
}) {
  const filledCount = infoProgress?.filled ?? Object.keys(collectedInfo).filter(k => collectedInfo[k] && String(collectedInfo[k]).trim()).length
  const totalCount = infoProgress?.total ?? infoTotal
  const collecting = isProfessionalMode && totalCount > 0 && filledCount < totalCount

  const title = isProfessionalMode && tab === 'chat'
    ? TITLES.pro
    : (TITLES[tab] || TITLES.chat)

  return (
    <header className="mp-header mp-header-minimal flex-shrink-0 safe-top">
      {tab === 'chat' ? (
        <button type="button" className="mp-header-btn" onClick={onOpenHistory} aria-label="历史对话">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      ) : (
        <div className="mp-header-btn" aria-hidden />
      )}

      <div className="mp-header-center">
        <h1 className="mp-header-title">{title}</h1>
        {tab === 'chat' && boundOrder && (
          <p className="mp-header-bound">
            已关联 · {boundOrder.goods?.title || boundOrder.order_no}
          </p>
        )}
        {tab === 'chat' && !boundOrder && collecting && (
          <p className="mp-header-sub">收集中 {filledCount}/{totalCount}</p>
        )}
      </div>

      <button type="button" className="mp-capsule" onClick={onOpenMore} aria-label="更多">
        <span className="mp-capsule-dots">···</span>
        <span className="mp-capsule-sep" />
        <span className="mp-capsule-ring" />
      </button>
    </header>
  )
}
