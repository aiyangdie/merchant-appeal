import React, { useState, useEffect, useCallback } from 'react'

const TYPE_META = {
  chat: { label: '用户对话', icon: '💬', desc: '用户与AI的聊天交互', color: '#3b82f6' },
  chat_collection: { label: '信息收集', icon: '📋', desc: '引导用户提供申诉材料', color: '#06b6d4' },
  deep_analysis: { label: '深度分析', icon: '🔍', desc: '综合分析申诉方案', color: '#8b5cf6' },
  appeal_text: { label: '申诉文案', icon: '📝', desc: '生成专业申诉文书', color: '#f59e0b' },
  report_retry: { label: '报告重试', icon: '🔄', desc: 'AI故障后重试生成', color: '#ef4444' },
  field_extraction: { label: '字段提取', icon: '🏷️', desc: '从对话中提取关键信息', color: '#14b8a6' },
  evolution_analysis: { label: '进化分析', icon: '🧬', desc: '系统自动学习优化(系统)', color: '#6366f1' },
  auto_review: { label: 'AI审批', icon: '✅', desc: '自动审核规则变更(系统)', color: '#10b981' },
}

const AI_PRICING = {
  input: 0.001,
  output: 0.002,
  note: 'AI参考定价: 输入¥0.001/1K, 输出¥0.002/1K',
}

