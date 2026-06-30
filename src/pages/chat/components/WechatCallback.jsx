import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeOAuthCode, setAuth, needsPhoneBind, normalizeUser } from '../../../lib/auth.js'

export default function WechatCallback({ onAuthed }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const err = searchParams.get('error') || searchParams.get('error_description')

    if (err) {
      setError(String(err))
      setLoading(false)
      return
    }
    if (!code) {
      setError('未收到授权码，请重新登录')
      setLoading(false)
      return
    }

    const returnPath = sessionStorage.getItem('oauth_return_path') || '/chat/'

    exchangeOAuthCode(code, state, returnPath)
      .then(data => {
        const user = normalizeUser(data.user)
        setAuth(data.token, user)
        sessionStorage.removeItem('oauth_return_path')
        const dest = needsPhoneBind(user) ? '/?bindPhone=1' : '/'
        if (onAuthed) {
          onAuthed(user, needsPhoneBind(user))
        } else {
          navigate(dest, { replace: true })
        }
      })
      .catch(e => {
        setError(e.message || '授权失败')
        setLoading(false)
      })
  }, [])

  if (loading && !error) {
    return (
      <div className="auth-page">
        <div className="auth-wechat-boot">
          <div className="auth-spinner" />
          <p>正在登录...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card mp-card" style={{ padding: 24, textAlign: 'center' }}>
        <p className="auth-error" style={{ marginBottom: 16 }}>{error}</p>
        <button type="button" className="auth-submit" onClick={() => navigate('/', { replace: true })}>
          返回登录
        </button>
      </div>
    </div>
  )
}
