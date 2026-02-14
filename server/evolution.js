/**
 * AI 自进化引擎 (Evolution Engine) V3
 * 
 * 核心模块：
 * 1. 对话分析器 — 异步分析对话质量/效率/情绪
 * 2. 规则生成器 — 从分析结果自动提炼规则
 * 3. 动态规则加载器 — 从DB加载活跃规则注入System Prompt（带缓存）
 * 4. 规则效果评估 + 自动升降级
 * 5. AI自动打标系统 — 分类/难度/用户类型/模式标签
 * 6. 能力与数据聚合 — 跨对话模式聚合/行业知识簇/问题效果评分
 * 7. 自主探索模式 — AI实验性规则A/B测试
 * 8. 熔断器+容错 — 组件级健康监控/自动熔断/优雅回退
 * 9. 定时任务 — 30分钟分析 / 2小时升降级 / 每日聚合+聚类
 */

import { getSystemConfig, getActiveAIModel } from './db.js'

// 内联 AI provider 配置（避免与 ai.js 循环依赖）
async function getAIConfig() {
  const active = await getActiveAIModel()
  if (active) return { provider: active.provider, apiKey: active.api_key, model: active.model_name, endpoint: active.endpoint }
  // 回退
  const provider = (await getSystemConfig('ai_provider')) || 'deepseek'
  if (provider === 'zhipu') return { provider, apiKey: await getSystemConfig('zhipu_api_key'), model: (await getSystemConfig('zhipu_model')) || 'glm-4.7-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' }
  return { provider, apiKey: await getSystemConfig('deepseek_api_key'), model: (await getSystemConfig('deepseek_model')) || 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions' }
}
import {
  saveConversationAnalysis, getUnanalyzedSessions, getActiveRules, getAllAIRules, getAIRuleById,
  createAIRule, updateRuleEffectiveness, incrementRuleUsage,
  upsertLearningMetrics, getConversationAnalyses, getAnalysisStats,
  getMessages, getSession, updateAIRuleStatus, recordTokenUsage,
  upsertConversationTags, getTagStats,
  upsertKnowledgeCluster, getKnowledgeClusters,
  incrementEngineError, recordEngineSuccess, getEngineHealth,
  createExperiment, updateExperiment, getExperiments,
} from './db.js'

// ========== 缓存 & 去重 ==========

/** 规则缓存：避免每次对话都查DB */
let _rulesCache = { data: null, prompt: '', ruleIds: [], ts: 0 }
const RULES_CACHE_TTL = 3 * 60 * 1000 // 3分钟缓存

/** 分析去重：防止同一session被重复分析 */
const _analyzingSet = new Set()
const _recentlyAnalyzed = new Map() // sessionId → timestamp
const ANALYSIS_COOLDOWN = 10 * 60 * 1000 // 同一session 10分钟内不重复分析

/** 每小时分析配额：防止API费用失控 */
let _analysisQuota = { count: 0, resetAt: 0 }
const MAX_ANALYSES_PER_HOUR = 30

function checkAnalysisQuota() {
  const now = Date.now()
  if (now > _analysisQuota.resetAt) {
    _analysisQuota = { count: 0, resetAt: now + 60 * 60 * 1000 }
  }
  if (_analysisQuota.count >= MAX_ANALYSES_PER_HOUR) return false
  _analysisQuota.count++
  return true
}

export function invalidateRulesCache() {
  _rulesCache = { data: null, prompt: '', ruleIds: [], ts: 0 }
}

// ========== 1. 对话分析器 ==========

/**
 * 分析单次对话：调用 AI 对完整对话进行质量评估
 * @param {string} sessionId - 会话ID
 * @returns {object|null} 分析结果
 */
export async function analyzeConversation(sessionId) {
  try {
    // 去重：正在分析中的session跳过
    if (_analyzingSet.has(sessionId)) {
      console.log(`[Evolution] 跳过: ${sessionId} 正在分析中`)
      return null
    }
    // 冷却期：最近分析过的session跳过
    const lastAnalyzed = _recentlyAnalyzed.get(sessionId)
    if (lastAnalyzed && Date.now() - lastAnalyzed < ANALYSIS_COOLDOWN) {
      console.log(`[Evolution] 跳过: ${sessionId} 冷却期内`)
      return null
    }
    // 配额检查
    if (!checkAnalysisQuota()) {
      console.log(`[Evolution] 跳过: 已达每小时分析上限(${MAX_ANALYSES_PER_HOUR})`)
      return null
    }

    _analyzingSet.add(sessionId)

    const session = await getSession(sessionId)
    if (!session) { _analyzingSet.delete(sessionId); return null }

    const messages = await getMessages(sessionId)
    if (!messages || messages.length < 3) { _analyzingSet.delete(sessionId); return null }

    const collectedData = session.collected_data || {}
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')

    // 基础指标计算（不需要AI）
    const basicMetrics = computeBasicMetrics(messages, collectedData)

    // 调用 AI 进行深度分析
    const aiAnalysis = await callAIForAnalysis(messages, collectedData, basicMetrics)

    // 捕获当前活跃规则ID（用于后续按规则归因效果评估）
    const currentActiveRuleIds = getActiveRuleIds()

    // AI驱动：AI可用时100%使用AI评分，不与基础指标平均
    const hasAI = aiAnalysis && aiAnalysis.professionalismScore != null
    const analysis = {
      sessionId,
      userId: session.user_id,
      industry: collectedData.industry || '',
      problemType: collectedData.problem_type || '',
      totalTurns: userMessages.length,
      collectionTurns: basicMetrics.collectionTurns,
      fieldsCollected: basicMetrics.fieldsCollected,
      fieldsSkipped: basicMetrics.fieldsSkipped,
      fieldsRefused: aiAnalysis?.fieldsRefused || basicMetrics.fieldsRefused,
      completionRate: basicMetrics.completionRate,
      // 全AI驱动评分：AI可用→用AI分数，AI不可用→基于完成率的事实估算
      professionalismScore: hasAI ? aiAnalysis.professionalismScore : Math.round(basicMetrics.completionRate * 0.6 + (basicMetrics.responseStats.avgLength > 100 ? 20 : 10)),
      appealSuccessRate: hasAI ? aiAnalysis.appealSuccessRate : Math.round(basicMetrics.completionRate * 0.8),
      userSatisfaction: hasAI ? aiAnalysis.userSatisfaction : Math.round(basicMetrics.completionRate * 0.5 + (basicMetrics.isCollectionDone ? 20 : 0)),
      responseQuality: aiAnalysis?.responseQuality || basicMetrics.responseStats,
      userSentiment: aiAnalysis?.userSentiment || 'neutral',
      dropOffPoint: aiAnalysis?.dropOffPoint || '',
      collectionEfficiency: {
        ...basicMetrics.efficiency,
        ...(aiAnalysis?.efficiency || {}),
      },
      sentimentTrajectory: aiAnalysis?.sentimentTrajectory || [],
      suggestions: aiAnalysis?.suggestions || [],
      ruleProposals: aiAnalysis?.ruleProposals || [],
      rawAnalysis: aiAnalysis?.rawText || '',
      activeRuleIds: currentActiveRuleIds,
      analysisSource: hasAI ? 'ai' : 'basic_only', // 标记分析来源
    }

    // 存储分析结果
    const id = await saveConversationAnalysis(analysis)
    _analyzingSet.delete(sessionId)
    _recentlyAnalyzed.set(sessionId, Date.now())

    // V3: 自动打标
    const tagResult = await autoTagConversation(sessionId, { id, ...analysis }).catch(() => null)
    if (tagResult) analysis._tags = tagResult

    // V4: 即时规则反馈——分析完成后立即更新参与规则的效果分
    if (currentActiveRuleIds.length > 0) {
      updateRuleScoresFromAnalysis(currentActiveRuleIds, analysis).catch(err =>
        console.error('[Evolution] 规则即时反馈失败:', err.message)
      )
    }

    console.log(`[Evolution] 对话分析完成: session=${sessionId}, id=${id}, 来源=${analysis.analysisSource}, 完成率=${basicMetrics.completionRate}%, 专业度=${analysis.professionalismScore}, 标签=${tagResult?.tags?.length || 0}, 规则=${currentActiveRuleIds.length}`)
    return { id, ...analysis }
  } catch (err) {
    _analyzingSet.delete(sessionId)
    console.error(`[Evolution] 对话分析失败: session=${sessionId}`, err.message)
    return null
  }
}

/**
 * 收集客观事实数据（纯数据提取，不做任何主观评分——评分全交给AI）
 */
function computeBasicMetrics(messages, collectedData) {
  const ALL_FIELDS = [
    'industry', 'problem_type', 'violation_reason', 'merchant_id', 'merchant_name',
    'company_name', 'license_no', 'legal_name', 'legal_id_last4', 'business_model',
    'complaint_status', 'refund_policy', 'bank_name', 'bank_account_last4',
    'contact_phone', 'appeal_history',
  ]

  const filled = ALL_FIELDS.filter(k => {
    const v = collectedData[k]
    return v != null && String(v).trim() !== '' && String(v) !== '用户暂未提供' && String(v) !== '⏳待补充'
  })

  const userMsgs = messages.filter(m => m.role === 'user')
  const asstMsgs = messages.filter(m => m.role === 'assistant')
  const totalTurns = userMsgs.length

  const isCollectionDone = collectedData._collection_complete === true || collectedData._collection_complete === 'true'
  const collectionTurns = isCollectionDone ? Math.max(1, totalTurns - 2) : totalTurns

  // 跳过字段（客观事实）
  const skippedFields = ALL_FIELDS.filter(k => collectedData[k] === '用户暂未提供' || collectedData[k] === '⏳待补充')

  // 完成率（纯数学，不含主观判断）
  const completionRate = Math.round((filled.length / ALL_FIELDS.length) * 100)

  // AI回复的客观统计数据（仅统计量，不做评分）
  const totalAsstLen = asstMsgs.reduce((s, m) => s + (m.content?.length || 0), 0)
  const responseStats = {
    totalReplies: asstMsgs.length,
    avgLength: asstMsgs.length > 0 ? Math.round(totalAsstLen / asstMsgs.length) : 0,
    totalUserMessages: userMsgs.length,
    avgUserMsgLength: userMsgs.length > 0 ? Math.round(userMsgs.reduce((s, m) => s + (m.content?.length || 0), 0) / userMsgs.length) : 0,
  }

  return {
    fieldsCollected: filled.length,
    fieldsSkipped: skippedFields.length,
    fieldsRefused: 0, // 由AI判断哪些是拒绝
    completionRate,
    collectionTurns,
    isCollectionDone,
    responseStats,
    efficiency: {
      turnsPerField: filled.length > 0 ? Math.round((collectionTurns / filled.length) * 10) / 10 : 0,
      fieldsPerTurn: totalTurns > 0 ? Math.round((filled.length / totalTurns) * 10) / 10 : 0,
      filledFields: filled,
      skippedFields: skippedFields.map(k => k),
    },
  }
}

/**
 * 调用 AI 对对话进行深度分析
 */
async function callAIForAnalysis(messages, collectedData, basicMetrics) {
  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    console.log('[Evolution] 无API Key，跳过AI深度分析')
    return null
  }

  // 构建对话摘要（避免发送完整对话浪费token）
  const userMsgs = messages.filter(m => m.role === 'user')
  const asstMsgs = messages.filter(m => m.role === 'assistant')
  const conversationSummary = userMsgs.slice(0, 20).map((m, i) => {
    const reply = asstMsgs[i]?.content?.slice(0, 200) || ''
    return `用户[${i + 1}]: ${m.content.slice(0, 300)}\nAI[${i + 1}]: ${reply}...`
  }).join('\n---\n')

  // 获取当前活跃规则摘要，让AI评估规则是否起了作用
  const activeRulesSummary = (_rulesCache.data || []).slice(0, 10).map(r =>
    `[${r.category}] ${r.rule_name}`
  ).join(', ') || '暂无活跃规则'

  const analysisPrompt = `你是资深对话质量分析AI。你是唯一的评分来源，系统不会做任何预评分，所有主观评价完全由你决定。

## 你的职责
分析商户申诉咨询对话，对AI助手的表现进行全方位评估和评分。

## 对话客观数据
- 总轮数：${basicMetrics.collectionTurns}
- 已收集字段：${basicMetrics.fieldsCollected}/16
- 数据完成率：${basicMetrics.completionRate}%
- 已收集字段：${basicMetrics.efficiency.filledFields.join(', ') || '无'}
- 跳过/待补充：${basicMetrics.efficiency.skippedFields.join(', ') || '无'}
- AI平均回复长度：${basicMetrics.responseStats.avgLength}字
- 用户平均消息长度：${basicMetrics.responseStats.avgUserMsgLength}字
- 收集是否完成：${basicMetrics.isCollectionDone ? '是' : '否'}
- 当前活跃AI规则：${activeRulesSummary}

## 对话内容
${conversationSummary}

## 输出JSON格式（严格遵守，所有评分由你独立判断）
{
  "userSentiment": "positive|slightly_positive|neutral|slightly_negative|negative",
  "professionalismScore": "(0-100) AI助手专业度评分。评估维度：回复结构化程度、行业知识运用、是否给出可操作建议、是否有共情表达、语言是否专业得体、是否高效引导对话",
  "appealSuccessRate": "(0-100) 基于已收集信息评估申诉成功概率。考虑：关键信息完整性、行业特点、违规类型严重程度、证据充分性",
  "userSatisfaction": "(0-100) 用户满意度评估。基于：用户的语气变化、配合程度、是否表达不满、是否主动提供信息、对话是否顺畅完成",
  "fieldsRefused": "(数字) 用户明确拒绝或表示不知道/不方便提供的字段数量",
  "responseQuality": {
    "structureScore": "(0-100) 回复结构化程度",
    "empathyScore": "(0-100) 共情能力",
    "actionabilityScore": "(0-100) 建议可操作性",
    "industryKnowledge": "(0-100) 行业知识运用",
    "efficiency": "(0-100) 对话效率(少轮多收集)",
    "summary": "一句话总结AI回复质量"
  },
  "sentimentTrajectory": [
    {"turn": 1, "sentiment": "neutral", "reason": "初始咨询"}
  ],
  "dropOffPoint": "字段名或空字符串（用户在哪个环节失去耐心/放弃）",
  "efficiency": {
    "smoothTransitions": true,
    "redundantQuestions": 0,
    "missedMultiFieldInputs": 0,
    "bestMoment": "AI表现最好的时刻描述",
    "worstMoment": "AI表现最差的时刻描述（没有则空字符串）"
  },
  "suggestions": [
    {
      "type": "collection_strategy|question_template|conversation_pattern|diagnosis_rule|empathy|efficiency",
      "priority": "high|medium|low",
      "field": "相关字段名或空",
      "current": "当前做法",
      "recommended": "建议改进",
      "reason": "原因",
      "expectedImpact": "预期效果"
    }
  ],
  "ruleProposals": [
    {
      "category": "collection_strategy|question_template|industry_knowledge|violation_strategy|conversation_pattern|diagnosis_rule",
      "ruleKey": "唯一标识",
      "ruleName": "规则名称",
      "content": {"description": "规则描述", "condition": "触发条件", "action": "执行动作"}
    }
  ]
}

## 评分要求
- 你是唯一评分者，请独立、严格、客观地评分
- professionalismScore：50分为及格线，80+为优秀
- suggestions：至少2-5条可执行建议，每条必须具体到可落地
- ruleProposals：发现可复用模式时提出1-3条规则
- 重点关注：提问效率、重复追问、情绪管理、行业适配性、信息遗漏
- 只输出JSON`

  try {
    const analysisBody = {
      model: cfg.model,
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }
    analysisBody.response_format = { type: 'json_object' }

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(analysisBody),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[Evolution] ${cfg.provider} API ${response.status}`)
      return null
    }

    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content || ''
    const usage = data.usage || {}
    // 记录系统级token消耗
    try {
      await recordTokenUsage({ userId: 0, sessionId: null, type: 'evolution_analysis', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0, cost: 0, multiplier: 1, apiMode: 'system' })
    } catch {}

    try {
      const parsed = JSON.parse(rawText)
      return {
        userSentiment: parsed.userSentiment || 'neutral',
        professionalismScore: typeof parsed.professionalismScore === 'number' ? parsed.professionalismScore : null,
        appealSuccessRate: typeof parsed.appealSuccessRate === 'number' ? parsed.appealSuccessRate : null,
        userSatisfaction: typeof parsed.userSatisfaction === 'number' ? parsed.userSatisfaction : null,
        fieldsRefused: typeof parsed.fieldsRefused === 'number' ? parsed.fieldsRefused : 0,
        responseQuality: parsed.responseQuality || {},
        sentimentTrajectory: parsed.sentimentTrajectory || [],
        dropOffPoint: parsed.dropOffPoint || '',
        efficiency: parsed.efficiency || {},
        suggestions: parsed.suggestions || [],
        ruleProposals: parsed.ruleProposals || [],
        rawText,
      }
    } catch {
      console.error('[Evolution] AI分析结果JSON解析失败')
      return { rawText }
    }
  } catch (err) {
    console.error('[Evolution] AI分析调用失败:', err.message)
    return null
  }
}

// ========== 2. 规则生成器 ==========

/**
 * 从对话分析中提取并创建规则提案
 * @param {object} analysis - analyzeConversation 的返回结果
 */
export async function generateRulesFromAnalysis(analysis) {
  if (!analysis?.suggestions?.length && !analysis?.ruleProposals?.length && !analysis?.rawAnalysis) return []

  const created = []

  // 优先使用已解析的 ruleProposals，回退到从 rawAnalysis 中解析
  let proposals = analysis.ruleProposals || []
  if (proposals.length === 0 && analysis.rawAnalysis) {
    try {
      const raw = JSON.parse(analysis.rawAnalysis)
      proposals = raw.ruleProposals || []
    } catch { /* ignore */ }
  }

  for (const proposal of proposals) {
    if (!proposal.category || !proposal.ruleKey) continue
    try {
      const result = await createAIRule({
        category: proposal.category,
        ruleKey: proposal.ruleKey,
        ruleName: proposal.ruleName || proposal.ruleKey,
        ruleContent: proposal.content || {},
        source: 'ai_generated',
        status: 'pending_review',
      })
      created.push(result)
      console.log(`[Evolution] 规则提案创建: ${proposal.ruleKey} v${result.version}`)
    } catch (err) {
      // 重复key+version会报unique constraint error，忽略
      if (!err.message?.includes('Duplicate')) {
        console.error(`[Evolution] 规则创建失败: ${proposal.ruleKey}`, err.message)
      }
    }
  }

  // 从 suggestions 中也提取高优先级的作为规则
  for (const sug of (analysis.suggestions || [])) {
    if (sug.priority !== 'high' || !sug.type) continue
    const ruleKey = `sug_${sug.type}_${sug.field || 'general'}_${Date.now()}`
    try {
      const result = await createAIRule({
        category: sug.type,
        ruleKey,
        ruleName: sug.recommended?.slice(0, 100) || sug.reason?.slice(0, 100) || ruleKey,
        ruleContent: {
          description: sug.recommended,
          reason: sug.reason,
          current: sug.current,
          field: sug.field,
          expectedImpact: sug.expectedImpact,
          sourceSession: analysis.sessionId,
        },
        source: 'ai_generated',
        status: 'pending_review',
      })
      created.push(result)
    } catch { /* ignore duplicates */ }
  }

  // 对新创建的规则进行AI自动审批
  for (const rule of created) {
    if (rule.id) {
      autoReviewRule(rule.id).catch(err => console.error(`[AutoReview] 规则#${rule.id}自动审批失败:`, err.message))
    }
  }

  return created
}

