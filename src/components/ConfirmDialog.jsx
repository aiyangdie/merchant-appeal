import React from 'react'
import { AlertTriangle } from 'lucide-react'

const typeStyles = {
  warning: {
    icon: 'text-[#FFB100]',
    iconBg: 'bg-amber-100',
    button: 'bg-[#FFB100] hover:bg-[#e5a000]',
  },
  danger: {
    icon: 'text-[#FA5151]',
    iconBg: 'bg-red-100',
    button: 'bg-[#FA5151] hover:bg-[#e54545]',
  },
  info: {
    icon: 'text-[#1677FF]',
    iconBg: 'bg-blue-100',
    button: 'bg-[#1677FF] hover:bg-[#0958d9]',
  },
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  const style = typeStyles[type] || typeStyles.info

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm animate-scale-in shadow-xl">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
            <AlertTriangle className={`w-6 h-6 ${style.icon}`} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg border border-gray-200 text-gray-600
              font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-11 rounded-lg text-white font-medium transition-colors text-sm ${style.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
