import PptxGenJS from 'pptxgenjs'
import { writeFileSync } from 'fs'

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'aiyang'
pptx.company = '商户号申诉专业助手'
pptx.subject = '项目介绍'
pptx.title = '微信商户号申诉专业助手 - AI驱动的智能申诉解决方案'

// 配色方案
const COLORS = {
  primary: '7C3AED',    // 紫色
  secondary: '3B82F6',  // 蓝色
  accent: '10B981',     // 绿色
  dark: '1E293B',       // 深色
  light: 'F8FAFC',      // 浅色
  white: 'FFFFFF',
  gray: '64748B',
  orange: 'F59E0B',
  red: 'EF4444',
}

// ===== 封面页 =====
const slide1 = pptx.addSlide()
slide1.background = { color: COLORS.primary }
slide1.addText('🛡️', { x: 0, y: 1.0, w: '100%', h: 1.0, fontSize: 60, align: 'center', color: COLORS.white })
slide1.addText('微信商户号申诉专业助手', { x: 0, y: 2.0, w: '100%', h: 0.8, fontSize: 36, bold: true, align: 'center', color: COLORS.white, fontFace: 'Microsoft YaHei' })
slide1.addText('Merchant Appeal Assistant', { x: 0, y: 2.7, w: '100%', h: 0.5, fontSize: 18, align: 'center', color: 'D8B4FE', fontFace: 'Segoe UI' })
slide1.addText('AI驱动的智能申诉解决方案\n基于 DeepSeek 大模型 · React + Express + MySQL', { x: 0, y: 3.5, w: '100%', h: 0.8, fontSize: 16, align: 'center', color: 'E9D5FF', fontFace: 'Microsoft YaHei' })
slide1.addText('github.com/aiyangdie/merchant-appeal', { x: 0, y: 4.8, w: '100%', h: 0.4, fontSize: 12, align: 'center', color: 'C4B5FD', fontFace: 'Segoe UI' })

// ===== 痛点分析 =====
const slide2 = pptx.addSlide()
slide2.background = { color: COLORS.white }
slide2.addText('🎯 市场痛点', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide2.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.primary, width: 3 } })

const painPoints = [
  { icon: '😰', title: '不知道准备什么材料', desc: '商户被风控后一头雾水，不知从何下手' },
  { icon: '📄', title: '申诉材料不专业', desc: '自己写的材料漏洞百出，反复被驳回' },
  { icon: '💸', title: '找顾问费用高昂', desc: '专业申诉顾问收费数千元，中小商户负担重' },
  { icon: '📋', title: '模板千篇一律', desc: '网上模板不针对具体情况，通过率低' },
]
painPoints.forEach((p, i) => {
  const y = 1.3 + i * 1.0
  slide2.addText(p.icon, { x: 0.5, y, w: 0.6, h: 0.6, fontSize: 24, align: 'center' })
  slide2.addText(p.title, { x: 1.2, y, w: 3, h: 0.35, fontSize: 16, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
  slide2.addText(p.desc, { x: 1.2, y: y + 0.35, w: 5, h: 0.35, fontSize: 12, color: COLORS.gray, fontFace: 'Microsoft YaHei' })
})

// 右侧解决方案
slide2.addShape(pptx.ShapeType.roundRect, { x: 7.5, y: 1.2, w: 5.2, h: 3.8, fill: { color: 'F5F3FF' }, rectRadius: 0.15 })
slide2.addText('💡 我们的解决方案', { x: 7.7, y: 1.3, w: 4.8, h: 0.5, fontSize: 16, bold: true, color: COLORS.primary, fontFace: 'Microsoft YaHei' })
slide2.addText(
  '• AI 对话自动引导收集所有必要信息\n• 基于行业知识库生成专业申诉材料\n• Token 计费，成本低至几毛钱一次\n• 根据每个商户情况定制个性化方案\n• 内置成功案例，智能匹配最优策略',
  { x: 7.7, y: 1.9, w: 4.8, h: 3.0, fontSize: 13, color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 28 }
)

// ===== 核心特性 =====
const slide3 = pptx.addSlide()
slide3.background = { color: COLORS.white }
slide3.addText('✨ 核心特性', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide3.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.primary, width: 3 } })

