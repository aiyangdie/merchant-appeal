import mysql from 'mysql2/promise'
import { DB_CONFIG, setPool, getPool } from './pool.js'
import { runSchemaMigrations } from './schema.js'

export { getPool } from './pool.js'

export async function initDatabase() {
  const tmpConn = await mysql.createConnection({
    host: DB_CONFIG.host, port: DB_CONFIG.port,
    user: DB_CONFIG.user, password: DB_CONFIG.password,
    connectTimeout: DB_CONFIG.connectTimeout,
  })
  await tmpConn.execute(
    `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await tmpConn.end()

  const p = mysql.createPool(DB_CONFIG)
  setPool(p)
  p.pool.on('connection', () => {})
  p.pool.on('release', () => {})
  setInterval(async () => {
    try { await p.execute('SELECT 1') }
    catch (err) { console.error('[DB Keepalive] ping failed:', err.message) }
  }, 60000)

  await runSchemaMigrations(p)
}
