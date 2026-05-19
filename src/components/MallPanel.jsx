/**
 * @fileoverview 商城商品管理面板（管理员专用）
 * 提供商品的创建、编辑、删除、AI优化和统计功能
 *
 * 核心功能：
 *   - 商品管理：增删改查商品，支持上架/下架/草稿状态
 *   - AI 辅助：AI 自动生成商品、AI 填充表单、AI 批量优化商品描述
 *   - 数据统计：总商品数、上架数、浏览/购买统计、推荐效果分析
 *   - 推荐系统：商品推荐分、推荐展示/点击/购买转化追踪
 *
 * 商品状态：
 *   - active: 上架（绿色）
 *   - draft: 草稿（灰色）
 *   - archived: 已下架（黄色）
 *   - sold_out: 售罄（红色）
 *
 * 关键依赖：
 *   - adminFetch: 带认证的 fetch 函数
 *   - 后端接口: /api/admin/mall/products, /api/admin/mall/products/stats,
 *               /api/admin/mall/recommendations/stats, /api/admin/ai-assist
 *
 * 注意事项：
 *   - tags 和 targetAudience 以逗号分隔字符串存储，保存时转为数组
 *   - AI 辅助调用 POST /api/admin/ai-assist，type 为 'product'
 *   - AI 自动生成商品调用 POST /api/admin/mall/products/ai-generate
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import AdminJobProgressModal from './AdminJobProgressModal.jsx'
import MallAiChat from './MallAiChat.jsx'

/** 商品状态中文映射 */
const STATUS_MAP = { active: '上架', draft: '草稿', archived: '已下架', sold_out: '售罄' }
/** 商品状态对应的 Tailwind CSS 样式类 */
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-600', archived: 'bg-yellow-100 text-yellow-700', sold_out: 'bg-red-100 text-red-600' }

/**
 * 商城商品管理面板（管理员专用）
 *
 * 提供两个子标签页：
 *   1. 商品管理：商品列表、AI自动生成、AI辅助填写、CRUD操作
 *   2. 数据统计：总览统计卡片、推荐效果、分类分布
 *
 * @param {Object} props
 * @param {Function} props.adminFetch - 带管理员认证的 fetch 函数
 * @returns {JSX.Element} 商城管理面板 UI
 */