const features = [
  { icon: '🤖', title: 'AI 智能对话', desc: 'DeepSeek大模型驱动\n像朋友聊天一样自然', color: '7C3AED' },
  { icon: '🔍', title: '智能信息提取', desc: '100% AI提取\n零正则零硬编码', color: '3B82F6' },
  { icon: '🏭', title: '行业自适应', desc: '30+行业知识库\n自动匹配申诉策略', color: '10B981' },
  { icon: '📋', title: '专业材料生成', desc: '结构化报告\n可直接提交官方', color: 'F59E0B' },
  { icon: '⚡', title: '极致性能', desc: 'SSE流式传输\n首字节<1秒', color: 'EF4444' },
  { icon: '🔒', title: '反幻觉防线', desc: '四重防护\n杜绝AI编造', color: '8B5CF6' },
]
features.forEach((f, i) => {
  const col = i % 3
  const row = Math.floor(i / 3)
  const x = 0.5 + col * 4.2
  const y = 1.3 + row * 1.8
  slide3.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.8, h: 1.5, fill: { color: COLORS.light }, rectRadius: 0.1, line: { color: f.color, width: 1.5 } })
  slide3.addText(f.icon, { x, y: y + 0.1, w: 3.8, h: 0.5, fontSize: 24, align: 'center' })
  slide3.addText(f.title, { x, y: y + 0.55, w: 3.8, h: 0.35, fontSize: 14, bold: true, align: 'center', color: COLORS.dark, fontFace: 'Microsoft YaHei' })
  slide3.addText(f.desc, { x, y: y + 0.9, w: 3.8, h: 0.5, fontSize: 11, align: 'center', color: COLORS.gray, fontFace: 'Microsoft YaHei' })
})

// ===== 系统架构 =====
const slide4 = pptx.addSlide()
slide4.background = { color: COLORS.white }
slide4.addText('🏗️ 系统架构', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide4.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.primary, width: 3 } })

// 前端
slide4.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.5, w: 3.5, h: 2.5, fill: { color: 'EFF6FF' }, rectRadius: 0.15, line: { color: COLORS.secondary, width: 2 } })
slide4.addText('前端 (React SPA)', { x: 0.5, y: 1.6, w: 3.5, h: 0.4, fontSize: 14, bold: true, align: 'center', color: COLORS.secondary, fontFace: 'Microsoft YaHei' })
slide4.addText('• React 18 + Router\n• TailwindCSS\n• SSE 流式接收\n• 实时 Token 显示', { x: 0.7, y: 2.1, w: 3.1, h: 1.8, fontSize: 12, color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 22 })

// 后端
slide4.addShape(pptx.ShapeType.roundRect, { x: 4.5, y: 1.5, w: 4.0, h: 2.5, fill: { color: 'F5F3FF' }, rectRadius: 0.15, line: { color: COLORS.primary, width: 2 } })
slide4.addText('后端 (Express API)', { x: 4.5, y: 1.6, w: 4.0, h: 0.4, fontSize: 14, bold: true, align: 'center', color: COLORS.primary, fontFace: 'Microsoft YaHei' })
slide4.addText('• 规则引擎 (localAI)\n• 行业知识库 (30+行业)\n• Token计费 + JWT认证\n• AES-256 数据加密', { x: 4.7, y: 2.1, w: 3.6, h: 1.8, fontSize: 12, color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 22 })

// 外部服务
slide4.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 1.5, w: 3.5, h: 1.1, fill: { color: 'ECFDF5' }, rectRadius: 0.15, line: { color: COLORS.accent, width: 2 } })
slide4.addText('DeepSeek API', { x: 9.0, y: 1.55, w: 3.5, h: 0.35, fontSize: 13, bold: true, align: 'center', color: COLORS.accent, fontFace: 'Microsoft YaHei' })
slide4.addText('对话/提取/评估/报告/扩展', { x: 9.0, y: 1.9, w: 3.5, h: 0.35, fontSize: 11, align: 'center', color: COLORS.gray, fontFace: 'Microsoft YaHei' })

