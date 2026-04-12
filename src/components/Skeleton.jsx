import React from 'react'

function Skeleton({ width, height, className = '', type = 'text' }) {
  const baseClass = 'animate-shimmer rounded'

  const sizeClasses = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    avatar: 'w-10 h-10 rounded-full',
    thumbnail: 'w-20 h-20 rounded-lg',
    card: 'h-32 rounded-xl',
    button: 'h-10 w-24 rounded-lg',
  }

  return (
    <div
      className={`${baseClass} ${sizeClasses[type] || sizeClasses.text} ${className}`}
      style={{ width, height }}
    />
  )
}

function MessageSkeleton() {
  return (
    <div className="flex gap-2 mb-4 animate-fade-in">
      <Skeleton type="avatar" />
      <div className="flex-1">
        <Skeleton height={16} className="mb-2 w-3/4" />
        <Skeleton height={16} className="mb-2" />
        <Skeleton height={16} className="w-1/2" />
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100">
      <Skeleton type="title" className="mb-3 w-1/2" />
      <Skeleton type="text" className="mb-2" />
      <Skeleton type="text" className="mb-2 w-5/6" />
      <Skeleton type="text" className="w-3/4" />
    </div>
  )
}

function UserCardSkeleton() {
  return (
    <div className="p-5 bg-gradient-to-br from-[#07C160]/10 to-[#06a850]/10 rounded-2xl">
      <div className="flex items-center gap-4">
        <Skeleton type="avatar" className="w-14 h-14" />
        <div className="flex-1">
          <Skeleton height={20} className="mb-2 w-1/3" />
          <Skeleton height={14} className="w-1/2" />
        </div>
      </div>
      <div className="mt-4 p-3 bg-white/50 rounded-xl">
        <Skeleton height={14} className="w-1/4 mb-2" />
        <Skeleton height={24} className="w-1/3" />
      </div>
    </div>
  )
}

function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
          <Skeleton type="avatar" className="w-10 h-10" />
          <div className="flex-1">
            <Skeleton height={14} className="w-2/3 mb-1" />
            <Skeleton height={12} className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton, MessageSkeleton, CardSkeleton, UserCardSkeleton, ListSkeleton }
export default Skeleton
