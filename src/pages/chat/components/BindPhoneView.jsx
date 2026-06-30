import React, { useState } from 'react'
import UserAvatar from '../../../components/UserAvatar'
import { completeProfile, isRealPhone } from '../../../lib/auth.js'
import { isChinese } from '../utils.js'

export default function BindPhoneView({ user, onSuccess }) {
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!isRealPhone(phone.trim())) {
      setError('请输入正确的11位手机号（必填）')
      return
    }
    const name = nickname.trim()
    if (name && !isChinese(name)) {
      setError('昵称必须为中文')
      return
    }
    setLoading(true)
    try {
      const u = await completeProfile({
        phone: phone.trim(),
        nickname: name || undefined,
      })
      onSuccess(u)
    } catch (err) {
      setError(err.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card mp-card bind-phone-card">
        <UserAvatar url={user?.avatarUrl} name={user?.nickname} size={72} style={{ borderRadius: '50%' }} />
        <h2 className="bind-title">绑定手机号</h2>
        <p className="bind-sub">微信登录后必须绑定手机号，用于通知与账号安全</p>
        <form onSubmit={submit} className="auth-form">
          <label>手机号 <span className="req">*</span></label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="11位手机号"
            maxLength={11}
            autoFocus
            required
          />
          <label>昵称（可选）</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="不填则保留微信昵称"
            maxLength={20}
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '保存中...' : '完成绑定并进入'}
          </button>
        </form>
      </div>
    </div>
  )
}
