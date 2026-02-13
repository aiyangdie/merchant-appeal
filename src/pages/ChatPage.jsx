import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ChatMessage from '../components/ChatMessage'
import TypingIndicator from '../components/TypingIndicator'
import InfoPanel from '../components/InfoPanel'
import AIAnalysisPanel from '../components/AIAnalysisPanel'
import AppealTextPanel from '../components/AppealTextPanel'
import UserCenter from '../components/UserCenter'

const WELCOME = `您好！我是您的微信商户号申诉顾问~

商户号出问题了别着急，我来帮您搞定。先简单聊几句，了解一下您的情况，然后帮您写申诉材料。

💼 您是做什么生意的？

比如：卖衣服、做餐饮、搞游戏、做陪玩、卖课程、开超市……随便说就行，我能听懂~

💡 右边面板会实时显示您提供的信息，随时能看能改。
💡 有问题随时问我，比如"为什么要这个"。
🔒 您的信息只用于本次咨询，不会泄露。`

// ========== 视图模式 ==========
// 'auth'      — 登录/注册（手机号 + 中文名）
// 'apiSelect' — 选择 API 模式
// 'chat'      — 正常聊天
// 'myHistory' — 我的历史对话列表
// 'history'   — 只读查看某条历史会话

function isChinese(str) {
  if (!str) return false
  return /^[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}]+$/u.test(str.trim())
}

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // 用户状态
  const [user, setUser] = useState(null)
  const [authPhone, setAuthPhone] = useState('')
  const [authNickname, setAuthNickname] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const tokenRef = useRef(localStorage.getItem('appeal_token') || '')

  function getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' }
    if (tokenRef.current) h['Authorization'] = `Bearer ${tokenRef.current}`
    return h
  }
  function saveToken(token) {
    tokenRef.current = token || ''
    if (token) localStorage.setItem('appeal_token', token)
    else localStorage.removeItem('appeal_token')
  }
  function handleAuthExpired() {
    saveToken('')
    localStorage.removeItem('appeal_user')
    localStorage.removeItem('appeal_session_id')
    setUser(null); setSessionId(null); setMessages([]); setLoading(false)
    setView('auth'); setAuthPhone(''); setAuthNickname(''); setAuthError('登录已过期，请重新登录')
  }

  // API 模式选择
  const [selectedApiMode, setSelectedApiMode] = useState('official')
  const [customKey, setCustomKey] = useState('')
  const [apiModeError, setApiModeError] = useState('')
  const [apiModeSaving, setApiModeSaving] = useState(false)

  // 视图 + 历史
  const [view, setView] = useState('auth')
  const [mySessions, setMySessions] = useState([])
  const [mySessionsLoading, setMySessionsLoading] = useState(false)
  const [historyMessages, setHistoryMessages] = useState([])
  const [historySession, setHistorySession] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // 历史侧边栏（右滑打开）
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deletedSessions, setDeletedSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appeal_deleted_sessions') || '[]') } catch { return [] }
  })
  const touchRef = useRef({ startX: 0, startY: 0, dragging: false })

  // 充值
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeConfig, setRechargeConfig] = useState(null)
  const [rechargeAmount, setRechargeAmount] = useState(null)
  const [rechargeMethod, setRechargeMethod] = useState('wechat')
  const [rechargeRemark, setRechargeRemark] = useState('')
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false)

  // 清理 collectedData：去掉内部 _ 前缀字段，确保所有值都是字符串
  function sanitizeCollected(raw) {
    if (!raw || typeof raw !== 'object') return {}
    const clean = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue
      clean[k] = typeof v === 'string' ? v : (v != null ? String(v) : '')
    }
    return clean
  }

  // 信息收集面板
  const [collectedInfo, setCollectedInfo] = useState({})
  const [infoFields, setInfoFields] = useState([])
  const [infoStep, setInfoStep] = useState(0)
  const [infoTotal, setInfoTotal] = useState(14)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showAppealPanel, setShowAppealPanel] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [analysisKey, setAnalysisKey] = useState(0) // force re-fetch analysis
  const [newChatAnim, setNewChatAnim] = useState(false) // new chat transition
  const [chatFading, setChatFading] = useState(false) // fade-out before reset

  useEffect(() => {
    if (view === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, view])

  // 发送完成后自动聚焦输入框（loading 变为 false 后 DOM 已更新，此时 focus 才生效）
  useEffect(() => {
    if (!loading && view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [loading, view])

  // 恢复用户登录状态
  useEffect(() => {
    const savedUser = localStorage.getItem('appeal_user')
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser)
        fetch(`/api/user/${u.id}`, { headers: getAuthHeaders() })
          .then(r => {
            if (r.status === 401) { handleAuthExpired(); setReady(true); return null }
            if (!r.ok) {
              // 用户已被删除或不存在 → 清除本地状态，跳转登录
              localStorage.removeItem('appeal_user')
              localStorage.removeItem('appeal_session_id')
              localStorage.removeItem('appeal_token')
              setUser(null); setView('auth'); setReady(true)
              return null
            }
            return r.json()
          })
          .then(data => {
            if (!data) return
            if (data?.user) {
              setUser(data.user)
              localStorage.setItem('appeal_user', JSON.stringify(data.user))
              restoreSession(data.user)
            } else {
              localStorage.removeItem('appeal_user')
              localStorage.removeItem('appeal_session_id')
              localStorage.removeItem('appeal_token')
              setView('auth'); setReady(true)
            }
          })
          .catch(() => { setUser(u); restoreSession(u) })
      } catch {
        localStorage.removeItem('appeal_user')
        setView('auth'); setReady(true)
      }
    } else {
      setView('auth'); setReady(true)
    }
  }, [])

  function restoreSession(u) {
    const saved = localStorage.getItem('appeal_session_id')
    if (saved) {
      Promise.all([
        fetch(`/api/sessions/${saved}/messages`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/sessions/${saved}/info`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
      ]).then(([msgData, infoData]) => {
        if (msgData?.messages?.length > 0) {
          setSessionId(saved)
          setMessages(msgData.messages)
          if (infoData) {
            setCollectedInfo(sanitizeCollected(infoData.collectedData))
            setInfoFields(infoData.fields || [])
            setInfoStep(infoData.step || 0)
            setInfoTotal(infoData.totalSteps || 14)
          }
        } else {
          localStorage.removeItem('appeal_session_id')
          setMessages([{ role: 'assistant', content: WELCOME }])
        }
        setView('chat'); setReady(true)
      }).catch(() => { setMessages([{ role: 'assistant', content: WELCOME }]); setView('chat'); setReady(true) })
    } else {
      setMessages([{ role: 'assistant', content: WELCOME }])
      setView('chat'); setReady(true)
    }
  }

  // ========== 注册/登录 ==========

  async function handleAuth() {
    const phone = authPhone.trim()
    if (!phone || phone.length < 2) { setAuthError('请输入有效的手机号'); return }
    if (authMode === 'register') {
      const name = authNickname.trim()
      if (!name) { setAuthError('请输入您的名称'); return }
      if (!isChinese(name)) { setAuthError('名称必须为中文'); return }
    }
    setAuthError(''); setAuthLoading(true)
    try {
      const url = authMode === 'register' ? '/api/user/register' : '/api/user/login'
      const body = authMode === 'register'
        ? { phone, nickname: authNickname.trim() }
        : { phone }
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setAuthError(data.error); return }
      if (data.user) {
        if (data.token) saveToken(data.token)
        setUser(data.user)
        localStorage.setItem('appeal_user', JSON.stringify(data.user))
        restoreSession(data.user)
      }
    } catch { setAuthError('网络错误，请重试') }
    finally { setAuthLoading(false) }
  }

  // ========== API 模式 ==========

  async function handleApiModeConfirm() {
    if (!user) return
    if (selectedApiMode === 'custom' && !customKey.trim()) {
      setApiModeError('请输入您的 DeepSeek API Key'); return
    }
    setApiModeError(''); setApiModeSaving(true)
    try {
      const res = await fetch(`/api/user/${user.id}/api-mode`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ api_mode: selectedApiMode, custom_api_key: customKey.trim() }),
      })
      const data = await res.json()
      if (data.error) { setApiModeError(data.error); return }
      if (data.user) {
        setUser(data.user)
        localStorage.setItem('appeal_user', JSON.stringify(data.user))
      }
      setView('chat')
    } catch { setApiModeError('保存失败，请重试') }
    finally { setApiModeSaving(false) }
  }

  // ========== 发送消息 ==========

  const lastFailedMsg = useRef(null)

  async function doStreamRequest(text, retryCount = 0) {
    const MAX_RETRIES = 2
    const res = await fetch('/api/chat/stream', {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, content: text, userId: user?.id }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      if (errData.needRecharge) {
        setMessages(prev => [...prev, { role: 'system', content: errData.error || '余额不足，请先充值后再继续对话。' }])
        return
      }
      if (errData.needLogin) { handleAuthExpired(); return }
      throw new Error(errData.error || '请求失败')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamingContent = ''
    let msgAdded = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'start') {
              if (parsed.sessionId && parsed.sessionId !== sessionId) {
                setSessionId(parsed.sessionId)
                localStorage.setItem('appeal_session_id', parsed.sessionId)
              }
              if (parsed.totalSteps) setInfoTotal(parsed.totalSteps)
              if (parsed.step !== undefined) setInfoStep(parsed.step)
            } else if (parsed.type === 'info_update') {
              setCollectedInfo(prev => ({ ...prev, [parsed.key]: parsed.value }))
              if (parsed.step !== undefined) setInfoStep(parsed.step)
              if (!infoFields.find(f => f.key === parsed.key)) {
                setInfoFields(prev => [...prev, { key: parsed.key, label: parsed.label, group: parsed.group, icon: parsed.icon }])
              }
              setShowInfoPanel(true)
              setAnalysisKey(prev => prev + 1)
            } else if (parsed.type === 'chunk') {
              streamingContent += parsed.content
              const currentContent = streamingContent
              if (!msgAdded) {
                msgAdded = true
                setLoading(false)
                setMessages(prev => [...prev, { role: 'assistant', content: currentContent }])
              } else {
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: currentContent }
                  return updated
                })
              }
            } else if (parsed.type === 'usage') {
              if (parsed.balance !== null && parsed.balance !== undefined && user) {
                const u = { ...user, balance: parsed.balance }
                setUser(u)
                localStorage.setItem('appeal_user', JSON.stringify(u))
              }
              // 附加 token 用量到最后一条 assistant 消息
              if (parsed.tokenUsage && msgAdded) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, tokenUsage: parsed.tokenUsage, balance: parsed.balance }
                  }
                  return updated
                })
              }
            } else if (parsed.type === 'timing') {
              // 附加延迟信息到最后一条 assistant 消息
              if (msgAdded) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      timing: { ...(last.timing || {}), ...parsed }
                    }
                  }
                  return updated
                })
              }
            } else if (parsed.type === 'error') {
              const role = parsed.needRecharge ? 'system' : 'assistant'
              if (!msgAdded) {
                msgAdded = true
                setMessages(prev => [...prev, { role, content: parsed.content }])
              } else {
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role, content: parsed.content }
                  return updated
                })
              }
              if (parsed.sessionId && parsed.sessionId !== sessionId) {
                setSessionId(parsed.sessionId)
                localStorage.setItem('appeal_session_id', parsed.sessionId)
              }
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      // 流读取中断（网络断开等）— 自动重试
      if (retryCount < MAX_RETRIES && !streamingContent) {
        console.log(`[重试] 第${retryCount + 1}次重试...`)
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
        return doStreamRequest(text, retryCount + 1)
      }
      throw streamErr
    }

    if (!msgAdded) {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，未收到回复，请重试。' }])
    }
    lastFailedMsg.current = null
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      await doStreamRequest(text)
    } catch (err) {
      console.error('Send error:', err)
      lastFailedMsg.current = text
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 网络出现问题，发送失败。', retryable: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleRetry() {
    const text = lastFailedMsg.current
    if (!text || loading) return
    // 移除上一条错误消息
    setMessages(prev => prev.filter(m => !m.retryable))
    setLoading(true)
    try {
      await doStreamRequest(text)
    } catch (err) {
      console.error('Retry error:', err)
      lastFailedMsg.current = text
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 重试仍然失败，请检查网络后再试。', retryable: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleNewChat() {
    // Smooth transition: fade out → reset → animate in
    setChatFading(true)
    setTimeout(() => {
      localStorage.removeItem('appeal_session_id')
      setSessionId(null)
      setMessages([{ role: 'assistant', content: WELCOME }])
      setCollectedInfo({}); setInfoFields([]); setInfoStep(0); setShowInfoPanel(false); setShowAIPanel(false); setAnalysisKey(0)
      setView('chat')
      setChatFading(false)
      setNewChatAnim(true)
      setTimeout(() => { setNewChatAnim(false); inputRef.current?.focus() }, 400)
    }, 150)
  }

  function handleFieldUpdate(key, value) {
    setCollectedInfo(prev => ({ ...prev, [key]: value }))
    setAnalysisKey(prev => prev + 1) // trigger AI analysis refresh
    // 在聊天中显示修改通知，让用户知道修改已生效
    const fieldDef = infoFields.find(f => f.key === key)
    const label = fieldDef ? fieldDef.label : key
    const display = value.length > 30 ? value.slice(0, 30) + '...' : value
    setMessages(prev => [...prev, { role: 'assistant', content: `✅ 已更新「${label}」为：${display}\n\n后续的申诉策略和材料会根据修改后的信息重新调整~` }])
  }

  function handleLogout() {
    saveToken('')
    localStorage.removeItem('appeal_user')
    localStorage.removeItem('appeal_session_id')
    setUser(null); setSessionId(null); setMessages([])
    setView('auth'); setAuthPhone(''); setAuthNickname(''); setAuthError('')
  }

  async function openRecharge() {
    setShowRecharge(true)
    setRechargeAmount(null)
    setRechargeRemark('')
    setRechargeMethod('wechat')
    try {
      const res = await fetch('/api/recharge/config')
      const data = await res.json()
      setRechargeConfig(data)
      if (data.amounts?.length) setRechargeAmount(data.amounts[0])
    } catch { setRechargeConfig(null) }
  }

  async function submitRecharge() {
    if (!rechargeAmount || !user) return
    setRechargeSubmitting(true)
    try {
      const res = await fetch('/api/recharge', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ amount: rechargeAmount, paymentMethod: rechargeMethod, remark: rechargeRemark }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      alert('充值申请已提交！管理员确认后余额将自动到账。')
      setShowRecharge(false)
    } catch { alert('提交失败，请稍后重试') }
    finally { setRechargeSubmitting(false) }
  }

  // ========== 我的历史对话 ==========

  async function loadMySessions() {
    if (!user) return
    setMySessionsLoading(true)
    try {
      const res = await fetch(`/api/user/${user.id}/sessions`, { headers: getAuthHeaders() })
      const data = await res.json()
      setMySessions(data.sessions || [])
    } catch { setMySessions([]) }
    finally { setMySessionsLoading(false) }
  }

  function openMyHistory() {
    setView('myHistory')
    loadMySessions()
  }

  // ========== 右滑手势打开历史侧边栏 ==========

  function handleTouchStart(e) {
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, dragging: false }
  }
  function handleTouchMove(e) {
    if (drawerOpen) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.startX
    const dy = t.clientY - touchRef.current.startY
    // 只在从左边缘开始且水平滑动时触发
    if (touchRef.current.startX < 30 && dx > 20 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      touchRef.current.dragging = true
    }
  }
  function handleTouchEnd() {
    if (touchRef.current.dragging) {
      setDrawerOpen(true)
      loadMySessions()
    }
    touchRef.current.dragging = false
  }

  function openDrawer() {
    setDrawerOpen(true)
    loadMySessions()
  }
  function closeDrawer() {
    setDrawerOpen(false)
  }

  // ========== 前端软删除（仅隐藏，后端保留） ==========

  function softDeleteSession(sid) {
    const updated = [...deletedSessions, sid]
    setDeletedSessions(updated)
    localStorage.setItem('appeal_deleted_sessions', JSON.stringify(updated))
    setMySessions(prev => prev.filter(s => s.id !== sid))
  }

  function getVisibleSessions() {
    return mySessions.filter(s => !deletedSessions.includes(s.id))
  }

  async function openHistory(sid) {
    setHistoryLoading(true); setHistorySession(null); setHistoryMessages([])
    setView('history')
    try {
      const res = await fetch(`/api/sessions/${sid}/messages`, { headers: getAuthHeaders() })
      const data = await res.json()
      setHistoryMessages(data.messages || [])
      setHistorySession({ id: sid })
    } catch { setHistoryMessages([{ role: 'assistant', content: '加载失败，请返回重试' }]) }
    finally { setHistoryLoading(false) }
  }

  function continueSession(sid) {
    setSessionId(sid)
    localStorage.setItem('appeal_session_id', sid)
    Promise.all([
      fetch(`/api/sessions/${sid}/messages`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/sessions/${sid}/info`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
    ]).then(([msgData, infoData]) => {
      setMessages(msgData?.messages || [])
      if (infoData) {
        setCollectedInfo(sanitizeCollected(infoData.collectedData))
        setInfoFields(infoData.fields || [])
        setInfoStep(infoData.step || 0)
        setInfoTotal(infoData.totalSteps || 14)
      }
      setAnalysisKey(prev => prev + 1)
      setView('chat')
    }).catch(() => setView('chat'))
  }

  function fmtTime(d) {
    if (!d) return ''
    try { const t = new Date(d); return isNaN(t.getTime()) ? String(d).slice(0,16) : t.toLocaleString('zh-CN') } catch { return String(d) }
  }

  // ========== 加载页 ==========
  if (!ready) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#07C160] to-[#06ae56] flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  // ========== 登录/注册视图 ==========
  if (view === 'auth') {
    return (
      <div className="min-h-screen min-h-dvh auth-bg flex items-center justify-center px-4 relative overflow-hidden">
        {/* 装饰性背景元素 */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-[#07C160]/[0.06] rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-400/[0.06] rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-purple-400/[0.05] rounded-full blur-2xl" />

        <div className="w-full max-w-sm animate-scale-in relative z-10">
          <div className="text-center mb-8">
            <div className="w-[72px] h-[72px] mx-auto mb-5 rounded-[22px] bg-gradient-to-br from-[#07C160] to-[#059669] flex items-center justify-center shadow-lg glow-green animate-float">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">商户号申诉助手</h1>
            <p className="text-sm text-gray-400 mt-1.5">AI 智能生成专业申诉材料</p>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/60" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex bg-gray-100/70 rounded-xl p-0.5 mb-5">
              <button onClick={() => { setAuthMode('login'); setAuthError('') }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-[10px] transition-all ${authMode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}>登录</button>
              <button onClick={() => { setAuthMode('register'); setAuthError('') }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-[10px] transition-all ${authMode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}>注册</button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">手机号</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                  </div>
                  <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAuth()}
                    placeholder="请输入手机号" autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200/80 bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#07C160]/20 focus:border-[#07C160]/50 focus:bg-white transition-all placeholder:text-gray-300" />
                </div>
              </div>
              {authMode === 'register' && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    名称 <span className="text-red-400">*</span>
                    <span className="text-gray-300 font-normal ml-1">必须中文</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    </div>
                    <input type="text" value={authNickname} onChange={e => setAuthNickname(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAuth()}
                      placeholder="请输入中文名称"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-gray-50/50 text-sm focus:ring-2 focus:ring-[#07C160]/20 focus:border-[#07C160]/50 focus:bg-white transition-all placeholder:text-gray-300 ${
                        authNickname && !isChinese(authNickname.trim()) ? 'border-red-300 bg-red-50/30' : 'border-gray-200/80'
                      }`} />
                  </div>
                  {authNickname && !isChinese(authNickname.trim()) && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      请输入纯中文字符
                    </p>
                  )}
                </div>
              )}
              {authError && (
                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 px-3 py-2.5 rounded-xl animate-scale-in">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {authError}
                </div>
              )}
              <button onClick={handleAuth} disabled={authLoading}
                className="w-full py-3 bg-gradient-to-r from-[#07C160] to-[#059669] text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/20 disabled:opacity-50 shadow-sm transition-all active:scale-[0.98]">
                {authLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    处理中...
                  </span>
                ) : authMode === 'register' ? '注册并进入' : '登录'}
              </button>
            </div>
          </div>

          <div className="text-center mt-6">
            <Link to="/admin" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">管理员入口</Link>
          </div>
        </div>
      </div>
    )
  }

  // ========== API 模式选择视图 ==========
  if (view === 'apiSelect') {
    return (
      <div className="min-h-screen min-h-dvh bg-[#f5f5f5] flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-6">
            <h1 className="text-base font-bold text-gray-900 tracking-tight">选择 AI 服务模式</h1>
            <p className="text-sm text-gray-400 mt-1">欢迎，{user?.nickname || user?.phone}</p>
          </div>

          <div className="space-y-3">
            <div onClick={() => setSelectedApiMode('official')}
              className={`bg-white rounded-2xl p-4 cursor-pointer transition-all ${selectedApiMode === 'official' ? 'ring-2 ring-[#07C160]' : 'hover:shadow-md'}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">官方 API</h3>
                  </div>
                  <p className="text-xs text-gray-400 ml-10">平台 DeepSeek AI 服务，按消息扣费</p>
                  <span className="inline-block mt-1.5 ml-10 text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-md font-medium">余额 ¥{parseFloat(user?.balance || 0).toFixed(2)}</span>
                  <p className="text-[10px] text-gray-300 ml-10 mt-1">充值后不支持退款，建议先用自己的API体验</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1.5 ${selectedApiMode === 'official' ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'}`}>
                  {selectedApiMode === 'official' && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
              </div>
            </div>

            <div onClick={() => setSelectedApiMode('custom')}
              className={`bg-white rounded-2xl p-4 cursor-pointer transition-all ${selectedApiMode === 'custom' ? 'ring-2 ring-[#07C160]' : 'hover:shadow-md'}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">自定义 API</h3>
                  </div>
                  <p className="text-xs text-gray-400 ml-10">使用自己的 DeepSeek API Key</p>
                  <span className="inline-block mt-1.5 ml-10 text-xs bg-violet-50 text-violet-500 px-2 py-0.5 rounded-md font-medium">自有 Key · 免费</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1.5 ${selectedApiMode === 'custom' ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'}`}>
                  {selectedApiMode === 'custom' && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
              </div>
            </div>

            {selectedApiMode === 'custom' && (
              <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">您的 DeepSeek API Key</label>
                <input type="password" value={customKey} onChange={e => setCustomKey(e.target.value)}
                  placeholder="sk-..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-sm focus:ring-2 focus:ring-violet-300/30 focus:border-violet-400 transition-all placeholder:text-gray-300" />
              </div>
            )}

            {apiModeError && <p className="text-xs text-red-500 text-center bg-red-50 py-2 rounded-xl">{apiModeError}</p>}

            <button onClick={handleApiModeConfirm} disabled={apiModeSaving}
              className="w-full py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white text-sm font-medium rounded-xl disabled:opacity-50 shadow-sm hover:shadow-md transition-all">
              {apiModeSaving ? '保存中...' : '确认并开始'}
            </button>

            <button onClick={() => setView('chat')} className="w-full py-2 text-xs text-gray-300 hover:text-gray-500 transition-colors">
              跳过，使用当前设置
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========== 我的历史对话列表 ==========
  if (view === 'myHistory') {
    return (
      <div className="h-screen h-dvh bg-[#f5f5f5] flex flex-col overflow-hidden">
        <header className="glass border-b border-black/[0.06] flex-shrink-0 safe-top">
          <div className="max-w-3xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setView('chat')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <h1 className="text-sm font-semibold text-gray-900 tracking-tight">我的历史对话</h1>
            </div>
            <button onClick={handleNewChat} className="px-3 py-1.5 text-xs text-wechat-green bg-green-50 rounded-lg hover:bg-green-100 font-medium">新对话</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 py-4">
            {mySessionsLoading ? (
              <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
            ) : mySessions.filter(s => !deletedSessions.includes(s.id)).length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">还没有对话记录</p>
                <p className="text-gray-300 text-xs mt-1">开始新对话后，历史记录会显示在这里</p>
                <button onClick={handleNewChat} className="mt-4 px-5 py-2 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white text-sm rounded-xl shadow-sm">开始新对话</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-400 px-1 mb-2">共 {mySessions.filter(s => !deletedSessions.includes(s.id)).length} 条对话</p>
                {mySessions.filter(s => !deletedSessions.includes(s.id)).map((s, idx) => (
                  <div key={s.id} className="bg-white rounded-2xl p-4 history-card stagger-in" style={{ animationDelay: `${idx * 0.05}s`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-start gap-2.5 flex-1 mr-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          s.status === 'active' ? 'bg-green-50' : 'bg-gray-50'
                        }`}>
                          <svg className={`w-4 h-4 ${s.status === 'active' ? 'text-green-500' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 line-clamp-2 font-medium leading-snug">{s.first_message || '新对话'}</p>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1">
                            <span>{fmtTime(s.created_at)}</span>
                            <span className="text-gray-200">·</span>
                            <span>{s.message_count} 条消息</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0 font-medium ${
                        s.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                      }`}>{s.status === 'active' ? '进行中' : '已完成'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <button onClick={() => softDeleteSession(s.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors">删除</button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openHistory(s.id)} className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 font-medium transition-colors">查看</button>
                        <button onClick={() => continueSession(s.id)} className="px-3 py-1.5 text-xs text-white bg-gradient-to-r from-[#07C160] to-[#059669] rounded-lg shadow-sm hover:shadow-md font-medium transition-all">继续</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ========== 历史只读视图 ==========
  if (view === 'history') {
    return (
      <div className="h-screen h-dvh bg-[#f5f5f5] flex flex-col overflow-hidden">
        <header className="glass border-b border-black/[0.06] flex-shrink-0 safe-top">
          <div className="max-w-3xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => { setView('myHistory'); loadMySessions() }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 tracking-tight">历史对话</h1>
                {historySession && <p className="text-[10px] text-gray-400 truncate">{historySession.id.slice(0, 12)}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {historySession && (
                <button onClick={() => continueSession(historySession.id)}
                  className="px-3 py-1.5 text-xs text-white bg-gradient-to-br from-[#07C160] to-[#06ae56] rounded-lg shadow-sm font-medium">继续对话</button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain bg-[#f5f5f5]">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-0.5">
            {historyLoading ? (
              <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
            ) : (
              historyMessages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)
            )}
          </div>
        </main>

        <footer className="glass border-t border-black/[0.04] flex-shrink-0 safe-bottom">
          <div className="max-w-3xl mx-auto px-4 py-2.5 text-center">
            <p className="text-xs text-gray-400">只读模式 · 点击“继续对话”可接着聊天</p>
          </div>
        </footer>
      </div>
    )
  }

  // ========== 正常聊天视图 ==========
  const hasInfoData = Object.keys(collectedInfo).length > 0 || infoFields.length > 0
  const visibleSessions = getVisibleSessions()

  return (
    <div className="h-screen h-dvh bg-[#f5f5f5] flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="glass border-b border-black/[0.06] flex-shrink-0 safe-top">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#07C160] to-[#059669] flex items-center justify-center shadow-sm flex-shrink-0 glow-green">
              <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate tracking-tight">商户号申诉助手</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {user?.api_mode === 'custom' ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-500 rounded-md font-medium">自定义API</span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${parseFloat(user?.balance || 0) > 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                    ¥{parseFloat(user?.balance || 0).toFixed(2)}
                  </span>
                )}
                {user?.api_mode === 'official' && parseFloat(user?.balance || 0) <= 0 && (
                  <button onClick={openRecharge} className="text-[10px] text-orange-500 hover:text-orange-600 font-medium">充值</button>
                )}
                {user && <span className="text-[10px] text-gray-300 truncate max-w-[80px]">{user.nickname}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* AI分析面板切换 */}
            <button onClick={() => setShowAIPanel(!showAIPanel)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg xl:hidden ${showAIPanel ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="AI分析">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </button>
            {/* 客户信息面板切换 */}
            <button onClick={() => setShowInfoPanel(!showInfoPanel)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg lg:hidden ${showInfoPanel ? 'text-wechat-green bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="客户信息">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {hasInfoData && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-wechat-green rounded-full" />}
            </button>
            {/* 申诉文案面板切换 */}
            <button onClick={() => setShowAppealPanel(!showAppealPanel)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg ${showAppealPanel ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="申诉文案">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </button>
            {/* 用户中心 */}
            <button onClick={() => setShowUserCenter(true)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="用户中心">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            <button onClick={openRecharge}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="充值">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button onClick={() => { if (window.innerWidth < 640) openDrawer(); else openMyHistory() }}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="历史对话">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button onClick={() => { setSelectedApiMode(user?.api_mode || 'official'); setCustomKey(''); setView('apiSelect') }}
              className="w-8 h-8 hidden sm:flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="切换API">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button onClick={handleNewChat}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-wechat-green hover:bg-green-50 rounded-lg" title="新对话">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5 hidden sm:block" />
            <button onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg" title="退出">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 三栏布局：AI面板(左) | 聊天(中) | 客户信息(右) */}
      <div className="flex-1 flex overflow-hidden">

        {/* 左侧AI分析面板 - xl桌面端显示，移动端覆盖 */}
        <div className={`
          xl:relative xl:w-80 2xl:w-96 xl:border-r xl:border-gray-200/60 xl:block
          ${showAIPanel ? 'fixed inset-0 z-40 xl:static xl:inset-auto xl:z-auto' : 'hidden xl:block'}
        `}>
          {showAIPanel && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] xl:hidden" onClick={() => setShowAIPanel(false)} />}
          <div className={`
            ${showAIPanel ? 'absolute left-0 top-0 bottom-0 w-80 shadow-2xl xl:shadow-none xl:static xl:w-full' : ''}
            h-full
          `}>
            <AIAnalysisPanel
              sessionId={sessionId}
              collectedData={collectedInfo}
              refreshKey={analysisKey}
              userId={user?.id}
              onClose={() => setShowAIPanel(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>

        {/* 中间聊天区域 */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 overflow-y-auto overscroll-contain bg-[#f5f5f5]">
            <div className={`max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-0.5 transition-opacity duration-150 ${chatFading ? 'opacity-0' : 'opacity-100'} ${newChatAnim ? 'animate-new-chat' : ''}`}>
              {messages.map((msg, i) => (
                <React.Fragment key={i}>
                  <ChatMessage role={msg.role} content={msg.content} animate={i === messages.length - 1} timing={msg.timing} tokenUsage={msg.tokenUsage} />
                  {msg.retryable && (
                    <div className="flex justify-center py-2">
                      <button onClick={handleRetry} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-gradient-to-r from-[#07C160] to-[#059669] hover:from-[#06a050] hover:to-[#048a5a] disabled:opacity-50 rounded-full shadow-md transition-all active:scale-95">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        点击重试
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
              {loading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </main>

          <footer className="glass border-t border-black/[0.04] flex-shrink-0 safe-bottom">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea ref={inputRef} value={input} autoFocus
                    onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="输入消息..." rows={1} disabled={loading}
                    className="w-full resize-none rounded-2xl border border-gray-200/60 bg-white/80 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#07C160]/15 focus:border-[#07C160]/40 focus:bg-white transition-all max-h-28 overflow-y-auto placeholder:text-gray-300"
                    style={{ minHeight: '42px' }}
                    onInput={e => { e.target.style.height = '42px'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px' }}
                  />
                  {input.length > 200 && (
                    <span className={`absolute right-3 bottom-1.5 text-[10px] ${input.length > 4500 ? 'text-red-400' : 'text-gray-300'}`}>
                      {input.length}/5000
                    </span>
                  )}
                </div>
                <button onClick={handleSend} disabled={!input.trim() || loading}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    input.trim() && !loading
                      ? 'bg-gradient-to-br from-[#07C160] to-[#059669] text-white shadow-md shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/30 active:scale-90'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}>
                  {loading ? (
                    <svg className="w-[18px] h-[18px] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* 右侧客户信息面板 - lg桌面端显示，移动端覆盖 */}
        <div className={`
          lg:relative lg:w-80 xl:w-80 2xl:w-96 lg:border-l lg:border-gray-200/60 lg:block
          ${showInfoPanel ? 'fixed inset-0 z-40 lg:static lg:inset-auto lg:z-auto' : 'hidden lg:block'}
        `}>
          {showInfoPanel && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] lg:hidden" onClick={() => setShowInfoPanel(false)} />}
          <div className={`
            ${showInfoPanel ? 'absolute right-0 top-0 bottom-0 w-80 shadow-2xl lg:shadow-none lg:static lg:w-full' : ''}
            h-full
          `}>
            <InfoPanel
              collectedData={collectedInfo}
              fields={infoFields}
              step={infoStep}
              totalSteps={infoTotal}
              sessionId={sessionId}
              onClose={() => setShowInfoPanel(false)}
              onFieldUpdate={handleFieldUpdate}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      </div>

      {/* 申诉文案面板（覆盖层） */}
      {showAppealPanel && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowAppealPanel(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="relative ml-auto w-80 sm:w-96 h-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <AppealTextPanel
              sessionId={sessionId}
              userId={user?.id}
              onClose={() => setShowAppealPanel(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      )}

      {/* 用户中心弹窗 */}
      {showUserCenter && (
        <UserCenter
          user={user}
          onClose={() => setShowUserCenter(false)}
          onRecharge={() => { setShowUserCenter(false); openRecharge() }}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* 充值弹窗 */}
      {showRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[6px] p-4" onClick={() => setShowRecharge(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">账户充值</h2>
              <button onClick={() => setShowRecharge(false)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            {!rechargeConfig?.enabled ? (
              <div className="p-6 text-center text-gray-400 text-sm">充值功能暂未开放</div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-2">选择充值金额</label>
                  <div className="grid grid-cols-3 gap-2">
                    {rechargeConfig.amounts?.map(a => (
                      <button key={a} onClick={() => setRechargeAmount(a)}
                        className={`py-3 rounded-xl text-[13px] font-bold transition-all ${rechargeAmount === a ? 'bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white shadow-sm' : 'bg-gray-50 text-gray-700 border border-gray-200/80 hover:border-[#07C160]/40'}`}>
                        ¥{a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-2">支付方式</label>
                  <div className="flex gap-2">
                    {rechargeConfig.qrWechat && (
                      <button onClick={() => setRechargeMethod('wechat')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'wechat' ? 'bg-green-50 border-2 border-wechat-green text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-wechat-green rounded-full inline-block" /> 微信支付
                      </button>
                    )}
                    {rechargeConfig.qrAlipay && (
                      <button onClick={() => setRechargeMethod('alipay')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'alipay' ? 'bg-blue-50 border-2 border-blue-500 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-blue-500 rounded-full inline-block" /> 支付宝
                      </button>
                    )}
                    {!rechargeConfig.qrWechat && !rechargeConfig.qrAlipay && (
                      <p className="text-xs text-gray-400">管理员暂未配置收款二维码，请联系管理员充值</p>
                    )}
                  </div>
                </div>
                {/* 二维码展示 */}
                {((rechargeMethod === 'wechat' && rechargeConfig.qrWechat) || (rechargeMethod === 'alipay' && rechargeConfig.qrAlipay)) && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">请扫码支付 <strong className="text-lg text-gray-800">¥{rechargeAmount}</strong></p>
                    <img src={rechargeMethod === 'wechat' ? rechargeConfig.qrWechat : rechargeConfig.qrAlipay}
                      alt="收款二维码" className="w-48 h-48 mx-auto rounded-xl border border-gray-200 object-contain bg-white" />
                  </div>
                )}
                {rechargeConfig.instructions && (
                  <p className="text-xs text-gray-500 bg-yellow-50 rounded-lg p-3 border border-yellow-100">{rechargeConfig.instructions}</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">付款备注（交易单号或截图说明）</label>
                  <input type="text" value={rechargeRemark} onChange={e => setRechargeRemark(e.target.value)}
                    placeholder="请输入支付后的交易单号或备注"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30" />
                </div>
                <button onClick={submitRecharge} disabled={!rechargeAmount || rechargeSubmitting}
                  className="w-full py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white rounded-xl font-medium text-[13px] disabled:opacity-50 shadow-sm transition-all">
                  {rechargeSubmitting ? '提交中...' : `提交充值申请 · ¥${rechargeAmount || 0}`}
                </button>
                <p className="text-[10px] text-gray-300 text-center">提交后管理员将尽快确认，余额自动到账</p>
                <p className="text-[10px] text-gray-300 text-center mt-1">充值余额用于消耗AI Token，充值后不支持退款/提现。您也可以使用自己的DeepSeek API Key免费使用。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== 历史侧边栏（右滑打开） ========== */}
      <div className={`history-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <div className={`history-drawer ${drawerOpen ? 'open' : ''} bg-white flex flex-col`}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 safe-top">
          <h2 className="text-sm font-semibold text-gray-900">历史对话</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { closeDrawer(); handleNewChat() }}
              className="text-xs text-[#07C160] font-medium hover:text-green-700">新对话</button>
            <button onClick={closeDrawer} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mySessionsLoading ? (
            <div className="text-center py-16 text-gray-400 text-xs">加载中...</div>
          ) : visibleSessions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-gray-400 text-xs">暂无历史对话</p>
            </div>
          ) : (
            <div className="py-2">
              {visibleSessions.map(s => (
                <SessionItem key={s.id} session={s} fmtTime={fmtTime}
                  onView={() => { closeDrawer(); openHistory(s.id) }}
                  onContinue={() => { closeDrawer(); continueSession(s.id) }}
                  onDelete={() => softDeleteSession(s.id)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 flex-shrink-0 safe-bottom">
          <button onClick={() => { closeDrawer(); openMyHistory() }}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg font-medium">
            查看全部历史记录
          </button>
        </div>
      </div>

      {/* 移动端左边缘滑动提示 */}
      <div className="swipe-hint sm:hidden" onClick={openDrawer} />
    </div>
  )
}

// ========== 可滑动删除的会话条目 ==========
function SessionItem({ session, fmtTime, onView, onContinue, onDelete }) {
  const [offsetX, setOffsetX] = useState(0)
  const [removing, setRemoving] = useState(false)
  const touchStartRef = useRef({ x: 0, y: 0 })

  function onTouchStart(e) {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchMove(e) {
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      e.preventDefault()
      setOffsetX(Math.max(dx, -80))
    }
  }
  function onTouchEnd() {
    if (offsetX < -40) {
      setOffsetX(-80)
    } else {
      setOffsetX(0)
    }
  }
  function handleDelete() {
    setRemoving(true)
    setTimeout(() => onDelete(), 300)
  }

  return (
    <div className={`session-item mx-2 mb-1.5 rounded-xl ${removing ? 'session-removing' : ''}`}>
      <div className="session-delete-bg rounded-r-xl" onClick={handleDelete}>
        <span>删除</span>
      </div>
      <div className="session-item-content rounded-xl px-3.5 py-3"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (offsetX === 0) onView() }}>
        <p className="text-[13px] text-gray-800 line-clamp-2 leading-snug font-medium">{session.first_message || '新对话'}</p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
            <span>{fmtTime(session.created_at)}</span>
            <span className="text-gray-200">·</span>
            <span>{session.message_count} 条</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              session.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
            }`}>{session.status === 'active' ? '进行中' : '已完成'}</span>
            <button onClick={e => { e.stopPropagation(); onContinue() }}
              className="text-[10px] px-2 py-0.5 text-[#07C160] bg-green-50 rounded-md font-medium hover:bg-green-100">继续</button>
          </div>
        </div>
      </div>
    </div>
  )
}