/**
 * AI自动审批规则：调用AI评估规则质量、合法性、对商户的帮助程度
 * 自动通过高质量规则，拒绝低质量/有害规则，记录详细审批原因
 * @param {number} ruleId - 规则ID
 * @returns {object} { decision, score, reason }
 */
export async function autoReviewRule(ruleId) {
  const cfg = await getAIConfig()
  if (!cfg.apiKey) {
    console.log(`[AutoReview] 无API Key，规则#${ruleId}保持待审批`)
    return { decision: 'pending', score: 0, reason: '无API Key，需人工审批' }
  }

  const rule = await getAIRuleById(ruleId)
  if (!rule || rule.status !== 'pending_review') {
    return { decision: 'skip', score: 0, reason: '规则不存在或已审批' }
  }

  const reviewPrompt = `你是一个AI规则审批专家。我们的系统是帮助商户进行申诉咨询的智能助手。
请评估以下AI自动生成的规则是否应该被采纳。

## 规则信息
- 类型: ${rule.category}
- 标识: ${rule.rule_key}
- 名称: ${rule.rule_name}
- 内容: ${JSON.stringify(rule.rule_content, null, 2)}
- 来源: ${rule.source}

## 评估维度
1. **合法合规性** (0-100): 规则是否合法合规，不涉及欺诈、虚假申诉等违法行为
2. **商户帮助度** (0-100): 规则是否真正帮助商户解决问题，而非教唆逃避责任
3. **专业性** (0-100): 规则内容是否专业、准确、可执行
4. **通用性** (0-100): 规则是否具有普适性，能服务多个商户场景

## 输出JSON格式
{
  "legalScore": 0-100,
  "helpfulnessScore": 0-100,
  "professionalScore": 0-100,
  "generalityScore": 0-100,
  "overallScore": 0-100,
  "decision": "approve|reject|need_review",
  "reason": "审批决定的详细原因（中文）",
  "improvementSuggestion": "如果拒绝或需审查，给出改进建议（中文）"
}

## 审批标准
- 综合评分≥70 且 合法性≥80 → approve (通过)
- 合法性<60 或 综合评分<40 → reject (拒绝)
- 其他情况 → need_review (需人工审查)
- 任何涉及虚假材料、伪造证据、规避监管的规则必须reject

只输出JSON，不要其他内容。`

  try {
    const reviewBody = {
      model: cfg.model,
      messages: [{ role: 'user', content: reviewPrompt }],
      temperature: 0.2,
      max_tokens: 1000,
    }
    reviewBody.response_format = { type: 'json_object' }

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(reviewBody),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[AutoReview] ${cfg.provider} API ${response.status}`)
      return { decision: 'pending', score: 0, reason: 'AI审批接口异常，需人工审批' }
    }

    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content || ''
    const usage = data.usage || {}
    try {
      await recordTokenUsage({ userId: 0, sessionId: null, type: 'auto_review', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0, cost: 0, multiplier: 1, apiMode: 'system' })
    } catch {}
    let parsed
    try { parsed = JSON.parse(rawText) } catch {
      console.error(`[AutoReview] 规则#${ruleId} AI返回非法JSON，保持待审批`)
      return { decision: 'pending', score: 0, reason: 'AI返回格式异常，需人工审批' }
    }

    const decision = parsed.decision || 'need_review'
    const overallScore = parsed.overallScore || 0
    const reason = parsed.reason || '无'
    const legalScore = parsed.legalScore || 0

    // 执行审批决定
    if (decision === 'approve' && legalScore >= 80 && overallScore >= 70) {
      await updateAIRuleStatus(ruleId, 'active',
        `AI自动通过(评分${overallScore}): ${reason}`, 'ai_reviewer')
      invalidateRulesCache()
      console.log(`[AutoReview] 规则#${ruleId} 自动通过 (评分${overallScore}, 合法${legalScore})`)
    } else if (decision === 'reject' || legalScore < 60 || overallScore < 40) {
      await updateAIRuleStatus(ruleId, 'rejected',
        `AI自动拒绝(评分${overallScore},合法${legalScore}): ${reason}${parsed.improvementSuggestion ? ' | 建议:' + parsed.improvementSuggestion : ''}`, 'ai_reviewer')
      console.log(`[AutoReview] 规则#${ruleId} 自动拒绝 (评分${overallScore}, 合法${legalScore})`)
    } else {
      // need_review - 保持待审批但记录AI评语
      await updateAIRuleStatus(ruleId, 'pending_review',
        `AI建议人工审查(评分${overallScore}): ${reason}`, 'ai_reviewer')
      console.log(`[AutoReview] 规则#${ruleId} 需人工审查 (评分${overallScore})`)
    }

    await recordEngineSuccess('auto_review')
    return { decision, score: overallScore, reason }
  } catch (err) {
    await incrementEngineError('auto_review', err.message)
    console.error(`[AutoReview] 规则#${ruleId}审批失败:`, err.message)
    return { decision: 'pending', score: 0, reason: '审批出错: ' + err.message }
  }
}

