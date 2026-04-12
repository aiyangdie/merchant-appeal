import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const Toast = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const colors = {
    success: 'bg-[var(--color-success)] text-white',
    error: 'bg-[var(--color-error)] text-white',
    warning: 'bg-[var(--color-warning)] text-white',
    info: 'bg-[var(--color-info)] text-white',
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[var(--z-toast)] animate-slide-up">
      <div className={`
        flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)]
        shadow-[var(--shadow-lg)]
        ${colors[type]}
      `}>
        {icons[type]}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

let toastId = 0
const toastListeners = new Set()

export const toast = {
  show: (message, options = {}) => {
    const id = ++toastId
    const type = options.type || 'info'
    const duration = options.duration ?? 3000

    toastListeners.forEach(listener => listener({ id, message, type, duration }))
    return id
  },
  success: (message, options = {}) => toast.show(message, { ...options, type: 'success' }),
  error: (message, options = {}) => toast.show(message, { ...options, type: 'error' }),
  warning: (message, options = {}) => toast.show(message, { ...options, type: 'warning' }),
  info: (message, options = {}) => toast.show(message, { ...options, type: 'info' }),
}

const ToastContainer = () => {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const listener = (newToast) => {
      setToasts(prev => [...prev, newToast])
    }
    toastListeners.add(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return createPortal(
    <>
      {toasts.map(t => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          duration={t.duration}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </>,
    document.body
  )
}

export default ToastContainer
