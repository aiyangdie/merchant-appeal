/**
 * 管理端异步任务进度弹窗（商城 AI 生成/优化等）
 */
import React, { useEffect, useState } from 'react'

const PHASE_LABELS = {
  starting: '启动',
  loading: '加载数据',
  loading_data: '加载数据',
  analyzing: '分析需求',
  ai_suggest: 'AI 生成建议',
  suggesting: '整理建议',
  creating: '创建商品',
  optimizing: 'AI 优化',
  batch_optimize: '批量优化',
  done: '完成',
  failed: '失败',
  stale: '超时结束',
  cancelled: '已取消',
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

export default function AdminJobProgressModal({ job, title, onClose, onCancel }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!job?.open || job?.status === 'done' || job?.status === 'failed') return
    const t0 = job.startedAt || Date.now()
    const tick = () => setElapsed(Math.floor((Date.now() - t0) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [job?.open, job?.status, job?.startedAt])

  if (!job?.open) return null

  const pct = job.total > 0 ? Math.min(100, Math.round((job.current / job.total) * 100)) : null
  const done = job.status === 'done'
  const failed = job.status === 'failed'
  const running = !done && !failed
  const phaseLabel = PHASE_LABELS[job.phase] || job.phase || '处理中'
  const log = job.log || []

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title || '任务进行中'}</h3>
            {job.jobId && <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {job.jobId.slice(0, 8)}…</p>}
          </div>
          {running && (
            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
              已运行 {elapsed}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">{phaseLabel}</span>
          {running && <span className="text-[10px] text-amber-600 animate-pulse">执行中</span>}
        </div>
        <p className="text-xs text-gray-700 mb-3 leading-relaxed">{job.message || '请稍候…'}</p>
        {running && (
          <div className="mb-3">
            {pct != null ? (
              <div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 text-right">步骤 {job.current} / {job.total}（{pct}%）</p>
              </div>
            ) : (
              <div className="h-2.5 bg-indigo-100 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-1/3 bg-indigo-500 rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
        )}
        {log.length > 0 && (
          <div className="flex-1 min-h-0 mb-3">
            <p className="text-[10px] font-medium text-gray-500 mb-1">执行日志</p>
            <div className="border border-gray-100 rounded-lg bg-gray-50/80 p-2 max-h-40 overflow-y-auto text-[11px] text-gray-600 space-y-1">
              {log.slice(-12).map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-400 shrink-0">{formatTime(entry.t)}</span>
                  <span className="flex-1">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {done && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2 mb-3">{job.message || '已完成'}</p>
        )}
        {failed && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 mb-3">{job.error || job.message || '任务失败'}</p>
        )}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          {running && onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              取消任务
            </button>
          )}
          {(done || failed) && (
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  )
}