slide4.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 2.9, w: 3.5, h: 1.1, fill: { color: 'FFF7ED' }, rectRadius: 0.15, line: { color: COLORS.orange, width: 2 } })
slide4.addText('MySQL 8.0', { x: 9.0, y: 2.95, w: 3.5, h: 0.35, fontSize: 13, bold: true, align: 'center', color: COLORS.orange, fontFace: 'Microsoft YaHei' })
slide4.addText('用户/会话/消息/计费/案例', { x: 9.0, y: 3.3, w: 3.5, h: 0.35, fontSize: 11, align: 'center', color: COLORS.gray, fontFace: 'Microsoft YaHei' })

// 箭头文字
slide4.addText('SSE Stream ◄►', { x: 3.2, y: 2.5, w: 2.0, h: 0.3, fontSize: 10, align: 'center', color: COLORS.gray })
slide4.addText('API ◄►', { x: 7.8, y: 2.0, w: 1.5, h: 0.3, fontSize: 10, align: 'center', color: COLORS.gray })

// DeepSeek 5处调用
slide4.addText('DeepSeek API 5 处调用点', { x: 0.5, y: 4.3, w: 12, h: 0.35, fontSize: 13, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
const apiCalls = ['对话生成 (流式)', '字段提取 (并行)', '完成度评估 (异步)', '报告生成 (流式)', '行业扩展 (触发式)']
apiCalls.forEach((call, i) => {
  slide4.addShape(pptx.ShapeType.roundRect, { x: 0.5 + i * 2.4, y: 4.7, w: 2.2, h: 0.5, fill: { color: 'F5F3FF' }, rectRadius: 0.08 })
  slide4.addText(call, { x: 0.5 + i * 2.4, y: 4.7, w: 2.2, h: 0.5, fontSize: 10, align: 'center', color: COLORS.primary, fontFace: 'Microsoft YaHei' })
})

// ===== 技术栈 =====
const slide5 = pptx.addSlide()
slide5.background = { color: COLORS.white }
slide5.addText('🔧 技术栈', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide5.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.primary, width: 3 } })

const techStack = [
  ['前端框架', 'React 18 + React Router 6', '3B82F6'],
  ['UI 样式', 'TailwindCSS 3.4', '06B6D4'],
  ['构建工具', 'Vite 6', '8B5CF6'],
  ['后端框架', 'Express 4', '339933'],
  ['数据库', 'MySQL 8.0', '4479A1'],
  ['AI 引擎', 'DeepSeek Chat API', '7C3AED'],
  ['安全防护', 'helmet + JWT + AES-256', 'EF4444'],
  ['Token计算', 'js-tiktoken', 'F59E0B'],
]
techStack.forEach((t, i) => {
  const col = i % 2
  const row = Math.floor(i / 2)
  const x = 0.5 + col * 6.3
  const y = 1.3 + row * 0.85
  slide5.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.8, h: 0.7, fill: { color: COLORS.light }, rectRadius: 0.08 })
  slide5.addShape(pptx.ShapeType.roundRect, { x, y, w: 0.15, h: 0.7, fill: { color: t[2] }, rectRadius: 0.02 })
  slide5.addText(t[0], { x: x + 0.3, y, w: 2.2, h: 0.7, fontSize: 13, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei', valign: 'middle' })
  slide5.addText(t[1], { x: x + 2.5, y, w: 3.0, h: 0.7, fontSize: 13, color: COLORS.gray, fontFace: 'Segoe UI', valign: 'middle' })
})

// ===== 反幻觉机制 =====
const slide6 = pptx.addSlide()
slide6.background = { color: COLORS.white }
slide6.addText('🔒 反幻觉四重防线', { x: 0.5, y: 0.3, w: 8, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide6.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.red, width: 3 } })
slide6.addText('确保 AI 输出 100% 基于用户真实信息，严禁编造', { x: 0.5, y: 1.0, w: 10, h: 0.4, fontSize: 14, color: COLORS.gray, fontFace: 'Microsoft YaHei' })

