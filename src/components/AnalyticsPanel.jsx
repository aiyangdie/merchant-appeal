import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { mergeRegistryTypes, getTokenTypeMeta } from '../constants/tokenUsageTypes.js'
import AdminMarkdown from './AdminMarkdown.jsx'
import AdminAiTabLayout from './AdminAiTabLayout.jsx'

function fmt(n) {
  return parseFloat(n || 0).toLocaleString()
}
function fmtCost(n) {
  return '¥' + parseFloat(n || 0).toFixed(4)
}
function fmtDay(d) {
  if (!d) return '-'
  return String(d).slice(0, 10)
}
function maxIn(rows, key = 'cnt') {
  let m = 1
  for (const r of rows || []) {
    const v = Number(r[key]) || 0
    if (v > m) m = v
  }
  return m
}

function BarRow({ label, value, max, color = 'bg-emerald-500' }) {
  const pct = max > 0 ? Math.round((Number(value) || 0) / max * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-24 flex-shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-700 w-12 text-right tabular-nums">{value}</span>
    </div>
  )
}

function KpiCard({ label, value, sub, gradient }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 text-white shadow-sm`}>
      <p className="text-white/80 text-[11px]">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
      {sub ? <p className="text-white/60 text-[10px] mt-1">{sub}</p> : null}
    </div>
  )
}

/**
 * 管理端「数据分析」：多维度统计 + AI 洞察；Token 消耗见 Token 明细 Tab
 */
export default function AnalyticsPanel({ adminFetch, showToast, onOpenTokens, stats: parentStats, fetchStats }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiMd, setAiMd] = useState('')
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [typeMeta, setTypeMeta] = useState({})
  const aiContextKey = `days:${days}`
  const fetchStatsRef = useRef(fetchStats)
  fetchStatsRef.current = fetchStats

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [aRes, regRes] = await Promise.all([
        adminFetch(`/api/admin/analytics?days=${days}`),
        adminFetch('/api/admin/token-usage/registry'),
      ])
      const aj = await aRes.json()
      if (!aRes.ok) throw new Error(aj.error || '加载失败')
      setData(aj)
      if (regRes.ok) {
        const rj = await regRes.json()
        setTypeMeta(mergeRegistryTypes(rj.types || []))
      }
      fetchStatsRef.current?.()
    } catch (e) {
      showToast?.(e.message || '加载数据分析失败')
      if (!silent) setData(null)
    }
    setLoading(false)
  }, [adminFetch, days, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    adminFetch(`/api/admin/ai-reports/latest?scope=analytics_insights&contextKey=${encodeURIComponent(aiContextKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setAiMd(j.markdown || '')
        setAiGeneratedAt(j.generatedAt || null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [adminFetch, aiContextKey])

  const dash = data?.dashboard || parentStats || {}
  const profit = dash.profitAnalysis || {}
  const tw = data?.tokenWindow || {}
  const ts = dash.tokenSummary || {}

  async function runAiInsights() {
    setAiLoading(true)
    try {
      const res = await adminFetch('/api/admin/analytics/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '失败')
      setAiMd(j.markdown || '')
      setAiGeneratedAt(j.generatedAt || new Date().toISOString())
      showToast?.('AI 洞察已生成，消耗已记入 Token 明细（数据分析 AI）')
    } catch (e) {
      showToast?.(e.message || '生成失败')
    }
    setAiLoading(false)
  }

  const tokenRows = useMemo(() => {
    return (data?.tokenByTypeWindow || dash.tokenByType || []).map((r) => {
      const meta = typeMeta[r.type] || getTokenTypeMeta(r.type)
      return { ...r, label: `${meta.icon} ${meta.label}` }
    })
  }, [data, dash.tokenByType, typeMeta])

  const dayMsgMax = maxIn(data?.window?.dailyMessages, 'cnt')
  const daySessMax = maxIn(data?.window?.dailySessions, 'cnt')
  const dayRevMax = maxIn(data?.window?.dailyRecharge, 'revenue')

  if (loading && !data) {
    return <div className="text-center py-20 text-gray-400 text-sm">加载数据分析…</div>
  }

  return (
    <AdminAiTabLayout
      tabKey="analytics"
      adminFetch={adminFetch}
      showToast={showToast}
      onRefresh={() => load(true)}
      loading={loading && !data}
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full"
    >
      <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">数据分析</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            经营、用户行为、会话与 Token 消耗（近 {days} 天窗口）。所有 AI 调用均记入
            <button type="button" onClick={onOpenTokens} className="text-purple-600 hover:underline mx-1">Token 明细</button>
            ，可查看输入/输出 Token、费用与功能类型。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
            <option value={7}>近 7 天</option>
            <option value={14}>近 14 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
          <button type="button" onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">刷新</button>
          <button
            type="button"
            onClick={runAiInsights}
            disabled={aiLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            {aiLoading ? '分析中…' : '生成 AI 洞察'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="充值收入(累计)" value={fmtCost(profit.rechargeIncome)} sub={`待确认 ${dash.rechargeStats?.pendingCount || 0} 笔`} gradient="from-emerald-500 to-green-600" />
        <KpiCard label={`AI成本(${days}天窗口)`} value={fmtCost(tw.aiCostEstimate)} sub={`输入 ${fmt(tw.input_tokens)} / 输出 ${fmt(tw.output_tokens)}`} gradient="from-orange-400 to-rose-500" />
        <KpiCard label="用户消费(窗口)" value={fmtCost(tw.userCost)} sub={`系统请求 ${fmt(tw.system_requests)} · 用户 ${fmt(tw.user_requests)}`} gradient="from-violet-500 to-purple-600" />
        <KpiCard label="知识库案例" value={data?.knowledge?.activeCases ?? '—'} sub={`共 ${data?.knowledge?.totalCases ?? 0} 条 · 深度分析会话 ${data?.product?.sessionsWithDeepAnalysis ?? 0}`} gradient="from-blue-500 to-cyan-600" />
      </div>

      {data?.chatboard?.totals && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900">
          <span className="font-semibold">会话看板（近 {Math.min(days, 30)} 天）：</span>
          新建会话 {data.chatboard.totals.sessions_started_in_window} · 活跃 {data.chatboard.totals.sessions_with_messages_in_window} · 空会话 {data.chatboard.totals.sessions_empty_in_window} · 消息 {data.chatboard.totals.messages_in_window}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">每日消息（窗口）</h3>
          {(data?.window?.dailyMessages || []).map((r) => (
            <BarRow key={String(r.day)} label={fmtDay(r.day)} value={r.cnt} max={dayMsgMax} color="bg-blue-500" />
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">每日新建会话</h3>
          {(data?.window?.dailySessions || []).map((r) => (
            <BarRow key={String(r.day)} label={fmtDay(r.day)} value={r.cnt} max={daySessMax} color="bg-emerald-500" />
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">每日充值确认</h3>
          {(data?.window?.dailyRecharge || []).map((r) => (
            <BarRow key={String(r.day)} label={fmtDay(r.day)} value={Number(r.revenue).toFixed(0)} max={dayRevMax} color="bg-amber-500" />
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">用户行为（窗口）</h3>
          {(data?.window?.actionBreakdown || []).slice(0, 10).map((r) => (
            <BarRow key={r.action} label={r.action} value={r.cnt} max={maxIn(data?.window?.actionBreakdown, 'cnt')} />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Token 按功能（{days} 天窗口）</h3>
          <p className="text-[10px] text-gray-400">输入蓝 / 输出橙 · 点击「Token 明细」看每条流水</p>
        </div>
        {tokenRows.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">窗口内暂无 Token 记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="text-left py-2">功能</th>
                  <th className="text-right py-2">次数</th>
                  <th className="text-right py-2">输入</th>
                  <th className="text-right py-2">输出</th>
                  <th className="text-right py-2">总Token</th>
                  <th className="text-right py-2">用户消费</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.map((r) => (
                  <tr key={r.type} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 pr-2">{r.label}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(r.cnt)}</td>
                    <td className="py-2 text-right text-blue-600 tabular-nums">{fmt(r.input_tokens)}</td>
                    <td className="py-2 text-right text-amber-600 tabular-nums">{fmt(r.output_tokens)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{fmt(r.tokens)}</td>
                    <td className="py-2 text-right text-orange-600 tabular-nums">{fmtCost(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-3">
          全站累计：{fmt(ts.total_tokens)} Token · {fmt(ts.total_requests)} 次请求 · 用户消费 {fmtCost(ts.total_cost)} · 今日 {fmt(ts.todayTokens)} Token
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Top 活跃用户</h3>
        </div>
        {(dash.topUsers || []).length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-300">暂无数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] text-gray-400">
                  <th className="text-left px-4 py-2">用户</th>
                  <th className="text-right px-2 py-2">消息</th>
                  <th className="text-right px-2 py-2">会话</th>
                  <th className="text-right px-2 py-2">消费</th>
                  <th className="text-right px-4 py-2">余额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(dash.topUsers || []).map((u, i) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">
                      <span className="mr-1">{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span>
                      {u.nickname || u.phone || `#${u.id}`}
                    </td>
                    <td className="px-2 py-2 text-right">{u.total_messages}</td>
                    <td className="px-2 py-2 text-right">{u.sessions}</td>
                    <td className="px-2 py-2 text-right text-orange-600">¥{parseFloat(u.total_spent || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-green-600">¥{parseFloat(u.balance || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <h3 className="text-sm font-semibold text-gray-700">最近用户行为</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(dash.recentActions || []).length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-300">暂无</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-gray-400">
                  <th className="text-left px-3 py-2">时间</th>
                  <th className="text-left px-2 py-2">用户</th>
                  <th className="text-left px-2 py-2">行为</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">详情</th>
                </tr>
              </thead>
              <tbody>
                {(dash.recentActions || []).slice(0, 40).map((a, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-1.5">{a.nickname || a.phone || '-'}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{a.action}</td>
                    <td className="px-3 py-1.5 text-gray-500 truncate max-w-[200px] hidden sm:table-cell">{a.detail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {aiMd ? (
        <div className="bg-white rounded-xl border border-indigo-100 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-indigo-800">AI 数据洞察</h3>
            <button
              type="button"
              onClick={runAiInsights}
              disabled={aiLoading}
              className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
            >
              {aiLoading ? '生成中…' : '重新生成'}
            </button>
          </div>
          <AdminMarkdown text={aiMd} generatedAt={aiGeneratedAt} />
        </div>
      ) : null}
      </div>
    </AdminAiTabLayout>
  )
}
