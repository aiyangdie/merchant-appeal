/**
 * 资金审计日志（与路由解耦）
 */
import { getPool } from '../db.js'

export async function logFinancialActivity({ userId, type, amount, balanceAfter, refId, note = '' }) {
  try {
    await getPool().query(
      'INSERT INTO financial_audit (user_id, type, amount, balance_after, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, amount, balanceAfter, refId || '', note]
    )
  } catch (e) {
    console.warn('[AuditLog]', e.message)
  }
}
