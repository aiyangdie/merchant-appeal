import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatMessage from '../components/ChatMessage'
import ReportCard from '../components/ReportCard'
import AnalysisVisualView from '../components/AnalysisVisualView'

const TABS = [
  { key: 'dashboard', label: '仪表盘', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
  { key: 'sessions', label: '聊天记录', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { key: 'users', label: '用户管理', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { key: 'knowledge', label: '知识库', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { key: 'analytics', label: '数据分析', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { key: 'settings', label: '设置', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'recharge', label: '充值管理', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const SETTINGS_SUB_TABS = [
  { key: 'general', label: '基本设置', icon: '🏠' },
  { key: 'ai', label: 'AI 配置', icon: '🤖' },
  { key: 'rechargeConfig', label: '充值设置', icon: '💰' },
  { key: 'wechat', label: '微信支付', icon: '💚' },
  { key: 'alipay', label: '支付宝', icon: '🔵' },
  { key: 'security', label: '安全设置', icon: '🔒' },
]

const SENSITIVE_KEYS = ['api_key', 'api_v3_key', 'private_key', 'password', 'serial_no', 'public_key']

const ACTION_LABELS = {
  register: { label: '注册', color: 'bg-green-100 text-green-700' },
  login: { label: '登录', color: 'bg-blue-100 text-blue-700' },
  chat: { label: '聊天', color: 'bg-purple-100 text-purple-700' },
  balance: { label: '余额', color: 'bg-orange-100 text-orange-700' },
}

// Mini bar chart component
function MiniChart({ data, height = 48, color = '#22c55e' }) {
  if (!data || data.length === 0) return <div style={{ height }} className="flex items-end justify-center text-xs text-gray-300">暂无数据</div>
  const max = Math.max(...data.map(d => d.cnt), 1)
  return (
    <div style={{ height }} className="flex items-end gap-[2px]">
      {data.map((d, i) => (
        <div key={i} className="flex-1 rounded-t transition-all hover:opacity-80" title={`${d.label || ''}: ${d.cnt}`}
          style={{ height: `${Math.max((d.cnt / max) * 100, 4)}%`, backgroundColor: color, minWidth: 3 }} />
      ))}
    </div>
  )
}

function HourlyChart({ data }) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hr: i, cnt: 0 }))
  if (data) data.forEach(d => { const h = hours.find(x => x.hr === d.hr); if (h) h.cnt = d.cnt })
  const max = Math.max(...hours.map(h => h.cnt), 1)
  return (
    <div className="flex items-end gap-[1px]" style={{ height: 56 }}>
      {hours.map(h => (
        <div key={h.hr} className="flex-1 rounded-t transition-all hover:opacity-70" title={`${h.hr}:00 — ${h.cnt} 条`}
          style={{ height: `${Math.max((h.cnt / max) * 100, 3)}%`, backgroundColor: h.cnt > 0 ? '#8b5cf6' : '#e5e7eb', minWidth: 2 }} />
      ))}
    </div>
  )
}

function ConfigField({ cfg, idx, configs, setConfigs }) {
  const k = cfg.config_key
  const v = cfg.config_value || ''
  const update = val => { const u = [...configs]; u[idx] = { ...u[idx], config_value: val }; setConfigs(u) }
  const isSensitive = SENSITIVE_KEYS.some(s => k.includes(s))
  const [showPwd, setShowPwd] = useState(false)

  // 开关类型：enabled / enable_
  const isToggle = k.endsWith('_enabled') || k.startsWith('enable_')
  // 模式选择：_mode
  const isMode = k.endsWith('_mode')
  // 长文本：private_key / public_key / instructions
  const isTextarea = k.includes('private_key') || k.includes('public_key') || k.includes('instructions')
  // 数字：temperature / multiplier / per_message / min_amount
  const isNumber = k.includes('temperature') || k.includes('multiplier') || k.includes('per_message') || k.includes('min_amount')
  // URL 类型
  const isUrl = k.endsWith('_url') || k.includes('_qr_') || k.endsWith('_gateway')
  // 预设金额列表
  const isAmountList = k.includes('_amounts')

  return (
    <div className="px-4 py-3 sm:py-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-gray-700">{cfg.config_label || k}</label>
        {isToggle && (
          <button type="button" onClick={() => update(v === '1' ? '0' : '1')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${v === '1' ? 'bg-wechat-green' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v === '1' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-2">{k}</p>

      {isToggle ? (
        <span className={`text-xs font-medium ${v === '1' ? 'text-green-600' : 'text-gray-400'}`}>{v === '1' ? '已开启' : '已关闭'}</span>
      ) : isMode ? (
        <select value={v} onChange={e => update(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green">
          <option value="sandbox">沙箱测试 (sandbox)</option>
          <option value="production">正式环境 (production)</option>
        </select>
      ) : isTextarea ? (
        <textarea value={v} onChange={e => update(e.target.value)} rows={4} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={`请输入${cfg.config_label || ''}`} />
      ) : isNumber ? (
        <input type="number" step={k.includes('temperature') ? '0.1' : '0.01'} value={v} onChange={e => update(e.target.value)} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={`请输入${cfg.config_label || ''}`} />
      ) : isSensitive ? (
        <div className="relative">
          <input type={showPwd ? 'text' : 'password'} value={v} onChange={e => update(e.target.value)} autoComplete="new-password" data-lpignore="true" data-1p-ignore
            className="w-full px-3 py-2 pr-[4.5rem] rounded-lg border border-gray-200 bg-gray-50/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
            placeholder={`请输入${cfg.config_label || ''}`} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {v && (
              <button type="button" onClick={() => update('')}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="清空">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="p-1 text-gray-400 hover:text-gray-600">
              {showPwd ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <input type={isUrl ? 'url' : 'text'} value={v} onChange={e => update(e.target.value)} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={isUrl ? 'https://...' : isAmountList ? '10,30,50,100,200,500' : `请输入${cfg.config_label || ''}`} />
      )}
    </div>
  )
}

function SessionItem({ s, selectedSession, selectSession, handleDeleteSession, timeAgo }) {
  const hasUser = s.user_nickname || s.user_phone
  return (
    <div className={`relative group p-3 rounded-xl transition-all cursor-pointer ${
      selectedSession === s.id ? 'bg-green-50 border border-wechat-green/20' : 'hover:bg-gray-50 border border-transparent'
    }`}>
      <div onClick={() => selectSession(s.id)}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              s.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
            }`}>{s.status === 'active' ? '进行中' : '已完成'}</span>
            {hasUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium truncate max-w-24">
                {s.user_nickname || s.user_phone}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(s.created_at)}</span>
        </div>
        <p className="text-sm text-gray-700 truncate mt-1">{s.first_message || '新会话'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-gray-400">{s.message_count} 条消息</span>
          {hasUser && <span className="text-[10px] text-gray-300">{s.user_phone}</span>}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
        className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all" title="删除">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function UserCard({ u, balanceInputs, setBalanceInputs, handleAdjustBalance, handleDeleteUser, fmtTime, timeAgo }) {
  const bal = parseFloat(u.balance || 0)
  const spent = parseFloat(u.total_spent || 0)
  const msgs = u.total_messages || 0
  const sess = u.session_count || 0
  const logins = u.login_count || 0
  const registered = fmtTime(u.created_at)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(u.nickname || '?')[0]}
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-800">{u.nickname || '-'}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <span>{u.phone}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                u.api_mode === 'custom' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
              }`}>{u.api_mode === 'custom' ? '自定义API' : '官方API'}</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 text-right">
          <div>ID: {u.id}</div>
          <div>{timeAgo(u.last_active_at)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-gray-50 border-b border-gray-50">
        {[
          { label: '余额', value: `¥${bal.toFixed(2)}`, color: bal > 0 ? 'text-green-600' : 'text-gray-400' },
          { label: '消费', value: `¥${spent.toFixed(2)}`, color: 'text-orange-600' },
          { label: '消息', value: msgs, color: 'text-gray-700' },
          { label: '会话', value: sess, color: 'text-gray-700', hideOnMobile: true },
          { label: '登录', value: `${logins}次`, color: 'text-gray-500', hideOnMobile: true },
        ].map((s, i) => (
          <div key={i} className={`py-2.5 text-center ${s.hideOnMobile ? 'hidden sm:block' : ''}`}>
            <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="px-3 sm:px-4 py-2 text-xs text-gray-400 flex items-center justify-between bg-gray-50/30">
        <div className="flex items-center gap-2 sm:gap-3 truncate">
          <span className="truncate">注册: {registered}</span>
          {u.last_ip && <span className="font-mono text-[10px]">IP: {u.last_ip}</span>}
        </div>
        {msgs > 0 && sess > 0 && <span className="flex-shrink-0">平均 {(msgs / sess).toFixed(1)} 条/会话</span>}
      </div>
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-1.5 sm:gap-2 border-t border-gray-50 flex-wrap">
        <input type="number" step="0.01"
          value={balanceInputs[u.id] || ''}
          onChange={e => setBalanceInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
          placeholder="金额"
          className="w-16 sm:w-20 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-center focus:outline-none focus:ring-2 focus:ring-wechat-green/20 focus:border-wechat-green" />
        <button onClick={() => handleAdjustBalance(u.id, balanceInputs[u.id])} disabled={!balanceInputs[u.id]}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors disabled:opacity-40">充值</button>
        <button onClick={() => { const v = parseFloat(balanceInputs[u.id] || 0); if (v > 0) handleAdjustBalance(u.id, -v) }} disabled={!balanceInputs[u.id]}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors disabled:opacity-40">扣款</button>
        <div className="flex-1" />
        <button onClick={() => handleDeleteUser(u.id, u.nickname)}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-red-50 text-red-500 rounded-lg hover:bg-red-100 font-medium transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          删除
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const validTabs = TABS.map(t => t.key)
  const hashTab = window.location.hash.replace('#', '')
  const [activeTab, _setActiveTab] = useState(validTabs.includes(hashTab) ? hashTab : 'dashboard')
  const setActiveTab = (tab) => { _setActiveTab(tab); window.location.hash = tab }
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [sessionDetail, setSessionDetail] = useState(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [stats, setStats] = useState(null)
  const [systemConfigs, setSystemConfigs] = useState([])
  const [paymentConfigs, setPaymentConfigs] = useState([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [balanceInputs, setBalanceInputs] = useState({})
  const [newPassword, setNewPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [settingsSubTab, setSettingsSubTab] = useState('general')
  const [adminReply, setAdminReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [rechargeOrders, setRechargeOrders] = useState([])
  const [loadingRecharge, setLoadingRecharge] = useState(false)
  const [rechargeFilter, setRechargeFilter] = useState('')
  // 知识库
  const [knowledgeCases, setKnowledgeCases] = useState([])
  const [loadingCases, setLoadingCases] = useState(false)
  const [caseForm, setCaseForm] = useState(null) // null=关闭, {}=新建/编辑
  const [savingCase, setSavingCase] = useState(false)
  // 会话详情：收集数据 + AI分析
  const [sessionCollectedData, setSessionCollectedData] = useState({})
  const [sessionAnalysis, setSessionAnalysis] = useState(null)
  const [sessionInfoFields, setSessionInfoFields] = useState([])
  const [deepAnalysisResult, setDeepAnalysisResult] = useState(null)
  const [showAdminReport, setShowAdminReport] = useState(false)
  const [adminDetailTab, setAdminDetailTab] = useState('chat') // 'chat' | 'data' | 'analysis'
  const [analysisViewMode, setAnalysisViewMode] = useState('text') // 'text' | 'visual'
  const navigate = useNavigate()

  function adminFetch(url, options = {}) {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin'); return Promise.reject('no token') }
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` }
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    return fetch(url, { ...options, headers }).then(async res => {
      if (res.status === 401) { localStorage.removeItem('admin_token'); navigate('/admin'); throw new Error('unauthorized') }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败 (${res.status})`)
      }
      return res
    })
  }

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin'); return }
    fetchStats()
    fetchSessions()
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function fetchStats() {
    try { setStats(await (await adminFetch('/api/admin/stats')).json()) } catch (e) { console.error(e) }
  }
  async function fetchSessions() {
    try { setSessions((await (await adminFetch('/api/admin/sessions')).json()).sessions || []) }
    catch (e) { console.error(e) } finally { setLoadingSessions(false) }
  }
  async function selectSession(id) {
    setSelectedSession(id); setLoadingMessages(true); setMobileShowChat(true); setAdminDetailTab('chat')
    setSessionCollectedData({}); setSessionAnalysis(null); setSessionInfoFields([]); setDeepAnalysisResult(null)
    try {
      const [msgRes, infoRes, analysisRes, deepRes] = await Promise.all([
        adminFetch(`/api/admin/sessions/${id}/messages`).then(r => r.json()),
        fetch(`/api/sessions/${id}/info`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/sessions/${id}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/sessions/${id}/deep-analysis-result`).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setMessages(msgRes.messages || []); setSessionDetail(msgRes.session || null)
      if (infoRes) {
        const raw = infoRes.collectedData || {}
        const clean = {}
        for (const [k, v] of Object.entries(raw)) {
          if (k.startsWith('_')) continue
          clean[k] = typeof v === 'string' ? v : (v != null ? String(v) : '')
        }
        setSessionCollectedData(clean)
        setSessionInfoFields(infoRes.fields || [])
      }
      if (analysisRes) setSessionAnalysis(analysisRes)
      if (deepRes?.result) setDeepAnalysisResult(deepRes.result)
    } catch (e) { console.error(e) } finally { setLoadingMessages(false) }
  }
  async function handleDeleteSession(id) {
    if (!confirm('确定删除该会话及所有聊天记录？')) return
    try {
      await adminFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
      setSessions(p => p.filter(s => s.id !== id))
      if (selectedSession === id) { setSelectedSession(null); setMessages([]); setSessionDetail(null) }
      showToast('已删除'); fetchStats()
    } catch (e) { console.error(e) }
  }
  async function fetchSystemConfigs() {
    try { setSystemConfigs((await (await adminFetch('/api/admin/system-config')).json()).configs || []) } catch (e) { console.error(e) }
  }
  async function fetchPaymentConfigs() {
    try { setPaymentConfigs((await (await adminFetch('/api/admin/payment-config')).json()).configs || []) } catch (e) { console.error(e) }
  }
  async function saveConfigs(url, configs, label) {
    setSaving(true)
    try {
      const res = await adminFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: configs.map(c => ({ config_key: c.config_key, config_value: c.config_value ?? '' })) }) })
      const data = await res.json()
      if (data.success) {
        showToast(`${label}已保存`)
      } else {
        showToast(data.error || '保存失败')
      }
    } catch (err) { console.error('Save config error:', err); showToast(`保存失败: ${err.message}`) } finally { setSaving(false) }
  }

  async function fetchUsers() {
    setLoadingUsers(true)
    try { setUsers((await (await adminFetch('/api/admin/users')).json()).users || []) }
    catch (e) { console.error(e) } finally { setLoadingUsers(false) }
  }
  async function fetchRechargeOrders() {
    setLoadingRecharge(true)
    try {
      const url = rechargeFilter ? `/api/admin/recharge-orders?status=${rechargeFilter}` : '/api/admin/recharge-orders'
      const data = await (await adminFetch(url)).json()
      setRechargeOrders(data.orders || [])
    } catch (e) { console.error(e) } finally { setLoadingRecharge(false) }
  }
  async function handleConfirmRecharge(orderId) {
    if (!confirm('确认该充值订单？确认后余额将自动到账。')) return
    try {
      const res = await adminFetch(`/api/admin/recharge-orders/${orderId}/confirm`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('充值已确认，余额已到账')
      fetchRechargeOrders()
    } catch { showToast('操作失败') }
  }
  async function handleRejectRecharge(orderId) {
    const note = prompt('请输入拒绝原因（可留空）：')
    if (note === null) return
    try {
      const res = await adminFetch(`/api/admin/recharge-orders/${orderId}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminNote: note }) })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('已拒绝该充值请求')
      fetchRechargeOrders()
    } catch { showToast('操作失败') }
  }
  async function handleAdjustBalance(userId, amount) {
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val === 0) { showToast('请输入有效金额'); return }
    const action = val > 0 ? '充值' : '扣款'
    if (!confirm(`确认${action} ¥${Math.abs(val).toFixed(2)} ？`)) return
    try {
      const res = await adminFetch(`/api/admin/users/${userId}/balance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: val }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: data.user.balance } : u))
      setBalanceInputs(prev => ({ ...prev, [userId]: '' }))
      showToast(`${action}成功，当前余额: ¥${parseFloat(data.user.balance).toFixed(2)}`)
    } catch { showToast('操作失败') }
  }

  async function fetchCases() {
    setLoadingCases(true)
    try { setKnowledgeCases((await (await adminFetch('/api/admin/cases')).json()).cases || []) }
    catch (e) { console.error(e) } finally { setLoadingCases(false) }
  }
  async function handleMarkSuccess(sessionId) {
    const title = prompt('请输入案例标题（可留空，自动从商户名生成）：')
    if (title === null) return
    const summary = prompt('请输入成功要点（如：材料充分、整改到位）：')
    if (summary === null) return
    try {
      const res = await adminFetch('/api/admin/cases/from-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title: title || '', successSummary: summary || '' }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('已标记为成功案例并加入知识库')
    } catch { showToast('操作失败') }
  }
  async function handleSaveCase() {
    if (!caseForm) return
    setSavingCase(true)
    try {
      if (caseForm.id) {
        await adminFetch(`/api/admin/cases/${caseForm.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caseForm),
        })
      } else {
        await adminFetch('/api/admin/cases', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caseForm),
        })
      }
      showToast('案例已保存'); setCaseForm(null); fetchCases()
    } catch { showToast('保存失败') } finally { setSavingCase(false) }
  }
  async function handleDeleteCase(id) {
    if (!confirm('确定删除该案例？')) return
    try {
      await adminFetch(`/api/admin/cases/${id}`, { method: 'DELETE' })
      showToast('已删除'); fetchCases()
    } catch { showToast('删除失败') }
  }

  useEffect(() => {
    if (activeTab === 'settings') { fetchSystemConfigs(); fetchPaymentConfigs() }
    if (activeTab === 'sessions') { setLoadingSessions(true); fetchSessions() }
    if (activeTab === 'dashboard' || activeTab === 'analytics') fetchStats()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'recharge') fetchRechargeOrders()
    if (activeTab === 'knowledge') fetchCases()
  }, [activeTab])

  async function handleAdminReply() {
    if (!adminReply.trim() || !selectedSession || sendingReply) return
    setSendingReply(true)
    try {
      const res = await adminFetch(`/api/admin/sessions/${selectedSession}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: adminReply.trim() }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setMessages(data.messages || [])
      setAdminReply('')
      showToast('回复已发送')
    } catch { showToast('发送失败') }
    finally { setSendingReply(false) }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { showToast('密码至少6位'); return }
    setChangingPwd(true)
    try {
      const res = await adminFetch('/api/admin/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setNewPassword('')
      showToast('密码修改成功')
    } catch { showToast('修改失败') }
    finally { setChangingPwd(false) }
  }

  function handleLogout() { localStorage.removeItem('admin_token'); navigate('/admin') }

  function fmtTime(d) {
    if (!d) return '-'
    try { const t = new Date(d); return isNaN(t.getTime()) ? String(d).slice(0,19) : t.toLocaleString('zh-CN') } catch { return String(d) }
  }
  function fmtDay(d) {
    if (!d) return ''
    try { const t = new Date(d); return `${t.getMonth()+1}/${t.getDate()}` } catch { return '' }
  }
  function timeAgo(d) {
    if (!d) return '-'
    try {
      const diff = (Date.now() - new Date(d).getTime()) / 1000
      if (diff < 60) return '刚刚'
      if (diff < 3600) return `${Math.floor(diff/60)}分钟前`
      if (diff < 86400) return `${Math.floor(diff/3600)}小时前`
      return `${Math.floor(diff/86400)}天前`
    } catch { return '-' }
  }

  // ========== Dashboard ==========
  function renderDashboard() {
    const mainCards = [
      { label: '总用户', value: stats?.totalUsers ?? '-', sub: `今日 +${stats?.todayUsers ?? 0}`, color: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-400/20', iconPath: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
      { label: '总会话', value: stats?.totalSessions ?? '-', sub: `今日 +${stats?.todaySessions ?? 0}`, color: 'from-emerald-500 to-green-600', iconBg: 'bg-green-400/20', iconPath: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      { label: '总消息', value: stats?.totalMessages ?? '-', sub: `今日 +${stats?.todayMessages ?? 0}`, color: 'from-orange-400 to-rose-500', iconBg: 'bg-orange-400/20', iconPath: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
      { label: '总收入', value: `¥${(stats?.totalRevenue ?? 0).toFixed(2)}`, sub: `活跃 ${stats?.activeUsersToday ?? 0}`, color: 'from-violet-500 to-purple-600', iconBg: 'bg-violet-400/20', iconPath: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ]
    const miniCards = [
      { label: '有效对话', value: stats?.chatSessions ?? '-', dot: 'bg-blue-400' },
      { label: '活跃会话', value: stats?.activeSessions ?? '-', dot: 'bg-green-400' },
      { label: '今日活跃', value: stats?.activeUsersToday ?? '-', dot: 'bg-violet-400' },
      { label: '平均消息', value: stats?.avgMsgsPerSession ?? '-', dot: 'bg-orange-400' },
    ]
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">数据概览</h2>
          <button onClick={fetchStats} className="text-[11px] text-gray-400 hover:text-wechat-green px-2 py-1 rounded-lg hover:bg-green-50">刷新</button>
        </div>
        {/* Main stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mainCards.map((c, i) => (
            <div key={i} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white relative overflow-hidden`} style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              <div className={`absolute right-3 top-3 w-9 h-9 ${c.iconBg} rounded-xl flex items-center justify-center`}>
                <svg className="w-4.5 h-4.5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={c.iconPath}/></svg>
              </div>
              <p className="text-white/70 text-[11px] font-medium">{c.label}</p>
              <p className="text-xl font-bold mt-0.5 tracking-tight">{c.value}</p>
              <p className="text-white/50 text-[10px] mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
        {/* Mini stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {miniCards.map((c, i) => (
            <div key={i} className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-100/80">
              <p className="text-base font-bold text-gray-800 tabular-nums">{c.value}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                <p className="text-[10px] text-gray-400">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* 7-day trends */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: '会话趋势 (7天)', data: stats?.dailySessions, color: '#22c55e' },
            { title: '消息趋势 (7天)', data: stats?.dailyMessages, color: '#8b5cf6' },
            { title: '新用户趋势 (7天)', data: stats?.dailyUsers, color: '#3b82f6' },
          ].map((chart, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 mb-3">{chart.title}</h3>
              <MiniChart data={(chart.data || []).map(d => ({ cnt: d.cnt, label: fmtDay(d.day) }))} color={chart.color} />
              <div className="hidden sm:flex justify-between mt-1.5 text-[9px] text-gray-300">
                {(chart.data || []).map((d, j) => <span key={j}>{fmtDay(d.day)}</span>)}
              </div>
            </div>
          ))}
        </div>
        {/* Hourly + API mode + Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm md:col-span-2">
            <h3 className="text-xs font-semibold text-gray-500 mb-3">24小时消息分布</h3>
            <HourlyChart data={stats?.hourlyMessages} />
            <div className="flex justify-between mt-1 text-[9px] text-gray-300">
              <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-3">API 模式分布</h3>
            {stats?.apiModes?.length > 0 ? (
              <div className="space-y-2">
                {stats.apiModes.map((m, i) => {
                  const total = stats.apiModes.reduce((s, x) => s + x.cnt, 0)
                  const pct = total > 0 ? ((m.cnt / total) * 100).toFixed(0) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{m.api_mode === 'official' ? '官方API' : '自定义API'}</span>
                        <span className="font-semibold">{m.cnt} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.api_mode === 'official' ? 'bg-blue-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-xs text-gray-300 text-center py-4">暂无数据</p>}
            <div className="mt-4 pt-3 border-t border-gray-50">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">快速操作</h4>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setActiveTab('sessions')} className="px-2 py-1.5 text-[11px] bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">聊天记录</button>
                <button onClick={() => setActiveTab('users')} className="px-2 py-1.5 text-[11px] bg-green-50 text-green-600 rounded-lg hover:bg-green-100">用户管理</button>
                <button onClick={() => setActiveTab('analytics')} className="px-2 py-1.5 text-[11px] bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">数据分析</button>
                <a href="/" className="px-2 py-1.5 text-[11px] bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-center">访问前台</a>
              </div>
            </div>
          </div>
        </div>
        {/* Recent activity feed */}
        {stats?.recentActions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-3">最近用户活动</h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {stats.recentActions.slice(0, 15).map((a, i) => {
                const meta = ACTION_LABELS[a.action] || { label: a.action, color: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{a.nickname || a.phone || '匿名'} {a.detail && <span className="text-gray-400">· {a.detail}</span>}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ========== Analytics ==========
  function renderAnalytics() {
    const topUsers = stats?.topUsers || []
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">数据分析</h2>
          <button onClick={fetchStats} className="text-xs text-gray-400 hover:text-wechat-green px-2 py-1 rounded hover:bg-green-50">刷新</button>
        </div>
        {/* Top users */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Top 活跃用户</h3>
          </div>
          {topUsers.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-300">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/50">
                  <th className="text-left px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400">#</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400">用户</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400">消息数</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400 hidden sm:table-cell">会话</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400">消费</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400 hidden sm:table-cell">余额</th>
                  <th className="text-right px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400 hidden md:table-cell">登录</th>
                  <th className="text-left px-3 sm:px-4 py-2.5 text-[11px] font-semibold text-gray-400 hidden md:table-cell">最后活跃</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {topUsers.map((u, i) => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-3 sm:px-4 py-2.5 text-xs">{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}`}</td>
                      <td className="px-3 sm:px-4 py-2.5">
                        <div className="font-medium text-sm text-gray-800">{u.nickname || '-'}</div>
                        <div className="text-[11px] text-gray-400">{u.phone}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-semibold text-gray-700">{u.total_messages}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">{u.sessions}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-orange-600 font-medium">¥{parseFloat(u.total_spent || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-green-600 hidden sm:table-cell">¥{parseFloat(u.balance || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-gray-500 hidden md:table-cell">{u.login_count}次</td>
                      <td className="px-3 sm:px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell">{timeAgo(u.last_active_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Full activity log */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">用户行为追踪</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(stats?.recentActions || []).length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-300">暂无活动记录</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/50 sticky top-0">
                  <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-gray-400">时间</th>
                  <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-gray-400">用户</th>
                  <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-gray-400">行为</th>
                  <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-gray-400 hidden sm:table-cell">详情</th>
                  <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold text-gray-400 hidden md:table-cell">IP</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentActions.map((a, i) => {
                    const meta = ACTION_LABELS[a.action] || { label: a.action, color: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 sm:px-4 py-2 text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(a.created_at)}</td>
                        <td className="px-3 sm:px-4 py-2 text-xs font-medium text-gray-700">{a.nickname || a.phone || '-'}</td>
                        <td className="px-3 sm:px-4 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span></td>
                        <td className="px-3 sm:px-4 py-2 text-xs text-gray-500 truncate max-w-48 hidden sm:table-cell">{a.detail || '-'}</td>
                        <td className="px-3 sm:px-4 py-2 text-[11px] text-gray-400 font-mono hidden md:table-cell">{a.ip || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderSessionList() {
    if (loadingSessions) return <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
    if (sessions.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">暂无对话记录<br/><span className="text-xs">用户开始聊天后会显示在这里</span></div>
    return <div className="space-y-1">{sessions.map(s => <SessionItem key={s.id} s={s} selectedSession={selectedSession} selectSession={selectSession} handleDeleteSession={handleDeleteSession} timeAgo={timeAgo} />)}</div>
  }

  // 找到当前选中会话对应的 session 对象（含 user 信息）
  function getSelectedSessionData() {
    return sessions.find(s => s.id === selectedSession) || null
  }

  function renderSessions() {
    const selData = getSelectedSessionData()
    return (
      <div className="flex flex-1 overflow-hidden">
        <aside className={`${mobileShowChat ? 'hidden' : 'block'} lg:block w-full lg:w-80 bg-white lg:border-r border-gray-100 overflow-y-auto flex-shrink-0`}>
          <div className="p-3">
            <p className="text-[11px] text-gray-400 mb-2 px-1">共 {sessions.length} 个对话</p>
            {renderSessionList()}
          </div>
        </aside>
        <main className={`${!mobileShowChat && selectedSession ? 'hidden lg:block' : !mobileShowChat ? 'hidden lg:flex' : 'block'} flex-1 overflow-y-auto bg-[#f5f5f5]`}>
          {selectedSession ? (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="flex items-center mb-4 lg:hidden">
                <button onClick={() => setMobileShowChat(false)} className="mr-2 p-1.5 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </button>
                <span className="text-sm text-gray-600">返回列表</span>
              </div>
              {sessionDetail && (
                <div className="bg-white rounded-2xl p-3 sm:p-4 mb-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-50 px-1.5 py-0.5 rounded-md text-gray-400 text-[10px] font-mono">{sessionDetail.id.slice(0, 8)}</code>
                      {selData?.user_nickname && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          {selData.user_nickname}
                        </span>
                      )}
                      {selData?.user_phone && <span className="text-gray-300 text-[10px]">{selData.user_phone}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-300">{fmtTime(sessionDetail.created_at)}</span>
                      <button onClick={() => handleMarkSuccess(selectedSession)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-medium hover:bg-green-100 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        标记成功
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* 标签切换：聊天 / 客户数据 / AI分析 */}
              <div className="flex bg-white rounded-xl p-0.5 mb-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {[
                  { key: 'chat', label: '聊天记录', icon: '💬' },
                  { key: 'data', label: '客户数据', icon: '📋' },
                  { key: 'analysis', label: 'AI分析', icon: '🤖' },
                ].map(t => (
                  <button key={t.key} onClick={() => setAdminDetailTab(t.key)}
                    className={`flex-1 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center justify-center gap-1 ${
                      adminDetailTab === t.key ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* 聊天记录 Tab */}
              {adminDetailTab === 'chat' && (
                <>
                  {loadingMessages ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : (
                    <div className="space-y-3">{messages.map((m, i) => {
                      const isAdmin = m.role === 'admin'
                      if (isAdmin) {
                        return (
                          <div key={i} className="flex justify-end my-2.5">
                            <div className="max-w-[80%] lg:max-w-[70%] bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-[18px] rounded-tr-[4px] px-4 py-2.5" style={{ boxShadow: '0 1px 3px rgba(249,115,22,0.2)' }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] text-white/70 font-medium">人工客服</span>
                              </div>
                              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center ml-2.5 mt-0.5">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                            </div>
                          </div>
                        )
                      }
                      return <ChatMessage key={i} role={m.role} content={m.content} />
                    })}</div>
                  )}
                  {selectedSession && !loadingMessages && (
                    <div className="mt-4 bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-500 font-medium">人工客服</span>
                        <span className="text-[10px] text-gray-300">客户端显示为助手消息</span>
                      </div>
                      <div className="flex items-end gap-2">
                        <textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdminReply() } }}
                          placeholder="输入回复内容..."
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-[13px] resize-none focus:ring-2 focus:ring-orange-300/30 focus:border-orange-400 max-h-32 overflow-y-auto placeholder:text-gray-300" />
                        <button onClick={handleAdminReply} disabled={sendingReply || !adminReply.trim()}
                          className="px-4 py-2 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-xl text-[12px] font-medium disabled:opacity-50 shadow-sm flex-shrink-0 h-9">
                          {sendingReply ? '发送中...' : '发送'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 客户数据 Tab */}
              {adminDetailTab === 'data' && (
                <div className="space-y-3">
                  {Object.keys(sessionCollectedData).length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm">该会话暂无收集数据</div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <h3 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center"><span className="text-[12px]">📋</span></span>
                          客户填写信息（{Object.keys(sessionCollectedData).filter(k => { const v = sessionCollectedData[k]; return v && String(v).trim() }).length} 项）
                        </h3>
                        <div className="space-y-1">
                          {sessionInfoFields.map(f => {
                            const val = sessionCollectedData[f.key]
                            if (!val || !String(val).trim()) return null
                            return (
                              <div key={f.key} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                <span className="text-[11px] text-gray-400 w-24 flex-shrink-0 pt-0.5">{f.label}</span>
                                <span className="text-[12px] text-gray-800 font-medium flex-1 break-all">{val}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AI分析 Tab */}
              {adminDetailTab === 'analysis' && (
                <div className="space-y-3">
                  {/* DeepSeek 深度分析报告（优先显示） */}
                  {deepAnalysisResult ? (
                    <div>
                      {/* 顶部操作栏：模式切换 + 生成报告 */}
                      <div className="bg-white rounded-2xl overflow-hidden mb-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div className="px-3 sm:px-4 py-2.5 bg-indigo-50/60 flex items-center justify-between border-b border-indigo-100/50 gap-2">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-[12px] font-semibold text-indigo-700 hidden sm:inline">DeepSeek 深度分析</span>
                            <span className="text-[12px] font-semibold text-indigo-700 sm:hidden">分析报告</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* 视图模式切换 */}
                            <div className="flex bg-white/80 rounded-lg p-0.5 border border-indigo-100">
                              <button onClick={() => setAnalysisViewMode('text')}
                                className={`h-6 px-2.5 text-[10px] rounded-md font-medium transition-all ${analysisViewMode === 'text' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                  全文
                                </span>
                              </button>
                              <button onClick={() => setAnalysisViewMode('visual')}
                                className={`h-6 px-2.5 text-[10px] rounded-md font-medium transition-all ${analysisViewMode === 'visual' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                  清单
                                </span>
                              </button>
                            </div>
                            <button onClick={() => setShowAdminReport(true)} className="h-6 px-2 sm:px-3 flex items-center gap-1 text-[10px] text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 rounded-lg shadow-sm transition-all flex-shrink-0">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              <span className="hidden sm:inline">报告图片</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 全文模式 */}
                      {analysisViewMode === 'text' && (
                        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div className="px-4 py-4 text-[12px] text-gray-700 leading-relaxed break-words admin-analysis-md" dangerouslySetInnerHTML={{ __html: (() => {
                            return deepAnalysisResult
                              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                              .replace(/^## (.*$)/gm, '<h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:20px 0 8px;display:flex;align-items:center;gap:6px;">$1</h2>')
                              .replace(/^### (.*$)/gm, '<h3 style="font-size:13px;font-weight:600;color:#334155;margin:14px 0 6px;padding-left:8px;border-left:3px solid #818cf8;">$1</h3>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600;color:#1e293b;">$1</strong>')
                              .replace(/^- (.*$)/gm, '<div style="display:flex;gap:6px;margin:3px 0 3px 6px;"><span style="color:#818cf8;flex-shrink:0;">·</span><span>$1</span></div>')
                              .replace(/^(\d+)\. (.*$)/gm, '<div style="display:flex;gap:6px;margin:3px 0 3px 6px;"><span style="color:#6366f1;font-weight:700;flex-shrink:0;min-width:18px;">$1.</span><span>$2</span></div>')
                              .replace(/^  · (.*$)/gm, '<div style="display:flex;gap:6px;margin:2px 0 2px 20px;"><span style="color:#9ca3af;">·</span><span>$1</span></div>')
                              .replace(/^---$/gm, '<hr style="margin:14px 0;border:none;border-top:1px solid #e5e7eb;"/>')
                              .replace(/\n\n/g, '<br/>')
                              .replace(/\n/g, '<br/>')
                          })() }} />
                        </div>
                      )}

                      {/* 可视化清单模式 */}
                      {analysisViewMode === 'visual' && (
                        <AnalysisVisualView text={deepAnalysisResult} />
                      )}
                    </div>
                  ) : !sessionAnalysis ? (
                    <div className="text-center py-16 text-gray-400 text-sm">暂无AI分析数据（需要用户在前端触发深度分析后才会生成）</div>
                  ) : (
                    <>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-[11px] text-gray-500 text-center">以下为规则引擎分析（用户尚未触发DeepSeek深度分析）</div>
                      {sessionAnalysis.risk && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">� 风险评估</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-[10px] text-gray-400 mb-1">难度等级</p>
                              <p className={`text-[14px] font-bold ${
                                sessionAnalysis.risk.riskScore >= 70 ? 'text-red-600' :
                                sessionAnalysis.risk.riskScore >= 40 ? 'text-orange-600' : 'text-green-600'
                              }`}>{sessionAnalysis.risk.level}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-[10px] text-gray-400 mb-1">预估成功率</p>
                              <p className="text-[14px] font-bold text-green-600">{sessionAnalysis.risk.successRate}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {sessionAnalysis.strategy?.length > 0 && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <h3 className="text-[13px] font-semibold text-gray-800 mb-2">🎯 策略建议</h3>
                          <div className="space-y-1.5">
                            {sessionAnalysis.strategy.map((s, i) => (
                              <div key={i} className={`flex gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                                s.type === 'warning' ? 'bg-red-50 text-red-600' :
                                s.type === 'tip' ? 'bg-green-50 text-green-600' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                <span className="flex-shrink-0">{s.type === 'warning' ? '⚠️' : s.type === 'tip' ? '💡' : 'ℹ️'}</span>
                                <span>{s.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-gray-300 text-[12px]">选择左侧会话查看聊天记录</p>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ========== 知识库 ==========
  function renderKnowledge() {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-start sm:items-center justify-between mb-4 gap-3 flex-col sm:flex-row">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">成功案例知识库</h2>
            <p className="text-xs text-gray-400 mt-0.5">管理员标记的成功申诉案例，AI 生成报告时会自动参考相似案例</p>
          </div>
          <button onClick={() => setCaseForm({ title: '', industry: '', problemType: '', successSummary: '', adminNotes: '', reportContent: '' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            添加案例
          </button>
        </div>

        {loadingCases ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : knowledgeCases.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
            </div>
            <p className="text-gray-400 text-sm">暂无成功案例</p>
            <p className="text-gray-300 text-xs mt-1">在「聊天记录」中查看会话时，可点击"标记为成功案例"按钮添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {knowledgeCases.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-800">{c.title || '未命名案例'}</h3>
                        {c.industry && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{c.industry}</span>}
                        {c.problem_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">{c.problem_type}</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {c.status === 'active' ? '生效中' : '已归档'}
                        </span>
                      </div>
                      {c.success_summary && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{c.success_summary}</p>}
                      {c.admin_notes && <p className="text-[11px] text-gray-400 mt-1 italic">备注：{c.admin_notes}</p>}
                      <p className="text-[10px] text-gray-300 mt-1.5">{fmtTime(c.created_at)}{c.session_id ? ` · 来自会话 ${c.session_id.slice(0, 8)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setCaseForm({ id: c.id, title: c.title, industry: c.industry, problemType: c.problem_type, successSummary: c.success_summary || '', adminNotes: c.admin_notes || '', reportContent: c.report_content || '', status: c.status })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                      </button>
                      <button onClick={() => handleDeleteCase(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 案例编辑弹窗 */}
        {caseForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCaseForm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">{caseForm.id ? '编辑案例' : '添加成功案例'}</h2>
                <button onClick={() => setCaseForm(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案例标题 *</label>
                  <input value={caseForm.title || ''} onChange={e => setCaseForm({...caseForm, title: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：餐饮商户收款限额申诉成功" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
                    <input value={caseForm.industry || ''} onChange={e => setCaseForm({...caseForm, industry: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：餐饮" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">处罚类型</label>
                    <input value={caseForm.problemType || ''} onChange={e => setCaseForm({...caseForm, problemType: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：收款限额" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成功要点</label>
                  <textarea value={caseForm.successSummary || ''} onChange={e => setCaseForm({...caseForm, successSummary: e.target.value})} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" placeholder="描述申诉成功的关键因素，AI会参考这些要点" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管理员备注</label>
                  <textarea value={caseForm.adminNotes || ''} onChange={e => setCaseForm({...caseForm, adminNotes: e.target.value})} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" placeholder="内部备注（不会展示给用户）" />
                </div>
                {caseForm.id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select value={caseForm.status || 'active'} onChange={e => setCaseForm({...caseForm, status: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="active">生效中</option>
                      <option value="archived">已归档</option>
                    </select>
                  </div>
                )}
                <button onClick={handleSaveCase} disabled={savingCase || !caseForm.title?.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                  {savingCase ? '保存中...' : '保存案例'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderSettings() {
    const general = systemConfigs.filter(c => c.config_group === 'general')
    const ai = systemConfigs.filter(c => c.config_group === 'ai')
    const rechargeConf = systemConfigs.filter(c => c.config_group === 'recharge')
    const wx = paymentConfigs.filter(c => c.config_group === 'wechat')
    const ali = paymentConfigs.filter(c => c.config_group === 'alipay')

    const renderSubContent = () => {
      switch (settingsSubTab) {
        case 'general':
          return general.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-600">基本设置</h3></div>
              <div className="divide-y divide-gray-50">{general.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无基本配置项</div>
        case 'ai':
          return ai.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-700">AI 配置 (DeepSeek)</h3>
                <button onClick={async () => {
                  showToast('正在测试 DeepSeek 连接...')
                  try {
                    const r = await adminFetch('/api/admin/test-deepseek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                    const d = await r.json()
                    if (d.success) showToast(`✅ 连接成功！模型: ${d.model}，回复: ${d.reply}`)
                    else showToast(`❌ 连接失败: ${d.error}`)
                  } catch { showToast('❌ 测试请求失败') }
                }} className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-medium">测试连接</button>
              </div>
              <div className="divide-y divide-gray-50">{ai.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无AI配置项</div>
        case 'rechargeConfig':
          return rechargeConf.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100"><h3 className="text-sm font-semibold text-yellow-700">充值设置</h3></div>
              <div className="divide-y divide-gray-50">{rechargeConf.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无充值配置项</div>
        case 'wechat':
          return wx.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center space-x-2">
                <span className="w-5 h-5 bg-wechat-green rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/></svg></span>
                <h3 className="text-sm font-semibold text-green-700">微信支付</h3>
              </div>
              <div className="divide-y divide-gray-50">{wx.map(c => <ConfigField key={c.config_key} cfg={c} idx={paymentConfigs.indexOf(c)} configs={paymentConfigs} setConfigs={setPaymentConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无微信支付配置项</div>
        case 'alipay':
          return ali.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center space-x-2">
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M21.422 15.358c-.612-1.008-2.139-2.091-4.16-3.009.263-.674.467-1.397.6-2.158h-3.204V8.717h3.93V7.91h-3.93V5.535h-1.86s-.037.17-.205.495c-.33.65-.79 1.134-1.242 1.134V7.91H7.927v.807h3.424v1.474H8.23v.808h6.3c-.1.535-.24 1.043-.416 1.513-1.842-.632-3.974-1.082-5.835-1.082-3.156 0-5.053 1.392-5.053 3.09 0 1.7 1.897 3.092 5.053 3.092 2.09 0 4.423-.684 6.395-1.903.82.506 1.48.946 1.884 1.282.86.714 1.016 1.167.858 1.694H24c.182-.826-.31-1.85-2.578-3.33z"/></svg></span>
                <h3 className="text-sm font-semibold text-blue-700">支付宝</h3>
              </div>
              <div className="divide-y divide-gray-50">{ali.map(c => <ConfigField key={c.config_key} cfg={c} idx={paymentConfigs.indexOf(c)} configs={paymentConfigs} setConfigs={setPaymentConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无支付宝配置项</div>
        case 'security':
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100"><h3 className="text-sm font-semibold text-red-700">安全设置</h3></div>
              <div className="px-4 py-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">修改管理员密码</label>
                <p className="text-xs text-gray-400 mb-3">密码至少6位，修改后需重新登录</p>
                <div className="flex items-center gap-2">
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                    placeholder="输入新密码（至少6位）"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400" />
                  <button onClick={handleChangePassword} disabled={changingPwd || !newPassword}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 shadow-sm flex-shrink-0">
                    {changingPwd ? '修改中...' : '修改密码'}
                  </button>
                </div>
              </div>
            </div>
          )
        default: return null
      }
    }

    const isPaymentTab = settingsSubTab === 'wechat' || settingsSubTab === 'alipay'

    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        {/* 子Tab导航 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-gray-100/80 rounded-xl p-1">
          {SETTINGS_SUB_TABS.map(tab => (
            <button key={tab.key} onClick={() => setSettingsSubTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                settingsSubTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}>
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {/* 子Tab内容 */}
        <form autoComplete="off" onSubmit={e => e.preventDefault()} className="space-y-4">
          <input type="text" name="fake_user" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" name="fake_pass" style={{ display: 'none' }} tabIndex={-1} />
          {renderSubContent()}
          {settingsSubTab !== 'security' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => {
                if (isPaymentTab) saveConfigs('/api/admin/payment-config', paymentConfigs, '支付配置')
                else saveConfigs('/api/admin/system-config', systemConfigs, '系统配置')
              }} disabled={saving}
                className="px-6 py-2.5 bg-wechat-green text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm">
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          )}
        </form>
      </div>
    )
  }

  async function handleDeleteUser(userId, nickname) {
    if (!confirm(`确定删除用户「${nickname || userId}」及其所有聊天记录？此操作不可恢复！`)) return
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => u.id !== userId))
      showToast('用户已删除')
    } catch { showToast('删除失败') }
  }

  function renderUsers() {
    const totalBalance = users.reduce((s, u) => s + parseFloat(u.balance || 0), 0)
    const totalSpent = users.reduce((s, u) => s + parseFloat(u.total_spent || 0), 0)
    const totalMsgs = users.reduce((s, u) => s + (u.total_messages || 0), 0)
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">用户管理</h2>
            <p className="text-xs text-gray-400 mt-0.5">共 {users.length} 位用户</p>
          </div>
          <button onClick={fetchUsers} className="text-xs text-gray-400 hover:text-wechat-green px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">刷新</button>
        </div>
        {/* Summary bar */}
        {users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '总用户', value: users.length, color: 'text-blue-600 bg-blue-50' },
              { label: '总余额', value: `¥${totalBalance.toFixed(2)}`, color: 'text-green-600 bg-green-50' },
              { label: '总消费', value: `¥${totalSpent.toFixed(2)}`, color: 'text-orange-600 bg-orange-50' },
              { label: '总消息', value: totalMsgs, color: 'text-purple-600 bg-purple-50' },
            ].map((c, i) => (
              <div key={i} className={`${c.color} rounded-xl px-3 py-2.5 text-center`}>
                <div className="text-base font-bold">{c.value}</div>
                <div className="text-[10px] opacity-60">{c.label}</div>
              </div>
            ))}
          </div>
        )}
        {loadingUsers ? (
          <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">暂无用户<br/><span className="text-xs">用户在前台注册后会显示在这里</span></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {users.map(u => <UserCard key={u.id} u={u} balanceInputs={balanceInputs} setBalanceInputs={setBalanceInputs} handleAdjustBalance={handleAdjustBalance} handleDeleteUser={handleDeleteUser} fmtTime={fmtTime} timeAgo={timeAgo} />)}
          </div>
        )}
      </div>
    )
  }

  function renderRechargeOrders() {
    const STATUS_MAP = { pending: { label: '待确认', color: 'bg-yellow-100 text-yellow-700' }, confirmed: { label: '已确认', color: 'bg-green-100 text-green-700' }, rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' } }
    const METHOD_MAP = { wechat: '微信支付', alipay: '支付宝' }
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">充值订单管理</h2>
            <p className="text-xs text-gray-400 mt-0.5">审核用户充值请求，确认后余额自动到账</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            {['', 'pending', 'confirmed', 'rejected'].map(f => (
              <button key={f} onClick={() => { setRechargeFilter(f); setTimeout(fetchRechargeOrders, 50) }}
                className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${rechargeFilter === f ? 'bg-wechat-green text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f === '' ? '全部' : STATUS_MAP[f]?.label}
              </button>
            ))}
          </div>
        </div>
        {loadingRecharge ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : rechargeOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-300 text-sm">暂无充值订单</div>
        ) : (
          <div className="space-y-3">
            {rechargeOrders.map(o => {
              const s = STATUS_MAP[o.status] || {}
              return (
                <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">¥</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-800">¥{parseFloat(o.amount).toFixed(2)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{METHOD_MAP[o.payment_method] || o.payment_method}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                          <span>#{o.id}</span>
                          <span>{o.nickname || '未知用户'}</span>
                          <span className="hidden sm:inline">{o.phone || ''}</span>
                          <span>{fmtTime(o.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {o.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleConfirmRecharge(o.id)}
                          className="px-4 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium shadow-sm">确认到账</button>
                        <button onClick={() => handleRejectRecharge(o.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 font-medium">拒绝</button>
                      </div>
                    )}
                  </div>
                  {o.remark && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                      <span className="font-medium text-gray-600">用户备注：</span>{o.remark}
                    </div>
                  )}
                  {o.admin_note && (
                    <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-xs text-orange-600">
                      <span className="font-medium">管理员备注：</span>{o.admin_note}
                    </div>
                  )}
                  {o.confirmed_at && (
                    <div className="px-4 py-1.5 bg-gray-50/50 border-t border-gray-50 text-[11px] text-gray-400">
                      处理时间：{fmtTime(o.confirmed_at)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }


  return (
    <div className="h-screen h-dvh bg-[#f5f5f5] flex flex-col overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur-lg text-white text-sm px-5 py-2.5 rounded-2xl shadow-xl animate-fade-in font-medium">{toast}</div>
      )}
      <header className="bg-white flex-shrink-0 z-20" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#07C160] to-[#06ae56] flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-gray-900 tracking-tight">管理后台</h1>
          </div>
          <div className="flex items-center gap-1">
            <a href="/" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-wechat-green hover:bg-green-50 rounded-lg" title="前台">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
            </a>
            <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg" title="退出">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
            </button>
          </div>
        </div>
        <div className="px-2 sm:px-3 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMobileShowChat(false) }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.key ? 'border-[#07C160] text-[#07C160]' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 flex flex-col overflow-auto">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'recharge' && renderRechargeOrders()}
        {activeTab === 'knowledge' && renderKnowledge()}
      </div>
      {showAdminReport && deepAnalysisResult && (
        <ReportCard collectedData={sessionCollectedData} analysisText={deepAnalysisResult} onClose={() => setShowAdminReport(false)} />
      )}
    </div>
  )
}
