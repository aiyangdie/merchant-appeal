#!/usr/bin/env node
/**
 * 验证闲鱼看板 API（需 MySQL 中管理员账号）
 * 用法: node server/scripts/verify-xianyu-dashboard-api.mjs
 */
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { getPool, initDatabase } from '../db.js'

const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3003'
const SECRET = process.env.JWT_SECRET || 'merchant-appeal-secret-key'

async function main() {
  await initDatabase()
  const pool = getPool()
  const [rows] = await pool.query(
    "SELECT id, username FROM admins ORDER BY id LIMIT 1"
  )
  if (!rows?.length) {
    console.error('No admin user in DB')
    process.exit(1)
  }
  const admin = rows[0]
  const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, SECRET, { expiresIn: '1h' })
  const url = `${BASE}/api/admin/xianyu-dashboard?days=30&refresh=1`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  if (!res.ok || !body.success) {
    console.error('FAIL', res.status, body.error || body)
    process.exit(1)
  }
  const s = body.data?.summary || {}
  console.log(JSON.stringify({
    ok: true,
    orderCount: s.orderCount,
    platformTotal: s.platformTotal,
    totalSales: s.totalSales,
    aiSource: body.data?.aiReport?.source,
    analyticsNote: s.analyticsNote,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
