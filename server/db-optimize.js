import { getPool } from './db.js'

export async function optimizeDatabase() {
  const pool = getPool()
  
  console.log('开始数据库性能优化...')
  
  const indexes = [
    // messages 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role)',
    
    // users 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)',
    
    // sessions 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
    
    // recharge_orders 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_recharge_user_created ON recharge_orders(user_id, created_at)',
    
    // user_actions 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_user_actions_user_created ON user_actions(user_id, created_at)',
    
    // token_usage 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_token_user_created ON token_usage(user_id, created_at)',
    
    // conversation_analyses 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_conv_analyses_session ON conversation_analyses(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_conv_analyses_scores ON conversation_analyses(professionalism_score, completion_rate)',
    
    // ai_rules 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_ai_rules_status ON ai_rules(status)',
    'CREATE INDEX IF NOT EXISTS idx_ai_rules_category ON ai_rules(category)',
    
    // success_cases 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_success_status ON success_cases(status)',
    'CREATE INDEX IF NOT EXISTS idx_success_industry ON success_cases(industry)',
    
    // mall_products 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_products_status ON mall_products(status)',
    
    // orders 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    
    // ai_activity_log 表索引优化
    'CREATE INDEX IF NOT EXISTS idx_ai_activity_created ON ai_activity_log(created_at)',
  ]
  
  for (const sql of indexes) {
    try {
      await pool.execute(sql)
      console.log('✓', sql)
    } catch (err) {
      if (!err.message.includes('Duplicate key name')) {
        console.error('✗', sql, err.message)
      }
    }
  }
  
  console.log('数据库索引优化完成!')
}

export async function analyzeSlowQueries() {
  const pool = getPool()
  
  console.log('分析慢查询...')
  
  try {
    const [rows] = await pool.execute(`
      SELECT 
        DIGEST_TEXT AS query,
        COUNT_STAR AS exec_count,
        ROUND(AVG_TIMER_WAIT/1000000000, 2) AS avg_time_sec,
        ROUND(SUM_TIMER_WAIT/1000000000, 2) AS total_time_sec,
        ROUND(SUM_ROWS_EXAMINED/NULLIF(COUNT_STAR, 0), 0) AS avg_rows_examined
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME = DATABASE()
        AND DIGEST_TEXT NOT LIKE '%performance_schema%'
      ORDER BY SUM_TIMER_WAIT DESC
      LIMIT 20
    `)
    
    if (rows.length > 0) {
      console.log('慢查询分析结果:')
      console.table(rows)
    } else {
      console.log('未发现慢查询记录')
    }
  } catch (err) {
    console.log('慢查询分析不可用:', err.message)
  }
}