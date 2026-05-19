import React, { useState, useEffect, useCallback, useRef } from 'react'

export default function XianyuPanel({ adminFetch, showToast }) {
  const [shops, setShops] = useState([])
  const [shopId, setShopId] = useState('')
  const [balance, setBalance] = useState(null)
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [stockModal, setStockModal] = useState(null)
  const [stockValue, setStockValue] = useState('')
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', price: '', stock: '', images: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [brokenImages, setBrokenImages] = useState({})
  const productsReqId = useRef(0)

  const toast = (msg) => showToast?.(msg)

  const productImageSrc = (url) => {
    if (!url) return ''
    let u = url
    if (/\.heic(\?|$)/i.test(u)) {
      u = `${u}${u.includes('?') ? '&' : '?'}x-oss-process=image/format,jpg/quality,Q_85`
    }
    if (/alicdn\.com|goofish\.(com|pro)/i.test(u)) {
      const params = new URLSearchParams({ url: u })
      const token = localStorage.getItem('admin_token')
      if (token) params.set('token', token)
      return `/api/xianyu/image-proxy?${params}`
    }
    return u
  }

  const fetchShops = useCallback(async () => {
    try {
      const res = await (await adminFetch('/api/xianyu/shops?page=1&pageSize=50&refresh=1')).json()
      if (res.success) {
        const list = res.data?.list || []
        setShops(list)
        // 默认「全部店铺」，避免按单店 seller_id 签名时列表为空
      }
    } catch (e) { console.error(e) }
  }, [adminFetch, shopId])

  const fetchBalance = useCallback(async () => {
    try {
      const res = await (await adminFetch('/api/xianyu/balance')).json()
      if (res.success) setBalance(res.data)
    } catch { setBalance(null) }
  }, [adminFetch])

  const fetchProducts = useCallback(async (p = page, opts = {}) => {
    const reqId = ++productsReqId.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
      if (shopId) params.set('shopId', shopId)
      if (keyword.trim()) params.set('keyword', keyword.trim())
      if (opts.refresh) params.set('refresh', '1')
      const res = await (await adminFetch(`/api/xianyu/products?${params}`)).json()
      if (reqId !== productsReqId.current) return
      if (res.success) {
        const list = res.data?.list || []
        setProducts(list)
        setTotal(Math.max(Number(res.data?.total) || 0, list.length))
      } else {
        toast(res.error || '加载商品失败')
        setProducts([])
      }
    } catch (e) {
      if (reqId === productsReqId.current) toast('加载失败: ' + e.message)
    } finally {
      if (reqId === productsReqId.current) setLoading(false)
    }
  }, [adminFetch, page, pageSize, shopId, keyword, showToast])

  useEffect(() => { fetchShops(); fetchBalance() }, [fetchShops, fetchBalance])
  useEffect(() => { fetchProducts(page, { refresh: true }) }, [shopId, page])

  async function handlePublish(productId, publish) {
    const userNames = window.prompt('发布账号（闲鱼 user_name，多个用逗号分隔）', '')
    if (!userNames?.trim()) return
    const names = userNames.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    const path = publish ? 'publish' : 'unpublish'
    try {
      const res = await (await adminFetch(`/api/xianyu/products/${productId}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ shopId, userNames: names }),
      })).json()
      if (res.success) { toast(publish ? '上架成功' : '下架成功'); fetchProducts(page) }
      else toast(res.error || '操作失败')
    } catch (e) { toast(e.message) }
  }

  async function handleDelete(productId) {
    if (!window.confirm('确定删除该商品？')) return
    try {
      const q = shopId ? `?shopId=${encodeURIComponent(shopId)}` : ''
      const res = await (await adminFetch(`/api/xianyu/products/${productId}${q}`, { method: 'DELETE' })).json()
      if (res.success) { toast('已删除'); fetchProducts(page) }
      else toast(res.error || '删除失败')
    } catch (e) { toast(e.message) }
  }

  async function openEditModal(product) {
    setEditModal(product)
    setEditForm({
      title: product.title || '',
      price: product.price != null ? String(product.price) : '',
      stock: product.stock != null ? String(product.stock) : '',
      images: (product.images?.length ? product.images : (product.first_image ? [product.first_image] : [])).join('\n'),
    })
    if (!shopId) return
    setEditLoading(true)
    try {
      const q = `?shopId=${encodeURIComponent(shopId)}`
      const res = await (await adminFetch(`/api/xianyu/products/${product.product_id}${q}`)).json()
      if (res.success && res.data) {
        const d = res.data
        setEditForm({
          title: d.title || '',
          price: d.price != null ? String(d.price) : '',
          stock: d.stock != null ? String(d.stock) : '',
          images: (d.images?.length ? d.images : []).join('\n'),
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setEditLoading(false)
    }
  }

  async function handleEditSave() {
    if (!editModal) return
    const images = editForm.images.split(/\n/).map(s => s.trim()).filter(Boolean)
    const payload = {
      shopId,
      title: editForm.title.trim(),
    }
    if (editForm.price !== '') payload.price = parseFloat(editForm.price)
    if (editForm.stock !== '') payload.stock = parseInt(editForm.stock, 10)
    if (images.length) payload.images = images
    if (!shopId) {
      toast('请先选择店铺后再编辑商品')
      return
    }
    try {
      const res = await (await adminFetch(`/api/xianyu/products/${editModal.product_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })).json()
      if (res.success) {
        toast('商品已更新')
        setEditModal(null)
        fetchProducts(page)
      } else toast(res.error || '更新失败')
    } catch (e) { toast(e.message) }
  }

  async function handleStockSave() {
    if (!stockModal || stockValue === '') return
    try {
      const res = await (await adminFetch(`/api/xianyu/products/${stockModal.product_id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ shopId, stock: parseInt(stockValue, 10) }),
      })).json()
      if (res.success) {
        toast('库存已更新')
        setStockModal(null)
        setStockValue('')
        fetchProducts(page)
      } else toast(res.error || '更新失败')
    } catch (e) { toast(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 bg-orange-50/50 border border-orange-100 rounded-xl p-3">
        <span className="text-xs text-orange-800 font-medium">店铺</span>
        <select
          value={shopId}
          onChange={e => { setShopId(e.target.value); setPage(1) }}
          className="px-2 py-1.5 text-xs border border-orange-200 rounded-lg bg-white min-w-[140px]"
        >
          <option value="">全部店铺</option>
          {shops.map(s => (
            <option key={s.shop_id} value={s.shop_id}>{s.shop_name || s.shop_id}</option>
          ))}
        </select>
        <button type="button" onClick={fetchBalance} className="text-xs text-orange-600 hover:underline">刷新余额</button>
        {balance != null && (
          <span className="text-xs text-gray-600 ml-auto">
            余额：{typeof balance === 'object' ? JSON.stringify(balance) : String(balance)}
          </span>
        )}
        {!shopId && shops.length === 0 && (
          <span className="text-xs text-amber-600">请先在系统设置配置闲管家 Key</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="搜索商品标题"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProducts(1) } }}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg flex-1 min-w-[160px]"
        />
        <button type="button" onClick={() => { setPage(1); fetchProducts(1) }} className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg font-medium">搜索</button>
        <button type="button" onClick={() => fetchProducts(page)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg">刷新</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-300 text-sm">暂无商品</div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.product_id} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3">
              {p.first_image && !brokenImages[p.product_id] ? (
                <img
                  src={productImageSrc(p.first_image)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                  onError={() => setBrokenImages(prev => ({ ...prev, [p.product_id]: true }))}
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-400">无图</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{p.title || '-'}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ¥{p.price ?? '-'} · 库存 {p.stock ?? '-'} · ID {p.product_id}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button type="button" onClick={() => handlePublish(p.product_id, true)} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 rounded-md">上架</button>
                <button type="button" onClick={() => handlePublish(p.product_id, false)} className="px-2 py-1 text-[10px] bg-gray-50 text-gray-600 rounded-md">下架</button>
                <button type="button" onClick={() => openEditModal(p)} className="px-2 py-1 text-[10px] bg-amber-50 text-amber-700 rounded-md">编辑</button>
                <button type="button" onClick={() => { setStockModal(p); setStockValue(String(p.stock ?? '')) }} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded-md">库存</button>
                <button type="button" onClick={() => handleDelete(p.product_id)} className="px-2 py-1 text-[10px] bg-red-50 text-red-500 rounded-md">删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(total || products.length) > pageSize && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>共 {total || products.length} 条</span>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">上一页</button>
            <button type="button" disabled={page >= Math.ceil((total || products.length) / pageSize)} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">编辑商品 · {editModal.product_id}</h3>
            {editLoading && <p className="text-xs text-gray-400 mb-2">正在拉取最新详情…</p>}
            <label className="block text-xs text-gray-500 mb-1">标题</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
            <label className="block text-xs text-gray-500 mb-1">价格（元）</label>
            <input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
            <label className="block text-xs text-gray-500 mb-1">库存</label>
            <input type="number" value={editForm.stock} onChange={e => setEditForm(f => ({ ...f, stock: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
            <label className="block text-xs text-gray-500 mb-1">商品图 URL（每行一张）</label>
            <textarea rows={4} value={editForm.images} onChange={e => setEditForm(f => ({ ...f, images: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm mb-3 font-mono text-[11px]" placeholder="https://..." />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditModal(null)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg">取消</button>
              <button type="button" onClick={handleEditSave} className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}

      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStockModal(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">修改库存 · {stockModal.title}</h3>
            <input
              type="number"
              value={stockValue}
              onChange={e => setStockValue(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setStockModal(null)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg">取消</button>
              <button type="button" onClick={handleStockSave} className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
