/**
 * @fileoverview 数据库备份管理面板（管理员专用）
 * 提供数据库备份的创建、查看、删除和历史记录管理功能
 *
 * 核心功能：
 *   - 状态概览：自动备份调度器状态、备份文件数、总占用空间、最后备份信息
 *   - 立即备份：手动触发全量备份，显示备份详情（文件名/大小/表数/行数/耗时）
 *   - 备份列表：按时间倒序显示所有备份文件，支持单独删除
 *   - 历史记录：备份执行历史，包含状态（成功/失败/运行中）、类型（自动/手动）、性能数据
 *
 * 备份策略：
 *   - 自动备份：每日固定时间执行（由 status.autoBackupHour 决定）
 *   - 文件上限：最多保留 maxFiles 个备份文件，超出后自动清理
 *   - 备份内容：全量数据库（所有表的完整数据）
 *
 * 关键依赖：
 *   - adminFetch: 带管理员认证的 fetch 函数
 *   - 后端接口: /api/admin/backup/status, /api/admin/backup/run,
 *               /api/admin/backup/:filename
 *
 * 注意事项：
 *   - 删除备份不可恢复，有二次确认弹窗
 *   - 备份进行中时（isRunning），"立即备份"按钮禁用
 *   - 备份成功使用 alert() 弹窗显示详情，失败也使用 alert()
 *   - 历史记录按 max-h-60 限制高度，超出可滚动
 */
import React, { useState, useEffect, useCallback } from 'react'
import AdminAiTabLayout from './AdminAiTabLayout.jsx'

/**
 * 数据库备份管理面板（管理员专用）
 *
 * 提供备份的完整生命周期管理：
 *   1. 状态卡片：自动备份状态/文件数/总空间/最后备份
 *   2. 备份文件列表：文件名/创建时间/大小 + 删除操作
 *   3. 备份历史记录：执行状态/类型/表数/行数/耗时的详细流水
 *
 * @param {Object} props
 * @param {Function} props.adminFetch - 带管理员认证的 fetch 函数
 * @returns {JSX.Element} 数据库备份管理面板 UI
 *
 * 注意事项：
 *   - 备份操作使用 confirm() 二次确认，成功后 alert() 显示详情
 *   - 删除操作不可恢复，需二次确认
 *   - 历史记录按时间倒序排列，最新的在前
 */
