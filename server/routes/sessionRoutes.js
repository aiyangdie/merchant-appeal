import { Router } from 'express'
import {
  getSession, updateSession, getMessages,
  saveAppealText, getAppealText, updateAppealStatus,
  saveComplaintDoc, getComplaintDoc,
  logFieldChange, getFieldChangeLog,
  checkDeepAnalysisQuota, incrementDeepAnalysisCount,
  saveDeepAnalysisResult, getDeepAnalysisResult,
  getPool, getUserById,
  deductBalance, incrementUserSpent, recordTokenUsage,
  getSystemConfig, upsertKnowledgeCluster,
} from '../db.js'
import { requireUser, optionalUser } from '../middleware/auth.js'
import { getAIConfig } from '../shared/aiConfig.js'
import { calculateCost as tokenizerCalculateCost } from '../tokenizer.js'
import logger from '../utils/logger.js'
import {
  handlePostComplaintReply,
  handleGetAppealGuide,
  handlePostAppealGuideGenerate,
} from '../handlers/appealGuideApi.js'

const router = Router()

async function validateSessionOwnership(req, res, next) {
  try {
    const { id } = req.params
    const session = await getSession(id)

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    if (session.user_id && session.user_id !== req.userId) {
      logger.warn(`IDOR attempt: user ${req.userId} tried to access session ${id} owned by ${session.user_id}`)
      return res.status(403).json({ error: '无权访问此会话' })
    }

    req.session = session
    next()
  } catch (error) {
    logger.error('Session ownership validation error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
}

router.get('/:id/info', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    res.json({ success: true, session: req.session })
  } catch (error) {
    logger.error('Get session error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/field', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const { field, value } = req.body

    if (!field || typeof field !== 'string') {
      return res.status(400).json({ error: '字段名无效' })
    }

    const oldValue = req.session.collected_data?.[field]
    await updateSession(id, {
      collected_data: { ...req.session.collected_data, [field]: value }
    })

    await logFieldChange(id, field, oldValue, value, req.userId)

    res.json({ success: true })
  } catch (error) {
    logger.error('Update field error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/messages', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const messages = await getMessages(id)
    res.json({ success: true, messages })
  } catch (error) {
    logger.error('Get messages error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/field-history', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const history = await getFieldChangeLog(id)
    res.json({ success: true, history })
  } catch (error) {
    logger.error('Get field history error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// ========== 申诉文案生成（完整LLM实现 + SSE流式）==========

router.post('/:id/generate-appeal-text', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const userId = req.userId
    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })

    let apiKeyToUse = null
    let isOfficialMode = false
    const activeModelAppeal = await (await import('../db.js')).getActiveAIModel()
    const isModelFreeAppeal = activeModelAppeal?.is_free === 1
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFreeAppeal)) {
      apiKeyToUse = null
      isOfficialMode = !isModelFreeAppeal
    } else {
      return res.status(402).json({ error: '余额不足，请先充值后再生成申诉文案', needRecharge: true })
    }

    const { force, stream } = req.body
    const session = req.session
    const d = session.collected_data || {}
    if (!d.industry && !d.violation_reason) return res.status(400).json({ error: '请先完成信息收集' })

    if (!force) {
      const existing = await getAppealText(req.params.id)
      if (existing) return res.json({ appealText: existing, cached: true })
    }

    const appealAiCfg = await getAIConfig()
    const apiKey = apiKeyToUse || appealAiCfg.apiKey
    if (!apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    const violationStrategies = {
      '信用卡套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '套现': '辩护要点：①列举真实商品/服务交易流水证明非套现 ②说明客单价合理、交易时间分散 ③提供物流/服务交付凭证 ④解释大额交易的合理业务原因',
      '赌博': '辩护要点：①强调持有游戏版号/文网文 ②说明有防沉迷系统和实名认证 ③概率公示透明合规 ④游戏内无现金兑换机制、仅售虚拟道具 ⑤与赌博行为有本质区别',
      '虚假交易': '辩护要点：①提供真实订单截图+物流签收记录 ②说明交易量增长有合理原因（如促销活动） ③展示真实买家评价 ④如有刷单嫌疑，承认并说明已停止、已处罚涉事人员',
      '欺诈': '辩护要点：①展示商品/服务真实交付证据 ②如宣传有偏差，承认并已修正所有宣传材料 ③主动为不满客户全额退款 ④更新服务协议增加消费者知情权条款',
      '洗钱': '辩护要点：①提供完整业务合同+海关报关单+外汇许可 ②说明资金流向清晰可追溯、与真实贸易匹配 ③公司已通过反洗钱合规审查 ④大额交易有合同支撑',
      '交易异常': '辩护要点：①解释交易波动原因（季节性/促销/新品上市） ②提供交易对手方信息证明真实性 ③展示历史交易数据佐证业务正常增长',
      '交易纠纷': '辩护要点：①列出所有投诉并说明已全部处理完成 ②分析投诉根因（如沟通不足/服务进度误解）③强调不构成恶意交易纠纷 ④展示整改措施（强化服务前说明、缩短响应时效、建立跟进机制）⑤提供退款凭证和投诉处理记录',
      '投诉': '辩护要点：①正面承认投诉存在并说明处理进展 ②分析投诉产生的客观原因 ③展示已落实的整改措施 ④提供投诉处理完成凭证和客户满意度反馈',
    }
    const reason = d.violation_reason || ''
    let matchedStrategy = ''
    for (const [keyword, strategy] of Object.entries(violationStrategies)) {
      if (reason.includes(keyword)) { matchedStrategy = strategy; break }
    }

    const industryTerms = {
      '游戏': '必须提及：游戏版号、防沉迷系统、实名认证、概率公示、文网文许可',
      '棋牌': '必须提及：游戏版号、防沉迷系统、实名认证、概率公示、文网文许可、无现金兑换',
      '教育': '必须提及：教育资质备案、课程大纲公示、试听机制、学员评价体系',
      '支付': '必须提及：支付牌照/代理资质、POS机入网合规、商户准入审核',
      '跨境': '必须提及：海关报关单、外汇收支许可、跨境电商备案、贸易合同',
      '贸易': '必须提及：进出口许可、贸易合同、海关申报记录、资金流可追溯',
      '医疗': '必须提及：医疗机构执业许可、医师资质、药品经营许可',
      '金融': '必须提及：金融业务牌照、合规审计报告、反洗钱制度',
    }
    let industryReq = ''
    for (const [keyword, terms] of Object.entries(industryTerms)) {
      if ((d.industry || '').includes(keyword) || reason.includes(keyword)) { industryReq = terms; break }
    }

    const appealHistory = d.appeal_history || ''
    let appealStrategy = ''
    if (/驳回|被拒|失败|不通过/.test(appealHistory)) {
      const times = appealHistory.match(/(\d+)\s*次/) ? appealHistory.match(/(\d+)\s*次/)[1] : '多'
      appealStrategy = `【重要】此为第${times}次申诉（前次被驳回），本次文案必须：①明确指出与上次申诉的不同之处 ②补充新证据 ③更深入地分析问题根因 ④展示已落实的具体整改（不是计划而是已做到的）⑤语气更诚恳但也更有理有据`
    }

    const complaintStatus = d.complaint_status || ''
    let complaintStrategy = ''
    if (/\d+.*投诉|投诉.*\d+/.test(complaintStatus)) {
      complaintStrategy = '【注意】客户有投诉记录，文案中必须正面承认投诉存在并说明处理进展，绝不能说"无投诉"或回避投诉事实'
    }

    const scenario = d.business_scenario || d.business_model || '未提供'
    const mpName = d.miniprogram_name || ''
    const mpAppid = d.miniprogram_appid || ''
    const orderInfo = d.order_info || ''

    const prompt = `你是微信商户号申诉实战专家，有10年帮助商户成功申诉的经验。你深谙微信审核人员的关注重点。

以下是用户需要填写的【微信商户后台真实申诉表单】，你需要帮用户生成每一栏可以直接复制粘贴提交的专业内容。

═══════════ 客户信息 ═══════════
- 行业：${d.industry || '未提供'}
- 经营模式：${d.business_model || '未提供'}
- 经营场景：${scenario}
- 小程序/公众号名称：${mpName || '未提供'}
- 小程序AppID：${mpAppid || '未提供'}
- 商户名称：${d.merchant_name || '未提供'}
- 公司全称：${d.company_name || '未提供'}
- 商户号：${d.merchant_id || '未提供'}
- 处罚类型：${d.problem_type || '未提供'}
- 违规原因：${d.violation_reason || '未提供'}
- 投诉情况：${complaintStatus || '无投诉'}
- 退款政策：${d.refund_policy || '未提供'}
- 交易订单信息：${orderInfo || '未提供'}
- 联系人：${d.legal_name || '未提供'}
- 联系电话：${d.contact_phone || '未提供'}
- 申诉历史：${appealHistory || '首次申诉'}
${matchedStrategy ? `\n═══════════ 针对「${reason}」的专项辩护策略 ═══════════\n${matchedStrategy}` : ''}
${industryReq ? `\n═══════════ 行业专业要求 ═══════════\n${industryReq}` : ''}
${appealStrategy ? `\n═══════════ 申诉历史注意 ═══════════\n${appealStrategy}` : ''}
${complaintStrategy ? `\n${complaintStrategy}` : ''}

═══════════ 输出要求 ═══════════

请输出JSON，5个字段。这5个字段对应微信商户后台申诉表单的真实填写栏，生成内容可直接复制粘贴提交。每个字段200-300字符（尽量接近300字，充分利用空间）：

{
  "business_model": "【业务模式说明】对应微信申诉表单「业务模式说明」栏。内容包含：①我司为XX行业，通过XX方式经营 ②主营业务为XX ③盈利模式为XX ④解释为何本业务与被指控的违规行为有本质区别。写成第一人称「我司/我方」的正式陈述，可直接复制到表单。",
  "refund_rules": "【退款机制与退款方式】对应微信申诉表单「退款机制与退款方式」栏。内容包含：①基于客户提供的退款政策优化展开 ②描述退款处理流程（申请→审核→退款） ③响应时效承诺（如24小时内审核、N个工作日退款） ④如客户原有政策不完善，用'现已优化为...'改进。写成可直接提交的正式内容。",
  "complaint_cause": "【投诉产生原因及详细说明】对应微信申诉表单「投诉产生原因及详细说明」栏。内容包含：①如实描述投诉现状（已处理/未处理） ②分析投诉根本原因 ③如有投诉必须正面承认并说明处理结果 ④说明这不构成恶意行为的理由。绝不回避负面信息，语气诚恳。",
  "complaint_resolution": "【妥善处理消费者投诉/投诉处理方法】对应微信申诉表单「投诉处理方法」栏。内容包含：①已落实的具体整改措施（用'已'表述） ②计划中的预防机制（用'将/现已着手'表述） ③投诉响应时效承诺 ④建议准备的证据材料（退款凭证、处理记录等）。",
  "supplementary": "【补充文字说明】对应微信申诉表单「补充文字说明」栏。内容包含：①恢复支付权限后的合规承诺 ②联系人+联系电话表达配合意愿 ③如有腾讯文档等补充资料链接可提及 ④提醒客户需要上传的证件照片和补充材料清单。"
}

═══════════ 铁律（违反则文案无效）═══════════
1. 【禁止编造数据】绝对不能编造客户未提供的任何具体数字、统计、日期、编号！如需引用数据，用"我方可提供XX数据证明"代替。
2. 【禁止占位符】不能出现[具体版号]、[具体日期]等方括号占位符。如需客户填入信息，用"（附：您的XX证书编号）"的格式。
3. 【禁止虚假声明】不能替客户声称已完成未确认的整改。建议做的整改用"现已着手/将"表述，客户确认的事实才用"已"。
4. 【禁止回避】有投诉就必须正面回应，不能假装没有。
5. 【禁止套话】禁用"高度重视""积极配合""竭诚服务"等空洞表述。
6. 【充分利用】每段200-300字符，信息密度要高，可直接复制到微信商户后台申诉表单提交。
7. 【第一人称】必须用"我司/我方/本公司"等第一人称撰写，这是用户直接复制提交的内容。
8. 【审核视角】微信审核员能看到商户真实交易数据，文案中的数字必须可验证，或用"可提供XX证明"。`

    // ====== SSE 流式输出 ======
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      res.write(`data: ${JSON.stringify({ type: 'start', sessionId: req.params.id })}\n\n`)

      const messages = [
        { role: 'system', content: '你是全平台商户号申诉实战专家，覆盖微信支付、支付宝、抖音、快手、美团等平台。请严格按JSON格式输出，不要输出任何其他内容。' },
        { role: 'user', content: prompt },
      ]

      let fullContent = ''
      const onComplete = async (text) => {
        const rawContent = text || fullContent
        let parsed = null
        try {
          let cleanContent = rawContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]) } catch {}
          }
          if (!parsed) {
            try { parsed = JSON.parse(cleanContent) } catch {}
          }
        } catch {}

        if (!parsed) {
          const fieldPatterns = [
            ['business_model', /"business_model"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
            ['refund_rules', /"refund_rules"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
            ['complaint_cause', /"complaint_cause"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
            ['complaint_resolution', /"complaint_resolution"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
            ['supplementary', /"supplementary"\s*:\s*"((?:[^"\\]|\\.)*)"/s],
          ]
          const extracted = {}
          let foundAny = false
          for (const [key, pattern] of fieldPatterns) {
            const m = rawContent.match(pattern)
            if (m) {
              extracted[key] = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
              foundAny = true
            }
          }
          if (foundAny) {
            parsed = extracted
            logger.info(`[AppealText] extracted ${Object.keys(extracted).length} fields from truncated JSON`)
          }
        }

        if (!parsed) {
          try {
            const sections = rawContent.split(/\n\n+/)
            parsed = {
              business_model: sections[0] || '',
              refund_rules: sections[1] || '',
              complaint_cause: sections[2] || '',
              complaint_resolution: sections[3] || '',
              supplementary: sections[4] || '',
            }
          } catch {}
        }

        if (parsed) {
          await saveAppealText({
            sessionId: req.params.id, userId: user.id,
            businessModel: parsed.business_model || '',
            refundRules: parsed.refund_rules || '',
            complaintCause: parsed.complaint_cause || '',
            complaintResolution: parsed.complaint_resolution || '',
            supplementary: parsed.supplementary || '',
            inputTokens: 0, outputTokens: 0, cost: 0,
          })

          const savedText = await getAppealText(req.params.id)
          res.write(`data: ${JSON.stringify({ type: 'done', appealText: savedText, cached: false, isOfficialMode })}\n\n`)
        } else {
          res.write(`data: ${JSON.stringify({ type: 'done', appealText: null, rawContent, error: '文案解析失败' })}\n\n`)
        }
      }

      try {
        const llm = (await import('../ai/core/llm.js')).default
        await llm.streamChat(messages, res, onComplete, {
          temperature: 0.3,
          maxTokens: 3000,
          jsonMode: false,
          enableDeepThinking: false,
          prefill: '{',
          requestType: 'appeal_text',
          cacheKey: 'appeal_text_system',
        })
      } catch (streamErr) {
        logger.error('[AppealText] streamChat error:', streamErr.message)
        res.write(`data: ${JSON.stringify({ type: 'done', appealText: null, error: `流式调用失败: ${streamErr.message}` })}\n\n`)
      }
      return
    }

    // ====== 非流式输出 ======
    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const maxRetries = 2
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 90000)
        const appealBody = {
          model: appealAiCfg.model,
          messages: [
            { role: 'system', content: '你是全平台商户号申诉实战专家，覆盖微信支付、支付宝、抖音、快手、美团等平台。请严格按JSON格式输出，不要输出任何其他内容。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          top_p: 0.7,
          max_tokens: 3000,
        }
        appealBody.response_format = { type: 'json_object' }

        const apiRes = await fetch(appealAiCfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(appealBody),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!apiRes.ok) {
          const errText = await apiRes.text().catch(() => '')
          console.error(`[${appealAiCfg.provider}] appeal API error (attempt ${attempt + 1}):`, apiRes.status, errText)
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
          return res.status(500).json({ error: `AI服务请求失败(${apiRes.status})` })
        }
        const apiData = await apiRes.json()
        content = apiData.choices?.[0]?.message?.content || ''
        inputTokens = apiData.usage?.prompt_tokens || 0
        outputTokens = apiData.usage?.completion_tokens || 0
        break
      } catch (fetchErr) {
        console.error(`[${appealAiCfg.provider}] appeal fetch error (attempt ${attempt + 1}):`, fetchErr.message)
        if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
        return res.status(500).json({ error: `AI服务连接失败：${fetchErr.name === 'AbortError' ? '请求超时(90s)' : fetchErr.message}` })
      }
    }

    if (!content) {
      return res.status(500).json({ error: 'AI返回内容为空，请重试' })
    }

    let parsed
    try {
      let cleanContent = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanContent)
    } catch (parseErr) {
      console.error('Appeal text parse error:', parseErr.message, '\nRaw:', content.substring(0, 500))
      try {
        const sections = content.split(/\n\n+/)
        parsed = {
          business_model: sections[0] || '',
          refund_rules: sections[1] || '',
          complaint_cause: sections[2] || '',
          complaint_resolution: sections[3] || '',
          supplementary: sections[4] || '',
        }
      } catch {
        return res.status(500).json({ error: '文案解析失败，请重试' })
      }
    }

    let cost = 0
    if (isOfficialMode) {
      const multiplierStr = await getSystemConfig('cost_multiplier')
      const multiplier = parseFloat(multiplierStr || '2')
      const tokenInfo = tokenizerCalculateCost(inputTokens, outputTokens, multiplier)
      cost = tokenInfo.cost
      const deductResult = await deductBalance(user.id, cost)
      if (deductResult.success) await incrementUserSpent(user.id, cost)
      await recordTokenUsage({ userId: user.id, sessionId: req.params.id, type: 'appeal_text', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, multiplier, apiMode: 'official' })
    }

    await saveAppealText({
      sessionId: req.params.id, userId: user.id,
      businessModel: parsed.business_model || '',
      refundRules: parsed.refund_rules || '',
      complaintCause: parsed.complaint_cause || '',
      complaintResolution: parsed.complaint_resolution || '',
      supplementary: parsed.supplementary || '',
      inputTokens, outputTokens, cost,
    })

    const savedText = await getAppealText(req.params.id)
    const updatedUser = await getUserById(user.id)
    res.json({ appealText: savedText, cached: false, cost, balance: updatedUser?.balance, isOfficialMode, inputTokens, outputTokens })
  } catch (err) {
    console.error('Generate appeal text error:', err)
    res.status(500).json({ error: '生成申诉文案失败' })
  }
})

