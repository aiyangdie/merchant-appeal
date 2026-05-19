/**
 * @fileoverview 管理员后台页面
 * 系统管理员的全功能运营和管理面板，包含14个子模块
 *
 * 核心功能模块：
 *   - 仪表盘：系统概览、会话统计、用户活跃、收入趋势、案件处理效率
 *   - 知识库：规则管理和知识条目管理
 *   - 数据分析：用户行为、会话趋势、功能使用统计
 *   - 用户管理：用户列表、搜索、余额调整、删除
 *   - 订单管理：闲管家订单查看、状态筛选、发货管理、地址查看
 *   - 充值管理：充值记录、支付方式配置
 *   - AI模型：模型配置、健康检查、Token使用统计
 *   - Token明细：用户Token消费、功能分类、每日趋势
 *   - DS余额：DeepSeek API 余额查询和管理
 *   - AI日志：AI 活动日志、调用记录
 *   - AI进化：自进化引擎、规则库、对话分析、知识聚合
 *   - 商品管理：商城商品 CRUD、AI 辅助生成、推荐统计
 *   - 日程安排：日程创建、编辑、状态切换
 *   - 监控告警：系统资源、进程、数据库连接池、告警管理
 *   - 数据备份：手动/自动备份、备份历史、删除管理
 *   - 系统设置：基本设置、AI配置、支付配置、安全设置、闲管家配置
 *
 * 子组件：
 *   - MiniChart: 迷你柱状图（用于趋势展示）
 *   - HourlyChart: 24小时分布图
 *   - ConfigField: 配置项编辑器（支持开关/模式/文本/数字/密码/URL等类型）
 *   - SessionItem: 会话列表项
 * 关键依赖：
 *   - useNavigate (react-router-dom): 路由导航
 *   - orderUtils: 订单格式化工具函数
 *   - 各类 Panel 组件: 功能子面板
 *
 * 注意事项：
 *   - 文件非常大（>128KB），包含大量内联逻辑
 *   - SENSITIVE_KEYS 定义了需要密码掩码的配置项
 *   - ConfigField 自动推断输入类型（toggle/mode/textarea/number/url/sensitive）
 *   - 所有管理操作需要管理员认证（通过 getAuthHeaders 或 token）
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import DOMPurify from 'dompurify'
import { useNavigate } from 'react-router-dom'
import { formatOrderAmount, formatOrderStatusLabel, formatRefundStatusLabel, formatFullAddress, formatConsignLabel, ORDER_STATUS_MAP, REFUND_STATUS_MAP } from '../utils/orderUtils'
import ChatMessage from '../components/ChatMessage'
import ReportCard from '../components/ReportCard'
import AnalysisVisualView from '../components/AnalysisVisualView'
import AIActivityPanel from '../components/AIActivityPanel'
import TokenPanel from '../components/TokenPanel'
import AnalyticsPanel from '../components/AnalyticsPanel'
import { getTokenTypeMeta } from '../constants/tokenUsageTypes.js'
import AIModelsPanel from '../components/AIModelsPanel'
import MonitorPanel from '../components/MonitorPanel'
import BackupPanel from '../components/BackupPanel'
import SchedulePanel from '../components/SchedulePanel'
import UsersPanel from '../components/UsersPanel'
import MallPanel from '../components/MallPanel'
import EvolutionPanel from '../components/EvolutionPanel'
import SessionChatboardPanel from '../components/SessionChatboardPanel'
import PaymentSettingsGuide, { getPaymentFieldHint } from '../components/PaymentSettingsGuide'
import OpsCenterPanel from '../components/OpsCenterPanel'
import AdminAiTabLayout from '../components/AdminAiTabLayout'
import XianyuPanel from '../components/XianyuPanel'
import XianyuDashboard from '../components/XianyuDashboard'
import AuditLogPanel from '../components/AuditLogPanel'
import FloatingAdminAi from '../components/FloatingAdminAi.jsx'

/** 标签页分组配置：定义管理后台的导航结构 */
const TAB_GROUPS = [
  {
    label: '核心功能',
    items: [
      { key: 'dashboard', label: '仪表盘', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
      { key: 'sessions', label: '用户对话', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
      { key: 'session-chatboard', label: '会话看板', icon: 'M4 6h16M4 10h16M4 14h10M4 18h8' },
      { key: 'ops-center', label: '运营中心', badge: '新', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
      { key: 'knowledge', label: '知识库', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
      { key: 'analytics', label: '数据分析', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
      { key: 'users', label: '用户管理', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
      { key: 'orders', label: '订单管理', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
      { key: 'recharge', label: '充值管理', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ]
  },
  {
    label: '闲鱼运营',
    items: [
      { key: 'xianyu', label: '闲鱼运营', badge: '闲', icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3a3 3 0 013-3h6a3 3 0 013 3m-12.75 0V7.5A2.25 2.25 0 019 5.25h6a2.25 2.25 0 012.25 2.25v6.75' },
    ]
  },
  {
    label: 'AI 智能',
    items: [
      { key: 'ai-models', label: 'AI模型', icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
      { key: 'tokens', label: 'Token明细', icon: 'M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75zM5.625 10.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75zM5.625 16.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
      { key: 'deepseek-balance', label: 'DS余额', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
      { key: 'ai-activity', label: 'AI日志', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
      { key: 'evolution', label: 'AI进化', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
    ]
  },
  {
    label: '商城运营',
    items: [
      { key: 'mall', label: '商品管理', icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3a3 3 0 013-3h6a3 3 0 013 3m-12.75 0V7.5A2.25 2.25 0 019 5.25h6a2.25 2.25 0 012.25 2.25v6.75' },
    ]
  },
  {
    label: '系统运维',
    items: [
      { key: 'schedule', label: '日程安排', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
      { key: 'monitor', label: '监控告警', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
      { key: 'backup', label: '数据备份', icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125' },
      { key: 'audit-log', label: '资金流水', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
      { key: 'settings', label: '系统设置', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l1.004-.828a1.125 1.125 0 01.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    ]
  },
]

const TABS = TAB_GROUPS.flatMap(g => g.items)

const SETTINGS_SUB_TABS = [
  { key: 'general', label: '基本设置', icon: '🏠' },
  { key: 'ai', label: 'AI 配置', icon: '🤖' },
  { key: 'rechargeConfig', label: '充值设置', icon: '💰' },
  { key: 'wechat', label: '微信支付', icon: '💚' },
  { key: 'alipay', label: '支付宝', icon: '🔵' },
  { key: 'security', label: '安全设置', icon: '🔒' },
  { key: 'xianyu', label: '闲管家配置', icon: '🐟' },
]

const SENSITIVE_KEYS = ['api_key', 'api_v3_key', 'private_key', 'password', 'serial_no', 'public_key']

const ACTION_LABELS = {
  register: { label: '注册', color: 'bg-green-100 text-green-700' },
  login: { label: '登录', color: 'bg-blue-100 text-blue-700' },
  chat: { label: '聊天', color: 'bg-purple-100 text-purple-700' },
  balance: { label: '余额', color: 'bg-orange-100 text-orange-700' },
}

const COLLECTED_DATA_LABELS = {
  industry: '行业类型',
  violation_type: '违规类型',
  merchant_id: '商户号',
  platform: '平台',
  reason: '违规原因',
  contact: '联系方式',
  company_name: '公司名称',
  appeal_content: '申诉内容',
  supplementary: '补充说明',
  phone: '手机号',
  email: '邮箱',
  name: '姓名',
}

// Mini bar chart component
function MiniChart({ data, height = 48, color = '#22c55e' }) {
  if (!data || data.length === 0) return <div style={{ height }} className="flex items-end justify-center text-xs text-gray-300">暂无数据</div>
  const max = Math.max(...data.map(d => d.cnt), 1)
  return (
    <div style={{ height }} className="flex items-end gap-[2px]">
      {data.map((d, i) => (
        <div key={i} className="flex-1 rounded-t transition-all hover:opacity-80" title={`${d.label || ''}: ${d.cnt}`}
          style={{ height: `${Math.max((d.cnt / max) * 100, 4)}%`, backgroundColor: color, minWidth: 3 }} />
      ))}
    </div>
  )
}

function HourlyChart({ data }) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hr: i, cnt: 0 }))
  if (data) data.forEach(d => { const h = hours.find(x => x.hr === d.hr); if (h) h.cnt = d.cnt })
  const max = Math.max(...hours.map(h => h.cnt), 1)
  return (
    <div className="flex items-end gap-[1px]" style={{ height: 56 }}>
      {hours.map(h => (
        <div key={h.hr} className="flex-1 rounded-t transition-all hover:opacity-70" title={`${h.hr}:00 — ${h.cnt} 条`}
          style={{ height: `${Math.max((h.cnt / max) * 100, 3)}%`, backgroundColor: h.cnt > 0 ? '#8b5cf6' : '#e5e7eb', minWidth: 2 }} />
      ))}
    </div>
  )
}

function ConfigField({ cfg, idx, configs, setConfigs }) {
  const k = cfg.config_key
  const v = cfg.config_value || ''
  const update = val => {
    const u = [...configs]
    const i = idx >= 0 ? idx : u.findIndex(c => c.config_key === k)
    if (i >= 0) u[i] = { ...u[i], config_value: val }
    else u.push({ config_key: k, config_value: val, config_label: cfg.config_label || k, config_group: cfg.config_group || 'general' })
    setConfigs(u)
  }
  const isSensitive = SENSITIVE_KEYS.some(s => k.includes(s))
  const [showPwd, setShowPwd] = useState(false)

  // 开关类型：enabled / enable_
  const isToggle = k.endsWith('_enabled') || k.startsWith('enable_')
  // 模式选择：_mode
  const isMode = k.endsWith('_mode')
  // 长文本：private_key / public_key / instructions
  const isTextarea = k.includes('private_key') || k.includes('public_key') || k.includes('instructions')
  // 数字：temperature / multiplier / per_message / min_amount
  const isNumber = k.includes('temperature') || k.includes('multiplier') || k.includes('per_message') || k.includes('min_amount')
  // URL 类型
  const isUrl = k.endsWith('_url') || k.includes('_qr_') || k.endsWith('_gateway')
  // 预设金额列表
  const isAmountList = k.includes('_amounts')

  return (
    <div className="px-4 py-3 sm:py-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-gray-700">{cfg.config_label || k}</label>
        {isToggle && (
          <button type="button" onClick={() => update(v === '1' ? '0' : '1')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${v === '1' ? 'bg-wechat-green' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v === '1' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-2">{k}</p>
      {getPaymentFieldHint(k) ? <p className="text-[11px] text-blue-600/90 mb-2 leading-relaxed">{getPaymentFieldHint(k)}</p> : null}

      {isToggle ? (
        <span className={`text-xs font-medium ${v === '1' ? 'text-green-600' : 'text-gray-400'}`}>{v === '1' ? '已开启' : '已关闭'}</span>
      ) : isMode ? (
        <select value={v} onChange={e => update(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green">
          <option value="sandbox">沙箱测试 (sandbox)</option>
          <option value="production">正式环境 (production)</option>
        </select>
      ) : isTextarea ? (
        <textarea value={v} onChange={e => update(e.target.value)} rows={4} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={`请输入${cfg.config_label || ''}`} />
      ) : isNumber ? (
        <input type="number" step={k.includes('temperature') ? '0.1' : '0.01'} value={v} onChange={e => update(e.target.value)} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={`请输入${cfg.config_label || ''}`} />
      ) : isSensitive ? (
        <div className="relative">
          <input type={showPwd ? 'text' : 'password'} value={v} onChange={e => update(e.target.value)} autoComplete="new-password" data-lpignore="true" data-1p-ignore
            className="w-full px-3 py-2 pr-[4.5rem] rounded-lg border border-gray-200 bg-gray-50/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
            placeholder={`请输入${cfg.config_label || ''}`} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {v && (
              <button type="button" onClick={() => update('')}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors" title="清空">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="p-1 text-gray-400 hover:text-gray-600">
              {showPwd ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <input type={isUrl ? 'url' : 'text'} value={v} onChange={e => update(e.target.value)} autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-wechat-green/30 focus:border-wechat-green"
          placeholder={isUrl ? 'https://...' : isAmountList ? '10,30,50,100,200,500' : `请输入${cfg.config_label || ''}`} />
      )}
    </div>
  )
}

function SessionItem({ s, selectedSession, selectSession, handleDeleteSession, timeAgo }) {
  const hasUser = s.user_nickname || s.user_phone
  return (
    <div className={`relative group p-3 rounded-xl transition-all cursor-pointer ${
      selectedSession === s.id ? 'bg-green-50 border border-wechat-green/20' : 'hover:bg-gray-50 border border-transparent'
    }`}>
      <div onClick={() => selectSession(s.id)}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              s.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
            }`}>{s.status === 'active' ? '进行中' : '已完成'}</span>
            {hasUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium truncate max-w-24">
                {s.user_nickname || s.user_phone}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(s.created_at)}</span>
        </div>
        <p className="text-sm text-gray-700 truncate mt-1">{s.first_message || '新会话'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-gray-400">{s.message_count} 条消息</span>
          {hasUser && <span className="text-[10px] text-gray-300">{s.user_phone}</span>}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
        className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all" title="删除">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function __DEAD_START_UserCard() {
  return null
  const bal = parseFloat(u.balance || 0)
  const spent = parseFloat(u.total_spent || 0)
  const msgs = u.total_messages || 0
  const sess = u.session_count || 0
  const logins = u.login_count || 0
  const registered = fmtTime(u.created_at)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(u.nickname || '?')[0]}
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-800">{u.nickname || '-'}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <span>{u.phone}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                u.api_mode === 'custom' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
              }`}>{u.api_mode === 'custom' ? '自定义API' : '官方API'}</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 text-right">
          <div>ID: {u.id}</div>
          <div>{timeAgo(u.last_active_at)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-gray-50 border-b border-gray-50">
        {[
          { label: '余额', value: `¥${bal.toFixed(2)}`, color: bal > 0 ? 'text-green-600' : 'text-gray-400' },
          { label: '消费', value: `¥${spent.toFixed(2)}`, color: 'text-orange-600' },
          { label: '消息', value: msgs, color: 'text-gray-700' },
          { label: '会话', value: sess, color: 'text-gray-700', hideOnMobile: true },
          { label: '登录', value: `${logins}次`, color: 'text-gray-500', hideOnMobile: true },
        ].map((s, i) => (
          <div key={i} className={`py-2.5 text-center ${s.hideOnMobile ? 'hidden sm:block' : ''}`}>
            <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="px-3 sm:px-4 py-2 text-xs text-gray-400 flex items-center justify-between bg-gray-50/30">
        <div className="flex items-center gap-2 sm:gap-3 truncate">
          <span className="truncate">注册: {registered}</span>
          {u.last_ip && <span className="font-mono text-[10px]">IP: {u.last_ip}</span>}
        </div>
        {msgs > 0 && sess > 0 && <span className="flex-shrink-0">平均 {(msgs / sess).toFixed(1)} 条/会话</span>}
      </div>
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-1.5 sm:gap-2 border-t border-gray-50 flex-wrap">
        <input type="number" step="0.01"
          value={balanceInputs[u.id] || ''}
          onChange={e => setBalanceInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
          placeholder="金额"
          className="w-16 sm:w-20 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-center focus:outline-none focus:ring-2 focus:ring-wechat-green/20 focus:border-wechat-green" />
        <button onClick={() => handleAdjustBalance(u.id, balanceInputs[u.id])} disabled={!balanceInputs[u.id]}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors disabled:opacity-40">充值</button>
        <button onClick={() => { const v = parseFloat(balanceInputs[u.id] || 0); if (v > 0) handleAdjustBalance(u.id, -v) }} disabled={!balanceInputs[u.id]}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors disabled:opacity-40">扣款</button>
        <div className="flex-1" />
        <button onClick={() => handleDeleteUser(u.id, u.nickname)}
          className="px-2.5 sm:px-3 py-1.5 text-[11px] bg-red-50 text-red-500 rounded-lg hover:bg-red-100 font-medium transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          删除
        </button>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const validTabs = TABS.map(t => t.key)
  const hashTab = window.location.hash.replace('#', '')
  const [activeTab, _setActiveTab] = useState(validTabs.includes(hashTab) ? hashTab : 'dashboard')
  const setActiveTab = (tab) => { _setActiveTab(tab); window.location.hash = tab }
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [sessionDetail, setSessionDetail] = useState(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [stats, setStats] = useState(null)
  const [systemConfigs, setSystemConfigs] = useState([])
  const [paymentConfigs, setPaymentConfigs] = useState([])
  const [paymentChannels, setPaymentChannels] = useState({})
  const [saving, setSaving] = useState(false)
  const [xianyuRawText, setXianyuRawText] = useState('')
  const [parsingXianyu, setParsingXianyu] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)
  const [settingsSubTab, setSettingsSubTab] = useState('general')
  const [adminReply, setAdminReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [sessionSearchQ, setSessionSearchQ] = useState('')
  const [quickReplies, setQuickReplies] = useState([])
  const [rechargeOrders, setRechargeOrders] = useState([])
  const [loadingRecharge, setLoadingRecharge] = useState(false)
  const [rechargeFilter, setRechargeFilter] = useState('')
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orderFilter, setOrderFilter] = useState('')
  const [orderStatusDropdown, setOrderStatusDropdown] = useState(null)
  const [xianyuOrders, setXianyuOrders] = useState([])
  const [xianyuLoading, setXianyuLoading] = useState(false)
  const [xianyuPage, setXianyuPage] = useState(1)
  const [xianyuTotal, setXianyuTotal] = useState(0)
  const [xianyuPageSize] = useState(20)
  const [xianyuOrderStatus, setXianyuOrderStatus] = useState('')
  const [xianyuRefundStatus, setXianyuRefundStatus] = useState('')
  const [xianyuKeyword, setXianyuKeyword] = useState('')
  const [xianyuSubTab, setXianyuSubTab] = useState('xianyu-dashboard')
  const [xyModal, setXyModal] = useState(null)
  const [xyOrder, setXyOrder] = useState(null)
  const [xyShip, setXyShip] = useState({ expressNo: '', expressCompany: '' })
  const [xyPrice, setXyPrice] = useState('')
  const [xyLogistics, setXyLogistics] = useState([])
  const [xyCards, setXyCards] = useState(null)
  const [xyBusy, setXyBusy] = useState(false)
  const [appealStats, setAppealStats] = useState(null)
  // 知识库
  const [knowledgeCases, setKnowledgeCases] = useState([])
  const [loadingCases, setLoadingCases] = useState(false)
  const [caseForm, setCaseForm] = useState(null) // null=关闭, {}=新建/编辑
  const [savingCase, setSavingCase] = useState(false)
  const [caseAiLoading, setCaseAiLoading] = useState(false)
  const [caseMaterialPrefilled, setCaseMaterialPrefilled] = useState(false)
  const [caseAnalysisPickerOpen, setCaseAnalysisPickerOpen] = useState(false)
  const [caseAnalysisOptions, setCaseAnalysisOptions] = useState([])
  const [caseAnalysisPickerLoading, setCaseAnalysisPickerLoading] = useState(false)
  // 会话详情：收集数据 + AI分析
  const [sessionCollectedData, setSessionCollectedData] = useState({})
  const [sessionAnalysis, setSessionAnalysis] = useState(null)
  const [sessionInfoFields, setSessionInfoFields] = useState([])
  const [deepAnalysisResult, setDeepAnalysisResult] = useState(null)
  const [showAdminReport, setShowAdminReport] = useState(false)
  const [adminDetailTab, setAdminDetailTab] = useState('chat') // 'chat' | 'data' | 'analysis'
  const [analysisViewMode, setAnalysisViewMode] = useState('text') // 'text' | 'visual'
  // DeepSeek多账号余额
  const [dsAccounts, setDsAccounts] = useState([])
  const [dsSummary, setDsSummary] = useState({})
  const [dsLoading, setDsLoading] = useState(false)
  const [dsChecking, setDsChecking] = useState(false)
  const [dsCheckingId, setDsCheckingId] = useState(null)
  const [dsShowAdd, setDsShowAdd] = useState(false)
  const [dsForm, setDsForm] = useState({ label: '', apiKey: '', warningThreshold: '10' })
  const [dsEditId, setDsEditId] = useState(null)
  const [dsFetched, setDsFetched] = useState(false)
  const navigate = useNavigate()

  const adminFetch = useCallback((url, options = {}) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin'); return Promise.reject('no token') }
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` }
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    return fetch(url, { ...options, headers }).then(async res => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          // 只有在确认是认证失败时才删除token
          const errorMsg = errData.error || ''
          if (errorMsg.includes('过期') || errorMsg.includes('重新登录') || errorMsg.includes('无效')) {
            localStorage.removeItem('admin_token')
            navigate('/admin')
          }
          throw new Error(errData.error || `请求失败 (${res.status})`)
        }
        throw new Error(errData.error || `请求失败 (${res.status})`)
      }
      return res
    })
  }, [navigate])

  /** 会话无材料时，自动取最近一条有正文的进化对话分析 */
  const fetchBestEvolutionMaterial = useCallback(async () => {
    const listRes = await adminFetch('/api/admin/evolution/analyses?limit=20')
    const listJ = await listRes.json()
    if (!listRes.ok) return null
    const pick = (listJ.analyses || []).find((a) => a.raw_analysis && String(a.raw_analysis).trim().length > 80)
    if (!pick?.id) return null
    const cmRes = await adminFetch(`/api/admin/evolution/analyses/${pick.id}/case-material`)
    const cmJ = await cmRes.json()
    if (!cmRes.ok || !(cmJ.reportContent || '').trim()) return null
    return { analysisId: pick.id, ...cmJ }
  }, [adminFetch])

  // 打开案例弹窗时自动预填：先会话材料，无则回退进化分析
  useEffect(() => {
    if (!caseForm) {
      setCaseMaterialPrefilled(false)
      return
    }
    if ((caseForm.reportContent || '').trim().length >= 40 || caseForm.analysisId) return
    if (caseMaterialPrefilled) return
    const sid = caseForm.sessionId || selectedSession
    let cancelled = false
    ;(async () => {
      try {
        let bundle = null
        if (sid) {
          const res = await adminFetch(`/api/admin/sessions/${encodeURIComponent(sid)}/case-material`)
          const j = await res.json()
          if (!cancelled && res.ok && (j.reportContent || '').length >= 40) bundle = j
        }
        if (!bundle && !cancelled) bundle = await fetchBestEvolutionMaterial()
        if (cancelled || !bundle?.reportContent || bundle.reportContent.length < 40) return
        setCaseForm((f) => {
          if ((f.title || '').trim() && (f.successSummary || '').trim()) return f
          return {
            ...f,
            sessionId: sid || bundle.sessionId || f.sessionId || '',
            analysisId: bundle.analysisId || f.analysisId,
            reportContent: bundle.reportContent.slice(0, 8000),
            title: f.title || bundle.title || '',
            industry: f.industry || bundle.industry || '',
            problemType: f.problemType || bundle.problemType || '',
          }
        })
        setCaseMaterialPrefilled(true)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [caseForm, selectedSession, caseMaterialPrefilled, adminFetch, fetchBestEvolutionMaterial])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin'); return }
    
    // 不立即删除token，先尝试验证
    let cancelled = false
    async function loadData() {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          adminFetch('/api/admin/stats'),
          adminFetch('/api/admin/sessions')
        ])
        if (cancelled) return
        const statsData = await statsRes.json()
        setStats(statsData)
        const appealStatsRes = await adminFetch('/api/admin/appeal-stats')
        if (cancelled) return
        const appealStatsData = await appealStatsRes.json()
        setAppealStats(appealStatsData)
        if (cancelled) return
        const sessionsData = await sessionsRes.json()
        setSessions(sessionsData.sessions || [])
      } catch (e) {
        // 只有在明确的认证失败时才删除token
        if (e.message && (e.message.includes('过期') || e.message.includes('重新登录'))) {
          localStorage.removeItem('admin_token')
          navigate('/admin')
        } else {
          console.error('Load data error:', e)
        }
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (activeTab === 'deepseek-balance' && !dsFetched) {
      setDsFetched(true)
      fetchDsAccounts()
    }
  }, [activeTab, dsFetched])

  useEffect(() => {
    if (!orderStatusDropdown) return
    const handleClick = () => setOrderStatusDropdown(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [orderStatusDropdown])

  const toastHideTimerRef = useRef(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current)
    toastHideTimerRef.current = setTimeout(() => setToast(''), 2500)
  }, [])

  async function fetchStats() {
    try { setStats(await (await adminFetch('/api/admin/stats')).json()) } catch (e) { console.error(e) }
    try { setAppealStats(await (await adminFetch('/api/admin/appeal-stats')).json()) } catch {}
  }
  async function fetchSessions(force = false) {
    if (sessions.length === 0 || force || sessionSearchQ.trim()) setLoadingSessions(true)
    try {
      const q = sessionSearchQ.trim()
      const url = q ? `/api/admin/sessions?q=${encodeURIComponent(q)}` : '/api/admin/sessions'
      const j = await (await adminFetch(url)).json()
      setSessions(j.sessions || [])
    }
    catch (e) { console.error(e) } finally { setLoadingSessions(false) }
  }
  async function fetchQuickReplies() {
    try {
      const j = await (await adminFetch('/api/admin/ops/quick-replies')).json()
      setQuickReplies(j.items || [])
    } catch (e) { console.error(e) }
  }
  function applyCollectedDataFromSession(sessionObj) {
    if (!sessionObj?.collected_data || typeof sessionObj.collected_data !== 'object') {
      setSessionCollectedData({})
      return
    }
    const clean = {}
    for (const [k, v] of Object.entries(sessionObj.collected_data)) {
      if (k.startsWith('_')) continue
      clean[k] = typeof v === 'string' ? v : (v != null ? String(v) : '')
    }
    setSessionCollectedData(clean)
  }

  async function selectSession(id) {
    setSelectedSession(id); setLoadingMessages(true); setMobileShowChat(true); setAdminDetailTab('chat')
    setSessionCollectedData({}); setSessionAnalysis(null); setSessionInfoFields([]); setDeepAnalysisResult(null)
    try {
      const [msgHttp, analysisRes] = await Promise.all([
        adminFetch(`/api/admin/sessions/${id}/messages`),
        adminFetch(`/api/admin/sessions/${id}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      const msgRes = await msgHttp.json()
      if (!msgHttp.ok || !msgRes.session) {
        showToast(msgRes.error || '会话已删除或不存在')
        setSelectedSession(null)
        setMessages([])
        setSessionDetail(null)
        if (msgHttp.status === 404) {
          setSessions((p) => p.filter((s) => s.id !== id))
        }
        return
      }
      setMessages(msgRes.messages || [])
      setSessionDetail(msgRes.session || null)
      const sessionObj = msgRes.session
      applyCollectedDataFromSession(sessionObj)
      if (sessionObj?.deep_analysis_result) {
        setDeepAnalysisResult(sessionObj.deep_analysis_result)
      }
      if (analysisRes && !analysisRes.error) setSessionAnalysis(analysisRes)
    } catch (e) { console.error(e); showToast('加载会话失败') } finally { setLoadingMessages(false) }
  }
  async function handleDeleteSession(id) {
    if (!confirm('确定删除该会话及所有聊天记录？')) return
    try {
      await adminFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
      setSessions(p => p.filter(s => s.id !== id))
      if (selectedSession === id) { setSelectedSession(null); setMessages([]); setSessionDetail(null) }
      showToast('已删除'); fetchStats()
    } catch (e) { console.error(e) }
  }
  async function fetchSystemConfigs() {
    try { setSystemConfigs((await (await adminFetch('/api/admin/system-config')).json()).configs || []) } catch (e) { console.error(e) }
  }
  async function fetchPaymentConfigs() {
    try {
      const data = await (await adminFetch('/api/admin/payment-config')).json()
      setPaymentConfigs(data.configs || [])
      if (data.channels) setPaymentChannels(data.channels)
    } catch (e) { console.error(e) }
  }
  async function saveConfigs(url, configs, label) {
    setSaving(true)
    try {
      const validConfigs = configs.filter(c => c.config_key)
      if (validConfigs.length === 0) { showToast('无有效配置项可保存'); return }
      const res = await adminFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: validConfigs.map(c => ({ config_key: c.config_key, config_value: c.config_value ?? '' })) }) })
      const data = await res.json()
      if (data.success) {
        showToast(`${label}已保存`)
        if (url.includes('payment')) {
          if (data.channels) setPaymentChannels(data.channels)
          fetchPaymentConfigs()
        } else fetchSystemConfigs()
      } else {
        showToast(data.error || '保存失败')
      }
    } catch (err) { console.error('Save config error:', err); showToast(`保存失败: ${err.message}`) } finally { setSaving(false) }
  }
  async function parseXianyuConfig() {
    if (!xianyuRawText.trim()) { showToast('请粘贴闲管家应用配置信息'); return }
    setParsingXianyu(true)
    try {
      const res = await adminFetch('/api/admin/parse-xianyu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: xianyuRawText }),
      })
      const data = await res.json()
      if (data.success && data.config) {
        setSystemConfigs(prev => prev.map(c => {
          const val = data.config[c.config_key]
          if (val !== undefined) return { ...c, config_value: val }
          return c
        }))
        showToast('AI 解析成功，请检查并保存配置')
      } else {
        showToast(data.error || 'AI 解析失败')
      }
    } catch (err) { console.error('Parse xianyu config error:', err); showToast(`解析失败: ${err.message}`) }
    finally { setParsingXianyu(false) }
  }

  async function fetchRechargeOrders(filterOverride) {
    setLoadingRecharge(true)
    try {
      const f = filterOverride !== undefined ? filterOverride : rechargeFilter
      const url = f ? `/api/admin/recharge-orders?status=${f}` : '/api/admin/recharge-orders'
      const data = await (await adminFetch(url)).json()
      setRechargeOrders(data.orders || [])
    } catch (e) { console.error(e) } finally { setLoadingRecharge(false) }
  }
  async function handleConfirmRecharge(orderId) {
    if (!confirm('确认该充值订单？确认后余额将自动到账。')) return
    try {
      const res = await adminFetch(`/api/admin/recharge-orders/${orderId}/confirm`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('充值已确认，余额已到账')
      fetchRechargeOrders()
    } catch { showToast('操作失败') }
  }
  async function fetchOrders(filterOverride) {
    setLoadingOrders(true)
    try {
      const f = filterOverride !== undefined ? filterOverride : orderFilter
      const url = f ? `/api/admin/orders?status=${f}` : '/api/admin/orders'
      const data = await (await adminFetch(url)).json()
      setOrders(data.orders || [])
    } catch (e) { console.error(e) } finally { setLoadingOrders(false) }
  }
  async function fetchXianyuOrders(p, os, rs, kw) {
    setXianyuLoading(true)
    const page = p || xianyuPage
    const orderStatus = os !== undefined ? os : xianyuOrderStatus
    const refundStatus = rs !== undefined ? rs : xianyuRefundStatus
    const keyword = kw !== undefined ? kw : xianyuKeyword
    try {
      const params = new URLSearchParams({ page, pageSize: xianyuPageSize, refresh: '1' })
      if (orderStatus) params.append('order_status', orderStatus)
      if (refundStatus) params.append('refund_status', refundStatus)
      if (keyword) params.append('keyword', keyword)
      const res = await adminFetch(`/api/admin/xianyu-orders?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        setXianyuOrders(data.data.list || [])
        setXianyuTotal(data.data.total || 0)
        setXianyuPage(data.data.page || page)
      } else {
        showToast(data.error || '加载闲鱼订单失败')
        setXianyuOrders([])
        setXianyuTotal(0)
      }
    } catch (e) {
      showToast(e.message || '加载闲鱼订单失败')
      setXianyuOrders([])
      setXianyuTotal(0)
    }
    setXianyuLoading(false)
  }
  async function loadXyLogistics() {
    if (xyLogistics.length) return
    try {
      const res = await (await adminFetch('/api/xianyu/logistics/companies')).json()
      if (res.success) setXyLogistics(Array.isArray(res.data) ? res.data : (res.data?.list || []))
    } catch { /* ignore */ }
  }
  function openXyShip(o) {
    setXyOrder(o)
    setXyShip({ expressNo: '', expressCompany: '' })
    setXyModal('ship')
    loadXyLogistics()
  }
  async function submitXyShip() {
    if (!xyOrder || !xyShip.expressNo || !xyShip.expressCompany) {
      showToast('请填写物流公司与单号')
      return
    }
    setXyBusy(true)
    try {
      const res = await (await adminFetch('/api/xianyu/orders/ship', {
        method: 'POST',
        body: JSON.stringify({
          shopId: xyOrder.shop_id,
          orderId: xyOrder.order_no,
          expressNo: xyShip.expressNo,
          expressCompany: xyShip.expressCompany,
        }),
      })).json()
      if (res.success) {
        showToast('发货成功')
        setXyModal(null)
        fetchXianyuOrders()
      } else showToast(res.error || '发货失败')
    } catch (e) { showToast(e.message) }
    setXyBusy(false)
  }
  function openXyPrice(o) {
    setXyOrder(o)
    setXyPrice(String(formatOrderAmount(o) || ''))
    setXyModal('price')
  }
  async function submitXyPrice() {
    const price = parseFloat(xyPrice)
    if (!xyOrder || isNaN(price)) { showToast('请输入有效价格'); return }
    setXyBusy(true)
    try {
      const res = await (await adminFetch('/api/xianyu/orders/update-price', {
        method: 'POST',
        body: JSON.stringify({ shopId: xyOrder.shop_id, orderId: xyOrder.order_no, price }),
      })).json()
      if (res.success) {
        showToast('改价成功')
        setXyModal(null)
        fetchXianyuOrders()
      } else showToast(res.error || '改价失败')
    } catch (e) { showToast(e.message) }
    setXyBusy(false)
  }
  async function openXyCards(o) {
    setXyOrder(o)
    setXyCards(null)
    setXyModal('cards')
    setXyBusy(true)
    try {
      const q = o.shop_id ? `?shopId=${encodeURIComponent(o.shop_id)}` : ''
      const res = await (await adminFetch(`/api/xianyu/orders/${encodeURIComponent(o.order_no)}/cards${q}`)).json()
      if (res.success) setXyCards(res.data)
      else showToast(res.error || '获取卡密失败')
    } catch (e) { showToast(e.message) }
    setXyBusy(false)
  }
  async function handleUpdateOrderStatus(orderId, newStatus) {
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('状态已更新')
      setOrderStatusDropdown(null)
      fetchOrders()
    } catch { showToast('操作失败') }
  }
  async function handleRejectRecharge(orderId) {
    const note = prompt('请输入拒绝原因（可留空）：')
    if (note === null) return
    try {
      const res = await adminFetch(`/api/admin/recharge-orders/${orderId}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminNote: note }) })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('已拒绝该充值请求')
      fetchRechargeOrders()
    } catch { showToast('操作失败') }
  }
  async function fetchCases() {
    if (knowledgeCases.length === 0) setLoadingCases(true)
    try { setKnowledgeCases((await (await adminFetch('/api/admin/cases')).json()).cases || []) }
    catch (e) { console.error(e) } finally { setLoadingCases(false) }
  }
  async function fetchSchedules() {
    // SchedulePanel handles its own fetching
  }
  async function handleMarkSuccess(sessionId) {
    const title = prompt('请输入案例标题（可留空，自动从商户名生成）：')
    if (title === null) return
    const summary = prompt('请输入成功要点（如：材料充分、整改到位）：')
    if (summary === null) return
    try {
      const res = await adminFetch('/api/admin/cases/from-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title: title || '', successSummary: summary || '' }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      showToast('已标记为成功案例并加入知识库')
    } catch { showToast('操作失败') }
  }
  function applyCaseSuggestion(form, suggestion) {
    const s = suggestion || {}
    const next = { ...form }
    const filled = []
    const apply = (key, label) => {
      const v = typeof s[key] === 'string' ? s[key].trim() : ''
      if (v) {
        next[key] = v
        filled.push(label)
      }
    }
    apply('title', '标题')
    apply('industry', '行业')
    apply('problemType', '处罚类型')
    apply('successSummary', '成功要点')
    apply('adminNotes', '管理员备注')
    return { next, filled }
  }

  async function loadCaseFromSession() {
    const sid = caseForm?.sessionId || selectedSession
    if (!sid) {
      showToast('请先在「聊天记录」中打开一个会话，或填写下方「案例材料」')
      return
    }
    setCaseAiLoading(true)
    try {
      const res = await adminFetch(`/api/admin/sessions/${encodeURIComponent(sid)}/case-material`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载材料失败')
      const report = (j.reportContent || '').slice(0, 8000)
      const src = (j.sources || []).join('、') || '无'
      setCaseForm((f) => ({
        ...f,
        sessionId: sid,
        title: f.title || j.title || f.title,
        industry: f.industry || j.industry || '',
        problemType: f.problemType || j.problemType || '',
        reportContent: report,
      }))
      if (report.length > 40) {
        showToast(`已加载案例材料（来源：${src}），可点击「AI 根据材料填写」`)
        return
      }
      const evo = await fetchBestEvolutionMaterial()
      if (evo?.reportContent?.length >= 40) {
        setCaseForm((f) => ({
          ...f,
          analysisId: evo.analysisId,
          reportContent: evo.reportContent.slice(0, 8000),
          industry: f.industry || evo.industry || '',
          problemType: f.problemType || evo.problemType || '',
        }))
        showToast('当前会话无材料，已自动改用最近一条进化对话分析')
        return
      }
      showToast(j.sessionExists === false
        ? '当前会话已删除且无可用进化分析，请手动粘贴材料'
        : '会话与进化分析均无可用材料，请手动粘贴')
    } catch (e) {
      showToast(e.message || '加载会话失败')
    }
    setCaseAiLoading(false)
  }

  async function openCaseAnalysisPicker() {
    setCaseAnalysisPickerOpen(true)
    setCaseAnalysisPickerLoading(true)
    try {
      const res = await adminFetch('/api/admin/evolution/analyses?limit=30')
      const j = await res.json()
      const list = (j.analyses || []).filter((a) => a.raw_analysis && String(a.raw_analysis).trim().length > 80)
      setCaseAnalysisOptions(list)
      if (!list.length) showToast('暂无可用对话分析记录')
    } catch (e) {
      showToast(e.message || '加载分析列表失败')
    }
    setCaseAnalysisPickerLoading(false)
  }

  async function loadCaseFromEvolutionAnalysis(analysisId) {
    setCaseAiLoading(true)
    try {
      const res = await adminFetch(`/api/admin/evolution/analyses/${analysisId}/case-material`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载失败')
      const report = (j.reportContent || '').slice(0, 8000)
      const src = (j.sources || []).join('、') || '对话分析'
      setCaseForm((f) => ({
        ...f,
        sessionId: j.sessionId || f.sessionId || '',
        analysisId,
        reportContent: report,
        industry: f.industry || j.industry || '',
        problemType: f.problemType || j.problemType || '',
        title: f.title || j.title || '',
      }))
      setCaseAnalysisPickerOpen(false)
      showToast(report.length > 40 ? `已从进化分析加载（${src}）` : '分析正文过短，请换一条记录')
    } catch (e) {
      showToast(e.message || '加载失败')
    }
    setCaseAiLoading(false)
  }

  async function handleCaseAiEnhance() {
    if (!caseForm) return
    const sid = caseForm.sessionId || selectedSession
    let formPayload = { ...caseForm }
    let reportLen = (formPayload.reportContent || '').trim().length
    let hasMaterial = reportLen >= 40 || (formPayload.successSummary || '').trim().length >= 20
    if (!hasMaterial && formPayload.analysisId) {
      try {
        const mRes = await adminFetch(`/api/admin/evolution/analyses/${formPayload.analysisId}/case-material`)
        const mj = await mRes.json()
        if (mRes.ok && (mj.reportContent || '').length >= 40) {
          formPayload = { ...formPayload, reportContent: mj.reportContent, industry: formPayload.industry || mj.industry || '', problemType: formPayload.problemType || mj.problemType || '' }
          setCaseForm(formPayload)
          hasMaterial = true
        }
      } catch { /* ignore */ }
    }
    if (!hasMaterial && sid) {
      try {
        const mRes = await adminFetch(`/api/admin/sessions/${encodeURIComponent(sid)}/case-material`)
        const mj = await mRes.json()
        if (mRes.ok && (mj.reportContent || '').length >= 40) {
          formPayload = {
            ...formPayload,
            reportContent: mj.reportContent,
            industry: formPayload.industry || mj.industry || '',
            problemType: formPayload.problemType || mj.problemType || '',
            title: formPayload.title || mj.title || '',
          }
          setCaseForm(formPayload)
          reportLen = mj.reportContent.length
          hasMaterial = true
        }
      } catch { /* ignore */ }
    }
    if (!hasMaterial) {
      setCaseAiLoading(true)
      try {
        const evo = await fetchBestEvolutionMaterial()
        if (evo?.reportContent?.length >= 40) {
          formPayload = {
            ...formPayload,
            analysisId: evo.analysisId,
            reportContent: evo.reportContent,
            industry: formPayload.industry || evo.industry || '',
            problemType: formPayload.problemType || evo.problemType || '',
          }
          setCaseForm(formPayload)
          hasMaterial = true
          showToast('已自动选用最近一条进化对话分析作为材料')
        }
      } catch { /* ignore */ }
      setCaseAiLoading(false)
    }
    if (!hasMaterial) {
      showToast('暂无可用材料：请粘贴案例正文，或点「从进化分析加载」手动选择')
      return
    }
    setCaseAiLoading(true)
    try {
      const res = await adminFetch('/api/admin/cases/ai-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid || undefined,
          analysisId: formPayload.analysisId || undefined,
          title: formPayload.title,
          industry: formPayload.industry,
          problemType: formPayload.problemType,
          reportContent: formPayload.reportContent,
          successSummary: formPayload.successSummary,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        if (j.code === 'EMPTY_SUGGESTION' && j.suggestion) {
          const { next, filled } = applyCaseSuggestion(formPayload, j.suggestion)
          if (filled.length) {
            setCaseForm(next)
            showToast(`部分填写：${filled.join('、')}，请补充材料后重试`)
            return
          }
        }
        throw new Error(j.error || 'AI 失败')
      }
      const merged = { ...caseForm, ...formPayload }
      const { next, filled } = applyCaseSuggestion(merged, j.suggestion)
      if (!filled.length) {
        showToast('AI 未生成有效内容，请补充案例材料后重试')
        return
      }
      setCaseForm(next)
      showToast(`已填写：${(j.filledFields || filled).join('、')}（请核对后保存）`)
    } catch (e) {
      showToast(e.message || 'AI 辅助失败')
    }
    setCaseAiLoading(false)
  }

  async function handleSaveCase() {
    if (!caseForm) return
    setSavingCase(true)
    try {
      if (caseForm.id) {
        await adminFetch(`/api/admin/cases/${caseForm.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caseForm),
        })
      } else {
        await adminFetch('/api/admin/cases', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caseForm),
        })
      }
      showToast('案例已保存'); setCaseForm(null); fetchCases()
    } catch { showToast('保存失败') } finally { setSavingCase(false) }
  }
  async function handleDeleteCase(id) {
    if (!confirm('确定删除该案例？')) return
    try {
      await adminFetch(`/api/admin/cases/${id}`, { method: 'DELETE' })
      showToast('已删除'); fetchCases()
    } catch { showToast('删除失败') }
  }

  useEffect(() => {
    if (activeTab === 'settings') { fetchSystemConfigs(); fetchPaymentConfigs() }
    if (activeTab === 'dashboard' || activeTab === 'analytics') fetchStats()
    if (activeTab === 'recharge') fetchRechargeOrders()
    if (activeTab === 'orders') fetchOrders()
    if (activeTab === 'xianyu' && xianyuSubTab === 'xianyu-orders' && !xianyuOrders.length) {
      fetchXianyuOrders(1, '', '', '')
    }
    if (activeTab === 'knowledge') fetchCases()
    if (activeTab === 'schedule') fetchSchedules()
    if (activeTab === 'sessions') { fetchSessions(true); fetchQuickReplies() }
  }, [activeTab])

  async function handleAdminReply() {
    if (!adminReply.trim() || !selectedSession || sendingReply) return
    setSendingReply(true)
    try {
      const res = await adminFetch(`/api/admin/sessions/${selectedSession}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', content: adminReply.trim() }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setMessages(data.messages || [])
      setAdminReply('')
      showToast('回复已发送')
    } catch { showToast('发送失败') }
    finally { setSendingReply(false) }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { showToast('密码至少6位'); return }
    setChangingPwd(true)
    try {
      const res = await adminFetch('/api/admin/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setNewPassword('')
      showToast('密码修改成功')
    } catch { showToast('修改失败') }
    finally { setChangingPwd(false) }
  }

  function handleLogout() { localStorage.removeItem('admin_token'); navigate('/admin') }

  function fmtTime(d) {
    if (!d) return '-'
    const ts = typeof d === 'number' ? (d < 1e12 ? d * 1000 : d) : d
    try { const t = new Date(ts); return isNaN(t.getTime()) ? String(d).slice(0, 19) : t.toLocaleString('zh-CN') } catch { return String(d) }
  }

  function xyImageSrc(url) {
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
  function fmtDay(d) {
    if (!d) return ''
    try { const t = new Date(d); return `${t.getMonth()+1}/${t.getDate()}` } catch { return '' }
  }
  function timeAgo(d) {
    if (!d) return '-'
    try {
      const diff = (Date.now() - new Date(d).getTime()) / 1000
      if (diff < 60) return '刚刚'
      if (diff < 3600) return `${Math.floor(diff/60)}分钟前`
      if (diff < 86400) return `${Math.floor(diff/3600)}小时前`
      return `${Math.floor(diff/86400)}天前`
    } catch { return '-' }
  }

  // ========== Dashboard ==========
  function renderDashboard() {
    const profit = stats?.profitAnalysis || {}
    const ts = stats?.tokenSummary || {}
    const mh = stats?.modelHealth || {}
    const rs = stats?.rechargeStats || {}

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-5">
        {/* Branding Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-emerald-500 to-blue-600 bg-clip-text text-transparent">商户申诉AI</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">自我迭代超级系统</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">AI全自动赚钱 · 智能健康巡检 · 故障自动切换 · 免费模型优先</p>
          </div>
          <button onClick={fetchStats} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors border border-transparent hover:border-purple-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
            刷新数据
          </button>
        </div>

        {/* === Row 1: Revenue & Profit Cards === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white relative overflow-hidden card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <p className="text-white/70 text-xs font-medium">充值收入</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">¥{(profit.rechargeIncome || 0).toFixed(2)}</p>
            <p className="text-white/50 text-[11px] mt-1.5">{rs.confirmedCount || 0}笔成功 · {rs.pendingCount || 0}笔待确认</p>
          </div>
          <div className="bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl p-5 text-white relative overflow-hidden card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <p className="text-white/70 text-xs font-medium">AI成本</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">¥{(profit.aiCostEstimate || 0).toFixed(4)}</p>
            <p className="text-white/50 text-[11px] mt-1.5">{mh.activeModel?.isFree ? '当前免费模型 🎉' : 'Token消耗成本'}</p>
          </div>
          <div className={`bg-gradient-to-br ${(profit.grossProfit || 0) >= 0 ? 'from-violet-500 to-purple-600' : 'from-red-500 to-rose-600'} rounded-2xl p-5 text-white relative overflow-hidden card-hover`} style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <p className="text-white/70 text-xs font-medium">毛利润</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">¥{(profit.grossProfit || 0).toFixed(2)}</p>
            <p className="text-white/50 text-[11px] mt-1.5">利润率 {profit.profitRate || 0}%</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white relative overflow-hidden card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <p className="text-white/70 text-xs font-medium">总用户</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{stats?.totalUsers ?? '-'}</p>
            <p className="text-white/50 text-[11px] mt-1.5">今日 +{stats?.todayUsers ?? 0} · 活跃 {stats?.activeUsersToday ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('session-chatboard')}
            className="text-left bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <p className="text-sm font-semibold text-indigo-900">会话看板</p>
            <p className="text-xs text-indigo-700/80 mt-1">消息量、时段、首句样本、AI 简报</p>
            <span className="text-xs font-medium text-indigo-600 mt-2 inline-block group-hover:translate-x-0.5 transition-transform">打开 →</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ops-center')}
            className="text-left bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-all group text-white"
          >
            <p className="text-sm font-semibold flex items-center gap-2">
              运营中心
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500 text-slate-900">新</span>
            </p>
            <p className="text-xs text-slate-300 mt-1">数据大屏 · 全文搜索 · 快照 · 质检 · Prompt</p>
            <span className="text-xs font-medium text-cyan-300 mt-2 inline-block">打开 →</span>
          </button>
        </div>

        {/* === Row 2: Quick Stats Pills === */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: '总会话', value: stats?.totalSessions ?? '-', sub: `+${stats?.todaySessions ?? 0}`, dot: 'bg-green-400' },
            { label: '总消息', value: stats?.totalMessages ?? '-', sub: `+${stats?.todayMessages ?? 0}`, dot: 'bg-purple-400' },
            { label: '活跃会话', value: stats?.activeSessions ?? '-', sub: '', dot: 'bg-blue-400' },
            { label: '总Token', value: parseInt(ts.total_tokens || 0).toLocaleString(), sub: `今日${parseInt(ts.todayTokens || 0).toLocaleString()}`, dot: 'bg-orange-400' },
            { label: 'AI请求', value: parseInt(ts.total_requests || 0).toLocaleString(), sub: `今日${ts.todayRequests || 0}`, dot: 'bg-cyan-400' },
            { label: '平均消息/会话', value: stats?.avgMsgsPerSession ?? '-', sub: '', dot: 'bg-pink-400' },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl px-3 py-3 text-center border border-gray-100/80 hover:shadow-md transition-shadow">
              <p className="text-base font-bold text-gray-800 tabular-nums">{c.value}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                <p className="text-[11px] text-gray-500 font-medium">{c.label}</p>
              </div>
              {c.sub && <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* === Row 3: Token消耗分类 + 模型健康 + 收入趋势 === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Token by type */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Token消耗分类 (哪里最费钱)</h3>
            {stats?.tokenByType?.length > 0 ? (
              <div className="space-y-1.5">
                {stats.tokenByType.map((t, i) => {
                  const total = stats.tokenByType.reduce((s, x) => s + parseInt(x.tokens), 0)
                  const pct = total > 0 ? (parseInt(t.tokens) / total * 100).toFixed(0) : 0
                  const meta = getTokenTypeMeta(t.type)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm flex-shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className="text-gray-600 font-medium truncate">{meta.label}</span>
                          <span className="text-gray-400 flex-shrink-0">{parseInt(t.tokens).toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-xs text-gray-300 text-center py-4">暂无数据</p>}
          </div>

          {/* Model health */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600">AI模型健康</h3>
              <button onClick={() => setActiveTab('ai-models')} className="text-[10px] text-purple-500 hover:text-purple-700">管理</button>
            </div>
            {mh.activeModel ? (
              <div className={`p-3 rounded-xl border ${mh.activeModel.status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} mb-3`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${mh.activeModel.status === 'healthy' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-xs font-semibold text-gray-700">{mh.activeModel.name}</span>
                  {mh.activeModel.isFree && <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">免费</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-[18px]">{mh.activeModel.status === 'healthy' ? '运行正常 · 当前使用中' : '异常 · 等待自动切换'}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-green-50">
                <div className="text-base font-bold text-green-600">{mh.healthy || 0}</div>
                <div className="text-[9px] text-green-500">健康</div>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <div className="text-base font-bold text-red-500">{mh.error || 0}</div>
                <div className="text-[9px] text-red-400">异常</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <div className="text-base font-bold text-gray-500">{mh.unknown || 0}</div>
                <div className="text-[9px] text-gray-400">未检测</div>
              </div>
            </div>
            <p className="text-[10px] text-gray-300 mt-2 text-center">每30分钟自动巡检 · 故障秒级切换</p>
          </div>

          {/* Revenue trend */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">收入趋势 (7天)</h3>
            <MiniChart data={(stats?.dailyRevenue || []).map(d => ({ cnt: parseFloat(d.revenue), label: fmtDay(d.day) }))} color="#8b5cf6" height={56} />
            <div className="hidden sm:flex justify-between mt-1.5 text-[9px] text-gray-300">
              {(stats?.dailyRevenue || []).map((d, j) => <span key={j}>{fmtDay(d.day)}</span>)}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-50 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">今日收入</span>
                <span className="font-semibold text-green-600">¥{parseFloat(stats?.todayRevenue ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">待确认</span>
                <span className="font-medium text-orange-500">¥{(rs.pendingTotal || 0).toFixed(2)} ({rs.pendingCount || 0}笔)</span>
              </div>
            </div>
          </div>
        </div>

        {/* === Row 3.5: 申诉成功率闭环 === */}
        {appealStats?.totals && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600">📊 申诉成功率 (用户真实反馈 → AI进化学习)</h3>
              <span className="text-[11px] px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                {appealStats.totals.decided || 0} 个已结案
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
              {[
                { label: '已生成', value: appealStats.totals.generated || 0, color: 'text-gray-600 bg-gray-50' },
                { label: '已提交', value: appealStats.totals.submitted || 0, color: 'text-blue-600 bg-blue-50' },
                { label: '审核中', value: appealStats.totals.under_review || 0, color: 'text-yellow-600 bg-yellow-50' },
                { label: '通过 ✅', value: appealStats.totals.approved || 0, color: 'text-green-700 bg-green-50' },
                { label: '驳回 ❌', value: appealStats.totals.rejected || 0, color: 'text-red-600 bg-red-50' },
                { label: '重新提交', value: appealStats.totals.resubmitted || 0, color: 'text-orange-600 bg-orange-50' },
                { label: '成功率', value: `${appealStats.totals.successRate || 0}%`, color: 'text-emerald-700 bg-emerald-50 font-bold' },
              ].map((c, i) => (
                <div key={i} className={`px-3 py-2.5 rounded-xl text-center ${c.color}`}>
                  <div className="text-lg font-bold">{c.value}</div>
                  <div className="text-[11px] mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
            {/* By industry / by violation breakdown */}
            {(appealStats.byIndustry?.length > 0 || appealStats.byViolation?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {appealStats.byIndustry?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-gray-400 mb-1.5">按行业成功率</h4>
                    <div className="space-y-1">
                      {appealStats.byIndustry.slice(0, 5).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600 truncate flex-1">{r.industry}</span>
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-green-600">{r.approved || 0}通过</span>
                            <span className="text-red-500">{r.rejected || 0}驳回</span>
                            <span className={`font-bold ${parseFloat(r.successRate) >= 60 ? 'text-green-700' : 'text-orange-600'}`}>{r.successRate}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {appealStats.byViolation?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-gray-400 mb-1.5">按违规类型成功率</h4>
                    <div className="space-y-1">
                      {appealStats.byViolation.slice(0, 5).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600 truncate flex-1">{r.violation_type}</span>
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-green-600">{r.approved || 0}通过</span>
                            <span className="text-red-500">{r.rejected || 0}驳回</span>
                            <span className={`font-bold ${parseFloat(r.successRate) >= 60 ? 'text-green-700' : 'text-orange-600'}`}>{r.successRate}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-gray-300 mt-3 text-center">用户标记申诉结果 → 自动喂入进化引擎 → AI越用越准 · 越用越赚钱</p>
          </div>
        )}

        {/* === Row 4: 7-day trends === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: '会话趋势', data: stats?.dailySessions, color: '#22c55e' },
            { title: '消息趋势', data: stats?.dailyMessages, color: '#8b5cf6' },
            { title: '新用户趋势', data: stats?.dailyUsers, color: '#3b82f6' },
          ].map((chart, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">{chart.title} (7天)</h3>
              <MiniChart data={(chart.data || []).map(d => ({ cnt: d.cnt, label: fmtDay(d.day) }))} color={chart.color} />
              <div className="hidden sm:flex justify-between mt-1.5 text-[9px] text-gray-300">
                {(chart.data || []).map((d, j) => <span key={j}>{fmtDay(d.day)}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* === Row 5: 24h distribution + API mode + Quick actions === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">24小时消息分布</h3>
            <HourlyChart data={stats?.hourlyMessages} />
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">API 模式分布</h3>
            {stats?.apiModes?.length > 0 ? (
              <div className="space-y-2">
                {stats.apiModes.map((m, i) => {
                  const total = stats.apiModes.reduce((s, x) => s + x.cnt, 0)
                  const pct = total > 0 ? ((m.cnt / total) * 100).toFixed(0) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{m.api_mode === 'official' ? '官方API' : '自定义API'}</span>
                        <span className="font-semibold">{m.cnt} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.api_mode === 'official' ? 'bg-blue-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-xs text-gray-300 text-center py-4">暂无数据</p>}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 mb-2.5">快速操作</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setActiveTab('tokens')} className="px-3 py-2 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium transition-colors">Token明细</button>
                <button onClick={() => setActiveTab('users')} className="px-3 py-2 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors">用户管理</button>
                <button onClick={() => setActiveTab('ai-models')} className="px-3 py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium transition-colors">AI模型</button>
                <a href="/" className="px-3 py-2 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 text-center font-medium transition-colors">访问前台</a>
              </div>
            </div>
          </div>
        </div>

        {/* === Row 6: Top Users (Money makers) === */}
        {stats?.topUsers?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Top 用户排行 (消息量/消费)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 pr-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">用户</th>
                    <th className="text-right py-2 px-3 font-medium">消息</th>
                    <th className="text-right py-2 px-3 font-medium">会话</th>
                    <th className="text-right py-2 px-3 font-medium">消费</th>
                    <th className="text-right py-2 px-3 font-medium">余额</th>
                    <th className="text-right py-2 pl-3 font-medium">活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topUsers.slice(0, 10).map((u, i) => (
                    <tr key={i} className="border-b border-gray-50/50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 pr-3 text-gray-400">{i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-700">{u.nickname || '匿名'}</div>
                        <div className="text-[11px] text-gray-400">{u.phone}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-700">{u.total_messages}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{u.sessions}</td>
                      <td className="py-2.5 px-3 text-right text-orange-600 font-semibold">¥{parseFloat(u.total_spent || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-green-600">¥{parseFloat(u.balance || 0).toFixed(2)}</td>
                      <td className="py-2.5 pl-3 text-right text-gray-400">{timeAgo(u.last_active_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === Row 7: Recent activity feed === */}
        {stats?.recentActions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">最近用户活动</h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto gpu-scroll">
              {stats.recentActions.slice(0, 15).map((a, i) => {
                const meta = ACTION_LABELS[a.action] || { label: a.action, color: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.badge || 'bg-gray-50 text-gray-600'}`}>{meta.icon} {meta.label}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{a.nickname || a.phone || '匿名'} {a.detail && <span className="text-gray-400">· {a.detail}</span>}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ========== Analytics ==========
  function renderAnalytics() {
    return (
      <AnalyticsPanel
        adminFetch={adminFetch}
        showToast={showToast}
        stats={stats}
        fetchStats={fetchStats}
        onOpenTokens={() => setActiveTab('tokens')}
      />
    )
  }

  function renderSessionList() {
    if (loadingSessions) return <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
    if (sessions.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">暂无对话记录<br/><span className="text-xs">用户开始聊天后会显示在这里</span></div>
    return <div className="space-y-1">{sessions.map(s => <SessionItem key={s.id} s={s} selectedSession={selectedSession} selectSession={selectSession} handleDeleteSession={handleDeleteSession} timeAgo={timeAgo} />)}</div>
  }

  // 找到当前选中会话对应的 session 对象（含 user 信息）
  function getSelectedSessionData() {
    return sessions.find(s => s.id === selectedSession) || null
  }

  function renderSessions() {
    const selData = getSelectedSessionData()
    return (
      <div className="flex flex-1 overflow-hidden">
        <aside className={`${mobileShowChat ? 'hidden' : 'block'} lg:block w-full lg:w-80 bg-white lg:border-r border-gray-100 overflow-y-auto flex-shrink-0`}>
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] text-gray-400">共 {sessions.length} 个对话</p>
              <button type="button" onClick={() => fetchSessions(true)} disabled={loadingSessions}
                className="text-[11px] text-purple-600 hover:text-purple-800 disabled:opacity-50 font-medium">
                {loadingSessions ? '刷新中…' : '刷新'}
              </button>
            </div>
            <form className="mb-2 flex gap-1" onSubmit={(e) => { e.preventDefault(); fetchSessions(true) }}>
              <input
                value={sessionSearchQ}
                onChange={(e) => setSessionSearchQ(e.target.value)}
                placeholder="搜索会话/消息…"
                className="flex-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1.5"
              />
              <button type="submit" className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600">搜</button>
            </form>
            {renderSessionList()}
          </div>
        </aside>
        <main className={`${!mobileShowChat && selectedSession ? 'hidden lg:block' : !mobileShowChat ? 'hidden lg:flex' : 'block'} flex-1 overflow-y-auto bg-[#f5f5f5]`}>
          {selectedSession ? (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="flex items-center mb-4 lg:hidden">
                <button onClick={() => setMobileShowChat(false)} className="mr-2 p-1.5 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </button>
                <span className="text-sm text-gray-600">返回列表</span>
              </div>
              {sessionDetail && (
                <div className="bg-white rounded-2xl p-3 sm:p-4 mb-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-50 px-1.5 py-0.5 rounded-md text-gray-400 text-[10px] font-mono">{sessionDetail.id.slice(0, 8)}</code>
                      {selData?.user_nickname && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          {selData.user_nickname}
                        </span>
                      )}
                      {selData?.user_phone && <span className="text-gray-300 text-[10px]">{selData.user_phone}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-300">{fmtTime(sessionDetail.created_at)}</span>
                      <button onClick={() => handleMarkSuccess(selectedSession)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-medium hover:bg-green-100 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        标记成功
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* 标签切换：聊天 / 客户数据 / AI分析 */}
              <div className="flex bg-white rounded-xl p-0.5 mb-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {[
                  { key: 'chat', label: '聊天记录', icon: '💬' },
                  { key: 'data', label: '客户数据', icon: '📋' },
                  { key: 'analysis', label: 'AI分析', icon: '🤖' },
                ].map(t => (
                  <button key={t.key} onClick={() => setAdminDetailTab(t.key)}
                    className={`flex-1 py-2 text-[12px] font-medium rounded-[10px] transition-all flex items-center justify-center gap-1 ${
                      adminDetailTab === t.key ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* 聊天记录 Tab */}
              {adminDetailTab === 'chat' && (
                <>
                  {loadingMessages ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : (
                    <div className="space-y-3">
                      {messages.length === 0 && <div className="text-center py-20 text-gray-400 text-sm">暂无聊天记录</div>}
                      {messages.map((m, i) => {
                      const isAdmin = m.role === 'admin'
                      if (isAdmin) {
                        return (
                          <div key={i} className="flex justify-start my-2.5">
                            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mr-2.5 mt-0.5">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                            </div>
                            <div className="max-w-[80%] lg:max-w-[70%] bg-gradient-to-br from-green-50 to-emerald-50 text-gray-800 rounded-[18px] rounded-tl-[4px] px-4 py-2.5 border border-green-100/80" style={{ boxShadow: '0 1px 3px rgba(16,185,129,0.1)' }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] text-green-600 font-medium">人工客服</span>
                              </div>
                              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            </div>
                          </div>
                        )
                      }
                      return <ChatMessage key={i} role={m.role} content={m.content} />
                    })}</div>
                  )}
                  {selectedSession && !loadingMessages && (
                    <div className="mt-4 bg-white rounded-2xl p-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-50 text-green-500 font-medium">人工客服</span>
                        <span className="text-[10px] text-gray-300">客户端显示为助手消息</span>
                      </div>
                      {quickReplies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {quickReplies.map((qr) => (
                            <button
                              key={qr.id}
                              type="button"
                              title={qr.content}
                              onClick={() => setAdminReply((prev) => (prev ? prev + '\n' : '') + qr.content)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              {qr.title}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdminReply() } }}
                          placeholder="输入回复内容..."
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200/80 bg-white text-[13px] resize-none focus:ring-2 focus:ring-green-300/30 focus:border-green-400 max-h-32 overflow-y-auto placeholder:text-gray-300" />
                        <button onClick={handleAdminReply} disabled={sendingReply || !adminReply.trim()}
                          className="px-4 py-2 bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-xl text-[12px] font-medium disabled:opacity-50 shadow-sm flex-shrink-0 h-9">
                          {sendingReply ? '发送中...' : '发送'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 客户数据 Tab */}
              {adminDetailTab === 'data' && (
                <div className="space-y-3">
                  {Object.keys(sessionCollectedData).length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm">暂无收集信息</div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <h3 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center"><span className="text-[12px]">📋</span></span>
                          客户填写信息（{Object.keys(sessionCollectedData).filter(k => { const v = sessionCollectedData[k]; return v && String(v).trim() }).length} 项）
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {Object.keys(sessionCollectedData).map(key => {
                            const val = sessionCollectedData[key]
                            if (!val || !String(val).trim()) return null
                            const label = COLLECTED_DATA_LABELS[key] || key
                            return (
                              <div key={key} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100/60 hover:border-emerald-200/60 hover:bg-emerald-50/30 transition-all">
                                <span className="block text-[10px] text-gray-400 mb-1 font-medium">{label}</span>
                                <span className="block text-[13px] text-gray-800 font-medium break-all">{val}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AI分析 Tab */}
              {adminDetailTab === 'analysis' && (
                <div className="space-y-3">
                  {/* DeepSeek 深度分析报告（优先显示） */}
                  {deepAnalysisResult ? (
                    <div>
                      {/* 顶部操作栏：模式切换 + 生成报告 */}
                      <div className="bg-white rounded-2xl overflow-hidden mb-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div className="px-3 sm:px-4 py-2.5 bg-indigo-50/60 flex items-center justify-between border-b border-indigo-100/50 gap-2">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-[12px] font-semibold text-indigo-700 hidden sm:inline">AI 深度分析</span>
                            <span className="text-[12px] font-semibold text-indigo-700 sm:hidden">分析报告</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* 视图模式切换 */}
                            <div className="flex bg-white/80 rounded-lg p-0.5 border border-indigo-100">
                              <button onClick={() => setAnalysisViewMode('text')}
                                className={`h-6 px-2.5 text-[10px] rounded-md font-medium transition-all ${analysisViewMode === 'text' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                  全文
                                </span>
                              </button>
                              <button onClick={() => setAnalysisViewMode('visual')}
                                className={`h-6 px-2.5 text-[10px] rounded-md font-medium transition-all ${analysisViewMode === 'visual' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                  清单
                                </span>
                              </button>
                            </div>
                            <button onClick={() => setShowAdminReport(true)} className="h-6 px-2 sm:px-3 flex items-center gap-1 text-[10px] text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 rounded-lg shadow-sm transition-all flex-shrink-0">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              <span className="hidden sm:inline">报告图片</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 全文模式 */}
                      {analysisViewMode === 'text' && (
                        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div className="px-4 py-4 text-[12px] text-gray-700 leading-relaxed break-words admin-analysis-md" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((() => {
                            return deepAnalysisResult
                              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                              .replace(/^## (.*$)/gm, '<div style="margin:20px 0 8px;display:flex;align-items:center;gap:8px;"><span style="width:3px;height:16px;border-radius:2px;background:#6366f1;flex-shrink:0;"></span><h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:0;">$1</h2></div>')
                              .replace(/^### (.*$)/gm, '<h3 style="font-size:13px;font-weight:600;color:#334155;margin:14px 0 6px;padding-left:8px;border-left:3px solid #818cf8;">$1</h3>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600;color:#1e293b;">$1</strong>')
                              .replace(/^  +[-·] (.*$)/gm, '<div style="display:flex;gap:6px;margin:2px 0 2px 20px;"><span style="color:#9ca3af;flex-shrink:0;">·</span><span>$1</span></div>')
                              .replace(/^- (.*$)/gm, '<div style="display:flex;gap:6px;margin:3px 0 3px 6px;"><span style="color:#818cf8;flex-shrink:0;">·</span><span>$1</span></div>')
                              .replace(/^(\d+)\. (.*$)/gm, '<div style="display:flex;gap:6px;margin:3px 0 3px 6px;"><span style="color:#6366f1;font-weight:700;flex-shrink:0;min-width:18px;">$1.</span><span>$2</span></div>')
                              .replace(/^---$/gm, '<hr style="margin:14px 0;border:none;border-top:1px solid #e5e7eb;"/>')
                              .replace(/\n{3,}/g, '\n\n')
                              .replace(/\n\n/g, '<div style="margin:6px 0;"></div>')
                              .replace(/\n/g, '<br/>')
                          })()) }} />
                        </div>
                      )}

                      {/* 可视化清单模式 */}
                      {analysisViewMode === 'visual' && (
                        <AnalysisVisualView text={deepAnalysisResult} />
                      )}
                    </div>
                  ) : !sessionAnalysis ? (
                    <div className="text-center py-16 text-gray-400 text-sm">暂无AI分析数据（需要用户在前端触发深度分析后才会生成）</div>
                  ) : (
                    <>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-[11px] text-gray-500 text-center">以下为规则引擎分析（用户尚未触发AI深度分析）</div>
                      {sessionAnalysis.risk && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">� 风险评估</h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-[10px] text-gray-400 mb-1">难度等级</p>
                              <p className={`text-[14px] font-bold ${
                                sessionAnalysis.risk.riskScore >= 70 ? 'text-red-600' :
                                sessionAnalysis.risk.riskScore >= 40 ? 'text-orange-600' : 'text-green-600'
                              }`}>{sessionAnalysis.risk.level}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-[10px] text-gray-400 mb-1">预估成功率</p>
                              <p className="text-[14px] font-bold text-green-600">{sessionAnalysis.risk.successRate}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {sessionAnalysis.strategy?.length > 0 && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <h3 className="text-[13px] font-semibold text-gray-800 mb-2">🎯 策略建议</h3>
                          <div className="space-y-1.5">
                            {sessionAnalysis.strategy.map((s, i) => (
                              <div key={i} className={`flex gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                                s.type === 'warning' ? 'bg-red-50 text-red-600' :
                                s.type === 'tip' ? 'bg-green-50 text-green-600' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                <span className="flex-shrink-0">{s.type === 'warning' ? '⚠️' : s.type === 'tip' ? '💡' : 'ℹ️'}</span>
                                <span>{s.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                </div>
                <p className="text-gray-300 text-[12px]">选择左侧会话查看聊天记录</p>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ========== 知识库 ==========
  function renderKnowledge() {
    return (
      <AdminAiTabLayout
        tabKey="knowledge"
        adminFetch={adminFetch}
        showToast={showToast}
        onRefresh={() => fetchCases()}
        loading={loadingCases}
        className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full"
      >
        <div className="flex items-start sm:items-center justify-between mb-4 gap-3 flex-col sm:flex-row">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">成功案例知识库</h2>
            <p className="text-xs text-gray-400 mt-0.5">管理员标记的成功申诉案例，AI 生成报告时会自动参考相似案例</p>
          </div>
          <button onClick={() => setCaseForm({
            title: '', industry: '', problemType: '', successSummary: '', adminNotes: '', reportContent: '',
            sessionId: selectedSession || '',
          })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            添加案例
          </button>
        </div>

        {loadingCases ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : knowledgeCases.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
            </div>
            <p className="text-gray-400 text-sm">暂无成功案例</p>
            <p className="text-gray-300 text-xs mt-1">在「聊天记录」中查看会话时，可点击"标记为成功案例"按钮添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {knowledgeCases.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-800">{c.title || '未命名案例'}</h3>
                        {c.industry && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{c.industry}</span>}
                        {c.problem_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">{c.problem_type}</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {c.status === 'active' ? '生效中' : '已归档'}
                        </span>
                      </div>
                      {c.success_summary && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{c.success_summary}</p>}
                      {c.admin_notes && <p className="text-[11px] text-gray-400 mt-1 italic">备注：{c.admin_notes}</p>}
                      <p className="text-[10px] text-gray-300 mt-1.5">{fmtTime(c.created_at)}{c.session_id ? ` · 来自会话 ${c.session_id.slice(0, 8)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setCaseForm({ id: c.id, sessionId: c.session_id || '', title: c.title, industry: c.industry, problemType: c.problem_type, successSummary: c.success_summary || '', adminNotes: c.admin_notes || '', reportContent: c.report_content || '', status: c.status })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                      </button>
                      <button onClick={() => handleDeleteCase(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 案例编辑弹窗 */}
        {caseForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCaseForm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">{caseForm.id ? '编辑案例' : '添加成功案例'}</h2>
                <button onClick={() => setCaseForm(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案例标题 *</label>
                  <input value={caseForm.title || ''} onChange={e => setCaseForm({...caseForm, title: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：餐饮商户收款限额申诉成功" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
                    <input value={caseForm.industry || ''} onChange={e => setCaseForm({...caseForm, industry: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：餐饮" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">处罚类型</label>
                    <input value={caseForm.problemType || ''} onChange={e => setCaseForm({...caseForm, problemType: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="如：收款限额" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案例材料（AI 主要依据）</label>
                  <p className="text-[10px] text-gray-400 mb-1">粘贴申诉报告或对话要点；材料不足时 AI 无法填写标题与摘要。</p>
                  <textarea value={caseForm.reportContent || ''} onChange={e => setCaseForm({ ...caseForm, reportContent: e.target.value })} rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono text-[12px]" placeholder="申诉报告全文、深度分析摘要…" />
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(caseForm.sessionId || selectedSession) ? (
                      <button type="button" onClick={loadCaseFromSession} disabled={caseAiLoading}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
                        {caseAiLoading ? '加载中…' : '从当前会话加载'}
                      </button>
                    ) : null}
                    <button type="button" onClick={openCaseAnalysisPicker} disabled={caseAiLoading}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50">
                      从进化分析加载
                    </button>
                  </div>
                  {!caseForm.sessionId && !selectedSession && (
                    <p className="text-[10px] text-amber-600 mt-1">当前列表会话多无聊天/分析数据，建议用「从进化分析加载」。</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成功要点</label>
                  <textarea value={caseForm.successSummary || ''} onChange={e => setCaseForm({...caseForm, successSummary: e.target.value})} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" placeholder="描述申诉成功的关键因素，AI会参考这些要点" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管理员备注</label>
                  <textarea value={caseForm.adminNotes || ''} onChange={e => setCaseForm({...caseForm, adminNotes: e.target.value})} rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" placeholder="内部备注（不会展示给用户）" />
                </div>
                {caseForm.id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select value={caseForm.status || 'active'} onChange={e => setCaseForm({...caseForm, status: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="active">生效中</option>
                      <option value="archived">已归档</option>
                    </select>
                  </div>
                )}
                <button type="button" onClick={handleCaseAiEnhance} disabled={caseAiLoading}
                  className="w-full py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-medium text-sm hover:bg-indigo-100 disabled:opacity-50">
                  {caseAiLoading ? 'AI 生成中…' : 'AI 根据材料填写'}
                </button>
                <button onClick={handleSaveCase} disabled={savingCase || !caseForm.title?.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                  {savingCase ? '保存中...' : '保存案例'}
                </button>
              </div>
            </div>
          </div>
        )}
        {caseAnalysisPickerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setCaseAnalysisPickerOpen(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 text-sm">选择对话分析记录</h3>
                <button type="button" onClick={() => setCaseAnalysisPickerOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {caseAnalysisPickerLoading ? (
                  <p className="text-center text-gray-400 text-sm py-8">加载中…</p>
                ) : caseAnalysisOptions.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">暂无可用分析</p>
                ) : caseAnalysisOptions.map((a) => (
                  <button key={a.id} type="button" disabled={caseAiLoading}
                    onClick={() => loadCaseFromEvolutionAnalysis(a.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 disabled:opacity-50">
                    <div className="text-xs font-medium text-gray-800">{a.industry || '未分类'} · {a.problem_type || '—'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{a.analyzed_at ? new Date(a.analyzed_at).toLocaleString('zh-CN') : ''} · 完成率 {Math.round((a.completion_rate || 0) * 100)}%</div>
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{String(a.raw_analysis || '').slice(0, 120)}…</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminAiTabLayout>
    )
  }

  // ========== DeepSeek 多账号余额 ==========
  async function fetchDsAccounts() {
    setDsLoading(true)
    try {
      const res = await adminFetch('/api/admin/deepseek-accounts')
      const data = await res.json()
      setDsAccounts(data.accounts || [])
      setDsSummary(data.summary || {})
    } catch (e) { console.error(e) }
    setDsLoading(false)
  }

  async function handleDsCheckAll() {
    setDsChecking(true)
    try {
      const res = await adminFetch('/api/admin/deepseek-accounts/check-all', { method: 'POST' })
      const data = await res.json()
      showToast(`已查询 ${data.summary?.checked || 0} 个账号，总余额 ¥${data.summary?.totalBalance || '0.00'}`)
      fetchDsAccounts()
    } catch (e) { showToast('批量查询失败') }
    setDsChecking(false)
  }

  async function handleDsCheckOne(id) {
    setDsCheckingId(id)
    try {
      const res = await adminFetch(`/api/admin/deepseek-accounts/${id}/check-balance`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(`余额: ¥${data.totalBalance?.toFixed(2)}${data.isWarning ? ' ⚠️ 低于预警线' : ''}`)
      } else {
        showToast('查询失败: ' + data.error)
      }
      fetchDsAccounts()
    } catch (e) { showToast('查询失败') }
    setDsCheckingId(null)
  }

  async function handleDsAdd() {
    if (!dsForm.apiKey) { showToast('请填写 API Key'); return }
    try {
      await adminFetch('/api/admin/deepseek-accounts', {
        method: 'POST',
        body: JSON.stringify({ label: dsForm.label, apiKey: dsForm.apiKey, warningThreshold: parseFloat(dsForm.warningThreshold) || 10 }),
      })
      showToast('添加成功，正在查询余额...')
      setDsShowAdd(false)
      setDsForm({ label: '', apiKey: '', warningThreshold: '10' })
      fetchDsAccounts()
    } catch (e) { showToast('添加失败') }
  }

  async function handleDsUpdate(id) {
    try {
      const body = { label: dsForm.label, warningThreshold: parseFloat(dsForm.warningThreshold) || 10 }
      if (dsForm.apiKey) body.apiKey = dsForm.apiKey
      await adminFetch(`/api/admin/deepseek-accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      showToast('更新成功')
      setDsEditId(null)
      setDsForm({ label: '', apiKey: '', warningThreshold: '10' })
      fetchDsAccounts()
    } catch (e) { showToast('更新失败') }
  }

  async function handleDsToggle(id, currentEnabled) {
    try {
      await adminFetch(`/api/admin/deepseek-accounts/${id}`, { method: 'PUT', body: JSON.stringify({ isEnabled: !currentEnabled }) })
      fetchDsAccounts()
    } catch (e) { showToast('操作失败') }
  }

  async function handleDsDelete(id) {
    if (!confirm('确定删除此账号？')) return
    try {
      await adminFetch(`/api/admin/deepseek-accounts/${id}`, { method: 'DELETE' })
      showToast('已删除')
      fetchDsAccounts()
    } catch (e) { showToast('删除失败') }
  }

  function renderDeepseekBalance() {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">DeepSeek 账号余额</span>
              {dsSummary.warningCount > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-600 animate-pulse">
                  {dsSummary.warningCount} 个低余额
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-1">管理多个 DeepSeek API 账号 · 实时查询余额 · 低余额自动预警</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDsCheckAll} disabled={dsChecking}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl transition-all ${dsChecking ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}>
              {dsChecking ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
              )}
              {dsChecking ? '查询中...' : '一键查询全部余额'}
            </button>
            <button onClick={() => { setDsEditId(null); setDsForm({ label: '', apiKey: '', warningThreshold: '10' }); setDsShowAdd(!dsShowAdd) }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              添加账号
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {dsAccounts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              <p className="text-white/70 text-xs font-medium">总账号数</p>
              <p className="text-2xl font-bold mt-1">{dsSummary.total || 0}</p>
              <p className="text-white/50 text-[11px] mt-1.5">已启用 {dsAccounts.filter(a => a.is_enabled).length} 个</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              <p className="text-white/70 text-xs font-medium">总余额</p>
              <p className="text-2xl font-bold mt-1">¥{dsSummary.totalBalance || '0.00'}</p>
              <p className="text-white/50 text-[11px] mt-1.5">所有账号合计</p>
            </div>
            <div className={`bg-gradient-to-br ${dsSummary.warningCount > 0 ? 'from-red-500 to-rose-600' : 'from-violet-500 to-purple-600'} rounded-2xl p-5 text-white card-hover`} style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              <p className="text-white/70 text-xs font-medium">低余额预警</p>
              <p className="text-2xl font-bold mt-1">{dsSummary.warningCount || 0}</p>
              <p className="text-white/50 text-[11px] mt-1.5">{dsSummary.warningCount > 0 ? '需要及时充值!' : '全部正常'}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl p-5 text-white card-hover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              <p className="text-white/70 text-xs font-medium">平均余额</p>
              <p className="text-2xl font-bold mt-1">¥{dsSummary.total > 0 ? (parseFloat(dsSummary.totalBalance || 0) / dsSummary.total).toFixed(2) : '0.00'}</p>
              <p className="text-white/50 text-[11px] mt-1.5">每账号平均</p>
            </div>
          </div>
        )}

        {/* Add / Edit Form */}
        {(dsShowAdd || dsEditId) && (
          <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-5 space-y-4">
            <h3 className="font-semibold text-sm text-indigo-700">{dsEditId ? '编辑账号' : '添加 DeepSeek 账号'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">账号标签（便于区分）</label>
                <input value={dsForm.label} onChange={e => setDsForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  placeholder="如：主账号 / 测试号 / 账号A" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">API Key *</label>
                <input value={dsForm.apiKey} onChange={e => setDsForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  placeholder={dsEditId ? '留空则不修改' : 'sk-xxxxxxxxxxxxxxxx'} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">预警阈值 (¥)</label>
                <input type="number" value={dsForm.warningThreshold} onChange={e => setDsForm(f => ({ ...f, warningThreshold: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  placeholder="10" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => dsEditId ? handleDsUpdate(dsEditId) : handleDsAdd()}
                className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                {dsEditId ? '保存修改' : '添加并查询余额'}
              </button>
              <button onClick={() => { setDsShowAdd(false); setDsEditId(null); setDsForm({ label: '', apiKey: '', warningThreshold: '10' }) }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">取消</button>
            </div>
          </div>
        )}

        {/* Account List */}
        {dsLoading ? (
          <div className="text-center py-16 text-gray-400">加载中...</div>
        ) : dsAccounts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💰</div>
            <p className="text-gray-400 text-sm">还没有添加 DeepSeek 账号</p>
            <p className="text-gray-300 text-xs mt-1">点击上方「添加账号」开始管理多个 API Key 的余额</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dsAccounts.map(acc => {
              const balance = parseFloat(acc.total_balance || 0)
              const threshold = parseFloat(acc.warning_threshold || 10)
              const isWarning = acc.is_warning
              const isChecking = dsCheckingId === acc.id
              const lastCheck = acc.last_check_at ? new Date(acc.last_check_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未查询'

              return (
                <div key={acc.id} className={`bg-white rounded-2xl border ${isWarning ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'} p-5 shadow-sm hover:shadow-md transition-all ${!acc.is_enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Left: Balance display */}
                    <div className="flex-shrink-0">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold ${
                        acc.last_error ? 'bg-gray-100 text-gray-400' :
                        isWarning ? 'bg-red-50 text-red-500' :
                        balance > 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {acc.last_error ? '❌' : isWarning ? '⚠️' : '💰'}
                      </div>
                    </div>

                    {/* Middle: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 text-sm">{acc.label || '未命名账号'}</span>
                        {!acc.is_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">已禁用</span>}
                        {isWarning && acc.is_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium animate-pulse">低余额</span>}
                        {acc.is_available === 1 && !isWarning && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">可用</span>}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mb-2">{acc.api_key_masked || '****'}</div>

                      {acc.total_balance !== null && !acc.last_error ? (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <div className={`text-lg font-bold ${isWarning ? 'text-red-600' : 'text-gray-800'}`}>¥{balance.toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400">总余额</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <div className="text-lg font-bold text-blue-600">¥{parseFloat(acc.topped_up_balance || 0).toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400">充值余额</div>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2">
                            <div className="text-lg font-bold text-purple-600">¥{parseFloat(acc.granted_balance || 0).toFixed(2)}</div>
                            <div className="text-[10px] text-gray-400">赠金</div>
                          </div>
                        </div>
                      ) : acc.last_error ? (
                        <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{acc.last_error}</div>
                      ) : (
                        <div className="text-xs text-gray-300">尚未查询余额，请点击右侧查询按钮</div>
                      )}
                      <div className="text-[10px] text-gray-300 mt-2">最近查询: {lastCheck} · 预警线: ¥{threshold.toFixed(2)}</div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => handleDsCheckOne(acc.id)} disabled={isChecking}
                        className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all ${isChecking ? 'bg-blue-50 text-blue-500 animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                        {isChecking ? '查询中...' : '查余额'}
                      </button>
                      <button onClick={() => { setDsEditId(acc.id); setDsShowAdd(false); setDsForm({ label: acc.label || '', apiKey: '', warningThreshold: String(acc.warning_threshold || 10) }) }}
                        className="px-3 py-1.5 text-[11px] font-medium bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">编辑</button>
                      <button onClick={() => handleDsToggle(acc.id, acc.is_enabled)}
                        className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${acc.is_enabled ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {acc.is_enabled ? '禁用' : '启用'}
                      </button>
                      <button onClick={() => handleDsDelete(acc.id)}
                        className="px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">删除</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function renderSettings() {
    const general = systemConfigs.filter(c => c.config_group === 'general')
    const ai = systemConfigs.filter(c => c.config_group === 'ai')
    const rechargeConf = systemConfigs.filter(c => c.config_group === 'recharge')
    const wx = paymentConfigs.filter(c => c.config_group === 'wechat')
    const ali = paymentConfigs.filter(c => c.config_group === 'alipay')
    const xianyu = systemConfigs.filter(c => c.config_group === 'xianyu')

    const renderSubContent = () => {
      switch (settingsSubTab) {
        case 'general':
          return general.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-600">基本设置</h3></div>
              <div className="divide-y divide-gray-50">{general.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无基本配置项</div>
        case 'ai':
          return ai.length > 0 ? (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 text-sm">⚠️</span>
                <div className="text-xs text-amber-700">
                  <p className="font-semibold">API Key 请在「AI模型」Tab 中配置</p>
                  <p className="mt-0.5 text-amber-600">此处为旧版参数（温度、倍率等），API Key 已迁移到「AI模型」面板统一管理。在此处修改 API Key 不会生效。</p>
                  <button onClick={() => setActiveTab('ai-models')} className="mt-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 font-medium transition-colors">前往 AI模型 管理 →</button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-700">AI 参数配置</h3>
                  <button onClick={async () => {
                    showToast('正在测试 AI 连接...')
                    try {
                      const r = await adminFetch('/api/admin/test-deepseek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                      const d = await r.json()
                      if (d.success) showToast(`✅ 连接成功！模型: ${d.model}，回复: ${d.reply}`)
                      else showToast(`❌ 连接失败: ${d.error}`)
                    } catch { showToast('❌ 测试请求失败') }
                  }} className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 font-medium">测试连接</button>
                </div>
                <div className="divide-y divide-gray-50">{ai.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
              </div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无AI配置项</div>
        case 'rechargeConfig':
          return rechargeConf.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100"><h3 className="text-sm font-semibold text-yellow-700">充值设置</h3></div>
              <div className="divide-y divide-gray-50">{rechargeConf.map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}</div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无充值配置项</div>
        case 'wechat':
          return wx.length > 0 ? (
            <div className="space-y-4">
              <PaymentSettingsGuide channel="wechat" channels={paymentChannels} adminFetch={adminFetch} showToast={showToast} onChannelsUpdate={setPaymentChannels} />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center space-x-2">
                <span className="w-5 h-5 bg-wechat-green rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/></svg></span>
                <h3 className="text-sm font-semibold text-green-700">微信支付</h3>
              </div>
              <div className="divide-y divide-gray-50">{wx.map(c => <ConfigField key={c.config_key} cfg={c} idx={paymentConfigs.indexOf(c)} configs={paymentConfigs} setConfigs={setPaymentConfigs} />)}</div>
            </div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无微信支付配置项</div>
        case 'alipay':
          return ali.length > 0 ? (
            <div className="space-y-4">
              <PaymentSettingsGuide channel="alipay" channels={paymentChannels} adminFetch={adminFetch} showToast={showToast} onChannelsUpdate={setPaymentChannels} />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center space-x-2">
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M21.422 15.358c-.612-1.008-2.139-2.091-4.16-3.009.263-.674.467-1.397.6-2.158h-3.204V8.717h3.93V7.91h-3.93V5.535h-1.86s-.037.17-.205.495c-.33.65-.79 1.134-1.242 1.134V7.91H7.927v.807h3.424v1.474H8.23v.808h6.3c-.1.535-.24 1.043-.416 1.513-1.842-.632-3.974-1.082-5.835-1.082-3.156 0-5.053 1.392-5.053 3.09 0 1.7 1.897 3.092 5.053 3.092 2.09 0 4.423-.684 6.395-1.903.82.506 1.48.946 1.884 1.282.86.714 1.016 1.167.858 1.694H24c.182-.826-.31-1.85-2.578-3.33z"/></svg></span>
                <h3 className="text-sm font-semibold text-blue-700">支付宝</h3>
              </div>
              <div className="divide-y divide-gray-50">{ali.map(c => <ConfigField key={c.config_key} cfg={c} idx={paymentConfigs.indexOf(c)} configs={paymentConfigs} setConfigs={setPaymentConfigs} />)}</div>
            </div>
            </div>
          ) : <div className="text-center py-16 text-gray-300 text-sm">暂无支付宝配置项</div>
        case 'security':
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100"><h3 className="text-sm font-semibold text-red-700">安全设置</h3></div>
              <div className="px-4 py-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">修改管理员密码</label>
                <p className="text-xs text-gray-400 mb-3">密码至少6位，修改后需重新登录</p>
                <div className="flex items-center gap-2">
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                    placeholder="输入新密码（至少6位）"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/80 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400" />
                  <button onClick={handleChangePassword} disabled={changingPwd || !newPassword}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 shadow-sm flex-shrink-0">
                    {changingPwd ? '修改中...' : '修改密码'}
                  </button>
                </div>
              </div>
            </div>
          )
        case 'xianyu':
          const safeVal = (key) => xianyu.find(c => c.config_key === key)?.config_value || ''
          return (
            <div className="space-y-4">
              {/* 智能解析 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
                  <h3 className="text-sm font-semibold text-purple-700">🤖 智能解析</h3>
                  <p className="text-xs text-gray-400 mt-0.5">粘贴闲管家应用配置原始文本，AI 自动提取</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <textarea
                    value={xianyuRawText}
                    onChange={e => setXianyuRawText(e.target.value)}
                    placeholder={'粘贴应用配置原始文本，例如：\n应用类型进销存\n应用模式自研系统\n应用名称艾阳的店铺\n应用状态已上线\nAppKey1500256339739973\nAppSecretggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH\n创建时间2026-03-17 19:39:40'}
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none font-mono"
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={parseXianyuConfig} disabled={parsingXianyu || !xianyuRawText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 shadow-sm transition-all">
                      {parsingXianyu ? (
                        <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>解析中...</>
                      ) : (
                        <><span>🤖</span> AI 一键解析</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* API 配置 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                  <h3 className="text-sm font-semibold text-orange-700">闲管家 API 配置</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {xianyu.filter(c => c.config_key === 'xianyu_app_key' || c.config_key === 'xianyu_app_secret').map(c => <ConfigField key={c.config_key} cfg={c} idx={systemConfigs.indexOf(c)} configs={systemConfigs} setConfigs={setSystemConfigs} />)}
                </div>
              </div>

              {/* 应用信息 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-700">应用概况</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <ConfigField cfg={{ config_key: 'xianyu_app_type', config_value: safeVal('xianyu_app_type'), config_label: '应用类型' }} idx={systemConfigs.findIndex(c => c.config_key === 'xianyu_app_type')} configs={systemConfigs} setConfigs={setSystemConfigs} />
                  <ConfigField cfg={{ config_key: 'xianyu_app_mode', config_value: safeVal('xianyu_app_mode'), config_label: '应用模式' }} idx={systemConfigs.findIndex(c => c.config_key === 'xianyu_app_mode')} configs={systemConfigs} setConfigs={setSystemConfigs} />
                  <ConfigField cfg={{ config_key: 'xianyu_app_name', config_value: safeVal('xianyu_app_name'), config_label: '应用名称' }} idx={systemConfigs.findIndex(c => c.config_key === 'xianyu_app_name')} configs={systemConfigs} setConfigs={setSystemConfigs} />
                  <ConfigField cfg={{ config_key: 'xianyu_app_status', config_value: safeVal('xianyu_app_status'), config_label: '应用状态' }} idx={systemConfigs.findIndex(c => c.config_key === 'xianyu_app_status')} configs={systemConfigs} setConfigs={setSystemConfigs} />
                  <ConfigField cfg={{ config_key: 'xianyu_created_at', config_value: safeVal('xianyu_created_at'), config_label: '创建时间' }} idx={systemConfigs.findIndex(c => c.config_key === 'xianyu_created_at')} configs={systemConfigs} setConfigs={setSystemConfigs} />
                </div>
              </div>
            </div>
          )
        default: return null
      }
    }

    const isPaymentTab = settingsSubTab === 'wechat' || settingsSubTab === 'alipay'

    return (
      <AdminAiTabLayout
        tabKey="settings"
        adminFetch={adminFetch}
        showToast={showToast}
        onRefresh={() => { fetchSystemConfigs(); fetchPaymentConfigs() }}
        className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full"
      >
      <div className="space-y-4">
        {/* 子Tab导航 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-gray-100/80 rounded-xl p-1">
          {SETTINGS_SUB_TABS.map(tab => (
            <button key={tab.key} onClick={() => setSettingsSubTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                settingsSubTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}>
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {/* 子Tab内容 */}
        <form autoComplete="off" onSubmit={e => e.preventDefault()} className="space-y-4">
          <input type="text" name="fake_user" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" name="fake_pass" style={{ display: 'none' }} tabIndex={-1} />
          {renderSubContent()}
          {settingsSubTab !== 'security' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => {
                if (isPaymentTab) saveConfigs('/api/admin/payment-config', paymentConfigs, '支付配置')
                else saveConfigs('/api/admin/system-config', systemConfigs, '系统配置')
              }} disabled={saving}
                className="px-6 py-2.5 bg-wechat-green text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm">
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          )}
        </form>
      </div>
      </AdminAiTabLayout>
    )
  }

  function __DEAD_START_renderUsers() {
    return null
    const totalBalance = users.reduce((s, u) => s + parseFloat(u.balance || 0), 0)
    const totalSpent = users.reduce((s, u) => s + parseFloat(u.total_spent || 0), 0)
    const totalMsgs = users.reduce((s, u) => s + (u.total_messages || 0), 0)
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">用户管理</h2>
            <p className="text-xs text-gray-400 mt-0.5">共 {users.length} 位用户</p>
          </div>
          <button onClick={fetchUsers} className="text-xs text-gray-400 hover:text-wechat-green px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">刷新</button>
        </div>
        {/* Summary bar */}
        {users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '总用户', value: users.length, color: 'text-blue-600 bg-blue-50' },
              { label: '总余额', value: `¥${totalBalance.toFixed(2)}`, color: 'text-green-600 bg-green-50' },
              { label: '总消费', value: `¥${totalSpent.toFixed(2)}`, color: 'text-orange-600 bg-orange-50' },
              { label: '总消息', value: totalMsgs, color: 'text-purple-600 bg-purple-50' },
            ].map((c, i) => (
              <div key={i} className={`${c.color} rounded-xl px-3 py-2.5 text-center`}>
                <div className="text-base font-bold">{c.value}</div>
                <div className="text-[10px] opacity-60">{c.label}</div>
              </div>
            ))}
          </div>
        )}
        {loadingUsers ? (
          <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">暂无用户<br/><span className="text-xs">用户在前台注册后会显示在这里</span></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {null}
          </div>
        )}
      </div>
    )
  }

  function renderRechargeOrders() {
    const STATUS_MAP = { pending: { label: '待确认', color: 'bg-yellow-100 text-yellow-700' }, confirmed: { label: '已确认', color: 'bg-green-100 text-green-700' }, rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' } }
    const METHOD_MAP = { wechat: '微信支付', alipay: '支付宝' }
    return (
      <AdminAiTabLayout
        tabKey="recharge"
        adminFetch={adminFetch}
        showToast={showToast}
        onRefresh={() => fetchRechargeOrders()}
        loading={loadingRecharge}
        className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full"
      >
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">充值订单管理</h2>
            <p className="text-xs text-gray-400 mt-0.5">审核用户充值请求，确认后余额自动到账</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            {['', 'pending', 'confirmed', 'rejected'].map(f => (
              <button key={f} onClick={() => { setRechargeFilter(f); fetchRechargeOrders(f) }}
                className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${rechargeFilter === f ? 'bg-wechat-green text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f === '' ? '全部' : STATUS_MAP[f]?.label}
              </button>
            ))}
          </div>
        </div>
        {loadingRecharge ? <div className="text-center py-20 text-gray-400 text-sm">加载中...</div> : rechargeOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-300 text-sm">暂无充值订单</div>
        ) : (
          <div className="space-y-3">
            {rechargeOrders.map(o => {
              const s = STATUS_MAP[o.status] || {}
              return (
                <div key={o.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">¥</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-800">¥{parseFloat(o.amount).toFixed(2)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{METHOD_MAP[o.payment_method] || o.payment_method}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                          <span>#{o.id}</span>
                          <span>{o.nickname || '未知用户'}</span>
                          <span className="hidden sm:inline">{o.phone || ''}</span>
                          <span>{fmtTime(o.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {o.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleConfirmRecharge(o.id)}
                          className="px-4 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium shadow-sm">确认到账</button>
                        <button onClick={() => handleRejectRecharge(o.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 font-medium">拒绝</button>
                      </div>
                    )}
                  </div>
                  {o.remark && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                      <span className="font-medium text-gray-600">用户备注：</span>{o.remark}
                    </div>
                  )}
                  {o.admin_note && (
                    <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-xs text-orange-600">
                      <span className="font-medium">管理员备注：</span>{o.admin_note}
                    </div>
                  )}
                  {o.confirmed_at && (
                    <div className="px-4 py-1.5 bg-gray-50/50 border-t border-gray-50 text-[11px] text-gray-400">
                      处理时间：{fmtTime(o.confirmed_at)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      </AdminAiTabLayout>
    )
  }

  function renderOrders() {
    const STATUS_MAP = {
      pending: { label: '待支付', color: 'bg-gray-100 text-gray-600' },
      paid: { label: '已支付', color: 'bg-blue-100 text-blue-600' },
      serving: { label: '服务中', color: 'bg-orange-100 text-orange-600' },
      completed: { label: '已完成', color: 'bg-green-100 text-green-600' },
      cancelled: { label: '已取消', color: 'bg-red-100 text-red-600' },
    }
    const STATUS_BADGE = {
      pending: { bg: '#6b7280', color: '#fff' },
      paid: { bg: '#3b82f6', color: '#fff' },
      serving: { bg: '#f97316', color: '#fff' },
      completed: { bg: '#22c55e', color: '#fff' },
      cancelled: { bg: '#ef4444', color: '#fff' },
    }
    const STATUS_OPTIONS = Object.keys(STATUS_MAP).filter(k => k !== 'cancelled')
    const FILTER_OPTIONS = ['', 'pending', 'paid', 'serving', 'completed', 'cancelled']
    const isXianyuTab = activeTab === 'xianyu'
    const pageClass = 'p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full'

    const ordersBody = (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{isXianyuTab ? '闲鱼运营' : '订单管理'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isXianyuTab
                ? (xianyuSubTab === 'xianyu-dashboard' ? '多维度数据分析：订单状态、销售趋势、热销 TOP10、AI 运营日报'
                  : xianyuSubTab === 'xianyu-products' ? '闲鱼商品、店铺与余额管理'
                  : '查看闲管家平台订单，支持发货、改价与卡密')
                : '管理用户 AI 申诉服务订单；闲鱼数据请进入侧栏「闲鱼运营」'}
            </p>
          </div>
          {isXianyuTab ? (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
              <button type="button" onClick={() => setXianyuSubTab('xianyu-dashboard')} className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${xianyuSubTab === 'xianyu-dashboard' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>数据看板</button>
              <button type="button" onClick={() => { setXianyuSubTab('xianyu-orders'); if (!xianyuOrders.length) fetchXianyuOrders(1, '', '', '') }} className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${xianyuSubTab === 'xianyu-orders' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>闲鱼订单</button>
              <button type="button" onClick={() => setXianyuSubTab('xianyu-products')} className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${xianyuSubTab === 'xianyu-products' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>闲鱼商品</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setActiveTab('xianyu'); setXianyuSubTab('xianyu-dashboard') }} className="px-3 py-1.5 text-xs rounded-lg font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100">
              前往闲鱼运营 →
            </button>
          )}
        </div>

        {isXianyuTab && xianyuSubTab === 'xianyu-dashboard' ? (
          <XianyuDashboard adminFetch={adminFetch} showToast={showToast} onSwitchTab={setXianyuSubTab} />
        ) : !isXianyuTab ? (
          <>
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
              {FILTER_OPTIONS.map(f => (
                <button key={f} onClick={() => { setOrderFilter(f); fetchOrders(f) }}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${orderFilter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f === '' ? '全部' : STATUS_MAP[f]?.label}
                </button>
              ))}
            </div>
            {loadingOrders ? (
              <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20 text-gray-300 text-sm">暂无订单</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">订单号</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">产品名称</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">用户</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">金额</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">状态</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">创建时间</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map(o => {
                        const s = STATUS_MAP[o.status] || {}
                        const sb = STATUS_BADGE[o.status] || { bg: '#6b7280', color: '#fff' }
                        const isOpen = orderStatusDropdown === o.id
                        return (
                          <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">{o.order_no || '-'}</td>
                            <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{o.product_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.phone || '-'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">¥{parseFloat(o.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setOrderStatusDropdown(isOpen ? null : o.id)}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors hover:opacity-80"
                                  style={{ backgroundColor: sb.bg, color: sb.color }}
                                >
                                  {s.label}
                                </button>
                                {isOpen && (
                                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-[120px]">
                                    {STATUS_OPTIONS.map(opt => {
                                      const optBadge = STATUS_BADGE[opt]
                                      return (
                                        <button
                                          key={opt}
                                          onClick={() => handleUpdateOrderStatus(o.id, opt)}
                                          className="w-full px-4 py-2 text-left text-xs hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                          <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: optBadge.bg }}
                                          />
                                          <span className="text-gray-700">{STATUS_MAP[opt]?.label}</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtTime(o.created_at)}</td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setOrderStatusDropdown(isOpen ? null : o.id)}
                                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                                >
                                  变更状态
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : xianyuSubTab === 'xianyu-products' ? (
          <div className="mt-2"><XianyuPanel adminFetch={adminFetch} showToast={showToast} /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <select value={xianyuOrderStatus} onChange={e => { setXianyuOrderStatus(e.target.value); setXianyuPage(1); fetchXianyuOrders(1, e.target.value, xianyuRefundStatus, xianyuKeyword) }} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
                <option value="">全部状态</option>
                {Object.entries(ORDER_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={xianyuRefundStatus} onChange={e => { setXianyuRefundStatus(e.target.value); setXianyuPage(1); fetchXianyuOrders(1, xianyuOrderStatus, e.target.value, xianyuKeyword) }} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
                <option value="">全部退款</option>
                {Object.entries(REFUND_STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input type="text" placeholder="搜索订单号/买家" value={xianyuKeyword} onChange={e => setXianyuKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setXianyuPage(1); fetchXianyuOrders(1, xianyuOrderStatus, xianyuRefundStatus, xianyuKeyword) } }} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg w-40" />
              <button onClick={() => { setXianyuPage(1); fetchXianyuOrders(1, xianyuOrderStatus, xianyuRefundStatus, xianyuKeyword) }} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-medium">搜索</button>
            </div>

            {xianyuLoading ? (
              <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
            ) : xianyuOrders.length === 0 ? (
              <div className="text-center py-20 text-gray-300 text-sm">暂无闲鱼订单</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">订单号</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">商品</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">买家</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">收货地址</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">金额</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">下单时间</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">状态</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">物流</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {xianyuOrders.map(o => {
                        const orderStatusInfo = formatOrderStatusLabel(o.order_status)
                        const refundStatusInfo = o.refund_status && o.refund_status !== 0 ? formatRefundStatusLabel(o.refund_status) : null
                        const consignInfo = o.consign_type ? formatConsignLabel(o.consign_type) : null
                        const img = o.goods?.images?.[0] || ''
                        const fullAddr = formatFullAddress(o) || o.receiver_full_address || ''
                        return (
                          <tr key={o.order_no} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">{o.order_no || '-'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-[180px]">
                                {img ? <img src={xyImageSrc(img)} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" onError={e => { e.target.style.display = 'none' }} /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-800 font-medium truncate max-w-[160px]">{o.goods?.title || o.product_title || '-'}</p>
                                  {o.goods?.sku_text && <p className="text-[10px] text-gray-400 truncate">{o.goods.sku_text}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                              <div>{o.buyer_nick || '-'}</div>
                              {o.receiver_mobile && <p className="text-[10px] text-gray-400">{o.receiver_mobile}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px]">
                              <div className="truncate" title={fullAddr}>
                                {o.receiver_name ? <span className="text-gray-700">{o.receiver_name} </span> : ''}
                                {fullAddr || '-'}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-800 text-xs whitespace-nowrap">¥{formatOrderAmount(o)}</td>
                            <td className="px-3 py-2.5 text-center text-gray-400 text-xs whitespace-nowrap">{fmtTime(o.order_time)}</td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${orderStatusInfo.bg} ${orderStatusInfo.text}`}>{orderStatusInfo.label}</span>
                              {refundStatusInfo && <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ml-1 ${refundStatusInfo.bg} ${refundStatusInfo.text}`}>{refundStatusInfo.label}</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center text-xs whitespace-nowrap">
                              {consignInfo ? (
                                <div>
                                  <span className="text-gray-600">{consignInfo.label}</span>
                                  {(o.waybill_no || o.express_no) && (
                                    <p className="text-[10px] text-gray-400">{o.express_company || o.express_name || ''} {o.waybill_no || o.express_no}</p>
                                  )}
                                </div>
                              ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <button type="button" onClick={() => openXyShip(o)} className="px-2 py-1 text-[10px] rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">发货</button>
                                <button type="button" onClick={() => openXyPrice(o)} className="px-2 py-1 text-[10px] rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium">改价</button>
                                <button type="button" onClick={() => openXyCards(o)} className="px-2 py-1 text-[10px] rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium">卡密</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {xianyuTotal > xianyuPageSize && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <span className="text-xs text-gray-500">共 {xianyuTotal} 条，第 {xianyuPage}/{Math.ceil(xianyuTotal / xianyuPageSize)} 页</span>
                    <div className="flex items-center gap-1">
                      <button disabled={xianyuPage <= 1} onClick={() => { const np = xianyuPage - 1; setXianyuPage(np); fetchXianyuOrders(np) }} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors">上一页</button>
                      <button disabled={xianyuPage >= Math.ceil(xianyuTotal / xianyuPageSize)} onClick={() => { const np = xianyuPage + 1; setXianyuPage(np); fetchXianyuOrders(np) }} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors">下一页</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {xyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !xyBusy && setXyModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {xyModal === 'ship' ? '订单发货' : xyModal === 'price' ? '订单改价' : '查看卡密'}
                </h3>
                <button type="button" onClick={() => setXyModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              {xyOrder && <p className="text-xs text-gray-500 font-mono">订单号：{xyOrder.order_no}</p>}
              {xyModal === 'ship' && (
                <div className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    物流公司
                    <select value={xyShip.expressCompany} onChange={e => setXyShip(s => ({ ...s, expressCompany: e.target.value }))} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                      <option value="">请选择</option>
                      {xyLogistics.map((c, i) => {
                        const code = typeof c === 'string' ? c : (c.code || c.express_code || '')
                        const name = typeof c === 'string' ? c : (c.name || c.express_name || c.company_name || code)
                        const val = code && name && code !== name ? `${code}::${name}` : (code || name)
                        return <option key={i} value={val}>{name}</option>
                      })}
                    </select>
                  </label>
                  <label className="block text-xs text-gray-600">
                    物流单号
                    <input value={xyShip.expressNo} onChange={e => setXyShip(s => ({ ...s, expressNo: e.target.value }))} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="快递单号" />
                  </label>
                  <button type="button" disabled={xyBusy} onClick={submitXyShip} className="w-full py-2.5 bg-purple-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{xyBusy ? '提交中...' : '确认发货'}</button>
                </div>
              )}
              {xyModal === 'price' && (
                <div className="space-y-3">
                  <label className="block text-xs text-gray-600">
                    新价格（元）
                    <input type="number" step="0.01" value={xyPrice} onChange={e => setXyPrice(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                  </label>
                  <button type="button" disabled={xyBusy} onClick={submitXyPrice} className="w-full py-2.5 bg-purple-600 text-white text-sm rounded-lg font-medium disabled:opacity-50">{xyBusy ? '提交中...' : '确认改价'}</button>
                </div>
              )}
              {xyModal === 'cards' && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {xyBusy && !xyCards ? <p className="text-sm text-gray-400 text-center py-4">加载中...</p> : null}
                  {xyCards && (
                    <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">{typeof xyCards === 'string' ? xyCards : JSON.stringify(xyCards, null, 2)}</pre>
                  )}
                  {!xyBusy && xyCards == null && <p className="text-sm text-gray-400 text-center py-4">暂无卡密数据</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )

    if (isXianyuTab) {
      return <div className={pageClass}>{ordersBody}</div>
    }

    return (
      <AdminAiTabLayout
        tabKey="orders"
        adminFetch={adminFetch}
        showToast={showToast}
        onRefresh={() => fetchOrders()}
        loading={loadingOrders}
        className={pageClass}
      >
        {ordersBody}
      </AdminAiTabLayout>
    )
  }

  return (
    <div className="h-screen h-dvh bg-[#f5f5f5] flex flex-col overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur-lg text-white text-sm px-5 py-2.5 rounded-2xl shadow-xl animate-fade-in font-medium">{toast}</div>
      )}
      <header className="bg-white flex-shrink-0 z-20" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">商户申诉助手 · 管理后台</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />运行中</span>
                <span className="text-[10px] text-slate-500">v2.1</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a href="/" className="h-8 px-3 flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg text-[11px] font-medium transition-all" title="访问前台">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
              <span className="hidden sm:inline">前台</span>
            </a>
            <button onClick={handleLogout} className="h-8 px-3 flex items-center gap-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-[11px] font-medium transition-all" title="退出登录">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
        <div className="px-2 sm:px-4 py-1.5 flex overflow-x-auto no-scrollbar bg-gray-50/80 border-b border-gray-100 items-center gap-1">
          {TABS.map((tab, i) => (
            <React.Fragment key={tab.key}>
              {i > 0 && i % 6 === 0 && <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />}
              <button onClick={() => { setActiveTab(tab.key); setMobileShowChat(false) }}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-purple-700 shadow-sm ring-1 ring-purple-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-indigo-600 text-white leading-none">{tab.badge}</span>
                ) : null}
              </button>
            </React.Fragment>
          ))}
        </div>
      </header>
      <div className={`flex-1 flex flex-col gpu-scroll ${activeTab === 'sessions' ? 'min-h-0 overflow-hidden' : 'overflow-auto'}`}>
        <div key={activeTab} className={`panel-animate flex-1 ${activeTab === 'sessions' ? 'flex flex-col min-h-0 overflow-hidden' : ''}`}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'session-chatboard' && (
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <SessionChatboardPanel
              adminFetch={adminFetch}
              showToast={showToast}
              onOpenSession={(id) => { setActiveTab('sessions'); selectSession(id) }}
            />
          </div>
        )}
        {activeTab === 'ops-center' && (
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
            <OpsCenterPanel
              adminFetch={adminFetch}
              showToast={showToast}
              onOpenSession={(id) => { setActiveTab('sessions'); selectSession(id) }}
            />
          </div>
        )}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'recharge' && renderRechargeOrders()}
        {(activeTab === 'orders' || activeTab === 'xianyu') && renderOrders()}
        {activeTab === 'knowledge' && renderKnowledge()}
        {activeTab === 'ai-models' && <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"><AIModelsPanel adminFetch={adminFetch} showToast={showToast} /></div>}
        {activeTab === 'ai-activity' && <AIActivityPanel adminFetch={adminFetch} />}
        {activeTab === 'schedule' && <SchedulePanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'tokens' && <TokenPanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'deepseek-balance' && renderDeepseekBalance()}
        {activeTab === 'monitor' && <MonitorPanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'backup' && <BackupPanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'users' && <UsersPanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'mall' && <MallPanel adminFetch={adminFetch} />}
        {activeTab === 'evolution' && <EvolutionPanel adminFetch={adminFetch} showToast={showToast} />}
        {activeTab === 'audit-log' && <AuditLogPanel adminFetch={adminFetch} showToast={showToast} />}
        </div>
      </div>
      {showAdminReport && deepAnalysisResult && (
        <ReportCard collectedData={sessionCollectedData} analysisText={deepAnalysisResult} onClose={() => setShowAdminReport(false)} />
      )}
      <FloatingAdminAi
        adminFetch={adminFetch}
        showToast={showToast}
        onNavigateTab={setActiveTab}
        onGlobalRefresh={() => {
          fetchStats()
          fetchRechargeOrders()
          fetchOrders()
          fetchCases()
          fetchSchedules()
          fetchQuickReplies()
        }}
      />
    </div>
  )
}
