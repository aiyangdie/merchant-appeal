import mysql from 'mysql2/promise'

export const DB_CONFIG = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'merchant_appeal',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  connectTimeout: 30000,
}

let pool = null

export function getPool() { return pool }
export function setPool(p) { pool = p }

export function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&')
}