// ========== 获取已生成的申诉文案 ==========

router.get('/:id/appeal-text', optionalUser, validateSessionOwnership, async (req, res) => {
  try {
    const text = await getAppealText(req.params.id)
    res.json({ appealText: text })
  } catch (err) {
    logger.error('Get appeal text error:', err)
    res.status(500).json({ error: '获取失败' })
  }
})

// ========== 申诉进度反馈 ==========

router.post('/:id/appeal-feedback', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { status, feedback, rejectionReason } = req.body
    const valid = ['submitted', 'under_review', 'approved', 'rejected', 'resubmitted']
    if (!valid.includes(status)) return res.status(400).json({ error: '无效的状态' })
    await updateAppealStatus(req.params.id, req.userId, { status, feedback, rejectionReason })

    if (status === 'approved' || status === 'rejected') {
      try {
        const session = await getSession(req.params.id)
        const d = typeof session?.collected_data === 'string'
          ? JSON.parse(session.collected_data || '{}')
          : (session?.collected_data || {})
        const { recordAppealOutcomeToCluster } = await import('../ai/appealOutcomeLearning.js')
        await recordAppealOutcomeToCluster(status, d, { feedback, rejectionReason })
      } catch (evoErr) { console.error('[Evolution] 反馈学习失败:', evoErr.message) }
    }

    const updated = await getAppealText(req.params.id)
    res.json({ success: true, appealText: updated })
  } catch (err) {
    console.error('Appeal feedback error:', err)
    res.status(500).json({ error: '更新失败' })
  }
})

