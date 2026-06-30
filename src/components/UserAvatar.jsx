import React, { useMemo, useState } from 'react'
import { upgradeWechatAvatarUrl } from '../../shared/wechatAvatar.js'

const AVATAR_COLORS = [
  ['#FF6B6B', '#EE5A24'], ['#1DD1A1', '#10AC84'], ['#54A0FF', '#2E86DE'],
  ['#5F27CD', '#341F97'], ['#FF9FF3', '#F368E0'], ['#FECA57', '#FF9F43'],
  ['#00D2D3', '#01A3A4'], ['#FF6348', '#EB4D4B'], ['#7BED9F', '#2ED573'],
  ['#70A1FF', '#1E90FF'], ['#A29BFE', '#6C5CE7'], ['#FD79A8', '#E84393'],
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
  const cnMatch = trimmed.match(/[\u4e00-\u9fff]/g)
  if (cnMatch && cnMatch.length >= 2) return cnMatch.slice(-2).join('')
  if (cnMatch && cnMatch.length === 1) return cnMatch[0]
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export default function UserAvatar({ url, name, size = 36, className = '', style = {} }) {
  const [imgErr, setImgErr] = useState(false)
  const avatarUrl = upgradeWechatAvatarUrl(url || '')
  const showImg = avatarUrl && !imgErr

  const { initials, colors } = useMemo(() => {
    const init = getInitials(name)
    const idx = hashCode(name || '') % AVATAR_COLORS.length
    return { initials: init, colors: AVATAR_COLORS[idx] }
  }, [name])

  const fontSize = size <= 24 ? 10 : size <= 32 ? 12 : size <= 40 ? 14 : size <= 72 ? 18 : 16
  const radius = style.borderRadius ?? (size >= 48 ? '50%' : '12px')

  if (showImg) {
    return (
      <img
        src={avatarUrl}
        alt={name || '头像'}
        className={`flex-shrink-0 object-cover select-none ${className}`}
        style={{ width: size, height: size, borderRadius: radius, ...style }}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
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
