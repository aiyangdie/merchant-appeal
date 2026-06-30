import React, { useState, useEffect } from 'react'
import UserAvatar from './UserAvatar'
import { resolveAuthHeaders } from '../lib/auth.js'

const TYPE_LABELS = {
  chat: '对话',
  chat_local: '信息收集',
  chat_qa: '智能答疑',
  report: '报告生成',
  report_retry: '报告重试',
  appeal_text: '申诉文案',
  complaint_doc: '申诉材料包',
  complaint_reply: '投诉回复话术',
  appeal_guide: '申诉流程指导',
  deep_analysis: '深度分析',
}

function MenuRow({ icon, label, desc, badge, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} className={`profile-menu-row ${danger ? 'danger' : ''}`}>
      {icon && <span className="profile-menu-icon">{icon}</span>}
      <span className="profile-menu-text">
        <span className="profile-menu-label">{label}</span>
        {desc && <span className="profile-menu-desc">{desc}</span>}
      </span>
      {badge != null && badge !== '' && (
        <span className="profile-menu-badge">{badge}</span>
      )}
      <svg className="profile-menu-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default function UserCenter({
  user,
  onClose,
  embedded = false,
  onRecharge,
  getAuthHeaders,
  collectedInfo = {},
  infoProgress,
  infoTotal = 0,
  boundOrder,
  onOpenInfo,
  onOpenTools,
  onBindOrder,
  onOpenHistory,
  onOpenTheme,
  onApiMode,
  onLogout,
  onContact,
  contactAvailable,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subView, setSubView] = useState(null) // 'usage' | 'recharge' | 'appeals'
  const [appealRecords, setAppealRecords] = useState(null)

  const filledCount = infoProgress?.filled ?? Object.keys(collectedInfo).filter(k => collectedInfo[k] && String(collectedInfo[k]).trim()).length
  const totalCount = infoProgress?.total ?? infoTotal
  const infoBadge = totalCount > 0 ? `${filledCount}/${totalCount}` : (filledCount > 0 ? `${filledCount}项` : null)

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${user.id}/usage`, { headers: resolveAuthHeaders(getAuthHeaders) })
      const d = await res.json()
      setData(d)
    } catch {}
    finally { setLoading(false) }
  }

  async function loadAppealRecords() {
    if (appealRecords) return
    try {
      const res = await fetch(`/api/user/${user.id}/appeal-records`, { headers: resolveAuthHeaders(getAuthHeaders) })
      const d = await res.json()
      setAppealRecords(d.records || [])
    } catch { setAppealRecords([]) }
  }

  function fmtTime(d) {
    if (!d) return ''
    try { const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }

  function fmtCost(c) {
    return parseFloat(c || 0).toFixed(4)
  }

  function pick(fn) {
    return () => {
      if (!embedded) onClose?.()
      fn?.()
    }
  }

  function openSub(view) {
    setSubView(view)
    if (view === 'appeals') loadAppealRecords()
  }

  if (loading && !data) {
    return (
      <div className={embedded ? 'mp-profile-tab' : 'mp-profile-page'}>
        <div className="profile-loading">
          <svg className="w-7 h-7 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  if (subView) {
    const titles = { usage: '消费明细', recharge: '充值记录', appeals: '申诉记录' }
    return (
      <div className={embedded ? 'mp-profile-tab' : 'mp-profile-page'}>
        <header className="profile-sub-header safe-top">
          <button type="button" className="profile-back-btn" onClick={() => setSubView(null)} aria-label="返回">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="profile-sub-title">{titles[subView]}</h2>
          <button type="button" className="profile-back-btn" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="profile-sub-body">
          {subView === 'appeals' ? (
            !appealRecords ? (
              <p className="profile-empty">加载中…</p>
            ) : appealRecords.length === 0 ? (
              <p className="profile-empty">暂无申诉记录</p>
            ) : (
              appealRecords.map((r, i) => (
                <div key={i} className="profile-record-row">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm text-gray-800">{r.merchant_name || r.problem_type || '申诉'}</span>
                    <span className="text-[10px] text-gray-400">{fmtTime(r.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{r.label}{r.violation_reason ? ` · ${r.violation_reason}` : ''}</p>
                </div>
              ))
            )
          ) : subView === 'usage' ? (
            (!data?.usage || data.usage.length === 0) ? (
              <p className="profile-empty">暂无消费记录</p>
            ) : (
              data.usage.map(u => (
                <div key={u.id} className="profile-record-row">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800">{TYPE_LABELS[u.type] || u.type}</span>
                    <span className={`text-sm ${parseFloat(u.cost || 0) > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                      {parseFloat(u.cost || 0) > 0 ? `-¥${fmtCost(u.cost)}` : '免费'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(u.created_at)} · {(u.total_tokens || 0).toLocaleString()} tokens</p>
                </div>
              ))
            )
          ) : (
            (!data?.rechargeOrders || data.rechargeOrders.length === 0) ? (
              <p className="profile-empty">暂无充值记录</p>
            ) : (
              data.rechargeOrders.map(o => (
                <div key={o.id} className="profile-record-row">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800">
                      {o.status === 'confirmed' ? '已到账' : o.status === 'rejected' ? '已拒绝' : '待确认'}
                    </span>
                    <span className="text-sm text-gray-800">+¥{parseFloat(o.amount).toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(o.created_at)}</p>
                </div>
              ))
            )
          )}
        </div>
      </div>
    )
  }

  const pageClass = embedded ? 'mp-profile-tab' : 'mp-profile-page'

  return (
    <div className={pageClass}>
      {!embedded && (
      <header className="profile-top safe-top">
        <button type="button" className="profile-close-btn" onClick={onClose} aria-label="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      )}

      <div className={`profile-hero ${embedded ? 'profile-hero-tab' : ''}`}>
        <UserAvatar url={user?.avatarUrl} name={user?.nickname || '用户'} size={72} style={{ borderRadius: '50%' }} />
        <h1 className="profile-name">{user?.nickname || '用户'}</h1>
        {user?.phone && <p className="profile-phone">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</p>}
        {user?.id && <span className="profile-uid">UID {user.id}</span>}
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-num">¥{parseFloat(data?.balance || user?.balance || 0).toFixed(2)}</span>
          <span className="profile-stat-label">余额</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-num">{infoBadge || '—'}</span>
          <span className="profile-stat-label">已收集</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-num">{data?.stats?.today?.requests || 0}</span>
          <span className="profile-stat-label">今日请求</span>
        </div>
      </div>

      <div className="profile-card">
        <MenuRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          label="已收集信息"
          desc={filledCount > 0 ? '查看与补充申诉资料' : '对话中自动收集'}
          badge={infoBadge}
          onClick={pick(onOpenInfo)}
        />
        <MenuRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
          label="关联订单"
          desc={boundOrder ? (boundOrder.goods?.title || boundOrder.order_no) : '绑定闲鱼订单'}
          onClick={pick(onBindOrder)}
        />
        <MenuRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>}
          label="申诉工具箱"
          desc="文案、材料、指导、AI 分析"
          onClick={pick(onOpenTools)}
        />
        <MenuRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          label="历史对话"
          onClick={pick(onOpenHistory)}
        />
      </div>

      <div className="profile-card">
        <MenuRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
          label="账户充值"
          desc={`余额 ¥${parseFloat(data?.balance || 0).toFixed(2)}`}
          onClick={pick(onRecharge)}
        />
        <MenuRow label="消费明细" onClick={() => openSub('usage')} />
        <MenuRow label="充值记录" onClick={() => openSub('recharge')} />
        <MenuRow label="申诉记录" onClick={() => openSub('appeals')} />
      </div>

      <div className="profile-card">
        <MenuRow label="主题颜色" onClick={pick(onOpenTheme)} />
        <MenuRow label="AI 服务模式" onClick={pick(onApiMode)} />
        {contactAvailable && (
          <MenuRow label="联系技术人员" onClick={pick(onContact)} />
        )}
        <MenuRow label="退出登录" danger onClick={pick(onLogout)} />
      </div>

      <div className={embedded ? 'profile-footer-tab' : 'profile-footer safe-bottom'} />
    </div>
  )
}
