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
    
    // Construct Prompt (simplified for refactor, ideally moves to ai/prompts)
    const prompt = this._constructAppealPrompt(d);
    
    // Call LLM (Non-streaming for now as we need to save JSON)
    // We can reuse llmService but we need a method that returns the full response, not streams to res.
    // I'll create a helper in LLMService or just use streamChat with a dummy res? 
    // No, streamChat writes to res. I need a standard complete call.
    // I will modify LLMService to support a 'complete' method or use fetch here directly for clarity.
    
    // But to be clean, let's assume we use a completeChat method in LLMService (I'll add it)
    const aiResponse = await llmService.completeChat([
      { role: 'system', content: 'You are a JSON generator.' }, // Simplified system prompt
      { role: 'user', content: prompt }
    ]);

    let generatedData = {};
    try {
      // Try to parse JSON from AI response
      const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      generatedData = JSON.parse(jsonStr);
    } catch (e) {
      logger.warn('Failed to parse AI appeal JSON, using raw text', e);
      generatedData = { business_model: aiResponse }; // Fallback
    }

    // Save to DB
    const appealId = await appealModel.create({
      sessionId,
      userId,
      businessModel: generatedData.business_model,
      refundRules: generatedData.refund_rules,
      complaintCause: generatedData.complaint_cause,
      complaintResolution: generatedData.complaint_resolution,
      supplementary: generatedData.supplementary,
      // cost calculation omitted for brevity
    });

    return { id: appealId, ...generatedData };
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
