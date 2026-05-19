/**
 * @fileoverview 购买确认弹窗组件
 * @description 在购买服务前展示商品信息、价格明细和余额变动，防止误操作
 * @module PurchaseConfirmModal
 * 
 * 核心功能：
 * 1. 商品信息展示 — 商品图、名称、价格
 * 2. 优惠信息 — 如果有砍价优惠，显示原价→现价
 * 3. 余额变动 — 当前余额 → 扣后余额，余额不足时显示红色警告
 * 4. 专业模式 — 支持暗色主题（专业模式下使用石色调配色）
 */

import React from 'react'

/**
 * 购买确认弹窗
 * @description 用户点击购买后弹出，确认商品信息和支付金额，防止误操作
 * 
 * 渲染逻辑：
 * 1. show === false 或无商品信息 → 不渲染（返回 null）
 * 2. 显示商品图、名称、价格
 * 3. 如果有最终价格（finalPrice）且与原价不同 → 显示砍价优惠提示
 * 4. 价格明细面板 — 商品价格、当前余额、扣后余额
 * 5. 余额不足 → 显示红色警告，告知还需充值金额
 * 6. 确认按钮 — 余额不足时禁用
 * 
 * 注意：
 * - 所有金额计算使用 parseFloat 确保数值运算正确
 * - 余额不足判断使用 >= 而非 > 允许刚好等于的情况
 * - 扣后余额为负时显示红色警告格式（¥ -xxx.xx）
 * 
 * @param {Object} props
 * @param {boolean} props.show - 是否显示弹窗
 * @param {Object|null} props.product - 商品信息 {name, price, image, cover}
 * @param {number|string|null} props.finalPrice - 最终价格（砍价后），null 则使用 product.price
 * @param {number|string} props.currentBalance - 用户当前余额
 * @param {boolean} props.isProfessionalMode - 是否为专业模式（暗色主题）
 * @param {Function} props.onConfirm - 确认购买回调
 * @param {Function} props.onCancel - 取消购买回调
 * @param {boolean} props.purchasing - 购买处理中状态
 * @returns {JSX.Element|null} 购买确认弹窗 JSX 或 null
 */
export default function PurchaseConfirmModal({
  show,
  product,
  finalPrice,
  currentBalance,
  isProfessionalMode,
  onConfirm,
  onCancel,
  purchasing,
}) {
  if (!show || !product) return null

  const price = parseFloat(finalPrice || product.price || 0)
  const balance = parseFloat(currentBalance || 0)
  const afterBalance = balance - price
  const canAfford = balance >= price

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[6px] p-4" onClick={onCancel}>
      <div className={`rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in ${isProfessionalMode ? 'bg-stone-900' : 'bg-white'}`}
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className={`px-5 py-4 flex items-center justify-between ${isProfessionalMode ? 'border-b border-stone-800' : ''}`}>
          <h3 className={`text-base font-bold ${isProfessionalMode ? 'text-stone-100' : 'text-gray-900'}`}>确认购买</h3>
          <button onClick={onCancel} disabled={purchasing} className={`w-7 h-7 flex items-center justify-center rounded-lg ${isProfessionalMode ? 'text-stone-500 hover:text-stone-300 hover:bg-stone-800' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'} disabled:opacity-50`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* 商品信息 */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
              {(product.image || product.cover) ? (
                <img src={product.image || product.cover} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-medium text-sm truncate ${isProfessionalMode ? 'text-stone-200' : 'text-gray-900'}`}>{product.name}</p>
              {finalPrice && parseFloat(finalPrice) > 0 && parseFloat(finalPrice) !== parseFloat(product.price || 0) && (
                <p className="text-xs text-green-600 mt-0.5">
                  砍价优惠: ¥{product.price} → <strong>¥{finalPrice}</strong>
                </p>
              )}
            </div>
          </div>

          {/* 价格明细 */}
          <div className={`rounded-xl p-3 space-y-2 ${isProfessionalMode ? 'bg-stone-800' : 'bg-gray-50'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-xs ${isProfessionalMode ? 'text-stone-400' : 'text-gray-500'}`}>商品价格</span>
              <span className={`font-bold ${isProfessionalMode ? 'text-stone-200' : 'text-gray-900'}`}>¥{price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-xs ${isProfessionalMode ? 'text-stone-400' : 'text-gray-500'}`}>当前余额</span>
              <span className={`font-medium ${isProfessionalMode ? 'text-stone-300' : 'text-gray-700'}`}>¥{balance.toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-200/60" />
            <div className="flex justify-between items-center">
              <span className={`text-xs font-medium ${isProfessionalMode ? 'text-stone-400' : 'text-gray-500'}`}>扣后余额</span>
              <span className={`font-bold text-sm ${afterBalance < 0 ? 'text-red-500' : (isProfessionalMode ? 'text-green-400' : 'text-green-600')}`}>
                {afterBalance < 0 ? `¥ -${Math.abs(afterBalance).toFixed(2)}` : `¥${afterBalance.toFixed(2)}`}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600">⚠️ 余额不足，还需充值 ¥{(price - balance).toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel} disabled={purchasing}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isProfessionalMode
                ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}>
            取消
          </button>
          <button onClick={onConfirm} disabled={purchasing || !canAfford}
            className="flex-1 py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white rounded-xl font-medium text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50">
            {purchasing ? '处理中...' : `确认支付 · ¥${price.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
