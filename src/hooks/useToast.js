/**
 * Toast 通知 Hook
 * @description 提供全局 Toast 通知管理功能，支持多种通知类型和自动消失
 * 
 * 核心功能：
 * 1. 通知展示 — 添加新通知到列表，返回唯一 ID
 * 2. 类型方法 — success/error/warning/info 快捷方法
 * 3. 自动消失 — 默认 3 秒后自动移除（error 为 4 秒）
 * 4. 手动关闭 — dismiss(id) 关闭单个，dismissAll() 关闭全部
 * 5. 定时器清理 — 自动清理已关闭通知的定时器，防止内存泄漏
 * 
 * 使用方式：
 * const toast = useToast()
 * toast.success('操作成功')
 * toast.error('操作失败')
 * toast.show('自定义消息', 'warning', 5000)
 * 
 * @returns {Object} Toast 管理对象
 * @returns {Array} return.toasts - 当前通知列表 [{id, message, type}]
 * @returns {Function} return.show - 显示通知 (message, type?, duration?) => id
 * @returns {Function} return.success - 显示成功通知 (message) => id
 * @returns {Function} return.error - 显示错误通知 (message) => id
 * @returns {Function} return.warning - 显示警告通知 (message) => id
 * @returns {Function} return.info - 显示信息通知 (message) => id
 * @returns {Function} return.dismiss - 关闭指定通知 (id) => void
 * @returns {Function} return.dismissAll - 关闭所有通知 () => void
 */
import { useState, useCallback, useRef } from 'react'

/**
 * 全局通知 ID 计数器
 * @type {number}
 */
let toastId = 0

/**
 * Toast 通知 Hook
 * @returns {Object} Toast 管理对象
 */
export default function useToast() {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        delete timersRef.current[id]
      }, duration)
    }
    return id
  }, [])

  const success = useCallback((msg) => show(msg, 'success'), [show])
  const error = useCallback((msg) => show(msg, 'error', 4000), [show])
  const warning = useCallback((msg) => show(msg, 'warning'), [show])
  const info = useCallback((msg) => show(msg, 'info'), [show])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const dismissAll = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout)
    timersRef.current = {}
    setToasts([])
  }, [])

  return { toasts, show, success, error, warning, info, dismiss, dismissAll }
}