/**
 * 批量AI审批所有待审批规则
 * @returns {object} { reviewed, approved, rejected, needReview }
 */
export async function batchAutoReviewRules() {
  const allRules = await getAllAIRules()
  const pending = allRules.filter(r => r.status === 'pending_review')
  console.log(`[AutoReview] 发现 ${pending.length} 条待审批规则`)

  let approved = 0, rejected = 0, needReview = 0
  for (const rule of pending) {
    const result = await autoReviewRule(rule.id)
    if (result.decision === 'approve') approved++
    else if (result.decision === 'reject') rejected++
    else needReview++
    // 避免API限流
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`[AutoReview] 批量审批完成: 通过${approved}, 拒绝${rejected}, 需审查${needReview}`)
  return { reviewed: pending.length, approved, rejected, needReview }
}

// ========== 3. 动态规则加载器 ==========

/**
 * 加载所有活跃规则，格式化为可注入 System Prompt 的文本
 * 带3分钟内存缓存，避免高频DB查询
 * @returns {string} 格式化的规则文本
 */
export async function loadActiveRulesForPrompt() {
  // 缓存命中
  if (_rulesCache.data && (Date.now() - _rulesCache.ts) < RULES_CACHE_TTL) {
    // 异步批量更新使用次数（不阻塞）
    for (const id of _rulesCache.ruleIds) incrementRuleUsage(id).catch(() => {})
    return _rulesCache.prompt
  }

  const rules = await getActiveRules()
  if (rules.length === 0) {
    _rulesCache = { data: [], prompt: '', ruleIds: [], ts: Date.now() }
    return ''
  }

  const SECTION_CONFIG = {
    collection_strategy: '收集策略优化',
    question_template: '提问话术优化',
    industry_knowledge: '行业知识补充',
    violation_strategy: '违规应对策略',
    conversation_pattern: '对话模式优化',
    diagnosis_rule: '诊断规则',
  }

  const sections = {}
  const ruleIds = []
  for (const [key] of Object.entries(SECTION_CONFIG)) sections[key] = []

  for (const rule of rules) {
    if (sections[rule.category]) {
      sections[rule.category].push(rule)
      ruleIds.push(rule.id)
    }
  }

  let prompt = '\n\n## 🧠 AI自学习规则库（基于历史对话优化）\n'
  for (const [key, label] of Object.entries(SECTION_CONFIG)) {
    if (sections[key].length === 0) continue
    prompt += `\n### ${label}\n`
    for (const r of sections[key]) {
      const c = r.rule_content
      const desc = c.description || c.action || c.template || (typeof c === 'string' ? c : JSON.stringify(c))
      prompt += `- **${r.rule_name}**: ${desc}\n`
    }
  }

  // 异步批量更新使用次数
  for (const id of ruleIds) incrementRuleUsage(id).catch(() => {})

  // 写入缓存
  _rulesCache = { data: rules, prompt, ruleIds, ts: Date.now() }
  return prompt
}

