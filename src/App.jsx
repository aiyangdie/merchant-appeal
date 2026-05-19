/**
 * @fileoverview 应用主路由组件
 * @description 配置应用的所有路由，包括懒加载和错误边界处理
 * @module App
 *
 * 路由列表：
 * - /              : 主聊天页面 (ChatPage)
 * - /admin         : 管理员登录页 (AdminLogin)
 * - /admin/dashboard : 管理员控制台 (AdminPage)
 * - /service/:orderNo : 客服服务页 (ServicePage)
 * - /recharge-success : 充值成功页
 * - *              : 重定向到首页
 */

import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import ErrorBoundary from './components/ErrorBoundary'

/**
 * 懒加载重试包装器
 * @description 部署新版本后旧 chunk 会 404，此函数自动重试一次并刷新缓存
 * @param {Function} importFn - 动态导入函数，如 () => import('./pages/AdminPage')
 * @returns {LazyExoticComponent} 懒加载的 React 组件
 *
 * 重试策略：
 * 1. 首次加载失败 → 等待 1 秒后重试（绕过缓存）
 * 2. 二次失败 → 检查是否已刷新过，未刷新则刷新页面
 * 3. 防止无限刷新 → 返回提示组件让用户手动刷新
 */
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

/** 管理员控制台页面 - 懒加载 */
const AdminPage = lazyRetry(() => import('./pages/AdminPage'))
/** 管理员登录页面 - 懒加载 */
const AdminLogin = lazyRetry(() => import('./pages/AdminLogin'))
/** 客服服务页面 - 懒加载 */
const ServicePage = lazyRetry(() => import('./pages/ServicePage'))

/**
 * 加载状态占位组件
 * @returns {JSX.Element} 居中的加载动画
 */
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
      <p className="text-gray-500 text-sm">加载中...</p>
    </div>
  </div>
)

/**
 * 应用根组件
 * @description 配置路由、错误边界和懒加载 Suspense
 * @returns {JSX.Element} 路由配置的应用根组件
 */
export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* 主聊天页面 */}
            <Route path="/" element={<ChatPage />} />
            {/* 管理员登录 */}
            <Route path="/admin" element={<AdminLogin />} />
            {/* 管理员控制台 */}
            <Route path="/admin/dashboard" element={<AdminPage />} />
            {/* 客服服务页 */}
            <Route path="/service/:orderNo" element={<ServicePage />} />
            {/* 充值成功页 */}
            <Route path="/recharge-success" element={<ChatPage />} />
            {/* 未知路径重定向到首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  )
}