const defenses = [
  { layer: '第1层', title: '对话 Prompt', desc: '反幻觉铁律嵌入系统提示词\n严禁编造用户未说过的细节', color: 'EF4444' },
  { layer: '第2层', title: '提取 Prompt', desc: '严格过滤规则\n提问/催促/闲聊不提取为数据', color: 'F59E0B' },
  { layer: '第3层', title: '报告 Prompt', desc: '报告生成禁止脑补\n只使用已确认的真实信息', color: '3B82F6' },
  { layer: '第4层', title: '服务端校验', desc: '格式/内容/长度校验\n拒绝脏数据入库', color: '10B981' },
]
defenses.forEach((d, i) => {
  const x = 0.5 + i * 3.1
  slide6.addShape(pptx.ShapeType.roundRect, { x, y: 1.7, w: 2.8, h: 2.5, fill: { color: COLORS.light }, rectRadius: 0.15, line: { color: d.color, width: 2 } })
  slide6.addShape(pptx.ShapeType.roundRect, { x: x + 0.8, y: 1.5, w: 1.2, h: 0.4, fill: { color: d.color }, rectRadius: 0.08 })
  slide6.addText(d.layer, { x: x + 0.8, y: 1.5, w: 1.2, h: 0.4, fontSize: 11, bold: true, align: 'center', color: COLORS.white, fontFace: 'Microsoft YaHei' })
  slide6.addText(d.title, { x, y: 2.1, w: 2.8, h: 0.4, fontSize: 15, bold: true, align: 'center', color: d.color, fontFace: 'Microsoft YaHei' })
  slide6.addText(d.desc, { x, y: 2.6, w: 2.8, h: 1.2, fontSize: 11, align: 'center', color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 20 })
})

// 底部强调
slide6.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 4.5, w: 12, h: 0.6, fill: { color: 'FEF2F2' }, rectRadius: 0.1 })
slide6.addText('⛔ 用户没说的东西 = 不存在 · 不允许合理推测 · 不允许行业惯例补充 · 不允许举例混入虚构', { x: 0.5, y: 4.5, w: 12, h: 0.6, fontSize: 12, align: 'center', color: COLORS.red, fontFace: 'Microsoft YaHei' })

// ===== 商业模式 =====
const slide7 = pptx.addSlide()
slide7.background = { color: COLORS.white }
slide7.addText('💰 商业模式', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide7.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.orange, width: 3 } })

// 官方模式
slide7.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.3, w: 5.8, h: 2.5, fill: { color: 'F5F3FF' }, rectRadius: 0.15 })
slide7.addText('官方模式', { x: 0.5, y: 1.4, w: 5.8, h: 0.45, fontSize: 18, bold: true, align: 'center', color: COLORS.primary, fontFace: 'Microsoft YaHei' })
slide7.addText(
  '• 用户充值获得余额\n• 每次AI调用按Token自动扣费\n• 管理员可调整费用倍率\n• 余额不足自动拦截\n• 适合：平台化运营',
  { x: 0.8, y: 2.0, w: 5.2, h: 1.6, fontSize: 13, color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 24 }
)

// 自定义模式
slide7.addShape(pptx.ShapeType.roundRect, { x: 6.8, y: 1.3, w: 5.8, h: 2.5, fill: { color: 'ECFDF5' }, rectRadius: 0.15 })
slide7.addText('自定义模式', { x: 6.8, y: 1.4, w: 5.8, h: 0.45, fontSize: 18, bold: true, align: 'center', color: COLORS.accent, fontFace: 'Microsoft YaHei' })
slide7.addText(
  '• 用户使用自己的DeepSeek Key\n• 不扣平台余额\n• 费用由用户自行承担\n• 适合：技术用户/大客户\n• 适合：私有化部署',
  { x: 7.1, y: 2.0, w: 5.2, h: 1.6, fontSize: 13, color: COLORS.dark, fontFace: 'Microsoft YaHei', lineSpacing: 24 }
)

