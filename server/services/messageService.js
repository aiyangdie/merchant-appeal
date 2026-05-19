import messageModel from '../models/Message.js';
import logger from '../utils/logger.js';

class MessageService {
  /**
   * Add a message to a session
   * @param {string} sessionId 
   * @param {string} role 
   * @param {string} content 
   */
  async addMessage(sessionId, role, content) {
    if (!content) return null;
    return await messageModel.create(sessionId, role, content);
  }

  /**
   * Get chat history for a session
   * @param {string} sessionId 
   */
  async getHistory(sessionId) {
    return await messageModel.findBySessionId(sessionId);
  }

  /**
   * Get recent chat context for LLM (e.g. last 20 messages)
   * @param {string} sessionId 
   * @param {number} limit 
   */
  async getContextWindow(sessionId, limit = 20) {
    const all = await messageModel.findBySessionId(sessionId);
    // Take the last 'limit' messages
    return all.slice(-limit);
  }
}

export default new MessageService();