// ========== 投诉材料整理 ==========

router.post('/:id/generate-complaint-doc', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const userId = req.userId
    const user = await getUserById(userId)
    if (!user) return res.status(404).json({ error: '用户不存在' })

    let apiKeyToUse = null
    let isOfficialMode = false
    const activeModel = await (await import('../db.js')).getActiveAIModel()
    const isModelFree = activeModel?.is_free === 1
    if (user.api_mode === 'custom' && user.custom_api_key) {
      apiKeyToUse = user.custom_api_key
    } else if (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFree)) {
      apiKeyToUse = null
      isOfficialMode = !isModelFree
    } else {
      return res.status(402).json({ error: '余额不足，请先充值', needRecharge: true })
    }

    const { force } = req.body
    const session = req.session
    const d = session.collected_data || {}
    if (!d.industry && !d.violation_reason && !d.problem_type) {
      return res.status(400).json({ error: '请先通过对话提供基本信息（行业、违规原因等）' })
    }

    if (!force) {
      const existing = await getComplaintDoc(req.params.id)
      if (existing) return res.json({ doc: existing, cached: true })
    }

    const aiCfg = await getAIConfig()
    const apiKey = apiKeyToUse || aiCfg.apiKey
    if (!apiKey) return res.status(500).json({ error: 'AI服务未配置' })

    const fieldLabels = {
      industry: '行业', business_model: '经营模式', business_scenario: '经营场景',
      miniprogram_name: '小程序/公众号名称', miniprogram_appid: '小程序AppID',
      problem_type: '处罚类型', violation_reason: '违规原因',
      merchant_id: '商户号', merchant_name: '商户名称',
      company_name: '公司全称', license_no: '统一社会信用代码',
      legal_name: '法人姓名', legal_id_last4: '身份证后四位',
      complaint_status: '投诉情况', refund_policy: '退款政策',
      order_info: '交易订单信息', bank_name: '开户银行',
      bank_account_last4: '结算账户后四位', contact_phone: '联系电话',
      appeal_history: '申诉历史',
    }
    const infoLines = Object.entries(d)
      .filter(([k, v]) => v && !k.startsWith('_'))
      .map(([k, v]) => `- ${fieldLabels[k] || k}: ${v}`)
      .join('\n')

    const prompt = `你是一位专业的商户申诉材料整理专家。请根据以下客户信息，生成一份完整的、可直接使用的投诉/申诉材料整理文档。

参考微信商户号申诉的真实流程，申诉材料需要包含：身份证件照片、业务模式说明、经营场景、交易订单凭证、投诉原因说明、投诉处理方法、退款机制、补充说明等。

═══════════ 客户已提供的信息 ═══════════
${infoLines || '（信息较少，请基于已有内容尽可能整理）'}

═══════════ 输出要求 ═══════════

请输出JSON，包含以下字段：

{
  "doc_title": "文档标题，如：关于XXX商户号涉嫌XXX申诉材料整理",
  "complaint_summary": "案件概述（200-400字）：用专业简洁的第一人称语言概述整个事件。包括：商户基本情况、遭遇的处罚类型和原因、当前状态、核心诉求（恢复支付权限）。",
  "merchant_info": "商户与经营信息整理：结构化格式，每项一行。必须包含：\\n商户名称：XX\\n商户号：XX\\n公司全称：XX\\n统一社会信用代码：XX\\n法人/经营者：XX\\n行业类型：XX\\n经营场景：线上/线下/线上+线下\\n线上经营平台：小程序/公众号/H5\\n小程序名称：XX\\n小程序AppID：XX\\n联系电话：XX\\n（未提供的标注「待补充」）",
  "violation_detail": "违规/处罚详情+交易订单信息（300-500字）：①处罚类型和平台给出的违规原因 ②如有交易订单号，逐笔列出（格式：微信交易订单号：XXXX / 订单商品/服务内容：XXXX） ③说明这些交易的真实性 ④处罚的影响范围",
  "evidence_list": "申诉需准备的证据材料清单：根据真实申诉表单要求，编号列出所有需要准备的材料。必须包含：\\n1. 法人/经营者身份证正面照片 — 申诉表单必传\\n2. 法人/经营者身份证反面照片 — 申诉表单必传\\n3. 法人/经营者手持身份证正面照片 — 申诉表单必传\\n4. 营业执照照片 — 证明经营资质\\n5. 小程序/公众号截图或门店照片 — 证明经营场景\\n6. 微信支付交易订单截图（2-3笔） — 证明真实交易\\n7. 投诉处理完成截图 — 证明投诉已妥善处理\\n8. 退款凭证截图 — 证明退款已执行\\n然后根据行业和违规类型补充更多（如行业许可证、服务合同、客户好评等），至少列12项。每项标注获取方式。",
  "timeline": "事件时间线：按时间顺序整理事件经过。格式为：日期/时间段 → 事件。未提供具体日期的用（具体日期待确认）标注。必须包含：注册商户号时间、正常经营期间、收到处罚通知、处理投诉/整改、提交申诉等关键节点。",
  "appeal_points": "申诉要点与策略梳理（300-500字）：①核心策略概述 ②逐条要点，每条包含论点+证据支撑 ③需要特别注意的事项 ④建议的申诉提交顺序和注意事项 ⑤如被驳回的应对预案",
  "full_document": "完整申诉文书（1000-2000字）：这是用户可以直接复制到Word打印的完整版本。格式要求：\\n\\n标题居中\\n\\n致：微信支付团队\\n\\n一、商户基本情况（简介+经营场景）\\n\\n二、关于涉嫌XX的情况说明（处罚原因+我方解释）\\n\\n三、交易真实性说明（列出订单号和内容）\\n\\n四、投诉处理情况（投诉已处理+具体措施）\\n\\n五、整改措施（已落实+计划中）\\n\\n六、退款保障机制\\n\\n七、附件清单（编号列出所有附件材料）\\n\\n恳请贵团队审核并恢复我司支付权限。\\n\\n联系人：XX 联系电话：XX\\n\\n日期：XXXX年XX月XX日\\n\\n注意使用换行分段，格式清晰专业。"
}

═══════════ 重要规则 ═══════════
1. 【禁止编造】不能编造客户未提供的具体数字、日期、编号。未知信息用（待补充：XXX）标注。
2. 【实事求是】基于客户提供的信息整理，不夸大不缩小。
3. 【专业格式】使用正式文书语言，第一人称撰写，条理清晰，可直接使用。
4. 【可操作性】证据清单要具体可执行，告诉客户每项材料在哪里获取。
5. 【真实表单对齐】必须覆盖微信真实申诉表单的所有必填项（身份证照片、业务模式、经营场景、订单凭证、投诉说明、处理方法、退款机制、补充说明）。`

    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const maxRetries = 2
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)
        const body = {
          model: aiCfg.model,
          messages: [
            { role: 'system', content: '你是专业的商户申诉材料整理专家。请严格按JSON格式输出，不要输出任何其他内容。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          top_p: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }
        const apiRes = await fetch(aiCfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!apiRes.ok) {
          const errText = await apiRes.text().catch(() => '')
          console.error(`[ComplaintDoc] API error (attempt ${attempt + 1}):`, apiRes.status, errText)
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
          return res.status(500).json({ error: `AI服务请求失败(${apiRes.status})` })
        }
        const apiData = await apiRes.json()
        content = apiData.choices?.[0]?.message?.content || ''
        inputTokens = apiData.usage?.prompt_tokens || 0
        outputTokens = apiData.usage?.completion_tokens || 0
        break
      } catch (fetchErr) {
        console.error(`[ComplaintDoc] fetch error (attempt ${attempt + 1}):`, fetchErr.message)
        if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue }
        return res.status(500).json({ error: `AI服务连接失败：${fetchErr.name === 'AbortError' ? '请求超时' : fetchErr.message}` })
      }
    }

    if (!content) return res.status(500).json({ error: 'AI返回内容为空，请重试' })

    let parsed
    try {
      let clean = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean)
    } catch {
      return res.status(500).json({ error: '材料解析失败，请重试' })
    }

    let cost = 0
    if (isOfficialMode) {
      const multiplierStr = await getSystemConfig('cost_multiplier')
      const multiplier = parseFloat(multiplierStr || '2')
      const tokenInfo = tokenizerCalculateCost(inputTokens, outputTokens, multiplier)
      cost = tokenInfo.cost
      const deductResult = await deductBalance(user.id, cost)
      if (deductResult.success) await incrementUserSpent(user.id, cost)
      await recordTokenUsage({ userId: user.id, sessionId: req.params.id, type: 'complaint_doc', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost, multiplier, apiMode: 'official' })
    }

    await saveComplaintDoc({
      sessionId: req.params.id, userId: user.id,
      docTitle: parsed.doc_title || '',
      complaintSummary: parsed.complaint_summary || '',
      merchantInfo: parsed.merchant_info || '',
      violationDetail: parsed.violation_detail || '',
      evidenceList: parsed.evidence_list || '',
      timeline: parsed.timeline || '',
      appealPoints: parsed.appeal_points || '',
      fullDocument: parsed.full_document || '',
      inputTokens, outputTokens, cost,
    })

    const saved = await getComplaintDoc(req.params.id)
    const updatedUser = await getUserById(user.id)
    res.json({ doc: saved, cached: false, cost, balance: updatedUser?.balance, isOfficialMode, inputTokens, outputTokens })
  } catch (err) {
    console.error('Generate complaint doc error:', err)
    res.status(500).json({ error: '生成投诉材料失败' })
  }
})

