import React, { useState, useEffect, useCallback } from 'react'

const TYPE_LABELS = {
  recharge: '充值',
  deduct: '扣费',
  refund: '退款',
  adjust: '调整',
}

export default function AuditLogPanel({ adminFetch, showToast }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [type, setType] = useState('')

  const fetchLog = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (userId.trim()) params.set('userId', userId.trim())
      if (type) params.set('type', type)
      const data = await (await adminFetch(`/api/admin/audit/log?${params}`)).json()
      setRows(data.data || [])
      setTotal(data.total || 0)
    } catch (e) {
      showToast?.('加载失败: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, page, pageSize, userId, type, showToast])

  useEffect(() => { fetchLog(page) }, [page])

  const fmtTime = (t) => {
    if (!t) return '-'
    try { return new Date(t).toLocaleString('zh-CN') } catch { return String(t) }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-800">资金流水</h2>
        <p className="text-xs text-gray-400 mt-0.5">financial_audit 表记录，用于充值与余额变动审计</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="用户 ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg w-28"
        />
        <select value={type} onChange={e => setType(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
          <option value="">全部类型</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setPage(1); fetchLog(1) }}
          className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-medium"
        >
          查询
        </button>
        <button type="button" onClick={() => fetchLog(page)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg">
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-300 text-sm">暂无记录</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-3 py-2.5 font-medium">时间</th>
                <th className="px-3 py-2.5 font-medium">用户</th>
                <th className="px-3 py-2.5 font-medium">类型</th>
                <th className="px-3 py-2.5 font-medium text-right">金额</th>
                <th className="px-3 py-2.5 font-medium text-right">余额后</th>
                <th className="px-3 py-2.5 font-medium">说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(r.created_at)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{r.user_id ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {TYPE_LABELS[r.type] || r.type || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                    {r.amount != null ? `¥${parseFloat(r.amount).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {r.balance_after != null ? `¥${parseFloat(r.balance_after).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-xs truncate" title={r.description || r.remark || ''}>
                    {r.description || r.remark || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>共 {total} 条，第 {page}/{Math.ceil(total / pageSize)} 页</span>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">上一页</button>
            <button type="button" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
