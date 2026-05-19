/**
 * 聊天消息组件
 * @description 渲染用户、AI、管理员和系统消息，支持 Markdown 解析、报告分块渲染、复制功能
 * 
 * 核心功能：
 * 1. Markdown 解析 — 将 Markdown 格式转换为 HTML，支持表格、代码块、列表、粗体等
 * 2. 报告分块渲染 — 检测以 ### 开头的报告格式，分段渲染并单独复制
 * 3. 微信复制优化 — 去除格式符号保留 emoji，输出可直接粘贴到微信的纯文本
 * 4. 安全转义 — XSS 防护，HTML 实体转义，URL 协议验证
 * 5. 性能优化 — React.memo 包装，useMemo 缓存解析结果
 * 6. 主题支持 — 支持专业模式（proMode）暗色主题
 * 
 * 消息角色类型：
 * - user: 用户消息（右侧对齐，绿色气泡）
 * - assistant/AI: AI 助手消息（左侧对齐，白色气泡）
 * - admin: 人工客服消息（左侧对齐，白色气泡带绿色边框）
 * - system: 系统消息（居中，琥珀色提示）
 */
import React, { useState, memo, useMemo } from 'react'
import DOMPurify from 'dompurify'

/**
 * 复制按钮组件
 * @description 带状态反馈的复制按钮，点击后显示"已复制"状态，2秒后恢复
 * 
 * 复制策略：优先使用 navigator.clipboard.writeText，失败时回退到 execCommand('copy')
 * 
 * @param {Object} props
 * @param {string} props.text - 要复制的文本内容
 * @param {string} [props.label='复制'] - 按钮显示的标签文本
 */
