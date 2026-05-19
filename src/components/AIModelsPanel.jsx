import React, { useState, useEffect } from 'react'
import { getTokenTypeLabel, TOKEN_USAGE_TYPE_META } from '../constants/tokenUsageTypes.js'

/**
 * AI 模型管理面板组件
 * @description 管理员后台组件，用于管理和监控系统中配置的所有 AI 模型
 * 
 * 核心功能：
 * 1. 模型列表 — 显示所有已配置的 AI 模型，包括供应商、模型名称、API Key 状态、健康状态
 * 2. 健康检测 — 单个检测或一键批量检测模型可用性，显示响应时间和错误信息
 * 3. 模型切换 — 将某个模型设为当前使用模型，支持故障自动切换
 * 4. API Key 管理 — 配置/修改 API Key，支持掩码显示保护敏感信息
 * 5. 智能导入 — 粘贴 API Key 自动识别平台（DeepSeek/智谱/千问/OpenAI 等 20+ 供应商）
 * 6. 用量统计 — Token 消耗统计、费用统计、每日趋势图表、按模型分组统计
 * 7. 模型 CRUD — 添加自定义模型、启用/禁用、删除模型
 * 8. 数据修复 — 修复加密乱码数据的工具
 * 
 * 健康状态类型：
 * - healthy: 正常运行（绿色）
 * - error: 请求错误（红色）
 * - timeout: 请求超时（橙色）
 * - rate_limited: 被限流（黄色）
 * - auth_failed: Key 无效（红色）
 * - balance_empty: 余额耗尽（橙色）
 * - no_key: 未配置 Key（灰色）
 * - unknown: 未知状态（灰色）
 * 
 * 排序规则：
 * 1. 当前使用模型优先
 * 2. 已启用的在已禁用的前面
 * 3. 已配置 Key 的在未配置的前面
 * 4. 健康状态从好到差排列
 * 
 * 数据来源：
 * - /api/admin/ai-models — 获取模型列表
 * - /api/admin/ai-models/health — 获取模型健康状态
 * - /api/admin/ai-models/{id}/check — 单个模型检测
 * - /api/admin/ai-models/check-all — 批量检测
 * - /api/admin/ai-models/test — 测试连接
 * - /api/admin/token-usage — Token 用量统计
 * - /api/admin/ai-models/auto-import — 智能导入
 * 
 * @param {Object} props
 * @param {Function} props.adminFetch - 管理员认证 fetch 函数，返回带 Authorization 头的 Response
 * @param {Function} props.showToast - 显示全局 Toast 通知回调 (message: string) => void
 */

/** 供应商图标映射 — 用于模型卡片左上角显示 */
const PROVIDER_ICONS = {
  zhipu: '🧠', deepseek: '🐋', qwen: '☁️', moonshot: '🌙',
  baichuan: '🏔️', yi: '⚡', openai: '🤖', siliconflow: '🔮', custom: '🔧',
  doubao: '🪨', spark: '✨', minimax: '💫', stepfun: '🚀',
  hunyuan: '🌊', anthropic: '🧬', gemini: '💎', groq: '⚡',
  volcengine: '🌋',
}

const TYPE_LABELS = Object.fromEntries(
  Object.keys(TOKEN_USAGE_TYPE_META).map((k) => [k, getTokenTypeLabel(k)])
)
/** 供应商颜色映射 — 不同供应商使用不同背景色和文字色 */
const PROVIDER_COLORS = {
  zhipu: 'bg-purple-50 text-purple-700 border-purple-200',
  deepseek: 'bg-blue-50 text-blue-700 border-blue-200',
  qwen: 'bg-orange-50 text-orange-700 border-orange-200',
  moonshot: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  baichuan: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  yi: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  openai: 'bg-green-50 text-green-700 border-green-200',
  siliconflow: 'bg-pink-50 text-pink-700 border-pink-200',
  doubao: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  volcengine: 'bg-red-50 text-red-700 border-red-200',
  spark: 'bg-amber-50 text-amber-700 border-amber-200',
  minimax: 'bg-violet-50 text-violet-700 border-violet-200',
  stepfun: 'bg-rose-50 text-rose-700 border-rose-200',
  hunyuan: 'bg-sky-50 text-sky-700 border-sky-200',
  anthropic: 'bg-orange-50 text-orange-700 border-orange-200',
  gemini: 'bg-blue-50 text-blue-700 border-blue-200',
  groq: 'bg-lime-50 text-lime-700 border-lime-200',
  custom: 'bg-gray-50 text-gray-700 border-gray-200',
}

