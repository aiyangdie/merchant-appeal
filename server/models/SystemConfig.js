import db from '../config/database.js';
import { safeEncrypt, safeDecrypt } from '../utils/crypto.js'; // Need to ensure these are exported from utils/crypto.js

class SystemConfigModel {
  constructor() {
    this.table = 'system_config';
  }

  /**
   * Get all configs as a key-value object
   */
  async getAll() {
    const sql = `SELECT * FROM ${this.table}`;
    const rows = await db.query(sql);
    
    const config = {};
    for (const row of rows) {
      config[row.config_key] = this._processValue(row.config_key, row.config_value);
    }
    return config;
  }

  /**
   * Get a single config value
   * @param {string} key 
   */
  async get(key) {
    const sql = `SELECT config_value FROM ${this.table} WHERE config_key = ?`;
    const rows = await db.query(sql, [key]);
    if (rows.length === 0) return null;
    return this._processValue(key, rows[0].config_value);
  }

  /**
   * Update or insert configs
   * @param {Object} configs - Key-value pairs
   */
  async update(configs) {
    // This is often a bulk update or loop
    // For atomic updates, maybe transaction needed, but simple loop is fine for MVP
    const keys = Object.keys(configs);
    for (const key of keys) {
      let value = configs[key];
      
      // Encrypt sensitive keys if needed
      if (this._isSensitive(key)) {
        value = safeEncrypt(value);
      }

      const sql = `
        INSERT INTO ${this.table} (config_key, config_value, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
      `;
      await db.query(sql, [key, value]);
    }
  }

  _isSensitive(key) {
    const SENSITIVE_KEYS = ['deepseek_api_key', 'zhipu_api_key', 'wx_api_key'];
    return SENSITIVE_KEYS.includes(key);
  }

  _processValue(key, value) {
    if (!value) return '';
    if (this._isSensitive(key)) {
      return safeDecrypt(value);
    }
    return value;
  }
}

export default new SystemConfigModel();
