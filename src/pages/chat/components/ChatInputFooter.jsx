import React from 'react'
import { getQuickReplies } from '../getQuickReplies.js'
import { getStreamStatusLabel, shouldShowInputStreamHint } from '../../../lib/streamStatus.js'

export default function ChatInputFooter({
  input,
  setInput,
  loading,
  streamStatus,
  inputRef,
  isProfessionalMode,
  messages,
  collectedInfo,
  infoProgress,
  onSend,
  onKeyDown,
}) {
  const quickReplies = !input && !loading
    ? getQuickReplies({ messages, collectedInfo, infoProgress })
    : []

  return (
    <footer className="chat-input-area flex-shrink-0">
      {loading && streamStatus && shouldShowInputStreamHint(streamStatus) && (
        <div className="chat-stream-hint">
          <span className="chat-stream-hint-dot" />
          <span>{getStreamStatusLabel(streamStatus)}</span>
        </div>
      )}
      <div className="chat-input-inner">
        {quickReplies.length > 0 && (
          <div className="chat-quick-replies no-scrollbar">
            {quickReplies.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                className={`quick-chip ${isProfessionalMode ? 'pro' : ''}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <div className="chat-input-pill">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isProfessionalMode ? '描述您的情况...' : '输入消息...'}
              rows={1}
              disabled={loading}
              className="chat-textarea"
              onInput={e => {
                e.target.style.height = '36px'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || loading}
              className={`chat-send-btn ${input.trim() && !loading ? 'ready' : ''}`}
              aria-label="发送"
            >
              {loading ? (
                <svg className="w-[16px] h-[16px] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