export default function AIModelsPanel({ adminFetch, showToast }) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState({})
  const [testResults, setTestResults] = useState({})
  const [editingKey, setEditingKey] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ provider: 'custom', displayName: '', apiKey: '', modelName: '', endpoint: '', isFree: false })
  const [checking, setChecking] = useState(false)
  const [checkingId, setCheckingId] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importKey, setImportKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [usageData, setUsageData] = useState(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')
  const [showUsage, setShowUsage] = useState(false)

  /** 获取模型列表和健康状态，优先使用 /health 接口，失败时 fallback 到普通接口 */
  async function fetchModels() {
    try {
      const res = await adminFetch('/api/admin/ai-models/health')
      const data = await res.json()
      if (data.models) setModels(data.models)
      else {
        const res2 = await adminFetch('/api/admin/ai-models')
        const data2 = await res2.json()
        setModels(data2.models || [])
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchModels() }, [])

  /** 一键批量检测所有模型健康状态，自动统计可用数量 */
  async function handleCheckAll() {
    setChecking(true)
    showToast('正在批量检测所有模型...')
    try {
      const res = await adminFetch('/api/admin/ai-models/check-all', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      const healthy = data.results?.filter(r => r.status === 'healthy').length || 0
      const total = data.results?.length || 0
      showToast(`检测完成: ${healthy}/${total} 个模型可用${data.autoSwitch?.switched ? ` · 已自动切换到 ${data.autoSwitch.model}` : ''}`)
      fetchModels()
    } catch { showToast('批量检测失败') }
    finally { setChecking(false) }
  }

  /** 单个模型健康检测 */
  async function handleCheckSingle(model) {
    setCheckingId(model.id)
    try {
      const res = await adminFetch(`/api/admin/ai-models/${model.id}/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (data.status === 'healthy') showToast(`✅ ${model.display_name} 健康 (${data.responseMs}ms)`)
      else showToast(`⚠️ ${model.display_name}: ${data.error || data.status}`)
      fetchModels()
    } catch { showToast('检测失败') }
    finally { setCheckingId(null) }
  }

  /** 测试模型连接性，发送测试请求并显示结果 */
  async function handleTest(model) {
    setTesting(p => ({ ...p, [model.id]: true }))
    setTestResults(p => ({ ...p, [model.id]: null }))
    try {
      const res = await adminFetch('/api/admin/ai-models/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: model.id }),
      })
      const data = await res.json()
      setTestResults(p => ({ ...p, [model.id]: data }))
      if (data.success) showToast(`✅ ${model.display_name} 连接成功`)
      else showToast(`❌ ${model.display_name}: ${data.error}`)
    } catch (e) {
      setTestResults(p => ({ ...p, [model.id]: { success: false, error: e.message } }))
    } finally { setTesting(p => ({ ...p, [model.id]: false })) }
  }

  /** 激活/切换到指定模型 */
  async function handleActivate(model) {
    try {
      const res = await adminFetch(`/api/admin/ai-models/${model.id}/activate`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) { showToast(`已切换到 ${model.display_name}`); fetchModels() }
      else showToast(data.error || '激活失败')
    } catch { showToast('激活失败') }
  }

  /** 保存模型的 API Key */
  async function handleSaveKey(model) {
    try {
      const res = await adminFetch(`/api/admin/ai-models/${model.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyInput }),
      })
      const data = await res.json()
      if (data.success) { showToast('API Key 已保存'); setEditingKey(null); setKeyInput(''); fetchModels() }
      else showToast('保存失败')
    } catch { showToast('保存失败') }
  }

  /** 启用/禁用模型 */
  async function handleToggleEnabled(model) {
    try {
      await adminFetch(`/api/admin/ai-models/${model.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !model.is_enabled }),
      })
      fetchModels()
    } catch {}
  }

  /** 删除模型，当前使用模型无法删除 */
  async function handleDelete(model) {
    if (!confirm(`确定删除 ${model.display_name}？`)) return
    try {
      const res = await adminFetch(`/api/admin/ai-models/${model.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { showToast('已删除'); fetchModels() }
      else showToast(data.error || '删除失败')
    } catch { showToast('删除失败') }
  }

  /** 添加自定义模型 */
  async function handleAdd() {
    if (!addForm.provider || !addForm.modelName || !addForm.endpoint) { showToast('请填写完整'); return }
    try {
      const res = await adminFetch('/api/admin/ai-models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success) { showToast('添加成功'); setShowAdd(false); setAddForm({ provider: 'custom', displayName: '', apiKey: '', modelName: '', endpoint: '', isFree: false }); fetchModels() }
      else showToast(data.error || '添加失败')
    } catch { showToast('添加失败') }
  }

  /** 智能导入：根据 API Key 自动识别供应商并批量导入模型 */
  async function handleAutoImport() {
    if (!importKey.trim()) { showToast('请输入 API Key'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const res = await adminFetch('/api/admin/ai-models/auto-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: importKey.trim() }),
      })
      const data = await res.json()
      setImportResult(data)
      if (data.success) {
        showToast(data.message || `已导入 ${data.imported?.length || 0} 个模型`)
        setImportKey('')
        fetchModels()
      } else {
        showToast(data.error || '导入失败')
      }
    } catch (e) { showToast('导入失败: ' + e.message) }
    finally { setImporting(false) }
  }

  /** 修复加密乱码数据（不可逆操作） */
  async function handleFixData() {
    if (!confirm('确认修复加密乱码数据？无法恢复的数据将被替换为占位符。')) return
    try {
      const res = await adminFetch('/api/admin/fix-encrypted-data', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      showToast(data.message || '修复完成')
    } catch { showToast('修复失败') }
  }

  /** 获取 Token 用量统计数据，包含总量/今日/按类型/每日趋势 */
  async function fetchUsage() {
    setUsageLoading(true)
    setUsageError('')
    try {
      const res = await adminFetch('/api/admin/token-usage?limit=50&page=1')
      const data = await res.json()
      const stats = data.stats || {}
      const mapped = {
        total: {
          total_tokens: parseInt(stats.totals?.total_tokens || 0),
          total_prompt: parseInt(stats.totals?.total_input || 0),
          total_completion: parseInt(stats.totals?.total_output || 0),
          total_cost: parseFloat(stats.totals?.total_cost || 0),
          total_requests: parseInt(stats.totals?.total_requests || 0),
        },
        today: {
          total_tokens: parseInt(stats.today?.tokens || stats.today?.total_tokens || 0),
          total_prompt: parseInt(stats.today?.input_tokens || 0),
          total_completion: parseInt(stats.today?.output_tokens || 0),
          total_cost: parseFloat(stats.today?.cost || 0),
          total_requests: parseInt(stats.today?.requests || 0),
        },
        by_provider: (stats.byType || []).map(t => ({
          provider: t.type,
          model_name: t.type || '',
          requests: parseInt(t.cnt || 0),
          prompt_tokens: parseInt(t.input_tokens || 0),
          completion_tokens: parseInt(t.output_tokens || 0),
          total_tokens: parseInt(t.tokens || 0),
          cost_yuan: parseFloat(t.cost || 0),
          last_used: null,
        })),
        daily: (stats.daily || []).map(d => ({
          date: d.day,
          total_tokens: parseInt(d.tokens || 0),
          prompt_tokens: parseInt(d.input_tokens || 0),
          completion_tokens: parseInt(d.output_tokens || 0),
          cost_yuan: parseFloat(d.cost || 0),
          requests: parseInt(d.requests || 0),
        })),
      }
      setUsageData(mapped)
    } catch (e) {
      setUsageError(e.message || '获取用量统计失败')
      showToast('获取用量统计失败: ' + (e.message || ''))
    }
    finally { setUsageLoading(false) }
  }

  /** 格式化 Token 数量显示，自动转换为 K/M 单位 */
  function formatTokens(n) {
    if (!n || isNaN(n)) return '0'
    const num = parseFloat(n)
    if (isNaN(num)) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  /** 格式化费用显示，保留4位小数，添加人民币符号 */
  function formatCost(n) {
    if (!n) return '¥0.00'
    const parsed = parseFloat(n)
    if (isNaN(parsed)) return '¥0.00'
    return '¥' + parsed.toFixed(4)
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-800">AI 模型管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            自动检测 · 故障自动切换 · 免费模型优先
            {models.length > 0 && (
              <span className="ml-2">
                <span className="text-green-500">{models.filter(m => m.health_status === 'healthy').length}✓</span>
                <span className="text-red-400 ml-1">{models.filter(m => ['error','timeout','auth_failed','balance_empty'].includes(m.health_status)).length}✗</span>
                <span className="text-gray-300 ml-1">{models.filter(m => m.health_status === 'unknown' || !m.health_status || m.health_status === 'no_key').length}?</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCheckAll} disabled={checking}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${checking ? 'bg-yellow-100 text-yellow-700 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}>
            {checking ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            )}
            {checking ? '检测中...' : '一键检测'}
          </button>
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); setShowUsage(false) }}
            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-all flex items-center gap-1 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            智能导入
          </button>
          <button onClick={() => { setShowUsage(!showUsage); if (!showUsage) fetchUsage(); setShowAdd(false); setShowImport(false) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${showUsage ? 'bg-orange-500 text-white shadow-sm' : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            用量统计
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false) }}
            className="px-3 py-1.5 text-xs font-medium bg-wechat-green text-white rounded-lg hover:bg-wechat-green/90 transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            添加
          </button>
          <button onClick={handleFixData} title="修复加密乱码数据"
            className="p-1.5 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      {/* Auto Import */}
      {showImport && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="text-lg">🪄</span> 智能导入 — 粘贴 API Key 自动识别平台
          </h4>
          <p className="text-xs text-gray-500">支持自动检测: DeepSeek / 智谱 / 通义千问 / Moonshot / SiliconFlow / 零一万物 / 讯飞星火 / 阶跃星辰 / OpenAI / Groq / 火山方舟</p>
          <div className="flex items-center gap-2">
            <input type="password" value={importKey} onChange={e => setImportKey(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg font-mono bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
              placeholder="粘贴你的 API Key (如 sk-xxx...)" onKeyDown={e => e.key === 'Enter' && handleAutoImport()} />
            <button onClick={handleAutoImport} disabled={importing}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all flex items-center gap-1.5 ${importing ? 'bg-purple-400 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 shadow-sm'}`}>
              {importing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> 检测中...</>
              ) : '开始检测'}
            </button>
          </div>
          {importResult && (
            <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {importResult.success ? (
                <div>
                  <p className="font-medium text-green-700">检测到: {importResult.provider?.join(' / ')}</p>
                  <div className="mt-2 space-y-1">
                    {importResult.imported?.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={m.action === 'created' ? 'text-green-600' : m.action === 'updated' ? 'text-blue-600' : 'text-red-500'}>
                          {m.action === 'created' ? '+ 新增' : m.action === 'updated' ? '~ 更新' : '✗ 失败'}
                        </span>
                        <span className="text-gray-700">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-red-600">{importResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Token Usage Stats */}
      {showUsage && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="text-lg">📊</span> Token 用量统计（近30天）
            </h4>
            <button onClick={fetchUsage} disabled={usageLoading}
              className="px-2 py-1 text-[10px] font-medium bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors flex items-center gap-1">
              {usageLoading ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : '🔄 刷新'}
            </button>
          </div>

          {usageLoading && !usageData ? (
            <div className="text-center py-6 text-gray-400 text-xs">加载中...</div>
          ) : usageError && !usageData ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-red-400 text-xs">{usageError}</div>
              <button onClick={fetchUsage} className="text-[10px] text-orange-600 hover:text-orange-800 px-3 py-1.5 rounded-lg hover:bg-orange-50 border border-orange-200 transition-colors">重试</button>
            </div>
          ) : usageData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded-lg p-3 border border-orange-100 text-center">
                  <div className="text-[10px] text-gray-400 mb-1">总Token</div>
                  <div className="text-lg font-bold text-orange-600">{formatTokens(usageData.total?.total_tokens)}</div>
                  <div className="text-[10px] text-gray-400">今日 {formatTokens(usageData.today?.total_tokens)}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100 text-center">
                  <div className="text-[10px] text-gray-400 mb-1">输入Token</div>
                  <div className="text-lg font-bold text-blue-600">{formatTokens(usageData.total?.total_prompt)}</div>
                  <div className="text-[10px] text-gray-400">今日 {formatTokens(usageData.today?.total_prompt)}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100 text-center">
                  <div className="text-[10px] text-gray-400 mb-1">输出Token</div>
                  <div className="text-lg font-bold text-green-600">{formatTokens(usageData.total?.total_completion)}</div>
                  <div className="text-[10px] text-gray-400">今日 {formatTokens(usageData.today?.total_completion)}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100 text-center">
                  <div className="text-[10px] text-gray-400 mb-1">预估费用</div>
                  <div className="text-lg font-bold text-red-600">{formatCost(usageData.total?.total_cost)}</div>
                  <div className="text-[10px] text-gray-400">今日 {formatCost(usageData.today?.total_cost)}</div>
                </div>
              </div>

              {/* By Provider Table */}
              {usageData.by_provider?.length > 0 && (
                <div className="bg-white rounded-lg border border-orange-100 overflow-hidden">
                  <div className="px-3 py-2 bg-orange-50/50 border-b border-orange-100">
                    <span className="text-xs font-medium text-gray-600">按模型统计</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-50">
                          <th className="text-left px-3 py-1.5 font-medium">模型</th>
                          <th className="text-right px-3 py-1.5 font-medium">请求次数</th>
                          <th className="text-right px-3 py-1.5 font-medium">输入</th>
                          <th className="text-right px-3 py-1.5 font-medium">输出</th>
                          <th className="text-right px-3 py-1.5 font-medium">总Token</th>
                          <th className="text-right px-3 py-1.5 font-medium">费用</th>
                          <th className="text-right px-3 py-1.5 font-medium">最后使用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageData.by_provider.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="px-3 py-1.5">
                              <span className="font-medium text-gray-700">{TYPE_LABELS[row.provider] || row.provider}</span>
                            </td>
                            <td className="text-right px-3 py-1.5 text-gray-600">{row.requests}</td>
                            <td className="text-right px-3 py-1.5 text-blue-600">{formatTokens(row.prompt_tokens)}</td>
                            <td className="text-right px-3 py-1.5 text-green-600">{formatTokens(row.completion_tokens)}</td>
                            <td className="text-right px-3 py-1.5 font-medium text-gray-700">{formatTokens(row.total_tokens)}</td>
                            <td className="text-right px-3 py-1.5 text-red-600 font-medium">{formatCost(row.cost_yuan)}</td>
                            <td className="text-right px-3 py-1.5 text-gray-400">{row.last_used ? new Date(row.last_used).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Daily Trend */}
              {usageData.daily?.length > 0 && (() => {
                const days = usageData.daily.slice(0, 7)
                const maxTokens = Math.max(...days.map(d => d.total_tokens || 0), 1)
                return (
                  <div className="bg-white rounded-lg border border-orange-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">📊 每日趋势（近{days.length}天）</span>
                      <span className="text-[10px] text-orange-400 font-medium">Token / 费用</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {days.map((day, i) => {
                        const pct = ((day.total_tokens || 0) / maxTokens * 100)
                        const dateStr = day.date ? (day.date.includes('T') ? day.date.slice(5, 10) : String(day.date).slice(5, 10)) : '--'
                        return (
                          <div key={i} className="group px-4 py-2.5 hover:bg-orange-50/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-gray-400 font-mono w-[46px] flex-shrink-0 tabular-nums">{dateStr}</span>
                              <div className="flex-1 min-w-0">
                                <div className="relative h-5 bg-gray-100 rounded-md overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 transition-all duration-500 ease-out flex items-center justify-end pr-2 shadow-sm"
                                    style={{ width: `${Math.max(pct, 6)}%` }}
                                  >
                                    <span className="text-[10px] text-white/90 font-semibold drop-shadow-sm leading-none">{formatTokens(day.total_tokens)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] text-gray-500 font-medium w-[52px] text-right flex-shrink-0 tabular-nums">{formatCost(day.cost_yuan)}</span>
                            </div>
                            {day.requests > 1 && (
                              <div className="ml-[58px] mt-0.5 text-[9px] text-gray-300">{day.requests} 次请求</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {usageData.total?.total_requests === 0 && (
                <div className="text-center py-4 text-gray-400 text-xs">暂无用量数据，使用文案生成功能后将自动记录</div>
              )}
            </>
          ) : !usageLoading ? (
            <div className="text-center py-6 text-gray-400 text-xs">点击"用量统计"按钮加载数据</div>
          ) : null}
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">添加自定义模型</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">供应商标识</label>
              <input className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg" placeholder="如: custom"
                value={addForm.provider} onChange={e => setAddForm(p => ({ ...p, provider: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">显示名称</label>
              <input className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg" placeholder="如: 我的GPT"
                value={addForm.displayName} onChange={e => setAddForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">模型名称</label>
              <input className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg" placeholder="如: gpt-4o"
                value={addForm.modelName} onChange={e => setAddForm(p => ({ ...p, modelName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">API Key</label>
              <input type="password" className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg" placeholder="sk-..."
                value={addForm.apiKey} onChange={e => setAddForm(p => ({ ...p, apiKey: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">API 端点</label>
              <input className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg font-mono" placeholder="https://api.example.com/v1/chat/completions"
                value={addForm.endpoint} onChange={e => setAddForm(p => ({ ...p, endpoint: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">取消</button>
            <button onClick={handleAdd} className="px-4 py-1.5 text-xs bg-wechat-green text-white rounded-lg hover:bg-wechat-green/90">添加</button>
          </div>
        </div>
      )}

      {/* Model Cards — smart sorted */}
      <div className="space-y-2">
        {[...models].sort((a, b) => {
          // active first
          if (a.is_active && !b.is_active) return -1
          if (!a.is_active && b.is_active) return 1
          // enabled before disabled
          if (a.is_enabled && !b.is_enabled) return -1
          if (!a.is_enabled && b.is_enabled) return 1
          // has_key before no_key
          if (a.has_key && !b.has_key) return -1
          if (!a.has_key && b.has_key) return 1
          // healthy before unhealthy
          const hp = s => s === 'healthy' ? 0 : s === 'rate_limited' ? 1 : s === 'unknown' ? 2 : s === 'no_key' ? 3 : 4
          return hp(a.health_status) - hp(b.health_status)
        }).map((m, idx, arr) => {
          // Section dividers
          let divider = null
          const prev = idx > 0 ? arr[idx - 1] : null
          if (idx === 0 && m.is_active) divider = null // no divider for first active
          else if (prev?.is_enabled && !m.is_enabled) divider = <div key={`div-disabled`} className="pt-2 pb-1 flex items-center gap-2"><span className="text-[10px] text-gray-400 font-medium">已禁用</span><div className="flex-1 border-t border-gray-100"/></div>
          else if (prev?.has_key && !m.has_key && m.is_enabled) divider = <div key={`div-nokey`} className="pt-2 pb-1 flex items-center gap-2"><span className="text-[10px] text-gray-400 font-medium">未配置 Key</span><div className="flex-1 border-t border-gray-100"/></div>
          const colors = PROVIDER_COLORS[m.provider] || PROVIDER_COLORS.custom
          const icon = PROVIDER_ICONS[m.provider] || '🔌'
          const result = testResults[m.id]
          const isTesting = testing[m.id]

          return (<React.Fragment key={m.id}>
            {divider}
            <div className={`bg-white rounded-xl border ${m.is_active ? 'border-wechat-green ring-1 ring-wechat-green/20' : !m.is_enabled ? 'border-dashed border-gray-300' : 'border-gray-200'} overflow-hidden transition-all ${!m.is_enabled ? 'opacity-60' : ''}`}>
              <div className="p-3 sm:p-4">
                {/* Top row: name + status badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800 truncate">{m.display_name}</span>
                        {m.is_active && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-wechat-green text-white rounded-full">当前使用</span>}
                        {m.is_free ? <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">免费</span> : null}
                        {/* Health status badge */}
                        {m.health_status === 'healthy' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">● 正常{m.response_ms ? ` ${m.response_ms}ms` : ''}</span>}
                        {m.health_status === 'error' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 rounded-full">● 异常</span>}
                        {m.health_status === 'timeout' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded-full">● 超时</span>}
                        {m.health_status === 'rate_limited' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 rounded-full">● 限流</span>}
                        {m.health_status === 'auth_failed' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 rounded-full">● Key无效</span>}
                        {m.health_status === 'balance_empty' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded-full">● 余额耗尽</span>}
                        {m.health_status === 'no_key' && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">未配置</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border ${colors}`}>{m.provider}</span>
                        <span className="text-[11px] text-gray-400 font-mono truncate">{m.model_name}</span>
                        {m.last_check_at && <span className="text-[10px] text-gray-300">检测: {new Date(m.last_check_at).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!m.is_active && m.has_key && m.is_enabled && (
                      <button onClick={() => handleActivate(m)} title="设为当前使用"
                        className="p-1.5 text-xs bg-wechat-green/10 text-wechat-green rounded-lg hover:bg-wechat-green/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      </button>
                    )}
                    {!m.is_enabled && (
                      <button onClick={() => handleToggleEnabled(m)} title="启用此模型"
                        className="px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors">
                        启用
                      </button>
                    )}
                    <button onClick={() => handleCheckSingle(m)} disabled={checkingId === m.id || !m.has_key} title="健康检测"
                      className={`p-1.5 text-xs rounded-lg transition-colors ${!m.has_key ? 'text-gray-300 cursor-not-allowed' : checkingId === m.id ? 'bg-blue-50 text-blue-600 animate-pulse' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                      {checkingId === m.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      )}
                    </button>
                    <button onClick={() => handleTest(m)} disabled={isTesting || !m.has_key} title="测试连接"
                      className={`p-1.5 text-xs rounded-lg transition-colors ${!m.has_key ? 'text-gray-300 cursor-not-allowed' : isTesting ? 'bg-yellow-50 text-yellow-600 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                      {isTesting ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      )}
                    </button>
                    <button onClick={() => handleToggleEnabled(m)} title={m.is_enabled ? '禁用' : '启用'}
                      className={`p-1.5 text-xs rounded-lg transition-colors ${m.is_enabled ? 'bg-gray-50 text-gray-500 hover:bg-gray-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{m.is_enabled ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"/>}</svg>
                    </button>
                    {!m.is_active && (
                      <button onClick={() => handleDelete(m)} title="删除"
                        className="p-1.5 text-xs text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* API Key row */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">API Key:</span>
                  {editingKey === m.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border rounded-lg font-mono" placeholder="输入新的 API Key" autoFocus />
                      <button onClick={() => handleSaveKey(m)} className="px-2 py-1 text-[10px] bg-wechat-green text-white rounded-lg">保存</button>
                      <button onClick={() => { setEditingKey(null); setKeyInput('') }} className="px-2 py-1 text-[10px] text-gray-400">取消</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-mono ${m.has_key ? 'text-gray-600' : 'text-red-400'}`}>
                        {m.has_key ? m.api_key_masked : '未配置'}
                      </span>
                      <button onClick={() => { setEditingKey(m.id); setKeyInput('') }}
                        className="text-[10px] text-blue-500 hover:text-blue-700">
                        {m.has_key ? '修改' : '配置'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Endpoint */}
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">端点:</span>
                  <span className="text-[11px] text-gray-400 font-mono truncate">{m.endpoint}</span>
                </div>

                {/* Health error detail */}
                {m.last_error && m.health_status !== 'healthy' && (
                  <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-red-50/60 border border-red-100 text-[11px] text-red-500 truncate">
                    ⚠️ {m.last_error}{m.consecutive_fails > 1 ? ` (连续${m.consecutive_fails}次)` : ''}
                  </div>
                )}

                {/* Test result */}
                {result && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {result.success ? (
                      <div>
                        <span className="font-medium">✅ 连接成功</span>
                        <span className="ml-2 text-green-500">模型: {result.model}</span>
                        {result.reply && <p className="mt-1 text-green-600/80 italic">"{result.reply}"</p>}
                      </div>
                    ) : (
                      <div><span className="font-medium">❌ 连接失败</span><span className="ml-2">{result.error}</span></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>)
        })}
      </div>

      {models.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">暂无模型配置</div>
      )}
    </div>
  )
}