export default function BackupPanel({ adminFetch, showToast }) {
  /** 备份状态数据对象 */
  const [status, setStatus] = useState(null)
  /** 是否正在首次加载 */
  const [loading, setLoading] = useState(true)
  /** 立即备份是否进行中 */
  const [backupLoading, setBackupLoading] = useState(false)
  /** 正在删除的备份文件名，null 表示无删除操作 */
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [backupDoneMsg, setBackupDoneMsg] = useState('')

  /**
   * 获取备份状态
   * 调用 /api/admin/backup/status 获取调度器状态/文件列表/历史记录
   */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/backup/status')
      const data = await res.json()
      setStatus(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [adminFetch])

  /** 组件挂载时获取备份状态 */
  useEffect(() => { fetchStatus() }, [fetchStatus])

  /** 备份进行中轮询状态 */
  useEffect(() => {
    if (!status?.isRunning && !backupLoading) return
    const t = setInterval(fetchStatus, 2000)
    return () => clearInterval(t)
  }, [status?.isRunning, backupLoading, fetchStatus])

  /**
   * 立即执行数据库备份
   * 调用 POST /api/admin/backup/run，成功后 alert() 显示备份详情
   * 备份进行中时禁用按钮（backupLoading 和 status.isRunning 双重判断）
   */
  const handleBackup = async () => {
    if (!confirm('确定要立即执行数据库备份吗？')) return
    setBackupLoading(true)
    setBackupDoneMsg('')
    try {
      const res = await adminFetch('/api/admin/backup/run', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        setBackupDoneMsg('备份失败: ' + (data.error || '未知错误'))
      } else {
        setBackupDoneMsg(`备份成功：${data.filename}（${data.sizeHuman}，${data.tables} 表，${data.rows} 行，${data.durationMs}ms）`)
      }
      await fetchStatus()
    } catch (err) {
      setBackupDoneMsg('备份请求失败: ' + err.message)
    }
    setBackupLoading(false)
  }

  /**
   * 删除指定备份文件
   * @param {string} filename - 要删除的备份文件名
   */
  const handleDelete = async (filename) => {
    if (!confirm(`确定删除备份文件 ${filename} 吗？此操作不可恢复。`)) return
    setDeleteTarget(filename)
    try {
      const res = await adminFetch(`/api/admin/backup/${filename}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) alert('删除失败: ' + data.error)
      await fetchStatus()
    } catch { /* ignore */ }
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <AdminAiTabLayout tabKey="backup" adminFetch={adminFetch} showToast={showToast} onRefresh={fetchStatus} loading className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className="p-8 text-center text-gray-400">加载备份数据...</div>
      </AdminAiTabLayout>
    )
  }
  if (!status) {
    return (
      <AdminAiTabLayout tabKey="backup" adminFetch={adminFetch} showToast={showToast} onRefresh={fetchStatus} className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className="p-8 text-center text-red-400">无法获取备份状态</div>
      </AdminAiTabLayout>
    )
  }

  return (
    <AdminAiTabLayout
      tabKey="backup"
      adminFetch={adminFetch}
      showToast={showToast}
      onRefresh={fetchStatus}
      loading={backupLoading}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"
    >
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">数据备份</h2>
        <div className="flex gap-2">
          <button onClick={handleBackup} disabled={backupLoading || status.isRunning}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
            {backupLoading || status.isRunning ? (
              <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> 备份中...</>
            ) : '立即备份'}
          </button>
          <button onClick={fetchStatus} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-all">
            刷新
          </button>
        </div>
      </div>

      {(backupLoading || status.isRunning) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">备份进行中…</p>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-[progress_2s_ease-in-out_infinite]" style={{ width: '55%' }} />
          </div>
          <p className="text-[10px] text-blue-600/80 mt-2">每 2 秒自动刷新状态，请勿关闭页面</p>
        </div>
      )}

      {backupDoneMsg && !status.isRunning && !backupLoading && (
        <div className={`rounded-xl p-3 text-xs ${backupDoneMsg.startsWith('备份成功') ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {backupDoneMsg}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">自动备份</div>
          <div className={`text-lg font-bold ${status.schedulerActive ? 'text-green-600' : 'text-gray-400'}`}>
            {status.schedulerActive ? `每日 ${status.autoBackupHour}:00` : '未启用'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">备份文件数</div>
          <div className="text-lg font-bold text-blue-600">{status.totalBackupFiles || 0}</div>
          <div className="text-xs text-gray-400">上限 {status.maxFiles}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">总占用空间</div>
          <div className="text-lg font-bold text-purple-600">{status.totalBackupSize || '0 B'}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">最后备份</div>
          <div className="text-sm font-medium text-gray-700 truncate">
            {status.lastBackup ? new Date(status.lastBackup).toLocaleString('zh-CN') : '从未备份'}
          </div>
          {status.lastBackupSize && <div className="text-xs text-gray-400">{status.lastBackupSize} / {status.lastBackupDuration}ms</div>}
        </div>
      </div>

      {/* Backup Files */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">备份文件列表</h3>
        </div>
        {(!status.files || status.files.length === 0) ? (
          <div className="text-center py-12 text-gray-300 text-sm">暂无备份文件</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {status.files.map(f => (
              <div key={f.filename} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{f.filename}</div>
                  <div className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleString('zh-CN')}</div>
                </div>
                <div className="text-xs text-gray-500 mr-4">{f.sizeHuman}</div>
                <button onClick={() => handleDelete(f.filename)} disabled={deleteTarget === f.filename}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                  {deleteTarget === f.filename ? '删除中...' : '删除'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup History */}
      {status.history && status.history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">备份历史记录</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
            {status.history.map(h => (
              <div key={h.id} className="flex items-center px-4 py-2.5 text-xs">
                <span className={`w-2 h-2 rounded-full mr-2.5 flex-shrink-0 ${h.status === 'success' ? 'bg-green-400' : h.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="flex-1 text-gray-700">{h.filename || '-'}</span>
                <span className="text-gray-400 mx-2">{h.type === 'auto' ? '自动' : '手动'}</span>
                <span className="text-gray-400 mx-2">{h.tables}表/{h.rows}行</span>
                <span className="text-gray-400 mx-2">{h.durationMs}ms</span>
                <span className={`px-1.5 py-0.5 rounded ${h.status === 'success' ? 'bg-green-50 text-green-600' : h.status === 'running' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  {h.status === 'success' ? '成功' : h.status === 'running' ? '运行中' : '失败'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </AdminAiTabLayout>
  )
}