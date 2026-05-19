import llmService from '../ai/core/llm.js'
import logger from '../utils/logger.js'

const APPEAL_TYPES = {
  situation_statement: '情况说明',
  commitment_letter: '承诺书',
  rectification_report: '整改报告',
  customer_service_script: '客服沟通话术',
  urgent_appeal: '加急申诉文案',
  rejection_supplement: '驳回补充申诉材料',
  phone_script: '95017电话沟通文案',
  full_package: '全套申诉材料',
}

const SYSTEM_PROMPT = `你是微信支付/支付宝商户号处罚申诉文案专家。

核心规则：
1. 基于真实情况撰写，不编造事实数据
2. 用中性词："经营不规范""管理疏忽""流程不完善"
3. 禁用敏感词：套现/刷单/洗钱/虚假交易/赌博/欺诈/传销/非法集资/违规套码/二清/资金池/跑分/色情/涉赌
4. 数据量化整改成效（如"投诉率下降85%"）

四段式结构：认错→原因→整改→恳请

处罚类型：
- 限制收款：交易异常/投诉率过高，需证明交易真实性
- 冻结资金：涉嫌违规，需说明资金来源用途
- 关闭支付权限：严重违规，需全面整改

审核要点：整改是否彻底、是否可能再犯、经营是否合规

JSON输出：严格合法JSON，字段值中文，数组≥2元素，content含完整正文，所有字段必填`

const COPYWRITING_STOP_SEQUENCES = ['```', '---', '===', '备注：']

const COPYWRITING_PROMPTS = {
  situation_statement: `写《情况说明》。商户：{merchant_info}\n结构：基本信息→经营情况→异常原因→证据→诚恳表态。300-500字。正式诚恳。\n输出JSON：{"title":"","content":"","key_points":[],"evidence_list":[]}`,

  commitment_letter: `写《合规经营承诺书》。商户：{merchant_info}\n结构：承诺人→承诺事项(5条)→违约责任→期限→签名。200-400字。郑重坚定。\n输出JSON：{"title":"","content":"","commitment_items":[],"validity_period":""}`,

  rectification_report: `写《整改报告》。商户：{merchant_info}\n结构：问题概述→原因→措施(即时/短期/长期)→成效→保障。500-800字。认真务实。\n输出JSON：{"title":"","content":"","immediate_actions":[],"short_term_actions":[],"long_term_actions":[],"evidence_list":[]}`,

  customer_service_script: `写客服沟通话术。商户：{merchant_info}\n2场景(在线客服/用户回访)，每场景含开场白/核心/Q&A/结束语。礼貌专业。\n输出JSON：{"scenes":[{"scene_name":"","opening":"","key_points":[],"qa":[{"question":"","answer":""}],"closing":""}],"tips":[]}`,

  urgent_appeal: `写加急申诉文案。商户：{merchant_info}\n紧急原因→核心诉求→证据→诚恳表态。150-300字。紧迫有礼。\n输出JSON：{"title":"","content":"","urgent_reason":"","key_evidence":[],"expected_resolution":""}`,

  rejection_supplement: `写驳回补充申诉。商户：{merchant_info}\n驳回：{rejection_info}\n感谢→逐条回应→补充整改→恳请审核。300-500字。感恩诚恳。\n输出JSON：{"title":"","content":"","rejection_responses":[{"rejection_point":"","response":"","new_evidence":""}],"additional_evidence":[],"summary":""}`,

  phone_script: `写95017电话文案。商户：{merchant_info}\n自我介绍→来电目的→核心诉求→证据→请求处理。含脚本/Q&A/注意事项。礼貌坚定。\n输出JSON：{"script":"","key_talking_points":[],"anticipated_questions":[{"question":"","answer":""}],"do_list":[],"dont_list":[]}`,

  full_package: `生成全套申诉材料。商户：{merchant_info}\n含：情况说明+承诺书+整改报告+客服话术+95017电话文案。逻辑一致，证据互证。每部分精简。\n输出JSON：{"situation_statement":{"title":"","content":""},"commitment_letter":{"title":"","content":""},"rectification_report":{"title":"","content":""},"customer_service_script":{"opening":"","key_points":[],"closing":""},"phone_script":{"script":"","key_points":[]},"evidence_checklist":[],"submission_order":[]}`,
}

function buildMerchantInfo(data) {
  const fieldMap = {
    merchant_name: '商户名称',
    merchant_id: '商户号',
    platform: '平台（微信/支付宝）',
    industry: '所属行业',
    ban_type: '处罚类型',
    ban_reason: '封禁/处罚原因',
    ban_time: '处罚时间',
    business_model: '经营模式',
    business_address: '经营地址',
    monthly_revenue: '月均交易额',
    complaint_count: '投诉数量',
    violation_details: '违规详情',
    rectification_status: '已整改情况',
    contact_name: '联系人',
    contact_phone: '联系电话',
  }
  const parts = []
  for (const [key, label] of Object.entries(fieldMap)) {
    if (data[key]) parts.push(`${label}：${data[key]}`)
  }
  if (data.extra_info) parts.push(`补充信息：${data.extra_info}`)
  if (data.rejection_reason) parts.push(`驳回原因：${data.rejection_reason}`)
  return parts.length > 0 ? parts.join('\n') : '商户信息待补充'
}

