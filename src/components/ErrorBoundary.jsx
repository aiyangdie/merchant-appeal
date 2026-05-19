/**
 * 错误边界组件
 * @description 捕获子组件树中的 JavaScript 错误，防止整个应用崩溃
 * 
 * 核心功能：
 * 1. 错误捕获 — 使用 getDerivedStateFromError 和 componentDidCatch 捕获渲染期错误
 * 2. 自动恢复 — 检测 chunk 加载失败（部署更新后旧资源 404）时自动刷新一次
 * 3. 友好提示 — 显示错误页面，告知用户刷新页面
 * 4. 错误日志 — console.error 输出详细错误信息供开发调试
 * 
 * Chunk 加载失败检测规则：
 * - 错误消息包含 "loading chunk/module"
 * - 错误消息包含 "dynamically imported module"
 * - 错误消息包含 "failed to fetch"
 * 
 * 注意：使用 sessionStorage 防止无限刷新循环，刷新后清除标记
 */
import React from 'react'

/**
 * React 错误边界类组件
 * @classdesc 捕获子组件渲染错误并显示降级 UI
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo)
    this.setState({ error, errorInfo })
    // chunk加载失败（部署更新后旧资源404）→ 自动刷新一次
    const isChunkError = error?.message && (
      /loading.*(chunk|module)/i.test(error.message) ||
      /dynamically imported module/i.test(error.message) ||
      /failed to fetch/i.test(error.message)
    )
    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1')
      window.location.reload()
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk_reload')
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-dvh bg-[#f5f5f5] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">页面出现异常</h2>
        <p className="text-sm text-gray-500 mb-2">很抱歉，页面遇到了一个错误。请刷新页面重试。</p>
        {this.state.error && (
          <p className="text-xs text-red-400 mb-4 break-all font-mono bg-red-50 px-3 py-2 rounded-lg">
            {this.state.error.message || String(this.state.error)}
          </p>
        )}
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 bg-gradient-to-r from-[#07C160] to-[#06ae56] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
