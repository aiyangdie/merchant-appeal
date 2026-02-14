import db from '../config/database.js';
import logger from '../utils/logger.js';

class AppealModel {
  constructor() {
    this.table = 'appeal_texts';
  }

  /**
   * Save generated appeal text
   */
  async create({ sessionId, userId, businessModel, refundRules, complaintCause, complaintResolution, supplementary, inputTokens, outputTokens, cost }) {
    const sql = `
      INSERT INTO ${this.table} (session_id, user_id, business_model, refund_rules, complaint_cause, complaint_resolution, supplementary, input_tokens, output_tokens, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
      const result = await db.query(sql, [
        sessionId, userId, 
        businessModel || '', refundRules || '', complaintCause || '', 
        complaintResolution || '', supplementary || '', 
        inputTokens || 0, outputTokens || 0, cost || 0
      ]);
      return { id: result.insertId };
    } catch (error) {
      logger.error('Error creating appeal text:', error);
      throw error;
    }
  }

  /**
   * Get appeal text by session ID
   */
  async findBySessionId(sessionId) {
    const sql = `SELECT * FROM ${this.table} WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`;
    const rows = await db.query(sql, [sessionId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update appeal status and feedback
   */
  async updateStatus(sessionId, userId, { status, feedback, rejectionReason }) {
    const now = new Date();
    const updates = ['appeal_status = ?'];
    const params = [status];

    if (feedback) { updates.push('user_feedback = ?'); params.push(feedback); }
    if (rejectionReason) { updates.push('rejection_reason = ?'); params.push(rejectionReason); }
    if (status === 'submitted' || status === 'resubmitted') { updates.push('submitted_at = ?'); params.push(now); }
    if (status === 'approved' || status === 'rejected') { updates.push('result_at = ?'); params.push(now); }
    if (status === 'resubmitted') { updates.push('resubmit_count = resubmit_count + 1'); }

    params.push(sessionId, userId);
    
    const sql = `UPDATE ${this.table} SET ${updates.join(', ')} WHERE session_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`;
    await db.query(sql, params);
  }

  /**
   * Get Appeal Statistics
   */
  async getStats() {
    const [[totals]] = await db.query(`
      SELECT COUNT(*) as total,
      SUM(appeal_status='generated') as \`generated\`,
      SUM(appeal_status='submitted') as \`submitted\`,
      SUM(appeal_status='under_review') as under_review,
      SUM(appeal_status='approved') as approved,
      SUM(appeal_status='rejected') as rejected,
      SUM(appeal_status='resubmitted') as resubmitted
      FROM ${this.table}
    `);
    
    // Additional queries for charts can be added here or in service layer
    // For MVP refactor, we keep it simple or port the complex queries from db.js if needed
    // The complex queries in db.js involved joins with sessions table.
    // It's better to keep complex analytical queries in the Model to encapsulate SQL.
    
    return totals;
  }
}

export default new AppealModel();
