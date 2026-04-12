import db from '../config/database.js';
import logger from '../../utils/logger.js';

class MaterialModel {
  constructor() {
    this.table = 'materials';
  }

  async create(materialData) {
    const sql = `
      INSERT INTO ${this.table}
      (id, appeal_id, type, name, required, status, file_path, file_name,
       file_size, mime_type, upload_url, uploaded_at, verified_at, verifier_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `material_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const result = await db.query(sql, [
        id,
        materialData.appeal_id,
        materialData.type,
        materialData.name,
        materialData.required !== undefined ? (materialData.required ? 1 : 0) : 1,
        materialData.status || 'pending',
        materialData.file_path || '',
        materialData.file_name || '',
        materialData.file_size || 0,
        materialData.mime_type || '',
        materialData.upload_url || '',
        materialData.uploaded_at || null,
        materialData.verified_at || null,
        materialData.verifier_notes || '',
        now,
        now
      ]);

      return { id, ...materialData };
    } catch (error) {
      logger.error('Error creating material:', error);
      throw error;
    }
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? this.formatMaterial(rows[0]) : null;
  }

  async findByAppealId(appealId) {
    const sql = `SELECT * FROM ${this.table} WHERE appeal_id = ? ORDER BY created_at ASC`;
    const rows = await db.query(sql, [appealId]);
    return rows.map(row => this.formatMaterial(row));
  }

  async update(id, materialData) {
    const fields = [];
    const params = [];

    const allowedFields = [
      'status', 'file_path', 'file_name', 'file_size', 'mime_type',
      'upload_url', 'uploaded_at', 'verified_at', 'verifier_notes'
    ];

    for (const field of allowedFields) {
      if (materialData[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(materialData[field]);
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

  async findByType(appealId, type) {
    const sql = `SELECT * FROM ${this.table} WHERE appeal_id = ? AND type = ? LIMIT 1`;
    const rows = await db.query(sql, [appealId, type]);
    return rows.length > 0 ? this.formatMaterial(rows[0]) : null;
  }

  async countByStatus(appealId) {
    const sql = `
      SELECT
        status,
        COUNT(*) as count
      FROM ${this.table}
      WHERE appeal_id = ?
      GROUP BY status
    `;
    const rows = await db.query(sql, [appealId]);
    const result = {
      total: 0,
      pending: 0,
      uploaded: 0,
      verified: 0,
      rejected: 0
    };

    for (const row of rows) {
      result.total += row.count;
      if (row.status === 'pending') result.pending = row.count;
      if (row.status === 'uploaded') result.uploaded = row.count;
      if (row.status === 'verified') result.verified = row.count;
      if (row.status === 'rejected') result.rejected = row.count;
    }

    return result;
  }

  formatMaterial(row) {
    if (!row) return null;
    return {
      ...row,
      required: row.required === 1
    };
  }
}

export default new MaterialModel();