function fmt(n) { return parseFloat(n || 0).toLocaleString() }
function fmtCost(n) { return '¥' + parseFloat(n || 0).toFixed(4) }
function fmtDate(d) {
  if (!d) return '-'
  const dt = new Date(d)
  return dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
function fmtTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function TokenPanel({ adminFetch }) {
  const [data, setData] = useState(null)
  const [usage, setUsage] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [recordPage, setRecordPage] = useState(1)
  const [recordTotal, setRecordTotal] = useState(0)
  const [recordFilter, setRecordFilter] = useState({ type: '', userId: '', dateFrom: '', dateTo: '' })

  const fetchData = useCallback(async () => {
    if (!data) setLoading(true)
    try {
      const res = await adminFetch('/api/admin/token-usage?limit=50&page=1')
      const json = await res.json()
      setData(json.stats)
      setUsage(json.records || [])
      setRecordTotal(json.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchRecords = useCallback(async (page = 1, filters = recordFilter) => {
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filters.type) params.set('type', filters.type)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const res = await adminFetch(`/api/admin/token-usage?${params}`)
      const json = await res.json()
      setUsage(json.records || [])
      setRecordTotal(json.total || 0)
      setRecordPage(page)
    } catch (e) { console.error(e) }
  }, [adminFetch, recordFilter])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载中...</div>
  if (!data) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">暂无Token数据</div>

  const t = data.totals || {}
  const td = data.today || {}
  const sys = data.systemUsage || {}

  const officialInputCost = (parseFloat(t.total_input) / 1000 * AI_PRICING.input)
  const officialOutputCost = (parseFloat(t.total_output) / 1000 * AI_PRICING.output)
  const officialTotal = officialInputCost + officialOutputCost

  const SUB_TABS = [
    { key: 'overview', label: '总览' },
    { key: 'daily', label: '每日趋势' },
    { key: 'users', label: '用户明细' },
    { key: 'types', label: '功能分类' },
    { key: 'records', label: '消费记录' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Token 费用明细</h2>
          <p className="text-xs text-gray-400 mt-1">{AI_PRICING.note}</p>
        </div>
        <button onClick={fetchData} className="text-xs text-gray-400 hover:text-purple-600 px-4 py-2 rounded-xl hover:bg-purple-50 border border-transparent hover:border-purple-100 transition-colors">刷新数据</button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {SUB_TABS.map(s => (
          <button key={s.key} onClick={() => setTab(s.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${tab === s.key ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Main stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="总请求数" value={fmt(t.total_requests)} sub={`今日 ${fmt(td.requests)}`} color="from-blue-500 to-blue-600" />
            <StatCard label="总Token" value={fmt(t.total_tokens)} sub={`输入${fmt(t.total_input)} 输出${fmt(t.total_output)}`} color="from-emerald-500 to-green-600" />
            <StatCard label="用户消费(含倍率)" value={fmtCost(t.total_cost)} sub={`今日 ${fmtCost(td.cost)}`} color="from-orange-400 to-rose-500" />
            <StatCard label="AI实际成本" value={'¥' + officialTotal.toFixed(4)} sub={`利润: ¥${(parseFloat(t.total_cost || 0) - officialTotal).toFixed(4)}`} color="from-violet-500 to-purple-600" />
          </div>

          {/* Profit Analysis + IO Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Profit breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">� 盈亏分析 (AI帮你赚了多少)</h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2.5 rounded-xl bg-green-50 border border-green-100">
                  <span className="text-xs text-green-700 font-medium">用户付费总额</span>
                  <span className="text-sm font-bold text-green-700">{fmtCost(t.total_cost)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-red-50 border border-red-100">
                  <span className="text-xs text-red-600 font-medium">AI成本(输入+输出)</span>
                  <span className="text-sm font-bold text-red-600">-¥{officialTotal.toFixed(4)}</span>
                </div>
                <div className={`flex justify-between p-3 rounded-xl border-2 ${(parseFloat(t.total_cost || 0) - officialTotal) >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                  <span className="text-xs font-bold text-gray-700">Token净利润</span>
                  <span className={`text-base font-black ${(parseFloat(t.total_cost || 0) - officialTotal) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ¥{(parseFloat(t.total_cost || 0) - officialTotal).toFixed(4)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 text-center mt-1">
                  倍率 ×{parseFloat(data?.byType?.[0]?.multiplier || 2)} · 免费模型成本趋近于0
                </div>
              </div>
            </div>

            {/* Input vs Output ratio visual */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">📊 输入/输出Token比例</h3>
              {(() => {
                const inp = parseInt(t.total_input || 0)
                const out = parseInt(t.total_output || 0)
                const total = inp + out || 1
                const inPct = (inp / total * 100).toFixed(1)
                const outPct = (out / total * 100).toFixed(1)
                return (
                  <div className="space-y-3">
                    <div className="h-6 rounded-full overflow-hidden flex bg-gray-100">
                      <div className="bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${inPct}%` }}>
                        {inPct > 10 ? `输入 ${inPct}%` : ''}
                      </div>
                      <div className="bg-amber-500 flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${outPct}%` }}>
                        {outPct > 10 ? `输出 ${outPct}%` : ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-center">
                        <div className="text-xs font-bold text-blue-700">{fmt(inp)}</div>
                        <div className="text-[10px] text-blue-500">输入Token · ¥{(inp / 1000 * AI_PRICING.input).toFixed(4)}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
                        <div className="text-xs font-bold text-amber-700">{fmt(out)}</div>
                        <div className="text-[10px] text-amber-500">输出Token · ¥{(out / 1000 * AI_PRICING.output).toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">输出Token单价是输入的2倍，尽量减少输出可降低成本</div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* System vs User breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">🤖 系统消耗 vs 👤 用户消耗</h3>
            {(() => {
              const sysTokens = parseInt(sys.input_tokens || 0) + parseInt(sys.output_tokens || 0)
              const userTokens = parseInt(t.total_tokens || 0) - sysTokens
              const total = sysTokens + userTokens || 1
              return (
                <div className="space-y-2">
                  <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
                    <div className="bg-indigo-500" style={{ width: `${(sysTokens / total * 100)}%` }} title={`系统 ${fmt(sysTokens)}`} />
                    <div className="bg-green-500" style={{ width: `${(userTokens / total * 100)}%` }} title={`用户 ${fmt(userTokens)}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                      <div>
                        <div className="text-xs font-medium text-indigo-700">🤖 系统</div>
                        <div className="text-[10px] text-indigo-400">{fmt(sys.requests)}次 · {(sysTokens / total * 100).toFixed(0)}%</div>
                      </div>
                      <div className="text-sm font-bold text-indigo-600">{fmt(sysTokens)}</div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-50 border border-green-100">
                      <div>
                        <div className="text-xs font-medium text-green-700">👤 用户</div>
                        <div className="text-[10px] text-green-400">{fmt(parseInt(t.total_requests) - parseInt(sys.requests))}次 · {(userTokens / total * 100).toFixed(0)}%</div>
                      </div>
                      <div className="text-sm font-bold text-green-600">{fmt(userTokens)}</div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Daily trend */}
      {tab === 'daily' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">近30日Token消耗趋势</h3>
          {data.daily?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 pr-2 font-medium">日期</th>
                    <th className="text-right py-2 px-2 font-medium">请求数</th>
                    <th className="text-right py-2 px-2 font-medium">输入Token</th>
                    <th className="text-right py-2 px-2 font-medium">输出Token</th>
                    <th className="text-right py-2 px-2 font-medium">总Token</th>
                    <th className="text-right py-2 px-2 font-medium">用户消费</th>
                    <th className="text-right py-2 pl-2 font-medium">官方成本</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d, i) => {
                    const oc = (parseInt(d.input_tokens) / 1000 * 0.001) + (parseInt(d.output_tokens) / 1000 * 0.002)
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 pr-2 font-medium text-gray-600">{fmtDate(d.day)}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{fmt(d.requests)}</td>
                        <td className="py-2 px-2 text-right text-blue-600">{fmt(d.input_tokens)}</td>
                        <td className="py-2 px-2 text-right text-amber-600">{fmt(d.output_tokens)}</td>
                        <td className="py-2 px-2 text-right font-semibold text-gray-700">{fmt(d.tokens)}</td>
                        <td className="py-2 px-2 text-right text-orange-600">{fmtCost(d.cost)}</td>
                        <td className="py-2 pl-2 text-right text-purple-600">¥{oc.toFixed(4)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>}
        </div>
      )}

      {/* Per-user breakdown */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">用户Token消费排行</h3>
          {data.byUser?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 pr-2 font-medium">用户</th>
                    <th className="text-right py-2 px-2 font-medium">请求数</th>
                    <th className="text-right py-2 px-2 font-medium">输入Token</th>
                    <th className="text-right py-2 px-2 font-medium">输出Token</th>
                    <th className="text-right py-2 px-2 font-medium">总Token</th>
                    <th className="text-right py-2 px-2 font-medium">消费金额</th>
                    <th className="text-right py-2 pl-2 font-medium">最后使用</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byUser.map((u, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-gray-700">{u.nickname || (u.user_id === 0 ? '🤖 系统' : `用户#${u.user_id}`)}</div>
                        {u.phone && <div className="text-[10px] text-gray-400">{u.phone}</div>}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">{fmt(u.requests)}</td>
                      <td className="py-2 px-2 text-right text-blue-600">{fmt(u.input_tokens)}</td>
                      <td className="py-2 px-2 text-right text-amber-600">{fmt(u.output_tokens)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-700">{fmt(u.total_tokens)}</td>
                      <td className="py-2 px-2 text-right text-orange-600 font-semibold">{fmtCost(u.total_cost)}</td>
                      <td className="py-2 pl-2 text-right text-gray-400">{fmtTime(u.last_used)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center py-8 text-gray-400 text-sm">暂无用户数据</div>}
        </div>
      )}

      {/* By type */}
      {tab === 'types' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">按功能分类 · 哪些功能最耗Token</h3>
            {data.byType?.length > 0 ? (() => {
              const maxTokens = Math.max(...data.byType.map(x => parseInt(x.tokens || 0)), 1)
              return (
                <div className="space-y-3">
                  {data.byType.map((item, i) => {
                    const meta = TYPE_META[item.type] || { label: item.type, icon: '📦', desc: '', color: '#6b7280' }
                    const tokens = parseInt(item.tokens || 0)
                    const inp = parseInt(item.input_tokens || 0)
                    const out = parseInt(item.output_tokens || 0)
                    const oc = (inp / 1000 * 0.001) + (out / 1000 * 0.002)
                    const pct = (tokens / maxTokens * 100).toFixed(0)
                    return (
                      <div key={i} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800">{meta.label}</span>
                              <span className="text-[10px] text-gray-400">{fmt(item.cnt)}次请求</span>
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">{meta.desc}</p>
                          </div>
                        </div>
                        {/* Token bar */}
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                        </div>
                        {/* Stats grid */}
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="py-1 rounded-lg bg-gray-50">
                            <div className="text-[10px] font-bold text-gray-700">{fmt(tokens)}</div>
                            <div className="text-[8px] text-gray-400">总Token</div>
                          </div>
                          <div className="py-1 rounded-lg bg-blue-50">
                            <div className="text-[10px] font-bold text-blue-600">{fmt(inp)}</div>
                            <div className="text-[8px] text-blue-400">输入</div>
                          </div>
                          <div className="py-1 rounded-lg bg-amber-50">
                            <div className="text-[10px] font-bold text-amber-600">{fmt(out)}</div>
                            <div className="text-[8px] text-amber-400">输出</div>
                          </div>
                          <div className="py-1 rounded-lg bg-purple-50">
                            <div className="text-[10px] font-bold text-purple-600">¥{oc.toFixed(4)}</div>
                            <div className="text-[8px] text-purple-400">成本</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })() : <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>}
          </div>
        </div>
      )}

      {/* Records with filter & pagination */}
      {tab === 'records' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={recordFilter.type} onChange={e => { const f = { ...recordFilter, type: e.target.value }; setRecordFilter(f); fetchRecords(1, f) }}
                className="px-2 py-1.5 text-xs border rounded-lg bg-white">
                <option value="">全部类型</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <input type="date" value={recordFilter.dateFrom} onChange={e => { const f = { ...recordFilter, dateFrom: e.target.value }; setRecordFilter(f); fetchRecords(1, f) }}
                className="px-2 py-1.5 text-xs border rounded-lg" />
              <span className="text-xs text-gray-400">至</span>
              <input type="date" value={recordFilter.dateTo} onChange={e => { const f = { ...recordFilter, dateTo: e.target.value }; setRecordFilter(f); fetchRecords(1, f) }}
                className="px-2 py-1.5 text-xs border rounded-lg" />
              <input type="text" placeholder="用户ID" value={recordFilter.userId} onChange={e => { const f = { ...recordFilter, userId: e.target.value }; setRecordFilter(f) }}
                onKeyDown={e => e.key === 'Enter' && fetchRecords(1, recordFilter)}
                className="px-2 py-1.5 text-xs border rounded-lg w-20" />
              {(recordFilter.type || recordFilter.dateFrom || recordFilter.dateTo || recordFilter.userId) && (
                <button onClick={() => { const f = { type: '', userId: '', dateFrom: '', dateTo: '' }; setRecordFilter(f); fetchRecords(1, f) }}
                  className="px-2 py-1 text-[10px] text-red-500 hover:bg-red-50 rounded-lg">清除筛选</button>
              )}
              <span className="text-[10px] text-gray-400 ml-auto">共 {recordTotal} 条</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {usage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-1.5 pr-1 font-medium">时间</th>
                      <th className="text-left py-1.5 px-1 font-medium">用户</th>
                      <th className="text-left py-1.5 px-1 font-medium">类型</th>
                      <th className="text-left py-1.5 px-1 font-medium">会话ID</th>
                      <th className="text-right py-1.5 px-1 font-medium">输入</th>
                      <th className="text-right py-1.5 px-1 font-medium">输出</th>
                      <th className="text-right py-1.5 px-1 font-medium">总计</th>
                      <th className="text-right py-1.5 px-1 font-medium">消费</th>
                      <th className="text-right py-1.5 px-1 font-medium">倍率</th>
                      <th className="text-right py-1.5 pl-1 font-medium">模式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((r, i) => {
                      const fullTime = r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'
                      return (
                        <tr key={i} className="border-b border-gray-50/50 hover:bg-gray-50/30">
                          <td className="py-1.5 pr-1 text-gray-500 whitespace-nowrap" title={fullTime}>{fmtTime(r.created_at)}</td>
                          <td className="py-1.5 px-1">
                            <div className="text-gray-700 font-medium">{r.nickname || (r.user_id === 0 ? '🤖系统' : `#${r.user_id}`)}</div>
                            {r.phone && <div className="text-[9px] text-gray-400">{r.phone}</div>}
                          </td>
                          <td className="py-1.5 px-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.user_id === 0 || r.type?.startsWith('evolution') || r.type?.startsWith('auto_') ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                              {(TYPE_META[r.type]?.icon || '📦') + ' ' + (TYPE_META[r.type]?.label || r.type)}
                            </span>
                          </td>
                          <td className="py-1.5 px-1 text-gray-400 font-mono text-[9px]">{r.session_id ? r.session_id.slice(0, 8) + '...' : '-'}</td>
                          <td className="py-1.5 px-1 text-right text-blue-600">{fmt(r.input_tokens)}</td>
                          <td className="py-1.5 px-1 text-right text-amber-600">{fmt(r.output_tokens)}</td>
                          <td className="py-1.5 px-1 text-right font-medium text-gray-700">{fmt(r.total_tokens)}</td>
                          <td className="py-1.5 px-1 text-right text-orange-600">{fmtCost(r.cost)}</td>
                          <td className="py-1.5 px-1 text-right text-gray-400">×{r.multiplier}</td>
                          <td className="py-1.5 pl-1 text-right">
                            <span className={`text-[9px] px-1 py-0.5 rounded ${r.api_mode === 'official' ? 'bg-green-50 text-green-600' : r.api_mode === 'free' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                              {r.api_mode === 'official' ? '官方' : r.api_mode === 'free' ? '免费' : r.api_mode || '-'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div>}

            {/* Pagination */}
            {recordTotal > 50 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">第 {recordPage} 页 / 共 {Math.ceil(recordTotal / 50)} 页</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchRecords(recordPage - 1)} disabled={recordPage <= 1}
                    className={`px-2.5 py-1 text-xs rounded-lg ${recordPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}>上一页</button>
                  {[...Array(Math.min(5, Math.ceil(recordTotal / 50)))].map((_, i) => {
                    const p = recordPage <= 3 ? i + 1 : recordPage - 2 + i
                    if (p > Math.ceil(recordTotal / 50)) return null
                    return <button key={p} onClick={() => fetchRecords(p)}
                      className={`w-7 h-7 text-xs rounded-lg ${p === recordPage ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
                  })}
                  <button onClick={() => fetchRecords(recordPage + 1)} disabled={recordPage >= Math.ceil(recordTotal / 50)}
                    className={`px-2.5 py-1 text-xs rounded-lg ${recordPage >= Math.ceil(recordTotal / 50) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}>下一页</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 text-white`} style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
      <p className="text-white/70 text-[11px] font-medium">{label}</p>
      <p className="text-xl font-bold mt-0.5 tracking-tight">{value}</p>
      <p className="text-white/50 text-[10px] mt-1">{sub}</p>
    </div>
  )
}
