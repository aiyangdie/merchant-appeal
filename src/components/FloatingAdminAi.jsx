/**
 * 管理后台全局悬浮「AI」万能助手
 */
import React, { useState, useEffect, useCallback } from 'react'
import AdminAiChat from './AdminAiChat.jsx'

const GLOBAL_EXAMPLES = [
  '有哪些待确认的充值？',
  '明天上午10点提醒我审核充值',
  '立即备份数据库',
  '生成一个新餐饮申诉成功案例',
  '最近30天经营情况怎么样？',
  '执行健康检测',
]

const TAB_ALIASES = {
  ops: 'ops-center',
  'session-chatboard': 'session-chatboard',
  recharge: 'recharge',
  orders: 'orders',
  knowledge: 'knowledge',
  analytics: 'analytics',
  tokens: 'tokens',
  evolution: 'evolution',
  schedule: 'schedule',
  backup: 'backup',
  monitor: 'monitor',
  settings: 'settings',
  users: 'users',
  mall: 'mall',
}

export default function FloatingAdminAi({ adminFetch, showToast, onNavigateTab, onGlobalRefresh }) {
  const [open, setOpen] = useState(false)
  const [confirmModule, setConfirmModule] = useState('global')

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const handleAiResult = useCallback(
    (d) => {
      if (d?.confirmModule) setConfirmModule(d.confirmModule)
      const tab = d?.navigateTo
      if (tab && onNavigateTab) {
        onNavigateTab(TAB_ALIASES[tab] || tab)
      }
      if (d?.executed?.some((e) => e.ok && !e.hint)) {
        onGlobalRefresh?.()
      }
    },
    [onNavigateTab, onGlobalRefresh, showToast]
  )

  const commandFetch = useCallback(
    async (path, opts) => {
      const res = await adminFetch(path, opts)
      if (path === '/api/admin/ai-command' && opts?.method === 'POST') {
        try {
          const d = await res.clone().json()
          handleAiResult(d)
        } catch {
          /* ignore */
        }
      }
      return res
    },
    [adminFetch, handleAiResult]
  )

  const confirmFetch = useCallback(
    async (path, opts) => {
      if (path === '/api/admin/ai-command/confirm' && opts?.body) {
        try {
          const body =
            typeof opts.body === 'string' ? JSON.parse(opts.body) : { ...opts.body }
          if (body.module === 'global' && confirmModule && confirmModule !== 'global') {
            body.module = confirmModule
          }
          return adminFetch(path, { ...opts, body: JSON.stringify(body) })
        } catch {
          return adminFetch(path, opts)
        }
      }
      return adminFetch(path, opts)
    },
    [adminFetch, confirmModule]
  )

  return (
    <>
      <button
        type="button"
        aria-label="打开全能 AI 助手"
        title="全能 AI · 自然语言控制整个后台"
        onClick={() => setOpen((v) => !v)}
        className="fixed z-[200] right-5 bottom-5 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold text-base shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center ring-2 ring-white/30"
      >
        AI
      </button>

      {open && (
        <>
          <motionBackdrop onClose={() => setOpen(false)} />
          <div className="fixed z-[202] right-3 bottom-3 top-3 w-[calc(100%-1.5rem)] max-w-md flex flex-col bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden sm:right-4 sm:bottom-4 sm:top-16">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-t-2xl shrink-0">
              <motionHeader />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-lg leading-none"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-3 bg-slate-50">
              <AdminAiChat
                module="global"
                adminFetch={confirmFetch}
                commandFetch={commandFetch}
                showToast={showToast}
                suppressSuccessToast
                compact
                welcomeText="你好，我是管理后台「全能 AI」。用一句话即可操作充值、订单、知识库、日程、备份、监控、用户、商城等。危险操作需二次确认。"
                examplePrompts={GLOBAL_EXAMPLES}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

function motionBackdrop({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[201] bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
      aria-hidden
    />
  )
}

function motionHeader() {
  return (
    <div>
      <h2 className="text-base font-bold">全能 AI</h2>
      <p className="text-[11px] text-indigo-100/90 mt-0.5">自然语言控制整个管理后台</p>
    </div>
  )
}
