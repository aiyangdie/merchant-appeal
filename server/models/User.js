import db from '../config/database.js';
import { encrypt, decrypt, hmacHash } from '../utils/crypto.js';
import logger from '../utils/logger.js';

class UserModel {
  constructor() {
    this.table = 'users';
  }

  /**
   * Create a new user
   * @param {string} phone - User phone number
   * @param {string} nickname - User nickname
   * @returns {Promise<Object>} Created user object
   */
  async create(phone, nickname) {
    const phoneHash = hmacHash(phone);
    const encryptedPhone = encrypt(phone);
    
    // Check if user exists by hash to avoid decryption
    const existing = await this.findByPhoneHash(phoneHash);
    if (existing) {
      return { user: existing, isNew: false };
    }

    const sql = `
      INSERT INTO ${this.table} (phone, phone_hash, nickname, balance)
      VALUES (?, ?, ?, 0.00)
    `;
    
    try {
      const result = await db.query(sql, [encryptedPhone, phoneHash, nickname || '']);
      const userId = result.insertId;
      const user = await this.findById(userId);
      return { user, isNew: true };
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id 
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE id = ?`;
    const rows = await db.query(sql, [id]);
    if (rows.length === 0) return null;
    return this._processUserRow(rows[0]);
  }

  /**
   * Find user by phone (via hash)
   * @param {string} phone 
   * @returns {Promise<Object|null>}
   */
  async findByPhone(phone) {
    const phoneHash = hmacHash(phone);
    return this.findByPhoneHash(phoneHash);
  }

  /**
   * Find user by phone hash
   * @param {string} phoneHash 
   * @returns {Promise<Object|null>}
   */
  async findByPhoneHash(phoneHash) {
    const sql = `SELECT * FROM ${this.table} WHERE phone_hash = ?`;
    const rows = await db.query(sql, [phoneHash]);
    if (rows.length === 0) return null;
    return this._processUserRow(rows[0]);
  }

  /**
   * Update user balance
   * @param {number} userId 
   * @param {number} amount - Amount to add (can be negative)
   * @returns {Promise<Object>} New balance
   */
  async updateBalance(userId, amount) {
    const sql = `UPDATE ${this.table} SET balance = balance + ? WHERE id = ?`;
    await db.query(sql, [amount, userId]);
    return this.findById(userId);
  }

  /**
   * Update user API mode
   * @param {number} userId 
   * @param {string} mode - 'official' or 'custom'
   * @param {string} apiKey - Custom API key
   */
  async updateApiMode(userId, mode, apiKey) {
    const encryptedKey = apiKey ? encrypt(apiKey) : '';
    const sql = `UPDATE ${this.table} SET api_mode = ?, custom_api_key = ? WHERE id = ?`;
    await db.query(sql, [mode, encryptedKey, userId]);
    return this.findById(userId);
  }

  /**
   * Helper to process user row (decrypt fields)
   * @private
   */
  _processUserRow(row) {
    if (!row) return null;
    return {
      ...row,
      phone: decrypt(row.phone),
      custom_api_key: row.custom_api_key ? decrypt(row.custom_api_key) : '',
      last_ip: row.last_ip ? decrypt(row.last_ip) : ''
    };
  }
}

export default new UserModel();
