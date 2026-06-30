import React, { useState, useRef, useEffect } from 'react'

export default function SessionItem({ session, fmtTime, onView, onContinue, onDelete }) {
  const [offsetX, setOffsetX] = useState(0)
  const [removing, setRemoving] = useState(false)
  const contentRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const horizontalRef = useRef(false)
  const offsetRef = useRef(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    function onMove(e) {
      const dx = e.touches[0].clientX - touchStartRef.current.x
      const dy = e.touches[0].clientY - touchStartRef.current.y
      if (!horizontalRef.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        horizontalRef.current = true
      }
      if (horizontalRef.current && dx < 0) {
        e.preventDefault()
        const next = Math.max(dx, -80)
        offsetRef.current = next
        setOffsetX(next)
      }
    }

    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  function onTouchStart(e) {
    horizontalRef.current = false
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function onTouchEnd() {
    const next = offsetRef.current < -40 ? -80 : 0
    offsetRef.current = next
    setOffsetX(next)
  }

  function handleDelete() {
    setRemoving(true)
    setTimeout(() => onDelete(), 300)
  }

  return (
    <div className={`session-item mx-2 mb-1.5 rounded-xl ${removing ? 'session-removing' : ''}`}>
      <div className="session-delete-bg rounded-r-xl" onClick={handleDelete}>
        <span>删除</span>
      </div>
      <div
        ref={contentRef}
        className="session-item-content rounded-xl px-3.5 py-3"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (offsetX === 0) onView() }}
      >
        <p className="text-[13px] text-gray-800 line-clamp-2 leading-snug font-medium">{session.first_message || '新对话'}</p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
            <span>{fmtTime(session.created_at)}</span>
            <span className="text-gray-200">·</span>
            <span>{session.message_count} 条</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              session.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
            }`}>
              {session.status === 'active' ? '进行中' : '已完成'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onContinue() }}
              className="text-[10px] px-2 py-0.5 text-[#07C160] bg-green-50 rounded-md font-medium hover:bg-green-100"
            >
              继续
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
