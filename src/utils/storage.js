/**
 * 本地存储工具
 * @description 封装 localStorage 操作，提供统一的键名前缀和序列化/反序列化
 * 
 * 核心功能：
 * 1. 键名前缀 — 所有键名自动添加 'appeal_' 前缀，避免与其他应用冲突
 * 2. 自动序列化 — set 时自动 JSON.stringify，get 时自动 JSON.parse
 * 3. 异常处理 — 写入失败时 console.warn 警告，读取失败时返回 null
 * 4. Token 管理 — 专门的 getToken/setToken 方法，用于认证令牌存储
 * 5. 批量清理 — clearAll 清除所有带前缀的键
 * 
 * 使用方式：
 * import storage from './utils/storage'
 * storage.set('user', { name: '张三' })
 * storage.get('user') // { name: '张三' }
 * storage.setToken('abc123')
 * storage.getToken() // 'abc123'
 * storage.remove('user')
 * storage.clearAll()
 */

/** 本地存储键名前缀 */
const PREFIX = 'appeal_'

/**
 * 本地存储工具对象
 * @namespace storage
 */
const storage = {
  get(key) {
    try {
      const val = localStorage.getItem(PREFIX + key)
      return val ? JSON.parse(val) : null
    } catch {
      return null
    }
  },

  set(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val))
    } catch (e) {
      console.warn('[Storage] 写入失败:', key, e)
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key)
  },

  getToken() {
    return localStorage.getItem(PREFIX + 'token') || ''
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(PREFIX + 'token', token)
    } else {
      localStorage.removeItem(PREFIX + 'token')
    }
  },

  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  },
}

export default storage
