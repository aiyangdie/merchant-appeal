import React, { useState, useEffect } from 'react'

const TYPE_LABELS = {
  chat: '对话',
  chat_local: '信息收集',
  chat_qa: '智能答疑',
  report: '报告生成',
  report_retry: '报告重试',
  appeal_text: '申诉文案',
  deep_analysis: '深度分析',
}

export default function UserCenter({ user, onClose, onRecharge, getAuthHeaders }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('usage')

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${user.id}/usage`, { headers: getAuthHeaders() })
      const d = await res.json()
      setData(d)
    } catch {}
    finally { setLoading(false) }
  }

  function fmtTime(d) {
    if (!d) return ''
    try { const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }

  function fmtCost(c) {
    return parseFloat(c || 0).toFixed(4)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[6px]">
        <div className="bg-white rounded-2xl p-8 text-center">
          <svg className="w-8 h-8 mx-auto animate-spin text-gray-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <p className="text-sm text-gray-400 mt-2">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[6px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#07C160] to-[#059669] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">{user?.nickname || '用户中心'}</h2>
              <p className="text-[10px] text-gray-400">{user?.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Balance Card */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#07C160]/5 to-[#059669]/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">账户余额</p>
              <p className="text-2xl font-bold text-gray-900">¥{parseFloat(data?.balance || 0).toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 mb-0.5">累计消费</p>
              <p className="text-lg font-semibold text-gray-600">¥{parseFloat(data?.totalSpent || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 bg-white/80 rounded-lg px-3 py-1.5 text-center">
              <p className="text-[10px] text-gray-400">今日请求</p>
              <p className="text-sm font-semibold text-gray-700">{data?.stats?.today?.requests || 0}次</p>
            </div>
            <div className="flex-1 bg-white/80 rounded-lg px-3 py-1.5 text-center">
              <p className="text-[10px] text-gray-400">今日消费</p>
              <p className="text-sm font-semibold text-gray-700">¥{fmtCost(data?.stats?.today?.cost)}</p>
            </div>
            <div className="flex-1 bg-white/80 rounded-lg px-3 py-1.5 text-center">
              <p className="text-[10px] text-gray-400">今日Token</p>
              <p className="text-sm font-semibold text-gray-700">{(data?.stats?.today?.tokens || 0).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onRecharge}
            className="mt-3 w-full py-2 bg-gradient-to-r from-[#07C160] to-[#059669] text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-md transition-all">
            充值
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setTab('usage')}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${tab === 'usage' ? 'text-[#07C160] border-b-2 border-[#07C160]' : 'text-gray-400'}`}>
            消费明细
          </button>
          <button onClick={() => setTab('recharge')}
            className={`flex-1 py-2.5 text-xs font-medium transition-all ${tab === 'recharge' ? 'text-[#07C160] border-b-2 border-[#07C160]' : 'text-gray-400'}`}>
            充值记录
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'usage' ? (
            <div className="px-4 py-3">
              {(!data?.usage || data.usage.length === 0) ? (
                <p className="text-center text-xs text-gray-400 py-10">暂无消费记录</p>
              ) : (
                <div className="space-y-1.5">
                  {data.usage.map(u => (
                    <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            u.type === 'appeal_text' ? 'bg-orange-50 text-orange-600' :
                            u.type === 'report' || u.type === 'report_retry' ? 'bg-purple-50 text-purple-600' :
                            u.type === 'deep_analysis' ? 'bg-blue-50 text-blue-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{TYPE_LABELS[u.type] || u.type}</span>
                          <span className="text-[10px] text-gray-300">{fmtTime(u.created_at)}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          输入{(u.input_tokens || 0).toLocaleString()} + 输出{(u.output_tokens || 0).toLocaleString()} = {(u.total_tokens || 0).toLocaleString()} tokens
                        </div>
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${parseFloat(u.cost || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {parseFloat(u.cost || 0) > 0 ? `-¥${fmtCost(u.cost)}` : '免费'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-3">
              {(!data?.rechargeOrders || data.rechargeOrders.length === 0) ? (
                <p className="text-center text-xs text-gray-400 py-10">暂无充值记录</p>
              ) : (
                <div className="space-y-1.5">
                  {data.rechargeOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            o.status === 'confirmed' ? 'bg-green-50 text-green-600' :
                            o.status === 'rejected' ? 'bg-red-50 text-red-500' :
                            'bg-yellow-50 text-yellow-600'
                          }`}>{o.status === 'confirmed' ? '已到账' : o.status === 'rejected' ? '已拒绝' : '待确认'}</span>
                          <span className="text-[10px] text-gray-300">{fmtTime(o.created_at)}</span>
                        </div>
                        {o.admin_note && <p className="text-[10px] text-gray-400 mt-0.5">{o.admin_note}</p>}
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${o.status === 'confirmed' ? 'text-green-600' : 'text-gray-400'}`}>
                        +¥{parseFloat(o.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
