import db from '../config/database.js';
import logger from '../../utils/logger.js';

class MerchantModel {
  constructor() {
    this.table = 'merchants';
  }

  async create(merchantData) {
    const sql = `
      INSERT INTO ${this.table}
      (id, merchant_id, name, merchant_type, subject_type, business_scene, app_ids,
       settlement_cycle, risk_status, risk_level, risk_reasons, contact_name,
       contact_phone, contact_email, business_address, license_number, license_expiry, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const id = `merchant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const result = await db.query(sql, [
        id,
        merchantData.merchant_id,
        merchantData.name || '',
        merchantData.merchant_type || '',
        merchantData.subject_type || '',
        JSON.stringify(merchantData.business_scene || []),
        JSON.stringify(merchantData.app_ids || []),
        merchantData.settlement_cycle || 'T+1',
        merchantData.risk_status || 'NORMAL',
        merchantData.risk_level || '',
        JSON.stringify(merchantData.risk_reasons || []),
        merchantData.contact_name || '',
        merchantData.contact_phone || '',
        merchantData.contact_email || '',
        merchantData.business_address || '',
        merchantData.license_number || '',
        merchantData.license_expiry || '',
        now,
        now
      ]);
      return { id, ...merchantData };
    } catch (error) {
      logger.error('Error creating merchant:', error);
      throw error;
    }
  }

  async findByMerchantId(merchantId) {
    const sql = `SELECT * FROM ${this.table} WHERE merchant_id = ? LIMIT 1`;
    const rows = await db.query(sql, [merchantId]);
    return rows.length > 0 ? this.formatMerchant(rows[0]) : null;
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? this.formatMerchant(rows[0]) : null;
  }

  async update(id, merchantData) {
    const fields = [];
    const params = [];

    const allowedFields = [
      'name', 'merchant_type', 'subject_type', 'business_scene', 'app_ids',
      'settlement_cycle', 'risk_status', 'risk_level', 'risk_reasons',
      'contact_name', 'contact_phone', 'contact_email', 'business_address',
      'license_number', 'license_expiry'
    ];

    for (const field of allowedFields) {
      if (merchantData[field] !== undefined) {
        if (['business_scene', 'app_ids', 'risk_reasons'].includes(field)) {
          fields.push(`${field} = ?`);
          params.push(JSON.stringify(merchantData[field]));
        } else {
          fields.push(`${field} = ?`);
          params.push(merchantData[field]);
        }
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

    if (filters.risk_status) {
      sql += ' AND risk_status = ?';
      params.push(filters.risk_status);
    }

    if (filters.merchant_type) {
      sql += ' AND merchant_type = ?';
      params.push(filters.merchant_type);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(filters.limit));
    }

    const rows = await db.query(sql, params);
    return rows.map(row => this.formatMerchant(row));
  }

  formatMerchant(row) {
    if (!row) return null;
    return {
      ...row,
      business_scene: row.business_scene ? JSON.parse(row.business_scene) : [],
      app_ids: row.app_ids ? JSON.parse(row.app_ids) : [],
      risk_reasons: row.risk_reasons ? JSON.parse(row.risk_reasons) : []
    };
  }
}

export default new MerchantModel();
