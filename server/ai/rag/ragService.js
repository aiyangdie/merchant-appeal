import knowledgeBaseModel from '../../models/KnowledgeBase.js';
import logger from '../../utils/logger.js';

class RagService {
  
  /**
   * Retrieve relevant context for the AI based on user data
   * @param {Object} collectedData - The data collected from user so far
   */
  async retrieveContext(collectedData) {
    const { industry, problem_type, violation_reason } = collectedData;
    
    // 1. Retrieve Cases
    // Now fully driven by DB
    const cases = await knowledgeBaseModel.findSimilarCases(industry, problem_type, violation_reason);
    
    // 2. Retrieve Violation Knowledge
    const violationInfo = await knowledgeBaseModel.getViolationKnowledge(violation_reason);

    // 3. Retrieve Industry Knowledge (Rule-based for now, could be DB later)
    const industryInfo = this._getIndustryKnowledge(industry);

    return {
      cases: cases.slice(0, 3), // Top 3
      violationInfo,
      industryInfo
    };
  }

  /**
   * Construct the System Prompt using RAG context
   * @param {Object} context - The retrieved context
   * @param {Object} userData - User's collected data
   */
  constructSystemPrompt(context, userData) {
    const { cases, violationInfo, industryInfo } = context;
    
    let prompt = `你是"全平台商户号申诉战略顾问"，拥有8年实战经验。你的目标是帮助商户收集信息并生成专业的申诉材料。\n\n`;

    // 1. Inject Knowledge (RAG)
    if (violationInfo) {
      prompt += `## 💡 核心知识：${violationInfo.key}\n`;
      prompt += `- 定义：${violationInfo.description}\n`;
      prompt += `- 申诉关键：${violationInfo.success_key}\n`;
      if (violationInfo.required_materials) {
        prompt += `- 必需材料：${violationInfo.required_materials.join('、')}\n\n`;
      }
    }

    if (industryInfo) {
      prompt += `## 🏭 行业指引：${userData.industry || '未知行业'}\n`;
      prompt += `${industryInfo}\n\n`;
    }

    // 2. Inject Cases (Few-Shot)
    if (cases && cases.length > 0) {
      prompt += `## 📚 参考成功案例\n`;
      cases.forEach((c, i) => {
        prompt += `案例${i+1}：${c.title} (${c.industry}/${c.problem_type})\n`;
        prompt += `- 策略：${c.key_strategy || c.success_summary}\n`;
        prompt += `- 关键点：${Array.isArray(c.appeal_points) ? c.appeal_points.join(';') : c.appeal_points}\n\n`;
      });
    }

    // 3. Current User Context
    prompt += `## 👤 当前客户情况\n`;
    for (const [k, v] of Object.entries(userData)) {
      if (v && typeof v === 'string') prompt += `- ${k}: ${v}\n`;
    }

    // 4. Instructions
    prompt += `\n## 你的行动准则\n`;
    prompt += `1. 像真人顾问一样对话，不要一次性问太多问题。\n`;
    prompt += `2. 根据上述"参考案例"和"核心知识"来指导用户。\n`;
    prompt += `3. 如果信息不足，优先引导用户提供核心证据（如${violationInfo?.required_materials?.[0] || '交易凭证'}）。\n`;
    
    return prompt;
  }

  // --- Internal Helpers ---

  _getIndustryKnowledge(industry) {
    if (!industry) return null;
    const ind = industry.toLowerCase();
    // This could also be moved to a DB table 'industry_knowledge'
    const strategies = {
      '餐饮': '重点证明真实门店经营（门头/内景照）+ 真实外卖订单。',
      '零售': '重点证明货源合法（进货发票/合同）+ 真实物流发货。',
      '电商': '重点证明交易链路完整（下单-发货-物流-签收）。',
      '虚拟': '重点证明服务真实交付（聊天记录/服务截图/验收单）。'
    };
    
    for (const [key, val] of Object.entries(strategies)) {
      if (ind.includes(key)) return val;
    }
    return null;
  }
}

export default new RagService();
