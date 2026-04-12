import db from '../config/database.js';
import logger from '../utils/logger.js';

class MessageModel {
  constructor() {
    this.table = 'messages';
  }

  /**
   * Create a new message
   * @param {string} sessionId 
   * @param {string} role - 'user', 'assistant', 'system'
   * @param {string} content 
   */
  async create(sessionId, role, content) {
    const sql = `
      INSERT INTO ${this.table} (session_id, role, content)
      VALUES (?, ?, ?)
    `;
    try {
      const result = await db.query(sql, [sessionId, role, content]);
      return { id: result.insertId, sessionId, role, content };
    } catch (error) {
      logger.error('Error creating message:', error);
      throw error;
    }
  }

  /**
   * Get messages by session ID
   * @param {string} sessionId 
   * @param {number} limit 
   */
  async findBySessionId(sessionId, limit = 100) {
    const sql = `
      SELECT * FROM ${this.table} 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `;
    // Note: original db.js didn't have limit in getMessages, but good practice.
    // If we need all, we can remove limit or set high.
    // RAG context usually needs recent N messages.
    return await db.query(sql, [sessionId]);
  }

  /**
   * Get last message of a session
   */
  async findLastBySessionId(sessionId) {
    const sql = `SELECT * FROM ${this.table} WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`;
    const rows = await db.query(sql, [sessionId]);
    return rows.length > 0 ? rows[0] : null;
  }
}

export default new MessageModel();