// ========== 获取投诉材料 ==========

router.get('/:id/complaint-doc', optionalUser, validateSessionOwnership, async (req, res) => {
  try {
    const doc = await getComplaintDoc(req.params.id)
    res.json({ doc })
  } catch (err) {
    logger.error('Get complaint doc error:', err)
    res.status(500).json({ error: '获取失败' })
  }
})

// ========== 投诉回复话术 / 申诉指导（SessionAppealContext）==========

router.post('/:id/generate-complaint-reply', requireUser, validateSessionOwnership, handlePostComplaintReply)

router.get('/:id/appeal-guide', requireUser, validateSessionOwnership, handleGetAppealGuide)

router.post('/:id/appeal-guide/generate', requireUser, validateSessionOwnership, handlePostAppealGuideGenerate)

// ========== 申诉进度追踪 ==========

router.get('/:id/appeal-progress', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const sessionId = req.params.id
    const pool = getPool()
    const [rows] = await pool.execute(
      'SELECT appeal_status, user_feedback, submitted_at, result_at, rejection_reason, resubmit_count, created_at FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    if (rows.length === 0) return res.json({ status: null, message: '尚未生成申诉文案' })
    const r = rows[0]
    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    res.json({
      status: r.appeal_status || 'generated',
      label: statusLabels[r.appeal_status] || '已生成文案',
      submitted_at: r.submitted_at,
      result_at: r.result_at,
      rejection_reason: r.rejection_reason,
      resubmit_count: r.resubmit_count || 0,
      user_feedback: r.user_feedback,
      created_at: r.created_at,
    })
  } catch (err) {
    console.error('Get appeal progress error:', err)
    res.status(500).json({ error: '获取申诉进度失败' })
  }
})

