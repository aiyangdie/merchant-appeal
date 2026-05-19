/**
 * @fileoverview 客户信息面板组件
 * @description 在对话侧边栏展示收集到的客户信息，支持按分组展示、点击编辑、查看修改历史
 * @module InfoPanel
 */

import React, { useState, useCallback } from 'react'

/**
 * 基础分组定义
 * @description 信息字段的固定分组及配色方案，用于将不同类型的信息分类展示
 */
const BASE_GROUPS = [
  { key: '业务了解', color: 'purple' },
  { key: '问题信息', color: 'emerald' },
  { key: '商户号信息', color: 'blue' },
  { key: '企业信息', color: 'indigo' },
  { key: '法人信息', color: 'violet' },
  { key: '投诉与售后', color: 'orange' },
  { key: '结算账户', color: 'teal' },
  { key: '联系方式', color: 'cyan' },
  { key: '申诉历史', color: 'slate' },
]

/**
 * 动态分组配色方案
 * @description 用于超出 BASE_GROUPS 的动态发现分组，循环使用这些颜色
 */
const DYNAMIC_COLORS = ['amber', 'teal', 'cyan', 'purple', 'emerald', 'blue']

/**
 * 颜色映射表
 * @description 将颜色名称映射到对应的 Tailwind CSS 类名（圆点、背景、文字）
 */
const C = {
  purple:  { dot: 'bg-purple-400',  bg: 'bg-purple-50/60',  text: 'text-purple-700' },
  emerald: { dot: 'bg-emerald-400', bg: 'bg-emerald-50/60', text: 'text-emerald-700' },
  blue:    { dot: 'bg-blue-400',    bg: 'bg-blue-50/60',    text: 'text-blue-700' },
  indigo:  { dot: 'bg-indigo-400',  bg: 'bg-indigo-50/60',  text: 'text-indigo-700' },
  violet:  { dot: 'bg-violet-400',  bg: 'bg-violet-50/60',  text: 'text-violet-700' },
  amber:   { dot: 'bg-amber-400',   bg: 'bg-amber-50/60',   text: 'text-amber-700' },
  orange:  { dot: 'bg-orange-400',  bg: 'bg-orange-50/60',  text: 'text-orange-700' },
  teal:    { dot: 'bg-teal-400',    bg: 'bg-teal-50/60',    text: 'text-teal-700' },
  cyan:    { dot: 'bg-cyan-400',    bg: 'bg-cyan-50/60',    text: 'text-cyan-700' },
  slate:   { dot: 'bg-slate-400',   bg: 'bg-slate-50/60',   text: 'text-slate-700' },
}

/**
 * 字段修改历史组件
 * @description 展示单个字段的所有修改记录，包括旧值→新值、修改来源、时间和原因
 * @param {Object} props
 * @param {Array} props.logs - 修改记录数组 [{old_value, new_value, change_source, change_reason, created_at}]
 * 
 * 修改来源类型：
 * - ai_extract: AI 自动识别提取
 * - ai_correction: AI 更正/修正
 * - user_edit: 用户手动修改
 * - system: 系统默认值
 */
