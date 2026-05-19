/**
 * AI 正在输入指示器
 * @description 显示 AI 助手正在生成回复的动画指示器
 * 
 * 视觉效果：
 * - 左侧显示 AI 头像（普通模式绿色 / 专业模式金色）
 * - 右侧白色气泡内三个圆点依次闪烁（typingDot 动画）
 * - 入场动画 message-animate 滑入效果
 * 
 * @param {Object} props
 * @param {boolean} [props.proMode=false] - 是否为专业模式（金色主题）
 */
import React from 'react'

/**
 * 正在输入指示器组件
 * @description 显示三个跳动圆点的动画，表示 AI 正在生成回复
 * @param {Object} props
 * @param {boolean} [props.proMode=false] - 是否为专业模式（影响颜色和主题）
 */
export default function TypingIndicator({ proMode = false }) {
  return (
    <div className="flex justify-start my-2.5 message-animate">
      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mr-2 sm:mr-2.5 mt-0.5 shadow-sm ${
        proMode ? 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-500/15' : 'bg-gradient-to-br from-[#07C160] to-[#059669]'
      }`}>
        {proMode ? (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </div>
      <div className={`rounded-[20px] rounded-tl-[6px] px-4 py-3.5 ${
        proMode ? 'pro-bubble-ai' : 'bg-white'
      }`} style={proMode ? {} : { boxShadow: 'var(--shadow-bubble)' }}>
        <div className="flex gap-1.5 items-center">
          <div className={`typing-dot w-1.5 h-1.5 rounded-full ${proMode ? 'bg-amber-400/60' : 'bg-[#07C160]/40'}`}></div>
          <div className={`typing-dot w-1.5 h-1.5 rounded-full ${proMode ? 'bg-amber-400/60' : 'bg-[#07C160]/40'}`}></div>
          <div className={`typing-dot w-1.5 h-1.5 rounded-full ${proMode ? 'bg-amber-400/60' : 'bg-[#07C160]/40'}`}></div>
        </div>
      </div>
    </div>
  )
}