/**
 * 获取当前活跃规则的ID列表（用于对话级追踪）
 */
export function getActiveRuleIds() {
  return _rulesCache.ruleIds || []
}

// ========== 4. 规则自动效果评估 + 升降级 ==========

/**
 * 评估活跃规则的效果：基于最近对话分析结果更新 effectiveness_score
 * 逻辑：
 * - 分析最近N条对话的平均完成率和情绪
 * - 对比规则激活前后的指标变化
 * - 自动更新规则评分
 */
export async function evaluateRuleEffectiveness() {
  const activeRules = await getActiveRules()
  if (activeRules.length === 0) return

  // 获取最近分析数据（含active_rule_ids归因信息）
  const recentAnalyses = await getConversationAnalyses(200, {})
  if (recentAnalyses.length < 5) return // 数据太少不评估

  // 全局基准线（无规则时的表现）
  const noRuleAnalyses = recentAnalyses.filter(a => !a.active_rule_ids?.length)
  const baseline = noRuleAnalyses.length >= 3 ? {
    completion: noRuleAnalyses.reduce((s, a) => s + parseFloat(a.completion_rate), 0) / noRuleAnalyses.length,
    satisfaction: noRuleAnalyses.reduce((s, a) => s + parseFloat(a.user_satisfaction || 0), 0) / noRuleAnalyses.length,
    turns: noRuleAnalyses.reduce((s, a) => s + a.total_turns, 0) / noRuleAnalyses.length,
  } : {
    completion: recentAnalyses.reduce((s, a) => s + parseFloat(a.completion_rate), 0) / recentAnalyses.length,
    satisfaction: recentAnalyses.reduce((s, a) => s + parseFloat(a.user_satisfaction || 0), 0) / recentAnalyses.length,
    turns: recentAnalyses.reduce((s, a) => s + a.total_turns, 0) / recentAnalyses.length,
  }

  let updated = 0
  for (const rule of activeRules) {
    // 找出该规则参与的对话分析
    const ruleAnalyses = recentAnalyses.filter(a =>
      Array.isArray(a.active_rule_ids) && a.active_rule_ids.includes(rule.id)
    )

    let score
    if (ruleAnalyses.length >= 3) {
      // 有足够数据：基于该规则参与的对话计算效果
      const avgCompletion = ruleAnalyses.reduce((s, a) => s + parseFloat(a.completion_rate), 0) / ruleAnalyses.length
      const avgSat = ruleAnalyses.reduce((s, a) => s + parseFloat(a.user_satisfaction || 0), 0) / ruleAnalyses.length
      const avgTurns = ruleAnalyses.reduce((s, a) => s + a.total_turns, 0) / ruleAnalyses.length
      const positiveRate = ruleAnalyses.filter(a => ['positive', 'slightly_positive'].includes(a.user_sentiment)).length / ruleAnalyses.length

      // 对比基准线计算增益
      const completionGain = avgCompletion - baseline.completion
      const satGain = avgSat - baseline.satisfaction
      const efficiencyScore = avgTurns < 10 ? 80 : avgTurns < 15 ? 60 : avgTurns < 20 ? 40 : 20

      // 效果评分 = 绝对质量(50%) + 相对增益(30%) + 效率(20%)
      const absoluteScore = Math.min(avgCompletion, 100) * 0.3 + Math.min(avgSat, 100) * 0.2
      const gainBonus = Math.max(-20, Math.min(20, (completionGain * 0.5 + satGain * 0.5) * 0.3))
      const effBonus = efficiencyScore * 0.2
      score = Math.round(absoluteScore + gainBonus + effBonus)
    } else {
      // 数据不足：使用全局平均 + 使用频率衰减
      const completionScore = Math.min(baseline.completion, 100)
      const efficiencyScore = baseline.turns < 10 ? 80 : baseline.turns < 15 ? 60 : baseline.turns < 20 ? 40 : 20
      score = Math.round(completionScore * 0.5 + efficiencyScore * 0.3 + 10) // 给新规则基础分
    }

    const clampedScore = Math.max(5, Math.min(95, score))
    const currentScore = parseFloat(rule.effectiveness_score || 0)
    if (Math.abs(clampedScore - currentScore) >= 3) {
      await updateRuleEffectiveness(rule.id, clampedScore)
      updated++
    }
  }

  console.log(`[Evolution] 规则效果评估完成: ${activeRules.length}条规则, 更新${updated}条, 基准完成率=${baseline.completion.toFixed(0)}%`)
}