router.put('/:id/appeal-progress', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const sessionId = req.params.id
    const { status, feedback, rejectionReason } = req.body || {}
    const pool = getPool()
    const validStatuses = ['generated', 'submitted', 'under_review', 'approved', 'rejected', 'resubmitted']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' })
    }
    const [rows] = await pool.execute(
      'SELECT id FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    if (rows.length === 0) return res.status(404).json({ error: '未找到申诉记录' })

    const updates = ['appeal_status = ?']
    const params = [status]
    const now = new Date()
    if (feedback) { updates.push('user_feedback = ?'); params.push(feedback) }
    if (rejectionReason) { updates.push('rejection_reason = ?'); params.push(rejectionReason) }
    if (status === 'submitted' || status === 'resubmitted') { updates.push('submitted_at = ?'); params.push(now) }
    if (status === 'approved' || status === 'rejected') { updates.push('result_at = ?'); params.push(now) }
    if (status === 'resubmitted') { updates.push('resubmit_count = resubmit_count + 1') }

    params.push(rows[0].id)
    await pool.execute(`UPDATE appeal_texts SET ${updates.join(', ')} WHERE id = ?`, params)

    if (status === 'approved' || status === 'rejected') {
      try {
        const session = await getSession(sessionId)
        const d = typeof session?.collected_data === 'string'
          ? JSON.parse(session.collected_data || '{}')
          : (session?.collected_data || {})
        const { recordAppealOutcomeToCluster } = await import('../ai/appealOutcomeLearning.js')
        await recordAppealOutcomeToCluster(status, d, { feedback, rejectionReason })
      } catch (evoErr) {
        console.error('[Evolution] 进度反馈学习失败:', evoErr.message)
      }
    }

    const statusLabels = {
      generated: '已生成文案', submitted: '已提交申诉', under_review: '审核中',
      approved: '申诉通过', rejected: '已被驳回', resubmitted: '已重新提交'
    }
    res.json({ success: true, status, label: statusLabels[status] })
  } catch (err) {
    console.error('Update appeal progress error:', err)
    res.status(500).json({ error: '更新申诉进度失败' })
  }
})