const CopyButton = memo(function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <button onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all border ${
        copied
          ? 'bg-green-50 text-green-600 border-green-200'
          : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600 hover:bg-green-50'
      }`}>
      {copied ? (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>已复制</>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{label || '复制'}</>
      )}
    </button>
  )
})

/**
 * 去除 emoji 符号 + 清理异常符号
 * @description 移除 emoji、特殊符号（☐✅❓⚡⏳），将行首的 •· 转换为标准 markdown 列表
 * @param {string} text - 原始文本
 * @returns {string} 清理后的文本
 */
function stripEmoji(text) {
  if (!text) return text
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[☐✅❓⚡⏳]/g, '')
    .replace(/^[ \t]*[•·]\s*/gm, '- ')           // 行首 ·• 转标准 markdown 列表
    .replace(/[•·]/g, '')                         // 行内残余 ·• 删除
    .replace(/  +/g, ' ')
    .replace(/^ /gm, '')
}

/**
 * 去除 Markdown 格式，返回纯文本
 * @description 移除所有 Markdown 格式标记，输出可直接粘贴到微信的纯文本
 * 
 * 处理顺序：代码块 → 行内代码 → 粗体 → 斜体 → 标题 → 引用 → 列表 → 链接 → 分隔线
 * 
 * @param {string} text - Markdown 格式文本
 * @returns {string} 清理后的纯文本
 */
function stripMarkdown(text) {
  if (!text) return ''
  let t = text
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, '$2')  // 代码块
  t = t.replace(/`([^`]+)`/g, '$1')                    // 行内代码
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, '$1')           // 粗体（支持跨行）
  t = t.replace(/\*\*/g, '')                             // 清除残余未配对的 **
  t = t.replace(/\*(.+?)\*/g, '$1')                     // 斜体
  t = t.replace(/^#{1,6}\s+/gm, '')                     // 标题符号
  t = t.replace(/^>\s+/gm, '')                          // 引用
  t = t.replace(/^[ \t]*[•·]\s*/gm, '')                 // •· 列表符号
  t = t.replace(/^[ \t]*[-]\s+/gm, '')                  // - 列表符号
  t = t.replace(/^\d+\.\s+/gm, '')                      // 有序列表符号
  t = t.replace(/\[(.+?)\]\(.+?\)/g, '$1')              // 链接
  t = t.replace(/^---$/gm, '')                          // 分隔线
  t = t.replace(/\n{3,}/g, '\n\n')                       // 多余空行
  return t.trim()
}

/**
 * 整理文本用于微信复制
 * @description 去除格式符号但保留 emoji，输出干净可粘贴文本
 * 
 * 与 stripMarkdown 的区别：保留有序列表编号，保留 emoji 表情符号
 * 
 * @param {string} text - 原始文本
 * @returns {string} 清理后的纯文本（保留 emoji）
 */
function cleanTextForCopy(text) {
  if (!text) return ''
  let t = text
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, '$2')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, '$1')           // 粗体（支持跨行）
  t = t.replace(/\*\*/g, '')                             // 清除残余未配对的 **
  t = t.replace(/\*(.+?)\*/g, '$1')
  t = t.replace(/^#{1,6}\s+/gm, '')
  t = t.replace(/^>\s?/gm, '')
  t = t.replace(/^[ \t]*[•·]\s*/gm, '')                 // 去掉•·符号
  t = t.replace(/^[ \t]*[-]\s+/gm, '')
  t = t.replace(/^(\d+)\.\s+/gm, '$1. ')               // 保留有序编号
  t = t.replace(/\[(.+?)\]\(.+?\)/g, '$1')
  t = t.replace(/^---$/gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t.replace(/[ \t]+$/gm, '')                        // 行尾空格
  return t.trim()
}

/**
 * 检测报告分段
 * @description 以 ### 开头的段落作为分段标记，返回结构化分段数组
 * 
 * 用于报告格式检测：当 AI 回复包含多个 ### 标题时，将其拆分为可独立复制的段落
 * 
 * @param {string} text - 完整文本内容
 * @returns {Array<{title: string, content: string, fullText: string}>} 分段数组
 */
function extractReportSections(text) {
  if (!text) return []
  const sections = []
  const regex = /^###\s+(.+)$/gm
  let match
  const matches = []
  while ((match = regex.exec(text)) !== null) {
    matches.push({ title: match[1], start: match.index, headerEnd: match.index + match[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length
    const body = text.slice(m.headerEnd, end).trim()
    sections.push({ title: stripEmoji(m.title.replace(/\*\*/g, '')).trim(), content: body, fullText: stripMarkdown(body) })
  }
  return sections
}

/**
 * Markdown 解析器
 * @description 将 Markdown 格式文本转换为 HTML，用于 dangerouslySetInnerHTML 渲染
 * 
 * 解析顺序：
 * 1. XSS 防护 — HTML 实体转义（& < > 转义，引用符号还原）
 * 2. 代码块提取 — 提取代码块为占位符，防止内部内容被解析
 * 3. 行内代码 — 转换为 <code> 标签
 * 4. 表格提取 — 提取表格为占位符，解析为 HTML table
 * 5. 引用块 — > text 转换为普通文本
 * 6. 标题 — ## ### 转换为 h2 h3
 * 7. 粗体 — **text** 转换为 strong
 * 8. 链接 — [text](url) 转换为 a 标签（带 URL 协议验证）
 * 9. 列表 — 无序/有序列表转换为 ul/li
 * 10. 段落 — 换行符转换为 <br /> 和 <p>
 * 11. 特殊标记 — [推荐商品:ID] 和 [推荐名片:ID] 转换为美化卡片
 * 12. 占位符还原 — 还原代码块和表格占位符
 * 
 * @param {string} text - Markdown 格式文本
 * @returns {string} HTML 字符串
 */
function parseMarkdown(text) {
  if (!text) return ''

  let cleaned = text

  // XSS 防护：先转义 HTML 实体（在 markdown 解析之前）
  cleaned = cleaned.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // 还原 markdown 引用符号 &gt; 回 >（仅行首）
  cleaned = cleaned.replace(/^&gt;\s/gm, '> ')

  // 先提取代码块，替换为占位符
  const codeBlocks = []
  let html = cleaned.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length
    const escaped = code.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    codeBlocks.push(`<pre class="md-code"><code>${escaped}</code></pre>`)
    return `\n%%CODE_${idx}%%\n`
  })
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

  // 先提取表格块，替换为占位符，防止被后续规则破坏
  const tables = []
  html = html.replace(/(?:^|\n)((?:\|.+\|[ ]*\n){2,})/g, (match, tableBlock) => {
    const lines = tableBlock.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return match
    // 判断第二行是否为分隔行 |---|---|
    const isHeaderSep = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(lines[1].trim())
    let thead = '', tbody = ''
    const parseRow = (line, tag) => {
      const cells = line.split('|').filter((c, i, a) => i > 0 && i < a.length - (a[a.length-1].trim() === '' ? 1 : 0))
      return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>'
    }
    if (isHeaderSep) {
      thead = '<thead>' + parseRow(lines[0], 'th') + '</thead>'
      tbody = '<tbody>' + lines.slice(2).map(l => parseRow(l, 'td')).join('') + '</tbody>'
    } else {
      tbody = '<tbody>' + lines.map(l => parseRow(l, 'td')).join('') + '</tbody>'
    }
    const idx = tables.length
    tables.push(`<table class="md-table">${thead}${tbody}</table>`)
    return `\n%%TABLE_${idx}%%\n`
  })

  // 引用块 > text → 直接作为普通文本（方便复制到微信）
  html = html.replace(/^> (.+)$/gm, '$1')
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  // 粗体（支持跨行）
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*\*/g, '')  // 清除残余未配对的 **
  // 链接 - XSS 防护：验证 URL 协议
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (match, text, url) => {
    const safeUrl = /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : '#'
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`
  })
  // 无序列表（包括•·-*，允许前导空格）
  html = html.replace(/^[ \t]*[•·]\s*(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^[ \t]*[-*]\s+(.+)$/gm, '<li>$1</li>')
  // 有序列表
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
  // 将连续的 <li> 包裹在 <ul> 中
  html = html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>')
  // 分隔线 → 去掉（方便复制到微信）
  html = html.replace(/^---$/gm, '')
  // 段落 (连续两个换行)
  html = html.replace(/\n\n/g, '</p><p>')
  // 单换行
  html = html.replace(/\n/g, '<br />')
  html = '<p>' + html + '</p>'
  // 清理空段落
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p><br \/><\/p>/g, '')

  // 商品推荐标记 [推荐商品:ID] → 美化商品卡片
  html = html.replace(/\[推荐商品:(\d+)\]/g, `<div class="product-rec-card my-2 p-3 rounded-xl bg-gradient-to-br from-white to-indigo-50/60 border border-indigo-100/80 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group" data-product-id="$1"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg></div><div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">为您推荐专属服务方案</div><div class="text-[11px] text-gray-400 mt-0.5">AI智能匹配 · 点击查看详情</div></div><div class="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-medium rounded-lg shadow-sm group-hover:shadow-md transition-all">查看</div></div></div>`)

  // 名片推荐标记 [推荐名片:ID] → 美化名片卡片
  html = html.replace(/\[推荐名片:(\d+)\]/g, `<div class="contact-rec-card my-2 p-3 rounded-xl bg-gradient-to-br from-white to-amber-50/60 border border-amber-100/80 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group" data-card-id="$1"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"/></svg></div><div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-gray-800 group-hover:text-amber-700 transition-colors">专属技术顾问</div><div class="text-[11px] text-gray-400 mt-0.5">点击查看联系方式</div></div><div class="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-medium rounded-lg shadow-sm group-hover:shadow-md transition-all">联系</div></div></div>`)

  // 还原表格占位符
  tables.forEach((t, i) => { html = html.replace(`%%TABLE_${i}%%`, t) })
  // 还原代码块占位符
  codeBlocks.forEach((c, i) => { html = html.replace(`%%CODE_${i}%%`, c) })

  return DOMPurify.sanitize(html)
}

/**
 * 微信复制功能块
 * @description 提供一键整理并复制纯文本功能，带预览模式
 * 
 * 渲染逻辑：
 * 1. 内容少于10字符 → 不渲染（返回 null）
 * 2. 显示"一键整理并复制"按钮 + "预览纯文本"切换按钮
 * 3. 预览模式下显示 200px 高度可滚动的纯文本框
 * 
 * @param {Object} props
 * @param {string} props.content - 原始 Markdown 内容
 */
const CleanCopyBlock = memo(function CleanCopyBlock({ content }) {
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const cleaned = useMemo(() => cleanTextForCopy(content), [content])

  if (!cleaned || cleaned.length < 10) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleaned)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = cleaned; ta.style.position = 'fixed'; ta.style.left = '-9999px'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100/60">
      <div className="flex items-center gap-2">
        <button onClick={handleCopy}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            copied
              ? 'bg-green-50 text-green-600 border-green-200'
              : 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200/80 hover:border-green-300 hover:shadow-sm'
          }`}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>已复制</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>一键整理并复制</>
          )}
        </button>
        <button onClick={() => setShowPreview(!showPreview)}
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
          {showPreview ? '收起预览' : '预览纯文本'}
        </button>
      </div>
      {showPreview && (
        <div className="mt-2 p-2.5 bg-gray-50/80 rounded-lg border border-gray-100 max-h-[200px] overflow-y-auto">
          <pre className="text-[12px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed select-all">{cleaned}</pre>
        </div>
      )}
    </div>
    )
})

/**
 * 报告内容渲染组件
 * @description 检测并渲染结构化报告格式（多个 ### 标题分段）
 * 
 * 渲染逻辑：
 * 1. 提取所有 ### 开头的分段（至少2个分段才视为报告）
 * 2. 分段前的内容作为前置内容（preContent）单独渲染
 * 3. 顶部显示"一键复制全部"按钮 + 纯文本提示
 * 4. 每个分段独立渲染：标题栏 + 复制按钮 + 内容区
 * 
 * 非报告格式 → 直接渲染为普通 Markdown 内容
 * 
 * @param {Object} props
 * @param {string} props.content - AI 生成的完整报告内容（Markdown 格式）
 */
const ReportContent = memo(function ReportContent({ content }) {
  const sections = useMemo(() => extractReportSections(content), [content])
  const hasReport = sections.length >= 2
  const preContent = useMemo(() => {
    if (!hasReport) return null
    const firstSectionIdx = content.indexOf('###')
    return firstSectionIdx > 0 ? content.slice(0, firstSectionIdx).trim() : ''
  }, [content, hasReport])

  if (!hasReport) {
    return (
      <div className="message-content text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
    )
  }

  return (
    <div className="message-content text-sm leading-relaxed">
      {preContent && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(preContent) }} />}

      <div className="flex items-center gap-2.5 my-3 py-2.5 px-3 bg-gradient-to-r from-green-50/80 to-emerald-50/60 rounded-xl border border-green-100/60">
        <CopyButton text={stripMarkdown(content)} label="一键复制全部" />
        <span className="text-[10px] text-gray-400">纯文本 · 可直接粘贴到申诉表单</span>
      </div>

      {sections.map((sec, i) => (
        <div key={i} className="mb-2.5 rounded-xl border border-gray-100/80 overflow-hidden bg-white">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50/70">
            <span className="text-[11px] font-semibold text-gray-700 tracking-wide">{sec.title}</span>
            <CopyButton text={sec.fullText} label="复制" />
          </div>
          <div className="px-3 py-2 text-[13px]"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(sec.content) }} />
        </div>
      ))}
    </div>
  )
})
/**
 * 消息元数据组件
 * @description 显示消息的计时信息和 Token 使用统计
 * 
 * 渲染逻辑：
 * 1. 无 timing 和 tokenUsage → 不渲染（返回 null）
 * 2. 有 firstByteMs 和 totalMs → 显示首字时间和总耗时
 * 3. 有 inputTokens 和 outputTokens → 显示输入/输出 Token 数
 * 4. 有 cost > 0 → 显示费用（精确到小数点后4位）
 * 
 * @param {Object} props
 * @param {Object} [props.timing] - 计时信息 {firstByteMs, totalMs}
 * @param {Object} [props.tokenUsage] - Token 使用统计 {inputTokens, outputTokens, cost}
 */
const MessageMeta = memo(function MessageMeta({ timing, tokenUsage }) {
  if (!timing && !tokenUsage) return null
  const hasTiming = timing && (timing.totalMs || timing.firstByteMs)
  const hasTokens = tokenUsage && (tokenUsage.inputTokens || tokenUsage.outputTokens)
  if (!hasTiming && !hasTokens) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-gray-100/60 text-[9px] text-gray-400 tabular-nums">
      {hasTiming && (
        <span className="flex items-center gap-0.5">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {timing.firstByteMs && <span>首字 {timing.firstByteMs}ms</span>}
          {timing.totalMs && <span>· 总计 {(timing.totalMs / 1000).toFixed(1)}s</span>}
        </span>
      )}
      {hasTokens && (
        <span className="flex items-center gap-0.5">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
          {tokenUsage.inputTokens && <span>入{tokenUsage.inputTokens}</span>}
          {tokenUsage.outputTokens && <span>出{tokenUsage.outputTokens}</span>}
          {tokenUsage.cost > 0 && <span>· ¥{tokenUsage.cost.toFixed(4)}</span>}
        </span>
      )}
    </div>
  )
})

/**
 * 聊天消息主组件
 * @description 根据消息角色渲染不同样式的消息气泡
 * 
 * 渲染规则：
 * 1. system 角色 → 居中显示，琥珀色背景，小号文字
 * 2. user 角色 → 右侧对齐，绿色渐变气泡，白色文字
 * 3. admin 角色 → 左侧对齐，白色气泡带绿色边框，"人工客服"标签
 * 4. assistant/AI 角色 → 左侧对齐，白色气泡/专业模式气泡
 * 
 * 报告检测：非用户消息且包含≥2个 ### 标题 → 使用 ReportContent 渲染
 * 普通消息：使用 parseMarkdown 渲染 + CleanCopyBlock 复制按钮
 * 
 * @param {Object} props
 * @param {string} props.role - 消息角色 'user' | 'assistant' | 'admin' | 'system'
 * @param {string} props.content - 消息内容（Markdown 格式）
 * @param {boolean} [props.animate=false] - 是否显示入场动画
 * @param {Object} [props.timing] - 计时信息 {firstByteMs, totalMs}
 * @param {Object} [props.tokenUsage] - Token 使用统计 {inputTokens, outputTokens, cost}
 * @param {boolean} [props.proMode=false] - 是否为专业模式（影响主题色和气泡样式）
 */
export default memo(function ChatMessage({ role, content, animate = false, timing, tokenUsage, proMode = false }) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  if (isSystem) {
    return (
      <div className={`flex justify-center my-3 ${animate ? 'message-animate' : ''}`}>
        <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-3 text-center ${proMode ? 'bg-amber-50 border border-amber-200/60' : 'bg-amber-50/80 border border-amber-100'}`}>
          <div className={`message-content text-[13px] leading-relaxed ${proMode ? 'text-amber-800' : 'text-amber-800'}`}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
        </div>
      </div>
    )
  }

  const isReport = !isUser && content && (content.match(/^###\s+/gm) || []).length >= 2

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-1.5 sm:my-2.5 ${animate ? 'message-animate' : ''}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mr-2 sm:mr-2.5 mt-0.5 ${
          role === 'admin'
            ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm'
            : proMode
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-sm shadow-amber-500/15'
              : 'bg-gradient-to-br from-[#07C160] to-[#059669] shadow-sm'
        }`}>
          {role === 'admin' ? (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
          ) : proMode ? (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          )}
        </div>
      )}

      <div
        className={`${isReport ? 'max-w-[92%] lg:max-w-[80%]' : 'max-w-[78%] sm:max-w-[75%] lg:max-w-[70%]'} ${
          isUser
            ? (proMode
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-[20px] rounded-tr-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3'
                : 'bg-gradient-to-br from-[#07C160] to-[#059669] text-white rounded-[20px] rounded-tr-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3')
            : role === 'admin'
              ? 'bg-white text-gray-800 rounded-[20px] rounded-tl-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3 border border-green-100/80'
              : proMode
                ? 'pro-bubble-ai rounded-[20px] rounded-tl-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3'
                : 'bg-white text-gray-800 rounded-[20px] rounded-tl-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3'
        }`}
        style={!isUser && role !== 'admin' && !proMode ? { boxShadow: 'var(--shadow-bubble)' } : isUser && !proMode ? { boxShadow: 'var(--shadow-bubble-user)' } : isUser && proMode ? { boxShadow: '0 1px 3px rgba(184,134,11,0.15)' } : {}}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            {role === 'admin' ? (
              <span className="text-[10px] text-green-600 font-medium">人工客服</span>
            ) : proMode ? (
              <span className="text-[10px] text-amber-600 font-medium">AI 专业顾问</span>
            ) : (
              <span className="text-[10px] text-gray-400 font-medium">AI 助手</span>
            )}
          </div>
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : isReport ? (
          <>
            <ReportContent content={content} />
            <MessageMeta timing={timing} tokenUsage={tokenUsage} />
          </>
        ) : (
          <>
            <div
              className="message-content text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
            />
            <CleanCopyBlock content={content} />
            <MessageMeta timing={timing} tokenUsage={tokenUsage} />
          </>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ml-2 sm:ml-2.5 mt-0.5 shadow-sm">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
      )}
    </div>
  )
})
