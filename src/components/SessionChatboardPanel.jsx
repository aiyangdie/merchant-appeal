import React, { useState, useEffect, useCallback, useMemo } from 'react'
import AdminAiTabLayout from './AdminAiTabLayout.jsx'
import AdminMarkdown from './AdminMarkdown.jsx'

function maxInSeries(rows, key = 'cnt') {
  let m = 1
  for (const r of rows || []) {
    const v = Number(r[key]) || 0
    if (v > m) m = v
  }
  return m
}

function BarRow({ label, value, max, color = 'bg-purple-500' }) {
  const pct = max > 0 ? Math.round((Number(value) || 0) / max * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-28 flex-shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-700 w-10 text-right tabular-nums">{value}</span>
    </div>
  )
}

function MetricCard({ label, value, hint, sub, gradient }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
        <span>{label}</span>
        {hint ? (
          <span className="cursor-help text-gray-400" title={hint}>
            ⓘ
          </span>
        ) : null}
      </div>
      <div className={`text-xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</div>
      {sub ? <p className="text-[10px] text-gray-400 mt-1">{sub}</p> : null}
    </div>
  )
}

/** 仅引用统计数字的启发式摘要（不替代 AI 简报） */
function heuristicSummary(data) {
  if (!data?.totals) return []
  const lines = []
  const t = data.totals
  const defs = data.metricDefinitions || {}
  lines.push(
    `统计窗口：最近 ${data.days} 天 · 生成于 ${data.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN') : '-'}`
  )
  if (data.dataQuality?.statsScope) lines.push(data.dataQuality.statsScope)
  if (data.dataQuality?.orphanMessagesInWindow > 0) {
    lines.push(
      `注意：窗口内仍有 ${data.dataQuality.orphanMessagesInWindow} 条孤儿消息（会话已删），未计入上方指标。`
    )
  }
  if (t.messages_in_window != null) {
    lines.push(
      `${defs.messages_in_window?.label || '窗口消息'} ${t.messages_in_window} 条；` +
        `${defs.sessions_with_messages_in_window?.label || '活跃会话'} ${t.sessions_with_messages_in_window} 个；` +
        `${defs.sessions_started_in_window?.label || '新建会话'} ${t.sessions_started_in_window} 个` +
        (t.sessions_empty_in_window != null ? `（其中空会话 ${t.sessions_empty_in_window} 个）` : '') +
        '。'
    )
  }
  const roles = data.messagesByRole || []
  const userC = roles.find((r) => r.role === 'user')?.cnt
  const asstC = roles.find((r) => r.role === 'assistant')?.cnt
  if (userC != null && asstC != null && Number(userC) + Number(asstC) > 0) {
    const ratio = userC > 0 ? (asstC / userC).toFixed(2) : '—'
    lines.push(`用户消息 ${userC} 条，助手消息 ${asstC} 条（助手/用户 ≈ ${ratio}）。`)
  }
  const d = data.sessionDepth || {}
  if (d.avg_msgs != null) {
    lines.push(
      `新建会话深度：平均每会话 ${Number(d.avg_msgs).toFixed(1)} 条消息，单会话峰值 ${d.max_msgs || 0} 条（仅统计窗口内新建的会话）。`
    )
  }
  const bind = data.orderBinding || {}
  const b = Number(bind.bound) || 0
  const u = Number(bind.unbound) || 0
  if (b + u > 0) {
    lines.push(`窗口内新建会话中，已绑定订单 ${b} 个，未绑定 ${u} 个（占比 ${Math.round((b / (b + u)) * 100)}%）。`)
  }
  const buckets = data.userMessageLengthBuckets || []
  const longish =
    (buckets.find((x) => x.bucket === '3_long')?.cnt || 0) + (buckets.find((x) => x.bucket === '4_xlong')?.cnt || 0)
  const uTotal = buckets.reduce((s, x) => s + (Number(x.cnt) || 0), 0)
  if (uTotal > 0) {
    lines.push(`用户单条消息长度：超过 100 字约占 ${Math.round((longish / uTotal) * 100)}%（${longish}/${uTotal}）。`)
  }
  const sampleN = (data.recentFirstUserSnippets || []).length
  if (sampleN === 0) lines.push('首句样本：数据不足，无法从样本归纳开场白类型。')
  else lines.push(`首句样本：共 ${sampleN} 条可预览（详见下方列表）；深度分析请使用「生成 AI 简报」。`)
  return lines
}

export default function SessionChatboardPanel({ adminFetch, showToast, onOpenSession }) {
  const [days, setDays] = useState(14)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [briefMd, setBriefMd] = useState('')
  const [briefGeneratedAt, setBriefGeneratedAt] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const briefContextKey = `days:${days}`
  const [autoRefresh, setAutoRefresh] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/api/admin/sessions/chatboard?days=${days}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载失败')
      setData(j)
    } catch (e) {
      showToast?.(e.message || '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, days, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    adminFetch(`/api/admin/ai-reports/latest?scope=session_chatboard_brief&contextKey=${encodeURIComponent(briefContextKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setBriefMd(j.markdown || '')
        setBriefGeneratedAt(j.generatedAt || null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [adminFetch, briefContextKey])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  const hints = useMemo(() => heuristicSummary(data), [data])

  const metricHints = useMemo(() => {
    const d = data?.metricDefinitions || {}
    return {
      messages: d.messages_in_window?.definition,
      active: d.sessions_with_messages_in_window?.definition,
      newSess: d.sessions_started_in_window?.definition,
      depth: d.sessionDepth?.definition,
    }
  }, [data])

  async function openChatboardSession(sessionId) {
    if (!sessionId) return
    try {
      const res = await adminFetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}/messages`)
      const j = await res.json()
      if (!res.ok || j.error || !j.session) {
        showToast?.('会话已删除或不存在，已刷新看板')
        load()
        return
      }
      onOpenSession?.(sessionId)
    } catch {
      showToast?.('无法打开会话，请刷新看板')
    }
  }

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const res = await adminFetch('/api/admin/sessions/chatboard/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '生成失败')
      setBriefMd(j.markdown || '')
      setBriefGeneratedAt(j.generatedAt || new Date().toISOString())
      showToast?.('简报已生成，请向下滚动查看')
      setTimeout(() => document.getElementById('session-chatboard-brief')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    } catch (e) {
      showToast?.(e.message || '生成失败')
    }
    setBriefLoading(false)
  }

  const roleMax = maxInSeries(data?.messagesByRole)
  const stepMax = maxInSeries(data?.sessionsByStep, 'cnt')
  const statusMax = maxInSeries(data?.sessionsByStatus, 'cnt')
  const lenMax = maxInSeries(data?.userMessageLengthBuckets, 'cnt')
  const dayMsgMax = maxInSeries(data?.dailyMessages, 'cnt')
  const daySessMax = maxInSeries(data?.dailyNewSessions, 'cnt')
  const hourMax = maxInSeries(data?.userMessagesByHour, 'cnt')

  const bucketLabel = {
    '1_short': '≤20字',
    '2_medium': '21–100字',
    '3_long': '101–500字',
    '4_xlong': '>500字',
  }

  const t = data?.totals || {}

  return (
    <AdminAiTabLayout
      tabKey="session-chatboard"
      adminFetch={adminFetch}
      showToast={showToast}
      onRefresh={load}
      loading={loading}
      className="max-w-[1400px] mx-auto w-full p-4 sm:p-6"
    >
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">会话看板</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">
            统计范围为数据库中<strong>仍存在的会话</strong>；管理端删除会话后刷新即不计入。
            用户端「删除对话」仅本地隐藏，不影响本看板。
            「新建会话」= 窗口内创建的会话数（含未发言空会话）；「活跃会话」= 窗口内有消息的去重会话数。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value={7}>最近 7 天</option>
            <option value={14}>最近 14 天</option>
            <option value={30}>最近 30 天</option>
          </select>
          <button type="button" onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">刷新</button>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            每 60 秒自动刷新
          </label>
          <button
            type="button"
            onClick={generateBrief}
            disabled={briefLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-50"
          >
            {briefLoading ? '生成中…' : '生成 AI 简报'}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载看板数据…</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label="窗口消息"
              value={t.messages_in_window ?? '—'}
              hint={metricHints.messages}
              gradient="from-violet-500 to-purple-600"
            />
            <MetricCard
              label="活跃会话"
              value={t.sessions_with_messages_in_window ?? '—'}
              hint={metricHints.active}
              gradient="from-sky-500 to-blue-600"
            />
            <MetricCard
              label="新建会话"
              value={t.sessions_started_in_window ?? '—'}
              hint={metricHints.newSess}
              sub={
                t.sessions_empty_in_window != null
                  ? `其中空会话（未发用户消息）${t.sessions_empty_in_window} 个`
                  : undefined
              }
              gradient="from-emerald-500 to-teal-600"
            />
            <MetricCard
              label="新建会话深度"
              value={`${data.sessionDepth?.avg_msgs != null ? Number(data.sessionDepth.avg_msgs).toFixed(1) : '—'} / ${data.sessionDepth?.max_msgs ?? '—'}`}
              hint={metricHints.depth}
              sub="均值 / 单会话峰值（条）"
              gradient="from-amber-500 to-orange-600"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">数据摘要（基于上方指标，不调用 AI）</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              {hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">消息角色占比</h3>
              {(data.messagesByRole || []).map((r) => (
                <BarRow key={r.role || '?'} label={r.role || '?'} value={r.cnt} max={roleMax} color={r.role === 'user' ? 'bg-blue-500' : r.role === 'assistant' ? 'bg-purple-500' : 'bg-gray-400'} />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">新建会话：流程步骤分布</h3>
              <p className="text-[10px] text-gray-400">仅统计窗口内新建的会话。</p>
              {(data.sessionsByStep || []).map((r) => (
                <BarRow key={String(r.step)} label={`step ${r.step}`} value={r.cnt} max={stepMax} />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">新建会话：状态分布</h3>
              {(data.sessionsByStatus || []).map((r) => (
                <BarRow key={r.status} label={r.status} value={r.cnt} max={statusMax} color="bg-teal-500" />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">用户单条消息长度</h3>
              {(data.userMessageLengthBuckets || []).map((r) => (
                <BarRow key={r.bucket} label={bucketLabel[r.bucket] || r.bucket} value={r.cnt} max={lenMax} color="bg-indigo-500" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">每日消息量</h3>
              {(data.dailyMessages || []).map((r) => (
                <BarRow key={String(r.d)} label={String(r.d).slice(0, 10)} value={r.cnt} max={dayMsgMax} />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">每日新建会话</h3>
              {(data.dailyNewSessions || []).map((r) => (
                <BarRow key={String(r.d)} label={String(r.d).slice(0, 10)} value={r.cnt} max={daySessMax} color="bg-emerald-500" />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">用户发言时段（0–23 点）</h3>
            <div className="flex gap-1 items-end h-28">
              {Array.from({ length: 24 }, (_, h) => {
                const row = (data.userMessagesByHour || []).find((x) => Number(x.h) === h)
                const cnt = row ? Number(row.cnt) : 0
                const barPx = hourMax > 0 ? Math.max(2, Math.round((cnt / hourMax) * 80)) : 2
                return (
                  <div key={h} className="flex flex-col items-center justify-end h-full w-5 flex-shrink-0">
                    <div className="w-full bg-purple-400 rounded-t min-h-[2px] transition-all" style={{ height: barPx }} title={`${h}点: ${cnt}`} />
                    <span className="text-[9px] text-gray-400 mt-0.5">{h}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">窗口内消息量 Top 会话</h3>
              <p className="text-[10px] text-gray-400 mb-2">仅含仍存在的会话。</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-2">会话 ID</th>
                    <th className="py-2 text-right">消息数</th>
                    <th className="py-2 pl-2 w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topSessionsByVolume || []).map((r) => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-1.5 font-mono text-[10px] text-gray-600 truncate max-w-[200px]" title={r.id}>
                        {r.id}
                        {r.first_user_snippet ? (
                          <div className="text-gray-500 font-sans truncate max-w-[200px]">{r.first_user_snippet}</div>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{r.msg_cnt}</td>
                      <td className="py-1.5 pl-2">
                        <button
                          type="button"
                          className="text-indigo-600 hover:underline"
                          onClick={() => {
                            navigator.clipboard.writeText(r.id).then(() => showToast?.('已复制会话 ID')).catch(() => {})
                            openChatboardSession(r.id)
                          }}
                        >
                          复制 / 打开
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 max-h-[360px] overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">近期首条用户消息（截断预览）</h3>
              <p className="text-[10px] text-gray-400 mb-2">仅现存会话；用于归纳开场白类型。</p>
              <ul className="space-y-2 text-xs text-gray-700">
                {(data.recentFirstUserSnippets || []).map((s) => (
                  <li key={s.sessionId} className="border-b border-gray-50 pb-2">
                    <button
                      type="button"
                      className="text-[10px] text-indigo-600 font-mono hover:underline"
                      onClick={() => openChatboardSession(s.sessionId)}
                    >
                      {s.sessionId.slice(0, 8)}… 打开
                    </button>
                    <div className="mt-0.5 text-gray-800 whitespace-pre-wrap break-words">{s.snippet || '（空）'}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {briefMd ? (
            <div id="session-chatboard-brief" className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 scroll-mt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-indigo-800">AI 会话简报</h3>
                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={briefLoading}
                  className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {briefLoading ? '生成中…' : '重新生成'}
                </button>
              </div>
              <AdminMarkdown text={briefMd} generatedAt={briefGeneratedAt} />
            </div>
          ) : null}
        </>
      )}
      </div>
    </AdminAiTabLayout>
  )
}
