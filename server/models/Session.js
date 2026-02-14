import db from '../config/database.js';
import logger from '../utils/logger.js';
import { safeParse } from '../utils/jsonHelper.js'; // Need to create this utility or implement helper

// Helper since we don't have the utility file yet
const parseJSON = (str) => {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return {};
  }
};

class SessionModel {
  constructor() {
    this.table = 'sessions';
  }

  /**
   * Create a new session
   * @param {string} id - Session UUID
   * @param {number|null} userId 
   */
  async create(id, userId = null) {
    const sql = `
      INSERT INTO ${this.table} (id, user_id, collected_data, step, status)
      VALUES (?, ?, ?, 0, 'active')
    `;
    // collected_data defaults to '{}' in logic usually, putting empty json object
    try {
      await db.query(sql, [id, userId, JSON.stringify({})]);
      return this.findById(id);
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Find session by ID
   * @param {string} id 
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ?`;
    const rows = await db.query(sql, [id]);
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      collected_data: parseJSON(row.collected_data),
      deep_analysis_result: row.deep_analysis_result // This is MEDIUMTEXT, treated as string usually
    };
  }

  /**
   * Update session data
   * @param {string} id 
   * @param {Object} data - Fields to update
   */
  async update(id, data) {
    const sets = [];
    const values = [];

    if (data.step !== undefined) {
      sets.push('step = ?');
      values.push(data.step);
    }
    
    if (data.collected_data !== undefined) {
      sets.push('collected_data = ?');
      values.push(JSON.stringify(data.collected_data));
    }

    if (data.status !== undefined) {
      sets.push('status = ?');
      values.push(data.status);
    }
    
    if (data.deep_analysis_result !== undefined) {
      sets.push('deep_analysis_result = ?');
      values.push(data.deep_analysis_result);
    }

    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const sql = `UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = ?`;
    
    try {
      await db.query(sql, values);
      return this.findById(id);
    } catch (error) {
      logger.error(`Error updating session ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find sessions by User ID
   * @param {number} userId 
   */
  async findByUserId(userId) {
    const sql = `SELECT * FROM ${this.table} WHERE user_id = ? ORDER BY created_at DESC`;
    const rows = await db.query(sql, [userId]);
    return rows.map(row => ({
      ...row,
      collected_data: parseJSON(row.collected_data)
    }));
  }

  /**
   * Delete session
   * @param {string} id 
   */
  async delete(id) {
    await db.query(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
  }
}

export default new SessionModel();
