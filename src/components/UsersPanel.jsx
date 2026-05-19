/**
 * @fileoverview 用户管理面板（管理员专用）
 * 提供用户列表查看、搜索、余额调整和删除功能
 *
 * 核心功能：
 *   - 统计概览：总用户数、总余额、总消费、总消息数
 *   - 用户列表：支持按手机号/昵称/ID 搜索
 *   - 余额调整：弹窗支持增加或扣减用户余额
 *   - 用户删除：确认后永久删除用户（不可恢复）
 *
 * 关键依赖：
 *   - adminFetch: 带认证的 fetch 函数
 *   - showToast: 全局 Toast 通知函数
 *   - 后端接口: GET /api/admin/users, DELETE /api/admin/users/:id, POST /api/admin/users/:id/balance,
 *               POST /api/admin/users/ai-command, POST /api/admin/users/ai-command/confirm-delete
 *
 * 注意事项：
 *   - 删除操作有二次确认弹窗
 *   - 余额调整支持增加（add）和扣减（deduct）两种类型
 *   - 手机号显示脱敏版本（phone_masked）
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import UsersAiChat from './UsersAiChat.jsx'

/**
 * 用户管理面板（管理员专用）
 *
 * @param {Object} props
 * @param {Function} props.adminFetch - 带管理员认证的 fetch 函数
 * @param {Function} props.showToast - 全局 Toast 通知函数
 * @returns {JSX.Element} 用户管理面板 UI
 */
