import React, { useState, useEffect, useCallback } from 'react'
import AdminAiTabLayout from './AdminAiTabLayout.jsx'

const SUB_TABS = [
  { key: 'screen', label: '数据大屏' },
  { key: 'search', label: '全文搜索' },
  { key: 'snapshots', label: '快照&周对比' },
  { key: 'qa', label: '质检抽样' },
  { key: 'prompt-suggestions', label: 'Prompt 建议' },
  { key: 'prompts', label: 'Prompt 中心' },
  { key: 'replies', label: '快捷回复' },
]

const PROMPT_KEYS = [
  { key: 'chat_collection', label: '对话收集指引' },
  { key: 'appeal_guide_overlay', label: '申诉指导 AI 快照' },
  { key: 'report_generation', label: '报告生成指引' },
  { key: 'chatboard_weekly', label: '看板周报模板' },
]

function estTokens(chars) {
  return Math.ceil((Number(chars) || 0) / 3.5)
}

function PromptLivePreview({ adminFetch, promptPreviewKey, setPromptPreviewKey, promptKeys, estTokens }) {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await adminFetch(`/api/admin/ops/prompts/published/${encodeURIComponent(promptPreviewKey)}`)
        const j = await res.json()
        if (!cancelled) setLive(j.item || null)
      } catch {
        if (!cancelled) setLive(null)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [adminFetch, promptPreviewKey])

  const len = live?.content?.length ?? 0

  return (
    <div className="bg-white rounded-2xl border p-4 space-y-2">
      <h3 className="text-sm font-semibold">线上生效预览</h3>
      <select
        value={promptPreviewKey}
        onChange={(e) => setPromptPreviewKey(e.target.value)}
        className="text-sm border rounded-lg px-2 py-1.5 w-full"
      >
        {promptKeys.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
      {loading ? (
        <p className="text-xs text-gray-500">加载中…</p>
      ) : live ? (
        <>
          <p className="text-[10px] text-gray-500">
            v{live.version} · {len} 字 · 约 {estTokens(len)} tokens
            {live.published_at ? ` · 发布 ${String(live.published_at).slice(0, 16)}` : ''}
          </p>
          <pre className="text-[11px] text-gray-700 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
            {live.content}
          </pre>
        </>
      ) : (
        <p className="text-xs text-amber-600">该 key 尚无已发布版本，运行时回退代码默认</p>
      )}
    </div>
  )
}

