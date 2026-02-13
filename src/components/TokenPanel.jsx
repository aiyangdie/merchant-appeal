import React, { useState, useEffect, useCallback } from 'react'

const TYPE_LABELS = {
  chat: '用户对话',
  deep_analysis: '深度分析',
  appeal_text: '申诉文案',
  evolution_analysis: '进化分析(系统)',
  auto_review: 'AI规则审批(系统)',
  field_extraction: '字段提取',
}

const DEEPSEEK_PRICING = {
  input: 0.001,
  output: 0.002,
  note: 'DeepSeek-Chat: 输入¥0.001/1K, 输出¥0.002/1K',
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
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/token-usage')
      const json = await res.json()
      setData(json.stats)
      setUsage(json.usage || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载中...</div>
  if (!data) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">暂无Token数据</div>

  const t = data.totals || {}
  const td = data.today || {}
  const sys = data.systemUsage || {}

  const officialInputCost = (parseFloat(t.total_input) / 1000 * DEEPSEEK_PRICING.input)
  const officialOutputCost = (parseFloat(t.total_output) / 1000 * DEEPSEEK_PRICING.output)
  const officialTotal = officialInputCost + officialOutputCost

  const SUB_TABS = [
    { key: 'overview', label: '总览' },
    { key: 'daily', label: '每日趋势' },
    { key: 'users', label: '用户明细' },
    { key: 'types', label: '功能分类' },
    { key: 'records', label: '消费记录' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Token 费用明细</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{DEEPSEEK_PRICING.note}</p>
        </div>
        <button onClick={fetchData} className="text-[11px] text-gray-400 hover:text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-50">刷新</button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {SUB_TABS.map(s => (
          <button key={s.key} onClick={() => setTab(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${tab === s.key ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
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
            <StatCard label="DeepSeek官方成本" value={'¥' + officialTotal.toFixed(4)} sub={`输入¥${officialInputCost.toFixed(4)} 输出¥${officialOutputCost.toFixed(4)}`} color="from-violet-500 to-purple-600" />
          </div>

          {/* System vs User breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">📊 系统消耗 vs 用户消耗</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div>
                    <div className="text-xs font-medium text-indigo-700">🤖 系统(进化/审批)</div>
                    <div className="text-[10px] text-indigo-400">{fmt(sys.requests)}次请求</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-indigo-600">{fmt(parseInt(sys.input_tokens) + parseInt(sys.output_tokens))} tokens</div>
                    <div className="text-[10px] text-indigo-400">输入{fmt(sys.input_tokens)} 输出{fmt(sys.output_tokens)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-50 border border-green-100">
                  <div>
                    <div className="text-xs font-medium text-green-700">👤 用户(对话/分析/文案)</div>
                    <div className="text-[10px] text-green-400">{fmt(parseInt(t.total_requests) - parseInt(sys.requests))}次请求</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{fmt(parseInt(t.total_tokens) - parseInt(sys.input_tokens) - parseInt(sys.output_tokens))} tokens</div>
                    <div className="text-[10px] text-green-400">消费 {fmtCost(t.total_cost)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">💰 DeepSeek官方定价参考</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-gray-500">输入Token单价</span>
                  <span className="font-semibold text-gray-700">¥0.001 / 1K tokens</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-gray-500">输出Token单价</span>
                  <span className="font-semibold text-gray-700">¥0.002 / 1K tokens</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-blue-600">本系统总输入tokens</span>
                  <span className="font-bold text-blue-700">{fmt(t.total_input)} → ¥{officialInputCost.toFixed(4)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-blue-600">本系统总输出tokens</span>
                  <span className="font-bold text-blue-700">{fmt(t.total_output)} → ¥{officialOutputCost.toFixed(4)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                  <span className="text-purple-700 font-semibold">DeepSeek实际成本</span>
                  <span className="font-bold text-purple-700 text-sm">¥{officialTotal.toFixed(4)}</span>
                </div>
              </div>
            </div>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">按功能分类统计</h3>
          {data.byType?.length > 0 ? (
            <div className="space-y-2">
              {data.byType.map((t, i) => {
                const oc = (parseInt(t.input_tokens) / 1000 * 0.001) + (parseInt(t.output_tokens) / 1000 * 0.002)
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">{TYPE_LABELS[t.type] || t.type}</div>
                      <div className="text-[10px] text-gray-400">{fmt(t.cnt)}次请求</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs">
                        <span className="text-blue-600">输入{fmt(t.input_tokens)}</span>
                        <span className="mx-1 text-gray-300">|</span>
                        <span className="text-amber-600">输出{fmt(t.output_tokens)}</span>
                      </div>
                      <div className="text-[10px] mt-0.5">
                        <span className="text-orange-600">消费{fmtCost(t.cost)}</span>
                        <span className="mx-1 text-gray-300">|</span>
                        <span className="text-purple-600">成本¥{oc.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>}
        </div>
      )}

      {/* Raw records */}
      {tab === 'records' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">最近200条消费记录</h3>
          {usage.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-1.5 pr-1 font-medium">时间</th>
                    <th className="text-left py-1.5 px-1 font-medium">用户</th>
                    <th className="text-left py-1.5 px-1 font-medium">类型</th>
                    <th className="text-right py-1.5 px-1 font-medium">输入</th>
                    <th className="text-right py-1.5 px-1 font-medium">输出</th>
                    <th className="text-right py-1.5 px-1 font-medium">总计</th>
                    <th className="text-right py-1.5 px-1 font-medium">消费</th>
                    <th className="text-right py-1.5 pl-1 font-medium">倍率</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50/50 hover:bg-gray-50/30">
                      <td className="py-1.5 pr-1 text-gray-500">{fmtTime(r.created_at)}</td>
                      <td className="py-1.5 px-1 text-gray-700">{r.nickname || (r.user_id === 0 ? '系统' : `#${r.user_id}`)}</td>
                      <td className="py-1.5 px-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.api_mode === 'system' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[r.type] || r.type}
                        </span>
                      </td>
                      <td className="py-1.5 px-1 text-right text-blue-600">{fmt(r.input_tokens)}</td>
                      <td className="py-1.5 px-1 text-right text-amber-600">{fmt(r.output_tokens)}</td>
                      <td className="py-1.5 px-1 text-right font-medium text-gray-700">{fmt(r.total_tokens)}</td>
                      <td className="py-1.5 px-1 text-right text-orange-600">{fmtCost(r.cost)}</td>
                      <td className="py-1.5 pl-1 text-right text-gray-400">×{r.multiplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div>}
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
