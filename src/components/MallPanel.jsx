import React, { useState, useEffect, useCallback } from 'react'

const STATUS_MAP = { active: '上架', draft: '草稿', archived: '已下架', sold_out: '售罄' }
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-600', archived: 'bg-yellow-100 text-yellow-700', sold_out: 'bg-red-100 text-red-600' }

export default function MallPanel({ adminFetch }) {
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(null)
  const [recStats, setRecStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', category: '', price: '', originalPrice: '', description: '', imageUrl: '', tags: '', targetAudience: '', status: 'draft' })
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProductAssist, setAiProductAssist] = useState(false)
  const [aiProductDesc, setAiProductDesc] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

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

  useEffect(() => { fetchProducts(); fetchStats() }, [fetchProducts, fetchStats])

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
  async function handleOptimize(id) { showToast('AI优化中...'); try { await adminFetch('/api/admin/mall/products/' + id + '/optimize', { method: 'POST' }); showToast('优化完成'); fetchProducts() } catch { showToast('优化失败') } }
  async function handleBatchOptimize() { showToast('批量优化中...'); try { const d = await (await adminFetch('/api/admin/mall/products/batch-optimize', { method: 'POST' })).json(); showToast('优化了' + (d.optimized || 0) + '个商品') ; fetchProducts() } catch { showToast('失败') } }

  return (
    <div className="h-full flex flex-col">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center gap-1.5 px-4 lg:px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        {[{k:'products',l:'商品管理',i:'🛒'},{k:'stats',l:'数据统计',i:'📊'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab===t.k?'bg-indigo-50 text-indigo-700 shadow-sm':'text-gray-500 hover:bg-gray-50'}`}>{t.i} {t.l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 gpu-scroll">
        {tab === 'products' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">🛒 商品列表 ({products.length})</span>
              <div className="flex-1" />
              <button disabled={aiGenerating} onClick={async () => { setAiGenerating(true); showToast('🤖 AI正在分析用户需求，自动生成商品...'); try { const d = await (await adminFetch('/api/admin/mall/products/ai-generate', { method: 'POST' })).json(); showToast(d.created > 0 ? `✅ AI成功创建${d.created}个商品草稿！` : '💡 暂无新商品建议'); fetchProducts(); fetchStats() } catch { showToast('❌ AI生成失败') } finally { setAiGenerating(false) } }}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${aiGenerating ? 'bg-amber-200 text-amber-700 cursor-wait' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                {aiGenerating ? '⏳ AI生成中...' : 'AI自动生成'}
              </button>
              <button onClick={handleBatchOptimize} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium">AI批量优化</button>
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
                      className={`px-4 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all ${aiProductAssist ? 'bg-purple-200 text-purple-700 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
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
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      {p.image_url && <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                        <button onClick={()=>startEdit(p)} className="px-2 py-1 text-[11px] bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 font-medium">编辑</button>
                        <button onClick={()=>handleOptimize(p.id)} className="px-2 py-1 text-[11px] bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 font-medium">AI优化</button>
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
