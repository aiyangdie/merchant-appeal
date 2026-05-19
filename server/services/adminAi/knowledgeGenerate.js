import { getAIConfig } from '../../shared/aiConfig.js'
import { createSuccessCase, getSuccessCases } from '../../db.js'
import { parseAiJson } from './shared.js'

function normalizeCaseFields(parsed) {
  return {
    title: String(parsed.title || parsed.标题 || parsed.caseTitle || '').trim(),
    industry: String(parsed.industry || parsed.行业 || '').trim(),
    problemType: String(
      parsed.problemType || parsed.problem_type || parsed.处罚类型 || parsed.问题类型 || ''
    ).trim(),
    successSummary: String(
      parsed.successSummary || parsed.success_summary || parsed.成功要点 || parsed.成功摘要 || ''
    ).trim(),
    adminNotes: String(parsed.adminNotes || parsed.admin_notes || parsed.备注 || '').trim(),
    reportContent: String(parsed.reportContent || parsed.report_content || parsed.报告 || '').trim(),
  }
}

/**
 * 根据管理员自然语言描述，AI 生成并写入成功案例
 * @param {string} instruction
 * @param {{ adminId?: number }} ctx
 */
export async function generateAndCreateKnowledgeCase(instruction, ctx = {}) {
  const text = String(instruction || '').trim()
  if (!text) throw new Error('请描述要生成的案例内容')

  const cfg = await getAIConfig()
  if (!cfg?.apiKey) throw new Error('AI 未配置，请先在系统设置中配置模型')

  const existing = await getSuccessCases('active')
  const references = existing.slice(0, 8).map((c) => ({
    title: c.title,
    industry: c.industry,
    problem_type: c.problem_type,
    success_summary: (c.success_summary || '').slice(0, 200),
  }))

  const systemPrompt = `你是微信商户号申诉平台的「成功案例知识库」编辑。管理员会用自然语言描述希望新增的案例，你需要生成一条可直接入库的结构化案例。

## 已有案例参考（风格与粒度，勿照抄）
${references.length ? JSON.stringify(references, null, 2) : '（暂无，请按常见图文/电商商户申诉场景合理撰写）'}

## 输出格式（仅 JSON，无 markdown 代码块）
{
  "title": "案例标题，12-28字，突出行业+结果",
  "industry": "行业，如：图文广告、餐饮、电商",
  "problemType": "违规/处罚类型，如：虚假宣传、类目不符",
  "successSummary": "成功要点 80-200 字，写可复用的申诉策略与材料要点",
  "adminNotes": "管理员内部备注，可选，60字内",
  "reportContent": "可选，申诉报告提纲或关键段落（markdown），无则空字符串"
}

## 规则
1. 根据管理员描述创作，可合理推断细节，但不要编造具体金额、判决书号。
2. 每个字段须有实质内容，禁止「待补充」「示例」等占位语。
3. title、industry、problemType、successSummary 为必填。`

  const aiRes = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ instruction: text }) },
      ],
      temperature: 0.35,
      max_tokens: 1800,
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '')
    throw new Error(`AI 生成失败: ${aiRes.status} ${errText.slice(0, 120)}`)
  }

  const data = await aiRes.json()
  if (data.usage) {
    try {
      const { trackAIUsage } = await import('../../ai/usageTracker.js')
      await trackAIUsage({
        userId: 0,
        type: 'admin_knowledge_ai',
        usage: data.usage,
        provider: cfg.provider,
        modelName: cfg.model,
        detailSummary: `知识库：AI 生成成功案例`,
        context: { action: 'generate_case', instructionPreview: text.slice(0, 120) },
      })
    } catch {
      /* usage tracking optional */
    }
  }

  const raw = data.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = parseAiJson(raw)
  } catch {
    throw new Error('AI 返回格式无法解析，请换种说法重试')
  }

  const fields = normalizeCaseFields(parsed)
  if (!fields.title || !fields.successSummary) {
    throw new Error('AI 未生成完整案例（缺少标题或成功要点），请补充描述后重试')
  }

  const id = await createSuccessCase({
    sessionId: null,
    title: fields.title,
    industry: fields.industry,
    problemType: fields.problemType,
    collectedData: {},
    reportContent: fields.reportContent,
    successSummary: fields.successSummary,
    adminNotes: fields.adminNotes,
  })

  return { id, ...fields }
}
