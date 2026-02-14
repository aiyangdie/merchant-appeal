import React, { useState, useEffect, useCallback } from 'react'

export default function BackupPanel({ adminFetch }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backupLoading, setBackupLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/backup/status')
      const data = await res.json()
      setStatus(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [adminFetch])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleBackup = async () => {
    if (!confirm('确定要立即执行数据库备份吗？')) return
    setBackupLoading(true)
    try {
      const res = await adminFetch('/api/admin/backup/run', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`备份成功！\n文件: ${data.filename}\n大小: ${data.sizeHuman}\n表: ${data.tables} 个\n行: ${data.rows} 行\n耗时: ${data.durationMs}ms`)
      } else {
        alert('备份失败: ' + (data.error || '未知错误'))
      }
      await fetchStatus()
    } catch (err) {
      alert('备份请求失败: ' + err.message)
    }
    setBackupLoading(false)
  }

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

  if (loading) return <div className="p-8 text-center text-gray-400">加载备份数据...</div>
  if (!status) return <div className="p-8 text-center text-red-400">无法获取备份状态</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
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
  )
}