function FieldHistory({ logs }) {
  if (!logs || logs.length === 0) return <div className="text-[10px] text-gray-400 py-2 text-center">暂无修改记录</div>
  const SOURCE_LABEL = { ai_extract: '🤖 AI识别', ai_correction: '🔄 AI更正', user_edit: '✏️ 用户修改', system: '⚙️ 系统' }
  const SOURCE_COLOR = { ai_extract: 'border-blue-200 bg-blue-50/50', ai_correction: 'border-amber-200 bg-amber-50/50', user_edit: 'border-green-200 bg-green-50/50', system: 'border-gray-200 bg-gray-50/50' }
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {logs.map((log, i) => {
        const time = log.created_at ? new Date(log.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
        return (
          <div key={i} className={`rounded-lg border p-2 ${SOURCE_COLOR[log.change_source] || SOURCE_COLOR.system}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-gray-600">{SOURCE_LABEL[log.change_source] || log.change_source}</span>
              <span className="text-[9px] text-gray-400">{time}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {log.old_value ? (
                <>
                  <span className="text-red-400 line-through max-w-[80px] truncate">{log.old_value}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-600 font-medium max-w-[80px] truncate">{log.new_value}</span>
                </>
              ) : (
                <span className="text-green-600 font-medium truncate">{log.new_value}</span>
              )}
            </div>
            {log.change_reason && <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{log.change_reason}</div>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 可编辑字段组件
 * @description 展示单个信息字段，支持点击已填字段进入编辑模式，查看修改历史
 * 
 * 交互逻辑：
 * 1. 未填写字段 → 显示灰色占位圆圈，点击无反应
 * 2. 已填写字段 → 显示绿色对勾，hover 显示编辑/历史按钮，点击可进入编辑
 * 3. 编辑模式 → 显示 textarea 输入框，支持保存/取消
 * 
 * @param {Object} props
 * @param {string} props.fieldKey - 字段唯一标识，用于保存和查询历史
 * @param {string} props.label - 字段显示名称（如"商户号"、"公司全称"）
 * @param {string} props.value - 字段当前值
 * @param {Function} props.onSave - 保存回调 (fieldKey, value) => Promise
 * @param {Function} props.onShowHistory - 查看历史回调 (fieldKey) => void
 * @param {Array} props.historyLogs - 修改历史记录数组
 * @param {boolean} props.historyLoading - 历史加载状态
 */
function EditableField({ fieldKey, label, value, onSave, onShowHistory, historyLogs, historyLoading }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const filled = value && String(value).trim()

  function startEdit() {
    setEditValue(value || '')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(fieldKey, editValue.trim())
      setEditing(false)
    } catch {}
    finally { setSaving(false) }
  }

  function handleCancel() {
    setEditValue(value || '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-3 py-2">
        <span className="text-[11px] text-gray-500 block mb-1">{label}</span>
        <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
          className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-300/30 focus:border-blue-400 resize-none bg-blue-50/30"
          rows={2} autoFocus />
        <div className="flex justify-end gap-1.5 mt-1.5">
          <button onClick={handleCancel} disabled={saving}
            className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="px-2.5 py-0.5 text-[10px] text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 font-medium">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`px-3 py-2 group cursor-pointer hover:bg-gray-50/50 transition-colors ${filled ? 'animate-slide-in-right' : ''}`} onClick={filled ? startEdit : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] ${filled ? 'text-gray-500' : 'text-gray-300'}`}>{label}</span>
        <div className="flex items-center gap-1">
          {filled && (
            <>
              <button onClick={e => { e.stopPropagation(); if (!showHistory) onShowHistory?.(fieldKey); setShowHistory(!showHistory) }}
                title="查看修改记录"
                className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button onClick={e => { e.stopPropagation(); startEdit() }}
                className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            </>
          )}
          {filled ? (
            <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
          ) : (
            <div className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" />
          )}
        </div>
      </div>
      {filled && (
        <p className="text-[12px] text-gray-800 mt-0.5 leading-relaxed break-all line-clamp-2 font-medium">{value}</p>
      )}
      {showHistory && (
        <div className="px-1 pb-2 pt-1">
          {historyLoading ? (
            <div className="text-[10px] text-gray-400 py-1 text-center">加载中...</div>
          ) : (
            <FieldHistory logs={historyLogs} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 客户信息面板主组件
 * @description 展示所有收集到的客户信息，按分组组织，支持进度追踪、字段编辑和历史查看
 * 
 * 核心功能：
 * 1. 信息分组展示 — 按业务了解、问题信息、商户号信息等分组展示
 * 2. 进度追踪 — 显示已收集字段数和百分比进度条
 * 3. 字段编辑 — 点击已填字段可修改，调用后端 API 保存
 * 4. 修改历史 — 查看每个字段的修改记录（来源、时间、原因）
 * 5. 动态分组 — 后端返回的新分组会自动发现并分配颜色
 * 
 * @param {Object} props
 * @param {Object} props.collectedData - 已收集的数据 {fieldKey: value}
 * @param {Array} props.fields - 字段定义数组 [{key, label, group}]
 * @param {number} props.step - 当前步骤（已废弃，使用 fieldList.length）
 * @param {number} props.totalSteps - 总步骤数（已废弃，使用 fieldList.length）
 * @param {Function} props.onClose - 关闭面板回调（移动端）
 * @param {string} props.sessionId - 会话 ID，用于 API 请求
 * @param {Function} props.onFieldUpdate - 字段更新回调 (key, value)
 * @param {Function} props.getAuthHeaders - 获取认证请求头回调
 */
export default function InfoPanel({ collectedData, fields, step, totalSteps, onClose, sessionId, onFieldUpdate, getAuthHeaders }) {
  const data = collectedData || {}
  const fieldList = fields || []
  const filledCount = fieldList.filter(f => data[f.key] && String(data[f.key]).trim()).length
  const actualTotal = fieldList.length || totalSteps
  const progress = actualTotal > 0 ? Math.min(100, Math.round((filledCount / actualTotal) * 100)) : 0

  const [fieldHistoryMap, setFieldHistoryMap] = useState({})
  const [historyLoading, setHistoryLoading] = useState({})

  const fetchFieldHistory = useCallback(async (fieldKey) => {
    if (!sessionId) return
    setHistoryLoading(prev => ({ ...prev, [fieldKey]: true }))
    try {
      const headers = getAuthHeaders ? getAuthHeaders() : {}
      const res = await fetch(`/api/sessions/${sessionId}/field-history?field=${fieldKey}`, { headers })
      const result = await res.json()
      setFieldHistoryMap(prev => ({ ...prev, [fieldKey]: result.logs || [] }))
    } catch { setFieldHistoryMap(prev => ({ ...prev, [fieldKey]: [] })) }
    setHistoryLoading(prev => ({ ...prev, [fieldKey]: false }))
  }, [sessionId, getAuthHeaders])

  const grouped = {}
  for (const f of fieldList) {
    if (!grouped[f.group]) grouped[f.group] = []
    grouped[f.group].push(f)
  }

  // 动态构建分组列表：基础分组 + 动态发现的新分组
  const allGroupKeys = Object.keys(grouped)
  const baseGroupKeys = BASE_GROUPS.map(g => g.key)
  const dynamicGroupKeys = allGroupKeys.filter(k => !baseGroupKeys.includes(k))
  const GROUPS = [
    ...BASE_GROUPS,
    ...dynamicGroupKeys.map((k, i) => ({ key: k, color: DYNAMIC_COLORS[i % DYNAMIC_COLORS.length] })),
  ]

  async function handleFieldSave(key, value) {
    if (!sessionId) return
    const headers = getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' }
    const res = await fetch(`/api/sessions/${sessionId}/field`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ key, value }),
    })
    const result = await res.json()
    if (result.success && onFieldUpdate) {
      // 使用后端标准化后的值（如"我卖衣服"→"零售"）
      const finalValue = result.normalizedValue || value
      onFieldUpdate(key, finalValue)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-gray-900 leading-tight">客户信息</h2>
              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">已收集 {filledCount} / {actualTotal} 项 · 点击可编辑</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        {/* 进度 */}
        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }} />
        </div>
        {progress === 100 && (
          <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 rounded-lg">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
            </div>
            <span className="text-[11px] text-green-700 font-medium">信息收集完成</span>
          </div>
        )}
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* 信息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {GROUPS.map(g => {
          const items = grouped[g.key]
          if (!items || items.length === 0) return null
          const clr = C[g.color] || C.slate
          const groupFilled = items.filter(f => data[f.key] && String(data[f.key]).trim()).length
          const done = groupFilled === items.length

          return (
            <div key={g.key} className="rounded-xl overflow-hidden border border-gray-100/80">
              <div className="px-3 py-2 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-400' : clr.dot}`} />
                  <span className="text-[11px] font-semibold text-gray-600">{g.key}</span>
                </div>
                <span className={`text-[10px] font-medium tabular-nums ${done ? 'text-green-500' : 'text-gray-400'}`}>{groupFilled}/{items.length}</span>
              </div>
              <div className="bg-white divide-y divide-gray-50">
                {items.map((f) => (
                  <EditableField
                    key={f.key}
                    fieldKey={f.key}
                    label={f.label}
                    value={data[f.key]}
                    onSave={handleFieldSave}
                    onShowHistory={fetchFieldHistory}
                    historyLogs={fieldHistoryMap[f.key]}
                    historyLoading={historyLoading[f.key]}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {filledCount === 0 && (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-[12px] text-gray-400 font-medium">等待信息收集</p>
            <p className="text-[11px] text-gray-300 mt-1">在对话中回答问题，信息会实时显示在这里</p>
          </div>
        )}
      </div>
    </div>
  )
}
