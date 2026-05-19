/**
 * @fileoverview Token 用量统计与费用明细面板
 * 为管理员提供全面的 Token 消耗分析，包括总览、每日趋势、用户明细、功能分类和消费记录
 *
 * 核心功能：
 *   - 总览：总请求数、总Token、用户消费（含倍率）、AI实际成本、盈亏分析
 *   - 每日趋势：近30日Token消耗趋势表格
 *   - 用户明细：用户Token消费排行，按总消费排序
 *   - 功能分类：各功能（对话、深度分析、申诉文案等）的Token消耗条形图
 *   - 消费记录：带筛选（类型/用户ID/日期范围）和分页的明细列表
 *
 * 计费逻辑：
 *   - AI参考定价：输入 ¥0.001/1K，输出 ¥0.002/1K
 *   - 用户消费金额 = (输入Token + 输出Token) / 1000 × 倍率 × 单价
 *   - 净利润 = 用户付费总额 - AI实际成本
 *
 * 关键依赖：
 *   - adminFetch: 带认证的 fetch 函数
 *   - 后端接口: /api/admin/token-usage
 *
 * 注意事项：
 *   - 系统请求（user_id === 0）标记为 🤖 系统，与用户请求分开统计
 *   - 消费记录支持按类型、用户ID、日期范围筛选
 */
import React, { useState, useEffect, useCallback } from 'react'
import { TOKEN_USAGE_TYPE_META, mergeRegistryTypes, getTokenTypeMeta as getLocalTypeMeta } from '../constants/tokenUsageTypes.js'
import AdminMarkdown from './AdminMarkdown.jsx'
import AdminAiChat from './AdminAiChat.jsx'

function buildTypeMeta(registryTypes) {
  return registryTypes?.length ? mergeRegistryTypes(registryTypes) : TOKEN_USAGE_TYPE_META
}

function getTokenTypeLabel(type, typeMeta) {
  const m = typeMeta[type] || getLocalTypeMeta(type)
  return `${m.icon} ${m.label}`
}

/** AI 官方参考定价（用于计算实际成本和利润） */
const AI_PRICING = {
  input: 0.001,
  output: 0.002,
  note: 'AI参考定价: 输入¥0.001/1K, 输出¥0.002/1K',
}

