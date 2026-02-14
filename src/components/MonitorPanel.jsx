import React, { useState, useEffect, useCallback } from 'react'

const STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-700 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200',
}

const ALERT_COLORS = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-yellow-300 bg-yellow-50',
  info: 'border-blue-300 bg-blue-50',
}

const ALERT_ICONS = {
  critical: '\uD83D\uDD34',
  warning: '\uD83D\uDFE1',
  info: '\uD83D\uDD35',
}

function MetricCard({ label, value, sub, color = 'purple' }) {
  const colors = {
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    blue: 'from-blue-500 to-blue-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    cyan: 'from-cyan-500 to-cyan-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold bg-gradient-to-r ${colors[color] || colors.purple} bg-clip-text text-transparent`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function MonitorPanel({ adminFetch }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkLoading, setCheckLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/monitor/status')
      const data = await res.json()
      setStatus(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [adminFetch])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Auto refresh every 30s
  useEffect(() => {
    const timer = setInterval(fetchStatus, 30000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const handleCheck = async () => {
    setCheckLoading(true)
    try {
      await adminFetch('/api/admin/monitor/check', { method: 'POST' })
      await fetchStatus()
    } catch { /* ignore */ }
    setCheckLoading(false)
  }

  const handleAckAlert = async (id) => {
    await adminFetch(`/api/admin/monitor/alerts/${id}/acknowledge`, { method: 'PUT' })
    fetchStatus()
  }

  const handleClearAlerts = async () => {
    await adminFetch('/api/admin/monitor/alerts', { method: 'DELETE' })
    fetchStatus()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">加载监控数据...</div>
  if (!status) return <div className="p-8 text-center text-red-400">无法获取监控状态</div>

  const sys = status.system?.system || {}
  const proc = status.system?.process || {}
  const api = status.api || {}
  const db = status.database || {}
  const alerts = status.recentAlerts || []

  const healthStatus = alerts.filter(a => a.level === 'critical' && !a.acknowledged).length > 0
    ? 'critical'
    : alerts.filter(a => a.level === 'warning' && !a.acknowledged).length > 0
      ? 'degraded' : 'healthy'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">系统监控</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[healthStatus]}`}>
            {healthStatus === 'healthy' ? '正常' : healthStatus === 'degraded' ? '警告' : '异常'}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheck} disabled={checkLoading}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all">
            {checkLoading ? '检测中...' : '立即检测'}
          </button>
          <button onClick={fetchStatus} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-all">
            刷新
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="运行时间" value={proc.uptimeHuman || '-'} color="green" />
        <MetricCard label="系统内存" value={`${sys.memPercent || 0}%`} sub={`${sys.usedMemMB || 0}/${sys.totalMemMB || 0} MB`} color={sys.memPercent > 85 ? 'red' : 'blue'} />
        <MetricCard label="Node堆内存" value={`${proc.heapUsedMB || 0} MB`} sub={`总计 ${proc.heapTotalMB || 0} MB`} color={proc.heapUsedMB > 512 ? 'orange' : 'purple'} />
        <MetricCard label="API请求" value={api.totalRequests || 0} sub={`错误 ${api.totalErrors || 0}`} color="cyan" />
        <MetricCard label="平均响应" value={`${api.avgResponseMs || 0}ms`} sub={`慢请求 ${api.slowRequests || 0}`} color={api.avgResponseMs > 3000 ? 'red' : 'green'} />
        <MetricCard label="DB延迟" value={db.lastPingMs != null ? `${db.lastPingMs}ms` : '-'} sub={db.poolStatus ? `连接池 ${db.poolStatus.usedPercent || 0}%` : ''} color={db.lastPingMs > 5000 ? 'red' : 'green'} />
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">系统信息</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-500">主机名</div><div className="text-gray-800 font-medium">{sys.hostname || '-'}</div>
            <div className="text-gray-500">平台</div><div className="text-gray-800">{sys.platform || '-'} / {sys.arch || '-'}</div>
            <div className="text-gray-500">CPU</div><div className="text-gray-800">{sys.cpuCount || '-'} 核 / {sys.cpuPercent || 0}%</div>
            <div className="text-gray-500">进程PID</div><div className="text-gray-800">{proc.pid || '-'}</div>
            <div className="text-gray-500">RSS内存</div><div className="text-gray-800">{proc.rssMB || 0} MB</div>
            <div className="text-gray-500">错误率</div><div className="text-gray-800">{api.errorRate ? `${(api.errorRate * 100).toFixed(2)}%` : '0%'}</div>
            <div className="text-gray-500">服务启动</div><div className="text-gray-800 truncate" title={status.serverStartTime}>{status.serverStartTime ? new Date(status.serverStartTime).toLocaleString('zh-CN') : '-'}</div>
            <div className="text-gray-500">最后检测</div><div className="text-gray-800 truncate" title={status.lastCheckTime}>{status.lastCheckTime ? new Date(status.lastCheckTime).toLocaleString('zh-CN') : '-'}</div>
          </div>
        </div>

        {/* DB Pool */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">数据库连接池</h3>
          {db.poolStatus ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${db.poolStatus.usedPercent > 80 ? 'bg-red-500' : db.poolStatus.usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(db.poolStatus.usedPercent, 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-600 w-12 text-right">{db.poolStatus.usedPercent}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">总连接数</div><div className="text-gray-800">{db.poolStatus.totalConnections}</div>
                <div className="text-gray-500">空闲连接</div><div className="text-gray-800">{db.poolStatus.freeConnections}</div>
                <div className="text-gray-500">等待队列</div><div className="text-gray-800">{db.poolStatus.queueLength}</div>
                <div className="text-gray-500">连接上限</div><div className="text-gray-800">{db.poolStatus.connectionLimit}</div>
              </div>
            </div>
          ) : <div className="text-xs text-gray-400">暂无连接池数据</div>}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            告警记录
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">{alerts.filter(a => !a.acknowledged).length}</span>
            )}
          </h3>
          {alerts.length > 0 && (
            <button onClick={handleClearAlerts} className="text-xs text-gray-400 hover:text-red-500 transition-colors">清空全部</button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-300 text-sm">暂无告警，系统运行正常</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {alerts.map(a => (
              <div key={a.id} className={`flex items-start gap-2 p-2.5 rounded-lg border ${ALERT_COLORS[a.level] || ALERT_COLORS.info} ${a.acknowledged ? 'opacity-50' : ''}`}>
                <span className="text-sm flex-shrink-0">{ALERT_ICONS[a.level] || '\uD83D\uDD35'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800">{a.message}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    [{a.category}] {a.timestamp ? new Date(a.timestamp).toLocaleString('zh-CN') : ''}
                  </div>
                </div>
                {!a.acknowledged && (
                  <button onClick={() => handleAckAlert(a.id)} className="text-[10px] text-gray-400 hover:text-green-600 flex-shrink-0 px-1.5 py-0.5 rounded border border-gray-200 hover:border-green-300">
                    确认
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}