/**
 * 即时规则反馈：单次对话分析完成后，增量更新参与规则的效果分
 * 使用指数移动平均(EMA)平滑更新，避免单次对话波动过大
 * @param {number[]} ruleIds - 本次对话中活跃的规则ID列表
 * @param {object} analysis - 本次对话的分析结果
 */
async function updateRuleScoresFromAnalysis(ruleIds, analysis) {
  const alpha = 0.15 // EMA平滑系数：新数据权重15%，历史权重85%
  const completionRate = parseFloat(analysis.completionRate || 0)
  const satisfaction = parseFloat(analysis.userSatisfaction || 0)
  const sentiment = analysis.userSentiment || 'neutral'
  const sentimentBonus = sentiment === 'positive' ? 10 : sentiment === 'slightly_positive' ? 5 :
    sentiment === 'slightly_negative' ? -5 : sentiment === 'negative' ? -10 : 0

  // 本次对话的质量信号 (0-100)
  const conversationScore = Math.max(5, Math.min(95,
    completionRate * 0.4 + satisfaction * 0.3 + sentimentBonus + 30
  ))

  for (const ruleId of ruleIds) {
    try {
      const rule = await getAIRuleById(ruleId)
      if (!rule) continue
      const currentScore = parseFloat(rule.effectiveness_score || 50)
      // EMA更新：newScore = alpha * conversationScore + (1-alpha) * currentScore
      const newScore = Math.round(alpha * conversationScore + (1 - alpha) * currentScore)
      const clamped = Math.max(5, Math.min(95, newScore))
      if (Math.abs(clamped - currentScore) >= 1) {
        await updateRuleEffectiveness(ruleId, clamped)
      }
    } catch { /* skip individual rule errors */ }
  }
}

/**
 * 自动升降级规则
 * - pending_review + 使用>=5次 + 效果分>=60 → 自动升为 active
 * - active + 效果分<30 + 使用>=10次 → 自动降为 archived
 * - pending_review 超过7天未审批 → 自动归档
 */
export async function autoPromoteRules() {
  // 1. 自动升级：待审批 → 生效
  const pendingRules = await getAllAIRules(null, 'pending_review')
  let promoted = 0, archived = 0

  for (const rule of pendingRules) {
    const age = (Date.now() - new Date(rule.created_at).getTime()) / (1000 * 60 * 60 * 24)

    // 超过7天未审批 → 自动归档
    if (age > 7) {
      await updateAIRuleStatus(rule.id, 'archived', '超过7天未审批，自动归档', 'system')
      archived++
      continue
    }

    // 使用>=5次 + 效果分>=60 → 自动升级
    if (rule.usage_count >= 5 && parseFloat(rule.effectiveness_score) >= 60) {
      await updateAIRuleStatus(rule.id, 'active', `自动升级: 使用${rule.usage_count}次, 效果分${rule.effectiveness_score}`, 'system')
      promoted++
    }
  }

  // 2. 自动降级：生效中但效果差
  const activeRules = await getActiveRules()
  for (const rule of activeRules) {
    if (rule.usage_count >= 10 && parseFloat(rule.effectiveness_score) < 30) {
      await updateAIRuleStatus(rule.id, 'archived', `自动降级: 效果分${rule.effectiveness_score}低于30`, 'system')
      archived++
    }
  }

  if (promoted > 0 || archived > 0) {
    console.log(`[Evolution] 规则自动升降级: ${promoted}条升级, ${archived}条归档`)
  }
  return { promoted, archived }
}

// ========== 5. 对话结束后自动触发分析 ==========

/**
 * 对话结束后异步触发分析（在stream端点完成后调用）
 * 延迟执行，不阻塞主流程
 */
export function schedulePostConversationAnalysis(sessionId) {
  // 延迟30秒执行，确保所有消息已写入DB
  setTimeout(async () => {
    try {
      const result = await analyzeConversation(sessionId)
      if (result) {
        // 自动生成规则提案（generateRulesFromAnalysis内部会自动触发AI审批）
        const newRules = await generateRulesFromAnalysis(result)

        // 每分析10条对话触发一次增量知识聚合
        _analysisCounter = (_analysisCounter || 0) + 1
        if (_analysisCounter % 10 === 0) {
          safeExecute('incremental_aggregation', () => aggregateKnowledgeClusters()).catch(() => {})
          console.log(`[AutoGrowth] 达到10次分析，触发增量知识聚合`)
        }

        // 更新探索实验的样本计数
        trackExperimentSample(sessionId, result).catch(() => {})

        console.log(`[Evolution] 对话后自动分析完成: ${sessionId}, 新规则=${newRules.length}(AI自动审批中)`)
      }
    } catch (err) {
      console.error(`[Evolution] 对话后自动分析失败: ${sessionId}`, err.message)
    }
  }, 30 * 1000)
}

let _analysisCounter = 0

// ========== 6. 批量分析 + 每日聚合 ==========

/**
 * 批量分析未处理的对话（后台定时任务调用）
 * @param {number} limit - 每次最多分析几条
 * @returns {number} 分析成功的数量
 */