/** 格式化数字：添加千分位分隔符 */
function fmt(n) { return parseFloat(n || 0).toLocaleString() }
/** 格式化金额：保留4位小数，带¥符号 */
function fmtCost(n) { return '¥' + parseFloat(n || 0).toFixed(4) }
/** 格式化日期：仅显示月-日 */
function fmtDate(d) {
  if (!d) return '-'
  const dt = new Date(d)
  return dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
/** 格式化时间：显示月-日 时:分 */
function fmtTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtFullTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function parseContextJson(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}
function DetailBlock({ summary, contextJson, id }) {
  const ctx = parseContextJson(contextJson)
  if (!summary && !ctx) return null
  return (
    <div className="mt-1 mb-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-gray-600 space-y-1.5">
      {id != null && <div className="text-[9px] text-gray-400 font-mono">记录 #{id}</div>}
      {summary && <p className="text-gray-800 leading-relaxed"><span className="font-semibold text-gray-500">做了什么：</span>{summary}</p>}
      {ctx && (
        <pre className="text-[9px] text-gray-500 overflow-x-auto whitespace-pre-wrap break-all font-mono max-h-32 overflow-y-auto">
          {JSON.stringify(ctx, null, 2)}
        </pre>
      )}
    </div>
  )
}

/**
 * Token 用量统计与费用明细面板（管理员专用）
 *
 * 提供5个子标签页：
 *   1. 总览：总请求数/Token/消费、AI实际成本、盈亏分析、输入输出比例、系统vs用户消耗
 *   2. 每日趋势：近30日Token消耗趋势表格
 *   3. 用户明细：用户消费排行，显示昵称/手机号/最后使用时间
 *   4. 功能分类：各功能类型的Token消耗可视化条形图
 *   5. 消费记录：带筛选和分页的详细消费流水
 *
 * @param {Object} props
 * @param {Function} props.adminFetch - 带管理员认证的 fetch 函数
 * @returns {JSX.Element} Token 用量统计面板 UI
 *
 * 注意事项：
 *   - 组件挂载时自动加载数据（仅首次）
 *   - 系统请求（user_id === 0）不纳入用户消费统计
 *   - 官方成本按 AI_PRICING 计算，用户消费含倍率，差额即为利润
 */
export default function TokenPanel({ adminFetch, showToast }) {
  /** 总计数据对象 */
  const [data, setData] = useState(null)
  /** 消费记录数组（用于"消费记录"标签页） */
  const [usage, setUsage] = useState([])
  /** 是否正在加载数据 */
  const [loading, setLoading] = useState(false)
  /** 错误信息 */
  const [error, setError] = useState('')
  /** 当前激活的子标签页: overview | daily | users | types | records */
  const [tab, setTab] = useState('overview')
  /** 消费记录当前页码 */
  const [recordPage, setRecordPage] = useState(1)
  /** 消费记录总数（用于分页） */
  const [recordTotal, setRecordTotal] = useState(0)
  /** 消费记录筛选条件: { type, userId, dateFrom, dateTo } */
  const [recordFilter, setRecordFilter] = useState({ type: '', userId: '', dateFrom: '', dateTo: '' })
  /** 模型调用日志（token_usage_logs） */
  const [modelLogs, setModelLogs] = useState([])
  const [modelLogsTotal, setModelLogsTotal] = useState(0)
  const [modelLogsPage, setModelLogsPage] = useState(1)
  const [modelLogsByType, setModelLogsByType] = useState([])
  const [modelLogFilter, setModelLogFilter] = useState({ requestType: '' })
  const [typeMeta, setTypeMeta] = useState(TOKEN_USAGE_TYPE_META)
  const [registry, setRegistry] = useState(null)
  const [usageGuide, setUsageGuide] = useState(null)
  const [expandedRecordId, setExpandedRecordId] = useState(null)
  const [unified, setUnified] = useState([])
  const [unifiedTotal, setUnifiedTotal] = useState(0)
  const [unifiedPage, setUnifiedPage] = useState(1)
  const [aiReport, setAiReport] = useState('')
  const [aiReportGeneratedAt, setAiReportGeneratedAt] = useState(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const aiAnalyzeDays = 14
  const aiReportContextKey = `days:${aiAnalyzeDays}`

  /**
   * 获取总览数据（首次加载和刷新时调用）
   * 调用 /api/admin/token-usage 获取统计信息（totals/today/byUser/byType/daily）和最近50条记录
   */
  const fetchRegistry = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/token-usage/registry')
      const json = await res.json()
      setRegistry(json)
      setUsageGuide(json.guide || null)
      setTypeMeta(buildTypeMeta(json.types || []))
    } catch (e) { console.error(e) }
  }, [adminFetch])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await fetchRegistry()
      const res = await adminFetch('/api/admin/token-usage?limit=50&page=1')
      const json = await res.json()
      setData(json.stats)
      setUsage(json.records || [])
      setRecordTotal(json.total || 0)
    } catch (e) {
      console.error(e)
      setError(e.message || '获取用量统计失败')
    }
    setLoading(false)
  }, [adminFetch, fetchRegistry])

  /**
   * 获取消费记录（支持分页和筛选）
   * @param {number} page - 页码，从1开始
   * @param {Object} filters - 筛选条件对象 { type, userId, dateFrom, dateTo }
   */
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

  const fetchModelLogs = useCallback(async (page = 1, filters = modelLogFilter) => {
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filters.requestType) params.set('requestType', filters.requestType)
      const res = await adminFetch(`/api/admin/token-usage-logs?${params}`)
      const json = await res.json()
      setModelLogs(json.records || [])
      setModelLogsTotal(json.total || 0)
      setModelLogsByType(json.byType || [])
      setModelLogsPage(page)
    } catch (e) { console.error(e) }
  }, [adminFetch, modelLogFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (tab !== 'ai_insights') return
    let cancelled = false
    adminFetch(`/api/admin/ai-reports/latest?scope=token_ai_analyze&contextKey=${encodeURIComponent(aiReportContextKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.markdown) {
          setAiReport(j.markdown)
          setAiReportGeneratedAt(j.generatedAt || null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [adminFetch, tab, aiReportContextKey])
  const fetchUnified = useCallback(async (page = 1) => {
    try {
      const res = await adminFetch(`/api/admin/token-usage/unified?page=${page}&limit=50`)
      const json = await res.json()
      setUnified(json.records || [])
      setUnifiedTotal(json.total || 0)
      setUnifiedPage(page)
    } catch (e) { console.error(e) }
  }, [adminFetch])

  const runAiAnalyze = useCallback(async () => {
    setAiAnalyzing(true)
    try {
      const res = await adminFetch('/api/admin/token-usage/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: aiAnalyzeDays }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiReport(json.markdown || '')
      setAiReportGeneratedAt(json.generatedAt || new Date().toISOString())
      fetchData()
    } catch (e) {
      console.error('AI analyze failed:', e.message)
    }
    setAiAnalyzing(false)
  }, [adminFetch, fetchData, aiAnalyzeDays])

  useEffect(() => {
    if (tab === 'model_logs') fetchModelLogs(1)
    if (tab === 'unified') fetchUnified(1)
  }, [tab, fetchModelLogs, fetchUnified])

  if (loading && !data) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载中...</div>
  if (error && !data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-red-400 text-sm">{error}</div>
      <button onClick={fetchData} className="text-xs text-purple-600 hover:text-purple-800 px-4 py-2 rounded-xl hover:bg-purple-50 border border-purple-100 transition-colors">重试</button>
    </div>
  )
  if (!data) return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">暂无Token数据</div>

  const t = data.totals || {}
  const td = data.today || {}
  const sys = data.systemUsage || {}
  const logT = data.logsTotals || {}

  const officialInputCost = (parseFloat(t.total_input || 0) / 1000 * AI_PRICING.input)
  const officialOutputCost = (parseFloat(t.total_output || 0) / 1000 * AI_PRICING.output)
  const officialTotal = isNaN(officialInputCost) || isNaN(officialOutputCost) ? 0 : officialInputCost + officialOutputCost

  const SUB_TABS = [
    { key: 'overview', label: '总览' },
    { key: 'guide', label: '使用指南' },
    { key: 'coverage', label: '功能覆盖' },
    { key: 'unified', label: '全部流水' },
    { key: 'types', label: '功能分类' },
    { key: 'records', label: '详细明细' },
    { key: 'model_logs', label: '模型日志' },
    { key: 'ai_insights', label: 'AI 监管' },
    { key: 'ai-chat', label: 'AI对话' },
    { key: 'daily', label: '每日趋势' },
    { key: 'users', label: '用户明细' },
  ]

  const coverage = registry?.coverage
  const registeredIds = new Set((registry?.types || []).map(t => t.id))
  const billingMap = Object.fromEntries((coverage?.billingTypes || []).map(r => [r.type, r]))
  const logsMap = Object.fromEntries((coverage?.logTypes || []).map(r => [r.type, r]))
  const allFeatureIds = [...new Set([
    ...(registry?.types || []).map(t => t.id),
    ...(coverage?.billingTypes || []).map(r => r.type),
    ...(coverage?.logTypes || []).map(r => r.type),
  ])]

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

      {tab === 'ai-chat' && (
        <AdminAiChat
          module="tokens"
          adminFetch={adminFetch}
          showToast={showToast}
          onRefresh={fetchData}
          loading={loading}
          compact={false}
        />
      )}

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
          {(logT.total_requests > 0 || registry?.types?.length) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="模型调用日志" value={fmt(logT.total_requests)} sub={`输入${fmt(logT.total_input)} 输出${fmt(logT.total_output)}`} color="from-slate-500 to-slate-600" />
              <StatCard label="日志总Token" value={fmt(logT.total_tokens)} sub="含流式/仅日志侧记录" color="from-gray-500 to-zinc-600" />
              <StatCard label="已登记 AI 功能" value={String(registry?.types?.length || 0)} sub="功能覆盖 Tab 可核对" color="from-indigo-500 to-indigo-600" />
              <StatCard label="计费+日志类型" value={String(allFeatureIds.length)} sub="合并去重后的功能数" color="from-cyan-500 to-teal-600" />
            </div>
          )}

          {/* Profit Analysis + IO Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Profit breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">💰 盈亏分析（用户付费 − AI 成本）</h3>
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

      {tab === 'guide' && usageGuide && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Token 如何记账</h3>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4 mb-4">
              {(usageGuide.billing?.flow || []).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {(usageGuide.billing?.tables || []).map((tbl) => (
                <div key={tbl.name} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs font-semibold text-gray-800">{tbl.label}</div>
                  <div className="text-[10px] font-mono text-purple-600 mt-1">{tbl.name}</div>
                  <p className="text-[10px] text-gray-500 mt-1">{tbl.fields}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400">
              用户参考价：{usageGuide.billing?.pricing?.userReference} · 日志估算：{usageGuide.billing?.pricing?.logCostYuan}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">各功能在哪里用、怎么计费</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {(usageGuide.types || []).map((item) => (
                <div key={item.id} className="p-3 rounded-xl border border-gray-100 hover:border-purple-100">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">{item.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{item.id}</span>
                        <span className="text-[9px] text-gray-400">{item.categoryLabel}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.scope === 'system' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-700'}`}>
                          {item.scope === 'system' ? '系统' : '用户'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{item.desc}</p>
                      {item.trigger && (
                        <div className="mt-2 text-[10px] text-gray-600 space-y-0.5">
                          <p><span className="text-gray-400">使用场景：</span>{item.trigger.where}</p>
                          <p className="font-mono text-[9px] text-purple-600 break-all">{item.trigger.path}</p>
                          <p><span className="text-gray-400">计费：</span>{item.trigger.billing}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">全站 AI 功能覆盖清单</h3>
            <p className="text-[10px] text-gray-400 mb-4">
              已登记 {registry?.types?.length || 0} 项 · 计费表 {coverage?.billingRecordCount || 0} 条 · 模型日志 {coverage?.logRecordCount || 0} 条。
              新增 AI 功能请在 server/ai/usageRegistry.js 登记并调用 trackAIUsage。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">功能</th>
                    <th className="text-center py-2 font-medium">登记</th>
                    <th className="text-right py-2 font-medium">计费次数</th>
                    <th className="text-right py-2 font-medium">计费Token</th>
                    <th className="text-right py-2 font-medium">日志次数</th>
                    <th className="text-right py-2 font-medium">日志Token</th>
                  </tr>
                </thead>
                <tbody>
                  {allFeatureIds.map((fid) => {
                    const meta = typeMeta[fid] || getLocalTypeMeta(fid)
                    const b = billingMap[fid]
                    const l = logsMap[fid]
                    const registered = registeredIds.has(fid)
                    const hasActivity = b || l
                    return (
                      <tr key={fid} className={`border-b border-gray-50 ${!registered ? 'bg-amber-50/40' : !hasActivity ? 'opacity-60' : ''}`}>
                        <td className="py-2 pr-2">
                          <div className="font-medium text-gray-800">{meta.icon} {meta.label}</div>
                          <div className="text-[9px] text-gray-400 font-mono">{fid}</div>
                        </td>
                        <td className="py-2 text-center">{registered ? '✅' : '⚠️'}</td>
                        <td className="py-2 text-right">{b ? fmt(b.cnt) : '-'}</td>
                        <td className="py-2 text-right font-medium">{b ? fmt(b.tokens) : '-'}</td>
                        <td className="py-2 text-right">{l ? fmt(l.cnt) : '-'}</td>
                        <td className="py-2 text-right">{l ? fmt(l.tokens) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'unified' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] text-gray-400 mb-3">合并计费明细与模型日志（近 3 秒内同类型同 Token 的双写会自动去重）。</p>
            {unified.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-1.5">时间</th>
                      <th className="text-left py-1.5">来源</th>
                      <th className="text-left py-1.5">功能</th>
                      <th className="text-left py-1.5">用户</th>
                      <th className="text-right py-1.5">输入</th>
                      <th className="text-right py-1.5">输出</th>
                      <th className="text-right py-1.5">总计</th>
                      <th className="text-right py-1.5">费用</th>
                      <th className="text-left py-1.5 max-w-[120px]">操作说明</th>
                      <th className="text-left py-1.5">模型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unified.map((r, i) => (
                      <tr key={`${r.source}-${r.id}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 text-gray-500 whitespace-nowrap">{fmtTime(r.created_at)}</td>
                        <td className="py-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${r.source === 'billing' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.source === 'billing' ? '明细' : '日志'}
                          </span>
                        </td>
                        <td className="py-1.5">{getTokenTypeLabel(r.feature_type, typeMeta)}</td>
                        <td className="py-1.5 text-gray-600">{r.user_id === 0 ? '🤖系统' : (r.nickname || `#${r.user_id}`)}</td>
                        <td className="py-1.5 text-right text-blue-600">{fmt(r.input_tokens)}</td>
                        <td className="py-1.5 text-right text-amber-600">{fmt(r.output_tokens)}</td>
                        <td className="py-1.5 text-right font-semibold">{fmt(r.total_tokens)}</td>
                        <td className="py-1.5 text-right text-orange-600">{fmtCost(r.cost)}</td>
                        <td className="py-1.5 text-[10px] text-gray-600 max-w-[120px] truncate" title={r.detail_summary}>{r.detail_summary || '—'}</td>
                        <td className="py-1.5 text-[9px] text-gray-400 font-mono">{r.model_name || r.provider || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">暂无流水</div>
            )}
            {unifiedTotal > 50 && (
              <div className="flex justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">第 {unifiedPage} 页</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => fetchUnified(unifiedPage - 1)} disabled={unifiedPage <= 1} className="px-2.5 py-1 text-xs rounded-lg disabled:text-gray-300">上一页</button>
                  <button type="button" onClick={() => fetchUnified(unifiedPage + 1)} disabled={unifiedPage >= Math.ceil(unifiedTotal / 50)} className="px-2.5 py-1 text-xs rounded-lg disabled:text-gray-300">下一页</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'ai_insights' && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4">
            <h3 className="text-sm font-bold text-purple-900 mb-1">AI 监管分析</h3>
            <p className="text-xs text-purple-700/80 mb-3">由当前激活模型分析全站 Token 消耗、功能分布、漏记风险与优化建议。分析本身也会记入系统消耗。</p>
            <button type="button" onClick={runAiAnalyze} disabled={aiAnalyzing}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
              {aiAnalyzing ? '分析中…' : (aiReport ? '重新生成监管报告' : '生成监管报告')}
            </button>
          </div>
          {aiReport && !aiReport.startsWith('分析失败：') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <AdminMarkdown text={aiReport} generatedAt={aiReportGeneratedAt} className="text-xs" />
            </div>
          )}
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
            <h3 className="text-xs font-semibold text-gray-700 mb-3">按功能分类 · 计费明细 + 模型日志</h3>
            {allFeatureIds.length > 0 ? (() => {
              const billingByType = Object.fromEntries((data.byType || []).map(x => [x.type, x]))
              const logsByTypeMap = Object.fromEntries((data.logsByType || []).map(x => [x.type, x]))
              const rows = allFeatureIds.map((type) => {
                const b = billingByType[type]
                const l = logsByTypeMap[type]
                const tokens = Math.max(parseInt(b?.tokens || 0, 10), parseInt(l?.tokens || 0, 10))
                const inp = parseInt(b?.input_tokens || 0, 10) + parseInt(l?.input_tokens || 0, 10)
                const out = parseInt(b?.output_tokens || 0, 10) + parseInt(l?.output_tokens || 0, 10)
                const cnt = parseInt(b?.cnt || 0, 10) + parseInt(l?.cnt || 0, 10)
                return { type, tokens: tokens || inp + out, inp, out, cnt, b, l }
              }).filter(r => r.tokens > 0 || r.cnt > 0).sort((a, b) => b.tokens - a.tokens)
              const displayRows = rows.length ? rows : allFeatureIds.map(type => ({ type, tokens: 0, inp: 0, out: 0, cnt: 0 }))
              const maxTokens = Math.max(...displayRows.map(x => x.tokens), 1)
              return (
                <div className="space-y-3">
                  {displayRows.map((item) => {
                    const meta = typeMeta[item.type] || getLocalTypeMeta(item.type)
                    const tokens = item.tokens
                    const inp = item.inp
                    const out = item.out
                    const oc = (inp / 1000 * 0.001) + (out / 1000 * 0.002)
                    const pct = (tokens / maxTokens * 100).toFixed(0)
                    return (
                      <div key={item.type} className={`p-3 rounded-xl border transition-colors ${tokens ? 'border-gray-100 hover:border-gray-200' : 'border-dashed border-gray-200 opacity-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800">{meta.label}</span>
                              <span className="text-[10px] text-gray-400">{fmt(item.cnt)}次 · 计费{item.b ? fmt(item.b.cnt) : 0} 日志{item.l ? fmt(item.l.cnt) : 0}</span>
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
                {Object.entries(typeMeta).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
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
            <p className="text-[10px] text-gray-400 mb-3">计费明细。点击行可展开完整说明与 context_json。</p>
            {usage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-1.5 w-6" />
                      <th className="text-left py-1.5 pr-1 font-medium">时间</th>
                      <th className="text-left py-1.5 px-1 font-medium">用户</th>
                      <th className="text-left py-1.5 px-1 font-medium">类型</th>
                      <th className="text-left py-1.5 px-1 font-medium">操作说明</th>
                      <th className="text-right py-1.5 px-1 font-medium">输入</th>
                      <th className="text-right py-1.5 px-1 font-medium">输出</th>
                      <th className="text-right py-1.5 px-1 font-medium">总计</th>
                      <th className="text-right py-1.5 px-1 font-medium">消费</th>
                      <th className="text-right py-1.5 pl-1 font-medium">模式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((r) => {
                      const rowKey = `b-${r.id}`
                      const expanded = expandedRecordId === rowKey
                      const summary = r.detail_summary || (typeMeta[r.type] || getLocalTypeMeta(r.type)).desc
                      return (
                        <React.Fragment key={rowKey}>
                        <tr
                          className={`border-b border-gray-50/50 hover:bg-gray-50/30 cursor-pointer ${expanded ? 'bg-purple-50/40' : ''}`}
                          onClick={() => setExpandedRecordId(expanded ? null : rowKey)}
                        >
                          <td className="py-1.5 text-gray-400 text-[10px]">{expanded ? '▼' : '▶'}</td>
                          <td className="py-1.5 pr-1 text-gray-500 whitespace-nowrap" title={fmtFullTime(r.created_at)}>{fmtTime(r.created_at)}</td>
                          <td className="py-1.5 px-1">
                            <div className="text-gray-700 font-medium">{r.nickname || (r.user_id === 0 ? '🤖系统' : `#${r.user_id}`)}</div>
                            {r.phone && <div className="text-[9px] text-gray-400">{r.phone}</div>}
                          </td>
                          <td className="py-1.5 px-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.user_id === 0 || r.type?.startsWith('evolution') || r.type?.startsWith('auto_') ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                              {getTokenTypeLabel(r.type, typeMeta)}
                            </span>
                          </td>
                          <td className="py-1.5 px-1 text-gray-600 max-w-[160px] truncate" title={summary}>{summary || '—'}</td>
                          <td className="py-1.5 px-1 text-right text-blue-600">{fmt(r.input_tokens)}</td>
                          <td className="py-1.5 px-1 text-right text-amber-600">{fmt(r.output_tokens)}</td>
                          <td className="py-1.5 px-1 text-right font-medium text-gray-700">{fmt(r.total_tokens)}</td>
                          <td className="py-1.5 px-1 text-right text-orange-600">{fmtCost(r.cost)}</td>
                          <td className="py-1.5 pl-1 text-right">
                            <span className={`text-[9px] px-1 py-0.5 rounded ${r.api_mode === 'official' ? 'bg-green-50 text-green-600' : r.api_mode === 'free' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                              {r.api_mode === 'official' ? '官方' : r.api_mode === 'free' ? '免费' : r.api_mode || '-'}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50/90 border-b border-gray-100">
                            <td colSpan={10} className="px-3 py-2">
                              <DetailBlock id={r.id} summary={r.detail_summary} contextJson={r.context_json} />
                              <p className="text-[9px] text-gray-400 font-mono mt-1">会话 {r.session_id || '—'} · 倍率 ×{r.multiplier} · ID #{r.id}</p>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
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

      {tab === 'model_logs' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-3">来自 token_usage_logs，含流式申诉、文案等非用户明细的模型侧记录。</p>
            {modelLogsByType.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {modelLogsByType.map((row) => (
                  <button
                    key={row.request_type}
                    type="button"
                    onClick={() => {
                      const f = { requestType: row.request_type }
                      setModelLogFilter(f)
                      fetchModelLogs(1, f)
                    }}
                    className={`text-[10px] px-2 py-1 rounded-lg border ${modelLogFilter.requestType === row.request_type ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}
                  >
                    {getTokenTypeLabel(row.request_type, typeMeta)} · {fmt(row.tokens)} tok
                  </button>
                ))}
                {modelLogFilter.requestType && (
                  <button type="button" onClick={() => { setModelLogFilter({ requestType: '' }); fetchModelLogs(1, { requestType: '' }) }}
                    className="text-[10px] text-red-500 px-2 py-1">清除</button>
                )}
              </div>
            )}
            {modelLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left py-1.5 font-medium">时间</th>
                      <th className="text-left py-1.5 font-medium">类型</th>
                      <th className="text-left py-1.5 font-medium">供应商</th>
                      <th className="text-left py-1.5 font-medium">模型</th>
                      <th className="text-right py-1.5 font-medium">输入</th>
                      <th className="text-right py-1.5 font-medium">输出</th>
                      <th className="text-right py-1.5 font-medium">总计</th>
                      <th className="text-right py-1.5 font-medium">估算成本</th>
                      <th className="text-left py-1.5 font-medium">操作说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelLogs.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50/50 hover:bg-gray-50/30">
                        <td className="py-1.5 text-gray-500 whitespace-nowrap" title={fmtFullTime(r.created_at)}>{fmtTime(r.created_at)}</td>
                        <td className="py-1.5">{getTokenTypeLabel(r.request_type, typeMeta)}</td>
                        <td className="py-1.5 text-gray-600">{r.provider || '-'}</td>
                        <td className="py-1.5 text-gray-600 font-mono text-[9px]">{r.model_name || '-'}</td>
                        <td className="py-1.5 text-right text-blue-600">{fmt(r.prompt_tokens)}</td>
                        <td className="py-1.5 text-right text-amber-600">{fmt(r.completion_tokens)}</td>
                        <td className="py-1.5 text-right font-medium">{fmt(r.total_tokens)}</td>
                        <td className="py-1.5 text-right text-purple-600">¥{parseFloat(r.cost_yuan || 0).toFixed(6)}</td>
                        <td className="py-1.5 text-[10px] text-gray-600 max-w-[140px] truncate" title={r.detail_summary}>{r.detail_summary || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">暂无模型调用日志</div>
            )}
            {modelLogsTotal > 50 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">第 {modelLogsPage} 页 / 共 {Math.ceil(modelLogsTotal / 50)} 页</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => fetchModelLogs(modelLogsPage - 1)} disabled={modelLogsPage <= 1}
                    className={`px-2.5 py-1 text-xs rounded-lg ${modelLogsPage <= 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>上一页</button>
                  <button type="button" onClick={() => fetchModelLogs(modelLogsPage + 1)} disabled={modelLogsPage >= Math.ceil(modelLogsTotal / 50)}
                    className={`px-2.5 py-1 text-xs rounded-lg ${modelLogsPage >= Math.ceil(modelLogsTotal / 50) ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>下一页</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 统计卡片组件（渐变色背景，白色文字）
 *
 * @param {Object} props
 * @param {string} props.label - 标签文字（如"总请求数"）
 * @param {string} props.value - 主要数值（已格式化）
 * @param {string} props.sub - 辅助说明（如"今日 xxx"）
 * @param {string} props.color - Tailwind 渐变色类名（如"from-blue-500 to-blue-600"）
 * @returns {JSX.Element} 统计卡片
 */
function StatCard({ label, value, sub, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 text-white`} style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
      <p className="text-white/70 text-[11px] font-medium">{label}</p>
      <p className="text-xl font-bold mt-0.5 tracking-tight">{value}</p>
      <p className="text-white/50 text-[10px] mt-1">{sub}</p>
    </div>
  )
}