// ========== 驳回后智能重申策略 ==========

router.post('/:id/resubmit-strategy', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const sessionId = req.params.id
    const pool = getPool()
    const session = req.session
    const d = session.collected_data || {}

    const [rows] = await pool.execute(
      'SELECT rejection_reason, resubmit_count FROM appeal_texts WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    )
    const rejectionReason = rows[0]?.rejection_reason || req.body?.rejectionReason || ''
    const resubmitCount = rows[0]?.resubmit_count || 0
    const reasonLower = rejectionReason.toLowerCase()

    const improvements = []
    const newMaterials = []
    const textFixes = []

    improvements.push({ priority: 'high', action: '拨打95017转3确认具体驳回原因', detail: '电话中记录客服的原话，这是最准确的驳回原因。话术参考「申诉指导→95017话术」Tab' })

    if (reasonLower.includes('材料') || reasonLower.includes('不完整') || reasonLower.includes('缺少') || reasonLower.includes('不足')) {
      improvements.push({ priority: 'high', action: '补充缺失材料', detail: '对照「申诉指导→材料清单」逐项检查，确保每项都有对应文件' })
      newMaterials.push('法人手持身份证+营业执照合影（如之前未提供）')
      newMaterials.push('补充更多交易订单凭证（至少5笔）')
      textFixes.push('在补充说明中列出本次新增的所有材料清单')
    }

    if (reasonLower.includes('投诉') || reasonLower.includes('纠纷') || reasonLower.includes('消费者')) {
      improvements.push({ priority: 'urgent', action: '优先处理所有消费者投诉', detail: '在商户后台→消费者投诉中逐一回复并协商解决，目标：投诉状态全部变为"已处理完成"' })
      newMaterials.push('所有投诉的处理完成截图')
      newMaterials.push('退款凭证截图（每笔投诉对应的退款记录）')
      newMaterials.push('消费者确认已解决的聊天截图（如有）')
      textFixes.push('在「投诉产生原因」中详细说明每笔投诉的处理结果')
      textFixes.push('在「投诉处理方法」中新增已落实的整改措施')
    }

    if (reasonLower.includes('真实') || reasonLower.includes('交易') || reasonLower.includes('虚假') || reasonLower.includes('刷单')) {
      improvements.push({ priority: 'high', action: '补充交易真实性证据', detail: '每笔被质疑的订单都需要：订单截图+物流单号+签收记录+客户沟通记录' })
      newMaterials.push('物流签收记录（含签收照片）')
      newMaterials.push('与买家的微信/电话沟通记录截图')
      newMaterials.push('进货合同或供应商发票')
      newMaterials.push('仓库实拍照片（含商品和包装）')
      textFixes.push('在业务模式说明中详细描述完整的交易流程')
    }

    if (reasonLower.includes('整改') || reasonLower.includes('违规') || reasonLower.includes('合规')) {
      improvements.push({ priority: 'high', action: '提供整改证据', detail: '截图保存整改前后的对比，撰写详细的整改措施说明' })
      newMaterials.push('整改前后对比截图')
      newMaterials.push('《整改措施说明书》（含具体措施+执行时间+责任人）')
      textFixes.push('在补充说明中重点描述已完成的整改措施和预防机制')
    }

    if (reasonLower.includes('资质') || reasonLower.includes('许可') || reasonLower.includes('证照')) {
      improvements.push({ priority: 'high', action: '补充行业资质证明', detail: '提供与经营范围对应的所有资质证书' })
      newMaterials.push('行业经营许可证（如食品/医疗/教育等）')
      newMaterials.push('相关从业人员资质证明')
    }

    if (reasonLower.includes('说明') || reasonLower.includes('不清') || reasonLower.includes('模糊')) {
      improvements.push({ priority: 'medium', action: '优化申诉文案表述', detail: '重新生成申诉文案，使用更具体的数据和事实，避免模糊表述' })
      textFixes.push('用具体数字替代模糊描述（如"大量"→"共15笔，金额合计¥3,200"）')
      textFixes.push('每段申诉文案都要有对应的证据支撑')
    }

    if (resubmitCount >= 2) {
      improvements.push({ priority: 'medium', action: '考虑寻求专业协助', detail: '多次被驳回说明案件有一定难度，专业团队可以帮助分析具体问题并针对性优化' })
    }
    improvements.push({ priority: 'medium', action: '重新生成申诉文案', detail: '在平台点击「📄 申诉文案」重新生成，系统会根据最新信息优化内容' })

    res.json({
      rejection_reason: rejectionReason,
      resubmit_count: resubmitCount,
      improvements,
      new_materials: newMaterials,
      text_fixes: textFixes,
      timeline: resubmitCount >= 2 ? '建议准备5-7天后重新提交' : '建议准备3-5天后重新提交',
      tip: '每次重新申诉必须有实质性的新证据或新说明，切勿简单重复提交',
    })
  } catch (err) {
    console.error('Resubmit strategy error:', err)
    res.status(500).json({ error: '生成重申策略失败' })
  }
})

