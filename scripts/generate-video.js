import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

// 配置
const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30
const FRAME_DIR = './docs/frames'
const OUTPUT = './docs/merchant-appeal-demo.mp4'

// 配色
const C = {
  primary: '#7C3AED',
  secondary: '#3B82F6',
  accent: '#10B981',
  dark: '#1E293B',
  light: '#F8FAFC',
  white: '#FFFFFF',
  gray: '#64748B',
  orange: '#F59E0B',
  red: '#EF4444',
  bg1: '#0F172A',
  bg2: '#1E1B4B',
}

// 创建帧目录
if (!existsSync(FRAME_DIR)) mkdirSync(FRAME_DIR, { recursive: true })

// 清理旧帧
readdirSync(FRAME_DIR).filter(f => f.endsWith('.png')).forEach(f => unlinkSync(join(FRAME_DIR, f)))

const canvas = createCanvas(WIDTH, HEIGHT)
const ctx = canvas.getContext('2d')

// ===== 工具函数 =====
function drawBg(gradient) {
  if (gradient) {
    const grd = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
    grd.addColorStop(0, gradient[0])
    grd.addColorStop(1, gradient[1])
    ctx.fillStyle = grd
  } else {
    ctx.fillStyle = C.bg1
  }
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

function drawRoundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke() }
}

function drawText(text, x, y, { size = 32, color = C.white, align = 'left', bold = false, maxWidth } = {}) {
  ctx.fillStyle = color
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Microsoft YaHei", "Segoe UI", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  if (maxWidth) {
    ctx.fillText(text, x, y, maxWidth)
  } else {
    ctx.fillText(text, x, y)
  }
}

function drawMultiline(lines, x, y, opts = {}) {
  const lineHeight = (opts.size || 32) * 1.6
  lines.forEach((line, i) => {
    drawText(line, x, y + i * lineHeight, opts)
  })
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function saveFrame(frameNum) {
  const buf = canvas.toBuffer('image/png')
  const name = String(frameNum).padStart(6, '0')
  writeFileSync(join(FRAME_DIR, `frame_${name}.png`), buf)
}

// ===== 场景定义 =====
let frameCount = 0

function generateFrames(durationSec, renderFn) {
  const totalFrames = Math.round(durationSec * FPS)
  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames
    renderFn(progress, i)
    saveFrame(frameCount++)
  }
}

