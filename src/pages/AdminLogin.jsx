import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('admin_token', data.token)
        navigate('/admin/dashboard')
      } else {
        setError('用户名或密码错误')
      }
    } catch (err) {
      setError('登录失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#07C160] to-[#06ae56] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">管理后台</h1>
          <p className="text-[13px] text-gray-400 mt-1">微信商户号申诉助手</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {error && (
            <div className="bg-red-50 text-red-500 text-[12px] px-3 py-2 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-[13px] focus:ring-2 focus:ring-[#07C160]/20 focus:border-[#07C160]/40 transition-all placeholder:text-gray-300"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-[13px] focus:ring-2 focus:ring-[#07C160]/20 focus:border-[#07C160]/40 transition-all placeholder:text-gray-300"
              placeholder="请输入密码"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white rounded-xl text-[13px] font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-[10px] text-gray-300 mt-2">
            请使用管理员账号登录
          </p>
        </form>

        <div className="text-center mt-5">
          <a href="/" className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors">
            返回首页
          </a>
        </div>
      </div>
    </div>
  )
}
