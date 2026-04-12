import React, { useState, useEffect, useCallback } from 'react'
import QualityDashboard from './QualityDashboard'

const SUB_TABS = [
  { key: 'quality', label: '质量仪表板', icon: '🎯' },
  { key: 'overview', label: '总览', icon: '🧠' },
  { key: 'rules', label: '规则库', icon: '📋' },
  { key: 'analyses', label: '对话分析', icon: '🔍' },
  { key: 'clusters', label: '知识聚合', icon: '🔬' },
  { key: 'experiments', label: '探索实验', icon: '🧪' },
  { key: 'health', label: '引擎健康', icon: '💚' },
  { key: 'metrics', label: '学习指标', icon: '📈' },
  { key: 'changelog', label: '变更日志', icon: '📝' },
]

const CATEGORY_LABELS = {
  collection_strategy: '收集策略',
  question_template: '提问话术',
  industry_knowledge: '行业知识',
  violation_strategy: '违规应对',
  conversation_pattern: '对话模式',
  diagnosis_rule: '诊断规则',
}

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-600',
}

const STATUS_LABELS = {
  active: '生效中',
  pending_review: '待审批',
  archived: '已归档',
  rejected: '已拒绝',
}

const SENTIMENT_LABELS = {
  positive: { label: '积极', color: 'text-green-600', bg: 'bg-green-50' },
  slightly_positive: { label: '偏积极', color: 'text-green-500', bg: 'bg-green-50' },
  neutral: { label: '中性', color: 'text-gray-600', bg: 'bg-gray-50' },
  slightly_negative: { label: '偏消极', color: 'text-orange-500', bg: 'bg-orange-50' },
  negative: { label: '消极', color: 'text-red-600', bg: 'bg-red-50' },
}

const HEALTH_STATUS_LABELS = {
  healthy: '正常', recovering: '恢复中', degraded: '降级', circuit_open: '已熔断',
}

const COMPONENT_LABELS = {
  batch_analysis: '批量分析', rule_evaluation: '规则评估', auto_promote: '自动升降级',
  exploration: '探索实验', daily_aggregation: '每日聚合', knowledge_clustering: '知识聚类',
  tagging: '自动打标', aggregation: '数据聚合', incremental_aggregation: '增量聚合',
  batch_aggregation: '批量聚合', auto_review: 'AI规则审批',
}

const ACTION_LABELS = {
  activated: '激活', created: '创建', rejected: '拒绝', archived: '归档',
  updated: '更新', status_change: '状态变更', content_update: '内容更新',
}

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' }

