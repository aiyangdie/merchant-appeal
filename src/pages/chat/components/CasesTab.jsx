import React, { useCallback, useEffect, useState } from 'react'
import { fetchCases, createSession } from '../../../lib/auth.js'

function fmtTime(t) {
  if (!t) return ''
  try {
    return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return t }
}

function statusLabel(s) {
  return s === 'active' ? '进行中' : s === 'completed' ? '已完成' : '已归档'
}

export default function CasesTab({ onOpenChat }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCases(await fetchCases())
    } catch (e) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function startConsult() {
    setCreating(true)
    try {
      const { sessionId } = await createSession()
      if (sessionId) onOpenChat(sessionId)
    } catch (e) {
      setError(e.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="cases-tab flex-1 flex items-center justify-center">
        <div className="auth-spinner" />
      </div>
    )
  }

  return (
    <div className="cases-tab flex-1 min-h-0 overflow-y-auto">
      <div className="cases-inner">
        {error && (
          <div className="mp-card cases-empty">
            <p>{error}</p>
            <button type="button" className="auth-submit" style={{ marginTop: 12 }} onClick={load}>重试</button>
          </div>
        )}
        {!error && cases.length === 0 && (
          <div className="mp-card cases-empty">
            <p className="cases-empty-title">还没有案件</p>
            <p className="cases-empty-sub">开始咨询后，进度会显示在这里</p>
            <button type="button" className="auth-submit" disabled={creating} onClick={startConsult}>
              {creating ? '创建中...' : '开始咨询'}
            </button>
          </div>
        )}
        {!error && cases.length > 0 && (
          <ul className="cases-list">
            {cases.map(s => (
              <li key={s.id}>
                <button type="button" className="mp-card cases-item" onClick={() => onOpenChat(s.id)}>
                  <div className="cases-item-row">
                    <span className={`cases-tag ${s.scenario || ''}`}>{s.scenarioLabel || '申诉'}</span>
                    <span className={`cases-badge ${s.status}`}>{statusLabel(s.status)}</span>
                  </div>
                  <h3 className="cases-item-title">{s.title || '咨询会话'}</h3>
                  {s.preview && <p className="cases-item-preview">{s.preview}</p>}
                  <div className="cases-item-meta">
                    <span>{fmtTime(s.createdAt)}</span>
                    <span>{s.messageCount || 0} 条对话</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {cases.length > 0 && (
          <button type="button" className="cases-fab" disabled={creating} onClick={startConsult}>
            {creating ? '…' : '+'}
          </button>
        )}
      </div>
    </div>
  )
}
