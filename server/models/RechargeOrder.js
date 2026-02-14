import db from '../config/database.js';
import logger from '../utils/logger.js';

class RechargeOrderModel {
  constructor() {
    this.table = 'recharge_orders';
  }

  async create(userId, amount, paymentMethod, remark = '') {
    const sql = `INSERT INTO ${this.table} (user_id, amount, payment_method, remark) VALUES (?, ?, ?, ?)`;
    const result = await db.query(sql, [userId, amount, paymentMethod, remark]);
    return result.insertId;
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ?`;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByUserId(userId, limit = 50) {
    const sql = `SELECT * FROM ${this.table} WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
    return await db.query(sql, [userId, limit]);
  }

  /**
   * Update order status (Confirm/Reject)
   */
  async updateStatus(id, status, adminId, adminNote = '') {
    // Only update if currently pending
    const sql = `
      UPDATE ${this.table} 
      SET status = ?, confirmed_at = NOW(), confirmed_by = ?, admin_note = ? 
      WHERE id = ? AND status = 'pending'
    `;
    const result = await db.query(sql, [status, adminId, adminNote, id]);
    return result.affectedRows > 0;
  }
}

export default new RechargeOrderModel();
