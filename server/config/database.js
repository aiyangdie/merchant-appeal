import mysql from 'mysql2/promise';
import logger from '../utils/logger.js';
import config from './config.js';

const DB_CONFIG = {
  host: config.get('database.host'),
  port: config.get('database.port'),
  user: config.get('database.user'),
  password: config.get('database.password'),
  database: config.get('database.database'),
  waitForConnections: true,
  connectionLimit: config.get('database.connectionLimit'),
  connectTimeout: 30000,
  // 安全配置
  charset: 'utf8mb4_unicode_ci',
  multipleStatements: false, // 禁用多语句执行，防止SQL注入
  // SSL配置（生产环境建议启用）
  ssl: config.get('database.ssl')
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
