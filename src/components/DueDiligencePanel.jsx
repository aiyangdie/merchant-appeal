import React, { useState, useEffect } from 'react'

function CopyButton({ text, label, copiedKey, setCopiedKey, id }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(id)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedKey(id)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }
  return (
    <button onClick={copy}
      className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
      {copiedKey === id ? '✓ 已复制' : (label || '复制')}
    </button>
  )
}

function OrderCard({ order, copiedKey, setCopiedKey }) {
  const goodsText = `商品名称：${order.goodsName}`
  const orderText = `微信交易单号：${order.orderNo}`
  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white">
      <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">订单 {order.index}</span>
        <CopyButton
          text={`${goodsText}\n${orderText}`}
          label="复制整单"
          copiedKey={copiedKey}
          setCopiedKey={setCopiedKey}
          id={`order-full-${order.index}`}
        />
      </div>
      <div className="p-3 space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">商品名称</span>
            <CopyButton text={order.goodsName} label="复制" copiedKey={copiedKey} setCopiedKey={setCopiedKey} id={`goods-${order.index}`} />
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{order.goodsName}</p>
        </div>
        <div className="border-t border-gray-50 pt-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">微信交易单号</span>
            <CopyButton text={order.orderNo} label="复制" copiedKey={copiedKey} setCopiedKey={setCopiedKey} id={`orderno-${order.index}`} />
          </div>
          <p className="text-xs font-mono text-gray-700 break-all leading-relaxed">{order.orderNo}</p>
        </div>
      </div>
    </div>
  )
}

export default function DueDiligencePanel({ sessionId, onClose, getAuthHeaders }) {
  const [guide, setGuide] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (sessionId) loadGuide()
  }, [sessionId])

  async function loadGuide() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/due-diligence-guide`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      if (data.guide) setGuide(data.guide)
    } catch (e) {
      setError('加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">请先开始对话后再使用尽调填写助手</div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-800">尽调填写助手</h2>
          <p className="text-xs text-gray-400 mt-0.5">每笔订单分开展示：商品名称 + 微信交易单号</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="text-center text-gray-400 text-sm py-8">加载中...</div>}
        {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

        {guide && (
          <>
            {guide.deadline_warning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-xl">
                {guide.deadline_warning}
                {guide.deadline && <span className="block text-xs mt-1 text-amber-600">截止：{guide.deadline}</span>}
              </div>
            )}

            {(guide.merchant_id || guide.merchant_name) && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                {guide.merchant_name && (
                  <div className="flex items-center justify-between">
                    <div><span className="text-gray-400">商户名称：</span>{guide.merchant_name}</div>
                  </div>
                )}
                {guide.merchant_id && (
                  <div className="flex items-center justify-between">
                    <div><span className="text-gray-400">商户号：</span><span className="font-mono font-medium text-indigo-700">{guide.merchant_id}</span></div>
                    <CopyButton text={guide.merchant_id} label="复制商户号" copiedKey={copiedKey} setCopiedKey={setCopiedKey} id="merchant-id" />
                  </div>
                )}
              </div>
            )}

            {guide.online_channels?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {guide.online_channels.map(ch => (
                  <span key={ch.id} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {ch.icon} {ch.label}
                  </span>
                ))}
              </div>
            )}

            {/* 交易订单 — 分笔展示 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">🧾 交易订单（分笔填写）</h3>
              {guide.orders?.length > 0 ? (
                <div className="space-y-3">
                  {guide.orders.map(order => (
                    <OrderCard key={order.index} order={order} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                  ))}
                  <p className="text-[11px] text-gray-400 text-center">在商家助手小程序中，每笔订单分别填入对应的商品名称和微信交易单号</p>
                </div>
              ) : (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                  暂无订单，请在对话中粘贴微信交易单号，例如：<br />
                  <span className="font-mono text-gray-500 mt-1 block">微信交易订单号：420000... / 订单商品/服务内容：商品名称</span>
                </div>
              )}
            </div>

            {/* 填写入口步骤 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📱 点击通知后怎么填</h3>
              <div className="space-y-2">
                {guide.entry_steps?.map((step, i) => (
                  <div key={step.id}
                    onClick={() => setActiveStep(i)}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${activeStep === i ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{step.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-500 bg-indigo-100 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-800">{step.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 其他表单内容 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">✍️ 其他表单内容</h3>
              <div className="space-y-3">
                {guide.form_fields?.map(field => (
                  <div key={field.key} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-600">{field.label}</span>
                      {field.copyable && (
                        <CopyButton text={field.value} label="复制" copiedKey={copiedKey} setCopiedKey={setCopiedKey} id={field.key} />
                      )}
                    </div>
                    <pre className="text-xs text-gray-700 p-3 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">{field.value}</pre>
                  </div>
                ))}
              </div>
            </div>

            {/* 材料清单 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📎 材料上传清单</h3>
              <div className="space-y-1.5">
                {guide.materials_checklist?.map(item => (
                  <label key={item.id} className="flex items-start gap-2 text-xs text-gray-600 p-2 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" className="mt-0.5 rounded" />
                    <span>{item.label}{item.required && <span className="text-red-400 ml-1">*</span>}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 驳回提示 */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-red-700 mb-2">⚠️ 常见驳回原因</h3>
              <ul className="space-y-1">
                {guide.reject_tips?.map((tip, i) => (
                  <li key={i} className="text-xs text-red-600">• {tip}</li>
                ))}
              </ul>
            </div>

            {guide.completeness && (
              <div className="text-xs text-gray-400 text-center">
                信息完整度 {guide.completeness.score}%（{guide.completeness.filled}/{guide.completeness.total}）
                {guide.completeness.missing?.length > 0 && (
                  <span className="block mt-1">还缺：{guide.completeness.missing.join('、')}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
        <button onClick={loadGuide}
          className="w-full py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">
          刷新填写内容
        </button>
      </div>
    </div>
  )
}
