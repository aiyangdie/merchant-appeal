/**
 * @fileoverview 账户充值弹窗组件
 * @description 支持多种充值方式和支付渠道的充值弹窗，包括在线支付和手工充值
 * @module RechargeModal
 * 
 * 支持的支付方式：
 * 1. 在线支付 — 微信支付、支付宝、易支付、码支付（生成二维码或跳转支付链接）
 * 2. 手工充值 — 扫码支付固定收款码，填写交易单号后管理员确认
 * 
 * 状态流转：
 * 表单填写 → 创建订单 → 显示支付二维码 → 轮询支付状态 → 支付成功/失败/超时
 */

import React from 'react'

/**
 * 账户充值弹窗
 * @description 展示充值表单、支付二维码、支付状态反馈
 * 
 * 渲染逻辑（按优先级）：
 * 1. paymentStatus === 'paid' → 支付成功页
 * 2. paymentStatus === 'failed' → 支付失败页
 * 3. paymentStatus === 'timeout' → 支付超时页
 * 4. paymentPending 存在 → 支付中（显示二维码和等待提示）
 * 5. rechargeConfig.enabled === false → 功能未启用提示
 * 6. 否则 → 充值表单（金额选择 + 支付方式 + 备注）
 * 
 * 注意：
 * - 如果未配置在线支付渠道（wechat/alipay/epay/codepay），自动降级为手工充值
 * - 手工充值需要用户填写付款备注（交易单号），提交后等待管理员确认
 * - 在线支付成功后余额自动到账，无需审核
 * 
 * @param {Object} props
 * @param {boolean} props.show - 是否显示弹窗
 * @param {Function} props.onClose - 关闭弹窗回调
 * @param {Object} props.rechargeConfig - 充值配置 {enabled, amounts[], paymentChannels, qrWechat, qrAlipay, realPayment, instructions}
 * @param {number} props.rechargeAmount - 当前选择的充值金额
 * @param {Function} props.setRechargeAmount - 设置充值金额
 * @param {string} props.rechargeMethod - 当前选择的支付方式 'wechat'|'alipay'|'epay_alipay'|'epay_wxpay'|'codepay_alipay'|'codepay_wxpay'
 * @param {Function} props.setRechargeMethod - 设置支付方式
 * @param {string} props.rechargeRemark - 付款备注（交易单号）
 * @param {Function} props.setRechargeRemark - 设置付款备注
 * @param {boolean} props.rechargeSubmitting - 提交中状态
 * @param {Function} props.onSubmit - 提交充值申请回调
 * @param {Object|null} props.paymentPending - 支付中信息 {amount, method, codeUrl, outTradeNo}
 * @param {string|null} props.paymentStatus - 支付结果状态 'paid'|'failed'|'timeout'|null
 * @param {Function} props.onResetPayment - 重置支付状态回调（用于重新充值）
 */
