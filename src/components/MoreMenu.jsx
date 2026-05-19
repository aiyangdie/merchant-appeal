/**
 * 多功能下拉菜单组件
 * @description 用户中心菜单，包含申诉工具、订单支付、会话管理、系统设置四大分组
 * 
 * 菜单分组：
 * 1. 申诉工具 — 申诉全流程指导、投诉材料整理、申诉文案
 * 2. 订单与支付 — 绑定订单、充值余额
 * 3. 会话管理 — 历史对话、导出对话、新对话、个人中心
 * 4. 系统 — 联系技术人员、退出登录
 * 
 * 功能特性：
 * - 顶部显示用户头像、昵称、余额
 * - 支持专业模式（proMode）主题切换
 * - 点击遮罩层关闭菜单
 * - 菜单项支持激活状态、禁用状态、危险操作样式
 * 
 * @param {Object} props
 * @param {boolean} props.show - 是否显示菜单
 * @param {Object} props.pos - 菜单位置 {right, top}
 * @param {Function} props.onClose - 关闭菜单回调
 * @param {Object} props.user - 用户信息 {nickname, balance}
 * @param {boolean} props.isProfessionalMode - 是否为专业模式
 * @param {Object} props.boundOrder - 已绑定订单对象
 * @param {Array} props.messages - 当前会话消息数组
 * @param {Function} props.onOpenAppealGuide - 打开申诉全流程指导回调
 * @param {Function} props.onOpenComplaintDoc - 打开投诉材料整理回调
 * @param {Function} props.onOpenAppealPanel - 打开申诉文案回调
 * @param {Function} props.onOpenOrderPanel - 打开绑定订单回调
 * @param {Function} props.onOpenRecharge - 打开充值回调
 * @param {Function} props.onOpenHistory - 打开历史对话回调
 * @param {Function} props.onExportChat - 导出对话回调
 * @param {Function} props.onNewChat - 新对话回调
 * @param {Function} props.onOpenUserCenter - 打开个人中心回调
 * @param {Function} [props.onOpenContact] - 联系技术人员回调
 * @param {Function} props.onLogout - 退出登录回调
 */
import React from 'react'
import UserAvatar from './UserAvatar'

/**
 * 菜单项组件
 * @description 渲染单个菜单按钮，支持多种状态样式
 * 
 * 状态优先级：
 * 1. disabled → 灰色不可点击
 * 2. danger → 红色危险操作
 * 3. isActive → 高亮激活状态
 * 4. 默认 → 普通样式
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - SVG path 内容（不含 svg 标签）
 * @param {string} props.label - 菜单项文字标签
 * @param {string} [props.sublabel] - 副标签（显示在主标签下方）
 * @param {Function} [props.onClick] - 点击回调
 * @param {boolean} [props.isActive=false] - 是否激活状态
 * @param {boolean} [props.disabled=false] - 是否禁用
 * @param {boolean} [props.danger=false] - 是否危险操作
 * @param {boolean} [props.hasIndicator=false] - 是否显示指示器圆点
 * @param {string} [props.indicatorColor='bg-green-500'] - 指示器颜色
 * @param {boolean} [props.isPro=false] - 是否专业模式
 */