export default function UsersPanel({ adminFetch, showToast }) {
  /** 当前子 Tab：list | ai-chat */
  const [tab, setTab] = useState('list')
  /** 用户列表数组 */
  const [users, setUsers] = useState([])
  /** 是否正在加载数据 */
  const [loading, setLoading] = useState(false)
  /** 搜索关键词（手机号/昵称/ID） */
  const [search, setSearch] = useState('')
  /** 余额调整弹窗的目标用户对象，null 表示未打开 */
  const [balanceModal, setBalanceModal] = useState(null)
  /** 余额调整金额输入值 */
  const [balanceAmount, setBalanceAmount] = useState('')
  /** 余额调整类型: 'add'（增加）| 'deduct'（扣减） */
  const [balanceType, setBalanceType] = useState('add')
  const showToastRef = useRef(showToast)
  const adminFetchRef = useRef(adminFetch)
  const fetchInFlightRef = useRef(false)
  const didInitialLoadRef = useRef(false)

  useEffect(() => {
    showToastRef.current = showToast
    adminFetchRef.current = adminFetch
  }, [showToast, adminFetch])

  /**
   * 获取用户列表（手动刷新 / 操作后静默刷新）
   * @param {{ silent?: boolean }} [opts] silent 时不切换按钮 loading
   */
  const fetchUsers = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (fetchInFlightRef.current) return
    fetchInFlightRef.current = true
    if (!silent) setLoading(true)
    try {
      const res = await adminFetchRef.current('/api/admin/users')
      const data = await res.json()
      setUsers(data.users || data || [])
    } catch (e) {
      console.error(e)
      showToastRef.current?.('获取用户列表失败')
    } finally {
      fetchInFlightRef.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  // 进入用户管理 Tab 时仅加载一次（不依赖 adminFetch 引用，避免父组件重渲染触发循环）
  useEffect(() => {
    if (didInitialLoadRef.current) return
    didInitialLoadRef.current = true
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-once
  }, [])

  /**
   * 删除用户
   * 有二次确认弹窗，删除后不可恢复
   * @param {number|string} userId - 要删除的用户 ID
   */
  const handleDeleteUser = async (userId) => {
    if (!confirm('确认删除该用户？此操作不可恢复！')) return
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success || data.message) {
        showToast('用户已删除')
        fetchUsers({ silent: true })
      } else {
        showToast(data.error || '删除失败')
      }
    } catch { showToast('删除失败') }
  }

  /**
   * 调整用户余额
   * 通过弹窗输入金额和类型（增加/扣减），调用 POST /api/admin/users/:id/balance
   * 金额必须为正数，操作成功后刷新用户列表
   */
  const handleAdjustBalance = async () => {
    if (!balanceModal || !balanceAmount) return
    try {
      const amount = parseFloat(balanceAmount)
      if (isNaN(amount) || amount <= 0) { showToast('请输入有效金额'); return }
      const res = await adminFetch(`/api/admin/users/${balanceModal.id}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type: balanceType }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`余额${balanceType === 'add' ? '增加' : '扣减'}成功`)
        setBalanceModal(null)
        setBalanceAmount('')
        fetchUsers({ silent: true })
      } else {
        showToast(data.error || '操作失败')
      }
    } catch { showToast('操作失败') }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (u.phone || '').toLowerCase().includes(s) ||
           (u.nickname || '').toLowerCase().includes(s) ||
           String(u.id).includes(s)
  })

  const totalBalance = users.reduce((s, u) => s + parseFloat(u.balance || 0), 0)
  const totalSpent = users.reduce((s, u) => s + parseFloat(u.total_spent || 0), 0)
  const totalMessages = users.reduce((s, u) => s + (u.total_messages || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap border-b border-gray-100 pb-3">
        {[
          { k: 'list', l: '用户列表', i: '👥' },
          { k: 'ai-chat', l: 'AI对话', i: '🤖' },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {tab === 'ai-chat' && (
        <UsersAiChat
          adminFetch={adminFetch}
          showToast={showToast}
          onRefresh={() => fetchUsers({ silent: true })}
          loading={loading}
        />
      )}

      {tab === 'list' && (
      <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
          用户管理
        </h3>
        <button type="button" onClick={() => fetchUsers()} disabled={loading}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
          {loading ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : '🔄 刷新'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400 mb-1">总用户</div>
          <div className="text-2xl font-bold text-indigo-600">{users.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400 mb-1">总余额</div>
          <div className="text-2xl font-bold text-green-600">¥{totalBalance.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400 mb-1">总消费</div>
          <div className="text-2xl font-bold text-orange-600">¥{totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400 mb-1">总消息</div>
          <div className="text-2xl font-bold text-blue-600">{totalMessages.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="搜索手机号/昵称/ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">手机号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">昵称</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">余额</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">总消费</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">消息数</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">登录次数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">最后活跃</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">{loading ? '加载中...' : '暂无用户数据'}</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{u.phone_masked || u.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.nickname || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-600">¥{parseFloat(u.balance || 0).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">¥{parseFloat(u.total_spent || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{u.total_messages || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{u.login_count || 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => { setBalanceModal(u); setBalanceAmount(''); setBalanceType('add') }}
                        className="px-2 py-1 text-[10px] font-medium bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors">
                        充值
                      </button>
                      <button type="button" onClick={() => { setBalanceModal(u); setBalanceAmount(''); setBalanceType('deduct') }}
                        className="px-2 py-1 text-[10px] font-medium bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors">
                        扣款
                      </button>
                      <button type="button" onClick={() => handleDeleteUser(u.id)}
                        className="px-2 py-1 text-[10px] font-medium bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>
      )}

      {balanceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setBalanceModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h4 className="text-base font-bold text-gray-800 mb-4">调整余额 — 用户 #{balanceModal.id}</h4>
            <div className="mb-3 text-sm text-gray-500">
              当前余额: <span className="font-semibold text-green-600">¥{parseFloat(balanceModal.balance || 0).toFixed(2)}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setBalanceType('add')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${balanceType === 'add' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                ➕ 增加
              </button>
              <button onClick={() => setBalanceType('deduct')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${balanceType === 'deduct' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                ➖ 扣减
              </button>
            </div>
            <input type="number" step="0.01" min="0.01" placeholder="输入金额（元）" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setBalanceModal(null)} className="flex-1 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">取消</button>
              <button onClick={handleAdjustBalance} className="flex-1 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