export default function MallPanel({ adminFetch }) {
  /** 当前标签页: products | stats */
  const [tab, setTab] = useState('products')
  /** 商品列表数组 */
  const [products, setProducts] = useState([])
  /** 商品统计数据对象 */
  const [stats, setStats] = useState(null)
  /** 推荐统计数据对象 */
  const [recStats, setRecStats] = useState(null)
  /** 推荐审核列表 */
  const [recList, setRecList] = useState([])
  const [recLoading, setRecLoading] = useState(false)
  const [recStatusFilter, setRecStatusFilter] = useState('pending')
  /** 是否正在加载数据 */
  const [loading, setLoading] = useState(false)
  /** Toast 消息文本，空字符串表示不显示 */
  const [toast, setToast] = useState('')
  /** 是否显示创建/编辑表单 */
  const [showForm, setShowForm] = useState(false)
  /** 正在编辑的商品 ID，null 表示新建模式 */
  const [editingId, setEditingId] = useState(null)
  /** 表单数据: { name, category, price, originalPrice, description, imageUrl, tags, targetAudience, status } */
  const [form, setForm] = useState({ name: '', category: '', price: '', originalPrice: '', description: '', imageUrl: '', tags: '', targetAudience: '', status: 'draft' })
  /** AI 自动生成是否进行中 */
  const [aiGenerating, setAiGenerating] = useState(false)
  /** AI 辅助填充是否进行中 */
  const [aiProductAssist, setAiProductAssist] = useState(false)
  /** AI 辅助输入的商品描述 */
  const [aiProductDesc, setAiProductDesc] = useState('')
  const [jobModal, setJobModal] = useState(null)
  const [batchOptimizing, setBatchOptimizing] = useState(false)
  const [optimizingId, setOptimizingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const pollRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const jobBusy = jobModal?.open && jobModal?.status === 'running'

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/mall/products')).json()
      setProducts(data.products || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [adminFetch])

  const fetchStats = useCallback(async () => {
    try {
      const [s, r] = await Promise.allSettled([
        adminFetch('/api/admin/mall/products/stats').then(r => r.json()),
        adminFetch('/api/admin/mall/recommendations/stats').then(r => r.json()),
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (r.status === 'fulfilled') setRecStats(r.value)
    } catch (e) { console.error(e) }
  }, [adminFetch])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const closeJobModal = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    setJobModal(null)
    setAiGenerating(false)
    setBatchOptimizing(false)
    setOptimizingId(null)
  }

  const applyJobToBusyFlags = useCallback((jobType, running) => {
    if (!running) {
      setAiGenerating(false)
      setBatchOptimizing(false)
      setOptimizingId(null)
      return
    }
    if (jobType === 'mall_ai_generate') setAiGenerating(true)
    else if (jobType === 'mall_batch_optimize') setBatchOptimizing(true)
    else if (jobType === 'mall_optimize_one') setOptimizingId(null)
  }, [])

  const syncJobModal = useCallback((j, title) => {
    setJobModal({
      open: true,
      jobId: j.id,
      title: title || j.title,
      status: j.status,
      message: j.message,
      current: j.current,
      total: j.total,
      error: j.error,
      phase: j.phase,
      log: j.log || [],
      startedAt: j.createdAt ? new Date(j.createdAt).getTime() : Date.now(),
    })
    applyJobToBusyFlags(j.type, j.status === 'running')
    if (j.type === 'mall_optimize_one' && j.meta?.productId) setOptimizingId(j.meta.productId)
  }, [applyJobToBusyFlags])

  const pollAdminJob = useCallback((jobId, title) => {
    if (pollRef.current) clearInterval(pollRef.current)
    const pollOnce = async () => {
      try {
        const j = await (await adminFetch(`/api/admin/jobs/${jobId}`)).json()
        setJobModal((m) => ({
          ...m,
          open: true,
          jobId: j.id,
          title: title || m?.title,
          status: j.status,
          message: j.message,
          current: j.current,
          total: j.total,
          error: j.error,
          phase: j.phase,
          log: j.log || [],
        }))
        applyJobToBusyFlags(j.type, j.status === 'running')
        if (j.status === 'done') {
          clearInterval(pollRef.current)
          pollRef.current = null
          applyJobToBusyFlags(j.type, false)
          fetchProducts()
          fetchStats()
          const created = j.result?.created
          if (created != null) {
            showToast(created > 0 ? `✅ AI 成功创建 ${created} 个商品草稿` : '💡 暂无新商品建议')
          } else if (j.result?.optimized != null) {
            showToast(`✅ 优化了 ${j.result.optimized} 个商品`)
          } else {
            showToast('✅ 任务完成')
          }
        }
        if (j.status === 'failed') {
          clearInterval(pollRef.current)
          pollRef.current = null
          applyJobToBusyFlags(j.type, false)
          showToast('❌ ' + (j.error || '任务失败'))
        }
      } catch {
        /* ignore poll errors */
      }
    }
    setJobModal({
      open: true,
      jobId,
      title,
      status: 'running',
      message: '任务已启动…',
      current: 0,
      total: 0,
      log: [],
      startedAt: Date.now(),
    })
    pollOnce()
    pollRef.current = setInterval(pollOnce, 800)
  }, [adminFetch, fetchProducts, fetchStats, applyJobToBusyFlags])

  const startAdminJob = useCallback(async (url, title, setBusy) => {
    setBusy?.(true)
    try {
      const res = await adminFetch(url, { method: 'POST' })
      const d = await res.json()
      // #region agent log
      fetch('http://localhost:7822/ingest/018bf018-a48c-4eaa-9127-55349663cb6a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'48900f'},body:JSON.stringify({sessionId:'48900f',location:'MallPanel:startAdminJob',message:'job start response',data:{url,httpStatus:res.status,jobId:d.jobId?.slice(0,8),error:d.error},hypothesisId:'H-FE-job',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (res.status === 409 && d.jobId) {
        setBusy?.(false)
        showToast(d.error || '已有任务进行中，已打开进度窗口')
        if (d.job) syncJobModal({ ...d.job, title: d.title || title })
        else pollAdminJob(d.jobId, d.title || title)
        return
      }
      if (!res.ok) throw new Error(d.error || '启动失败')
      if (d.jobId) pollAdminJob(d.jobId, title)
      else throw new Error('未返回任务 ID')
    } catch (e) {
      setBusy?.(false)
      showToast('❌ ' + e.message)
    }
  }, [adminFetch, pollAdminJob, syncJobModal])

  const resumeActiveMallJob = useCallback(async () => {
    try {
      const d = await (await adminFetch('/api/admin/jobs/active/mall')).json()
      if (d.job?.id && d.job.status === 'running') {
        syncJobModal({ ...d.job, title: d.title })
        pollAdminJob(d.job.id, d.title)
      }
    } catch { /* ignore */ }
  }, [adminFetch, pollAdminJob, syncJobModal])

  const handleCancelJob = useCallback(async () => {
    if (!jobModal?.jobId) return
    if (!confirm('确定取消当前任务？后台可能仍在执行几步后停止。')) return
    try {
      await adminFetch(`/api/admin/jobs/${jobModal.jobId}/cancel`, { method: 'POST', body: JSON.stringify({}) })
      const j = await (await adminFetch(`/api/admin/jobs/${jobModal.jobId}`)).json()
      setJobModal((m) => ({ ...m, status: j.status, message: j.message, error: j.error, phase: j.phase, log: j.log || [] }))
      applyJobToBusyFlags(j.type, false)
      setAiGenerating(false)
      setBatchOptimizing(false)
      setOptimizingId(null)
      showToast('任务已取消')
    } catch (e) {
      showToast('取消失败: ' + e.message)
    }
  }, [adminFetch, jobModal?.jobId, applyJobToBusyFlags])

  const fetchRecommendations = useCallback(async () => {
    setRecLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50' })
      if (recStatusFilter) params.set('status', recStatusFilter)
      const d = await (await adminFetch(`/api/admin/mall/recommendations?${params}`)).json()
      setRecList(d.list || [])
    } catch (e) { showToast('加载失败: ' + e.message) }
    finally { setRecLoading(false) }
  }, [adminFetch, recStatusFilter])

  useEffect(() => { fetchProducts(); fetchStats(); resumeActiveMallJob() }, [fetchProducts, fetchStats, resumeActiveMallJob])
  useEffect(() => { if (tab === 'recommendations') fetchRecommendations() }, [tab, fetchRecommendations])

  async function handleRecStatus(id, status) {
    try {
      const res = await (await adminFetch(`/api/mall/recommendations/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })).json()
      if (res.success) {
        showToast(status === 'shown' ? '已通过展示' : status === 'dismissed' ? '已拒绝' : '已更新')
        fetchRecommendations()
        fetchStats()
      } else showToast(res.error || '操作失败')
    } catch (e) { showToast('操作失败: ' + e.message) }
  }

  async function handleSave() {
    try {
      const body = {
        ...form,
        price: parseFloat(form.price) || 0,
        originalPrice: parseFloat(form.originalPrice) || 0,
        tags: form.tags ? form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [],
        targetAudience: form.targetAudience ? form.targetAudience.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [],
      }
      if (editingId) {
        await adminFetch('/api/admin/mall/products/' + editingId, { method: 'PUT', body: JSON.stringify(body) })
        showToast('商品已更新')
      } else {
        if (!body.name) { showToast('请输入商品名称'); return }
        await adminFetch('/api/admin/mall/products', { method: 'POST', body: JSON.stringify(body) })
        showToast('商品已创建')
      }
      setShowForm(false); setEditingId(null)
      setForm({ name: '', category: '', price: '', originalPrice: '', description: '', imageUrl: '', tags: '', targetAudience: '', status: 'draft' })
      fetchProducts(); fetchStats()
    } catch (e) { showToast('保存失败: ' + e.message) }
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      name: p.name, category: p.category || '', price: String(p.price || ''), originalPrice: String(p.original_price || ''),
      description: p.description || '', imageUrl: p.image_url || '',
      tags: (p.tags || []).join(', '), targetAudience: (p.target_audience || []).join(', '), status: p.status,
    })
    setShowForm(true)
  }

  async function handleAIAssistProduct() {
    if (!aiProductDesc.trim()) { showToast('请输入商品描述'); return }
    setAiProductAssist(true)
    try {
      const data = await (await adminFetch('/api/admin/ai-assist', {
        method: 'POST', body: JSON.stringify({ type: 'product', description: aiProductDesc.trim() }),
      })).json()
      if (data.product) {
        setForm(f => ({
          ...f,
          name: data.product.name || f.name,
          category: data.product.category || f.category,
          price: data.product.price != null ? String(data.product.price) : f.price,
          originalPrice: data.product.originalPrice != null ? String(data.product.originalPrice) : f.originalPrice,
          description: data.product.description || f.description,
          tags: Array.isArray(data.product.tags) ? data.product.tags.join(', ') : (data.product.tags || f.tags),
          targetAudience: Array.isArray(data.product.targetAudience) ? data.product.targetAudience.join(', ') : (data.product.targetAudience || f.targetAudience),
        }))
        showToast('✅ AI已填充商品信息')
      } else {
        showToast('AI生成失败: ' + (data.error || '未知错误'))
      }
    } catch (e) { showToast('AI辅助失败: ' + e.message) }
    setAiProductAssist(false)
  }

  async function handleDelete(id) { if (!confirm('确定删除?')) return; await adminFetch('/api/admin/mall/products/' + id, { method: 'DELETE' }); showToast('已删除'); fetchProducts(); fetchStats() }
  async function handleOptimize(id) {
    setOptimizingId(id)
    await startAdminJob(`/api/admin/mall/products/${id}/optimize`, 'AI 优化商品', (busy) => {
      if (!busy) setOptimizingId(null)
    })
  }
  async function handleBatchOptimize() {
    setBatchOptimizing(true)
    await startAdminJob('/api/admin/mall/products/batch-optimize', 'AI 批量优化商品', setBatchOptimizing)
  }
  async function handleAiGenerate() {
    setAiGenerating(true)
    await startAdminJob('/api/admin/mall/products/ai-generate', 'AI 自动生成商品', setAiGenerating)
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(products.map((p) => p.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  async function handleBatchStatus(status) {
    const ids = [...selectedIds]
    if (!ids.length) {
      showToast('请先勾选商品')
      return
    }
    const label = STATUS_MAP[status] || status
    if (!confirm(`确定将选中的 ${ids.length} 个商品设为「${label}」？`)) return
    setBatchLoading(true)
    try {
      const d = await (await adminFetch('/api/admin/mall/products/batch-status', {
        method: 'POST',
        body: JSON.stringify({ ids, status }),
      })).json()
      if (d.success === false && d.error) throw new Error(d.error)
      const updated = d.updated ?? 0
      // #region agent log
      fetch('http://localhost:7822/ingest/018bf018-a48c-4eaa-9127-55349663cb6a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'48900f'},body:JSON.stringify({sessionId:'48900f',location:'MallPanel:handleBatchStatus',message:'batch result',data:{status,ids:ids.slice(0,20),updated},hypothesisId:'H-FE-batch',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (updated <= 0) {
        showToast(`⚠️ 未更新任何商品，请确认已勾选有效 ID（#${ids.join(', #')}）`)
        return
      }
      const idHint = ids.length <= 5 ? `（#${ids.join(', #')}）` : ''
      showToast(`✅ 已更新 ${updated} 个商品为「${label}」${idHint}`)
      clearSelection()
      fetchProducts()
      fetchStats()
    } catch (e) {
      // #region agent log
      fetch('http://localhost:7822/ingest/018bf018-a48c-4eaa-9127-55349663cb6a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'48900f'},body:JSON.stringify({sessionId:'48900f',location:'MallPanel:handleBatchStatus',message:'batch error',data:{error:e.message},hypothesisId:'H-FE-batch',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      showToast('❌ ' + e.message)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleQuickStatus(id, status) {
    try {
      const d = await (await adminFetch('/api/admin/mall/products/batch-status', {
        method: 'POST',
        body: JSON.stringify({ ids: [id], status }),
      })).json()
      if (d.error) throw new Error(d.error)
      showToast(`商品 #${id} 已${STATUS_MAP[status] || status}`)
      fetchProducts()
      fetchStats()
    } catch (e) {
      showToast('❌ ' + e.message)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <AdminJobProgressModal job={jobModal} title={jobModal?.title} onClose={closeJobModal} onCancel={handleCancelJob} />
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center gap-1.5 px-4 lg:px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        {[{k:'products',l:'商品管理',i:'🛒'},{k:'ai-chat',l:'AI对话',i:'🤖'},{k:'recommendations',l:'推荐审核',i:'✅'},{k:'stats',l:'数据统计',i:'📊'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab===t.k?'bg-indigo-50 text-indigo-700 shadow-sm':'text-gray-500 hover:bg-gray-50'}`}>{t.i} {t.l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 gpu-scroll">
        {tab === 'products' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">🛒 商品列表 ({products.length})</span>
              {selectedIds.size > 0 && (
                <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">已选 {selectedIds.size}</span>
              )}
              {selectedIds.size > 0 && (
                <>
                  <button type="button" disabled={batchLoading} onClick={() => handleBatchStatus('active')}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium disabled:opacity-50">
                    {batchLoading ? '处理中…' : '批量上架'}
                  </button>
                  <button type="button" disabled={batchLoading} onClick={() => handleBatchStatus('archived')}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium disabled:opacity-50">
                    批量下架
                  </button>
                  <button type="button" onClick={clearSelection} className="px-2 py-1.5 text-xs text-gray-500">取消选择</button>
                </>
              )}
              <button type="button" onClick={selectAllVisible} className="px-2 py-1.5 text-xs text-gray-500 hover:text-indigo-600">全选</button>
              <div className="flex-1" />
              <button disabled={aiGenerating || jobBusy} onClick={handleAiGenerate}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${aiGenerating || jobBusy ? 'bg-amber-200 text-amber-700 animate-pulse cursor-wait' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                {aiGenerating || jobBusy ? '⏳ AI生成中...' : 'AI自动生成'}
              </button>
              <button disabled={batchOptimizing || jobBusy} onClick={handleBatchOptimize}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium ${batchOptimizing || jobBusy ? 'bg-purple-200 text-purple-700 animate-pulse cursor-wait' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
                {batchOptimizing || jobBusy ? '⏳ 批量优化中...' : 'AI批量优化'}
              </button>
              <button onClick={() => { setEditingId(null); setForm({ name:'',category:'',price:'',originalPrice:'',description:'',imageUrl:'',tags:'',targetAudience:'',status:'draft' }); setShowForm(true) }}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">+ 添加商品</button>
            </div>

            {showForm && (
              <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-indigo-700">{editingId ? '编辑商品' : '添加商品'}</h3>
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-purple-700">🤖 AI辅助填写</span>
                    <span className="text-[10px] text-purple-400">描述你想要的商品，AI自动生成全部信息</span>
                  </div>
                  <div className="flex gap-2">
                    <input value={aiProductDesc} onChange={e => setAiProductDesc(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      placeholder="如：一个帮助游戏行业商户处理涉赌封号的VIP申诉服务" />
                    <button onClick={handleAIAssistProduct} disabled={aiProductAssist}
                      className={`px-4 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all ${aiProductAssist ? 'bg-purple-200 text-purple-700 animate-pulse cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                      {aiProductAssist ? '⏳ 生成中...' : '✨ AI填充'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] text-gray-500 block mb-1">商品名称 *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" /></div>
                  <div><label className="text-[11px] text-gray-500 block mb-1">分类</label><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="如: 申诉服务" /></div>
                  <div><label className="text-[11px] text-gray-500 block mb-1">售价 (元)</label><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" /></div>
                  <div><label className="text-[11px] text-gray-500 block mb-1">原价</label><input type="number" value={form.originalPrice} onChange={e=>setForm(f=>({...f,originalPrice:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" /></div>
                </div>
                <div><label className="text-[11px] text-gray-500 block mb-1">商品描述</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={3} /></div>
                <div><label className="text-[11px] text-gray-500 block mb-1">图片URL</label><input value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] text-gray-500 block mb-1">标签 (逗号分隔)</label><input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="申诉, 合规, 法律" /></div>
                  <div><label className="text-[11px] text-gray-500 block mb-1">目标客户 (逗号分隔)</label><input value={form.targetAudience} onChange={e=>setForm(f=>({...f,targetAudience:e.target.value}))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="游戏商户, 支付商户" /></div>
                </div>
                <div><label className="text-[11px] text-gray-500 block mb-1">状态</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                    {Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">保存</button>
                  <button onClick={()=>{setShowForm(false);setEditingId(null)}} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm">取消</button>
                </div>
              </div>
            )}

            {loading && products.length === 0 ? <div className="text-center py-8 text-gray-400">加载中...</div> : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-4 ${selectedIds.has(p.id) ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" aria-label={`选择商品 ${p.id}`} />
                      {p.image_url && <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">ID #{p.id}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]||''}`}>{STATUS_MAP[p.status]||p.status}</span>
                          {p.category && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{p.category}</span>}
                          {p.ai_optimized_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">AI优化</span>}
                        </div>
                        <div className="text-sm font-medium text-gray-800">{p.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{p.ai_description || p.description || '暂无描述'}</div>
                        <div className="flex items-center gap-3 mt-2 text-[11px]">
                          {parseFloat(p.price) > 0 && <span className="font-bold text-red-500">¥{p.price}</span>}
                          {parseFloat(p.original_price) > 0 && parseFloat(p.original_price) > parseFloat(p.price) && <span className="line-through text-gray-400">¥{p.original_price}</span>}
                          <span className="text-gray-400">推荐分 {parseFloat(p.recommendation_score||0).toFixed(0)}</span>
                          <span className="text-gray-400">浏览{p.view_count} 点击{p.click_count} 购买{p.purchase_count}</span>
                          {(p.tags||[]).length > 0 && <div className="flex gap-1">{p.tags.slice(0,3).map((t,i)=><span key={i} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px]">{t}</span>)}</div>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {p.status !== 'active' && (
                          <button type="button" onClick={() => handleQuickStatus(p.id, 'active')} className="px-2 py-1 text-[11px] bg-green-50 text-green-700 rounded-md hover:bg-green-100 font-medium">上架</button>
                        )}
                        {p.status === 'active' && (
                          <button type="button" onClick={() => handleQuickStatus(p.id, 'archived')} className="px-2 py-1 text-[11px] bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 font-medium">下架</button>
                        )}
                        <button onClick={()=>startEdit(p)} className="px-2 py-1 text-[11px] bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 font-medium">编辑</button>
                        <button disabled={optimizingId === p.id || jobBusy} onClick={()=>handleOptimize(p.id)} className={`px-2 py-1 text-[11px] rounded-md font-medium ${optimizingId === p.id || jobBusy ? 'bg-purple-200 text-purple-700 cursor-wait' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>{optimizingId === p.id ? '优化中…' : 'AI优化'}</button>
                        <button onClick={()=>handleDelete(p.id)} className="px-2 py-1 text-[11px] bg-red-50 text-red-500 rounded-md hover:bg-red-100 font-medium">删除</button>
                      </div>
                    </div>
                  </div>
                ))}
                {products.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">暂无商品，点击上方添加</div>}
              </div>
            )}
          </>
        )}

        {tab === 'ai-chat' && (
          <MallAiChat
            adminFetch={adminFetch}
            showToast={showToast}
            onRefresh={() => { fetchProducts(); fetchStats() }}
            onTriggerAutoGenerate={async () => {
              setTab('products')
              await handleAiGenerate()
            }}
            jobBusy={jobBusy}
          />
        )}

        {tab === 'recommendations' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">推荐记录审核</span>
              <select value={recStatusFilter} onChange={e => setRecStatusFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
                <option value="">全部状态</option>
                <option value="pending">待审核</option>
                <option value="shown">已展示</option>
                <option value="dismissed">已拒绝</option>
                <option value="clicked">已点击</option>
                <option value="purchased">已购买</option>
              </select>
              <button type="button" onClick={fetchRecommendations} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">刷新</button>
            </div>
            {recLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
            ) : recList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">暂无推荐记录</div>
            ) : (
              <div className="space-y-2">
                {recList.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800">{r.product_name || `商品 #${r.product_id}`}</div>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{r.reason || '无推荐理由'}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-gray-400">
                        <span>匹配分 {parseFloat(r.match_score || 0).toFixed(1)}</span>
                        <span>状态 {r.status}</span>
                        <span>用户 {r.user_id || '-'}</span>
                        <span>{r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : ''}</span>
                      </div>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button type="button" onClick={() => handleRecStatus(r.id, 'shown')} className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100">通过</button>
                        <button type="button" onClick={() => handleRecStatus(r.id, 'dismissed')} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100">拒绝</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'stats' && (
          <>
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{stats.totals?.total || 0}</div><div className="text-[11px] text-gray-400">总商品</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.totals?.active || 0}</div><div className="text-[11px] text-gray-400">上架中</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totals?.total_views || 0}</div><div className="text-[11px] text-gray-400">总浏览</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{stats.totals?.total_purchases || 0}</div><div className="text-[11px] text-gray-400">总购买</div>
                </div>
              </div>
            )}
            {recStats && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">📊 推荐效果</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div><div className="text-lg font-bold text-indigo-600">{recStats.totals?.total || 0}</div><div className="text-[10px] text-gray-400">总推荐</div></div>
                  <div><div className="text-lg font-bold text-blue-600">{recStats.totals?.shown || 0}</div><div className="text-[10px] text-gray-400">已展示</div></div>
                  <div><div className="text-lg font-bold text-green-600">{recStats.totals?.clicked || 0}</div><div className="text-[10px] text-gray-400">已点击</div></div>
                  <div><div className="text-lg font-bold text-red-500">{recStats.totals?.purchased || 0}</div><div className="text-[10px] text-gray-400">已购买</div></div>
                </div>
                {recStats.topProducts?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] text-gray-500 font-medium">热门推荐商品</div>
                    {recStats.topProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{p.name}</span>
                        <span className="text-gray-400">推荐{p.rec_count} / 点击{p.clicks || 0} / 购买{p.purchases || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {stats?.byCategory?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">分类分布</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.byCategory.map(c => (
                    <div key={c.category} className="px-3 py-2 bg-indigo-50 rounded-lg">
                      <div className="text-sm font-medium text-indigo-700">{c.category}</div>
                      <div className="text-[10px] text-gray-500">{c.cnt}个 · 推荐分{parseFloat(c.avg_score||0).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