function MenuItem({ icon, label, sublabel, onClick, isActive = false, disabled = false, danger = false, hasIndicator = false, indicatorColor = 'bg-green-500', isPro = false }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 rounded-xl text-left ${
        disabled
          ? (isPro ? 'text-stone-300 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
          : danger
            ? (isPro ? 'text-red-600 hover:bg-red-50 active:bg-red-100' : 'text-red-600 hover:bg-red-50 active:bg-red-100')
            : isActive
              ? (isPro ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')
              : (isPro ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:bg-stone-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100')
      }`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isActive
          ? (isPro ? 'bg-amber-200/60' : 'bg-green-200/60')
          : (isPro ? 'bg-stone-100' : 'bg-gray-100')
      }`}>
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isActive ? 'font-semibold' : ''}`}>
            {label}
          </span>
          {hasIndicator && (
            <span className={`w-2 h-2 rounded-full ${indicatorColor} flex-shrink-0`} />
          )}
        </div>
        {sublabel && (
          <p className={`text-xs mt-0.5 truncate ${isPro ? 'text-stone-400' : 'text-gray-400'}`}>
            {sublabel}
          </p>
        )}
      </div>
      {!disabled && !danger && (
        <svg className={`w-4 h-4 flex-shrink-0 ${isPro ? 'text-stone-300' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}

export default function MoreMenu({
  show,
  pos,
  onClose,
  user,
  isProfessionalMode,
  boundOrder,
  messages,
  onOpenAppealGuide,
  onOpenComplaintDoc,
  onOpenAppealPanel,
  onOpenOrderPanel,
  onOpenRecharge,
  onOpenHistory,
  onExportChat,
  onNewChat,
  onOpenUserCenter,
  onOpenContact = () => {},
  onLogout,
}) {
  if (!show) return null

  const safePos = pos && typeof pos === 'object' ? { right: pos.right || 0, top: pos.top || 0 } : { right: 0, top: 0 }
  const safeBalance = typeof user?.balance === 'number' ? user.balance : parseFloat(user?.balance) || 0
  const boundLabel = boundOrder ? (boundOrder.goods?.title || boundOrder.product_name || '').slice(0, 20) : ''
  const msgCount = Array.isArray(messages) ? messages.length : 0

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 90 }} onClick={onClose} />
      <div
        className="fixed w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 py-2 animate-scale-in overflow-hidden"
        style={{ right: safePos.right, top: safePos.top, zIndex: 100 }}
      >
        <div className={`px-4 py-3 ${isProfessionalMode ? 'bg-stone-800' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`}>
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-bold truncate">{user?.nickname || '用户'}</div>
              <div className="text-white/70 text-xs">余额 ¥{safeBalance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="py-1.5">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">申诉工具</div>
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
            label="申诉全流程指导"
            onClick={() => { onOpenAppealGuide(); onClose() }}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
            label="投诉材料整理"
            onClick={() => { onOpenComplaintDoc(); onClose() }}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
            label="申诉文案"
            onClick={() => { onOpenAppealPanel(); onClose() }}
            isPro={isProfessionalMode}
          />
        </div>

        <div className="py-1.5 border-t border-gray-100">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">订单与支付</div>
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />}
            label="绑定订单"
            sublabel={boundLabel || '选择订单关联会话'}
            onClick={() => { onOpenOrderPanel(); onClose() }}
            isActive={!!boundOrder}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />}
            label="充值余额"
            sublabel={`当前 ¥${safeBalance.toFixed(2)}`}
            onClick={() => { onOpenRecharge(); onClose() }}
            isPro={isProfessionalMode}
          />
        </div>

        <div className="py-1.5 border-t border-gray-100">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">会话管理</div>
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
            label="历史对话"
            onClick={() => { onOpenHistory(); onClose() }}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
            label="导出对话"
            sublabel={msgCount ? `${msgCount} 条消息` : ''}
            onClick={() => { onExportChat(); onClose() }}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />}
            label="新对话"
            onClick={() => { onNewChat(); onClose() }}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
            label="个人中心"
            onClick={() => { onOpenUserCenter(); onClose() }}
            isPro={isProfessionalMode}
          />
        </div>

        <div className="py-1.5 border-t border-gray-100">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">系统</div>
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />}
            label="联系技术人员"
            onClick={() => onClose()}
            isPro={isProfessionalMode}
          />
          <MenuItem
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
            label="退出登录"
            onClick={() => { onLogout(); onClose() }}
            danger
            isPro={isProfessionalMode}
          />
        </div>
      </div>
    </>
  )
}