// ===== 场景 1: 封面（4秒） =====
console.log('🎬 生成场景1: 封面...')
generateFrames(4, (p) => {
  drawBg([C.bg2, C.bg1])
  
  // 粒子效果
  for (let i = 0; i < 50; i++) {
    const px = (Math.sin(i * 0.7 + p * Math.PI * 2) * 0.5 + 0.5) * WIDTH
    const py = (Math.cos(i * 0.5 + p * Math.PI * 2) * 0.5 + 0.5) * HEIGHT
    const alpha = 0.1 + Math.sin(i + p * 6) * 0.08
    ctx.fillStyle = `rgba(124, 58, 237, ${alpha})`
    ctx.beginPath()
    ctx.arc(px, py, 2 + Math.sin(i) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // 标题渐入
  const titleAlpha = Math.min(1, p * 3)
  ctx.globalAlpha = titleAlpha
  
  drawText('🛡️', WIDTH / 2, 200, { size: 80, align: 'center' })
  drawText('微信商户号申诉专业助手', WIDTH / 2, 320, { size: 56, bold: true, align: 'center' })
  drawText('Merchant Appeal Assistant', WIDTH / 2, 400, { size: 24, color: '#A78BFA', align: 'center' })
  
  // 副标题延迟渐入
  const subAlpha = Math.max(0, Math.min(1, (p - 0.3) * 3))
  ctx.globalAlpha = subAlpha
  drawText('AI驱动的智能申诉解决方案', WIDTH / 2, 480, { size: 28, color: '#C4B5FD', align: 'center' })
  drawText('基于 DeepSeek 大模型  ·  React + Express + MySQL', WIDTH / 2, 530, { size: 20, color: '#94A3B8', align: 'center' })
  
  // GitHub 链接
  const linkAlpha = Math.max(0, Math.min(1, (p - 0.5) * 3))
  ctx.globalAlpha = linkAlpha
  drawRoundRect(WIDTH / 2 - 200, 620, 400, 50, 25, 'rgba(124,58,237,0.3)', C.primary)
  drawText('⭐ github.com/aiyangdie/merchant-appeal', WIDTH / 2, 630, { size: 18, align: 'center', color: '#E9D5FF' })
  
  ctx.globalAlpha = 1
})

// ===== 场景 2: 痛点（5秒） =====
console.log('🎬 生成场景2: 痛点分析...')
generateFrames(5, (p) => {
  drawBg([C.bg1, '#1a1a2e'])
  
  drawText('🎯 商户面临的困境', WIDTH / 2, 60, { size: 44, bold: true, align: 'center' })
  
  // 4个痛点卡片依次出现
  const painPoints = [
    { icon: '😰', title: '不知道准备什么材料', desc: '被风控后一头雾水', color: '#EF4444' },
    { icon: '📄', title: '申诉材料不专业', desc: '写了三遍都被驳回', color: '#F59E0B' },
    { icon: '💸', title: '找顾问费用高昂', desc: '开口就是几千块', color: '#3B82F6' },
    { icon: '📋', title: '模板千篇一律', desc: '不针对具体情况', color: '#8B5CF6' },
  ]
  
  painPoints.forEach((pp, i) => {
    const delay = i * 0.15
    const cardP = Math.max(0, Math.min(1, (p - delay) * 4))
    const ease = easeInOut(cardP)
    
    const x = 120 + i * 430
    const y = 180 + (1 - ease) * 50
    
    ctx.globalAlpha = ease
    drawRoundRect(x, y, 390, 250, 16, 'rgba(255,255,255,0.05)', pp.color)
    drawText(pp.icon, x + 195, y + 30, { size: 50, align: 'center' })
    drawText(pp.title, x + 195, y + 110, { size: 22, bold: true, align: 'center', color: pp.color })
    drawText(pp.desc, x + 195, y + 155, { size: 16, align: 'center', color: '#94A3B8' })
    ctx.globalAlpha = 1
  })
  
  // 解决方案提示
  const solP = Math.max(0, Math.min(1, (p - 0.6) * 3))
  ctx.globalAlpha = easeInOut(solP)
  drawRoundRect(WIDTH / 2 - 350, 500, 700, 160, 16, 'rgba(124,58,237,0.15)', C.primary)
  drawText('💡 我们的解决方案', WIDTH / 2, 520, { size: 28, bold: true, align: 'center', color: C.primary })
  drawText('AI 对话自动引导 · 行业知识库 · 成功案例匹配', WIDTH / 2, 570, { size: 18, align: 'center', color: '#C4B5FD' })
  drawText('成本低至几毛钱 · 个性化定制方案', WIDTH / 2, 605, { size: 18, align: 'center', color: '#C4B5FD' })
  ctx.globalAlpha = 1
})

// ===== 场景 3: 核心特性（6秒） =====
console.log('🎬 生成场景3: 核心特性...')
generateFrames(6, (p) => {
  drawBg([C.bg1, C.bg2])
  
  drawText('✨ 核心特性', WIDTH / 2, 40, { size: 44, bold: true, align: 'center' })
  
  const features = [
    { icon: '🤖', title: 'AI 智能对话', desc: 'DeepSeek大模型驱动\n像朋友聊天一样自然', color: '#7C3AED' },
    { icon: '🔍', title: '智能信息提取', desc: '100% AI提取\n零正则零硬编码', color: '#3B82F6' },
    { icon: '🏭', title: '行业自适应', desc: '30+行业知识库\n自动匹配申诉策略', color: '#10B981' },
    { icon: '📋', title: '专业材料生成', desc: '结构化报告\n可直接提交官方', color: '#F59E0B' },
    { icon: '⚡', title: '极致性能', desc: 'SSE流式传输\n首字节<1秒', color: '#EF4444' },
    { icon: '🔒', title: '反幻觉防线', desc: '四重防护\n杜绝AI编造', color: '#8B5CF6' },
  ]
  
  features.forEach((f, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const delay = i * 0.08
    const cardP = Math.max(0, Math.min(1, (p - delay) * 3))
    const ease = easeInOut(cardP)
    
    const x = 100 + col * 600
    const y = 150 + row * 350 + (1 - ease) * 30
    
    ctx.globalAlpha = ease
    drawRoundRect(x, y, 540, 300, 16, 'rgba(255,255,255,0.04)', f.color)
    drawText(f.icon, x + 270, y + 30, { size: 50, align: 'center' })
    drawText(f.title, x + 270, y + 110, { size: 26, bold: true, align: 'center', color: f.color })
    f.desc.split('\n').forEach((line, li) => {
      drawText(line, x + 270, y + 160 + li * 35, { size: 18, align: 'center', color: '#CBD5E1' })
    })
    ctx.globalAlpha = 1
  })
})

// ===== 场景 4: 系统架构（5秒） =====
console.log('🎬 生成场景4: 系统架构...')
generateFrames(5, (p) => {
  drawBg([C.bg1, '#0c1222'])
  
  drawText('🏗️ 系统架构', WIDTH / 2, 40, { size: 44, bold: true, align: 'center' })
  
  // 三大模块
  const blocks = [
    { x: 100, label: '前端', sub: 'React 18 SPA', items: ['React Router', 'TailwindCSS', 'SSE 流式接收', 'Token 实时显示'], color: '#3B82F6' },
    { x: 680, label: '后端', sub: 'Express API', items: ['规则引擎 localAI', '行业知识库 30+', 'Token计费 + JWT', 'AES-256 加密'], color: '#7C3AED' },
    { x: 1260, label: '外部服务', sub: 'DeepSeek + MySQL', items: ['对话生成(流式)', '字段提取(并行)', '完成度评估', '报告生成'], color: '#10B981' },
  ]
  
  blocks.forEach((b, i) => {
    const delay = i * 0.15
    const blockP = Math.max(0, Math.min(1, (p - delay) * 3))
    const ease = easeInOut(blockP)
    
    ctx.globalAlpha = ease
    const y = 140 + (1 - ease) * 20
    drawRoundRect(b.x, y, 520, 380, 16, 'rgba(255,255,255,0.03)', b.color)
    drawText(b.label, b.x + 260, y + 20, { size: 28, bold: true, align: 'center', color: b.color })
    drawText(b.sub, b.x + 260, y + 60, { size: 16, align: 'center', color: '#94A3B8' })
    
    b.items.forEach((item, j) => {
      drawRoundRect(b.x + 30, y + 110 + j * 60, 460, 45, 8, 'rgba(255,255,255,0.05)')
      drawText(`  ${item}`, b.x + 50, y + 120 + j * 60, { size: 18, color: '#E2E8F0' })
    })
    ctx.globalAlpha = 1
  })
  
  // 连接箭头
  if (p > 0.3) {
    ctx.globalAlpha = Math.min(1, (p - 0.3) * 3)
    drawText('◄── SSE Stream ──►', 480, 300, { size: 16, color: '#64748B', align: 'center' })
    drawText('◄── API Call ──►', 1060, 300, { size: 16, color: '#64748B', align: 'center' })
    ctx.globalAlpha = 1
  }
  
  // 底部 5 处调用
  if (p > 0.5) {
    const btmP = Math.min(1, (p - 0.5) * 3)
    ctx.globalAlpha = easeInOut(btmP)
    drawText('DeepSeek API 5 处调用点', WIDTH / 2, 570, { size: 22, bold: true, align: 'center', color: '#A78BFA' })
    const calls = ['对话生成', '字段提取', '完成度评估', '报告生成', '行业扩展']
    calls.forEach((c, i) => {
      const cx = 200 + i * 320
      drawRoundRect(cx, 620, 280, 45, 10, 'rgba(124,58,237,0.2)', '#7C3AED')
      drawText(c, cx + 140, 628, { size: 16, align: 'center', color: '#C4B5FD' })
    })
    ctx.globalAlpha = 1
  }
})

// ===== 场景 5: 反幻觉（4秒） =====
console.log('🎬 生成场景5: 反幻觉防线...')
generateFrames(4, (p) => {
  drawBg([C.bg1, '#1a0a0a'])
  
  drawText('🔒 反幻觉四重防线', WIDTH / 2, 40, { size: 44, bold: true, align: 'center' })
  drawText('确保 AI 输出 100% 基于用户真实信息', WIDTH / 2, 100, { size: 20, align: 'center', color: '#94A3B8' })
  
  const defenses = [
    { layer: '第1层', title: '对话 Prompt', desc: '反幻觉铁律\n嵌入系统提示词', color: '#EF4444' },
    { layer: '第2层', title: '提取 Prompt', desc: '严格过滤规则\n拒绝误提取', color: '#F59E0B' },
    { layer: '第3层', title: '报告 Prompt', desc: '禁止脑补\n只用真实信息', color: '#3B82F6' },
    { layer: '第4层', title: '服务端校验', desc: '格式/内容校验\n拒绝脏数据', color: '#10B981' },
  ]
  
  defenses.forEach((d, i) => {
    const delay = i * 0.12
    const cardP = Math.max(0, Math.min(1, (p - delay) * 3))
    const ease = easeInOut(cardP)
    
    const x = 110 + i * 440
    const y = 180 + (1 - ease) * 40
    
    ctx.globalAlpha = ease
    drawRoundRect(x, y, 400, 320, 16, 'rgba(255,255,255,0.03)', d.color)
    
    // 标签
    drawRoundRect(x + 140, y - 15, 120, 35, 12, d.color)
    drawText(d.layer, x + 200, y - 10, { size: 16, bold: true, align: 'center' })
    
    drawText(d.title, x + 200, y + 50, { size: 26, bold: true, align: 'center', color: d.color })
    d.desc.split('\n').forEach((line, li) => {
      drawText(line, x + 200, y + 110 + li * 35, { size: 18, align: 'center', color: '#CBD5E1' })
    })
    ctx.globalAlpha = 1
  })
  
  // 底部警告
  if (p > 0.5) {
    ctx.globalAlpha = Math.min(1, (p - 0.5) * 3)
    drawRoundRect(100, 560, WIDTH - 200, 60, 12, 'rgba(239,68,68,0.15)')
    drawText('⛔ 用户没说的 = 不存在 · 禁止合理推测 · 禁止行业惯例补充 · 禁止虚构举例', WIDTH / 2, 572, { size: 18, align: 'center', color: '#FCA5A5' })
    ctx.globalAlpha = 1
  }
})

// ===== 场景 6: 技术栈（4秒） =====
console.log('🎬 生成场景6: 技术栈...')
generateFrames(4, (p) => {
  drawBg([C.bg2, C.bg1])
  
  drawText('🔧 技术栈', WIDTH / 2, 40, { size: 44, bold: true, align: 'center' })
  
  const stack = [
    ['React 18', 'SPA前端框架', '#61DAFB'],
    ['TailwindCSS', '原子化CSS', '#06B6D4'],
    ['Vite 6', '极速构建', '#8B5CF6'],
    ['Express 4', 'REST API + SSE', '#339933'],
    ['MySQL 8.0', '数据持久化', '#4479A1'],
    ['DeepSeek', 'AI大模型引擎', '#7C3AED'],
    ['JWT + AES-256', '安全防护', '#EF4444'],
    ['js-tiktoken', 'Token精确计数', '#F59E0B'],
  ]
  
  stack.forEach((s, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const delay = i * 0.06
    const itemP = Math.max(0, Math.min(1, (p - delay) * 3))
    const ease = easeInOut(itemP)
    
    const x = 150 + col * 820
    const y = 150 + row * 120 + (1 - ease) * 20
    
    ctx.globalAlpha = ease
    drawRoundRect(x, y, 750, 90, 12, 'rgba(255,255,255,0.04)')
    // 色条
    ctx.fillStyle = s[2]
    ctx.beginPath()
    ctx.roundRect(x, y, 8, 90, [12, 0, 0, 12])
    ctx.fill()
    
    drawText(s[0], x + 40, y + 15, { size: 24, bold: true, color: s[2] })
    drawText(s[1], x + 40, y + 50, { size: 16, color: '#94A3B8' })
    ctx.globalAlpha = 1
  })
})

// ===== 场景 7: 结尾（4秒） =====
console.log('🎬 生成场景7: 结尾...')
generateFrames(4, (p) => {
  drawBg([C.bg2, C.bg1])
  
  // 粒子
  for (let i = 0; i < 60; i++) {
    const px = (Math.sin(i * 0.5 + p * Math.PI * 2) * 0.5 + 0.5) * WIDTH
    const py = (Math.cos(i * 0.3 + p * Math.PI * 2) * 0.5 + 0.5) * HEIGHT
    ctx.fillStyle = `rgba(124, 58, 237, ${0.08 + Math.sin(i + p * 4) * 0.05})`
    ctx.beginPath()
    ctx.arc(px, py, 2 + Math.sin(i) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  
  const fadeIn = Math.min(1, p * 3)
  ctx.globalAlpha = fadeIn
  
  drawText('感谢关注', WIDTH / 2, 220, { size: 60, bold: true, align: 'center' })
  drawText('微信商户号申诉专业助手', WIDTH / 2, 320, { size: 32, align: 'center', color: '#C4B5FD' })
  
  const btnP = Math.max(0, Math.min(1, (p - 0.3) * 3))
  ctx.globalAlpha = easeInOut(btnP)
  drawRoundRect(WIDTH / 2 - 220, 420, 440, 60, 30, C.primary)
  drawText('⭐ Star on GitHub', WIDTH / 2, 432, { size: 22, bold: true, align: 'center' })
  
  ctx.globalAlpha = Math.max(0, Math.min(1, (p - 0.4) * 3))
  drawText('github.com/aiyangdie/merchant-appeal', WIDTH / 2, 510, { size: 20, align: 'center', color: '#A78BFA' })
  
  ctx.globalAlpha = Math.max(0, Math.min(1, (p - 0.5) * 3))
  drawText('Made with ❤️ by aiyang', WIDTH / 2, 580, { size: 16, align: 'center', color: '#94A3B8' })
  
  ctx.globalAlpha = 1
})

console.log(`✅ 共生成 ${frameCount} 帧`)
console.log('🎬 正在合成视频...')

// 用 FFmpeg 合成
try {
  // 刷新 PATH 以使用新安装的 ffmpeg
  const ffmpegPaths = [
    'ffmpeg',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\ffmpeg.exe`,
  ]
  
  let ffmpegCmd = 'ffmpeg'
  for (const fp of ffmpegPaths) {
    try {
      execSync(`"${fp}" -version`, { stdio: 'ignore' })
      ffmpegCmd = fp
      break
    } catch {}
  }
  
  const cmd = `"${ffmpegCmd}" -y -framerate ${FPS} -i "${FRAME_DIR}/frame_%06d.png" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 23 -movflags +faststart "${OUTPUT}"`
  console.log('执行:', cmd)
  execSync(cmd, { stdio: 'inherit', timeout: 120000 })
  console.log(`\n✅ 视频已生成: ${OUTPUT}`)
  console.log(`   分辨率: ${WIDTH}x${HEIGHT}`)
  console.log(`   帧率: ${FPS}fps`)
  console.log(`   总帧数: ${frameCount}`)
  console.log(`   时长: ~${Math.round(frameCount / FPS)}秒`)
} catch (err) {
  console.error('FFmpeg 合成失败:', err.message)
  console.log('\n帧文件已保存在:', FRAME_DIR)
  console.log('你可以手动执行:')
  console.log(`ffmpeg -framerate ${FPS} -i "${FRAME_DIR}/frame_%06d.png" -c:v libx264 -pix_fmt yuv420p "${OUTPUT}"`)
}
