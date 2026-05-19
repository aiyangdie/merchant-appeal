import React, { useState, useEffect, useCallback } from 'react'
import { formatOrderAmount, formatOrderStatusLabel, ORDER_STATUS_MAP } from '../utils/orderUtils'

function productImageSrc(url) {
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

function fmtTime(d) {
  if (!d) return '-'
  const ts = typeof d === 'number' ? (d < 1e12 ? d * 1000 : d) : d
  try {
    const t = new Date(ts)
    return isNaN(t.getTime()) ? '-' : t.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function StatusBarChart({ items }) {
  if (!items?.length) return <p className="text-xs text-gray-400 py-6 text-center">暂无数据</p>
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.status} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 flex-shrink-0 truncate" title={item.label}>{item.label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-600 w-16 text-right tabular-nums">{item.count} ({item.percent}%)</span>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ series }) {
  if (!series?.length) return <p className="text-xs text-gray-400 py-6 text-center">暂无趋势数据</p>
  const maxOrders = Math.max(...series.map((s) => s.orders), 1)
  return (
    <div className="flex items-end gap-1 h-36 pt-2">
      {series.map((s) => {
        const h = Math.max(4, (s.orders / maxOrders) * 100)
        const label = s.date.slice(5)
        return (
          <div key={s.date} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
            <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{s.orders}单</span>
            <div
              className="w-full max-w-[28px] mx-auto bg-gradient-to-t from-orange-500 to-amber-300 rounded-t-md transition-all"
              style={{ height: `${h}%` }}
              title={`${s.date}: ${s.orders} 单 / ¥${s.amount}`}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function KpiCard({ label, value, sub, accent = 'orange' }) {
  const accents = {
    orange: 'from-orange-500 to-amber-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-emerald-500 to-teal-500',
    purple: 'from-violet-500 to-purple-500',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 bg-gradient-to-r ${accents[accent] || accents.orange} bg-clip-text text-transparent`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function XianyuDashboard({ adminFetch, showToast, onSwitchTab }) {
  const [days, setDays] = useState(30)
  const [shopId, setShopId] = useState('')
  const [shops, setShops] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', price: '', stock: '', images: '' })
  const [editLoading, setEditLoading] = useState(false)

  const toast = (msg) => showToast?.(msg)

  const loadShops = useCallback(async () => {
    try {
      const res = await (await adminFetch('/api/xianyu/shops?page=1&pageSize=50&refresh=1')).json()
      if (res.success) setShops(res.data?.list || [])
    } catch { /* ignore */ }
  }, [adminFetch])

  const loadDashboard = useCallback(async (opts = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: String(days), refresh: opts.refresh ? '1' : '0' })
      if (shopId) params.set('shopId', shopId)
      const res = await (await adminFetch(`/api/admin/xianyu-dashboard?${params}`)).json()
      if (res.success) setData(res.data)
      else {
        toast(res.error || '加载看板失败')
        setData(null)
      }
    } catch (e) {
      toast(e.message || '加载看板失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, days, shopId, showToast])

  useEffect(() => { loadShops() }, [loadShops])
  useEffect(() => { loadDashboard({ refresh: true }) }, [loadDashboard])

  async function openEdit(product) {
    setEditModal(product)
    setEditForm({
      title: product.title || '',
      price: product.price != null ? String(product.price) : '',
      stock: product.stock != null ? String(product.stock) : '',
      images: (product.images?.length ? product.images : product.first_image ? [product.first_image] : []).join('\n'),
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

  async function saveEdit() {
    if (!editModal) return
    if (!shopId) {
      toast('请先选择店铺后再编辑')
      return
    }
    const images = editForm.images.split(/\n/).map((s) => s.trim()).filter(Boolean)
    const payload = { shopId, title: editForm.title.trim() }
    if (editForm.price !== '') payload.price = parseFloat(editForm.price)
    if (editForm.stock !== '') payload.stock = parseInt(editForm.stock, 10)
    if (images.length) payload.images = images
    try {
      const res = await (await adminFetch(`/api/xianyu/products/${editModal.product_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })).json()
      if (res.success) {
        toast('商品已更新')
        setEditModal(null)
        loadDashboard({ refresh: true })
      } else toast(res.error || '更新失败')
    } catch (e) {
      toast(e.message)
    }
  }

  const s = data?.summary

  return (
    <div className="space-y-5 mt-2">
      <div className="flex flex-wrap items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-3">
        <span className="text-xs font-semibold text-orange-800">数据看板</span>
        <select
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          className="px-2 py-1.5 text-xs border border-orange-200 rounded-lg bg-white min-w-[120px]"
        >
          <option value="">全部店铺</option>
          {shops.map((sh) => (
            <option key={sh.shop_id} value={sh.shop_id}>{sh.shop_name || sh.shop_id}</option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-2 py-1.5 text-xs border border-orange-200 rounded-lg bg-white"
        >
          <option value={7}>近 7 天</option>
          <option value={30}>近 30 天</option>
          <option value={90}>近 90 天</option>
        </select>
        <button
          type="button"
          onClick={() => loadDashboard({ refresh: true })}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? '加载中…' : '刷新数据'}
        </button>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => onSwitchTab?.('xianyu-orders')} className="px-2.5 py-1 text-[10px] bg-white border border-orange-200 text-orange-700 rounded-lg">订单列表</button>
          <button type="button" onClick={() => onSwitchTab?.('xianyu-products')} className="px-2.5 py-1 text-[10px] bg-white border border-orange-200 text-orange-700 rounded-lg">商品管理</button>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-center py-24 text-gray-400 text-sm">正在拉取闲管家数据…</div>
      ) : !data ? (
        <div className="text-center py-24 text-gray-300 text-sm">暂无看板数据，请检查闲管家配置</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="订单总量" value={s.orderCount} sub={`平台约 ${s.platformTotal} 笔`} />
            <KpiCard label="成交额" value={`¥${s.totalSales}`} sub={`客单价 ¥${s.avgOrderValue}`} accent="blue" />
            <KpiCard label="今日订单" value={s.todayOrders} sub={`今日 ¥${s.todaySales}`} accent="green" />
            <KpiCard label="待发货" value={s.pendingShip} sub="需尽快处理" accent="purple" />
            <KpiCard label="在售商品" value={s.productCount} sub={s.analyticsNote ? '见下方统计说明' : '近 6 个月内有更新'} accent="orange" />
          </div>
          {s.analyticsNote ? (
            <p className="text-[10px] text-amber-700/80 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">{s.analyticsNote}</p>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">订单状态分布</h3>
              <StatusBarChart items={data.statusDistribution} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">销售趋势</h3>
              <p className="text-[10px] text-gray-400 mb-2">按下单日统计订单量（近 {Math.min(days, 30)} 日）</p>
              <TrendChart series={data.salesTrend} />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">热销商品 TOP10</h3>
                <span className="text-[10px] text-gray-400">按订单笔数统计</span>
              </div>
              {data.topProducts?.length ? (
                <div className="space-y-2">
                  {data.topProducts.map((p, i) => (
                    <div key={`${p.product_id}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-orange-50/50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i < 3 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {i + 1}
                      </span>
                      {p.image ? (
                        <img src={productImageSrc(p.image)} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.title}</p>
                        <p className="text-[10px] text-gray-400">{p.order_count} 单 · ¥{p.amount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-8">样本不足，请扩大统计天数</p>
              )}
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-amber-200">{data.aiReport?.title}</h3>
                <button
                  type="button"
                  onClick={() => {
                    const text = [
                      data.aiReport?.title,
                      data.aiReport?.generated_at ? new Date(data.aiReport.generated_at).toLocaleString('zh-CN') : '',
                      ...(data.aiReport?.sections || []).map((sec) => `${sec.heading}\n${sec.body}`),
                    ].filter(Boolean).join('\n\n')
                    navigator.clipboard?.writeText(text).then(() => toast('日报已复制')).catch(() => toast('复制失败'))
                  }}
                  className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-slate-200 hover:bg-white/20 flex-shrink-0"
                >
                  复制日报
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-3">
                {data.aiReport?.generated_at ? new Date(data.aiReport.generated_at).toLocaleString('zh-CN') : ''}
                {' · '}
                {data.aiReport?.source === 'llm' ? 'AI 大模型生成' : '规则模板（AI 不可用时回退）'}
              </p>
              <div className="space-y-3 max-h-[320px] overflow-y-auto text-xs leading-relaxed">
                {data.aiReport?.sections?.map((sec, idx) => (
                  <div key={idx}>
                    <p className="font-medium text-amber-100/90 mb-0.5">{sec.heading}</p>
                    <p className="text-slate-300 whitespace-pre-wrap">{sec.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">最近订单</h3>
                <button type="button" onClick={() => onSwitchTab?.('xianyu-orders')} className="text-[10px] text-orange-600">查看全部</button>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2">订单号</th>
                      <th className="text-left px-3 py-2">商品</th>
                      <th className="text-right px-3 py-2">金额</th>
                      <th className="text-center px-3 py-2">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.recentOrders?.map((o) => {
                      const st = formatOrderStatusLabel(o.order_status)
                      return (
                        <tr key={o.order_no} className="hover:bg-gray-50/80">
                          <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{String(o.order_no).slice(-10)}</td>
                          <td className="px-3 py-2 truncate max-w-[120px]">{o.goods?.title || '-'}</td>
                          <td className="px-3 py-2 text-right font-medium">¥{formatOrderAmount(o)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${st.bg} ${st.text}`}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">商品快览 · 可编辑</h3>
                <button type="button" onClick={() => onSwitchTab?.('xianyu-products')} className="text-[10px] text-orange-600">完整管理</button>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {data.products?.map((p) => (
                  <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 hover:bg-orange-50/30">
                    {p.first_image ? (
                      <img src={productImageSrc(p.first_image)} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate text-gray-800">{p.title || '-'}</p>
                      <p className="text-[10px] text-gray-400">¥{p.price ?? '-'} · 库存 {p.stock ?? '-'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-2 py-1 text-[10px] bg-amber-50 text-amber-700 rounded-md flex-shrink-0"
                    >
                      编辑
                    </button>
                  </div>
                ))}
                {!data.products?.length && (
                  <p className="text-xs text-gray-400 text-center py-8">暂无商品</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400">
              数据来源：闲管家开放平台 <code className="text-orange-600">/api/open/order/list</code>、<code className="text-orange-600">/api/open/product/list</code>
              （近 {days} 天，最多聚合 500 笔订单样本）。状态码对照：
              {Object.entries(ORDER_STATUS_MAP).map(([k, v]) => `${k}=${v.label}`).join('、')}
            </p>
          </div>
        </>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800">编辑商品</h3>
            {editLoading && <p className="text-xs text-gray-400">正在拉取详情…</p>}
            <input
              className="w-full px-3 py-2 text-sm border rounded-lg"
              placeholder="标题"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 text-sm border rounded-lg"
                placeholder="价格（元）"
                value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
              />
              <input
                className="flex-1 px-3 py-2 text-sm border rounded-lg"
                placeholder="库存"
                value={editForm.stock}
                onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))}
              />
            </div>
            <textarea
              className="w-full px-3 py-2 text-sm border rounded-lg h-20"
              placeholder="图片 URL，每行一条"
              value={editForm.images}
              onChange={(e) => setEditForm((f) => ({ ...f, images: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 text-xs text-gray-500">取消</button>
              <button type="button" onClick={saveEdit} className="px-4 py-2 text-xs bg-orange-600 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