export default function RechargeModal({
  show,
  onClose,
  rechargeConfig,
  rechargeAmount,
  setRechargeAmount,
  rechargeMethod,
  setRechargeMethod,
  rechargeRemark,
  setRechargeRemark,
  rechargeSubmitting,
  onSubmit,
  paymentPending,
  paymentStatus,
  onResetPayment,
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[6px] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-gray-900">账户充值</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {paymentStatus === 'paid' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">支付成功</h3>
            <p className="text-sm text-gray-500 mb-4">¥{paymentPending?.amount} 已到账，余额已更新</p>
            <button onClick={onClose} className="px-8 py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white rounded-xl font-medium text-sm">完成</button>
          </div>
        ) : paymentStatus === 'failed' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">支付失败</h3>
            <p className="text-sm text-gray-500 mb-4">订单已取消或支付超时</p>
            <button onClick={onResetPayment} className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">重新充值</button>
          </div>
        ) : paymentStatus === 'timeout' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">等待支付超时</h3>
            <p className="text-sm text-gray-500 mb-4">如已支付，余额将在稍后自动到账</p>
            <button onClick={onResetPayment} className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">重新充值</button>
          </div>
        ) : paymentPending ? (
          <div className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">请使用{paymentPending.method === 'wechat' ? '微信' : '支付宝'}扫码支付</p>
              <p className="text-2xl font-bold text-gray-900 mb-3">¥{paymentPending.amount}</p>
              {paymentPending.codeUrl ? (
                <div className="mx-auto w-52 h-52 bg-white border-2 border-gray-100 rounded-xl flex items-center justify-center p-2">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentPending.codeUrl)}`} alt="支付二维码" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="mx-auto w-52 h-52 bg-gray-50 rounded-xl flex items-center justify-center">
                  <p className="text-sm text-gray-400">请在新窗口完成支付</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#07C160] rounded-full" />
              <span>等待支付确认...</span>
            </div>
            <p className="text-[10px] text-gray-300 text-center">支付成功后将自动确认，无需手动操作</p>
            <p className="text-[10px] text-center text-gray-400">订单号: {paymentPending.outTradeNo}</p>
          </div>
        ) : !rechargeConfig?.enabled ? (
          <div className="p-6 text-center text-gray-400 text-sm">充值功能暂未开放</div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-2">选择充值金额</label>
              <div className="grid grid-cols-3 gap-2">
                {rechargeConfig.amounts?.map((a) => {
                    const isRecommended = rechargeAmount && a >= rechargeAmount && a === rechargeConfig.amounts?.find(x => x >= rechargeAmount) ? a : null
                    return (
                      <button key={a} onClick={() => setRechargeAmount(a)} className={`py-3 rounded-xl text-[13px] font-bold transition-all relative ${rechargeAmount === a ? 'bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white shadow-sm' : 'bg-gray-50 text-gray-700 border border-gray-200/80 hover:border-[#07C160]/40'} ${isRecommended === a && rechargeAmount !== a ? 'ring-2 ring-green-300/60' : ''}`}>
                        ¥{a}
                        {isRecommended === a && rechargeAmount !== a && (
                          <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">推荐</span>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-2">支付方式</label>
              {(!rechargeConfig.paymentChannels?.wechat && !rechargeConfig.qrWechat && !rechargeConfig.paymentChannels?.alipay && !rechargeConfig.qrAlipay && !rechargeConfig.paymentChannels?.epay && !rechargeConfig.paymentChannels?.codepay) ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-amber-700 font-medium">💡 当前无在线支付渠道</p>
                  <p className="text-[11px] text-amber-600 mt-1">请使用手工充值方式，提交后管理员将尽快确认到账</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    {(rechargeConfig.paymentChannels?.wechat || rechargeConfig.qrWechat) && (
                      <button onClick={() => setRechargeMethod('wechat')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'wechat' ? 'bg-green-50 border-2 border-wechat-green text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-wechat-green rounded-full inline-block" /> 微信支付
                      </button>
                    )}
                    {(rechargeConfig.paymentChannels?.alipay || rechargeConfig.qrAlipay) && (
                      <button onClick={() => setRechargeMethod('alipay')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${rechargeMethod === 'alipay' ? 'bg-blue-50 border-2 border-blue-500 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                        <span className="w-4 h-4 bg-blue-500 rounded-full inline-block" /> 支付宝
                      </button>
                    )}
                  </div>
                  {(rechargeConfig.paymentChannels?.epay || rechargeConfig.paymentChannels?.codepay) && (
                    <div className="flex gap-2 mt-2">
                      {rechargeConfig.paymentChannels?.epay && (
                        <>
                          <button onClick={() => setRechargeMethod('epay_alipay')} className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'epay_alipay' ? 'bg-blue-50 border-2 border-blue-400 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">💰</span> 易支付·支付宝
                          </button>
                          <button onClick={() => setRechargeMethod('epay_wxpay')} className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'epay_wxpay' ? 'bg-green-50 border-2 border-green-400 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">💰</span> 易支付·微信
                          </button>
                        </>
                      )}
                      {rechargeConfig.paymentChannels?.codepay && (
                        <>
                          <button onClick={() => setRechargeMethod('codepay_alipay')} className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'codepay_alipay' ? 'bg-blue-50 border-2 border-blue-400 text-blue-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">📱</span> 码支付·支付宝
                          </button>
                          <button onClick={() => setRechargeMethod('codepay_wxpay')} className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all ${rechargeMethod === 'codepay_wxpay' ? 'bg-green-50 border-2 border-green-400 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                            <span className="text-sm">📱</span> 码支付·微信
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {!rechargeConfig.realPayment && ((rechargeMethod === 'wechat' && rechargeConfig.qrWechat) || (rechargeMethod === 'alipay' && rechargeConfig.qrAlipay)) && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">请扫码支付 <strong className="text-lg text-gray-800">¥{rechargeAmount}</strong></p>
                <img src={rechargeMethod === 'wechat' ? rechargeConfig.qrWechat : rechargeConfig.qrAlipay} alt="收款二维码" className="w-48 h-48 mx-auto rounded-xl border border-gray-200 object-contain bg-white" />
              </div>
            )}
            {rechargeConfig.instructions && <p className="text-xs text-gray-500 bg-yellow-50 rounded-lg p-3 border border-yellow-100">{rechargeConfig.instructions}</p>}
            {!rechargeConfig.realPayment && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">付款备注（交易单号或截图说明）</label>
                <input type="text" value={rechargeRemark} onChange={(e) => setRechargeRemark(e.target.value)} placeholder="请输入支付后的交易单号或备注" className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30" />
              </div>
            )}
            <button onClick={onSubmit} disabled={!rechargeAmount || rechargeSubmitting} className="w-full py-2.5 bg-gradient-to-br from-[#07C160] to-[#06ae56] text-white rounded-xl font-medium text-[13px] disabled:opacity-50 shadow-sm transition-all">
              {rechargeSubmitting ? '创建支付订单...' : rechargeConfig.realPayment ? `立即支付 · ¥${rechargeAmount || 0}` : `提交充值申请 · ¥${rechargeAmount || 0}`}
            </button>
            {rechargeConfig.realPayment ? (
              <p className="text-[10px] text-gray-300 text-center">支付成功后余额自动到账，无需等待审核</p>
            ) : (
              <p className="text-[10px] text-gray-300 text-center">提交后管理员将尽快确认，余额自动到账</p>
            )}
            <p className="text-[10px] text-gray-300 text-center mt-1">充值余额用于消耗AI Token，充值后不支持退款/提现。当前免费模型无需余额即可使用。</p>
          </div>
        )}
      </div>
    </div>
  )
}
