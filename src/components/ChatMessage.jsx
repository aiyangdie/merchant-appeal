import React, { useState } from 'react'

// 去除 emoji 符号 + 清理 ·• 等异常符号
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

// 去除 Markdown 格式，返回纯文本（可直接粘贴到微信）
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

// 整理文本用于微信复制：去掉格式符号，保留 emoji，输出干净可粘贴文本
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

// 检测报告分段（以 ### 开头的段落），返回 [{title, content, fullText}]
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
  // 链接
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
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

  // 还原表格占位符
  tables.forEach((t, i) => { html = html.replace(`%%TABLE_${i}%%`, t) })
  // 还原代码块占位符
  codeBlocks.forEach((c, i) => { html = html.replace(`%%CODE_${i}%%`, c) })

  return html
}

// 复制按钮组件
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级方案
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
}

// 一键整理并复制组件（每条 AI 消息底部显示）
function CleanCopyBlock({ content }) {
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const cleaned = cleanTextForCopy(content)

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
}

// 报告消息渲染（带分段复制按钮）
function ReportContent({ content }) {
  const sections = extractReportSections(content)
  const hasReport = sections.length >= 2

  if (!hasReport) {
    return (
      <div className="message-content text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
    )
  }

  // 报告前面可能有一些文字（在第一个 ### 之前的内容）
  const firstSectionIdx = content.indexOf('###')
  const preContent = firstSectionIdx > 0 ? content.slice(0, firstSectionIdx).trim() : ''

  return (
    <div className="message-content text-sm leading-relaxed">
      {preContent && <div dangerouslySetInnerHTML={{ __html: parseMarkdown(preContent) }} />}

      {/* 一键复制全部 */}
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
}

// 消息底部：延迟 + Token 用量显示
function MessageMeta({ timing, tokenUsage }) {
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
}

export default function ChatMessage({ role, content, animate = false, timing, tokenUsage }) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  // 系统消息（充值提醒等）居中显示
  if (isSystem) {
    return (
      <div className={`flex justify-center my-3 ${animate ? 'message-animate' : ''}`}>
        <div className="max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-3 bg-amber-50/80 border border-amber-100 text-center">
          <div className="message-content text-[13px] leading-relaxed text-amber-800"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
        </div>
      </div>
    )
  }

  // 检测是否是包含报告段落的消息（AI 回复且有 ### 标题）
  const isReport = !isUser && content && (content.match(/^###\s+/gm) || []).length >= 2

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-1.5 sm:my-2.5 ${animate ? 'message-animate' : ''}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mr-2 sm:mr-2.5 mt-0.5 shadow-sm ${
          role === 'admin'
            ? 'bg-gradient-to-br from-orange-400 to-orange-500'
            : 'bg-gradient-to-br from-[#07C160] to-[#059669]'
        }`}>
          {role === 'admin' ? (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
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
            ? 'bg-gradient-to-br from-[#07C160] to-[#059669] text-white rounded-[20px] rounded-tr-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3'
            : role === 'admin'
              ? 'bg-white text-gray-800 rounded-[20px] rounded-tl-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3 border border-orange-100/80'
              : 'bg-white text-gray-800 rounded-[20px] rounded-tl-[6px] px-3.5 sm:px-4 py-2.5 sm:py-3'
        }`}
        style={!isUser && role !== 'admin' ? { boxShadow: 'var(--shadow-bubble)' } : isUser ? { boxShadow: 'var(--shadow-bubble-user)' } : {}}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            {role === 'admin' ? (
              <span className="text-[10px] text-orange-500 font-medium">人工客服</span>
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
}
