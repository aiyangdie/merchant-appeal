import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ChatMessage from '../components/ChatMessage'
import TypingIndicator from '../components/TypingIndicator'
import InfoPanel from '../components/InfoPanel'
import AIAnalysisPanel from '../components/AIAnalysisPanel'
import AppealTextPanel from '../components/AppealTextPanel'
import ComplaintDocPanel from '../components/ComplaintDocPanel'
import AppealGuidePanel from '../components/AppealGuidePanel'
import DueDiligencePanel from '../components/DueDiligencePanel'
import UserCenter from '../components/UserCenter'
import { WELCOME } from './chat/constants.js'
import {
  isDDScenario,
  sanitizeCollected,
  smartFormatAmount,
  getOrderStatusStyle,
  fmtTime,
} from './chat/utils.js'
import ChatHeader from './chat/components/ChatHeader.jsx'
import ChatToolStrip from './chat/components/ChatToolStrip.jsx'
import ChatMoreSheet from './chat/components/ChatMoreSheet.jsx'
import ChatInputFooter from './chat/components/ChatInputFooter.jsx'
import HistoryDrawer from './chat/components/HistoryDrawer.jsx'
import ToolsHubPage from './chat/components/ToolsHubPage.jsx'
import ChatBottomNav from './chat/components/ChatBottomNav.jsx'
import ThemePicker from './chat/components/ThemePicker.jsx'
import AuthView from './chat/components/AuthView.jsx'
import BindPhoneView from './chat/components/BindPhoneView.jsx'
import HomeTab from './chat/components/HomeTab.jsx'
import CasesTab from './chat/components/CasesTab.jsx'
import {
  fetchProfile, getStoredUser, getToken, needsPhoneBind, normalizeUser, clearAuth,
} from '../lib/auth.js'
import { readMobileTab, writeMobileTab, consumeOneShotQuery, isMobileTab } from '../lib/appNav.js'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const sessionIdRef = useRef(null)  // 添加 ref 来存储最新的 sessionId
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // 用户状态
  const [user, setUser] = useState(null)
  const tokenRef = useRef(localStorage.getItem('appeal_token') || '')

  function getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' }
    if (tokenRef.current) h['Authorization'] = `Bearer ${tokenRef.current}`
    return h
  }

  async function ensureSession() {
    if (sessionIdRef.current) return sessionIdRef.current
    if (!user?.id) return null
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (data.sessionId) {
        setSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId
        localStorage.setItem('appeal_session_id', data.sessionId)
        return data.sessionId
      }
    } catch (e) {
      console.error('ensureSession failed:', e)
    }
    return null
  }

  function withSession(action) {
    return async () => {
      setMobileTab('chat')
      await ensureSession()
      action?.()
    }
  }

  function saveToken(token) {
    tokenRef.current = token || ''
    if (token) localStorage.setItem('appeal_token', token)
    else localStorage.removeItem('appeal_token')
  }
  function handleAuthExpired() {
    clearAuth()
    tokenRef.current = ''
    localStorage.removeItem('appeal_session_id')
    setUser(null); setSessionId(null); setMessages([]); setLoading(false)
    setView('auth')
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
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [deletedSessions, setDeletedSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appeal_deleted_sessions') || '[]') } catch { return [] }
  })
  const touchRef = useRef({ startX: 0, startY: 0, dragging: false })
  const edgeSwipeRef = useRef(null)

  // 充值
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeConfig, setRechargeConfig] = useState(null)
  const [rechargeAmount, setRechargeAmount] = useState(null)
  const [rechargeMethod, setRechargeMethod] = useState('wechat')
  const [rechargeRemark, setRechargeRemark] = useState('')
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false)
  // 真实支付状态
  const [paymentPending, setPaymentPending] = useState(null) // { outTradeNo, method, codeUrl, amount }
  const [paymentStatus, setPaymentStatus] = useState('') // pending | paid | failed
  const paymentPollRef = useRef(null)

  // 清理 collectedData：去掉内部 _ 前缀字段；数组/对象保留结构供订单等展示
  async function refreshInfoFromServer(sid) {
    const id = sid || sessionIdRef.current
    if (!id) return
    try {
      const res = await fetch(`/api/sessions/${id}/info`, { headers: getAuthHeaders() })
      if (!res.ok) return
      const infoData = await res.json()
      const cleaned = sanitizeCollected(infoData.collectedData)
      setCollectedInfo(cleaned)
      setInfoFields(infoData.fields || [])
      setInfoStep(infoData.step || 0)
      setInfoTotal(infoData.totalSteps || 14)
      setInfoProgress(infoData.progress || null)
      if (isDDScenario(cleaned)) setShowDueDiligence(true)
      setAnalysisKey(prev => prev + 1)
    } catch {}
  }

  // 信息收集面板
  const [collectedInfo, setCollectedInfo] = useState({})
  const [infoFields, setInfoFields] = useState([])
  const [infoStep, setInfoStep] = useState(0)
  const [infoTotal, setInfoTotal] = useState(14)
  const [infoProgress, setInfoProgress] = useState(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showAppealPanel, setShowAppealPanel] = useState(false)
  const [showComplaintDoc, setShowComplaintDoc] = useState(false)
  const [showAppealGuide, setShowAppealGuide] = useState(false)
  const [showDueDiligence, setShowDueDiligence] = useState(false)
  const [mobileTab, setMobileTabState] = useState(() => readMobileTab()) // home | chat | tools | cases | me

  function setMobileTab(tab) {
    if (!isMobileTab(tab)) return
    setMobileTabState(tab)
    writeMobileTab(tab)
  }
  const [analysisKey, setAnalysisKey] = useState(0) // force re-fetch analysis
  const [newChatAnim, setNewChatAnim] = useState(false) // new chat transition
  const [chatFading, setChatFading] = useState(false) // fade-out before reset
  const [contactCard, setContactCard] = useState(null)
  const [contactCards, setContactCards] = useState([])
  const [showContact, setShowContact] = useState(false)
  const [selectedCardIdx, setSelectedCardIdx] = useState(0)
  const [riskLevel, setRiskLevel] = useState(null) // { level, label, description, factors, suggestion }
  const [riskTransition, setRiskTransition] = useState(false)
  const prevRiskRef = useRef(null)
  const riskAbortRef = useRef(null)
  // AI砍价
  const [bargainProduct, setBargainProduct] = useState(null)
  const [bargainHistory, setBargainHistory] = useState([])
  const [bargainInput, setBargainInput] = useState('')
  const [bargainLoading, setBargainLoading] = useState(false)
  const [bargainDeal, setBargainDeal] = useState(null) // { finalPrice }
  // 虚拟人设
  const [virtualPersona, setVirtualPersona] = useState(null)
  const [showPersonaCard, setShowPersonaCard] = useState(false)
  // 商品详情购买弹窗
  const [detailProduct, setDetailProduct] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  // 订单绑定
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [boundOrder, setBoundOrder] = useState(null)
  const [orderList, setOrderList] = useState([])
  const [orderListLoading, setOrderListLoading] = useState(false)
  const [orderListHint, setOrderListHint] = useState('')
  const [orderNoInput, setOrderNoInput] = useState('')
  const [orderNoLoading, setOrderNoLoading] = useState(false)
  const [orderSearchResults, setOrderSearchResults] = useState([])

  const searchOrder = async (keyword) => {
    // 如果没有session，先创建一个
    if (!sessionIdRef.current) {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: user?.id })
        })
        const data = await res.json()
        if (data.sessionId) {
          setSessionId(data.sessionId)
          sessionIdRef.current = data.sessionId
          localStorage.setItem('appeal_session_id', data.sessionId)
        }
      } catch (e) {
        console.error('创建session失败:', e)
        return
      }
    }
    setOrderNoLoading(true)
    try {
      const res = await fetch(`/api/orders/from-system?keyword=${encodeURIComponent(keyword)}&page_size=20`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success && data.data) {
        // 显示所有订单，按状态排序（待发货优先）
        const sorted = data.data.sort((a, b) => {
          if (a.order_status === 12 && b.order_status !== 12) return -1
          if (b.order_status === 12 && a.order_status !== 12) return 1
          return 0
        })
        setOrderSearchResults(sorted)
      } else {
        setOrderSearchResults([])
      }
    } catch { setOrderSearchResults([]) }
    setOrderNoLoading(false)
  }

  const selectOrder = async (order) => {
    setOrderSearchResults([])
    setOrderNoInput('')
    
    // 确保有 sessionId，如果没有则创建（同时绑定订单）
    let currentSessionId = sessionIdRef.current
    if (!currentSessionId) {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            userId: user?.id,
            orderNo: order.order_no,
            orderData: order
          })
        })
        const data = await res.json()
        if (data.sessionId) {
          currentSessionId = data.sessionId
          setSessionId(data.sessionId)
          sessionIdRef.current = data.sessionId
          localStorage.setItem('appeal_session_id', data.sessionId)
          setBoundOrder(order)
          return // 创建时已绑定订单，直接返回
        }
      } catch (e) {
        console.error('创建session失败:', e)
        return
      }
    } else {
      // 已有会话，绑定订单
      try {
        await fetch(`/api/sessions/${currentSessionId}/bind-order`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ order_no: order.order_no, order_data: order })
        })
      } catch (e) {
        console.error('绑定订单失败:', e)
      }
    }
    setBoundOrder(order)
  }

  const chatNavigate = useNavigate()
  const [proModeAnim, setProModeAnim] = useState(false) // 专业模式切换动画
  const prevProModeRef = useRef(false)

  // 专业模式：当系统开始收集核心信息时自动激活
  const isProfessionalMode = infoFields.length > 0 || Object.keys(collectedInfo).length > 0

  // 检测专业模式切换，触发过渡动画
  useEffect(() => {
    if (isProfessionalMode && !prevProModeRef.current) {
      setProModeAnim(true)
      setTimeout(() => setProModeAnim(false), 500)
    }
    prevProModeRef.current = isProfessionalMode
  }, [isProfessionalMode])

  // 尽调场景自动关闭误打开的申诉文案面板
  useEffect(() => {
    if (isDDScenario(collectedInfo) && showAppealPanel) setShowAppealPanel(false)
  }, [collectedInfo, showAppealPanel])

  useEffect(() => {
    fetch('/api/contact-card').then(r => r.json()).then(d => {
      if (d.enabled) setContactCard(d)
      if (d.cards?.length > 0) setContactCards(d.cards)
    }).catch(() => {})
  }, [])

  // 加载会话绑定的订单
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/sessions/${sessionId}/order`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setBoundOrder(d.data)
        }
      })
      .catch(() => {})
  }, [sessionId])

  async function loadOrderList(showAlert = false) {
    setOrderListLoading(true)
    setOrderListHint('')
    try {
      const res = await fetch('/api/orders/from-system?page=1&page_size=100', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        const sorted = data.data.sort((a, b) => {
          if (a.order_status === 12 && b.order_status !== 12) return -1
          if (b.order_status === 12 && a.order_status !== 12) return 1
          return 0
        })
        setOrderList(sorted)
        if (data.configured === false && data.message) setOrderListHint(data.message)
      } else {
        setOrderList([])
        const msg = data.message || data.error || '获取订单失败'
        setOrderListHint(msg)
        if (showAlert) alert(msg)
      }
    } catch {
      setOrderList([])
      const msg = '连接失败，请稍后重试'
      setOrderListHint(msg)
      if (showAlert) alert(msg)
    } finally {
      setOrderListLoading(false)
    }
  }

  // 打开订单面板时自动加载订单列表
  useEffect(() => {
    if (showOrderPanel && orderList.length === 0 && !orderListLoading) {
      loadOrderList(false)
    }
  }, [showOrderPanel])

  // AI风险评估：即时规则评估 + 防抖后 AI 精评
  useEffect(() => {
    const hasRiskData = collectedInfo.violation_reason || collectedInfo.problem_type || collectedInfo.penalty_type
    if (!hasRiskData) return
    const dataKey = JSON.stringify({ v: collectedInfo.violation_reason, p: collectedInfo.problem_type, t: collectedInfo.penalty_type })
    if (prevRiskRef.current === dataKey) return
    prevRiskRef.current = dataKey

    fetch('/api/risk-assess', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectedData: collectedInfo, fast: true }),
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.level) {
        setRiskLevel(d)
        setRiskTransition(true)
        setTimeout(() => setRiskTransition(false), 600)
      }
    }).catch(() => {})

    if (riskAbortRef.current) riskAbortRef.current.abort()
    const timer = setTimeout(() => {
      const ctrl = new AbortController()
      riskAbortRef.current = ctrl
      fetch('/api/risk-assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectedData: collectedInfo }),
        signal: ctrl.signal,
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.level) {
          setRiskLevel(d)
          setRiskTransition(true)
          setTimeout(() => setRiskTransition(false), 600)
        }
      }).catch(() => {})
    }, 1500)

    return () => {
      clearTimeout(timer)
      riskAbortRef.current?.abort()
    }
  }, [collectedInfo])

  // 智能名片展示：检测AI回复中的关键转化节点
  const contactShownRef = useRef(false)
  useEffect(() => {
    if (contactShownRef.current || (!contactCard && contactCards.length === 0)) return
    if (messages.length < 4) return // 至少2轮对话后才触发
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role !== 'assistant') return
    const text = lastMsg.content || ''
    // 关键转化触发词：案件复杂/需要专业帮助/建议咨询/代办/难度高
    const triggerPatterns = [
      /案件.*复杂|难度.*高|极难|成功率.*低于|成功率.*[<＜].*50/,
      /建议.*咨询.*专业|建议.*寻求.*专业|需要.*法律.*支持/,
      /专业团队.*协助|一对一.*指导|代办/,
      /如果.*觉得.*困难|如果.*需要.*帮助/,
      /材料已.*生成|文案已.*生成|申诉材料.*准备/,
      /所有信息.*收集完毕|信息.*收集.*完成/,
    ]
    if (triggerPatterns.some(p => p.test(text))) {
      contactShownRef.current = true
      setTimeout(() => setShowContact(true), 2000)
    }
  }, [messages, contactCard, contactCards])

  // 组件卸载时清理支付轮询与流式打字定时器
  useEffect(() => {
    return () => {
      if (paymentPollRef.current) { clearInterval(paymentPollRef.current); paymentPollRef.current = null }
    }
  }, [])

  const scrollTimerRef = useRef(null)
  const lastMsgContent = messages.length ? messages[messages.length - 1]?.content : ''
  const lastMsgStreaming = messages.length ? messages[messages.length - 1]?.streaming : false
  useEffect(() => {
    if (view === 'chat') {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: lastMsgStreaming ? 'auto' : 'smooth', block: 'end' })
      }, lastMsgStreaming ? 0 : 80)
    }
    return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current) }
  }, [messages.length, lastMsgContent, lastMsgStreaming, view])

  // 发送完成后自动聚焦输入框
  useEffect(() => {
    if (!loading && view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [loading, view])

  function enterApp(u) {
    const nu = normalizeUser(u)
    tokenRef.current = getToken()
    setUser(nu)
    localStorage.setItem('appeal_user', JSON.stringify(nu))
    if (needsPhoneBind(nu)) {
      setView('bindPhone')
      setReady(true)
      return
    }
    restoreSession(nu)
  }

  async function openSessionFromCases(sid) {
    if (!sid) return
    localStorage.setItem('appeal_session_id', sid)
    setSessionId(sid)
    sessionIdRef.current = sid
    setMobileTab('chat')
    try {
      const [msgData, infoData] = await Promise.all([
        fetch(`/api/sessions/${sid}/messages`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/sessions/${sid}/info`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
      ])
      if (msgData?.messages?.length) {
        setMessages(msgData.messages)
        if (infoData) {
          setCollectedInfo(sanitizeCollected(infoData.collectedData))
          setInfoFields(infoData.fields || [])
          setInfoStep(infoData.step || 0)
          setInfoTotal(infoData.totalSteps || 14)
          setInfoProgress(infoData.progress || null)
        }
      } else {
        setMessages([{ role: 'assistant', content: WELCOME }])
      }
    } catch {
      setMessages([{ role: 'assistant', content: WELCOME }])
    }
    setView('chat')
  }

  // 恢复用户登录状态
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlSessionId = params.get('sessionId')
    if (urlSessionId) {
      localStorage.setItem('appeal_session_id', urlSessionId)
    }
    const forceBind = params.get('bindPhone') === '1'
    const queryTab = params.get('tab')
    if (isMobileTab(queryTab)) {
      setMobileTabState(queryTab)
      writeMobileTab(queryTab)
    }
    consumeOneShotQuery(['sessionId', 'bindPhone', 'tab'])

    const token = getToken()
    tokenRef.current = token
    const savedUser = getStoredUser()
    if (token && savedUser) {
      fetchProfile()
        .then(u => {
          if (forceBind && needsPhoneBind(u)) {
            setUser(normalizeUser(u))
            setView('bindPhone')
            setReady(true)
            return
          }
          enterApp(u)
        })
        .catch(() => {
          clearAuth()
          setView('auth')
          setReady(true)
        })
    } else {
      setView('auth')
      setReady(true)
    }
  }, [])

  // 浏览器前进/后退同步 Tab hash
  useEffect(() => {
    function onHashChange() {
      const tab = readMobileTab()
      setMobileTabState(tab)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function restoreSession(u) {
    const tab = readMobileTab()
    const saved = localStorage.getItem('appeal_session_id')
    if (saved) {
      Promise.all([
        fetch(`/api/sessions/${saved}/messages`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/sessions/${saved}/info`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
      ]).then(([msgData, infoData]) => {
        if (msgData?.messages?.length > 0) {
          setSessionId(saved)
          sessionIdRef.current = saved  // 同步更新 ref
          setMessages(msgData.messages)
          if (infoData) {
            setCollectedInfo(sanitizeCollected(infoData.collectedData))
            setInfoFields(infoData.fields || [])
            setInfoStep(infoData.step || 0)
            setInfoTotal(infoData.totalSteps || 14)
            setInfoProgress(infoData.progress || null)
          }
        } else {
          localStorage.removeItem('appeal_session_id')
          setMessages([{ role: 'assistant', content: WELCOME }])
        }
        setView('chat')
        setMobileTabState(tab)
        writeMobileTab(tab)
        setReady(true)
      }).catch(() => {
        setMessages([{ role: 'assistant', content: WELCOME }])
        setView('chat')
        setMobileTabState(tab)
        writeMobileTab(tab)
        setReady(true)
      })
    } else {
      setMessages([{ role: 'assistant', content: WELCOME }])
      setView('chat')
      setMobileTabState(tab)
      writeMobileTab(tab)
      setReady(true)
    }
  }

  // ========== API 模式 ==========

  async function handleApiModeConfirm() {
    if (!user) return
    if (selectedApiMode === 'custom' && !customKey.trim()) {
      setApiModeError('请输入您的 API Key'); return
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
  const streamTargetRef = useRef('')
  const streamOutputStartRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState(null)

  function patchStreamStatus(patch) {
    setStreamStatus(prev => {
      if (!prev) {
        return {
          phase: 'connecting',
          startedAt: Date.now(),
          model: null,
          connectMs: null,
          firstChunkMs: null,
          totalMs: null,
          receivedChars: 0,
          displayedChars: 0,
          outputElapsedMs: 0,
          elapsedMs: 0,
          ...patch,
        }
      }
      const next = { ...prev, ...patch }
      if (next.firstChunkMs != null && next.startedAt) {
        next.outputElapsedMs = Math.max(0, (next.elapsedMs || 0) - next.firstChunkMs)
      }
      return next
    })
  }

  function beginStreamStatus() {
    streamOutputStartRef.current = null
    setStreamStatus({
      phase: 'connecting',
      startedAt: Date.now(),
      model: null,
      connectMs: null,
      firstChunkMs: null,
      totalMs: null,
      receivedChars: 0,
      displayedChars: 0,
      outputElapsedMs: 0,
      elapsedMs: 0,
    })
  }

  function finishStreamStatus(timing = {}) {
    const full = streamTargetRef.current
    setStreamStatus(prev => {
      if (!prev) return null
      return {
        ...prev,
        phase: 'done',
        ...timing,
        displayedChars: full.length,
        receivedChars: full.length,
        elapsedMs: Date.now() - prev.startedAt,
      }
    })
    setTimeout(() => setStreamStatus(null), 2000)
  }

  function appendStreamContent(delta) {
    streamTargetRef.current += delta
    const full = streamTargetRef.current
    const now = Date.now()
    if (!streamOutputStartRef.current) streamOutputStartRef.current = now

    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.role !== 'assistant') return prev
      updated[updated.length - 1] = { ...last, content: full, streaming: true }
      return updated
    })

    setStreamStatus(prev => {
      if (!prev) return prev
      const firstChunkMs = prev.firstChunkMs ?? (now - prev.startedAt)
      const elapsedMs = now - prev.startedAt
      return {
        ...prev,
        phase: 'outputting',
        firstChunkMs,
        displayedChars: full.length,
        receivedChars: full.length,
        elapsedMs,
        outputElapsedMs: Math.max(0, elapsedMs - firstChunkMs),
      }
    })

    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }

  function finalizeStreamMessage() {
    const full = streamTargetRef.current
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.role === 'assistant') {
        updated[updated.length - 1] = full
          ? { ...last, content: full, streaming: false }
          : { ...last, streaming: false }
      }
      return updated
    })
    setIsStreaming(false)
  }

  function resetStreamState() {
    streamTargetRef.current = ''
    streamOutputStartRef.current = null
    setStreamStatus(null)
  }

  useEffect(() => {
    if (!streamStatus || streamStatus.phase === 'done') return
    const id = setInterval(() => {
      setStreamStatus(prev => {
        if (!prev || prev.phase === 'done') return prev
        const elapsedMs = Date.now() - prev.startedAt
        const next = { ...prev, elapsedMs }
        if (prev.firstChunkMs != null) {
          next.outputElapsedMs = Math.max(0, elapsedMs - prev.firstChunkMs)
        }
        if (prev.phase === 'outputting') {
          next.displayedChars = streamTargetRef.current.length
          next.receivedChars = streamTargetRef.current.length
        }
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [streamStatus?.phase, streamStatus?.startedAt])

  async function doStreamRequest(text, retryCount = 0) {
    const MAX_RETRIES = 2
    const res = await fetch('/api/chat/stream', {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId: sessionIdRef.current, content: text, userId: user?.id }),  // 使用 ref
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
    let gotContent = false

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
                sessionIdRef.current = parsed.sessionId  // 同步更新 ref
                localStorage.setItem('appeal_session_id', parsed.sessionId)
              }
              if (parsed.totalSteps) setInfoTotal(parsed.totalSteps)
              if (parsed.step !== undefined) setInfoStep(parsed.step)
              if (parsed.progress) setInfoProgress(parsed.progress)
              if (parsed.model?.name) patchStreamStatus({ model: parsed.model.name, phase: 'preparing' })
            } else if (parsed.type === 'info_update') {
              setCollectedInfo(prev => {
                const next = { ...prev, [parsed.key]: parsed.value }
                if (isDDScenario(next)) setShowDueDiligence(true)
                return next
              })
              if (parsed.step !== undefined) setInfoStep(parsed.step)
              if (parsed.totalSteps) setInfoTotal(parsed.totalSteps)
              if (parsed.progress) setInfoProgress(parsed.progress)
              if (!infoFields.find(f => f.key === parsed.key)) {
                setInfoFields(prev => [...prev, { key: parsed.key, label: parsed.label, group: parsed.group, icon: parsed.icon }])
              }
              // 信息收集静默进行，统一在「我的」查看
              setAnalysisKey(prev => prev + 1)
            } else if (parsed.type === 'status') {
              patchStreamStatus({
                phase: parsed.phase,
                model: parsed.model || undefined,
              })
            } else if (parsed.type === 'chunk') {
              gotContent = true
              appendStreamContent(parsed.content)
            } else if (parsed.type === 'usage') {
              if (parsed.balance !== null && parsed.balance !== undefined && user) {
                const u = { ...user, balance: parsed.balance }
                setUser(u)
                localStorage.setItem('appeal_user', JSON.stringify(u))
              }
              // 附加 token 用量到最后一条 assistant 消息
              if (parsed.tokenUsage && gotContent) {
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
              patchStreamStatus({
                connectMs: parsed.connectMs ?? parsed.firstByteMs ?? undefined,
                firstChunkMs: parsed.firstChunkMs ?? undefined,
                totalMs: parsed.totalMs ?? undefined,
                model: parsed.model || undefined,
                phase: parsed.firstChunkMs ? 'outputting' : (parsed.connectMs != null || parsed.firstByteMs != null ? 'waiting' : undefined),
              })
              if (gotContent) {
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
            } else if (parsed.type === 'completeness') {
              if (parsed.triggerDDGuide) {
                setAnalysisKey(prev => prev + 1)
                setShowDueDiligence(true)
              } else if (parsed.triggerReport) {
                setAnalysisKey(prev => prev + 1)
                // 收集完成后自动显示AI分析面板
                if (window.innerWidth >= 1280) setShowAIPanel(true)
                // 收集完成后延迟展示名片（关键转化节点）
                if (contactCard || contactCards.length > 0) {
                  setTimeout(() => setShowContact(true), 3000)
                }
              }
            } else if (parsed.type === 'error') {
              finalizeStreamMessage()
              setIsStreaming(false)
              const role = parsed.needRecharge ? 'system' : 'assistant'
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant' && (last.streaming || !gotContent)) {
                  updated[updated.length - 1] = { role, content: parsed.content, streaming: false }
                } else {
                  updated.push({ role, content: parsed.content })
                }
                return updated
              })
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
      if (retryCount < MAX_RETRIES && !gotContent) {
        console.log(`[重试] 第${retryCount + 1}次重试...`)
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
        return doStreamRequest(text, retryCount + 1)
      }
      throw streamErr
    }

    finalizeStreamMessage()
    finishStreamStatus()
    if (!gotContent) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.streaming) {
          updated[updated.length - 1] = { ...last, content: '抱歉，未收到回复，请重试。', streaming: false }
        } else {
          updated.push({ role: 'assistant', content: '抱歉，未收到回复，请重试。' })
        }
        return updated
      })
      setIsStreaming(false)
    }
    lastFailedMsg.current = null
    refreshInfoFromServer()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || isStreaming) return
    setInput('')
    resetStreamState()
    beginStreamStatus()
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true },
    ])
    setIsStreaming(true)
    setLoading(true)
    try {
      await doStreamRequest(text)
    } catch (err) {
      console.error('Send error:', err)
      finalizeStreamMessage()
      resetStreamState()
      setIsStreaming(false)
      lastFailedMsg.current = text
      setMessages(prev => {
        const updated = prev.filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
        return [...updated, { role: 'assistant', content: '⚠️ 网络出现问题，发送失败。', retryable: true }]
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleRetry() {
    const text = lastFailedMsg.current
    if (!text || loading || isStreaming) return
    setMessages(prev => [
      ...prev.filter(m => !m.retryable),
      { role: 'assistant', content: '', streaming: true },
    ])
    resetStreamState()
    beginStreamStatus()
    setIsStreaming(true)
    setLoading(true)
    try {
      await doStreamRequest(text)
    } catch (err) {
      console.error('Retry error:', err)
      finalizeStreamMessage()
      resetStreamState()
      setIsStreaming(false)
      lastFailedMsg.current = text
      setMessages(prev => {
        const updated = prev.filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
        return [...updated, { role: 'assistant', content: '⚠️ 重试仍然失败，请检查网络后再试。', retryable: true }]
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ========== AI砍价 ==========
  function openBargain(product) {
    setBargainProduct(product)
    setBargainHistory([])
    setBargainInput('')
    setBargainDeal(null)
    setBargainLoading(true)
    // AI先打招呼
    fetch(`/api/mall/products/${product.id}/bargain`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: [], message: '你好，我想了解一下这个服务，价格能优惠吗？' }),
    }).then(r => r.json()).then(d => {
      setBargainHistory([
        { role: 'user', content: '你好，我想了解一下这个服务，价格能优惠吗？' },
        { role: 'assistant', content: d.reply },
      ])
    }).catch(() => {
      setBargainHistory([{ role: 'assistant', content: '您好！欢迎咨询，这款服务性价比很高~' }])
    }).finally(() => setBargainLoading(false))
  }

  async function sendBargain() {
    const text = bargainInput.trim()
    if (!text || bargainLoading || !bargainProduct) return
    setBargainInput('')
    const newHistory = [...bargainHistory, { role: 'user', content: text }]
    setBargainHistory(newHistory)
    setBargainLoading(true)
    try {
      const res = await fetch(`/api/mall/products/${bargainProduct.id}/bargain`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: newHistory.slice(-8), message: text }),
      })
      const d = await res.json()
      setBargainHistory(prev => [...prev, { role: 'assistant', content: d.reply }])
      if (d.accepted && d.finalPrice) {
        setBargainDeal({ finalPrice: d.finalPrice })
      }
    } catch {
      setBargainHistory(prev => [...prev, { role: 'assistant', content: '网络不太好，再试试~' }])
    } finally { setBargainLoading(false) }
  }

  async function handlePurchase(product) {
    if (purchasing) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/orders/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ productId: product.id, collectedData: collectedInfo }),
      })
      const d = await res.json()
      if (d.success) {
        setDetailProduct(null)
        setBargainProduct(null)
        chatNavigate(`/service/${d.orderNo}`)
      } else if (d.needRecharge) {
        alert(`余额不足（当前 ¥${d.balance}，需要 ¥${d.price}），请先充值`)
      } else {
        alert(d.error || '购买失败')
      }
    } catch (err) {
      alert('购买失败，请稍后重试')
    }
    setPurchasing(false)
  }

  function handleNewChat() {
    // Smooth transition: fade out → reset → animate in
    setChatFading(true)
    setTimeout(() => {
      localStorage.removeItem('appeal_session_id')
      setSessionId(null)
      sessionIdRef.current = null  // 清除 ref
      setBoundOrder(null)  // 清除绑定的订单
      setMessages([{ role: 'assistant', content: WELCOME }])
      setCollectedInfo({}); setInfoFields([]); setInfoStep(0); setShowInfoPanel(false); setShowAIPanel(false); setShowComplaintDoc(false); setShowAppealGuide(false); setShowDueDiligence(false); setAnalysisKey(0); contactShownRef.current = false
      setRiskLevel(null); prevRiskRef.current = null
      setView('chat')
      setChatFading(false)
      setNewChatAnim(true)
      setTimeout(() => { setNewChatAnim(false); inputRef.current?.focus() }, 400)
    }, 150)
  }

  function handleFieldUpdate(key, value) {
    setCollectedInfo(prev => ({ ...prev, [key]: value }))
    setAnalysisKey(prev => prev + 1)
    refreshInfoFromServer()
    const fieldDef = infoFields.find(f => f.key === key)
    const label = fieldDef ? fieldDef.label : key
    const display = value.length > 30 ? value.slice(0, 30) + '...' : value
    const hint = isDDScenario(collectedInfo)
      ? '后续的尽调填写内容与材料清单会根据修改后的信息自动更新~'
      : '后续的申诉策略和材料会根据修改后的信息重新调整~'
    setMessages(prev => [...prev, { role: 'assistant', content: `✅ 已更新「${label}」为：${display}\n\n${hint}` }])
  }

  function handleExportChat() {
    if (messages.length <= 1) return
    const lines = []
    lines.push('═══════════════════════════════════════')
    lines.push('  商户号申诉顾问 - 对话记录导出')
    lines.push(`  导出时间: ${new Date().toLocaleString('zh-CN')}`)
    if (user?.nickname) lines.push(`  用户: ${user.nickname}`)
    lines.push('═══════════════════════════════════════')
    lines.push('')
    messages.forEach((msg, i) => {
      const role = msg.role === 'user' ? `【${user?.nickname || '我'}】` : '【AI顾问】'
      // Strip markdown for clean text export
      let text = msg.content || ''
      text = text.replace(/\*\*([\s\S]+?)\*\*/g, '$1')
      text = text.replace(/\*\*/g, '')
      text = text.replace(/^#{1,6}\s+/gm, '')
      text = text.replace(/`([^`]+)`/g, '$1')
      text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1')
      lines.push(`${role}`)
      lines.push(text)
      lines.push('')
    })
    // Add collected info summary if available
    const infoKeys = Object.keys(collectedInfo).filter(k => !k.startsWith('_') && collectedInfo[k])
    if (infoKeys.length > 0) {
      lines.push('═══════════════════════════════════════')
      lines.push('  已收集的申诉信息')
      lines.push('═══════════════════════════════════════')
      const labels = { problem_type: '处罚类型', violation_reason: '违规原因', merchant_id: '商户号', merchant_name: '商户名称', company_name: '公司全称', license_no: '信用代码', legal_name: '法人姓名', legal_id_last4: '身份证后四位', industry: '所属行业', business_model: '经营模式', complaint_status: '投诉情况', refund_policy: '退款政策', bank_name: '开户银行', bank_account_last4: '账户后四位', contact_phone: '联系电话', appeal_history: '申诉历史', business_scenario: '经营场景', miniprogram_name: '小程序名称', miniprogram_appid: 'AppID', order_info: '订单信息' }
      infoKeys.forEach(k => {
        const label = labels[k] || k
        const val = collectedInfo[k]
        if (val) lines.push(`${label}: ${val}`)
      })
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `申诉对话记录_${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleLogout() {
    clearAuth()
    tokenRef.current = ''
    localStorage.removeItem('appeal_session_id')
    setUser(null); setSessionId(null); setMessages([])
    setMobileTab('home')
    setView('auth')
  }

  async function openRecharge() {
    setShowRecharge(true)
    setRechargeAmount(null)
    setRechargeRemark('')
    setRechargeMethod('wechat')
    setPaymentPending(null)
    setPaymentStatus('')
    if (paymentPollRef.current) { clearInterval(paymentPollRef.current); paymentPollRef.current = null }
    try {
      const res = await fetch('/api/recharge/config')
      const data = await res.json()
      setRechargeConfig(data)
      if (data.amounts?.length) setRechargeAmount(data.amounts[0])
    } catch { setRechargeConfig(null) }
  }

  function closeRecharge() {
    setShowRecharge(false)
    setPaymentPending(null)
    setPaymentStatus('')
    if (paymentPollRef.current) { clearInterval(paymentPollRef.current); paymentPollRef.current = null }
  }

  // 轮询支付状态
  function startPaymentPolling(outTradeNo) {
    if (paymentPollRef.current) clearInterval(paymentPollRef.current)
    let pollCount = 0
    const maxPolls = 120 // 最多轮询120次（约10分钟）
    paymentPollRef.current = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        clearInterval(paymentPollRef.current)
        paymentPollRef.current = null
        setPaymentStatus('timeout')
        return
      }
      try {
        const res = await fetch(`/api/recharge/status/${outTradeNo}`, { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.status === 'paid') {
          clearInterval(paymentPollRef.current)
          paymentPollRef.current = null
          setPaymentStatus('paid')
          // 刷新用户信息获取最新余额
          if (user) {
            try {
              const uRes = await fetch(`/api/user/${user.id}`, { headers: getAuthHeaders() })
              const uData = await uRes.json()
              if (uData.user) {
                setUser(uData.user)
                localStorage.setItem('appeal_user', JSON.stringify(uData.user))
              }
            } catch {}
          }
        } else if (data.status === 'failed') {
          clearInterval(paymentPollRef.current)
          paymentPollRef.current = null
          setPaymentStatus('failed')
        }
      } catch { /* 网络错误，继续轮询 */ }
    }, 5000) // 每5秒轮询一次
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

      if (data.realPayment && data.outTradeNo) {
        // 真实支付模式
        if (data.type === 'qrcode' && data.codeUrl) {
          // 微信支付：展示二维码
          setPaymentPending({ outTradeNo: data.outTradeNo, method: 'wechat', codeUrl: data.codeUrl, amount: rechargeAmount })
          setPaymentStatus('pending')
          startPaymentPolling(data.outTradeNo)
        } else if (data.type === 'form' && data.formHtml) {
          // 支付宝：新窗口打开支付页面
          const win = window.open('', '_blank')
          if (win) {
            win.document.write(data.formHtml)
            win.document.close()
          }
          setPaymentPending({ outTradeNo: data.outTradeNo, method: 'alipay', amount: rechargeAmount })
          setPaymentStatus('pending')
          startPaymentPolling(data.outTradeNo)
        } else if (data.type === 'redirect' && data.payUrl) {
          // 易支付/码支付：跳转到支付页面
          window.open(data.payUrl, '_blank')
          setPaymentPending({ outTradeNo: data.outTradeNo, method: rechargeMethod, amount: rechargeAmount })
          setPaymentStatus('pending')
          startPaymentPolling(data.outTradeNo)
        }
      } else {
        // 手动充值模式（兜底）
        const msg = data.message || '充值申请已提交！管理员确认后余额将自动到账。'
        alert(msg)
        closeRecharge()
      }
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

  useEffect(() => {
    const el = edgeSwipeRef.current
    if (!el) return

    function onStart(e) {
      const t = e.touches[0]
      touchRef.current = { startX: t.clientX, startY: t.clientY, dragging: false }
    }
    function onMove(e) {
      if (drawerOpen) return
      const t = e.touches[0]
      const dx = t.clientX - touchRef.current.startX
      const dy = t.clientY - touchRef.current.startY
      if (touchRef.current.startX < 30 && dx > 20 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        touchRef.current.dragging = true
      }
    }
    function onEnd() {
      if (touchRef.current.dragging) {
        setDrawerOpen(true)
        loadMySessions()
      }
      touchRef.current.dragging = false
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [drawerOpen, user?.id])

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
    sessionIdRef.current = sid
    localStorage.setItem('appeal_session_id', sid)
    setMobileTab('chat')
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
        setInfoProgress(infoData.progress || null)
      }
      setAnalysisKey(prev => prev + 1)
      setView('chat')
    }).catch(() => setView('chat'))
  }

  async function openOrderPanel() {
    if (!sessionId) {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: user?.id }),
        })
        const data = await res.json()
        if (data.sessionId) {
          setSessionId(data.sessionId)
          sessionIdRef.current = data.sessionId
          localStorage.setItem('appeal_session_id', data.sessionId)
        }
      } catch (e) {
        console.error('创建session失败:', e)
      }
    }
    setShowOrderPanel(true)
  }

  function openHistoryMenu() {
    if (window.innerWidth < 640) openDrawer()
    else openMyHistory()
  }

  // ========== 加载页 ==========
  if (!ready) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#07C160] flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white " fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  // ========== 登录 / 绑定手机 ==========
  if (view === 'auth') {
    return <AuthView onSuccess={enterApp} />
  }

  if (view === 'bindPhone') {
    return <BindPhoneView user={user} onSuccess={enterApp} />
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
                    <span className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">官方 API</h3>
                  </div>
                  <p className="text-xs text-gray-400 ml-10">平台 AI 服务，免费模型不扣费</p>
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
                    <span className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">自定义 API</h3>
                  </div>
                  <p className="text-xs text-gray-400 ml-10">使用自己的 API Key（支持多种模型）</p>
                  <span className="inline-block mt-1.5 ml-10 text-xs bg-violet-50 text-violet-500 px-2 py-0.5 rounded-md font-medium">自有 Key · 免费</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1.5 ${selectedApiMode === 'custom' ? 'border-[#07C160] bg-[#07C160]' : 'border-gray-200'}`}>
                  {selectedApiMode === 'custom' && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
              </div>
            </div>

            {selectedApiMode === 'custom' && (
              <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">您的 API Key</label>
                <input type="password" value={customKey} onChange={e => setCustomKey(e.target.value)}
                  placeholder="输入您的 API Key" className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-white text-sm focus:ring-2 focus:ring-violet-300/30 focus:border-violet-400 transition-all placeholder:text-gray-300" />
              </div>
            )}

            {apiModeError && <p className="text-xs text-red-500 text-center bg-red-50 py-2 rounded-xl">{apiModeError}</p>}

            <button onClick={handleApiModeConfirm} disabled={apiModeSaving}
              className="w-full py-2.5 bg-[#07C160] text-white text-sm font-medium rounded-xl disabled:opacity-50 shadow-sm hover:shadow-md transition-all">
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
                <button onClick={handleNewChat} className="mt-4 px-5 py-2 bg-[#07C160] text-white text-sm rounded-xl shadow-sm">开始新对话</button>
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
                        <button onClick={() => continueSession(s.id)} className="px-3 py-1.5 text-xs text-white bg-[#07C160] rounded-lg shadow-sm hover:shadow-md font-medium transition-all">继续</button>
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
                  className="px-3 py-1.5 text-xs text-white bg-[#07C160] rounded-lg shadow-sm font-medium">继续对话</button>
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
    <div className={`mp-app h-screen h-dvh flex flex-col overflow-hidden min-h-0 ${isProfessionalMode ? 'pro-mode' : ''} ${proModeAnim ? 'mode-switch-anim' : ''} ${riskLevel?.level ? `risk-${riskLevel.level}` : ''} ${riskTransition ? 'risk-transition' : ''}`}>
      <ChatHeader
        tab={mobileTab}
        isProfessionalMode={isProfessionalMode}
        infoProgress={infoProgress}
        collectedInfo={collectedInfo}
        infoTotal={infoTotal}
        boundOrder={boundOrder}
        onOpenHistory={openHistoryMenu}
        onOpenMore={() => setShowMoreMenu(true)}
      />

      {mobileTab === 'home' ? (
        <HomeTab
          user={user}
          onGoChat={() => setMobileTab('chat')}
          onGoTools={() => setMobileTab('tools')}
          onGoCases={() => setMobileTab('cases')}
        />
      ) : mobileTab === 'cases' ? (
        <CasesTab onOpenChat={openSessionFromCases} />
      ) : mobileTab === 'me' ? (
        <UserCenter
          embedded
          user={user}
          onClose={() => setMobileTab('home')}
          onRecharge={() => { setMobileTab('chat'); openRecharge() }}
          getAuthHeaders={getAuthHeaders}
          collectedInfo={collectedInfo}
          infoProgress={infoProgress}
          infoTotal={infoTotal}
          boundOrder={boundOrder}
          onOpenInfo={withSession(() => setShowInfoPanel(true))}
          onOpenTools={() => setMobileTab('tools')}
          onBindOrder={withSession(() => openOrderPanel())}
          onOpenHistory={withSession(() => openHistoryMenu())}
          onOpenTheme={withSession(() => setShowThemePicker(true))}
          onApiMode={() => { setSelectedApiMode(user?.api_mode || 'official'); setCustomKey(''); setView('apiSelect') }}
          onLogout={handleLogout}
          onContact={() => { setMobileTab('chat'); setShowContact(true) }}
          contactAvailable={!!(contactCard || contactCards.length > 0)}
        />
      ) : mobileTab === 'tools' ? (
        <ToolsHubPage
          collectedInfo={collectedInfo}
          hasInfoData={hasInfoData}
          showAppealPanel={showAppealPanel}
          showComplaintDoc={showComplaintDoc}
          showAppealGuide={showAppealGuide}
          showDueDiligence={showDueDiligence}
          showAIPanel={showAIPanel}
          showInfoPanel={showInfoPanel}
          onToggleAppeal={withSession(() => setShowAppealPanel(v => !v))}
          onToggleComplaint={withSession(() => setShowComplaintDoc(v => !v))}
          onToggleGuide={withSession(() => setShowAppealGuide(v => !v))}
          onToggleDueDiligence={withSession(() => setShowDueDiligence(v => !v))}
          onToggleAI={withSession(() => setShowAIPanel(v => !v))}
          onToggleInfo={withSession(() => setShowInfoPanel(v => !v))}
        />
      ) : mobileTab === 'chat' ? (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ChatToolStrip
        collectedInfo={collectedInfo}
        hasInfoData={hasInfoData}
        showAppealPanel={showAppealPanel}
        showComplaintDoc={showComplaintDoc}
        showAppealGuide={showAppealGuide}
        showDueDiligence={showDueDiligence}
        showAIPanel={showAIPanel}
        showInfoPanel={showInfoPanel}
        onToggleAppeal={withSession(() => setShowAppealPanel(v => !v))}
        onToggleComplaint={withSession(() => setShowComplaintDoc(v => !v))}
        onToggleGuide={withSession(() => setShowAppealGuide(v => !v))}
        onToggleDueDiligence={withSession(() => setShowDueDiligence(v => !v))}
        onToggleAI={withSession(() => setShowAIPanel(v => !v))}
        onToggleInfo={withSession(() => setShowInfoPanel(v => !v))}
        onOpenMore={() => setShowMoreMenu(true)}
      />

      {/* 专业模式进度：仅桌面端顶栏下细线 */}
      {isProfessionalMode && hasInfoData && (
        <div className="hidden md:block flex-shrink-0 pro-progress-bar">
          <div className="pro-progress-fill"
            style={{ width: `${Math.min(100, Math.round(((infoProgress?.filled ?? 0) / Math.max((infoProgress?.total ?? infoTotal) || 1, 1)) * 100))}%` }} />
        </div>
      )}

      {/* 三栏布局：AI面板(左) | 聊天(中) | 客户信息(右) */}
      <div className="flex-1 flex overflow-hidden min-h-0 chat-main-with-nav">

        {/* 左侧AI分析面板 - xl桌面端显示，移动端覆盖 */}
        <div className={`
          xl:relative xl:w-80 2xl:w-96 xl:border-r xl:block
          ${isProfessionalMode ? 'xl:border-amber-200/40' : 'xl:border-gray-200/60'}
          ${showAIPanel ? 'fixed inset-0 z-40 xl:static xl:inset-auto xl:z-auto' : 'hidden'}
        `}>
          {showAIPanel && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] xl:hidden" onClick={() => setShowAIPanel(false)} />}
          <div className={`
            ${showAIPanel ? 'absolute left-0 top-0 bottom-0 panel-slide-left shadow-2xl xl:shadow-none xl:static xl:w-full' : ''}
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <main onClick={e => {
            const prodCard = e.target.closest('.product-rec-card')
            if (prodCard) { const pid = prodCard.dataset.productId; if (pid) { fetch(`/api/mall/products/${pid}`).then(r=>r.json()).then(d=>{ if(d.product) setDetailProduct(d.product) }).catch(()=>{}) }; return }
            const contactRecCard = e.target.closest('.contact-rec-card')
            if (contactRecCard) { setShowContact(true); return }
          }} className={`chat-messages-area flex-1 min-h-0 overflow-y-auto overscroll-contain gpu-scroll ${isProfessionalMode ? 'pro-chat-bg pro-grid-bg' : 'mp-chat-bg'}`}>
            <div className={`chat-thread mx-auto w-full max-w-3xl px-3 sm:px-4 py-3 sm:py-4 transition-opacity duration-150 ${chatFading ? 'opacity-0' : 'opacity-100'} ${newChatAnim ? 'animate-new-chat' : ''}`}>
              {messages.map((msg, i) => (
                <React.Fragment key={i}>
                  <ChatMessage
                    role={msg.role}
                    content={msg.content}
                    animate={i === messages.length - 1}
                    timing={msg.timing}
                    tokenUsage={msg.tokenUsage}
                    proMode={isProfessionalMode}
                    streaming={msg.streaming}
                    streamStatus={i === messages.length - 1 && msg.streaming ? streamStatus : null}
                  />
                  {msg.retryable && (
                    <div className="flex justify-center py-2">
                      <button onClick={handleRetry} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-[#07C160] hover:from-[#06a050] hover:to-[#048a5a] disabled:opacity-50 rounded-full shadow-md transition-all active:scale-95">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        点击重试
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
              {loading && !isStreaming && <TypingIndicator proMode={isProfessionalMode} />}
              <div ref={bottomRef} />
            </div>
          </main>

          <ChatInputFooter
            input={input}
            setInput={setInput}
            loading={loading || isStreaming}
            streamStatus={streamStatus}
            inputRef={inputRef}
            isProfessionalMode={isProfessionalMode}
            messages={messages}
            collectedInfo={collectedInfo}
            infoProgress={infoProgress}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 右侧客户信息面板 - lg桌面端显示，移动端覆盖 */}
        <div className={`
          lg:relative lg:w-80 xl:w-80 2xl:w-96 lg:border-l lg:block
          ${isProfessionalMode ? 'lg:border-amber-200/40' : 'lg:border-gray-200/60'}
          ${showInfoPanel ? 'fixed inset-0 z-40 lg:static lg:inset-auto lg:z-auto' : 'hidden'}
        `}>
          {showInfoPanel && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] lg:hidden" onClick={() => setShowInfoPanel(false)} />}
          <div className={`
            ${showInfoPanel ? 'absolute right-0 top-0 bottom-0 panel-slide-right shadow-2xl lg:shadow-none lg:static lg:w-full' : ''}
            h-full
          `}>
            <InfoPanel
              collectedData={collectedInfo}
              fields={infoFields}
              step={infoStep}
              totalSteps={infoTotal}
              progress={infoProgress}
              sessionId={sessionId}
              onClose={() => setShowInfoPanel(false)}
              onFieldUpdate={handleFieldUpdate}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      </div>
      </div>
      ) : null}

      {/* 申诉全流程指导面板（覆盖层） */}
      {showDueDiligence && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowDueDiligence(false)}>
          <div className="ml-auto w-full max-w-lg h-full bg-white shadow-2xl flex flex-col panel-slide-right" onClick={e => e.stopPropagation()}>
            <DueDiligencePanel
              sessionId={sessionId}
              onClose={() => setShowDueDiligence(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      )}

      {showAppealGuide && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowAppealGuide(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
            <AppealGuidePanel
              sessionId={sessionId}
              onClose={() => setShowAppealGuide(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      )}

      {/* 投诉材料整理面板（覆盖层） */}
      {showComplaintDoc && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowComplaintDoc(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="relative ml-auto w-80 sm:w-96 h-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <ComplaintDocPanel
              sessionId={sessionId}
              userId={user?.id}
              onClose={() => setShowComplaintDoc(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </div>
        </div>
      )}

      {/* 申诉文案面板（尽调场景不使用） */}
      {showAppealPanel && !isDDScenario(collectedInfo) && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setShowAppealPanel(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div className="relative ml-auto w-80 sm:w-96 h-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <AppealTextPanel
              sessionId={sessionId}
              userId={user?.id}
              onClose={() => setShowAppealPanel(false)}
              getAuthHeaders={getAuthHeaders}
              isDueDiligence={isDDScenario(collectedInfo)}
              onOpenDueDiligence={() => setShowDueDiligence(true)}
            />
          </div>
        </div>
      )}

      {/* 订单绑定面板 */}
      {showOrderPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[6px]" onClick={() => setShowOrderPanel(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in" style={{ boxShadow: '0 -8px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div className="px-6 py-4 bg-orange-50 rounded-t-3xl border-b border-orange-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">绑定闲鱼订单</h3>
                    <p className="text-xs text-gray-500 mt-0.5">选择要关联的订单，获取客户信息</p>
                  </div>
                </div>
                <button onClick={() => setShowOrderPanel(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            {/* 已绑定订单显示 */}
            {boundOrder && (() => {
              const panelImage = boundOrder.goods?.first_image || boundOrder.goods?.images?.[0] || ''
              return (
              <div className="px-6 py-3 bg-green-50 border-b border-green-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    </span>
                    <span className="text-sm font-medium text-green-700">已绑定订单</span>
                  </div>
                  <button onClick={() => { setBoundOrder(null); fetch(`/api/sessions/${sessionId}/bind-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_no: null, order_data: null }) }).catch(() => {}) }} className="text-xs text-red-500 hover:text-red-600 font-medium">解除绑定</button>
                </div>
                <div className="mt-2 flex gap-3 bg-white rounded-lg p-2">
                  {panelImage && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      <img src={panelImage} alt="商品图" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <div className="col-span-2 font-medium text-gray-700 truncate">{boundOrder.goods?.title || '未知商品'}</div>
                      <div>买家: {boundOrder.buyer_nick || '未知'}</div>
                      <div>¥{smartFormatAmount(boundOrder.pay_amount)}</div>
                      <div>状态: {boundOrder.order_status_text || '未知'}</div>
                      <div>类型: {boundOrder.order_type_text || '普通'}</div>
                      <div className="col-span-2">📞 {boundOrder.receiver_mobile || '无'}</div>
                      <div className="col-span-2">📦 {boundOrder.receiver_name || '未填写'}</div>
                      <div className="col-span-2 truncate">📍 {boundOrder.full_address || [boundOrder.receiver_state, boundOrder.receiver_city, boundOrder.receiver_district, boundOrder.receiver_address].filter(Boolean).join('') || '未填写'}</div>
                      {boundOrder.waybill_no && (
                        <div className="col-span-2">🚚 {boundOrder.express_name || boundOrder.express_code}: {boundOrder.waybill_no}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}
            {/* 订单列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {orderListLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full" />
                  <span className="ml-3 text-sm text-gray-500">加载订单中...</span>
                </div>
              ) : orderList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{orderListHint || '暂无订单数据'}</p>
                  <button onClick={() => loadOrderList(true)} className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md">
                    刷新订单列表
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderList.map((order, idx) => {
                    const orderImage = order.goods?.first_image || order.goods?.images?.[0] || ''
                    const statusStyle = getOrderStatusStyle(order.order_status_text, order.order_status)
                    return (
                    <div key={idx} onClick={async () => {
                      let sid = sessionIdRef.current
                      if (!sid) {
                        try {
                          const res = await fetch('/api/sessions', { 
                            method: 'POST', 
                            headers: getAuthHeaders(), 
                            body: JSON.stringify({ 
                              userId: user?.id,
                              orderNo: order.order_no,
                              orderData: order
                            }) 
                          })
                          const data = await res.json()
                          if (data.sessionId) {
                            sid = data.sessionId
                            setSessionId(sid)
                            sessionIdRef.current = sid
                            localStorage.setItem('appeal_session_id', sid)
                            setBoundOrder(order)
                            setShowOrderPanel(false)
                            return
                          }
                        } catch (e) { console.error('创建session失败:', e); return }
                      }
                      if (sid) {
                        try {
                          await fetch(`/api/sessions/${sid}/bind-order`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ order_no: order.order_no, order_data: order }) })
                          setBoundOrder(order)
                          setShowOrderPanel(false)
                        } catch (e) { alert('绑定失败') }
                      }
                    }}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${boundOrder?.order_no === order.order_no ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white hover:border-orange-200'}`}>
                      <div className="flex gap-3">
                        {orderImage && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={orderImage} alt="商品图" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900">{order.buyer_nick || '未知买家'}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>{statusStyle.label}</span>
                              <span className="text-xs text-gray-400">{order.order_type_text || '普通订单'}</span>
                            </div>
                            <div className="text-right ml-2">
                              <p className="text-sm font-bold text-orange-600">¥{smartFormatAmount(order.pay_amount)}</p>
                              <p className="text-xs text-gray-400">{order.goods?.quantity || 1}件</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 truncate mb-1.5">{order.goods?.title || '商品信息'}</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">📦</span>
                              <span className="text-gray-500 truncate">{order.receiver_name || '未填写'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">📞</span>
                              <span className="text-gray-500">{order.receiver_mobile || '无'}</span>
                            </div>
                            <div className="col-span-2 flex items-center gap-1">
                              <span className="text-gray-400">📍</span>
                              <span className="text-gray-500 truncate">{order.full_address || [order.receiver_state, order.receiver_city, order.receiver_district, order.receiver_address].filter(Boolean).join('') || '未填写'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">🕐</span>
                              <span className="text-gray-500">{order.order_time_date || order.order_time_str || (order.order_time ? new Date(order.order_time * 1000).toLocaleDateString() : '未知')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">💰</span>
                              <span className="text-gray-500">{order.express_fee > 0 ? `含运费¥${smartFormatAmount(order.express_fee)}` : '免运费'}</span>
                            </div>
                            {order.seller_name && (
                              <div className="col-span-2 flex items-center gap-1">
                                <span className="text-gray-400">🏪</span>
                                <span className="text-gray-500 truncate">卖家: {order.seller_name}</span>
                              </div>
                            )}
                            {order.waybill_no && (
                              <div className="col-span-2 flex items-center gap-1">
                                <span className="text-gray-400">🚚</span>
                                <span className="text-gray-500 truncate">{order.express_name || order.express_code}: {order.waybill_no}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {boundOrder?.order_no === order.order_no && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                          当前绑定
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
            {/* 底部操作 */}
            <div className="px-6 py-4 border-t border-gray-100 safe-bottom">
              <button onClick={() => loadOrderList(true)} disabled={orderListLoading}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-60">
                {orderListLoading ? '加载中...' : '获取闲鱼订单'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 名片弹窗（支持多名片切换） */}
      {showContact && (contactCards.length > 0 || contactCard) && (() => {
        const cards = contactCards.length > 0 ? contactCards : (contactCard ? [contactCard] : [])
        const card = cards[selectedCardIdx] || cards[0]
        if (!card) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[8px] p-4" onClick={() => setShowContact(false)}>
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-scale-in" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
              <div className="bg-orange-500 px-5 py-7 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full" />
                <button onClick={() => setShowContact(false)} className="absolute right-3 top-3 w-7 h-7 flex items-center justify-center text-white/60 hover:text-white rounded-lg hover:bg-white/10 z-10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <div className="relative z-10">
                  <div className="w-18 h-18 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 shadow-lg" style={{width:72,height:72}}>
                    <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{card.name}</h3>
                  <p className="text-white/70 text-xs mt-1 font-medium">{card.title}</p>
                  {card.category && card.category !== 'general' && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 bg-white/15 rounded-full text-[10px] font-medium">{card.category}</span>
                  )}
                  {cards.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-3">
                      {cards.map((c, i) => (
                        <button key={i} onClick={() => { setSelectedCardIdx(i); if (c.id) fetch(`/api/contact-cards/${c.id}/click`, { method: 'POST' }).catch(() => {}) }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${i === selectedCardIdx ? 'bg-white text-amber-600 shadow-sm' : 'bg-white/20 text-white/80 hover:bg-white/30'}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                {card.description && <p className="text-[12px] text-gray-500 text-center leading-relaxed pb-1">{card.description}</p>}
                {card.phone && (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-green-50 border border-green-100/80 hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-green-600 font-medium">电话</div>
                      <div className="text-[14px] font-bold text-gray-800 tracking-wide">{card.phone}</div>
                    </div>
                    <a href={`tel:${card.phone}`} className="px-3.5 py-1.5 bg-green-500 text-white text-xs rounded-xl hover:shadow-md transition-all font-medium">拨打</a>
                  </div>
                )}
                {card.wechat && (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100/80 hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-xl bg-[#07C160] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-emerald-600 font-medium">微信号</div>
                      <div className="text-[14px] font-bold text-gray-800">{card.wechat}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard?.writeText(card.wechat); }} className="px-3.5 py-1.5 bg-[#07C160] text-white text-xs rounded-xl hover:shadow-md transition-all font-medium">复制</button>
                  </div>
                )}
                {card.email && (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-100/80 hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-blue-600 font-medium">邮箱</div>
                      <div className="text-[14px] font-bold text-gray-800 truncate">{card.email}</div>
                    </div>
                    <a href={`mailto:${card.email}`} className="px-3.5 py-1.5 bg-blue-500 text-white text-xs rounded-xl hover:shadow-md transition-all font-medium">发邮件</a>
                  </div>
                )}
                {card.qrCode && (
                  <div className="text-center pt-2 pb-1">
                    <p className="text-[10px] text-gray-400 mb-2">扫码添加微信</p>
                    <img src={card.qrCode} alt="微信二维码" className="w-36 h-36 mx-auto rounded-xl border border-gray-100 shadow-sm" />
                  </div>
                )}
                {!card.phone && !card.wechat && !card.email && (
                  <p className="text-xs text-gray-400 text-center py-4">暂未配置联系方式</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* AI砍价弹窗 */}
      {bargainProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[6px]" onClick={() => setBargainProduct(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in" style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            {/* 商品头部 */}
            <div className="px-5 py-3.5 bg-orange-50 rounded-t-2xl border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-gray-900 truncate">{bargainProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold text-red-500">¥{bargainDeal ? bargainDeal.finalPrice : bargainProduct.price}</span>
                    {bargainDeal && <span className="text-xs text-gray-400 line-through">¥{bargainProduct.price}</span>}
                    {bargainDeal && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded-full font-bold">已砍价</span>}
                  </div>
                </div>
                <button onClick={() => setBargainProduct(null)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            {/* 砍价对话区 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[45vh]">
              {bargainHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {bargainLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* 底部操作区 */}
            <div className="px-4 py-3 border-t border-gray-100 safe-bottom">
              {bargainDeal ? (
                <div className="space-y-2">
                  <div className="text-center">
                    <p className="text-xs text-green-600 font-medium">🎉 成交价: ¥{bargainDeal.finalPrice}</p>
                  </div>
                  <button onClick={() => handlePurchase(bargainProduct)} disabled={purchasing}
                    className="w-full py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm shadow-sm disabled:opacity-60">
                    {purchasing ? '购买中...' : `立即下单 · ¥${bargainDeal.finalPrice}`}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={bargainInput} onChange={e => setBargainInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendBargain() }}
                    placeholder="说说你的出价..." disabled={bargainLoading}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-300/50" />
                  <button onClick={sendBargain} disabled={bargainLoading || !bargainInput.trim()}
                    className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm disabled:opacity-50 hover:bg-amber-600">
                    发送
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 虚拟人设名片弹窗 */}
      {showPersonaCard && virtualPersona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[6px] p-4" onClick={() => setShowPersonaCard(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm animate-scale-in overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="bg-purple-500 px-6 py-8 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="relative z-10">
                <div className="text-4xl mb-2">{virtualPersona.avatar}</div>
                <h3 className="text-xl font-bold">{virtualPersona.name}</h3>
                <p className="text-white/70 text-sm mt-1">{virtualPersona.title}</p>
                {virtualPersona.expertise && (
                  <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
                    {virtualPersona.expertise.map((e, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-medium">{e}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">{virtualPersona.greeting}</p>
              {virtualPersona.personality && (
                <p className="text-[11px] text-gray-400">性格特征: {virtualPersona.personality}</p>
              )}
              <button onClick={() => setShowPersonaCard(false)}
                className="w-full py-2.5 bg-purple-500 text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all">
                开始沟通
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 商品详情+购买弹窗 */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[8px]" onClick={() => { if (!purchasing) setDetailProduct(null) }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md animate-scale-in overflow-hidden" style={{ boxShadow: '0 -8px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            {/* 商品头图区域 */}
            <div className="relative bg-purple-500 px-6 pt-6 pb-8 text-white overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full" />
              <button onClick={() => setDetailProduct(null)} className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded-xl hover:bg-white/10 z-10">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                </div>
                <h2 className="text-xl font-bold tracking-tight">{detailProduct.name}</h2>
                {detailProduct.category && <span className="inline-block mt-2 px-2.5 py-0.5 bg-white/15 rounded-full text-[11px] font-medium">{detailProduct.category}</span>}
              </div>
            </div>
            {/* 价格区域 */}
            <div className="px-6 py-4 bg-red-50 border-b border-red-100/50">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-red-500">¥{detailProduct.price}</span>
                {detailProduct.originalPrice && parseFloat(detailProduct.originalPrice) > parseFloat(detailProduct.price) && (
                  <>
                    <span className="text-sm text-gray-400 line-through">¥{detailProduct.originalPrice}</span>
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md">省¥{(parseFloat(detailProduct.originalPrice) - parseFloat(detailProduct.price)).toFixed(0)}</span>
                  </>
                )}
              </div>
            </div>
            {/* 商品详情 */}
            <div className="px-6 py-4 space-y-3 max-h-[30vh] overflow-y-auto">
              {detailProduct.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{detailProduct.description}</p>
              )}
              {detailProduct.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detailProduct.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[11px] rounded-md font-medium">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <span>购买后由AI专属顾问1对1服务，帮您撰写申诉材料</span>
              </div>
            </div>
            {/* 底部操作 */}
            <div className="px-6 py-4 border-t border-gray-100 safe-bottom space-y-2.5">
              <button onClick={() => handlePurchase(detailProduct)} disabled={purchasing}
                className="w-full py-3 bg-red-500 text-white rounded-2xl font-bold text-[15px] shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-60">
                {purchasing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    购买中...
                  </span>
                ) : `立即购买 · ¥${detailProduct.price}`}
              </button>
              <button onClick={() => { setDetailProduct(null); setBargainProduct(detailProduct); setBargainHistory([]); setBargainDeal(null); setBargainInput('') }}
                className="w-full py-2.5 bg-amber-50 text-amber-700 rounded-2xl font-medium text-sm border border-amber-200/80 hover:bg-amber-100 transition-colors">
                想砍个价？和AI聊聊
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 充值弹窗 */}
      {showRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[6px] p-4" onClick={closeRecharge}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">账户充值</h2>
              <button onClick={closeRecharge} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="w-full h-px bg-gray-200" />

            {/* 支付结果展示 */}
            {paymentStatus === 'paid' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">支付成功</h3>
                <p className="text-sm text-gray-500 mb-4">¥{paymentPending?.amount} 已到账，余额已更新</p>
                <button onClick={closeRecharge} className="px-8 py-2.5 bg-[#07C160] text-white rounded-xl font-medium text-sm">完成</button>
              </div>
            ) : paymentStatus === 'failed' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">支付失败</h3>
                <p className="text-sm text-gray-500 mb-4">订单已取消或支付超时</p>
                <button onClick={() => { setPaymentPending(null); setPaymentStatus('') }} className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">重新充值</button>
              </div>
            ) : paymentStatus === 'timeout' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">等待支付超时</h3>
                <p className="text-sm text-gray-500 mb-4">如已支付，余额将在稍后自动到账</p>
                <button onClick={() => { setPaymentPending(null); setPaymentStatus('') }} className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">重新充值</button>
              </div>

            /* 真实支付等待中：展示二维码 */
            ) : paymentPending ? (
              <div className="p-5 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">请使用{paymentPending.method === 'wechat' ? '微信' : '支付宝'}扫码支付</p>
                  <p className="text-2xl font-bold text-gray-900 mb-3">¥{paymentPending.amount}</p>
                  {paymentPending.codeUrl ? (
                    <div className="mx-auto w-52 h-52 bg-white border-2 border-gray-100 rounded-xl flex items-center justify-center p-2">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentPending.codeUrl)}`}
                        alt="支付二维码" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="mx-auto w-52 h-52 bg-gray-50 rounded-xl flex items-center justify-center">
                      <p className="text-sm text-gray-400">请在新窗口完成支付</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#07C160] rounded-full" />
                  <span>等待支付确认...</span>
                </div>
                <p className="text-[10px] text-gray-300 text-center">支付成功后将自动确认，无需手动操作</p>
                <p className="text-[10px] text-center text-gray-400">订单号: {paymentPending.outTradeNo}</p>
              </div>

            /* 默认：选择金额和支付方式 */
            ) : !rechargeConfig?.enabled ? (
              <div className="p-6 text-center text-gray-400 text-sm">充值功能暂未开放</div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-2">选择充值金额</label>
                  <div className="grid grid-cols-3 gap-2">
                    {rechargeConfig.amounts?.map(a => (
                      <button key={a} onClick={() => setRechargeAmount(a)}
                        className={`py-3 rounded-xl text-[13px] font-bold transition-all ${rechargeAmount === a ? 'bg-[#07C160] text-white shadow-sm' : 'bg-gray-50 text-gray-700 border border-gray-200/80 hover:border-[#07C160]/40'}`}>
                        ¥{a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-500 mb-2">支付方式</label>
                  <div className="flex gap-2">
                    {(rechargeConfig.paymentChannels?.wechat || rechargeConfig.qrWechat) && (
                      <button onClick={() => setRechargeMethod('wechat')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'wechat' ? 'bg-green-50 border-2 border-wechat-green text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-wechat-green rounded-full inline-block" /> 微信支付
                      </button>
                    )}
                    {(rechargeConfig.paymentChannels?.alipay || rechargeConfig.qrAlipay) && (
                      <button onClick={() => setRechargeMethod('alipay')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'alipay' ? 'bg-blue-50 border-2 border-blue-500 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-blue-500 rounded-full inline-block" /> 支付宝
                      </button>
                    )}
                  </div>
                  {/* 易支付/码支付渠道 */}
                  {(rechargeConfig.paymentChannels?.epay || rechargeConfig.paymentChannels?.codepay) && (
                    <div className="flex gap-2 mt-2">
                      {rechargeConfig.paymentChannels?.epay && (
                        <>
                          <button onClick={() => setRechargeMethod('epay_alipay')}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'epay_alipay' ? 'bg-blue-50 border-2 border-blue-400 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">💰</span> 易支付·支付宝
                          </button>
                          <button onClick={() => setRechargeMethod('epay_wxpay')}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'epay_wxpay' ? 'bg-green-50 border-2 border-green-400 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">💰</span> 易支付·微信
                          </button>
                        </>
                      )}
                      {rechargeConfig.paymentChannels?.codepay && (
                        <>
                          <button onClick={() => setRechargeMethod('codepay_alipay')}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'codepay_alipay' ? 'bg-blue-50 border-2 border-blue-400 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">📱</span> 码支付·支付宝
                          </button>
                          <button onClick={() => setRechargeMethod('codepay_wxpay')}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'codepay_wxpay' ? 'bg-green-50 border-2 border-green-400 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">📱</span> 码支付·微信
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {/* 无支付方式提示 */}
                  <div className="mt-1">
                    {!rechargeConfig.paymentChannels?.wechat && !rechargeConfig.qrWechat && !rechargeConfig.paymentChannels?.alipay && !rechargeConfig.qrAlipay && !rechargeConfig.paymentChannels?.epay && !rechargeConfig.paymentChannels?.codepay && (
                      <p className="text-xs text-gray-400">管理员暂未配置支付方式，请联系管理员充值</p>
                    )}
                  </div>
                </div>
                {/* 手动充值模式：展示静态二维码 */}
                {!rechargeConfig.realPayment && ((rechargeMethod === 'wechat' && rechargeConfig.qrWechat) || (rechargeMethod === 'alipay' && rechargeConfig.qrAlipay)) && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">请扫码支付 <strong className="text-lg text-gray-800">¥{rechargeAmount}</strong></p>
                    <img src={rechargeMethod === 'wechat' ? rechargeConfig.qrWechat : rechargeConfig.qrAlipay}
                      alt="收款二维码" className="w-48 h-48 mx-auto rounded-xl border border-gray-200 object-contain bg-white" />
                  </div>
                )}
                {rechargeConfig.instructions && (
                  <p className="text-xs text-gray-500 bg-yellow-50 rounded-lg p-3 border border-yellow-100">{rechargeConfig.instructions}</p>
                )}
                {!rechargeConfig.realPayment && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">付款备注（交易单号或截图说明）</label>
                    <input type="text" value={rechargeRemark} onChange={e => setRechargeRemark(e.target.value)}
                      placeholder="请输入支付后的交易单号或备注"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30" />
                  </div>
                )}
                <button onClick={submitRecharge} disabled={!rechargeAmount || rechargeSubmitting}
                  className="w-full py-2.5 bg-[#07C160] text-white rounded-xl font-medium text-[13px] disabled:opacity-50 shadow-sm transition-all">
                  {rechargeSubmitting ? '创建支付订单...' : rechargeConfig.realPayment ? `立即支付 · ¥${rechargeAmount || 0}` : `提交充值申请 · ¥${rechargeAmount || 0}`}
                </button>
                {rechargeConfig.realPayment ? (
                  <p className="text-[10px] text-gray-300 text-center">支付成功后余额自动到账，无需等待审核</p>
                ) : (
                  <p className="text-[10px] text-gray-300 text-center">提交后管理员将尽快确认，余额自动到账</p>
                )}
                <p className="text-[10px] text-gray-300 text-center mt-1">充值余额用于消耗AI Token，充值后不支持退款/提现。当前免费模型无需余额即可使用。</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatMoreSheet
        open={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        boundOrder={boundOrder}
        contactAvailable={!!(contactCard || contactCards.length > 0)}
        canExport={messages.length > 1}
        onNewChat={handleNewChat}
        onOpenHistory={openHistoryMenu}
        onBindOrder={openOrderPanel}
        onRecharge={openRecharge}
        onContact={() => setShowContact(true)}
        onApiMode={() => { setSelectedApiMode(user?.api_mode || 'official'); setCustomKey(''); setView('apiSelect') }}
        onExport={handleExportChat}
        onLogout={handleLogout}
        onOpenTheme={() => setShowThemePicker(true)}
      />

      <ThemePicker open={showThemePicker} onClose={() => setShowThemePicker(false)} />

      <ChatBottomNav
        activeTab={mobileTab}
        onTabChange={setMobileTab}
      />

      <HistoryDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        loading={mySessionsLoading}
        sessions={visibleSessions}
        fmtTime={fmtTime}
        onNewChat={handleNewChat}
        onViewAll={openMyHistory}
        onView={(id) => { closeDrawer(); openHistory(id) }}
        onContinue={(id) => { closeDrawer(); continueSession(id) }}
        onDelete={softDeleteSession}
      />

      {/* 左边缘滑动手势区（仅咨询 Tab） */}
      {mobileTab === 'chat' && (
      <div
        ref={edgeSwipeRef}
        className="edge-swipe-zone sm:hidden"
        aria-hidden
      />
      )}

    </div>
  )
}

