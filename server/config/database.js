import mysql from 'mysql2/promise';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'merchant_appeal',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  connectTimeout: 30000,
  // Add SSL config if needed for production
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined
};

class Database {
  constructor() {
    this.pool = null;
  }

  async init() {
    try {
      // Create a temporary connection to create the database if it doesn't exist
      const tmpConn = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        connectTimeout: DB_CONFIG.connectTimeout,
      });

      await tmpConn.execute(
        `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await tmpConn.end();

      // Create the pool
      this.pool = mysql.createPool(DB_CONFIG);

      // Verify connection
      await this.pool.execute('SELECT 1');
      logger.info('Database connected successfully');

      this.setupKeepAlive();
      
      return this.pool;
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  setupKeepAlive() {
    setInterval(async () => {
      try {
        await this.pool.execute('SELECT 1');
      } catch (err) {
        logger.error('[DB Keepalive] ping failed:', err.message);
      }
    }, 60000);
  }

  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call init() first.');
    }
    return this.pool;
  }

  async query(sql, params) {
    const pool = this.getPool();
    try {
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (error) {
      logger.error(`Database Query Error: ${error.message}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`);
      throw error;
    }
  }
}

const db = new Database();
export default db;