export async function batchAnalyzeConversations(limit = 10) {
  const unanalyzed = await getUnanalyzedSessions(limit)
  console.log(`[Evolution] 发现 ${unanalyzed.length} 条未分析对话`)

  let analyzed = 0
  let rulesCreated = 0
  for (const session of unanalyzed) {
    if (session.message_count < 3) continue

    const result = await analyzeConversation(session.id)
    if (result) {
      analyzed++
      // generateRulesFromAnalysis 内部会自动触发 AI 审批
      const newRules = await generateRulesFromAnalysis(result)
      rulesCreated += newRules.length
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  // 批量分析完成后触发知识聚合
  if (analyzed >= 3) {
    safeExecute('batch_aggregation', () => aggregateKnowledgeClusters()).catch(() => {})
  }

  console.log(`[Evolution] 批量分析完成: ${analyzed}/${unanalyzed.length}, 新规则=${rulesCreated}(AI自动审批中)`)
  return analyzed
}

/**
 * 每日聚合学习指标
 */
export async function aggregateDailyMetrics() {
  const today = new Date().toISOString().slice(0, 10)

  const stats = await getAnalysisStats()
  if (!stats?.totals) return

  const analyses = await getConversationAnalyses(100, {})
  const todayAnalyses = analyses.filter(a => {
    const d = new Date(a.analyzed_at).toISOString().slice(0, 10)
    return d === today
  })

  // 汇总今日指标
  const dropOffFields = {}
  const allSuggestions = []
  for (const a of todayAnalyses) {
    if (a.drop_off_point) {
      dropOffFields[a.drop_off_point] = (dropOffFields[a.drop_off_point] || 0) + 1
    }
    if (a.suggestions?.length) {
      allSuggestions.push(...a.suggestions)
    }
  }

  // Top drop-off fields
  const topDropOffs = Object.entries(dropOffFields)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => ({ field, count }))

  // Top improvement themes
  const themes = {}
  for (const s of allSuggestions) {
    const key = s.type || 'general'
    themes[key] = (themes[key] || 0) + 1
  }
  const topImprovements = Object.entries(themes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => ({ theme, count }))

  // 计算新的质量指标
  const avgProf = todayAnalyses.length > 0
    ? todayAnalyses.reduce((s, a) => s + parseFloat(a.professionalism_score || 0), 0) / todayAnalyses.length : 0
  const avgAppeal = todayAnalyses.length > 0
    ? todayAnalyses.reduce((s, a) => s + parseFloat(a.appeal_success_rate || 0), 0) / todayAnalyses.length : 0
  const avgSat = todayAnalyses.length > 0
    ? todayAnalyses.reduce((s, a) => s + parseFloat(a.user_satisfaction || 0), 0) / todayAnalyses.length : 0

  // 统计今日规则变化
  let rulesGenerated = 0, rulesPromoted = 0
  try {
    const allRules = await getAllAIRules()
    rulesGenerated = allRules.filter(r => new Date(r.created_at).toISOString().slice(0, 10) === today).length
    rulesPromoted = allRules.filter(r => r.status === 'active' && r.updated_at && new Date(r.updated_at).toISOString().slice(0, 10) === today).length
  } catch {}

  await upsertLearningMetrics(today, {
    totalConversations: todayAnalyses.length,
    avgCollectionTurns: todayAnalyses.length > 0
      ? todayAnalyses.reduce((s, a) => s + a.collection_turns, 0) / todayAnalyses.length : 0,
    avgCompletionRate: todayAnalyses.length > 0
      ? todayAnalyses.reduce((s, a) => s + parseFloat(a.completion_rate), 0) / todayAnalyses.length : 0,
    avgUserSatisfaction: avgSat,
    completionCount: todayAnalyses.filter(a => parseFloat(a.completion_rate) >= 80).length,
    dropOffCount: todayAnalyses.filter(a => a.drop_off_point).length,
    topDropOffFields: topDropOffs,
    topImprovements,
    rulesGenerated,
    rulesPromoted,
    avgProfessionalism: avgProf,
    avgAppealSuccess: avgAppeal,
  })

  console.log(`[Evolution] 每日指标聚合完成: ${today}, 分析=${todayAnalyses.length}条, 专业度=${avgProf.toFixed(0)}, 申诉率=${avgAppeal.toFixed(0)}%, 满意度=${avgSat.toFixed(0)}, 规则+${rulesGenerated}/-${rulesPromoted}`)
}

// ========== 7. AI 自动打标系统 ==========

/**
 * 对话分析完成后自动打标：
 * - difficulty: 根据轮数/完成率/情绪判断难度
 * - user_type: 根据消息特征判断用户类型
 * - outcome: 根据完成率判断结果
 * - tags: 自动提取关键标签
 * - pattern_flags: 识别行为模式
 */
export async function autoTagConversation(sessionId, analysis) {
  try {
    const completionRate = parseFloat(analysis.completionRate || 0)
    const turns = analysis.totalTurns || 0
    const sentiment = analysis.userSentiment || 'neutral'

    // 难度判断
    let difficulty = 'medium'
    if (completionRate >= 80 && turns <= 8) difficulty = 'easy'
    else if (completionRate >= 60 && turns <= 15) difficulty = 'medium'
    else if (completionRate >= 30 || turns > 15) difficulty = 'hard'
    else if (completionRate < 30 && turns > 20) difficulty = 'extreme'

    // 结果判断
    let outcome = 'partial'
    if (completionRate >= 80) outcome = 'completed'
    else if (completionRate < 15 && turns < 5) outcome = 'abandoned'
    else if (completionRate < 50) outcome = 'partial'

    // 用户类型推断（基于消息长度和响应速度）
    const avgMsgLen = analysis.rawAnalysis ? 50 : 30 // 简化推断
    let userType = 'first_time'
    if (turns >= 15 && completionRate >= 70) userType = 'experienced'
    else if (turns >= 8) userType = 'returning'

    // 质量评分 (0-100)
    const qualityScore = Math.round(
      completionRate * 0.4 +
      (sentiment === 'positive' || sentiment === 'slightly_positive' ? 30 : sentiment === 'neutral' ? 20 : 10) +
      Math.min(30, Math.max(0, 30 - Math.abs(turns - 10) * 2))
    )

    // 自动标签
    const tags = []
    if (completionRate >= 90) tags.push('高完成率')
    if (completionRate < 20) tags.push('低完成率')
    if (sentiment === 'negative') tags.push('负面情绪')
    if (sentiment === 'positive') tags.push('积极配合')
    if (turns <= 5 && completionRate >= 60) tags.push('高效用户')
    if (turns > 20) tags.push('长对话')
    if (analysis.dropOffPoint) tags.push(`流失:${analysis.dropOffPoint}`)
    if (analysis.industry) tags.push(`行业:${analysis.industry}`)
    if (analysis.problemType) tags.push(`类型:${analysis.problemType}`)

    // 模式标记
    const patternFlags = {}
    if (analysis.fieldsRefused > 3) patternFlags.resistant = true
    if (analysis.fieldsCollected >= 12) patternFlags.cooperative = true
    if (turns <= 6 && completionRate >= 70) patternFlags.efficient = true
    if (analysis.dropOffPoint) patternFlags.dropped = true

    const industryCluster = analysis.industry || ''
    const violationCluster = analysis.problemType || ''

    await upsertConversationTags(sessionId, {
      analysisId: analysis.id,
      difficulty, userType, qualityScore, outcome,
      tags, industryCluster, violationCluster, patternFlags,
    })

    await recordEngineSuccess('tagging')
    return { difficulty, userType, qualityScore, outcome, tags }
  } catch (err) {
    await incrementEngineError('tagging', err.message)
    console.error('[Evolution] 打标失败:', err.message)
    return null
  }
}

// ========== 8. 能力与数据聚合引擎 ==========

/**
 * 跨对话模式聚合：定期运行，从大量分析中提炼高置信度知识
 * 生成行业模式、违规模式、问题效果、用户行为、成功因子五类知识簇
 */
export async function aggregateKnowledgeClusters() {
  try {
    const analyses = await getConversationAnalyses(200, {})
    if (analyses.length < 5) return

    // --- 行业模式聚合 ---
    const industryMap = {}
    for (const a of analyses) {
      if (!a.industry) continue
      if (!industryMap[a.industry]) industryMap[a.industry] = { completions: [], turns: [], sentiments: [], dropOffs: [], suggestions: [], profScores: [], appealScores: [], satScores: [] }
      const m = industryMap[a.industry]
      m.completions.push(parseFloat(a.completion_rate))
      m.turns.push(a.total_turns)
      m.sentiments.push(a.user_sentiment)
      if (a.professionalism_score > 0) m.profScores.push(parseFloat(a.professionalism_score))
      if (a.appeal_success_rate > 0) m.appealScores.push(parseFloat(a.appeal_success_rate))
      if (a.user_satisfaction > 0) m.satScores.push(parseFloat(a.user_satisfaction))
      if (a.drop_off_point) m.dropOffs.push(a.drop_off_point)
      if (a.suggestions?.length) m.suggestions.push(...a.suggestions)
    }

    for (const [industry, data] of Object.entries(industryMap)) {
      if (data.completions.length < 3) continue
      const avgCompletion = data.completions.reduce((s, v) => s + v, 0) / data.completions.length
      const avgTurns = data.turns.reduce((s, v) => s + v, 0) / data.turns.length
      const positiveRate = data.sentiments.filter(s => s === 'positive' || s === 'slightly_positive').length / data.sentiments.length

      const dropOffCounts = {}
      for (const d of data.dropOffs) dropOffCounts[d] = (dropOffCounts[d] || 0) + 1
      const topDropOff = Object.entries(dropOffCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

      const sugTypes = {}
      for (const s of data.suggestions) sugTypes[s.type || 'general'] = (sugTypes[s.type || 'general'] || 0) + 1

      // 质量指标聚合
      const avgProf = data.profScores?.length > 0 ? data.profScores.reduce((s, v) => s + v, 0) / data.profScores.length : 0
      const avgAppeal = data.appealScores?.length > 0 ? data.appealScores.reduce((s, v) => s + v, 0) / data.appealScores.length : 0
      const avgSat = data.satScores?.length > 0 ? data.satScores.reduce((s, v) => s + v, 0) / data.satScores.length : 0

      await upsertKnowledgeCluster('industry_pattern', industry, {
        name: `${industry}行业模式`,
        insights: {
          avgCompletion: Math.round(avgCompletion),
          avgTurns: Math.round(avgTurns * 10) / 10,
          positiveRate: Math.round(positiveRate * 100),
          avgProfessionalism: Math.round(avgProf),
          avgAppealSuccess: Math.round(avgAppeal),
          avgSatisfaction: Math.round(avgSat),
          topDropOffs: topDropOff.map(([field, count]) => ({ field, count })),
          topSuggestionTypes: Object.entries(sugTypes).sort((a, b) => b[1] - a[1]).slice(0, 3),
        },
        sampleCount: data.completions.length,
        confidence: Math.min(95, 50 + data.completions.length * 5),
      })
    }

    // --- 违规类型模式聚合 ---
    const violationMap = {}
    for (const a of analyses) {
      if (!a.problem_type) continue
      if (!violationMap[a.problem_type]) violationMap[a.problem_type] = { completions: [], turns: [], count: 0 }
      const m = violationMap[a.problem_type]
      m.completions.push(parseFloat(a.completion_rate))
      m.turns.push(a.total_turns)
      m.count++
    }

    for (const [violation, data] of Object.entries(violationMap)) {
      if (data.count < 2) continue
      const avgCompletion = data.completions.reduce((s, v) => s + v, 0) / data.completions.length
      const avgTurns = data.turns.reduce((s, v) => s + v, 0) / data.turns.length
      await upsertKnowledgeCluster('violation_pattern', violation, {
        name: `${violation}违规模式`,
        insights: { avgCompletion: Math.round(avgCompletion), avgTurns: Math.round(avgTurns * 10) / 10 },
        sampleCount: data.count,
        confidence: Math.min(90, 40 + data.count * 8),
      })
    }

    // --- 成功因子分析 ---
    const successfulAnalyses = analyses.filter(a => parseFloat(a.completion_rate) >= 80)
    const failedAnalyses = analyses.filter(a => parseFloat(a.completion_rate) < 30)

    if (successfulAnalyses.length >= 3) {
      const avgSuccessTurns = successfulAnalyses.reduce((s, a) => s + a.total_turns, 0) / successfulAnalyses.length
      const avgSuccessFields = successfulAnalyses.reduce((s, a) => s + a.fields_collected, 0) / successfulAnalyses.length
      const successSentiments = successfulAnalyses.map(a => a.user_sentiment)
      await upsertKnowledgeCluster('success_factor', 'high_completion', {
        name: '高完成率对话特征',
        insights: {
          avgTurns: Math.round(avgSuccessTurns * 10) / 10,
          avgFields: Math.round(avgSuccessFields * 10) / 10,
          sentimentDistribution: countValues(successSentiments),
          sampleIndustries: countValues(successfulAnalyses.map(a => a.industry).filter(Boolean)).slice(0, 5),
        },
        sampleCount: successfulAnalyses.length,
        confidence: Math.min(90, 50 + successfulAnalyses.length * 3),
      })
    }

    if (failedAnalyses.length >= 3) {
      const failDropOffs = countValues(failedAnalyses.map(a => a.drop_off_point).filter(Boolean))
      await upsertKnowledgeCluster('success_factor', 'failure_patterns', {
        name: '低完成率对话特征',
        insights: {
          topDropOffs: failDropOffs.slice(0, 5),
          avgTurns: Math.round(failedAnalyses.reduce((s, a) => s + a.total_turns, 0) / failedAnalyses.length),
          sentimentDistribution: countValues(failedAnalyses.map(a => a.user_sentiment)),
        },
        sampleCount: failedAnalyses.length,
        confidence: Math.min(90, 50 + failedAnalyses.length * 3),
      })
    }

    await recordEngineSuccess('aggregation')
    console.log(`[Evolution] 知识聚合完成: ${Object.keys(industryMap).length}个行业, ${Object.keys(violationMap).length}个违规类型`)
  } catch (err) {
    await incrementEngineError('aggregation', err.message)
    console.error('[Evolution] 知识聚合失败:', err.message)
  }
}

function countValues(arr) {
  const map = {}
  for (const v of arr) map[v] = (map[v] || 0) + 1
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

// ========== 9. 熔断器 + 容错 ==========

/**
 * 带熔断器的安全执行包装：
 * - 检查组件是否熔断（circuit_open状态 且 开路时间<5分钟则拒绝执行）
 * - 成功执行后记录success，失败记录error
 * - 错误累积>=5 自动开路，连续3次成功后恢复
 */
export async function safeExecute(component, fn, fallback = null) {
  try {
    const health = await getEngineHealth(component)
    if (health?.status === 'circuit_open') {
      const openedAt = health.circuit_opened_at ? new Date(health.circuit_opened_at).getTime() : 0
      const elapsed = Date.now() - openedAt
      // 5分钟冷却后允许尝试恢复
      if (elapsed < 5 * 60 * 1000) {
        console.log(`[CircuitBreaker] ${component} 熔断中，跳过执行 (${Math.round(elapsed / 1000)}s)`)
        return fallback
      }
      console.log(`[CircuitBreaker] ${component} 尝试恢复...`)
    }

    const result = await fn()
    await recordEngineSuccess(component).catch(() => {})
    return result
  } catch (err) {
    await incrementEngineError(component, err.message).catch(() => {})
    console.error(`[CircuitBreaker] ${component} 执行失败:`, err.message)
    return fallback
  }
}

/**
 * 获取引擎整体健康状态摘要
 */
export async function getEngineHealthSummary() {
  const health = await getEngineHealth()
  const components = Array.isArray(health) ? health : []
  const unhealthy = components.filter(c => c.status !== 'healthy')
  return {
    overall: unhealthy.length === 0 ? 'healthy' : unhealthy.some(c => c.status === 'circuit_open') ? 'critical' : 'degraded',
    components,
    unhealthyCount: unhealthy.length,
  }
}

// ========== 9.5 探索实验样本追踪 ==========

/**
 * 对话分析完成后，检查该对话是否属于某个运行中的实验，更新样本计数
 */
async function trackExperimentSample(sessionId, analysis) {
  try {
    const running = await getExperiments('running')
    if (running.length === 0) return

    const activeRuleIds = analysis.activeRuleIds || []

    for (const exp of running) {
      if (!exp.rule_id) continue
      const isVariantA = activeRuleIds.includes(exp.rule_id)

      if (isVariantA) {
        // 实验组：使用了实验规则
        const currentResultA = exp.result_a || { totalCompletion: 0, totalSat: 0, count: 0 }
        currentResultA.totalCompletion = (currentResultA.totalCompletion || 0) + (analysis.completionRate || 0)
        currentResultA.totalSat = (currentResultA.totalSat || 0) + (analysis.userSatisfaction || 0)
        currentResultA.count = (currentResultA.count || 0) + 1
        currentResultA.avgCompletion = currentResultA.count > 0 ? currentResultA.totalCompletion / currentResultA.count : 0
        currentResultA.avgSatisfaction = currentResultA.count > 0 ? currentResultA.totalSat / currentResultA.count : 0
        await updateExperiment(exp.id, { sampleA: (exp.sample_a || 0) + 1, resultA: currentResultA })
      } else {
        // 对照组：未使用实验规则
        const currentResultB = exp.result_b || { totalCompletion: 0, totalSat: 0, count: 0 }
        currentResultB.totalCompletion = (currentResultB.totalCompletion || 0) + (analysis.completionRate || 0)
        currentResultB.totalSat = (currentResultB.totalSat || 0) + (analysis.userSatisfaction || 0)
        currentResultB.count = (currentResultB.count || 0) + 1
        currentResultB.avgCompletion = currentResultB.count > 0 ? currentResultB.totalCompletion / currentResultB.count : 0
        currentResultB.avgSatisfaction = currentResultB.count > 0 ? currentResultB.totalSat / currentResultB.count : 0
        await updateExperiment(exp.id, { sampleB: (exp.sample_b || 0) + 1, resultB: currentResultB })
      }
    }
  } catch (err) {
    console.error('[Experiment] 样本追踪失败:', err.message)
  }
}

// ========== 10. 自主探索模式 ==========

/**
 * AI自主探索：从高频建议中生成实验性规则并A/B测试
 * - 扫描最近分析中的高频建议
 * - 创建实验性规则（status=pending_review）
 * - 跟踪实验效果，自动判定赢家
 */
export async function runExplorationCycle() {
  try {
    const analyses = await getConversationAnalyses(50, {})
    if (analyses.length < 10) return // 数据量不够

    // 汇总所有建议的频率
    const suggestionFreq = {}
    for (const a of analyses) {
      if (!a.suggestions?.length) continue
      for (const s of a.suggestions) {
        const key = `${s.type || 'general'}::${s.field || 'all'}`
        if (!suggestionFreq[key]) suggestionFreq[key] = { type: s.type, field: s.field, count: 0, examples: [] }
        suggestionFreq[key].count++
        if (suggestionFreq[key].examples.length < 3) suggestionFreq[key].examples.push(s.recommended || s.reason || '')
      }
    }

    // 找出出现>=3次的高频建议，尝试生成探索性规则
    const hotSuggestions = Object.values(suggestionFreq).filter(s => s.count >= 3).sort((a, b) => b.count - a.count).slice(0, 3)

    for (const sug of hotSuggestions) {
      const ruleKey = `explore_${sug.type}_${sug.field || 'general'}_${Date.now()}`

      // 检查是否已有类似的运行中实验
      const running = await getExperiments('running')
      const duplicate = running.find(e => e.variant_a?.type === sug.type && e.variant_a?.field === sug.field)
      if (duplicate) continue

      // 创建探索性规则
      const ruleResult = await createAIRule({
        category: sug.type || 'conversation_pattern',
        ruleKey,
        ruleName: `[探索] ${sug.field || sug.type} 优化`,
        ruleContent: {
          description: sug.examples[0] || `基于${sug.count}次建议自动生成的探索性规则`,
          field: sug.field,
          source: 'exploration',
          confidence: Math.min(80, sug.count * 10),
        },
        source: 'ai_generated',
        status: 'pending_review',
      })

      // 创建A/B实验记录
      await createExperiment({
        name: `探索: ${sug.field || sug.type} 优化`,
        ruleId: ruleResult.id,
        hypothesis: `基于${sug.count}次分析建议: ${sug.examples[0]?.slice(0, 100)}`,
        variantA: { type: sug.type, field: sug.field, action: 'apply_rule' },
        variantB: { type: sug.type, field: sug.field, action: 'baseline' },
      })

      console.log(`[Exploration] 创建探索实验: ${sug.field || sug.type}, 基于${sug.count}次建议`)
    }

    // 检查已完成的实验：sample_a>=10 时自动评估
    const runningExperiments = await getExperiments('running')
    for (const exp of runningExperiments) {
      if (exp.sample_a >= 10 && exp.sample_b >= 10) {
        const scoreA = exp.result_a?.avgCompletion || 0
        const scoreB = exp.result_b?.avgCompletion || 0
        const winner = scoreA > scoreB + 5 ? 'a' : scoreB > scoreA + 5 ? 'b' : 'inconclusive'

        await updateExperiment(exp.id, { status: 'completed', winner })

        // 如果实验组胜出且有关联规则，自动推荐激活
        if (winner === 'a' && exp.rule_id) {
          await updateAIRuleStatus(exp.rule_id, 'active', `探索实验胜出: A=${scoreA.toFixed(0)}% vs B=${scoreB.toFixed(0)}%`, 'system')
          invalidateRulesCache()
          console.log(`[Exploration] 实验 #${exp.id} 胜出, 规则 #${exp.rule_id} 自动激活`)
        }
      }

      // 超时14天的实验自动终止
      const age = (Date.now() - new Date(exp.started_at).getTime()) / (1000 * 60 * 60 * 24)
      if (age > 14) {
        await updateExperiment(exp.id, { status: 'aborted', winner: 'inconclusive' })
      }
    }

    await recordEngineSuccess('exploration')
  } catch (err) {
    await incrementEngineError('exploration', err.message)
    console.error('[Evolution] 探索周期失败:', err.message)
  }
}

// ========== 11. 自动进化定时器 ==========

let evolutionTimer = null
let _allTimers = []
let _dailyTimer = null
let _dailyInterval = null

/**
 * 启动自进化定时任务（V3 增强版）
 */
export function startEvolutionScheduler() {
  console.log('[Evolution] 🧠 AI自进化引擎V3启动')

  // 启动后1分钟执行首次分析（更积极地处理待分析对话）
  setTimeout(() => {
    safeExecute('batch_analysis', () => batchAnalyzeConversations(10))
  }, 60 * 1000)

  // 每10分钟：快速扫描新对话并分析（保持仪表板实时性）
  const quickAnalysisTimer = setInterval(async () => {
    await safeExecute('batch_analysis', () => batchAnalyzeConversations(5))
  }, 10 * 60 * 1000)
  _allTimers.push(quickAnalysisTimer)

  // 每30分钟：深度批量分析 + 规则效果评估
  evolutionTimer = setInterval(async () => {
    await safeExecute('batch_analysis', () => batchAnalyzeConversations(15))
    await safeExecute('rule_evaluation', () => evaluateRuleEffectiveness())
  }, 30 * 60 * 1000)

  // 每1小时：自动审批待审批规则
  const reviewTimer = setInterval(async () => {
    await safeExecute('auto_review', () => batchAutoReviewRules())
  }, 60 * 60 * 1000)
  _allTimers.push(reviewTimer)

  // 每2小时：自动升降级 + 探索周期
  const twoHourTimer = setInterval(async () => {
    await safeExecute('auto_promote', () => autoPromoteRules())
    await safeExecute('exploration', () => runExplorationCycle())
  }, 2 * 60 * 60 * 1000)
  _allTimers.push(twoHourTimer)

  // 每日凌晨2:05：聚合指标 + 知识聚类
  scheduleDailyAggregation()
}

function scheduleDailyAggregation() {
  const now = new Date()
  const next2am = new Date(now)
  next2am.setHours(2, 5, 0, 0)
  if (next2am <= now) next2am.setDate(next2am.getDate() + 1)

  const delay = next2am - now
  _dailyTimer = setTimeout(() => {
    const dailyTask = async () => {
      await safeExecute('daily_aggregation', () => aggregateDailyMetrics())
      await safeExecute('knowledge_clustering', () => aggregateKnowledgeClusters())
    }
    dailyTask()
    _dailyInterval = setInterval(dailyTask, 24 * 60 * 60 * 1000)
  }, delay)

  console.log(`[Evolution] 每日聚合将在 ${next2am.toLocaleTimeString()} 执行 (${Math.round(delay / 60000)}分钟后)`)
}

export function stopEvolutionScheduler() {
  if (evolutionTimer) {
    clearInterval(evolutionTimer)
    evolutionTimer = null
  }
  for (const t of _allTimers) clearInterval(t)
  _allTimers = []
  if (_dailyTimer) { clearTimeout(_dailyTimer); _dailyTimer = null }
  if (_dailyInterval) { clearInterval(_dailyInterval); _dailyInterval = null }
  console.log('[Evolution] 自进化引擎已停止')
}
