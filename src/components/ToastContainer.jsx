/**
 * Toast 通知容器组件
 * @description 展示全局通知提示，支持成功、错误、警告、信息四种类型
 * 
 * 核心功能：
 * 1. 通知展示 — 顶部居中固定定位，z-index: 10000 确保最高层级
 * 2. 类型样式 — 根据 type 显示不同颜色（绿/红/黄/蓝）
 * 3. 入场动画 — animate-slideDown 滑入动画
 * 4. 点击关闭 — 点击通知区域触发 onDismiss 回调
 * 
 * 通知类型：
 * - success: 绿色，成功操作完成
 * - error: 红色，操作失败或错误
 * - warning: 黄色，警告或注意事项
 * - info: 蓝色，一般提示信息
 * 
 * @param {Object} props
 * @param {Array<{id: string|number, type: string, message: string}>} props.toasts - 通知列表数组
 * @param {Function} [props.onDismiss] - 关闭通知回调 (id) => void
 */
import React from 'react'

/**
 * 各类型通知的图标映射
 * @constant {Object<string, React.ReactNode>}
 */
const ICONS = {
  success: (
    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const BG_STYLES = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
}

const TEXT_STYLES = {
  success: 'text-green-800',
  error: 'text-red-800',
  warning: 'text-amber-800',
  info: 'text-blue-800',
}

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg animate-slideDown min-w-[280px] max-w-[90vw] ${BG_STYLES[toast.type] || BG_STYLES.info}`}
          onClick={() => onDismiss?.(toast.id)}
        >
          {ICONS[toast.type] || ICONS.info}
          <span className={`text-sm font-medium flex-1 ${TEXT_STYLES[toast.type] || TEXT_STYLES.info}`}>
            {toast.message}
          </span>
          <button className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
