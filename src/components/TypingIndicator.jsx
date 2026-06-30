import React from 'react'

export default function TypingIndicator({ proMode = false }) {
  return (
    <div className={`chat-bubble-row chat-bubble-row--ai ${proMode ? 'chat-bubble-row--pro' : ''} message-animate`}>
      <div className={`msg-avatar msg-avatar--ai ${proMode ? 'msg-avatar--pro' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="chat-bubble-col">
        <div className={`chat-bubble chat-bubble--ai ${proMode ? 'chat-bubble--pro' : ''}`}>
          <div className="chat-bubble-label">{proMode ? 'AI 专业顾问' : 'AI 助手'}</div>
          <div className="flex gap-1.5 items-center py-1">
            <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
            <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
            <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
          </div>
        </div>
      </div>
    </div>
  )
}
