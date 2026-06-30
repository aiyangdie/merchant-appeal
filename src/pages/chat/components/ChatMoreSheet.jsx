import React from 'react'

function SheetItem({ label, desc, onClick, danger, highlight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chat-more-item ${danger ? 'danger' : ''} ${highlight ? 'highlight' : ''}`}
    >
      <span className="item-text">
        <span className="item-label">{label}</span>
        {desc && <span className="item-desc">{desc}</span>}
      </span>
      <svg className="item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default function ChatMoreSheet({
  open,
  onClose,
  boundOrder,
  contactAvailable,
  canExport,
  onNewChat,
  onOpenHistory,
  onBindOrder,
  onRecharge,
  onContact,
  onApiMode,
  onExport,
  onLogout,
  onOpenTheme,
}) {
  if (!open) return null

  return (
    <div className="chat-more-overlay" onClick={onClose}>
      <div className="chat-more-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">更多</h3>
        <div className="sheet-list">
          <SheetItem label="新对话" desc="开始全新咨询" onClick={() => { onClose(); onNewChat() }} />
          <SheetItem label="历史对话" onClick={() => { onClose(); onOpenHistory() }} />
          <SheetItem
            label="绑定订单"
            desc={boundOrder ? '已绑定，点击更换' : '关联闲鱼订单'}
            highlight={!!boundOrder}
            onClick={() => { onClose(); onBindOrder() }}
          />
          <SheetItem label="账户充值" onClick={() => { onClose(); onRecharge() }} />
          {contactAvailable && (
            <SheetItem label="联系技术人员" onClick={() => { onClose(); onContact() }} />
          )}
          <SheetItem label="主题颜色" desc="切换界面配色" onClick={() => { onClose(); onOpenTheme?.() }} />
          <SheetItem label="AI 服务模式" onClick={() => { onClose(); onApiMode() }} />
          {canExport && (
            <SheetItem label="导出对话" onClick={() => { onClose(); onExport() }} />
          )}
          <SheetItem label="退出登录" danger onClick={() => { onClose(); onLogout() }} />
        </div>
        <button type="button" className="sheet-cancel" onClick={onClose}>取消</button>
      </div>
    </div>
  )
}
