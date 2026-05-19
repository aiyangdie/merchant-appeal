import appealModel from '../models/Appeal.js';
import sessionService from './sessionService.js';
import llmService from '../ai/core/llm.js';
import logger from '../utils/logger.js';

class AppealService {
  /**
   * Generate appeal text based on session data
   * @param {string} sessionId 
   * @param {number} userId 
   */
  async generateAppeal(sessionId, userId) {
    const session = await sessionService.getSession(sessionId, userId);
    const d = session.collected_data || {};

    const prompt = this._constructAppealPrompt(d);

    let aiResponse;
    try {
      aiResponse = await llmService.completeChat([
        { role: 'system', content: this._getSystemPrompt() },
        { role: 'user', content: prompt }
      ]);
    } catch (e) {
      logger.error('completeChat not available, falling back to streamChat wrapper', e);
      aiResponse = await this._fallbackComplete(prompt);
    }

    let generatedData = {};
    try {
      const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      generatedData = JSON.parse(jsonStr);
    } catch (e) {
      logger.warn('Failed to parse AI appeal JSON, using raw text', e);
      generatedData = { business_model: aiResponse };
    }

    const appealId = await appealModel.create({
      sessionId,
      userId,
      businessModel: generatedData.business_model,
      refundRules: generatedData.refund_rules,
      complaintCause: generatedData.complaint_cause,
      complaintResolution: generatedData.complaint_resolution,
      supplementary: generatedData.supplementary,
    });

    return { id: appealId, ...generatedData };
  }

  _getSystemPrompt() {
    return `你是微信商户号申诉文案专家。根据商户信息生成5段式申诉材料：
1. business_model - 经营模式说明（业务类型、经营时间、客户群体）
2. refund_rules - 退款规则说明（退款条件、流程、时效）
3. complaint_cause - 投诉原因分析（投诉来源、根本原因、已采取的措施）
4. complaint_resolution - 投诉处理方案（具体解决方案、预防措施）
5. supplementary - 补充说明（其他需要补充的信息）

要求：话术柔和合规、逻辑严谨、避免敏感词（套现/刷单/洗钱等）、基于真实情况。必须输出有效JSON。`;
  }

  async _fallbackComplete(prompt) {
    return new Promise((resolve, reject) => {
      let fullText = '';
      const mockRes = {
        write: (chunk) => { fullText += typeof chunk === 'string' ? chunk : (chunk || ''); },
        end: () => resolve(fullText),
        on: () => {}
      };
      llmService.streamChat(
        [{ role: 'system', content: this._getSystemPrompt() }, { role: 'user', content: prompt }],
        mockRes
      ).then(() => resolve(fullText)).catch(reject);
    });
  }

  _constructAppealPrompt(d) {
    return `
      请根据以下商户信息生成5段申诉文案。
      行业：${d.industry || '未知'}
      违规原因：${d.violation_reason || '未知'}
      商户名称：${d.merchant_name || ''}
      ...
      请输出JSON格式：
      {
        "business_model": "...",
        "refund_rules": "...",
        "complaint_cause": "...",
        "complaint_resolution": "...",
        "supplementary": "..."
      }
    `;
  }
}

export default new AppealService();