function needsDeepThinking(appealType, data) {
  if (data.enable_deep_thinking) return true
  const complexTypes = ['rectification_report', 'rejection_supplement']
  if (complexTypes.includes(appealType)) return true
  if (data.rejection_reason) return true
  if (data.violation_details && String(data.violation_details).length > 200) return true
  return false
}

function parseJsonResponse(content) {
  if (!content) return null
  try { return JSON.parse(content) } catch {}
  let cleaned = content.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()
  try { return JSON.parse(cleaned) } catch {}
  let depth = 0, start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)) } catch { start = -1 }
      }
    }
  }
  return null
}

class CopywritingService {
  getAppealTypes() {
    return APPEAL_TYPES
  }

  async generate(appealType, merchantData, options = {}) {
    if (!COPYWRITING_PROMPTS[appealType]) {
      throw new Error(`不支持的文案类型：${appealType}，支持类型：${Object.keys(COPYWRITING_PROMPTS).join('/')}`)
    }

    const MAX_TOKENS = {
      situation_statement: 640,
      commitment_letter: 448,
      rectification_report: 640,
      customer_service_script: 640,
      urgent_appeal: 320,
      rejection_supplement: 640,
      phone_script: 512,
      full_package: 1280,
    }

    const merchantInfo = buildMerchantInfo(merchantData)
    const template = COPYWRITING_PROMPTS[appealType]
    const rejectionInfo = merchantData.rejection_info || merchantData.rejection_reason || '无具体驳回信息'
    const userPrompt = template.replace('{merchant_info}', merchantInfo).replace('{rejection_info}', rejectionInfo)

    const enableDeepThinking = needsDeepThinking(appealType, merchantData)
    const userMessages = [
      { role: 'user', content: userPrompt },
    ]

    const maxTokens = options.maxTokens || MAX_TOKENS[appealType] || 640

    logger.info(`[CopywritingService] generating type=${appealType}, deepThinking=${enableDeepThinking}, maxTokens=${maxTokens}`)

    const content = await llmService.completeChatWithCache(
      `copywriting_${SYSTEM_PROMPT.length}`,
      SYSTEM_PROMPT,
      userMessages,
      {
        temperature: options.temperature || 0.3,
        maxTokens,
        jsonMode: true,
        enableDeepThinking,
        stop: COPYWRITING_STOP_SEQUENCES,
        prefill: '{"title":"',
        requestType: 'copywriting',
      }
    )

    const parsed = parseJsonResponse(content)

    return {
      success: true,
      appeal_type: appealType,
      appeal_type_name: APPEAL_TYPES[appealType],
      data: parsed || { raw_content: content },
      raw_content: content,
      deep_thinking_enabled: enableDeepThinking,
    }
  }

  async generateStream(appealType, merchantData, res, options = {}) {
    if (!COPYWRITING_PROMPTS[appealType]) {
      throw new Error(`不支持的文案类型：${appealType}`)
    }

    const MAX_TOKENS = {
      situation_statement: 640,
      commitment_letter: 448,
      rectification_report: 640,
      customer_service_script: 640,
      urgent_appeal: 320,
      rejection_supplement: 640,
      phone_script: 512,
      full_package: 1280,
    }

    const merchantInfo = buildMerchantInfo(merchantData)
    const template = COPYWRITING_PROMPTS[appealType]
    const rejectionInfo = merchantData.rejection_info || merchantData.rejection_reason || '无具体驳回信息'
    const userPrompt = template.replace('{merchant_info}', merchantInfo).replace('{rejection_info}', rejectionInfo)

    const enableDeepThinking = needsDeepThinking(appealType, merchantData)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    const maxTokens = options.maxTokens || MAX_TOKENS[appealType] || 640

    logger.info(`[CopywritingService] streaming type=${appealType}, deepThinking=${enableDeepThinking}, maxTokens=${maxTokens}`)

    res.write(`data: ${JSON.stringify({ type: 'meta', appeal_type: appealType, appeal_type_name: APPEAL_TYPES[appealType], deep_thinking_enabled: enableDeepThinking })}\n\n`)

    await llmService.streamChat(messages, res, null, {
      temperature: options.temperature || 0.3,
      maxTokens,
      jsonMode: false,
      enableDeepThinking,
      stop: COPYWRITING_STOP_SEQUENCES,
      prefill: '{"title":"',
      cacheKey: 'copywriting_system',
      requestType: 'copywriting',
    })
  }

  async refine(originalContent, refinementInstructions, merchantData = null, options = {}) {
    const merchantInfo = merchantData ? buildMerchantInfo(merchantData) : '无'
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请根据修改要求，优化以下申诉文案。\n\n【原始文案】\n${originalContent}\n\n【商户信息】\n${merchantInfo}\n\n【修改要求】\n${refinementInstructions}\n\n请输出优化后的完整文案，保持JSON格式不变。`,
      },
    ]

    const content = await llmService.completeChat(messages, {
      temperature: options.temperature || 0.3,
      maxTokens: 3072,
      jsonMode: true,
      stop: COPYWRITING_STOP_SEQUENCES,
      prefill: '{"title":"',
    })

    const parsed = parseJsonResponse(content)

    return {
      success: true,
      data: parsed || { raw_content: content },
      raw_content: content,
    }
  }
}

export default new CopywritingService()
