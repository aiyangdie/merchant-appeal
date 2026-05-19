/**
 * 会话管理工具
 * @description 提供会话创建、订单绑定、会话信息获取等功能
 * 
 * 核心功能：
 * 1. 会话创建/复用 — ensureSession 确保存在有效会话，避免重复创建
 * 2. 订单绑定 — bindOrder 将订单信息与会话关联
 * 3. 会话信息获取 — fetchSessionInfo 并行获取消息列表和会话详情
 * 
 * 存储策略：
 * - 会话 ID 存储于 localStorage（键名 appeal_session_id）
 * - 使用 ref 缓存当前会话 ID，避免重复请求
 * 
 * @module sessionUtils
 */
import storage from '../utils/storage'

/**
 * 确保存在有效会话
 * @description 如果已有会话则直接返回，否则创建新会话
 * 
 * 注意：使用 sessionIdRef.current 作为内存缓存，避免组件重渲染时重复创建
 * 
 * @param {Object} params
 * @param {React.MutableRefObject<string>} params.sessionIdRef - 会话 ID ref 对象
 * @param {Object} params.user - 用户对象 {id}
 * @param {Function} params.setSessionId - 设置会话 ID 的状态更新函数
 * @returns {Promise<string>} 会话 ID
 */
export async function ensureSession({ sessionIdRef, user, setSessionId }) {
  if (sessionIdRef.current) return sessionIdRef.current
  const token = storage.getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  const data = await res.json()
  if (data.sessionId) {
    setSessionId(data.sessionId)
    sessionIdRef.current = data.sessionId
    storage.set('session_id', data.sessionId)
    return data.sessionId
  }
  throw new Error('创建session失败')
}

/**
 * 绑定订单到会话
 * @description 将订单信息与会话关联，用于后续申诉流程
 * 
 * @param {string} sessionId - 会话 ID
 * @param {Object} order - 订单对象 {order_no, ...}
 * @param {Function} getAuthHeaders - 获取认证请求头回调
 */
export async function bindOrder(sessionId, order, getAuthHeaders) {
  if (!sessionId) return
  try {
    await fetch(`/api/sessions/${sessionId}/bind-order`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ order_no: order.order_no, order_data: order }),
    })
  } catch (e) {
    console.warn('[Session] 绑定订单失败:', e)
  }
}

/**
 * 获取会话信息
 * @description 并行获取会话消息列表和会话详情信息
 * 
 * @param {string} sessionId - 会话 ID
 * @param {Function} getAuthHeaders - 获取认证请求头回调
 * @returns {Promise<{msgData: Object|null, infoData: Object|null}>} 消息数据和会话信息数据
 */
export async function fetchSessionInfo(sessionId, getAuthHeaders) {
  try {
    const [msgRes, infoRes] = await Promise.all([
      fetch(`/api/sessions/${sessionId}/messages`, { headers: getAuthHeaders() }),
      fetch(`/api/sessions/${sessionId}/info`, { headers: getAuthHeaders() }),
    ])
    const msgData = msgRes.ok ? await msgRes.json() : null
    const infoData = infoRes.ok ? await infoRes.json() : null
    return { msgData, infoData }
  } catch (e) {
    console.warn('[Session] 获取会话信息失败:', e)
    return { msgData: null, infoData: null }
  }
}
