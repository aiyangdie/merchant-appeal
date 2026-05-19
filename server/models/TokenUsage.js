import db from '../config/database.js';
import logger from '../utils/logger.js';

class TokenUsageModel {
  constructor() {
    this.table = 'token_usage';
  }

  /**
   * Record token usage
   */
  async create({ userId, sessionId, type, inputTokens, outputTokens, totalTokens, cost, multiplier, apiMode }) {
    const sql = `
      INSERT INTO ${this.table} (user_id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
      await db.query(sql, [
        userId, sessionId || null, type || 'chat', 
        inputTokens || 0, outputTokens || 0, totalTokens || 0, 
        cost || 0, multiplier || 2, apiMode || 'official'
      ]);
    } catch (error) {
      logger.error('Error recording token usage:', error);
      // We might not want to throw here to avoid failing the main request if logging fails?
      // But standard practice is to throw and handle in service.
      throw error;
    }
  }

  /**
   * Get user token usage history
   */
  async findByUserId(userId, limit = 50) {
    const sql = `
      SELECT id, session_id, type, input_tokens, output_tokens, total_tokens, cost, multiplier, api_mode, created_at
      FROM ${this.table} WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `;
    return await db.query(sql, [userId, limit]);
  }

  /**
   * Get user token stats
   */
  async getUserStats(userId) {
    const [[totals]] = await db.query(`
      SELECT COUNT(*) as total_requests, COALESCE(SUM(input_tokens),0) as total_input,
      COALESCE(SUM(output_tokens),0) as total_output, COALESCE(SUM(total_tokens),0) as total_tokens,
      COALESCE(SUM(cost),0) as total_cost
      FROM ${this.table} WHERE user_id = ?
    `, [userId]);
    
    return totals;
  }
}

export default new TokenUsageModel();
