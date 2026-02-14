import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import ErrorBoundary from './components/ErrorBoundary'

// 懒加载重试：部署新版本后旧chunk会404，自动重试一次并刷新缓存
function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch(() => {
      // chunk加载失败，加时间戳绕过缓存重试一次
      return new Promise(resolve => setTimeout(resolve, 1000))
        .then(() => importFn())
        .catch(() => {
          // 两次都失败，强制刷新页面加载最新资源
          const reloaded = sessionStorage.getItem('chunk_reload')
          if (!reloaded) {
            sessionStorage.setItem('chunk_reload', '1')
            window.location.reload()
          }
          // 防止无限刷新：返回一个提示组件
          return { default: () => (
            <div style={{padding:'40px',textAlign:'center',color:'#666'}}>
              <p>页面资源加载失败，请手动刷新浏览器</p>
              <button onClick={() => { sessionStorage.removeItem('chunk_reload'); window.location.reload() }}
                style={{marginTop:'12px',padding:'8px 24px',background:'#07C160',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer'}}>
                刷新页面
              </button>
            </div>
          )}
        })
    })
  )
}

const AdminPage = lazyRetry(() => import('./pages/AdminPage'))
const AdminLogin = lazyRetry(() => import('./pages/AdminLogin'))
const ServicePage = lazyRetry(() => import('./pages/ServicePage'))

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
      <p className="text-gray-500 text-sm">加载中...</p>
    </div>
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminPage />} />
            <Route path="/service/:orderNo" element={<ServicePage />} />
            <Route path="/recharge-success" element={<ChatPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  )
}
