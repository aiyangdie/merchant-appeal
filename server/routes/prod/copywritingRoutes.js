import { getAIConfig } from '../../ai.js'
import { calculateCost } from '../../tokenizer.js'
import { getUserById, getActiveAIModel, deductBalance, incrementUserSpent, recordTokenUsage } from '../../db.js'
import { buildMerchantInfo, copywritingNeedsDeepThinking, parseCopywritingJson, COPYWRITING_APPEAL_TYPES, COPYWRITING_SYSTEM_PROMPT, COPYWRITING_PROMPTS } from '../../services/copywritingHelpers.js'
import { stripEmoji } from '../../lib/textUtils.js'
import { pipeAIStream } from '../../lib/sseStream.js'
/**
 * copywritingRoutes
 */
export function registerCopywritingRoutes(app, ctx) {
  const { signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken, authLimiter, chatLimiter, ensureUserCanUseOfficialAI, recordAIUsageForRequest, logFinancialActivity, unwrapMallUsagePayload, unwrapPersonaPayload } = ctx

// ========== 智能文案生成 API ==========

const COPYWRITING_APPEAL_TYPES = {
  situation_statement: '情况说明',
  commitment_letter: '承诺书',
  rectification_report: '整改报告',
  customer_service_script: '客服沟通话术',
  urgent_appeal: '加急申诉文案',
  rejection_supplement: '驳回补充申诉材料',
  phone_script: '95017电话沟通文案',
  full_package: '全套申诉材料',
}

const COPYWRITING_SYSTEM_PROMPT = `你是商户号申诉文案专家，专注于微信支付、支付宝商户号处罚申诉领域。你必须严格遵循以下规则和指南来生成高质量申诉文案。

## 核心原则
1. 基于真实情况撰写，绝不编造事实、伪造数据或虚构整改措施
2. 话术必须柔和合规，使用"经营不规范""管理疏忽""流程不完善"等中性表述
3. 绝对禁用敏感词汇：套现、刷单、洗钱、虚假交易、赌博、欺诈、传销、非法集资、违规套码、二清、资金池、跑分、色情、涉赌
4. 逻辑严谨，证据链完整，每个主张都有对应的事实或数据支撑
5. 数据量化整改成效，用具体数字说明改进幅度（如"投诉率下降85%""异常交易占比降至0.3%"）

## 文案结构规范
所有申诉文案必须遵循四段式结构：
- 第一段「认错」：诚恳承认问题，不推诿不辩解，表达深刻反思
- 第二段「原因」：客观分析问题根源，区分主观因素和客观因素
- 第三段「整改」：详细说明已采取的整改措施和取得的量化成效
- 第四段「恳请」：恳请平台给予改正机会，表达合规经营决心

## 平台规则知识
### 微信支付常见处罚类型
- 限制收款：通常因交易异常、投诉率过高触发，需提供交易真实性证明
- 冻结资金：涉嫌违规交易时触发，需说明资金来源和用途
- 关闭支付权限：严重违规导致，需全面整改并承诺合规
- 降级商户等级：风险指标超标，需改善经营数据

### 支付宝常见处罚类型
- 限制收款：因交易风险、违规经营触发
- 冻结账户：涉嫌欺诈或严重违规，需提供合规证明
- 限制提现：资金异常流动，需说明资金用途
- 关闭收钱功能：严重违规，需全面整改

### 申诉审核要点
- 审核人员关注：整改是否彻底、是否可能再犯、经营是否合规
- 有利因素：首次违规、主动整改、投诉率下降、交易量恢复
- 不利因素：多次违规、整改不彻底、仍有投诉、涉嫌欺诈

## 写作风格指南
- 语气：诚恳、谦逊、专业，避免过于卑微或过于强硬
- 用词：正式书面语，避免口语化表达和网络用语
- 数据：所有数据必须合理可信，整改前后对比要明显
- 证据：列举具体可查的证据类型（培训记录、监控截图、制度文件等）
- 承诺：具体可执行的承诺，避免空泛表态

## 常见整改措施参考
- 人员方面：组织合规培训、设立风控专员、建立考核机制
- 制度方面：完善交易审核流程、建立异常预警机制、制定应急预案
- 技术方面：升级监控系统、部署风控规则、接入实名认证
- 管理方面：加强供应商审核、优化客服响应、建立投诉处理SOP

## JSON输出规范
- 严格输出合法JSON格式，不包含任何多余文字、注释或markdown标记
- JSON字段值使用中文内容
- 数组字段至少包含2个元素
- content字段必须包含完整的文案正文
- 所有字段都必须填写，不得留空`

const COPYWRITING_PROMPTS = {
  situation_statement: `写《情况说明》。商户：{merchant_info}\n结构：基本信息→经营情况→异常原因→证据→诚恳表态。500-800字。正式诚恳。\n输出JSON：{"title":"","content":"","key_points":[],"evidence_list":[],"warnings":[]}`,

  commitment_letter: `写《合规经营承诺书》。商户：{merchant_info}\n结构：承诺人→承诺事项(5条+)→违约责任→期限→签名。300-500字。郑重坚定。\n输出JSON：{"title":"","content":"","commitment_items":[],"validity_period":""}`,

  rectification_report: `写《整改报告》。商户：{merchant_info}\n结构：问题概述→原因→措施(即时/短期/长期)→成效→保障。800-1200字。认真务实。\n输出JSON：{"title":"","content":"","immediate_actions":[],"short_term_actions":[],"long_term_actions":[],"evidence_list":[]}`,

  customer_service_script: `写客服沟通话术。商户：{merchant_info}\n3场景(在线客服/用户回访/补充材料)，每场景含开场白/核心/Q&A/结束语。礼貌专业。\n输出JSON：{"scenes":[{"scene_name":"","opening":"","key_points":[],"qa":[{"question":"","answer":""}],"closing":""}],"tips":[]}`,

  urgent_appeal: `写加急申诉文案。商户：{merchant_info}\n紧急原因→核心诉求→证据→诚恳表态。200-400字。紧迫有礼。\n输出JSON：{"title":"","content":"","urgent_reason":"","key_evidence":[],"expected_resolution":""}`,

  rejection_supplement: `写驳回补充申诉。商户：{merchant_info}\n驳回：{rejection_info}\n感谢→逐条回应→补充整改→恳请审核。500-800字。感恩诚恳。\n输出JSON：{"title":"","content":"","rejection_responses":[{"rejection_point":"","response":"","new_evidence":""}],"additional_evidence":[],"summary":""}`,

  phone_script: `写95017电话文案。商户：{merchant_info}\n自我介绍→来电目的→核心诉求→证据→请求处理。含脚本/Q&A/注意事项。礼貌坚定。\n输出JSON：{"script":"","key_talking_points":[],"anticipated_questions":[{"question":"","answer":""}],"do_list":[],"dont_list":[],"follow_up":""}`,

  full_package: `生成全套申诉材料。商户：{merchant_info}\n含：情况说明+承诺书+整改报告+客服话术+95017电话文案。逻辑一致，证据互证。\n输出JSON：{"situation_statement":{"title":"","content":""},"commitment_letter":{"title":"","content":""},"rectification_report":{"title":"","content":""},"customer_service_script":{"opening":"","key_points":[],"closing":""},"phone_script":{"script":"","key_points":[]},"evidence_checklist":[],"submission_order":[]}`,
}

function buildMerchantInfo(data) {
  const fieldMap = {
    merchant_name: '商户名称', merchant_id: '商户号', platform: '平台',
    industry: '所属行业', ban_type: '处罚类型', ban_reason: '封禁/处罚原因',
    ban_time: '处罚时间', business_model: '经营模式', business_address: '经营地址',
    monthly_revenue: '月均交易额', complaint_count: '投诉数量',
    violation_details: '违规详情', rectification_status: '已整改情况',
    contact_name: '联系人', contact_phone: '联系电话',
  }
  const parts = []
  for (const [key, label] of Object.entries(fieldMap)) {
    if (data[key]) parts.push(`${label}：${data[key]}`)
  }
  if (data.extra_info) parts.push(`补充信息：${data.extra_info}`)
  if (data.rejection_reason) parts.push(`驳回原因：${data.rejection_reason}`)
  return parts.length > 0 ? parts.join('\n') : '商户信息待补充'
}

function copywritingNeedsDeepThinking(appealType, data) {
  if (data.enable_deep_thinking === true) return true
  if (data.enable_deep_thinking === false) return false
  return false
}

function parseCopywritingJson(content) {
  if (!content) return null
  try { return JSON.parse(content) } catch {}
  let c = content.trim()
  if (c.startsWith('```json')) c = c.slice(7)
  else if (c.startsWith('```')) c = c.slice(3)
  if (c.endsWith('```')) c = c.slice(0, -3)
  c = c.trim()
  try { return JSON.parse(c) } catch {}
  let depth = 0, start = -1
  for (let i = 0; i < c.length; i++) {
    if (c[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (c[i] === '}') { depth--; if (depth === 0 && start >= 0) { try { return JSON.parse(c.slice(start, i + 1)) } catch { start = -1 } } }
  }
  return null
}

app.get('/api/copywriting/types', (req, res) => {
  res.json({ success: true, appeal_types: COPYWRITING_APPEAL_TYPES })
})

app.get('/api/copywriting/health', (req, res) => {
  res.json({ status: 'ok', service: 'copywriting', supported_types: Object.keys(COPYWRITING_APPEAL_TYPES) })
})

app.post('/api/copywriting/generate', requireUser, ensureUserCanUseOfficialAI, async (req, res) => {
  try {
    const { appeal_type, merchant_data, temperature, max_tokens } = req.body
    if (!appeal_type || !COPYWRITING_PROMPTS[appeal_type]) {
      return res.status(400).json({ success: false, error: `不支持的文案类型，支持：${Object.keys(COPYWRITING_PROMPTS).join('/')}` })
    }
    if (!merchant_data) {
      return res.status(400).json({ success: false, error: '缺少 merchant_data 参数' })
    }

    const merchantInfo = buildMerchantInfo(merchant_data)
    const rejectionInfo = merchant_data.rejection_info || merchant_data.rejection_reason || '无具体驳回信息'
    const userPrompt = COPYWRITING_PROMPTS[appeal_type].replace('{merchant_info}', merchantInfo).replace('{rejection_info}', rejectionInfo)
    const enableDeepThinking = copywritingNeedsDeepThinking(appeal_type, merchant_data)

    const cfg = await getAIConfig()
    if (!cfg.apiKey) return res.status(500).json({ success: false, error: 'AI API Key 未配置，请在管理后台配置' })

    const isVolcengine = ['volcengine', 'doubao'].includes(cfg.provider?.toLowerCase())
    const model = (isVolcengine && cfg.endpointId) ? cfg.endpointId : cfg.model
    const MAX_TOKENS_MAP = { situation_statement: 1024, commitment_letter: 768, rectification_report: 1024, customer_service_script: 1024, urgent_appeal: 512, rejection_supplement: 1024, phone_script: 768, full_package: 2048 }
    const defaultMaxTokens = MAX_TOKENS_MAP[appeal_type] || 1024

    const body = {
      model,
      messages: [
        { role: 'system', content: COPYWRITING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: '{' },
      ],
      temperature: temperature || 0.3,
      top_p: 0.7,
      max_tokens: max_tokens || defaultMaxTokens,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      response_format: { type: 'json_object' },
    }
    if (isVolcengine) {
      body.thinking = { type: enableDeepThinking ? 'enabled' : 'disabled' }
      body.service_tier = 'auto'
    }

    const t0 = Date.now()
    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      timeout: 120000,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return res.status(502).json({ success: false, error: `AI API Error ${response.status}: ${errText.slice(0, 200)}` })
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content || ''
    const parsed = parseCopywritingJson(content)
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2)

    if (json.usage) {
      await recordAIUsageForRequest(req, { type: 'copywriting', usage: json.usage })
      const promptT = json.usage.prompt_tokens || 0
      const completionT = json.usage.completion_tokens || 0
      const totalT = json.usage.total_tokens || promptT + completionT
      const inputPricePer1M = isVolcengine ? 2 : (cfg.provider === 'deepseek' ? 1 : 5)
      const outputPricePer1M = isVolcengine ? 8 : (cfg.provider === 'deepseek' ? 2 : 15)
      const costYuan = (promptT * inputPricePer1M + completionT * outputPricePer1M) / 1000000
      const _pool = getPool()
      if (_pool) {
        _pool.execute(
          'INSERT INTO token_usage_logs (model_id, provider, model_name, prompt_tokens, completion_tokens, total_tokens, request_type, cost_yuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [0, cfg.provider, cfg.model, promptT, completionT, totalT, 'copywriting', costYuan]
        ).catch(e => console.error('[TokenUsage] log error:', e.message))
      }
    }

    res.json({
      success: true,
      appeal_type,
      appeal_type_name: COPYWRITING_APPEAL_TYPES[appeal_type],
      data: parsed || { raw_content: content },
      raw_content: content,
      deep_thinking_enabled: enableDeepThinking,
      model: cfg.model,
      provider: cfg.provider,
      elapsed: parseFloat(elapsed),
      usage: json.usage || null,
    })
  } catch (error) {
    console.error('[Copywriting] Generate Error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/copywriting/generate/stream', requireUser, ensureUserCanUseOfficialAI, async (req, res) => {
  try {
    const { appeal_type, merchant_data, temperature, max_tokens } = req.body
    if (!appeal_type || !COPYWRITING_PROMPTS[appeal_type]) {
      return res.status(400).json({ success: false, error: `不支持的文案类型` })
    }
    if (!merchant_data) {
      return res.status(400).json({ success: false, error: '缺少 merchant_data 参数' })
    }

    const merchantInfo = buildMerchantInfo(merchant_data)
    const rejectionInfo = merchant_data.rejection_info || merchant_data.rejection_reason || '无具体驳回信息'
    const userPrompt = COPYWRITING_PROMPTS[appeal_type].replace('{merchant_info}', merchantInfo).replace('{rejection_info}', rejectionInfo)
    const enableDeepThinking = copywritingNeedsDeepThinking(appeal_type, merchant_data)

    const cfg = await getAIConfig()
    if (!cfg.apiKey) return res.status(500).json({ success: false, error: 'AI API Key 未配置' })

    const isVolcengine = ['volcengine', 'doubao'].includes(cfg.provider?.toLowerCase())
    const model = (isVolcengine && cfg.endpointId) ? cfg.endpointId : cfg.model
    const MAX_TOKENS_MAP = { situation_statement: 1024, commitment_letter: 768, rectification_report: 1024, customer_service_script: 1024, urgent_appeal: 512, rejection_supplement: 1024, phone_script: 768, full_package: 2048 }
    const defaultMaxTokens = MAX_TOKENS_MAP[appeal_type] || 1024

    const body = {
      model,
      messages: [
        { role: 'system', content: COPYWRITING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: '{' },
      ],
      temperature: temperature || 0.3,
      top_p: 0.7,
      max_tokens: max_tokens || defaultMaxTokens,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stream: true,
    }
    if (isVolcengine) {
      body.thinking = { type: enableDeepThinking ? 'enabled' : 'disabled' }
      body.service_tier = 'auto'
      body.stream_options = { include_usage: true, chunk_include_usage: false }
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ type: 'meta', appeal_type, appeal_type_name: COPYWRITING_APPEAL_TYPES[appeal_type], deep_thinking_enabled: enableDeepThinking })}\n\n`)

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      timeout: 120000,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      res.write(`data: ${JSON.stringify({ type: 'error', error: `AI API Error ${response.status}: ${errText.slice(0, 200)}` })}\n\n`)
      res.end()
      return
    }

    let fullContent = ''
    let thinkingContent = ''
    let usageData = null

    if (response.body?.on) {
      let buffer = ''
      response.body.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          if (trimmed === 'data: [DONE]') continue
          try {
            const j = JSON.parse(trimmed.slice(6))
            const delta = j.choices?.[0]?.delta
            if (delta) {
              const c = delta.content || ''
              const tc = delta.reasoning_content || delta.thinking || ''
              if (c) {
                fullContent += c
                res.write(`data: ${JSON.stringify({ type: 'content', content: c })}\n\n`)
              }
              if (tc) {
                thinkingContent += tc
                res.write(`data: ${JSON.stringify({ type: 'thinking', content: tc })}\n\n`)
              }
            }
            if (j.usage) usageData = j.usage
          } catch {}
        }
      })
      response.body.on('end', async () => {
        if (usageData) await recordAIUsageForRequest(req, { type: 'copywriting', usage: usageData })
        const parsed = parseCopywritingJson(fullContent)
        const finalData = { type: 'done', result: parsed || { raw_content: fullContent }, raw_content: fullContent }
        if (thinkingContent) finalData.thinking_content = thinkingContent
        if (usageData) finalData.usage = usageData
        res.write(`data: ${JSON.stringify(finalData)}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      })
      response.body.on('error', (err) => { res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`); res.end() })
    } else if (response.body?.getReader) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          if (trimmed === 'data: [DONE]') continue
          try {
            const j = JSON.parse(trimmed.slice(6))
            const delta = j.choices?.[0]?.delta
            if (delta) {
              const c = delta.content || ''
              const tc = delta.reasoning_content || delta.thinking || ''
              if (c) {
                fullContent += c
                res.write(`data: ${JSON.stringify({ type: 'content', content: c })}\n\n`)
              }
              if (tc) {
                thinkingContent += tc
                res.write(`data: ${JSON.stringify({ type: 'thinking', content: tc })}\n\n`)
              }
            }
            if (j.usage) usageData = j.usage
          } catch {}
        }
      }
      if (usageData) await recordAIUsageForRequest(req, { type: 'copywriting', usage: usageData })
      const parsed = parseCopywritingJson(fullContent)
      const finalData = { type: 'done', result: parsed || { raw_content: fullContent }, raw_content: fullContent }
      if (thinkingContent) finalData.thinking_content = thinkingContent
      if (usageData) finalData.usage = usageData
      res.write(`data: ${JSON.stringify(finalData)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      const text = await response.text()
      const lines = text.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        if (trimmed === 'data: [DONE]') continue
        try {
          const j = JSON.parse(trimmed.slice(6))
          const delta = j.choices?.[0]?.delta
          if (delta) {
            const c = delta.content || ''
            const tc = delta.reasoning_content || delta.thinking || ''
            if (c) {
              fullContent += c
              res.write(`data: ${JSON.stringify({ type: 'content', content: c })}\n\n`)
            }
            if (tc) {
              thinkingContent += tc
              res.write(`data: ${JSON.stringify({ type: 'thinking', content: tc })}\n\n`)
            }
          }
          if (j.usage) usageData = j.usage
        } catch {}
      }
      if (usageData) await recordAIUsageForRequest(req, { type: 'copywriting', usage: usageData })
      const parsed = parseCopywritingJson(fullContent)
      const finalData = { type: 'done', result: parsed || { raw_content: fullContent }, raw_content: fullContent }
      if (thinkingContent) finalData.thinking_content = thinkingContent
      if (usageData) finalData.usage = usageData
      res.write(`data: ${JSON.stringify(finalData)}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (error) {
    console.error('[Copywriting] Stream Error:', error)
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message })
    else { res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`); res.end() }
  }
})

app.post('/api/copywriting/refine', requireUser, ensureUserCanUseOfficialAI, async (req, res) => {
  try {
    const { original_content, refinement_instructions, merchant_data, temperature } = req.body
    if (!original_content || !refinement_instructions) {
      return res.status(400).json({ success: false, error: '缺少 original_content 或 refinement_instructions' })
    }

    const merchantInfo = merchant_data ? buildMerchantInfo(merchant_data) : '无'
    const cfg = await getAIConfig()
    if (!cfg.apiKey) return res.status(500).json({ success: false, error: 'AI API Key 未配置' })

    const isVolcengine = ['volcengine', 'doubao'].includes(cfg.provider?.toLowerCase())
    const model = (isVolcengine && cfg.endpointId) ? cfg.endpointId : cfg.model
    const body = {
      model,
      messages: [
        { role: 'system', content: COPYWRITING_SYSTEM_PROMPT },
        { role: 'user', content: `优化以下申诉文案。\n\n【原始文案】\n${original_content}\n\n【商户信息】\n${merchantInfo}\n\n【修改要求】\n${refinement_instructions}\n\n输出优化后的完整文案，保持JSON格式。` },
        { role: 'assistant', content: '{' },
      ],
      temperature: temperature || 0.3,
      top_p: 0.7,
      max_tokens: 2048,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      response_format: { type: 'json_object' },
    }
    if (isVolcengine) {
      body.thinking = { type: 'disabled' }
      body.service_tier = 'auto'
    }

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      timeout: 120000,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return res.status(502).json({ success: false, error: `AI API Error ${response.status}: ${errText.slice(0, 200)}` })
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content || ''
    const parsed = parseCopywritingJson(content)
    if (json.usage) await recordAIUsageForRequest(req, { type: 'copywriting', usage: json.usage })

    res.json({ success: true, data: parsed || { raw_content: content }, raw_content: content, usage: json.usage || null })
  } catch (error) {
    console.error('[Copywriting] Refine Error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========== 监控告警 API ==========

}
