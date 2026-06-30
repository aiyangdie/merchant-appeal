import React from 'react'
import UserAvatar from '../../../components/UserAvatar'

function BentoIcon({ variant, children }) {
  return (
    <span className={`bento-icon-wrap bento-icon-wrap--${variant}`}>
      {children}
    </span>
  )
}

export default function HomeTab({ user, onGoChat, onGoTools, onGoCases }) {
  return (
    <div className="home-tab flex-1 min-h-0 overflow-y-auto">
      <div className="home-inner">
        <div className="home-greet">
          <UserAvatar url={user?.avatarUrl} name={user?.nickname} size={52} style={{ borderRadius: '50%' }} />
          <div>
            <p className="home-hi">{user?.nickname ? `你好，${user.nickname}` : '你好'}</p>
            <p className="home-sub">微信商户申诉 · AI 专业顾问</p>
          </div>
        </div>

        <div className="home-stat-row mp-card">
          <div className="home-stat">
            <span className="home-stat-num">¥{parseFloat(user?.balance || 0).toFixed(2)}</span>
            <span className="home-stat-label">账户余额</span>
          </div>
        </div>

        <div className="bento-section-title">
          <span className="bento-section-bar" />
          <span>快捷入口</span>
        </div>
        <div className="bento-grid bento-grid-2">
          <button type="button" className="bento-card bento-green bento-large" onClick={onGoChat}>
            <BentoIcon variant="green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </BentoIcon>
            <span className="bento-label">开始咨询</span>
            <span className="bento-desc">AI 智能对话，逐步收集申诉信息</span>
          </button>
          <button type="button" className="bento-card bento-blue" onClick={onGoCases}>
            <BentoIcon variant="blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </BentoIcon>
            <span className="bento-label">我的案件</span>
            <span className="bento-desc">查看历史会话与进度</span>
          </button>
          <button type="button" className="bento-card bento-teal" onClick={onGoTools}>
            <BentoIcon variant="teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </BentoIcon>
            <span className="bento-label">申诉工具</span>
            <span className="bento-desc">文案、材料、指导一站式</span>
          </button>
        </div>
      </div>
    </div>
  )
}