function timeAgo(t) {
  if (!t) return '-'
  const d = new Date(t)
  const now = new Date()
  const s = Math.floor((now - d) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)}小时前`
  return `${Math.floor(s / 86400)}天前`
}

function StatCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Badge({ status }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-500'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function EvolutionPanel({ adminFetch, showToast }) {
  const [subTab, setSubTab] = useState('quality')
  const [loading, setLoading] = useState(false)

  // Quality dashboard data
  const [qualityData, setQualityData] = useState(null)

  // Overview data
  const [ruleStats, setRuleStats] = useState(null)
  const [analysisStats, setAnalysisStats] = useState(null)
  const [unanalyzed, setUnanalyzed] = useState([])

  // Rules data
  const [rules, setRules] = useState([])
  const [ruleFilter, setRuleFilter] = useState({ category: '', status: '' })
  const [selectedRule, setSelectedRule] = useState(null)
  const [ruleChangeLog, setRuleChangeLog] = useState([])
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleForm, setRuleForm] = useState({ category: 'collection_strategy', ruleKey: '', ruleName: '', ruleContent: '{}', status: 'active' })
  const [editingRule, setEditingRule] = useState(null) // {id, ruleName, ruleContent}
  const [selectedRuleIds, setSelectedRuleIds] = useState(new Set())
  const [aiRuleAssist, setAiRuleAssist] = useState(false)
  const [aiRuleDesc, setAiRuleDesc] = useState('')

  // Analyses data
  const [analyses, setAnalyses] = useState([])
  const [selectedAnalysis, setSelectedAnalysis] = useState(null)
  const [analysisFilter, setAnalysisFilter] = useState({ sentiment: '', industry: '' })

  // Metrics data
  const [metrics, setMetrics] = useState([])

  // Changelog data
  const [changelog, setChangelog] = useState([])

  // V3: Clusters, experiments, health, tags
  const [clusters, setClusters] = useState([])
  const [clusterStats, setClusterStats] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [engineHealth, setEngineHealth] = useState(null)
  const [tagStats, setTagStats] = useState(null)

  const fetchQuality = useCallback(async () => {
    setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/evolution/quality-dashboard')).json()
      setQualityData(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [adminFetch])

  const fetchOverview = useCallback(async () => {
    if (!ruleStats && !analysisStats) setLoading(true)
    try {
      const [rs, as, un] = await Promise.allSettled([
        adminFetch('/api/admin/evolution/rules/stats').then(r => r.json()),
        adminFetch('/api/admin/evolution/analyses/stats').then(r => r.json()),
        adminFetch('/api/admin/evolution/unanalyzed?limit=10').then(r => r.json()),
      ])
      if (rs.status === 'fulfilled') setRuleStats(rs.value)
      if (as.status === 'fulfilled') setAnalysisStats(as.value)
      if (un.status === 'fulfilled') setUnanalyzed(un.value.sessions || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchRules = useCallback(async () => {
    if (rules.length === 0) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (ruleFilter.category) params.set('category', ruleFilter.category)
      if (ruleFilter.status) params.set('status', ruleFilter.status)
      const data = await (await adminFetch(`/api/admin/evolution/rules?${params}`)).json()
      setRules(data.rules || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch, ruleFilter])

  const fetchAnalyses = useCallback(async () => {
    if (analyses.length === 0) setLoading(true)
    try {
      const [aData, sData] = await Promise.allSettled([
        adminFetch('/api/admin/evolution/analyses?limit=50').then(r => r.json()),
        adminFetch('/api/admin/evolution/analyses/stats').then(r => r.json()),
      ])
      if (aData.status === 'fulfilled') setAnalyses(aData.value.analyses || [])
      if (sData.status === 'fulfilled') setAnalysisStats(sData.value)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchMetrics = useCallback(async () => {
    if (metrics.length === 0) setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/evolution/metrics?days=30')).json()
      setMetrics(data.metrics || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchChangelog = useCallback(async () => {
    if (changelog.length === 0) setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/evolution/changelog?limit=50')).json()
      setChangelog(data.log || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchClusters = useCallback(async () => {
    if (clusters.length === 0) setLoading(true)
    try {
      const [c, s] = await Promise.allSettled([
        adminFetch('/api/admin/evolution/clusters').then(r => r.json()),
        adminFetch('/api/admin/evolution/clusters/stats').then(r => r.json()),
      ])
      if (c.status === 'fulfilled') setClusters(c.value.clusters || [])
      if (s.status === 'fulfilled') setClusterStats(s.value)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchExperiments = useCallback(async () => {
    if (experiments.length === 0) setLoading(true)
    try {
      const data = await (await adminFetch('/api/admin/evolution/experiments')).json()
      setExperiments(data.experiments || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  const fetchHealth = useCallback(async () => {
    if (!engineHealth) setLoading(true)
    try {
      const [h, ts] = await Promise.allSettled([
        adminFetch('/api/admin/evolution/health').then(r => r.json()),
        adminFetch('/api/admin/evolution/tags/stats').then(r => r.json()),
      ])
      if (h.status === 'fulfilled') setEngineHealth(h.value)
      if (ts.status === 'fulfilled') setTagStats(ts.value)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [adminFetch])

  useEffect(() => {
    if (subTab === 'quality') fetchQuality()
    else if (subTab === 'overview') fetchOverview()
    else if (subTab === 'rules') fetchRules()
    else if (subTab === 'analyses') fetchAnalyses()
    else if (subTab === 'metrics') fetchMetrics()
    else if (subTab === 'changelog') fetchChangelog()
    else if (subTab === 'clusters') fetchClusters()
    else if (subTab === 'experiments') fetchExperiments()
    else if (subTab === 'health') fetchHealth()
  }, [subTab, fetchQuality, fetchOverview, fetchRules, fetchAnalyses, fetchMetrics, fetchChangelog, fetchClusters, fetchExperiments, fetchHealth])

  // Rule actions
  async function handleRuleStatus(id, status) {
    try {
      await adminFetch(`/api/admin/evolution/rules/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      })
      showToast(`规则已${STATUS_LABELS[status]}`)
      fetchRules()
      if (selectedRule?.id === id) setSelectedRule(null)
    } catch (e) { showToast('操作失败: ' + e.message) }
  }

  async function handleDeleteRule(id) {
    if (!confirm('确定删除此规则？')) return
    try {
      await adminFetch(`/api/admin/evolution/rules/${id}`, { method: 'DELETE' })
      showToast('规则已删除')
      fetchRules()
      if (selectedRule?.id === id) setSelectedRule(null)
    } catch (e) { showToast('删除失败') }
  }

  async function handleCreateRule() {
    try {
      let content
      try { content = JSON.parse(ruleForm.ruleContent) } catch { showToast('规则内容必须是合法JSON'); return }
      await adminFetch('/api/admin/evolution/rules', {
        method: 'POST',
        body: JSON.stringify({
          category: ruleForm.category, ruleKey: ruleForm.ruleKey,
          ruleName: ruleForm.ruleName, ruleContent: content, status: ruleForm.status,
        }),
      })
      showToast('规则创建成功')
      setShowRuleForm(false)
      setRuleForm({ category: 'collection_strategy', ruleKey: '', ruleName: '', ruleContent: '{}', status: 'active' })
      fetchRules()
    } catch (e) { showToast('创建失败: ' + e.message) }
  }

  async function handleViewRule(id) {
    try {
      const data = await (await adminFetch(`/api/admin/evolution/rules/${id}`)).json()
      setSelectedRule(data.rule)
      setRuleChangeLog(data.changeLog || [])
    } catch (e) { console.error(e) }
  }

  // Analysis actions
  async function handleAnalyzeSession(sessionId) {
    try {
      showToast('正在分析...')
      const data = await (await adminFetch(`/api/admin/evolution/analyze/${sessionId}`, { method: 'POST' })).json()
      showToast(`分析完成，生成${data.rulesGenerated || 0}条规则提案`)
      fetchOverview()
    } catch (e) { showToast('分析失败: ' + e.message) }
  }

  async function handleBatchAnalyze() {
    try {
      showToast('正在批量分析...')
      const data = await (await adminFetch('/api/admin/evolution/batch-analyze', {
        method: 'POST', body: JSON.stringify({ limit: 10 }),
      })).json()
      showToast(`批量分析完成: ${data.analyzed} 条`)
      fetchOverview()
    } catch (e) { showToast('批量分析失败: ' + e.message) }
  }

  async function handleAggregate() {
    try {
      await adminFetch('/api/admin/evolution/aggregate', { method: 'POST' })
      showToast('每日聚合完成')
      fetchMetrics()
    } catch (e) { showToast('聚合失败: ' + e.message) }
  }

  async function handleEvaluate() {
    try {
      showToast('正在评估规则效果...')
      await adminFetch('/api/admin/evolution/evaluate', { method: 'POST' })
      showToast('规则效果评估完成')
      fetchOverview()
    } catch (e) { showToast('评估失败: ' + e.message) }
  }

  async function handleAutoPromote() {
    try {
      showToast('正在执行自动升降级...')
      const data = await (await adminFetch('/api/admin/evolution/auto-promote', { method: 'POST' })).json()
      showToast(`升降级完成: ${data.promoted || 0}条升级, ${data.archived || 0}条归档`)
      fetchOverview()
      if (subTab === 'rules') fetchRules()
    } catch (e) { showToast('升降级失败: ' + e.message) }
  }

  async function handleBatchAutoReview() {
    try {
      showToast('AI正在批量审批规则...')
      const data = await (await adminFetch('/api/admin/evolution/rules/batch-auto-review', { method: 'POST' })).json()
      showToast(`AI审批完成: 通过${data.approved || 0}, 拒绝${data.rejected || 0}, 待审查${data.needReview || 0}`)
      fetchRules()
    } catch (e) { showToast('AI审批失败: ' + e.message) }
  }

  async function handleSingleAutoReview(id) {
    try {
      showToast('AI正在审批...')
      const data = await (await adminFetch(`/api/admin/evolution/rules/${id}/auto-review`, { method: 'POST' })).json()
      showToast(`AI审批: ${data.decision === 'approve' ? '✅通过' : data.decision === 'reject' ? '❌拒绝' : '⚠️待审查'} (评分${data.score})`)
      fetchRules()
    } catch (e) { showToast('AI审批失败: ' + e.message) }
  }

  // Batch actions
  function toggleRuleSelection(id) {
    setSelectedRuleIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBatchAction(status) {
    if (selectedRuleIds.size === 0) return
    const label = STATUS_LABELS[status] || status
    try {
      showToast(`批量${label} ${selectedRuleIds.size} 条规则...`)
      for (const id of selectedRuleIds) {
        await adminFetch(`/api/admin/evolution/rules/${id}/status`, {
          method: 'PUT', body: JSON.stringify({ status, reason: `批量${label}` }),
        })
      }
      showToast(`批量操作完成`)
      setSelectedRuleIds(new Set())
      fetchRules()
    } catch (e) { showToast('批量操作失败: ' + e.message) }
  }

  async function handleAIAssistRule() {
    if (!aiRuleDesc.trim()) { showToast('请输入规则描述'); return }
    setAiRuleAssist(true)
    try {
      const data = await (await adminFetch('/api/admin/ai-assist', {
        method: 'POST', body: JSON.stringify({ type: 'rule', description: aiRuleDesc.trim() }),
      })).json()
      if (data.rule) {
        setRuleForm(f => ({
          ...f,
          ruleKey: data.rule.ruleKey || f.ruleKey,
          ruleName: data.rule.ruleName || f.ruleName,
          category: data.rule.category || f.category,
          ruleContent: JSON.stringify(data.rule.ruleContent || {}, null, 2),
        }))
        showToast('✅ AI已生成规则内容')
      } else {
        showToast('AI生成失败: ' + (data.error || '未知错误'))
      }
    } catch (e) { showToast('AI辅助失败: ' + e.message) }
    setAiRuleAssist(false)
  }

  // Inline edit
  async function handleSaveEdit() {
    if (!editingRule) return
    try {
      let content
      try { content = JSON.parse(editingRule.ruleContent) } catch { showToast('JSON格式错误'); return }
      await adminFetch(`/api/admin/evolution/rules/${editingRule.id}/content`, {
        method: 'PUT', body: JSON.stringify({ ruleContent: content, ruleName: editingRule.ruleName }),
      })
      showToast('规则已更新')
      setEditingRule(null)
      setSelectedRule(null)
      fetchRules()
    } catch (e) { showToast('更新失败: ' + e.message) }
  }

  // ===== RENDER =====
  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1.5 px-4 lg:px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm overflow-x-auto no-scrollbar">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              subTab === t.key ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 gpu-scroll">
        {loading && !qualityData && !ruleStats && rules.length === 0 && analyses.length === 0 && metrics.length === 0 && changelog.length === 0 && clusters.length === 0 && experiments.length === 0 && !engineHealth && (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        )}

        {/* ===== QUALITY DASHBOARD ===== */}
        {subTab === 'quality' && <QualityDashboard data={qualityData} />}

        {/* ===== OVERVIEW ===== */}
        {subTab === 'overview' && (
          <>
            {/* Quick actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">🧠 AI 自进化总览</span>
              <div className="flex-1" />
              <button onClick={handleEvaluate}
                className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                评估规则效果
              </button>
              <button onClick={handleAutoPromote}
                className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium transition-colors">
                自动升降级
              </button>
              <button onClick={handleBatchAnalyze}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
                批量分析
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="活跃规则" value={ruleStats?.totals?.active || 0} color="text-green-600" sub="正在影响对话" />
              <StatCard label="待审批" value={ruleStats?.totals?.pending || 0} color="text-yellow-600" sub="AI生成待确认" />
              <StatCard label="已分析对话" value={analysisStats?.totals?.total || 0} color="text-indigo-600" />
              <StatCard label="平均完成率" value={`${parseFloat(analysisStats?.totals?.avg_completion || 0).toFixed(0)}%`} color="text-blue-600" />
              <StatCard label="AI专业度" value={parseFloat(analysisStats?.totals?.avg_professionalism || 0).toFixed(0)} color="text-indigo-600" sub="回复质量评分" />
              <StatCard label="预估申诉率" value={`${parseFloat(analysisStats?.totals?.avg_appeal_success || 0).toFixed(0)}%`} color="text-amber-600" sub="信息充分度" />
              <StatCard label="用户满意度" value={parseFloat(analysisStats?.totals?.avg_satisfaction || 0).toFixed(0)} color="text-pink-600" sub="体验指数" />
              <StatCard label="流失数" value={analysisStats?.totals?.drop_off_count || 0} color="text-red-500" sub="中途放弃" />
            </div>

            {/* Unanalyzed sessions */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-gray-700">待分析对话 ({unanalyzed.length})</h3>
                  {unanalyzed.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded ">AI每10分钟自动分析</span>
                  )}
                </div>
                <button onClick={handleBatchAnalyze}
                  className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
                  立即全部分析
                </button>
              </div>
              {unanalyzed.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="text-lg mb-1">✅</div>
                  <div className="text-sm text-green-600 font-medium">所有对话已分析完毕</div>
                  <div className="text-[10px] text-gray-400 mt-1">AI持续监控中，新对话将自动分析</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unanalyzed.map(s => (
                    <div key={s.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-700 truncate">{String(s.id).slice(0, 16)}...</div>
                        <div className="text-[11px] text-gray-400">
                          {s.message_count}条消息 · {timeAgo(s.created_at)}
                          {s.message_count < 3 && <span className="ml-1 text-orange-400">(消息过少，需≥3条)</span>}
                        </div>
                      </div>
                      <button onClick={() => handleAnalyzeSession(s.id)}
                        className="ml-2 px-2.5 py-1 text-[11px] bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 font-medium">
                        立即分析
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sentiment distribution */}
            {analysisStats?.bySentiment?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">用户情绪分布</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisStats.bySentiment.map(s => {
                    const info = SENTIMENT_LABELS[s.user_sentiment] || { label: s.user_sentiment, color: 'text-gray-600', bg: 'bg-gray-50' }
                    return (
                      <div key={s.user_sentiment} className={`${info.bg} px-3 py-2 rounded-lg`}>
                        <div className={`text-lg font-bold ${info.color}`}>{s.cnt}</div>
                        <div className="text-[11px] text-gray-500">{info.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top drop-offs */}
            {analysisStats?.topDropOffs?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">用户流失热点</h3>
                <div className="space-y-2">
                  {analysisStats.topDropOffs.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{d.drop_off_point}</span>
                      <span className="text-sm font-medium text-red-500">{d.cnt}次</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== RULES ===== */}
        {subTab === 'rules' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={ruleFilter.category} onChange={e => setRuleFilter(f => ({ ...f, category: e.target.value }))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="">全部类型</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={ruleFilter.status} onChange={e => setRuleFilter(f => ({ ...f, status: e.target.value }))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="text-[11px] text-gray-400">{rules.length} 条</span>
              <div className="flex-1" />
              {selectedRuleIds.size > 0 && (
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="text-[11px] text-indigo-600 font-medium">已选 {selectedRuleIds.size}</span>
                  <button onClick={() => handleBatchAction('active')}
                    className="px-2 py-1 text-[11px] bg-green-50 text-green-600 rounded-md hover:bg-green-100 font-medium">批量通过</button>
                  <button onClick={() => handleBatchAction('rejected')}
                    className="px-2 py-1 text-[11px] bg-red-50 text-red-500 rounded-md hover:bg-red-100 font-medium">批量拒绝</button>
                  <button onClick={() => handleBatchAction('archived')}
                    className="px-2 py-1 text-[11px] bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 font-medium">批量归档</button>
                  <button onClick={() => setSelectedRuleIds(new Set())}
                    className="px-2 py-1 text-[11px] text-gray-400 hover:text-gray-600">清除</button>
                </div>
              )}
              <button onClick={handleBatchAutoReview}
                className="px-3 py-1.5 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 font-medium transition-colors">
                🤖 AI批量审批
              </button>
              <button onClick={() => setShowRuleForm(true)}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                + 手动添加规则
              </button>
            </div>

            {/* Create rule form */}
            {showRuleForm && (
              <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-indigo-700">创建新规则</h3>
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-purple-700">🤖 AI辅助生成</span>
                    <span className="text-[10px] text-purple-400">用自然语言描述规则，AI自动填充表单</span>
                  </div>
                  <div className="flex gap-2">
                    <input value={aiRuleDesc} onChange={e => setAiRuleDesc(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      placeholder="如：当用户是餐饮行业时，优先收集营业执照和食品经营许可证" />
                    <button onClick={handleAIAssistRule} disabled={aiRuleAssist}
                      className={`px-4 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all ${aiRuleAssist ? 'bg-purple-200 text-purple-700 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                      {aiRuleAssist ? '⏳ 生成中...' : '✨ AI生成'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">类型</label>
                    <select value={ruleForm.category} onChange={e => setRuleForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">状态</label>
                    <select value={ruleForm.status} onChange={e => setRuleForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                      <option value="active">直接生效</option>
                      <option value="pending_review">待审批</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">规则Key (唯一标识)</label>
                  <input value={ruleForm.ruleKey} onChange={e => setRuleForm(f => ({ ...f, ruleKey: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="如: industry_餐饮_order" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">规则名称</label>
                  <input value={ruleForm.ruleName} onChange={e => setRuleForm(f => ({ ...f, ruleName: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="描述性名称" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">规则内容 (JSON)</label>
                  <textarea value={ruleForm.ruleContent} onChange={e => setRuleForm(f => ({ ...f, ruleContent: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono resize-y" rows={4}
                    placeholder='{"description": "...", "condition": "...", "action": "..."}' />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateRule} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">创建</button>
                  <button onClick={() => setShowRuleForm(false)} className="px-4 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">取消</button>
                </div>
              </div>
            )}

            {/* Rules list */}
            <div className="space-y-2">
              {rules.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">暂无规则</div>}
              {rules.map(r => (
                <div key={r.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  selectedRule?.id === r.id ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-100 hover:shadow-md'
                }`}>
                  <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => handleViewRule(r.id)}>
                    <input type="checkbox" checked={selectedRuleIds.has(r.id)}
                      onChange={() => toggleRuleSelection(r.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                          {CATEGORY_LABELS[r.category] || r.category}
                        </span>
                        <Badge status={r.status} />
                        <span className="text-[10px] text-gray-400">v{r.version}</span>
                        {r.source === 'ai_generated' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">AI生成</span>}
                      </div>
                      <div className="text-sm font-medium text-gray-800 truncate">{r.rule_name || r.rule_key}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>使用{r.usage_count}次</span>
                        <span className="inline-flex items-center gap-0.5">
                          效果
                          <span className={`font-medium ${parseFloat(r.effectiveness_score||0)>=60?'text-green-600':parseFloat(r.effectiveness_score||0)>=30?'text-yellow-600':'text-red-500'}`}>
                            {parseFloat(r.effectiveness_score || 0).toFixed(0)}
                          </span>
                        </span>
                        <span>{timeAgo(r.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {r.status === 'pending_review' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleSingleAutoReview(r.id) }}
                            className="px-2 py-1 text-[11px] bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 font-medium">AI审批</button>
                          <button onClick={e => { e.stopPropagation(); handleRuleStatus(r.id, 'active') }}
                            className="px-2 py-1 text-[11px] bg-green-50 text-green-600 rounded-md hover:bg-green-100 font-medium">通过</button>
                          <button onClick={e => { e.stopPropagation(); handleRuleStatus(r.id, 'rejected') }}
                            className="px-2 py-1 text-[11px] bg-red-50 text-red-500 rounded-md hover:bg-red-100 font-medium">拒绝</button>
                        </>
                      )}
                      {r.status === 'active' && (
                        <button onClick={e => { e.stopPropagation(); handleRuleStatus(r.id, 'archived') }}
                          className="px-2 py-1 text-[11px] bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 font-medium">归档</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleDeleteRule(r.id) }}
                        className="p-1 text-gray-300 hover:text-red-500 rounded-md hover:bg-red-50">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selectedRule?.id === r.id && (
                    <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] text-gray-500">规则内容</div>
                        {editingRule?.id === r.id ? (
                          <div className="flex gap-1">
                            <button onClick={handleSaveEdit} className="px-2 py-0.5 text-[11px] bg-indigo-600 text-white rounded font-medium">保存</button>
                            <button onClick={() => setEditingRule(null)} className="px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 rounded">取消</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingRule({ id: r.id, ruleName: selectedRule.rule_name, ruleContent: JSON.stringify(selectedRule.rule_content, null, 2) })}
                            className="px-2 py-0.5 text-[11px] bg-indigo-50 text-indigo-600 rounded font-medium hover:bg-indigo-100">编辑</button>
                        )}
                      </div>
                      {editingRule?.id === r.id ? (
                        <div className="space-y-2">
                          <input value={editingRule.ruleName} onChange={e => setEditingRule(prev => ({ ...prev, ruleName: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="规则名称" />
                          <textarea value={editingRule.ruleContent} onChange={e => setEditingRule(prev => ({ ...prev, ruleContent: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono resize-y" rows={6} />
                        </div>
                      ) : (
                        <pre className="text-xs bg-white rounded-lg p-3 border border-gray-100 overflow-x-auto max-h-48 overflow-y-auto font-mono text-gray-700">
                          {JSON.stringify(selectedRule.rule_content, null, 2)}
                        </pre>
                      )}
                      {ruleChangeLog.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[11px] text-gray-500 mb-1">变更历史</div>
                          <div className="space-y-1">
                            {ruleChangeLog.slice(0, 5).map(cl => (
                              <div key={cl.id} className="text-[11px] text-gray-400 flex items-center gap-2">
                                <span className="font-medium text-gray-600">{cl.action}</span>
                                <span>{cl.changed_by}</span>
                                <span>{timeAgo(cl.created_at)}</span>
                                {cl.reason && <span className="text-gray-500">— {cl.reason}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== ANALYSES ===== */}
        {subTab === 'analyses' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="总分析" value={analysisStats?.totals?.total || 0} />
              <StatCard label="平均轮数" value={parseFloat(analysisStats?.totals?.avg_turns || 0).toFixed(1)} />
              <StatCard label="平均完成率" value={`${parseFloat(analysisStats?.totals?.avg_completion || 0).toFixed(0)}%`} color="text-blue-600" />
              <StatCard label="流失数" value={analysisStats?.totals?.drop_off_count || 0} color="text-red-500" />
            </div>

            <div className="space-y-2">
              {analyses.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">暂无分析数据</div>}
              {analyses.map(a => {
                const sInfo = SENTIMENT_LABELS[a.user_sentiment] || SENTIMENT_LABELS.neutral
                return (
                  <div key={a.id} className={`bg-white rounded-xl border shadow-sm transition-all cursor-pointer ${
                    selectedAnalysis?.id === a.id ? 'border-indigo-200' : 'border-gray-100 hover:shadow-md'
                  }`} onClick={() => setSelectedAnalysis(selectedAnalysis?.id === a.id ? null : a)}>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {a.industry && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{a.industry}</span>}
                          {a.problem_type && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{a.problem_type}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sInfo.bg} ${sInfo.color}`}>{sInfo.label}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">{timeAgo(a.analyzed_at)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-gray-500">
                        <span>轮数: {a.total_turns}</span>
                        <span>收集: {a.fields_collected}/16</span>
                        <span>完成率: {parseFloat(a.completion_rate || 0).toFixed(0)}%</span>
                        {a.drop_off_point && <span className="text-red-500">流失: {a.drop_off_point}</span>}
                      </div>
                    </div>

                    {selectedAnalysis?.id === a.id && (
                      <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 space-y-3">
                        {/* Suggestions */}
                        {a.suggestions?.length > 0 && (
                          <div>
                            <div className="text-[11px] text-gray-500 mb-1 font-medium">优化建议</div>
                            <div className="space-y-1.5">
                              {a.suggestions.map((s, i) => (
                                <div key={i} className="text-xs bg-white rounded-lg p-2.5 border border-gray-100">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      s.priority === 'high' ? 'bg-red-50 text-red-600' : s.priority === 'medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-500'
                                    }`}>{PRIORITY_LABELS[s.priority] || s.priority}</span>
                                    <span className="text-gray-400">{CATEGORY_LABELS[s.type] || s.type}</span>
                                    {s.field && <span className="text-indigo-500">{s.field}</span>}
                                  </div>
                                  <div className="text-gray-700">{s.recommended || s.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Sentiment trajectory */}
                        {a.sentiment_trajectory?.length > 0 && (
                          <div>
                            <div className="text-[11px] text-gray-500 mb-1 font-medium">情绪轨迹</div>
                            <div className="flex flex-wrap gap-1">
                              {a.sentiment_trajectory.map((s, i) => {
                                const info = SENTIMENT_LABELS[s.sentiment] || SENTIMENT_LABELS.neutral
                                return (
                                  <div key={i} className={`text-[10px] px-2 py-1 rounded ${info.bg} ${info.color}`} title={s.reason}>
                                    T{s.turn}: {info.label}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400">会话ID: {a.session_id}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ===== METRICS ===== */}
        {subTab === 'metrics' && (
          <>
            <div className="flex justify-end">
              <button onClick={handleAggregate}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium">
                手动聚合今日数据
              </button>
            </div>
            {metrics.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">暂无学习指标数据，点击上方按钮聚合</div>
            ) : (
              <div className="space-y-3">
                {metrics.slice().reverse().map(m => (
                  <div key={m.metric_date} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm text-gray-700">{m.metric_date}</span>
                      <span className="text-[11px] text-gray-400">{m.total_conversations} 条对话</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{parseFloat(m.avg_completion_rate || 0).toFixed(0)}%</div>
                        <div className="text-[10px] text-gray-400">平均完成率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-indigo-600">{parseFloat(m.avg_collection_turns || 0).toFixed(1)}</div>
                        <div className="text-[10px] text-gray-400">平均收集轮数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{m.completion_count || 0}</div>
                        <div className="text-[10px] text-gray-400">完成数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-500">{m.drop_off_count || 0}</div>
                        <div className="text-[10px] text-gray-400">流失数</div>
                      </div>
                    </div>
                    {m.top_drop_off_fields?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <div className="text-[10px] text-gray-400 mb-1">流失热点</div>
                        <div className="flex flex-wrap gap-1">
                          {m.top_drop_off_fields.map((d, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded">{d.field} ({d.count})</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== CLUSTERS (知识聚合) ===== */}
        {subTab === 'clusters' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">🔬 知识聚合簇</span>
              <button onClick={async () => { showToast('正在聚合...'); try { await adminFetch('/api/admin/evolution/clusters/refresh', { method: 'POST' }); showToast('聚合完成'); fetchClusters() } catch(e) { showToast('失败') } }}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium">
                刷新聚合
              </button>
            </div>
            {clusterStats?.byType?.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {clusterStats.byType.map(t => (
                  <StatCard key={t.cluster_type} label={
                    { industry_pattern: '行业模式', violation_pattern: '违规模式', question_effectiveness: '问题效果', user_behavior: '用户行为', success_factor: '成功因子' }[t.cluster_type] || t.cluster_type
                  } value={t.cnt} sub={`置信度 ${parseFloat(t.avg_confidence || 0).toFixed(0)}%`} color="text-indigo-600" />
                ))}
              </div>
            )}
            {clusters.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">暂无知识簇，点击刷新聚合</div>
            ) : (
              <div className="space-y-2">
                {clusters.map(c => (
                  <div key={`${c.cluster_type}-${c.cluster_key}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        {{ industry_pattern: '行业', violation_pattern: '违规', question_effectiveness: '问题', user_behavior: '行为', success_factor: '成功因子' }[c.cluster_type] || c.cluster_type}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{c.cluster_name}</span>
                      <span className="ml-auto text-[11px] text-gray-400">{c.sample_count}样本 · 置信度{parseFloat(c.confidence).toFixed(0)}%</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {c.insight_data?.avgCompletion !== undefined && <div>平均完成率: <span className="font-medium text-blue-600">{c.insight_data.avgCompletion}%</span></div>}
                      {c.insight_data?.avgTurns !== undefined && <div>平均轮数: <span className="font-medium">{c.insight_data.avgTurns}</span></div>}
                      {c.insight_data?.positiveRate !== undefined && <div>积极率: <span className="font-medium text-green-600">{c.insight_data.positiveRate}%</span></div>}
                      {c.insight_data?.avgProfessionalism > 0 && <div>专业度: <span className="font-medium text-indigo-600">{c.insight_data.avgProfessionalism}</span></div>}
                      {c.insight_data?.avgAppealSuccess > 0 && <div>申诉率: <span className="font-medium text-amber-600">{c.insight_data.avgAppealSuccess}%</span></div>}
                      {c.insight_data?.avgSatisfaction > 0 && <div>满意度: <span className="font-medium text-pink-600">{c.insight_data.avgSatisfaction}</span></div>}
                      {c.insight_data?.topDropOffs?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.insight_data.topDropOffs.map((d, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded">{d.field || d.value} ({d.count})</span>
                          ))}
                        </div>
                      )}
                      {c.insight_data?.sentimentDistribution?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.insight_data.sentimentDistribution.map((s, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-600 rounded">{SENTIMENT_LABELS[s.value]?.label || s.value} ({s.count})</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== EXPERIMENTS (探索实验) ===== */}
        {subTab === 'experiments' && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm font-semibold text-gray-700">🧪 A/B 对比实验</span>
                <p className="text-[10px] text-gray-400 mt-0.5">AI自主探索高频建议 → 创建实验性规则 → 对比效果 → 自动判定</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={async () => {
                  showToast('正在评估规则效果...')
                  try { await adminFetch('/api/admin/evolution/evaluate', { method: 'POST' }); showToast('规则效果评估完成') } catch { showToast('评估失败') }
                }}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium">
                  评估规则
                </button>
                <button onClick={async () => {
                  showToast('正在自动升降级...')
                  try {
                    const r = await (await adminFetch('/api/admin/evolution/auto-promote', { method: 'POST' })).json()
                    showToast(`升级${r.promoted || 0}条, 归档${r.archived || 0}条`)
                  } catch { showToast('失败') }
                }}
                  className="px-3 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-medium">
                  自动升降级
                </button>
                <button onClick={async () => {
                  showToast('正在探索...')
                  try { await adminFetch('/api/admin/evolution/explore', { method: 'POST' }); showToast('探索周期完成'); fetchExperiments() } catch { showToast('失败') }
                }}
                  className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 font-medium">
                  手动探索
                </button>
              </div>
            </div>

            {/* Experiment summary stats */}
            {experiments.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <div className="text-lg font-bold text-blue-700">{experiments.filter(e => e.status === 'running').length}</div>
                  <div className="text-[10px] text-blue-500">运行中</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <div className="text-lg font-bold text-green-700">{experiments.filter(e => e.status === 'completed').length}</div>
                  <div className="text-[10px] text-green-500">已完成</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <div className="text-lg font-bold text-emerald-700">{experiments.filter(e => e.winner === 'a').length}</div>
                  <div className="text-[10px] text-emerald-500">实验组胜出</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <div className="text-lg font-bold text-gray-600">{experiments.reduce((s, e) => s + (e.sample_a || 0) + (e.sample_b || 0), 0)}</div>
                  <div className="text-[10px] text-gray-400">总样本数</div>
                </div>
              </div>
            )}

            {experiments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🧪</div>
                <div className="text-sm text-gray-500 mb-1">暂无探索实验</div>
                <div className="text-xs text-gray-400">系统每2小时自动从对话分析中发现高频建议，创建A/B实验</div>
                <div className="text-xs text-gray-400 mt-1">点击「手动探索」可立即触发一轮</div>
              </div>
            ) : (
              <div className="space-y-3">
                {experiments.map(exp => {
                  const aComp = exp.result_a?.avgCompletion || 0
                  const bComp = exp.result_b?.avgCompletion || 0
                  const aSat = exp.result_a?.avgSatisfaction || 0
                  const bSat = exp.result_b?.avgSatisfaction || 0
                  const maxComp = Math.max(aComp, bComp, 1)
                  const diff = aComp - bComp

                  return (
                    <div key={exp.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                      exp.status === 'running' ? 'border-blue-200' :
                      exp.winner === 'a' ? 'border-green-200' :
                      exp.winner === 'b' ? 'border-orange-200' : 'border-gray-100'
                    }`}>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            exp.status === 'running' ? 'bg-blue-100 text-blue-700 ' :
                            exp.status === 'completed' ? 'bg-green-100 text-green-700' :
                            exp.status === 'aborted' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                          }`}>{exp.status === 'running' ? '● 运行中' : exp.status === 'completed' ? '✓ 已完成' : exp.status === 'aborted' ? '⊘ 已终止' : '✗ 失败'}</span>
                          <span className="text-sm font-semibold text-gray-800">{exp.experiment_name}</span>
                          {exp.winner && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            exp.winner === 'a' ? 'bg-green-50 text-green-600 border border-green-200' :
                            exp.winner === 'b' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                            'bg-gray-50 text-gray-500 border border-gray-200'
                          }`}>
                            {exp.winner === 'a' ? '🏆 实验组胜出' : exp.winner === 'b' ? '基准组胜出' : '不确定'}
                          </span>}
                          <span className="ml-auto text-[10px] text-gray-400">{timeAgo(exp.started_at)}</span>
                        </div>
                        {exp.hypothesis && <div className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">💡 {exp.hypothesis}</div>}

                        {/* A/B comparison bars */}
                        <div className="space-y-2.5">
                          {/* Completion rate comparison */}
                          <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>完成率对比</span>
                              {diff !== 0 && (exp.sample_a > 0 || exp.sample_b > 0) && (
                                <span className={diff > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-blue-500 w-6 font-medium">A</span>
                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all flex items-center justify-end pr-1"
                                    style={{ width: `${maxComp > 0 ? (aComp / maxComp * 100) : 0}%`, minWidth: aComp > 0 ? '20px' : '0' }}>
                                    {aComp > 10 && <span className="text-[8px] text-white font-bold">{aComp.toFixed(0)}%</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-500 w-16 text-right">{exp.sample_a || 0} 样本</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-gray-500 w-6 font-medium">B</span>
                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-gray-400 rounded-full transition-all flex items-center justify-end pr-1"
                                    style={{ width: `${maxComp > 0 ? (bComp / maxComp * 100) : 0}%`, minWidth: bComp > 0 ? '20px' : '0' }}>
                                    {bComp > 10 && <span className="text-[8px] text-white font-bold">{bComp.toFixed(0)}%</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-500 w-16 text-right">{exp.sample_b || 0} 样本</span>
                              </div>
                            </div>
                          </div>

                          {/* Satisfaction comparison */}
                          {(aSat > 0 || bSat > 0) && (
                            <div>
                              <div className="text-[10px] text-gray-400 mb-1">满意度对比</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-blue-50/50 rounded-lg px-2.5 py-1.5 text-center border border-blue-100/50">
                                  <div className="text-xs font-bold text-blue-600">{aSat.toFixed(0)}%</div>
                                  <div className="text-[9px] text-blue-400">实验组</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg px-2.5 py-1.5 text-center border border-gray-100">
                                  <div className="text-xs font-bold text-gray-600">{bSat.toFixed(0)}%</div>
                                  <div className="text-[9px] text-gray-400">基准组</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Progress to auto-judge */}
                          {exp.status === 'running' && (
                            <div>
                              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>自动判定进度 (需要A,B各≥10样本)</span>
                                <span>{Math.min(exp.sample_a || 0, 10) + Math.min(exp.sample_b || 0, 10)}/20</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (Math.min(exp.sample_a || 0, 10) + Math.min(exp.sample_b || 0, 10)) / 20 * 100)}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rule link + actions */}
                      {exp.rule_id && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">关联规则 #{exp.rule_id}</span>
                          {exp.status === 'running' && (
                            <button onClick={async () => {
                              if (!confirm('确认终止此实验？')) return
                              try {
                                await adminFetch(`/api/admin/evolution/experiments/${exp.id}/abort`, { method: 'POST' })
                                showToast('实验已终止')
                                fetchExperiments()
                              } catch { showToast('操作失败') }
                            }} className="text-[10px] text-red-500 hover:text-red-700">终止实验</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ===== HEALTH (引擎健康) ===== */}
        {subTab === 'health' && (
          <>
            {/* Overall status */}
            {engineHealth && (
              <div className={`rounded-xl border p-4 shadow-sm ${
                engineHealth.overall === 'healthy' ? 'bg-green-50 border-green-200' :
                engineHealth.overall === 'degraded' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{engineHealth.overall === 'healthy' ? '💚' : engineHealth.overall === 'degraded' ? '💛' : '🔴'}</span>
                  <div>
                    <div className="text-sm font-semibold">{engineHealth.overall === 'healthy' ? '引擎运行正常' : engineHealth.overall === 'degraded' ? '部分组件降级' : '存在熔断组件'}</div>
                    <div className="text-[11px] text-gray-500">{engineHealth.components?.length || 0} 个组件, {engineHealth.unhealthyCount || 0} 个异常</div>
                  </div>
                </div>
              </div>
            )}

            {/* Component list */}
            {engineHealth?.components?.length > 0 && (
              <div className="space-y-2">
                {engineHealth.components.map(c => (
                  <div key={c.component} className={`bg-white rounded-xl border shadow-sm p-4 ${
                    c.status === 'circuit_open' ? 'border-red-200' : c.status === 'degraded' ? 'border-yellow-200' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${
                        c.status === 'healthy' ? 'bg-green-500' : c.status === 'recovering' ? 'bg-blue-500' :
                        c.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-800">{COMPONENT_LABELS[c.component] || c.component}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                        c.status === 'healthy' ? 'bg-green-100 text-green-700' :
                        c.status === 'recovering' ? 'bg-blue-100 text-blue-700' :
                        c.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                      }`}>{HEALTH_STATUS_LABELS[c.status] || c.status}</span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        成功{c.success_count} / 失败{c.error_count}
                      </span>
                    </div>
                    {c.last_error && <div className="text-[11px] text-red-500 mt-1 truncate">最后错误: {c.last_error}</div>}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {c.last_success_at && <span>上次成功: {timeAgo(c.last_success_at)}</span>}
                      {c.last_error_at && <span className="ml-3">上次失败: {timeAgo(c.last_error_at)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tag Stats */}
            {tagStats && tagStats.total > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">🏷️ 对话标签统计 ({tagStats.total} 条已标记)</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {tagStats.byDifficulty?.map(d => (
                    <div key={d.difficulty} className="text-center bg-gray-50 rounded-lg p-2">
                      <div className="text-sm font-bold text-gray-700">{d.cnt}</div>
                      <div className="text-[10px] text-gray-400">{
                        { easy: '简单', medium: '中等', hard: '困难', extreme: '极难' }[d.difficulty] || d.difficulty
                      }</div>
                    </div>
                  ))}
                </div>
                {tagStats.byOutcome?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tagStats.byOutcome.map(o => (
                      <div key={o.outcome} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        o.outcome === 'completed' ? 'bg-green-50 text-green-600' :
                        o.outcome === 'abandoned' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-600'
                      }`}>{
                        { completed: '完成', abandoned: '放弃', partial: '部分', redirected: '转接' }[o.outcome] || o.outcome
                      }: {o.cnt}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== CHANGELOG ===== */}
        {subTab === 'changelog' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            {changelog.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">暂无变更记录</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {changelog.map(cl => (
                  <div key={cl.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        cl.action === 'activated' ? 'bg-green-100 text-green-700' :
                        cl.action === 'created' ? 'bg-blue-100 text-blue-700' :
                        cl.action === 'rejected' ? 'bg-red-100 text-red-600' :
                        cl.action === 'archived' ? 'bg-gray-100 text-gray-500' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{ACTION_LABELS[cl.action] || cl.action}</span>
                      <span className="text-xs text-gray-600 font-medium">{cl.rule_name || cl.rule_key || `#${cl.rule_id}`}</span>
                      {cl.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">{CATEGORY_LABELS[cl.category] || cl.category}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{cl.changed_by} · {timeAgo(cl.created_at)}</span>
                    </div>
                    {cl.reason && <div className="text-xs text-gray-500">{cl.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
