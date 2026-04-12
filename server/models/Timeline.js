import db from '../config/database.js';
import logger from '../../utils/logger.js';

class TimelineModel {
  constructor() {
    this.table = 'timeline';
  }

  async create(timelineData) {
    const sql = `
      INSERT INTO ${this.table}
      (id, appeal_id, event, status, operator, operator_type, details, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const result = await db.query(sql, [
        id,
        timelineData.appeal_id,
        timelineData.event,
        timelineData.status,
        timelineData.operator || '',
        timelineData.operator_type || 'system',
        JSON.stringify(timelineData.details || {}),
        timelineData.timestamp || now,
        now
      ]);

      return { id, ...timelineData };
    } catch (error) {
      logger.error('Error creating timeline event:', error);
      throw error;
    }
  }

  async findByAppealId(appealId) {
    const sql = `SELECT * FROM ${this.table} WHERE appeal_id = ? ORDER BY timestamp ASC`;
    const rows = await db.query(sql, [appealId]);
    return rows.map(row => this.formatTimeline(row));
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? this.formatTimeline(rows[0]) : null;
  }

  formatTimeline(row) {
    if (!row) return null;
    return {
      ...row,
      details: row.details ? JSON.parse(row.details) : {}
    };
  }
}

export default new TimelineModel();
