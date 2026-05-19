import { getMessages, getUserById, getActiveAIModel, checkDeepAnalysisQuota, incrementDeepAnalysisCount, saveDeepAnalysisResult, deductBalance, incrementUserSpent, recordTokenUsage, getSystemConfig } from '../db.js'
import { getAIConfig } from '../ai.js'
import { calculateCost } from '../tokenizer.js'
import { generateStrategy } from '../services/sessionAnalysis.js'
import { stripEmoji } from '../lib/textUtils.js'
import { validateSessionOwnership } from '../middleware/sessionAccess.js'

export function registerDeepAnalysisRoute(app, ctx) {
  const { requireUser } = ctx
  app.get('/api/sessions/:id/deep-analysis', requireUser, validateSessionOwnership, async (req, res) => {
  try {
    const session = req.session
    const d = session.collected_data || {}
    const filledKeys = Object.keys(d).filter(k => d[k] != null && String(d[k]).trim())
    if (filledKeys.length < 1) return res.json({ deepAnalysis: null, reason: 'not_enough_data' })

    // 同时生成本地分析作为兜底
    const { matchViolation: mv2, matchBuiltInCases: mbc2, assessRisk: ar2, generateMaterialChecklist: gmc2 } = await import('../knowledgeBase.js')
    const { matchIndustry: mi2 } = await import('../localAI.js')
    const localRisk = ar2(d)
    const localViolation = mv2(d.violation_reason || '')
    const localIndustry = mi2(d.industry || '')
    const localCases = mbc2(d.problem_type, d.industry, d.violation_reason)
    const localChecklist = gmc2(d)
    const localStrategy = generateStrategy(d, localRisk, localViolation, localIndustry)

    const localAnalysis = {
      risk: localRisk,
      violation: localViolation ? { key: localViolation.key, description: localViolation.description, estimated_success_rate: localViolation.estimated_success_rate, success_key: localViolation.success_key, appeal_key_points: localViolation.appeal_key_points, required_materials: localViolation.required_materials, common_rejection_reasons: localViolation.common_rejection_reasons } : null,
      industry: localIndustry ? { key: localIndustry.key, appealTips: localIndustry.appealTips, commonViolations: localIndustry.commonViolations, businessModel: localIndustry.businessModel } : null,
      matchedCases: localCases.slice(0, 5).map(c => ({ title: c.title, industry: c.industry, problem_type: c.problem_type, success_summary: c.success_summary, appeal_points: c.appeal_points })),
      checklist: localChecklist,
      strategy: localStrategy,
    }

    // 获取完整聊天记录（包括AI回复，提取上下文）
    const allMessages = await getMessages(req.params.id)
    const chatPairs = allMessages.slice(-40).map(m => ({
      role: m.role === 'user' ? '客户' : '顾问',
      content: m.content?.length > 300 ? m.content.slice(0, 300) + '...' : m.content,
    }))

    // ===== 计费逻辑：会员免费(月100次)，免费用户按token收费 =====
    let apiKey = null
    let isMemberFree = false
    let chargeUser = null
    let isOfficialMode = false
    const userId = req.userId
    if (userId) {
      const user = await getUserById(userId)
      chargeUser = user
      if (user?.api_mode === 'custom' && user.custom_api_key) {
        apiKey = user.custom_api_key
        // 自定义key用户：检查月度配额
        const quota = await checkDeepAnalysisQuota(user.id)
        isMemberFree = quota.isMember && quota.allowed
      } else if (user?.api_mode === 'official') {
        const activeModelDA = await getActiveAIModel()
        const isModelFreeDA = activeModelDA?.is_free === 1
        const quota = await checkDeepAnalysisQuota(user.id)
        if (quota.isMember && quota.allowed) {
          // 会员用户且未超月限额：免费
          apiKey = (await getAIConfig()).apiKey
          isMemberFree = true
          isOfficialMode = true
        } else if (quota.isMember && !quota.allowed) {
          // 会员但已用完本月额度
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'quota_exceeded', quota: { used: quota.used, limit: quota.limit } })
        } else if (parseFloat(user.balance) > 0 || isModelFreeDA) {
          // 非会员但有余额 或 使用免费模型：允许
          apiKey = (await getAIConfig()).apiKey
          isOfficialMode = !isModelFreeDA // 免费模型不扣费
        } else {
          return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_balance' })
        }
      }
    }
    if (!apiKey) {
      // 没有用户或用户无付费能力 → 不允许使用系统key白嫖
      if (!chargeUser) return res.json({ deepAnalysis: null, localAnalysis, reason: 'login_required' })
      // 自定义Key用户但未配置Key → 不应回退到系统Key
      if (chargeUser.api_mode === 'custom' && !chargeUser.custom_api_key) {
        return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_custom_key' })
      }
      apiKey = (await getAIConfig()).apiKey
    }
    if (!apiKey) return res.json({ deepAnalysis: null, localAnalysis, reason: 'no_api_key' })

    // ===== 构建超详细分析 prompt =====
    const fieldLabels = {
      industry: '业务类型', business_model: '经营模式',
      problem_type: '处罚类型', violation_reason: '违规原因',
      merchant_id: '商户号', merchant_name: '商户名称',
      company_name: '公司全称', license_no: '统一社会信用代码',
      legal_name: '法人姓名', legal_id_last4: '身份证后四位',
      complaint_status: '投诉情况', refund_policy: '退款政策',
      bank_name: '开户银行', bank_account_last4: '结算账户后四位',
      contact_phone: '联系电话', appeal_history: '申诉历史',
    }

    // 收集信息区
    let dataSection = '## 一、客户基础信息（系统已收集）\n\n'
    const missingFields = []
    for (const [key, label] of Object.entries(fieldLabels)) {
      if (d[key] != null && String(d[key]).trim()) {
        dataSection += `- **${label}**：${d[key]}\n`
      } else {
        missingFields.push(label)
      }
    }
    if (missingFields.length > 0) {
      dataSection += `\n以下信息尚未收集：${missingFields.join('、')}\n`
    }

    // 聊天记录区（完整对话，包含AI回复）
    let chatSection = '\n\n## 二、完整对话记录\n\n请仔细阅读以下对话，从中提取客户透露的所有有价值信息（比如客户可能在回答问题时额外提到了自己的经营细节、遇到的具体困难、之前尝试过什么方法等）。\n\n'
    if (chatPairs.length > 0) {
      chatPairs.forEach((m, i) => {
        chatSection += `**${m.role}**：${m.content}\n\n`
      })
    } else {
      chatSection += '（暂无对话记录）\n'
    }

    // 行业知识库注入（针对匹配到的行业）
    let industryKnowledge = ''
    if (localIndustry) {
      industryKnowledge = `\n\n## 三、行业专业知识（${localIndustry.key}行业）\n\n` +
        `- **常见违规类型**：${localIndustry.commonViolations.join('、')}\n` +
        `- **申诉要点**：${localIndustry.appealTips}\n` +
        `- **典型经营模式**：${localIndustry.businessModel}\n` +
        `\n请结合以上${localIndustry.key}行业特点，给出针对性分析。比如：\n` +
        `- 餐饮行业 → 围绕食品安全许可证、门店照片、外卖平台数据\n` +
        `- 财税服务 → 围绕代理记账许可证、服务合同、客户服务记录\n` +
        `- 电商 → 围绕店铺后台数据、物流发货记录、进货合同\n` +
        `- 科技/SaaS → 围绕软件著作权、服务合同、客户验收报告\n` +
        `- 教育培训 → 围绕办学许可证、课程大纲、学员评价、退费政策\n`
    }

    // 违规知识库注入（针对匹配到的违规类型）
    let violationKnowledge = ''
    if (localViolation) {
      violationKnowledge = `\n\n## 四、违规类型专业知识（${localViolation.key}）\n\n` +
        `- **严重程度**：${localViolation.severity}/5\n` +
        `- **定义**：${localViolation.description}\n` +
        `- **预估成功率**：${localViolation.estimated_success_rate}\n` +
        `- **申诉关键**：${localViolation.success_key}\n` +
        `- **申诉要点**：\n${localViolation.appeal_key_points.map(p => `  - ${p}`).join('\n')}\n` +
        `- **需要准备的材料**：${localViolation.required_materials.join('、')}\n` +
        `- **常见驳回原因**：${localViolation.common_rejection_reasons.join('、')}\n`
    }

    // 成功案例注入
    let casesSection = ''
    if (localCases.length > 0) {
      casesSection = '\n\n## 五、相似成功案例参考\n\n'
      localCases.slice(0, 3).forEach((c, i) => {
        casesSection += `**案例${i + 1}：${c.title}**\n` +
          `- 行业：${c.industry} | 处罚：${c.problem_type} | 违规：${c.violation_reason}\n` +
          `- 成功摘要：${c.success_summary}\n` +
          `- 关键策略：${c.key_strategy}\n` +
          `- 申诉要点：${c.appeal_points.join('；')}\n` +
          `- 时间线：${c.timeline}\n\n`
      })
    }

    const merchantId = d.merchant_id || '未提供'
    const merchantName = d.merchant_name || '未提供'

    const analysisPrompt = `你是微信商户号申诉实战专家，处理过上千起各类商户申诉案件。现在请根据以下客户信息，输出一份**可以直接照着操作的实战分析报告**。

${dataSection}${chatSection}${industryKnowledge}${violationKnowledge}${casesSection}

---

# 输出要求

直接输出格式化中文文本（不要JSON、不要代码块）。**所有内容必须针对该客户的具体行业（${d.industry || '未知'}）、违规原因（${d.violation_reason || '未知'}）、处罚类型（${d.problem_type || '未知'}）来写，禁止输出通用模板。**

严格按以下格式输出：

## 案件概况

用2-3句话概括：${merchantName}（商户号${merchantId}）是做什么的、遇到了什么处罚、违规原因是什么。从对话记录中提取客户提到的关键细节（处罚时间、之前尝试过什么、紧急程度等）一并写出。

## 风险评估

- **难度等级**：简单/中等/较难/困难/极难
- **难度评分**：X/100
- **预估成功率**：XX-XX%
- **核心难点**：
  - 难点1（针对该客户具体情况）
  - 难点2
  - 难点3

## 资质要求

根据客户的行业类型「${d.industry || '未知'}」和违规原因「${d.violation_reason || '未知'}」，列出申诉必须具备的资质证照。每项写清楚：资质名称、去哪里办/获取、是否该客户必须有。

### 基础资质（所有商户必备）
- **营业执照**：要求四角完整、字迹清晰的原件照片，确保经营范围覆盖实际业务
- **法人身份证**：正反面照片 + 法人手持身份证半身照

### 行业资质（${d.industry || ''}行业需要）
根据该客户所在的具体行业，列出行业特有的必需资质。例如：
- 餐饮 → 食品经营许可证、卫生许可证
- 教育 → 办学许可证、教师资格证
- 医疗 → 医疗机构执业许可证
- 电商 → 进货合同/供应商资质
- 科技/SaaS → 软件著作权、ICP备案
- 金融 → 相关金融业务许可证
请只列该客户行业实际需要的，不要列不相关的。

### 特殊资质（该违规原因需要）
根据违规原因额外需要的资质或证明文件。

## 证据链构建

**这是申诉成功的关键。** 审核人员需要看到一条完整的证据链来证明经营合法性。请根据客户情况，构建一条从"资质→经营→交易→交付"的完整证据链。

### 第一层：主体合法性
- 具体要准备什么来证明商户主体合法（针对该客户）

### 第二层：经营真实性
- 具体要准备什么来证明有真实经营场景（针对该客户的行业和经营模式）

### 第三层：交易真实性
- 具体要准备什么来证明交易是真实的（举出3-5笔订单应该怎么提供完整链路）

### 第四层：问题已整改
- 针对该客户的违规原因「${d.violation_reason || ''}」，具体要准备什么来证明问题已解决
${(d.violation_reason || '').includes('纠纷') || (d.violation_reason || '').includes('投诉') ? '- 重点：每笔投诉的退款凭证、消费者撤诉截图、完善的售后政策' : ''}
${(d.violation_reason || '').includes('跨类目') || (d.violation_reason || '').includes('类目') ? '- 重点：已下架不符商品截图、类目变更申请、营业执照经营范围证明' : ''}
${(d.violation_reason || '').includes('套现') ? '- 重点：每笔大额订单的完整链路（下单→发货→物流→签收）' : ''}
${(d.violation_reason || '').includes('欺诈') || (d.violation_reason || '').includes('售假') ? '- 重点：品牌授权书、质检报告、正品进货凭证' : ''}
${(d.violation_reason || '').includes('分销') ? '- 重点：分销系统后台截图证明仅一级分佣、无入门费' : ''}

## 材料清单

按分类列出所有需要准备的具体材料。每项标注【必需】或【建议】，写清楚怎么准备、去哪获取、格式要求（照片/截图/文档/PDF）。

### 证件资质类
- 【必需/建议】材料名：获取方式、格式要求、注意事项

### 经营证明类
- 根据该客户行业列出经营场景证明材料

### 交易凭证类
- 列出需要准备的订单、物流、发货相关凭证

### 整改证据类
- 针对该违规原因需要的整改证明材料
${(d.problem_type || '').includes('冻结') || (d.problem_type || '').includes('延迟') ? `
### 资金解冻类
- 结算账户开户信息（银行：${d.bank_name || '待提供'}，后四位：${d.bank_account_last4 || '待提供'}）
- 交易流水明细导出
- 资金来源合法性说明` : ''}

## 风控触发逆向推演

这是本报告最有价值的部分。请站在微信风控系统的角度，逆向推演：
1. **该商户为什么被标记？** — 风控系统可能检测到了什么异常信号？（如交易模式突变、投诉率飙升、交易对手集中度过高等）
2. **触发的是哪一层风控？** — 是规则引擎（硬性规则）还是模型层（行为模式异常）还是人工复核（举报/投诉触发）？
3. **审核人员最关心什么？** — 基于该违规类型，人工审核时重点看哪些证据？
4. **我们的反驳策略** — 针对风控系统可能的判定逻辑，用什么证据来逐一反驳

## 行动计划

按时间顺序给出具体步骤，每步写清楚：做什么、怎么做、去哪做、预计耗时。

### 第一阶段：立即执行（D0，今天）
- 具体要做的第一件事（最紧急的）
- 如有未处理投诉，必须先处理

### 第二阶段：准备材料（D1-D3）
- 按材料清单逐一准备，标注优先级
- 写清楚每份材料去哪获取、什么格式

### 第三阶段：提交申诉（D3-D4）
- 通过什么渠道提交（商户平台/商家助手/95017）
- 最佳提交时间：工作日上午9-11点
- 材料组织顺序建议

### 第四阶段：跟进催审（D5-D7）
- 提交后第3个工作日拨打95017转3催审
- 话术和注意事项

### 第五阶段：二次申诉预案（如被驳回）
- 常见驳回原因及对应的补充方案
- 二次申诉的时间间隔建议（至少间隔3-5天）
- 增量证据的准备方向

## 申诉话术

给出拨打95017和提交申诉时可以直接使用的话术模板。

### 电话话术（95017转3）
**首次致电（提交前摸底）**：
"您好，我是商户号${merchantId}的${d.legal_name || '法人'}，我们商户因${d.violation_reason || '违规原因'}被${d.problem_type || '处罚'}。我现在正在准备申诉材料，想请问一下具体的违规详情和需要准备哪些材料？以便我针对性准备。"

**催审致电（提交后3天）**：
"您好，我是商户号${merchantId}，我在X月X日通过商户平台提交了申诉材料，包括营业执照、交易凭证、整改说明等完整材料。想请问一下目前审核进度如何？"

### 申诉信核心内容
给出一段300字以内的申诉信核心段落，包含五个要素：
1. 商户身份介绍（公司名+商户号+业务简述）
2. 对违规判定的回应（承认问题/解释误判）
3. 整改措施说明（已做了什么、后续计划）
4. 证据概述（准备了哪些证明材料）
5. 恳请恢复（表达诚意和承诺）
内容必须针对该客户的具体行业「${d.industry || ''}」和违规原因「${d.violation_reason || ''}」来写，不要使用通用模板。

## 申诉最佳时机

根据该客户的情况，给出申诉时机建议：
- 现在是否适合立即申诉？还是需要先做某些准备？
- 如果有未处理投诉，建议先处理完再申诉（投诉率是审核重点）
- 如果之前被驳回过，建议间隔多久？需要准备什么增量证据？
- 最佳提交时间段：工作日上午9-11点（审核人员工作效率最高）

## 报价参考

根据该案件的实际难度和工作量，给出市场参考价格：
- 本案件的难度等级和对应的市场服务费用区间
- 说明本次AI咨询生成的报告和材料可免费自行使用
- 如需人工1对1辅导，建议的费用范围

---

# 硬性要求
1. **必须引用客户具体信息**：商户号${merchantId}、名称${merchantName}、行业${d.industry || ''}、违规原因${d.violation_reason || ''}。
2. **必须引用对话记录内容**：客户在对话中提到的任何细节都要体现在分析中。
3. **资质和材料必须针对该行业**：不要列与该客户行业无关的资质。
4. **每项材料都要说清楚怎么准备**：不要只说"准备营业执照"，要说"营业执照原件照片，四角完整、字迹清晰、要能看到经营范围"。
5. **证据链必须完整**：从主体→经营→交易→整改，形成闭环。
6. **风控逆向推演必须具体**：不要泛泛而谈，要基于该客户的具体数据推理。
7. **所有建议可直接执行**：杜绝空话套话，每条建议都要有具体操作步骤。
8. **行动计划必须带时间线**：让客户知道每一步什么时候做。`

    // ===== SSE 流式输出 =====
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // 先发送本地分析（立即可用）
    res.write(`data: ${JSON.stringify({ type: 'local', localAnalysis })}\n\n`)

    const aiCfg = await getAIConfig()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    const apiRes = await fetch(aiCfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || aiCfg.apiKey}` },
      body: JSON.stringify({ model: aiCfg.model, messages: [{ role: 'user', content: analysisPrompt }], temperature: 0.3, top_p: 0.7, max_tokens: 4096, stream: true, stream_options: { include_usage: true } }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!apiRes.ok) {
      console.error(`[${aiCfg.provider}] analysis stream error:`, apiRes.status)
      res.write(`data: ${JSON.stringify({ type: 'error', reason: `api_error_${apiRes.status}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // 流式读取 AI 响应
    let fullContent = ''
    let inputTokens = 0, outputTokens = 0
    const reader = apiRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue
          try {
            const chunk = JSON.parse(payload)
            const rawDelta = chunk.choices?.[0]?.delta?.content || ''
            if (rawDelta) {
              fullContent += rawDelta
              const delta = stripEmoji(rawDelta)
              if (delta) res.write(`data: ${JSON.stringify({ type: 'chunk', text: delta })}\n\n`)
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens
              outputTokens = chunk.usage.completion_tokens || outputTokens
            }
          } catch {}
        }
      }
    } catch (streamErr) {
      console.error('Stream read error:', streamErr.message)
    }

    // 保存分析结果到数据库
    if (fullContent.trim()) {
      try { await saveDeepAnalysisResult(req.params.id, fullContent) } catch (e) { console.error('Save analysis error:', e.message) }
    }

    // 计费结算
    let billing = { type: 'free', cost: 0 }
    if (userId && chargeUser) {
      await incrementDeepAnalysisCount(chargeUser.id)
      if (isMemberFree) {
        billing = { type: 'member_free', cost: 0, message: '会员免费额度' }
      } else if (isOfficialMode) {
        const multiplierStr = await getSystemConfig('cost_multiplier')
        const multiplier = parseFloat(multiplierStr || '2')
        const tokenInfo = calculateCost(inputTokens, outputTokens, multiplier)
        const deductResult = await deductBalance(chargeUser.id, tokenInfo.cost)
        if (deductResult.success) {
          await incrementUserSpent(chargeUser.id, tokenInfo.cost)
          try { await recordTokenUsage({ userId: chargeUser.id, sessionId: req.params.id, type: 'deep_analysis', inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, cost: tokenInfo.cost, multiplier, apiMode: 'official' }) } catch {}
        }
        const updatedUser = await getUserById(chargeUser.id)
        billing = { type: 'token_charge', cost: tokenInfo.cost, balance: updatedUser?.balance, tokenInfo }
      }
    }

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', billing, tokens: { input: inputTokens, output: outputTokens } })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Deep analysis error:', err.message)
    try {
      if (!res.headersSent) {
        res.json({ deepAnalysis: null, reason: 'error', message: err.message })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', reason: 'error', message: err.message })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } catch { res.end() }
  }
})
}