// ========== 深度分析 ==========

router.get('/:id/deep-analysis', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params

    const hasQuota = await checkDeepAnalysisQuota(req.userId)
    if (!hasQuota) {
      return res.status(403).json({ error: '深度分析次数已用完' })
    }

    const messages = await getMessages(id)

    const analysis = await performDeepAnalysis(req.session, messages)
    await saveDeepAnalysisResult(id, analysis)
    await incrementDeepAnalysisCount(req.userId)

    res.json({ success: true, analysis })
  } catch (error) {
    logger.error('Deep analysis error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id/deep-analysis-result', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const { id } = req.params
    const result = await getDeepAnalysisResult(id)
    res.json({ success: true, result })
  } catch (error) {
    logger.error('Get deep analysis result error:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router

async function performDeepAnalysis(session, messages) {
  const d = session.collected_data || {}

  const riskIndicators = []
  if (/套现|赌博|洗钱|欺诈/.test(d.violation_reason || '')) {
    riskIndicators.push({ level: 'high', factor: '严重违规类型', detail: `${d.violation_reason}属于高风险违规类别，审核标准严格` })
  }
  if (/\d+.*投诉|投诉.*\d+/.test(d.complaint_status || '') && !/处理完|已解决|已退款/.test(d.complaint_status || '')) {
    riskIndicators.push({ level: 'high', factor: '未处理投诉', detail: '存在未处理的消费者投诉，会显著降低申诉成功率' })
  }
  if (/驳回|被拒|失败|不通过/.test(d.appeal_history || '')) {
    riskIndicators.push({ level: 'medium', factor: '非首次申诉', detail: '有过申诉被驳回记录，再次审核会更严格' })
  }
  if (!d.order_info && !d.refund_policy) {
    riskIndicators.push({ level: 'medium', factor: '信息不完整', detail: '缺少交易订单信息和退款政策，影响申诉材料完整性' })
  }

  let baseSuccessRate = 70
  for (const indicator of riskIndicators) {
    if (indicator.level === 'high') baseSuccessRate -= 15
    else if (indicator.level === 'medium') baseSuccessRate -= 8
  }
  if (d.miniprogram_appid || d.contact_phone) baseSuccessRate += 5
  if (/处理完|已解决|已退款/.test(d.complaint_status || '')) baseSuccessRate += 10
  baseSuccessRate = Math.max(15, Math.min(92, baseSuccessRate))

  const suggestions = [
    ...(riskIndicators.length > 0 ? [{ priority: 'urgent', text: `优先处理高风险因素：${riskIndicators.map(i => i.factor).join('、')}` }] : []),
    { priority: 'high', text: '确保所有消费者投诉均已处理完成并在后台标记"处理完成"' },
    { priority: 'high', text: '准备充分的证据材料：身份证件、营业执照、交易凭证、投诉处理截图等' },
    { priority: 'recommended', text: '申诉提交后2-3天内拨打95017跟进审核进度' },
    ...(!d.refund_policy ? [{ priority: 'recommended', text: '制定明确的退款政策并在申诉材料中说明' }] : []),
  ]

  const chatSummary = messages
    .filter(m => m.role === 'assistant' && m.content.length > 50)
    .slice(-5)
    .map(m => m.content.substring(0, 200))

  return {
    risk_level: riskIndicators.some(i => i.level === 'high') ? 'high' : riskIndicators.length > 2 ? 'medium' : 'low',
    success_rate: baseSuccessRate / 100,
    success_rate_display: `${baseSuccessRate}%`,
    risk_indicators: riskIndicators,
    key_findings: [
      `违规类型：${d.violation_reason || '未确认'}`,
      `处罚措施：${d.problem_type || '未确认'}`,
      `行业领域：${d.industry || '未确认'}`,
      `投诉状态：${d.complaint_status || '无投诉记录'}`,
      `申诉历史：${d.appeal_history || '首次申诉'}`,
      `信息完整度：${Object.keys(d).filter(k => d[k]).length}/18 项已填写`,
    ],
    suggestions,
    chat_analysis_summary: chatSummary.length > 0 ? `对话中已讨论${messages.length}轮，最近的关键话题包括：${chatSummary.slice(0, 3).join('；')}` : '暂无足够的对话记录进行分析',
    analyzed_at: new Date().toISOString(),
    data_fields_collected: Object.keys(d).filter(k => d[k]),
  }
}
