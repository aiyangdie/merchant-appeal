import React from 'react'
import SessionItem from './SessionItem.jsx'

export default function HistoryDrawer({
  open,
  onClose,
  loading,
  sessions,
  fmtTime,
  onNewChat,
  onViewAll,
  onView,
  onContinue,
  onDelete,
}) {
  return (
    <>
      <div className={`history-drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`history-drawer ${open ? 'open' : ''} bg-white flex flex-col`}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 safe-top">
          <h2 className="text-sm font-semibold text-gray-900">历史对话</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onNewChat() }} className="text-xs text-[#07C160] font-medium">新对话</button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-xs">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-gray-400 text-xs">暂无历史对话</p>
            </div>
          ) : (
            <div className="py-2">
              {sessions.map(s => (
                <SessionItem
                  key={s.id}
                  session={s}
                  fmtTime={fmtTime}
                  onView={() => onView(s.id)}
                  onContinue={() => onContinue(s.id)}
                  onDelete={() => onDelete(s.id)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 flex-shrink-0 safe-bottom">
          <button onClick={() => { onClose(); onViewAll() }} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg font-medium">
            查看全部历史记录
          </button>
        </div>
      </div>
    </>
  )
}
