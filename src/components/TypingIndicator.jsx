import React from 'react'

export default function TypingIndicator() {
  return (
    <div className="flex justify-start my-2.5 message-animate">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#07C160] to-[#059669] flex items-center justify-center mr-2 sm:mr-2.5 mt-0.5 shadow-sm">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="bg-white rounded-[20px] rounded-tl-[6px] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-bubble)' }}>
        <div className="flex gap-1.5 items-center">
          <div className="typing-dot w-1.5 h-1.5 bg-[#07C160]/40 rounded-full"></div>
          <div className="typing-dot w-1.5 h-1.5 bg-[#07C160]/40 rounded-full"></div>
          <div className="typing-dot w-1.5 h-1.5 bg-[#07C160]/40 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}
