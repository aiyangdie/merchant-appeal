import React from 'react'
import { formatOrderAmount, getOrderStatusStyle, sortOrdersByStatus } from '../utils/orderUtils'
import { saveSessionId } from '../services/auth'

/**
 * 订单绑定弹窗组件
 * 
 * 功能说明：
 * - 展示用户的闲鱼订单列表，支持选择订单进行绑定
 * - 显示已绑定订单的状态，支持解除绑定
 * - 绑定订单时自动创建会话（Session），将订单信息与AI对话关联
 * 
 * 使用场景：
 * - 用户需要为申诉/咨询绑定具体的闲鱼订单
 * - 切换已绑定的订单
 * - 解除当前订单绑定
 * 
 * @param {Object} props - 组件属性
 * @param {boolean} props.show - 是否显示弹窗
 * @param {Function} props.onClose - 关闭弹窗回调
 * @param {Object|null} props.boundOrder - 当前已绑定的订单对象
 * @param {Function} props.onUnbind - 解除绑定回调
 * @param {Array} props.orderList - 订单列表数据
 * @param {boolean} props.orderListLoading - 订单列表是否加载中
 * @param {Function} props.onRefreshOrders - 刷新订单列表回调
 * @param {Object} props.sessionIdRef - Session ID 的 ref 引用（用于获取最新值）
 * @param {string} props.sessionId - 当前会话 ID
 * @param {Function} props.setSessionId - 设置会话 ID 的函数
 * @param {Function} props.setBoundOrder - 设置绑定订单的函数
 * @param {Function} props.setShowOrderPanel - 设置是否显示订单面板
 * @param {Object|null} props.user - 当前用户信息
 * @param {Function} props.getAuthHeaders - 获取认证请求头的函数
 * @param {Object} props.toast - Toast 提示工具
 * @returns {JSX.Element|null} 订单绑定弹窗 JSX 或 null（不显示时）
 */
export default function OrderBindModal({
  show,
  onClose,
  boundOrder,
  onUnbind,
  orderList,
  orderListLoading,
  onRefreshOrders,
  sessionIdRef,
  sessionId,
  setSessionId,
  setBoundOrder,
  setShowOrderPanel,
  user,
  getAuthHeaders,
  toast,
}) {
  // 弹窗不显示时不渲染任何内容（条件渲染）
  if (!show) return null

  /**
   * 格式化订单时间戳为日期字符串
   * 
   * 说明：
   * - 后端返回的 order_time 是 Unix 时间戳（秒级数值）
   * - JavaScript 的 Date 构造函数需要毫秒级时间戳，需乘以 1000
   * - 如果时间戳无效或不存在，返回 '未知'
   * 
   * @param {number|string} timestamp - Unix 时间戳（秒）或日期字符串
   * @returns {string} 格式化的日期字符串，如 '2024/01/15'
   */
  function formatOrderDate(timestamp) {
    // 如果没有时间戳，返回未知
    if (!timestamp) return '未知'
    
    // 判断是否为数值型时间戳（秒级）
    const num = Number(timestamp)
    if (!isNaN(num) && num > 0) {
      // 秒级时间戳需乘以 1000 转换为毫秒
      const date = new Date(num * 1000)
      // 检查日期是否有效
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('zh-CN')
      }
    }
    
    // 尝试直接解析字符串格式的日期
    try {
      const date = new Date(timestamp)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('zh-CN')
      }
    } catch (e) {
      // 解析失败，继续向下执行
    }
    
    return '未知'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25 backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">绑定订单</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {boundOrder && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="text-sm font-medium text-green-700">已绑定订单</span>
              </div>
              <button
                onClick={() => {
                  onUnbind()
                  fetch(`/api/sessions/${sessionId}/bind-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_no: null, order_data: null }),
                  }).catch((e) => console.warn('[订单] 解除绑定失败:', e))
                }}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                解除绑定
              </button>
            </div>
            <div className="mt-2 flex gap-3 bg-white rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{boundOrder.goods?.title || boundOrder.product_name || '商品'}</p>
                <p className="text-xs text-gray-500">¥{formatOrderAmount(boundOrder)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {orderListLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full" />
              <span className="ml-3 text-sm text-gray-500">加载订单中...</span>
            </div>
          ) : orderList.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="text-sm text-gray-500 mb-3">暂无订单数据</p>
              <button onClick={onRefreshOrders} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md">
                刷新订单列表
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {orderList.map((order, idx) => {
                const orderImage = order.goods?.images?.[0] || order.product_image || ''
                const statusStyle = getOrderStatusStyle(order.status, order.order_status)
                return (
                  <div
                    key={idx}
                    onClick={async () => {
                      let sid = sessionIdRef.current
                      if (!sid) {
                        try {
                          const res = await fetch('/api/sessions', {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ orderNo: order.order_no, orderData: order }),
                          })
                          const data = await res.json()
                          if (data.sessionId) {
                            sid = data.sessionId
                            setSessionId(sid)
                            sessionIdRef.current = sid
                            saveSessionId(sid)
                            setBoundOrder(order)
                            setShowOrderPanel(false)
                            return
                          }
                        } catch (e) {
                          console.error('创建session失败:', e)
                          return
                        }
                      }
                      if (sid) {
                        try {
                          await fetch(`/api/sessions/${sid}/bind-order`, {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ order_no: order.order_no, order_data: order }),
                          })
                          setBoundOrder(order)
                          setShowOrderPanel(false)
                        } catch (e) {
                          toast.error('绑定失败')
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${boundOrder?.order_no === order.order_no ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white hover:border-orange-200'}`}
                  >
                    <div className="flex gap-3">
                      {orderImage && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          <img src={orderImage} alt="商品图" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold text-gray-900 truncate">{order.buyer_nick || order.customer_name || '未知买家'}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>{statusStyle.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{order.goods?.title || order.product_name || '商品信息'}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-sm font-bold text-orange-600">¥{formatOrderAmount(order)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{order.goods?.quantity || 1}件</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>📞 {order.receiver_mobile || order.buyer_phone || order.customer_phone || '无'}</span>
                          <span>📅 {formatOrderDate(order.order_time)}</span>
                        </div>
                      </div>
                    </div>
                    {boundOrder?.order_no === order.order_no && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        当前绑定
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 safe-bottom">
          <button onClick={onRefreshOrders} disabled={orderListLoading} className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-60">
            {orderListLoading ? '加载中...' : '获取闲鱼订单'}
          </button>
        </div>
      </div>
    </div>
  )
}
