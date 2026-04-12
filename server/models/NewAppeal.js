import db from '../config/database.js';
import logger from '../../utils/logger.js';

class NewAppealModel {
  constructor() {
    this.table = 'appeals';
  }

  async create(appealData) {
    const sql = `
      INSERT INTO ${this.table}
      (id, merchant_id, risk_type, risk_details, status, progress, submitter_name,
       submitter_phone, submitter_email, appeal_reason, improvement_measures,
       submitted_at, reviewed_at, completed_at, reviewer_name, reviewer_notes,
       external_appeal_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `appeal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const result = await db.query(sql, [
        id,
        appealData.merchant_id,
        appealData.risk_type,
        appealData.risk_details || '',
        appealData.status || 'not_started',
        appealData.progress || 0,
        appealData.submitter_name,
        appealData.submitter_phone,
        appealData.submitter_email || '',
        appealData.appeal_reason || '',
        appealData.improvement_measures || '',
        appealData.submitted_at || null,
        appealData.reviewed_at || null,
        appealData.completed_at || null,
        appealData.reviewer_name || '',
        appealData.reviewer_notes || '',
        appealData.external_appeal_id || '',
        now,
        now
      ]);

      return { id, ...appealData };
    } catch (error) {
      logger.error('Error creating appeal:', error);
      throw error;
    }
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? this.formatAppeal(rows[0]) : null;
  }

  async findByMerchantId(merchantId) {
    const sql = `SELECT * FROM ${this.table} WHERE merchant_id = ? ORDER BY created_at DESC`;
    const rows = await db.query(sql, [merchantId]);
    return rows.map(row => this.formatAppeal(row));
  }

  async findActiveByMerchantId(merchantId) {
    const sql = `
      SELECT * FROM ${this.table}
      WHERE merchant_id = ? AND status IN ('not_started', 'preparing', 'submitted', 'reviewing')
      ORDER BY created_at DESC LIMIT 1
    `;
    const rows = await db.query(sql, [merchantId]);
    return rows.length > 0 ? this.formatAppeal(rows[0]) : null;
  }

  async update(id, appealData) {
    const fields = [];
    const params = [];

    const allowedFields = [
      'status', 'progress', 'appeal_reason', 'improvement_measures',
      'submitted_at', 'reviewed_at', 'completed_at', 'reviewer_name', 'reviewer_notes',
      'external_appeal_id'
    ];

    for (const field of allowedFields) {
      if (appealData[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(appealData[field]);
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE ${this.table} SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    return true;
  }

  async findAll(filters = {}) {
    let sql = `SELECT * FROM ${this.table} WHERE 1=1`;
    const params = [];

    if (filters.merchant_id) {
      sql += ' AND merchant_id = ?';
      params.push(filters.merchant_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.risk_type) {
      sql += ' AND risk_type = ?';
      params.push(filters.risk_type);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(parseInt(filters.offset));
    }

    const rows = await db.query(sql, params);
    return rows.map(row => this.formatAppeal(row));
  }

  async count(filters = {}) {
    let sql = `SELECT COUNT(*) as total FROM ${this.table} WHERE 1=1`;
    const params = [];

    if (filters.merchant_id) {
      sql += ' AND merchant_id = ?';
      params.push(filters.merchant_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    const [[result]] = await db.query(sql, params);
    return result.total;
  }

  async getStats() {
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'not_started') as not_started,
        SUM(status = 'preparing') as preparing,
        SUM(status = 'submitted') as submitted,
        SUM(status = 'reviewing') as reviewing,
        SUM(status = 'approved') as approved,
        SUM(status = 'rejected') as rejected,
        SUM(status = 'cancelled') as cancelled
      FROM ${this.table}
    `);
    return stats;
  }

  formatAppeal(row) {
    if (!row) return null;
    return row;
  }
}

export default new NewAppealModel();