// 成本优势
slide7.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 4.1, w: 12, h: 1.0, fill: { color: 'FFF7ED' }, rectRadius: 0.1 })
slide7.addText('💡 成本优势：每次申诉对话仅消耗约 2000-5000 Token（约 ¥0.01-0.05），生成报告约 5000-10000 Token（约 ¥0.05-0.10）', { x: 0.5, y: 4.1, w: 12, h: 1.0, fontSize: 13, align: 'center', color: COLORS.orange, fontFace: 'Microsoft YaHei', valign: 'middle' })

// ===== 路线图 =====
const slide8 = pptx.addSlide()
slide8.background = { color: COLORS.white }
slide8.addText('🗺️ 路线图', { x: 0.5, y: 0.3, w: 6, h: 0.6, fontSize: 28, bold: true, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
slide8.addShape(pptx.ShapeType.line, { x: 0.5, y: 0.9, w: 2, h: 0, line: { color: COLORS.accent, width: 3 } })

const roadmapDone = ['AI 智能对话引擎', 'DeepSeek 统一字段提取', '行业自适应系统', '申诉材料自动生成', '成功案例知识库', 'Token 计费系统', '管理后台', 'SSE 流式响应']
const roadmapTodo = ['多轮申诉跟踪', '申诉成功率统计', '微信小程序端', '更多支付渠道', '多 AI 模型支持']

slide8.addText('✅ 已完成', { x: 0.5, y: 1.2, w: 3, h: 0.4, fontSize: 16, bold: true, color: COLORS.accent, fontFace: 'Microsoft YaHei' })
roadmapDone.forEach((item, i) => {
  const col = i % 2
  const row = Math.floor(i / 2)
  slide8.addText(`✅ ${item}`, { x: 0.5 + col * 3.2, y: 1.7 + row * 0.5, w: 3.0, h: 0.4, fontSize: 12, color: COLORS.dark, fontFace: 'Microsoft YaHei' })
})

slide8.addText('🔮 规划中', { x: 7.0, y: 1.2, w: 3, h: 0.4, fontSize: 16, bold: true, color: COLORS.primary, fontFace: 'Microsoft YaHei' })
roadmapTodo.forEach((item, i) => {
  slide8.addText(`○ ${item}`, { x: 7.0, y: 1.7 + i * 0.5, w: 5, h: 0.4, fontSize: 12, color: COLORS.gray, fontFace: 'Microsoft YaHei' })
})

// ===== 结束页 =====
const slide9 = pptx.addSlide()
slide9.background = { color: COLORS.primary }
slide9.addText('感谢关注', { x: 0, y: 1.5, w: '100%', h: 0.8, fontSize: 40, bold: true, align: 'center', color: COLORS.white, fontFace: 'Microsoft YaHei' })
slide9.addText('微信商户号申诉专业助手', { x: 0, y: 2.3, w: '100%', h: 0.5, fontSize: 20, align: 'center', color: 'E9D5FF', fontFace: 'Microsoft YaHei' })
slide9.addText('⭐ Star on GitHub', { x: 0, y: 3.2, w: '100%', h: 0.5, fontSize: 18, align: 'center', color: COLORS.white, fontFace: 'Segoe UI' })
slide9.addText('github.com/aiyangdie/merchant-appeal', { x: 0, y: 3.7, w: '100%', h: 0.4, fontSize: 14, align: 'center', color: 'C4B5FD', fontFace: 'Segoe UI' })
slide9.addText('Made with ❤️ by aiyang', { x: 0, y: 4.5, w: '100%', h: 0.4, fontSize: 12, align: 'center', color: 'D8B4FE', fontFace: 'Segoe UI' })

// 生成文件
const outputPath = './docs/merchant-appeal-intro.pptx'
pptx.writeFile({ fileName: outputPath }).then(() => {
  console.log(`✅ PPT 已生成: ${outputPath}`)
}).catch(err => {
  console.error('生成失败:', err)
})
