import db from '../config/database.js';
import { safeParse } from '../utils/jsonHelper.js';

class OrderModel {
  constructor() {
    this.table = 'orders';
  }

  async create({ orderNo, userId, productId, productName, price, persona, collectedData }) {
    const sql = `
      INSERT INTO ${this.table} (order_no, user_id, product_id, product_name, price, status, persona, collected_data, service_messages)
      VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?)
    `;
    const params = [
      orderNo, userId, productId, productName, price,
      JSON.stringify(persona || null), JSON.stringify(collectedData || {}), JSON.stringify([])
    ];
    
    const result = await db.query(sql, params);
    return { id: result.insertId, orderNo };
  }

  async findByOrderNo(orderNo) {
    const rows = await db.query(`SELECT * FROM ${this.table} WHERE order_no = ?`, [orderNo]);
    return this._processRow(rows[0]);
  }

  async findByUserId(userId) {
    const rows = await db.query(`SELECT * FROM ${this.table} WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    return rows.map(r => this._processRow(r));
  }

  _processRow(row) {
    if (!row) return null;
    return {
      ...row,
      persona: safeParse(row.persona),
      collected_data: safeParse(row.collected_data),
      service_messages: safeParse(row.service_messages)
    };
  }
}

export default new OrderModel();
