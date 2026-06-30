import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  isWechatUA, getOAuthConfig, getOAuthUrl, canStartOAuthRedirect,
  loginWithPhone, registerWithPhone, isRealPhone,
} from '../../../lib/auth.js'
import { isChinese } from '../utils.js'

export default function AuthView({ onSuccess }) {
  const [mode, setMode] = useState('login')
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthEnabled, setOauthEnabled] = useState(false)
  const [oauthRedirecting, setOauthRedirecting] = useState(false)
  const [wechatBooting, setWechatBooting] = useState(isWechatUA())

  async function startWechatLogin() {
    if (!canStartOAuthRedirect()) {
      setError('正在跳转授权，请稍候...')
      return
    }
    setOauthRedirecting(true)
    setError('')
    try {
      sessionStorage.setItem('oauth_return_path', '/chat/')
      const { url } = await getOAuthUrl('/chat/')
      window.location.href = url
    } catch (e) {
      setError(e.message)
      setOauthRedirecting(false)
      setWechatBooting(false)
    }
  }

  async function submit(e) {
    e?.preventDefault()
    setError('')
    if (!isRealPhone(phone.trim())) {
      setError('请输入正确的11位手机号')
      return
    }
    if (mode === 'register') {
      const name = nickname.trim()
      if (!name) { setError('请输入中文昵称'); return }
      if (!isChinese(name)) { setError('昵称必须为中文'); return }
    }
    setLoading(true)
    try {
      const data = mode === 'register'
        ? await registerWithPhone(phone.trim(), nickname.trim())
        : await loginWithPhone(phone.trim())
      onSuccess(data.user)
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await getOAuthConfig()
        if (cancelled) return
        setOauthEnabled(cfg.enabled)
        if (isWechatUA() && cfg.enabled) {
          await startWechatLogin()
          return
        }
      } catch {
        if (!cancelled) setOauthEnabled(false)
      }
      if (!cancelled) setWechatBooting(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (wechatBooting) {
    return (
      <div className="auth-page">
        <div className="auth-wechat-boot">
          <div className="auth-spinner" />
          <p>正在微信授权登录...</p>
          <p className="auth-sub">请稍候</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card mp-card">
        <div className="auth-brand">
          <div className="auth-logo">申</div>
          <h1>商户申诉助手</h1>
          <p>AI 辅助 · 微信商户申诉与尽调</p>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>注册</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            <label>手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="11位手机号"
              maxLength={11}
              autoComplete="tel"
            />
            {mode === 'register' && (
              <>
                <label>中文昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="用于显示的名称"
                  maxLength={20}
                />
              </>
            )}
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '处理中...' : mode === 'register' ? '注册并登录' : '手机号登录'}
            </button>
          </form>

          {oauthEnabled && !isWechatUA() && (
            <button type="button" className="auth-wechat-btn" disabled={oauthRedirecting} onClick={startWechatLogin}>
              {oauthRedirecting ? '跳转中...' : '微信授权登录'}
            </button>
          )}

          <p className="auth-hint">微信登录后需绑定手机号方可使用</p>
        </div>
      </div>
      <Link to="/admin" className="auth-admin-link">管理员入口</Link>
    </div>
  )
}
