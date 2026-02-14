import React, { useMemo } from 'react'

const AVATAR_COLORS = [
  ['#FF6B6B', '#EE5A24'], ['#1DD1A1', '#10AC84'], ['#54A0FF', '#2E86DE'],
  ['#5F27CD', '#341F97'], ['#FF9FF3', '#F368E0'], ['#FECA57', '#FF9F43'],
  ['#00D2D3', '#01A3A4'], ['#FF6348', '#EB4D4B'], ['#7BED9F', '#2ED573'],
  ['#70A1FF', '#1E90FF'], ['#A29BFE', '#6C5CE7'], ['#FD79A8', '#E84393'],
  ['#FAB1A0', '#E17055'], ['#81ECEC', '#00CEC9'], ['#DFE6E9', '#636E72'],
]

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getInitials(name) {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // 中文：取最后1-2个字
  const cnMatch = trimmed.match(/[\u4e00-\u9fff]/g)
  if (cnMatch && cnMatch.length >= 2) return cnMatch.slice(-2).join('')
  if (cnMatch && cnMatch.length === 1) return cnMatch[0]
  // 英文：取首字母大写
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export default function UserAvatar({ name, size = 36, className = '', style = {} }) {
  const { initials, colors } = useMemo(() => {
    const init = getInitials(name)
    const idx = hashCode(name || '') % AVATAR_COLORS.length
    return { initials: init, colors: AVATAR_COLORS[idx] }
  }, [name])

  const fontSize = size <= 24 ? 10 : size <= 32 ? 12 : size <= 40 ? 14 : 16

  return (
    <div
      className={`flex items-center justify-center rounded-xl flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        fontSize,
        fontWeight: 700,
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        letterSpacing: '-0.02em',
        ...style,
      }}
    >
      {initials}
    </div>
  )
}
