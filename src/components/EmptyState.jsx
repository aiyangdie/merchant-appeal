import React from 'react'
import { Inbox, FileQuestion, Search, Bell, MessageCircle } from 'lucide-react'

const iconMap = {
  inbox: Inbox,
  'file-question': FileQuestion,
  search: Search,
  bell: Bell,
  message: MessageCircle,
}

export default function EmptyState({
  icon = 'inbox',
  title = '暂无数据',
  description = '这里还没有任何内容',
  action,
  actionText,
}) {
  const IconComponent = iconMap[icon] || Inbox

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <IconComponent className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 text-center mb-4 max-w-xs">{description}</p>
      {action && actionText && (
        <button
          onClick={action}
          className="px-5 py-2.5 bg-[#07C160] text-white rounded-xl text-sm font-medium
            hover:bg-[#06a850] transition-colors shadow-sm"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}
