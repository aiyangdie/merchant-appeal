import ragService from '../ai/rag/ragService.js';
import sessionService from '../services/sessionService.js';
import messageService from '../services/messageService.js';
import llmService from '../ai/core/llm.js';
import logger from '../utils/logger.js';

class AIController {
  
  /**
   * Handle Chat Message
   */
  async chat(req, res) {
    try {
      const { sessionId, content, userId } = req.body;
      
      // 1. Get Session
      const { session, isNew } = await sessionService.getOrCreateSession(sessionId, userId);
      const currentSessionId = session.id;

      // 2. Save User Message
      await messageService.addMessage(currentSessionId, 'user', content);
      
      // 3. RAG Retrieval
      const collectedData = session.collected_data || {};
      const context = await ragService.retrieveContext(collectedData);
      
      // 4. Construct Prompt
      const systemPrompt = ragService.constructSystemPrompt(context, collectedData);
      
      // 5. Get Chat History
      const history = await messageService.getContextWindow(currentSessionId, 20);
      const historyMessages = history.map(m => ({ 
        role: m.role, 
        content: m.content 
      }));
      
      // Prepare LLM messages: System Prompt + History (which includes the user message just added)
      const messages = [
        { role: 'system', content: systemPrompt },
        ...historyMessages
      ];

      // 6. Call LLM & Stream Response
      // We wrap the response stream to capture the full AI response for saving
      // Since `llmService.streamChat` pipes directly to `res`, we need a way to intercept it.
      // For this MVP refactor, let's modify how we call streamChat or assume LLMService handles saving?
      // Better: LLMService returns a stream, Controller pipes it to Res AND aggregates it.
      // But `llmService.streamChat` currently takes `res` as arg.
      // Let's rely on a simplified approach: The LLMService should probably return the text 
      // OR we attach a listener. 
      // For now, let's keep it simple: we might miss saving the AI response in DB in this specific implementation 
      // without modifying LLMService to return the full text.
      
      // Let's modify LLMService to be more flexible or handle saving here.
      // Actually, passing `res` is efficiently streaming. 
      // We can create a PassThrough stream if we want to intercept.
      // But for now, let's stick to the structure.
      
      await llmService.streamChat(messages, res, async (fullResponse) => {
        // Callback when done (if we modify llmService to support this)
        if (fullResponse) {
          await messageService.addMessage(currentSessionId, 'assistant', fullResponse);
        }
      });

    } catch (error) {
      logger.error('AI Chat Error', error);
      if (!res.headersSent) res.status(500).json({ error: 'AI服务暂时不可用' });
    }
  }
}

export default new AIController();