function MiniBars({ rows, valueKey = 'cnt', labelKey, color = 'bg-cyan-400', maxH = 72 }) {
  const max = Math.max(...(rows || []).map((r) => Number(r[valueKey]) || 0), 1)
  return (
    <div className="flex items-end gap-1 h-20">
      {(rows || []).slice(0, 14).map((r, i) => {
        const v = Number(r[valueKey]) || 0
        const h = Math.max(3, Math.round((v / max) * maxH))
        const lbl = labelKey ? String(r[labelKey] || '').slice(5) : ''
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
            <div className={`w-full rounded-t ${color}`} style={{ height: h }} title={String(v)} />
            {labelKey ? <span className="text-[8px] text-slate-500 mt-0.5">{lbl}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

export default function OpsCenterPanel({ adminFetch, showToast, onOpenSession }) {
  const [sub, setSub] = useState('screen')
  const [screen, setScreen] = useState(null)
  const [loadingScreen, setLoadingScreen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState(null)
  const [searching, setSearching] = useState(false)
  const [week, setWeek] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [qaItems, setQaItems] = useState([])
  const [qaFilter, setQaFilter] = useState('pending')
  const [qaSampling, setQaSampling] = useState(false)
  const [prompts, setPrompts] = useState([])
  const [promptDraft, setPromptDraft] = useState({ promptKey: 'chat_collection', title: '', content: '' })
  const [promptPreviewKey, setPromptPreviewKey] = useState('chat_collection')
  const [promptSuggestions, setPromptSuggestions] = useState(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [promptTest, setPromptTest] = useState({
    userMessage: '我做餐饮的，微信收款被限额了，说我交易异常',
    collectedJson: '{}',
    reply: '',
    loading: false,
  })
  const [replies, setReplies] = useState([])
  const [replyForm, setReplyForm] = useState({ title: '', content: '' })

  const loadScreen = useCallback(async () => {
    setLoadingScreen(true)
    try {
      const res = await adminFetch('/api/admin/ops/screen')
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载失败')
      setScreen(j)
    } catch (e) {
      showToast?.(e.message || '大屏加载失败')
    }
    setLoadingScreen(false)
  }, [adminFetch, showToast])

  const loadSnapshots = useCallback(async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        adminFetch('/api/admin/ops/week-compare?days=7'),
        adminFetch('/api/admin/ops/snapshots'),
      ])
      setWeek(await wRes.json())
      const s = await sRes.json()
      setSnapshots(s.snapshots || [])
    } catch (e) {
      console.error(e)
    }
  }, [adminFetch])

  const loadQA = useCallback(async (rating = qaFilter) => {
    try {
      const q = rating ? `?rating=${encodeURIComponent(rating)}&limit=80` : '?limit=80'
      const res = await adminFetch(`/api/admin/ops/qa${q}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载失败')
      setQaItems(j.items || [])
      if (j.purged > 0) {
        showToast?.(`已移除 ${j.purged} 条已删除会话的质检记录`)
      }
    } catch (e) {
      console.error(e)
      showToast?.(e.message || '加载质检列表失败')
    }
  }, [adminFetch, qaFilter, showToast])

  const loadPrompts = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/ops/prompts')
      setPrompts((await res.json()).items || [])
    } catch (e) {
      console.error(e)
    }
  }, [adminFetch])

  const loadPromptSuggestions = useCallback(async () => {
    setLoadingSuggestions(true)
    try {
      const res = await adminFetch('/api/admin/ops/prompt-suggestions')
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '加载失败')
      setPromptSuggestions(j)
    } catch (e) {
      showToast?.(e.message || '加载建议失败')
    }
    setLoadingSuggestions(false)
  }, [adminFetch, showToast])

  const loadReplies = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/ops/quick-replies')
      setReplies((await res.json()).items || [])
    } catch (e) {
      console.error(e)
    }
  }, [adminFetch])

  useEffect(() => {
    if (sub === 'screen') loadScreen()
    if (sub === 'snapshots') loadSnapshots()
    if (sub === 'qa') loadQA(qaFilter)
    if (sub === 'prompts') loadPrompts()
    if (sub === 'prompt-suggestions') loadPromptSuggestions()
    if (sub === 'replies') loadReplies()
  }, [sub, loadScreen, loadSnapshots, loadQA, loadPrompts, loadPromptSuggestions, loadReplies])

  async function runSearch(e) {
    e?.preventDefault()
    const q = searchQ.trim()
    if (q.length < 2) {
      showToast?.('至少输入 2 个字')
      return
    }
    setSearching(true)
    try {
      const res = await adminFetch(`/api/admin/ops/messages/search?q=${encodeURIComponent(q)}&limit=50`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '搜索失败')
      setSearchRes(j)
    } catch (err) {
      showToast?.(err.message)
    }
    setSearching(false)
  }

  async function saveSnapshot() {
    try {
      const res = await adminFetch('/api/admin/ops/snapshots', { method: 'POST', body: JSON.stringify({ days: 7 }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '失败')
      setSnapshots(j.list || [])
      showToast?.('今日快照已保存')
    } catch (e) {
      showToast?.(e.message)
    }
  }

  async function sampleQA() {
    setQaSampling(true)
    try {
      const res = await adminFetch('/api/admin/ops/qa/sample', {
        method: 'POST',
        body: JSON.stringify({ count: 8 }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '失败')
      setQaItems(j.items || [])
      setQaFilter('pending')
      const msg = j.message || (j.added || j.requeued ? `已抽取（新增 ${j.added || 0}）` : '暂无新样本可抽')
      showToast?.(msg)
    } catch (e) {
      showToast?.(e.message)
    }
    setQaSampling(false)
  }

  async function rateQA(sessionId, rating) {
    let notes = ''
    if (rating === 'bad') {
      notes = window.prompt('待改进说明（会进入 Prompt 优化建议，可留空）', '') ?? ''
    }
    try {
      const res = await adminFetch(`/api/admin/ops/qa/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ rating, notes }),
      })
      const j = await res.json()
      if (!res.ok) {
        if (res.status === 404) {
          showToast?.('该会话已删除，已从质检列表移除')
          loadQA(qaFilter)
          return
        }
        throw new Error(j.error || '保存失败')
      }
      showToast?.(rating === 'good' ? '已标记合格' : rating === 'bad' ? '已标记待改进' : '已恢复待评')
      loadQA(qaFilter === 'pending' && rating !== 'pending' ? 'pending' : qaFilter)
    } catch (e) {
      showToast?.(e.message)
    }
  }

  async function openQASession(sessionId) {
    if (!sessionId) return
    try {
      const res = await adminFetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}/messages`)
      const j = await res.json()
      if (!res.ok || j.error || !j.session) {
        showToast?.('会话已删除或不存在，请刷新质检列表')
        loadQA(qaFilter)
        return
      }
      onOpenSession?.(sessionId)
    } catch {
      showToast?.('无法打开会话，请刷新列表')
    }
  }

  async function savePrompt() {
    try {
      const res = await adminFetch('/api/admin/ops/prompts/draft', {
        method: 'POST',
        body: JSON.stringify(promptDraft),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '保存失败')
      showToast?.('草稿已保存 v' + j.version)
      loadPrompts()
    } catch (e) {
      showToast?.(e.message)
    }
  }

  async function publishPrompt(id) {
    if (!confirm('确认发布该 Prompt？将替换同 key 的线上版本。')) return
    try {
      const res = await adminFetch(`/api/admin/ops/prompts/${id}/publish`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '发布失败')
      showToast?.('已发布')
      loadPrompts()
    } catch (e) {
      showToast?.(e.message)
    }
  }

  async function runPromptTest() {
    setPromptTest((t) => ({ ...t, loading: true, reply: '' }))
    let collectedData = {}
    try {
      collectedData = JSON.parse(promptTest.collectedJson || '{}')
    } catch {
      showToast?.('已收集数据须为合法 JSON')
      setPromptTest((t) => ({ ...t, loading: false }))
      return
    }
    try {
      const res = await adminFetch('/api/admin/ops/prompts/test', {
        method: 'POST',
        body: JSON.stringify({
          userMessage: promptTest.userMessage,
          collectedData,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '测试失败')
      setPromptTest((t) => ({
        ...t,
        loading: false,
        reply: j.reply || '',
        instructionChars: j.instructionChars,
        usedAI: j.usedAI,
      }))
    } catch (e) {
      showToast?.(e.message)
      setPromptTest((t) => ({ ...t, loading: false }))
    }
  }

  async function saveReply() {
    if (!replyForm.title?.trim() || !replyForm.content?.trim()) {
      showToast?.('标题和内容必填')
      return
    }
    try {
      await adminFetch('/api/admin/ops/quick-replies', { method: 'POST', body: JSON.stringify(replyForm) })
      setReplyForm({ title: '', content: '' })
      loadReplies()
      showToast?.('已保存')
    } catch (e) {
      showToast?.(e.message || '保存失败')
    }
  }

  const cb = screen?.chatboard
  const st = screen?.stats

  return (
    <AdminAiTabLayout
      tabKey="ops-center"
      adminFetch={adminFetch}
      showToast={showToast}
      className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-8"
    >
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">运营中心</h2>
          <p className="text-xs text-gray-500 mt-0.5">数据大屏 · 全文搜索 · 日快照 · 质检 · Prompt 审核发布 · 快捷回复</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSub(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sub === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'screen' && (
        <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 min-h-[520px]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div>
                <p className="text-indigo-300 text-xs font-medium tracking-widest uppercase">Operations Dashboard</p>
                <h3 className="text-2xl font-bold mt-1">商户申诉 · 实时运营大屏</h3>
              </div>
              <button
                type="button"
                onClick={loadScreen}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
              >
                {loadingScreen ? '刷新中…' : '刷新'}
              </button>
            </div>

            {loadingScreen && !screen ? (
              <p className="text-slate-400 text-sm text-center py-20">加载大屏数据…</p>
            ) : screen ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: '总用户', v: st?.totalUsers ?? '—', sub: `今日 +${st?.todayUsers ?? 0}`, hint: '注册用户总数' },
                    {
                      label: '7日窗口消息',
                      v: cb?.totals?.messages_in_window ?? '—',
                      sub: `活跃会话 ${cb?.totals?.sessions_with_messages_in_window ?? '—'}`,
                      hint: cb?.metricDefinitions?.messages_in_window?.definition || '窗口内消息且会话仍存在',
                    },
                    {
                      label: '7日新建会话',
                      v: cb?.totals?.sessions_started_in_window ?? '—',
                      sub: week
                        ? `环比 ${week.changePct?.sessions ?? 0}% · 空会话 ${cb?.totals?.sessions_empty_in_window ?? 0}`
                        : `空会话 ${cb?.totals?.sessions_empty_in_window ?? 0}`,
                      hint: cb?.metricDefinitions?.sessions_started_in_window?.definition || '按创建时间计数，含未发言',
                    },
                    { label: '草稿 Prompt', v: screen?.alerts?.draftPromptCount ?? 0, sub: '待审核发布', hint: 'Prompt 中心未发布草稿数' },
                  ].map((x) => (
                    <div key={x.label} className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm" title={x.hint}>
                      <p className="text-[11px] text-slate-400">{x.label}</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums text-cyan-300">{x.v}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{x.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-slate-400 mb-2">近 7 日消息趋势</p>
                    <MiniBars rows={cb?.dailyMessages} valueKey="cnt" labelKey="d" color="bg-cyan-400" />
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-slate-400 mb-2">用户消息时段</p>
                    <MiniBars rows={cb?.userMessagesByHour} valueKey="cnt" labelKey="h" color="bg-violet-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
                    <p className="text-xs text-amber-200 font-semibold mb-2">卡点告警 · 只聊一句就离开 ({screen.alerts?.abandonedSessions?.length || 0})</p>
                    <ul className="text-[11px] text-amber-100/90 space-y-1 max-h-28 overflow-y-auto">
                      {(screen.alerts?.abandonedSessions || []).slice(0, 8).map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <button type="button" className="font-mono truncate hover:underline" onClick={() => onOpenSession?.(s.id)}>{s.id.slice(0, 10)}…</button>
                          <span className="text-amber-300/70 flex-shrink-0">step {s.step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4">
                    <p className="text-xs text-rose-200 font-semibold mb-2">卡点告警 · 久未推进 ({screen.alerts?.stuckSessions?.length || 0})</p>
                    <ul className="text-[11px] text-rose-100/90 space-y-1 max-h-28 overflow-y-auto">
                      {(screen.alerts?.stuckSessions || []).slice(0, 8).map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <button type="button" className="font-mono truncate hover:underline" onClick={() => onOpenSession?.(s.id)}>{s.id.slice(0, 10)}…</button>
                          <span className="flex-shrink-0">{s.msg_cnt} 条</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {sub === 'search' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="搜索消息全文（至少 2 字）…"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2"
            />
            <button type="submit" disabled={searching} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
              {searching ? '搜索中…' : '搜索'}
            </button>
          </form>
          {searchRes && (
            <p className="text-xs text-gray-500">共 {searchRes.total} 条匹配</p>
          )}
          <ul className="space-y-2 max-h-[480px] overflow-y-auto">
            {(searchRes?.items || []).map((item) => (
              <li key={item.messageId} className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 mb-1">
                  <span className="font-mono">{item.sessionId.slice(0, 12)}…</span>
                  <span>{item.role}</span>
                  <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{item.excerpt}</p>
                <button type="button" className="text-xs text-indigo-600 mt-2 hover:underline" onClick={() => onOpenSession?.(item.sessionId)}>
                  打开会话
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sub === 'snapshots' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">周对比（近 7 天 vs 上一段 7 天）</h3>
            {week ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-indigo-50">
                  <p className="text-gray-500 text-xs">消息量</p>
                  <p className="font-bold text-indigo-800">{week.current?.messages}</p>
                  <p className={`text-xs mt-1 ${week.changePct?.messages >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    环比 {week.changePct?.messages}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50">
                  <p className="text-gray-500 text-xs">新会话</p>
                  <p className="font-bold text-purple-800">{week.current?.sessions}</p>
                  <p className={`text-xs mt-1 ${week.changePct?.sessions >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    环比 {week.changePct?.sessions}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">加载中…</p>
            )}
            <button type="button" onClick={saveSnapshot} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white">
              保存今日看板快照
            </button>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">历史快照</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b">
                  <th className="text-left py-2">日期</th>
                  <th className="text-right py-2">消息</th>
                  <th className="text-right py-2">新会话</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.snapshot_date} className="border-b border-gray-50">
                    <td className="py-2">{String(s.snapshot_date).slice(0, 10)}</td>
                    <td className="py-2 text-right tabular-nums">{s.messages_in_window}</td>
                    <td className="py-2 text-right tabular-nums">{s.sessions_started}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === 'qa' && (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            从近 14 天（不足则扩至 30 天）有用户消息的会话中随机抽取；已在「待评」队列中的不会重复抽。标记「待改进」时可填写说明，用于 Prompt 优化建议。
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { key: 'pending', label: '待评' },
              { key: 'good', label: '合格' },
              { key: 'bad', label: '待改进' },
              { key: '', label: '全部' },
            ].map((f) => (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => {
                  setQaFilter(f.key)
                  loadQA(f.key)
                }}
                className={`text-xs px-2.5 py-1 rounded-lg ${
                  qaFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sampleQA}
              disabled={qaSampling}
              className="text-xs px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50"
            >
              {qaSampling ? '抽取中…' : '随机抽取 8 条待质检'}
            </button>
            <button type="button" onClick={() => loadQA(qaFilter)} className="text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-700">
              刷新列表
            </button>
          </div>
          <ul className="space-y-2 max-h-[520px] overflow-y-auto">
            {qaItems.length === 0 && (
              <li className="text-sm text-gray-400 py-8 text-center">
                {qaFilter === 'pending' ? '暂无待评样本，点击上方「随机抽取」' : '该筛选下暂无记录'}
              </li>
            )}
            {qaItems.map((q) => (
              <li key={q.session_id} className="border rounded-xl p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                  <span className="font-mono">{q.session_id?.slice(0, 8)}…</span>
                  <span>{q.message_count ?? 0} 条消息</span>
                  {q.session_created_at && (
                    <span>{new Date(q.session_created_at).toLocaleDateString('zh-CN')}</span>
                  )}
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      q.rating === 'good'
                        ? 'bg-green-100 text-green-700'
                        : q.rating === 'bad'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {q.rating === 'good' ? '合格' : q.rating === 'bad' ? '待改进' : '待评'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{q.first_snippet || '（无用户首句）'}</p>
                {q.notes ? <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">备注：{q.notes}</p> : null}
                <div className="flex gap-2 flex-wrap">
                  {['good', 'bad', 'pending'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => rateQA(q.session_id, r)}
                      className={`text-xs px-2 py-1 rounded-lg ${
                        q.rating === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {r === 'good' ? '合格' : r === 'bad' ? '待改进' : '待评'}
                    </button>
                  ))}
                  <button type="button" className="text-xs text-indigo-600 ml-auto" onClick={() => openQASession(q.session_id)}>
                    打开会话
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sub === 'prompt-suggestions' && (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={loadPromptSuggestions}
              disabled={loadingSuggestions}
              className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              {loadingSuggestions ? '汇总中…' : '刷新建议'}
            </button>
            <p className="text-[10px] text-gray-500">基于近 7 天看板 + 质检 bad，人工采纳后在 Prompt 中心发布</p>
          </div>
          <ul className="space-y-2 max-h-[560px] overflow-y-auto">
            {(promptSuggestions?.suggestions || []).length === 0 && !loadingSuggestions && (
              <li className="text-sm text-gray-500">暂无建议，可先积累会话与质检数据</li>
            )}
            {(promptSuggestions?.suggestions || []).map((s, i) => (
              <li key={i} className="border rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      s.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {s.priority === 'high' ? '高' : '中'}
                  </span>
                  <span className="text-[10px] text-gray-400">{s.type}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{s.detail}</p>
                <p className="text-xs text-indigo-700 mt-2">→ {s.action}</p>
              </li>
            ))}
          </ul>
          {promptSuggestions?.generatedAt && (
            <p className="text-[10px] text-gray-400">生成于 {promptSuggestions.generatedAt}</p>
          )}
        </div>
      )}

      {sub === 'prompts' && (
        <div className="space-y-4">
          <PromptLivePreview
            adminFetch={adminFetch}
            promptPreviewKey={promptPreviewKey}
            setPromptPreviewKey={setPromptPreviewKey}
            promptKeys={PROMPT_KEYS}
            estTokens={estTokens}
          />
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">样例会话测试（chat_collection）</h3>
            <textarea
              value={promptTest.userMessage}
              onChange={(e) => setPromptTest((t) => ({ ...t, userMessage: e.target.value }))}
              rows={2}
              className="w-full text-sm border rounded-lg px-2 py-1.5"
              placeholder="模拟用户一句话…"
            />
            <textarea
              value={promptTest.collectedJson}
              onChange={(e) => setPromptTest((t) => ({ ...t, collectedJson: e.target.value }))}
              rows={3}
              className="w-full text-[11px] border rounded-lg px-2 py-1.5 font-mono"
              placeholder='已收集 JSON，如 {"industry":"餐饮"}'
            />
            <button
              type="button"
              onClick={runPromptTest}
              disabled={promptTest.loading}
              className="text-xs px-3 py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50"
            >
              {promptTest.loading ? '调用中…' : '生成下一句回复'}
            </button>
            {promptTest.instructionChars != null && (
              <p className="text-[10px] text-gray-500">
                收集指引 {promptTest.instructionChars} 字 · {promptTest.usedAI ? '已走 AI' : '本地回退'}
              </p>
            )}
            {promptTest.reply && (
              <pre className="text-xs bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{promptTest.reply}</pre>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">新建草稿（需人工发布后生效）</h3>
            <select
              value={promptDraft.promptKey}
              onChange={(e) => {
                const pk = PROMPT_KEYS.find((p) => p.key === e.target.value)
                setPromptDraft((f) => ({ ...f, promptKey: e.target.value, title: pk?.label || e.target.value }))
              }}
              className="w-full text-sm border rounded-lg px-2 py-1.5"
            >
              {PROMPT_KEYS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <textarea
              value={promptDraft.content}
              onChange={(e) => setPromptDraft((f) => ({ ...f, content: e.target.value }))}
              rows={8}
              className="w-full text-sm border rounded-xl px-3 py-2 font-mono"
              placeholder="Prompt 正文…"
            />
            <button type="button" onClick={savePrompt} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white">
              保存草稿
            </button>
          </div>
          <div className="bg-white rounded-2xl border p-4 max-h-[480px] overflow-y-auto">
            <h3 className="text-sm font-semibold mb-2">版本列表</h3>
            {prompts.map((p) => (
              <div key={p.id} className="border-b border-gray-50 py-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-800">{p.title}</span>
                  <span className={p.status === 'published' ? 'text-green-600' : 'text-amber-600'}>{p.status} v{p.version}</span>
                </div>
                <p className="text-gray-500 mt-1 line-clamp-2">{p.preview}</p>
                {p.status === 'draft' && (
                  <button type="button" onClick={() => publishPrompt(p.id)} className="text-indigo-600 mt-1 hover:underline">
                    发布上线
                  </button>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {sub === 'replies' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <h3 className="text-sm font-semibold">新增快捷回复</h3>
            <input
              value={replyForm.title}
              onChange={(e) => setReplyForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="标题"
              className="w-full text-sm border rounded-lg px-2 py-1.5"
            />
            <textarea
              value={replyForm.content}
              onChange={(e) => setReplyForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
              className="w-full text-sm border rounded-xl px-3 py-2"
            />
            <button type="button" onClick={saveReply} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white">
              保存
            </button>
            <p className="text-[10px] text-gray-400">在「用户对话」回复框旁可点击插入（见会话页）</p>
          </div>
          <ul className="bg-white rounded-2xl border p-4 space-y-2 max-h-[400px] overflow-y-auto text-sm">
            {replies.map((r) => (
              <li key={r.id} className="border border-gray-100 rounded-lg p-2">
                <p className="font-medium text-gray-800">{r.title}</p>
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{r.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </AdminAiTabLayout>
  )
}
