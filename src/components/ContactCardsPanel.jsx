import React, { useState, useEffect, useCallback } from 'react'

const STATUS_MAP = { active: '启用', draft: '草稿', archived: '已停用' }
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-600', archived: 'bg-yellow-100 text-yellow-700' }
const CATEGORY_OPTIONS = ['general', 'legal', 'tech', 'sales', 'vip']
const CATEGORY_LABELS = { general: '通用', legal: '法律顾问', tech: '技术支持', sales: '商务合作', vip: 'VIP专属' }

export default function ContactCardsPanel({ adminFetch }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '', title: '', phone: '', wechat: '', email: '', qrCode: '',
    description: '', category: 'general', tags: '', targetAudience: '',
    sortOrder: '0', status: 'active',
  })
  const [aiCardGen, setAiCardGen] = useState(false)
  const [aiCardAssist, setAiCardAssist] = useState(false)
  const [aiCardDesc, setAiCardDesc] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const fetchCards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/contact-cards')).json()
      setCards(data.cards || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [adminFetch])

  useEffect(() => { fetchCards() }, [fetchCards])

  async function handleSave() {
    try {
      const body = {
        ...form,
        sortOrder: parseInt(form.sortOrder) || 0,
        tags: form.tags ? form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [],
        targetAudience: form.targetAudience ? form.targetAudience.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [],
      }
      if (editingId) {
        await adminFetch('/api/admin/contact-cards/' + editingId, { method: 'PUT', body: JSON.stringify(body) })
        showToast('名片已更新')
      } else {
        if (!body.name) { showToast('请输入名称'); return }
        await adminFetch('/api/admin/contact-cards', { method: 'POST', body: JSON.stringify(body) })
        showToast('名片已创建')
      }
      setShowForm(false); setEditingId(null)
      resetForm()
      fetchCards()
    } catch (e) { showToast('保存失败: ' + e.message) }
  }

  function resetForm() {
    setForm({ name: '', title: '', phone: '', wechat: '', email: '', qrCode: '', description: '', category: 'general', tags: '', targetAudience: '', sortOrder: '0', status: 'active' })
  }

  function startEdit(c) {
    setEditingId(c.id)
    setForm({
      name: c.name || '', title: c.title || '', phone: c.phone || '', wechat: c.wechat || '',
      email: c.email || '', qrCode: c.qr_code || '', description: c.description || '',
      category: c.category || 'general', tags: (c.tags || []).join(', '),
      targetAudience: (c.target_audience || []).join(', '),
      sortOrder: String(c.sort_order || 0), status: c.status,
    })
    setShowForm(true)
  }

  async function handleAIAssistCard() {
    if (!aiCardDesc.trim()) { showToast('请输入名片描述'); return }
    setAiCardAssist(true)
    try {
      const data = await (await adminFetch('/api/admin/ai-assist', {
        method: 'POST', body: JSON.stringify({ type: 'card', description: aiCardDesc.trim() }),
      })).json()
      if (data.card) {
        setForm(f => ({
          ...f,
          name: data.card.name || f.name,
          title: data.card.title || f.title,
          phone: data.card.phone || f.phone,
          wechat: data.card.wechat || f.wechat,
          email: data.card.email || f.email,
          description: data.card.description || f.description,
          category: data.card.category || f.category,
          tags: Array.isArray(data.card.tags) ? data.card.tags.join(', ') : (data.card.tags || f.tags),
        }))
        showToast('✅ AI已填充名片信息')
      } else {
        showToast('AI生成失败: ' + (data.error || '未知错误'))
      }
    } catch (e) { showToast('AI辅助失败: ' + e.message) }
    setAiCardAssist(false)
  }

  async function handleDelete(id) {
    if (!confirm('确定删除此名片?')) return
    await adminFetch('/api/admin/contact-cards/' + id, { method: 'DELETE' })
    showToast('已删除')
    fetchCards()
  }

  return (
    <div className="h-full flex flex-col">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 gpu-scroll">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">📇 名片管理 ({cards.length})</span>
          <div className="flex-1" />
          <button disabled={aiCardGen} onClick={async () => { setAiCardGen(true); showToast('🤖 AI正在生成名片...'); try { const d = await (await adminFetch('/api/admin/contact-cards/ai-generate', { method: 'POST', body: JSON.stringify({ description: '为商户申诉平台生成专业人员名片' }) })).json(); if (d.success) { showToast(`✅ AI已生成名片: ${d.card?.name || '成功'}·${d.card?.title || ''}`); fetchCards() } else { showToast(d.error || '❌ AI生成失败') } } catch { showToast('❌ AI生成失败') } finally { setAiCardGen(false) } }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${aiCardGen ? 'bg-purple-200 text-purple-700 animate-pulse cursor-wait' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
            {aiCardGen ? '⏳ 生成中...' : 'AI生成'}
          </button>
          <button onClick={() => { setEditingId(null); resetForm(); setShowForm(true) }}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">+ 添加名片</button>
        </div>

        {showForm && (
          <div className="bg-amber-50/50 rounded-xl border border-amber-100 p-4 space-y-3">
            <h3 className="font-semibold text-sm text-amber-700">{editingId ? '编辑名片' : '添加名片'}</h3>
            <div className="bg-gradient-to-r from-purple-50 to-amber-50 rounded-lg border border-purple-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-purple-700">🤖 AI辅助填写</span>
                <span className="text-[10px] text-purple-400">描述你想要的名片，AI自动填充所有字段</span>
              </div>
              <div className="flex gap-2">
                <input value={aiCardDesc} onChange={e => setAiCardDesc(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                  placeholder="如：一个专门处理微信支付商户封禁问题的法律顾问" />
                <button onClick={handleAIAssistCard} disabled={aiCardAssist}
                  className={`px-4 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all ${aiCardAssist ? 'bg-purple-200 text-purple-700 animate-pulse cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                  {aiCardAssist ? '⏳ 生成中...' : '✨ AI填充'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">名称 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="如：张经理" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">头衔</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="如：AI申诉专家" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">电话</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="手机号" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">微信号</label>
                <input value={form.wechat} onChange={e => setForm({ ...form, wechat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="微信号" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">邮箱</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="邮箱" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">二维码链接</label>
                <input value={form.qrCode} onChange={e => setForm({ ...form, qrCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="微信二维码图片URL" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-gray-500 mb-1">描述</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="如：专业商户申诉解决方案" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">分类</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">状态</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400">
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">标签（逗号分隔）</label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="如：电商,支付,法律" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">排序</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="px-4 py-2 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 font-medium">保存</button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">取消</button>
            </div>
          </div>
        )}

        {loading && cards.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
        ) : cards.length === 0 && !loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <p className="text-2xl mb-2">📇</p>
            <p>暂无名片</p>
            <p className="text-xs mt-1">点击"添加名片"创建第一张</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{c.name}</h4>
                      {c.title && <p className="text-white/70 text-[10px] truncate">{c.title}</p>}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_MAP[c.status] || c.status}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {c.phone && <div className="flex items-center gap-2 text-xs text-gray-600"><span className="text-green-500">📞</span> {c.phone}</div>}
                  {c.wechat && <div className="flex items-center gap-2 text-xs text-gray-600"><span className="text-green-500">💬</span> {c.wechat}</div>}
                  {c.email && <div className="flex items-center gap-2 text-xs text-gray-600"><span className="text-blue-500">📧</span> {c.email}</div>}
                  {c.description && <p className="text-[10px] text-gray-400 truncate">{c.description}</p>}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{CATEGORY_LABELS[c.category] || c.category}</span>
                    {(c.tags || []).slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 pt-1">
                    <span>浏览 {c.view_count || 0}</span>
                    <span>·</span>
                    <span>点击 {c.click_count || 0}</span>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-50 flex gap-2">
                  <button onClick={() => startEdit(c)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">编辑</button>
                  <button onClick={() => handleDelete(c.id)} className="text-[10px] text-red-500 hover:text-red-700 font-medium">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
