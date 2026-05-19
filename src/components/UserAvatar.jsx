/**
 * 用户头像组件
 * @description 根据用户名生成彩色头像，显示首字母或中文缩写
 * 
 * 核心功能：
 * 1. 智能缩写 — 中文取最后2字，英文取首字母组合
 * 2. 颜色生成 — 用户名哈希映射到预定义渐变色组（15种）
 * 3. 响应式字号 — 根据头像大小自动计算合适的字体大小
 * 4. 性能优化 — useMemo 缓存计算结果，避免重复计算
 * 
 * 颜色算法：hashCode(name) % 15 → 从 AVATAR_COLORS 中选择渐变色组
 * 
 * @example
 * <UserAvatar name="张三" /> // 显示 "三" 或 "张三"
 * <UserAvatar name="John Doe" size={40} /> // 显示 "JD"
 * 
 * @param {Object} props
 * @param {string} props.name - 用户名（用于生成头像文字和颜色）
 * @param {number} [props.size=36] - 头像尺寸（px），影响字体大小
 * @param {string} [props.className=''] - 额外 CSS 类名
 * @param {Object} [props.style={}] - 内联样式对象（覆盖默认样式）
 */
import React, { useMemo } from 'react'

/**
 * 预定义的头像渐变色组（15种）
 * @constant {Array<[string, string]>}
 */
const AVATAR_COLORS = [
  ['#FF6B6B', '#EE5A24'], ['#1DD1A1', '#10AC84'], ['#54A0FF', '#2E86DE'],
  ['#5F27CD', '#341F97'], ['#FF9FF3', '#F368E0'], ['#FECA57', '#FF9F43'],
  ['#00D2D3', '#01A3A4'], ['#FF6348', '#EB4D4B'], ['#7BED9F', '#2ED573'],
  ['#70A1FF', '#1E90FF'], ['#A29BFE', '#6C5CE7'], ['#FD79A8', '#E84393'],
  ['#FAB1A0', '#E17055'], ['#81ECEC', '#00CEC9'], ['#DFE6E9', '#636E72'],
]

/**
 * 字符串哈希函数
 * @description 使用 DJB2 算法计算字符串的哈希值，用于颜色选择
 * @param {string} str - 要计算哈希的字符串
 * @returns {number} 绝对值哈希值（0 到 2^31-1）
 */
function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * 从用户名中提取首字母缩写
 * @description 智能提取：中文名取最后2字，英文名取首字母组合
 * 
 * 提取规则：
 * 1. 中文（≥2字）→ 取最后2个中文字符
 * 2. 中文（=1字）→ 取该字符
 * 3. 英文（≥2词）→ 取前两个词的首字母（如 "John Doe" → "JD"）
 * 4. 英文（=1词）→ 取前2个字符转大写
 * 5. 空或无有效字符 → 返回 "?"
 * 
 * @param {string} name - 用户名
 * @returns {string} 提取的缩写字母（1-2个字符）
 */
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

/**
 * 用户头像主组件
 * @description 渲染彩色渐变头像，显示用户名缩写
 * @param {Object} props
 * @param {string} props.name - 用户名
 * @param {number} [props.size=36] - 头像尺寸
 * @param {string} [props.className=''] - 额外 CSS 类
 * @param {Object} [props.style={}] - 内联样式
 */
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
