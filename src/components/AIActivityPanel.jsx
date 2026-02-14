import React, { useState, useEffect, useCallback } from 'react'

const CATEGORY_ICONS = {
  bargain: '💰', persona: '🎭', risk: '🔍', card: '📇', product: '📦',
  chat: '💬', analysis: '📊', optimize: '✨', general: '🤖',
}
const CATEGORY_LABELS = {
  bargain: '砍价', persona: '人设', risk: '风险评估', card: '名片',
  product: '商品', chat: '对话', analysis: '分析', optimize: '优化', general: '通用',
}
const STATUS_COLORS = { success: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700' }

export default function AIActivityPanel({ adminFetch }) {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (logs.length === 0) setLoading(true)
    try {
      const url = `/api/admin/ai-activity?limit=60${filter ? `&category=${filter}` : ''}`
      const data = await (await adminFetch(url)).json()
      setLogs(data.logs || [])
      setStats(data.stats || {})
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch, filter, logs.length])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchLogs, 10000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  function fmtTime(d) {
    if (!d) return ''
    try {
      const t = new Date(d)
      const now = new Date()
      const diff = (now - t) / 1000
      if (diff < 60) return `${Math.round(diff)}秒前`
      if (diff < 3600) return `${Math.round(diff / 60)}分钟前`
      if (diff < 86400) return `${Math.round(diff / 3600)}小时前`
      return t.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]

  return (
    <div className="h-full flex flex-col">
      {/* 统计卡片 */}
      <div className="px-4 lg:px-6 pt-4 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
            <div className="text-[10px] text-blue-500 font-medium">总操作</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{stats.total || 0}</div>
            <div className="text-[10px] text-blue-400 mt-1">24h: {stats.last_24h || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-100">
            <div className="text-[10px] text-green-500 font-medium">成功率</div>
            <div className="text-xl font-bold text-green-700 mt-0.5">
              {stats.total ? Math.round((stats.success_count / stats.total) * 100) : 0}%
            </div>
            <div className="text-[10px] text-green-400 mt-1">成功 {stats.success_count || 0} / 失败 {stats.failed_count || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
            <div className="text-[10px] text-amber-500 font-medium">Token消耗</div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{((stats.total_tokens || 0) / 1000).toFixed(1)}k</div>
            <div className="text-[10px] text-amber-400 mt-1">24h: {((stats.tokens_24h || 0) / 1000).toFixed(1)}k</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
            <div className="text-[10px] text-purple-500 font-medium">总费用</div>
            <div className="text-xl font-bold text-purple-700 mt-0.5">¥{parseFloat(stats.total_cost || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="px-4 lg:px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c === 'all' ? null : c)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
              (c === 'all' && !filter) || filter === c
                ? 'bg-gray-800 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {c === 'all' ? '🤖 全部' : `${CATEGORY_ICONS[c] || '📋'} ${CATEGORY_LABELS[c] || c}`}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-2 py-1 rounded-lg text-[10px] font-medium ${autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {autoRefresh ? '⟳ 自动刷新' : '⏸ 已暂停'}
        </button>
        <button onClick={fetchLogs} disabled={loading}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200">
          {loading ? '...' : '刷新'}
        </button>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 gpu-scroll">
        {logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-3xl mb-2">🤖</div>
            <p className="text-sm">暂无AI活动记录</p>
            <p className="text-xs mt-1 text-gray-300">AI执行操作后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-white rounded-xl border border-gray-100 px-3.5 py-3 hover:border-gray-200 transition-all group relative overflow-hidden">
                <div className="risk-indicator-bar" style={{ background: log.status === 'failed' ? '#ef4444' : log.status === 'pending' ? '#f59e0b' : '#22c55e', opacity: 0.5 }} />
                <div className="flex items-start gap-3 pl-1.5">
                  <div className="text-lg flex-shrink-0 mt-0.5">{CATEGORY_ICONS[log.category] || '🤖'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-gray-800">{log.action}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status] || STATUS_COLORS.success}`}>
                        {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '进行中'}
                      </span>
                      {log.duration_ms > 0 && (
                        <span className="text-[10px] text-gray-300">{(log.duration_ms / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    {log.detail && <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{log.detail}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-gray-300">{fmtTime(log.created_at)}</span>
                      {log.tokens_used > 0 && <span className="text-[10px] text-amber-400">🔥 {log.tokens_used} tokens</span>}
                      {parseFloat(log.cost) > 0 && <span className="text-[10px] text-purple-400">¥{parseFloat(log.cost).toFixed(4)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
