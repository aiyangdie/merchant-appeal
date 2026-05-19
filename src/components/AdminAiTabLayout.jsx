import React, { useState } from 'react'
import AdminAiChat from './AdminAiChat.jsx'
import { getAiModuleForTab } from '../config/adminAiModules.js'

/**
 * 与用户管理一致的 AI 交互：主功能 | AI对话 子 Tab，默认主功能页
 */
export default function AdminAiTabLayout({
  tabKey,
  module: moduleProp,
  adminFetch,
  showToast,
  onRefresh,
  loading,
  mainTabLabel,
  children,
  className = '',
}) {
  const cfg = tabKey ? getAiModuleForTab(tabKey) : null
  const module = moduleProp || cfg?.module || tabKey
  const [tab, setTab] = useState('main')

  if (!module) {
    return <div className={className}>{children}</div>
  }

  const mainLabel = mainTabLabel || cfg?.title || '功能页'

  const tabs = [
    { k: 'main', l: mainLabel, i: '📋' },
    { k: 'ai', l: 'AI对话', i: '🤖' },
  ]

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div className="flex items-center gap-1.5 flex-wrap border-b border-gray-100 pb-3">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.k ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <AdminAiChat
          module={module}
          adminFetch={adminFetch}
          showToast={showToast}
          onRefresh={onRefresh}
          onMutationSuccess={() => {
            onRefresh?.()
            setTab('main')
            showToast?.('操作已完成，已更新列表')
          }}
          loading={loading}
          compact={false}
        />
      )}

      {tab === 'main' && children}
    </div>
  )
}
