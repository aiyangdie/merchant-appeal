import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
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
            <p className="text-sm text-gray-500 mb-6">很抱歉，页面遇到了一个错误。请刷新页面重试。</p>
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
