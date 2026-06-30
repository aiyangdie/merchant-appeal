import React, { useState, memo, useMemo } from 'react'
import { getStreamStatusLabel, getStreamStatusHint, formatElapsed, shouldShowBubbleStreamStatus } from '../lib/streamStatus.js'

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
  html = html.replace(/\[推荐商品:(\d+)\]/g, `<div class="product-rec-card my-2 p-3 rounded-xl bg-gradient-to-br from-white to-indigo-50/60 border border-indigo-100/80 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group" data-product-id="$1"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg></div><div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">为您推荐专属服务方案</div><div class="text-[11px] text-gray-400 mt-0.5">AI智能匹配 · 点击查看详情</div></div><div class="flex-shrink-0 px-3 py-1.5 bg-purple-500 text-white text-[11px] font-medium rounded-lg shadow-sm group-hover:shadow-md transition-all">查看</div></div></div>`)

  // 名片推荐标记 [推荐名片:ID] → 美化名片卡片
  html = html.replace(/\[推荐名片:(\d+)\]/g, `<div class="contact-rec-card my-2 p-3 rounded-xl bg-gradient-to-br from-white to-amber-50/60 border border-amber-100/80 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group" data-card-id="$1"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"/></svg></div><div class="flex-1 min-w-0"><div class="text-[13px] font-semibold text-gray-800 group-hover:text-amber-700 transition-colors">专属技术顾问</div><div class="text-[11px] text-gray-400 mt-0.5">点击查看联系方式</div></div><div class="flex-shrink-0 px-3 py-1.5 bg-orange-500 text-white text-[11px] font-medium rounded-lg shadow-sm group-hover:shadow-md transition-all">联系</div></div></div>`)

  // 还原表格占位符
  tables.forEach((t, i) => { html = html.replace(`%%TABLE_${i}%%`, t) })
  // 还原代码块占位符
  codeBlocks.forEach((c, i) => { html = html.replace(`%%CODE_${i}%%`, c) })

  return html
}

const MessageActions = memo(function MessageActions({ content }) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const cleaned = useMemo(() => cleanTextForCopy(content), [content])

  if (!cleaned || cleaned.length < 10) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleaned)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = cleaned
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="msg-actions">
      <button type="button" onClick={handleCopy} className="msg-action-btn msg-action-btn--primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        {copied ? '已复制' : '一键整理并复制'}
      </button>
      <button type="button" onClick={() => setShowPreview(v => !v)} className="msg-action-btn msg-action-btn--ghost">
        预览纯文本
      </button>
      {showPreview && (
        <pre className="msg-plain-preview">{cleaned}</pre>
      )}
    </div>
  )
})

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

      <div className="flex items-center gap-2 my-2 py-1">
        <CopyButton text={stripMarkdown(content)} label="复制全部" />
      </div>

      {sections.map((sec, i) => (
        <div key={i} className="msg-report-section">
          <div className="msg-report-head">
            <span className="msg-report-title">{sec.title}</span>
            <CopyButton text={sec.fullText} label="复制" />
          </div>
          <div className="msg-report-body"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(sec.content) }} />
        </div>
      ))}
    </div>
  )
})

const StreamStatusBar = memo(function StreamStatusBar({ status, proMode }) {
  if (!status) return null
  const label = getStreamStatusLabel(status)
  const hint = getStreamStatusHint(status)
  const isWaiting = ['preparing', 'connecting', 'waiting'].includes(status.phase)

  return (
    <div className={`stream-status-bar ${proMode ? 'stream-status-bar--pro' : ''} ${isWaiting ? 'stream-status-bar--wait' : ''}`}>
      <span className={`stream-status-dot ${isWaiting ? 'pulse' : ''}`} />
      <div className="stream-status-text">
        <span className="stream-status-label">{label}</span>
        {hint && <span className="stream-status-hint">{hint}</span>}
      </div>
    </div>
  )
})

const MessageMeta = memo(function MessageMeta({ timing, tokenUsage }) {
  if (!timing && !tokenUsage) return null
  const hasTiming = timing && (timing.totalMs || timing.firstChunkMs || timing.connectMs || timing.firstByteMs)
  const hasTokens = tokenUsage && (tokenUsage.inputTokens || tokenUsage.outputTokens)
  if (!hasTiming && !hasTokens) return null

  const firstMs = timing.firstChunkMs || timing.firstByteMs
  const connectMs = timing.connectMs || timing.firstByteMs

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-gray-400 tabular-nums">
      {hasTiming && (
        <span className="flex items-center gap-1 flex-wrap">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {connectMs != null && <span>连接 {formatElapsed(connectMs)}</span>}
          {firstMs != null && <span>· 首字 {formatElapsed(firstMs)}</span>}
          {timing.totalMs != null && <span>· 总计 {formatElapsed(timing.totalMs)}</span>}
          {timing.model && <span className="text-gray-300">· {timing.model}</span>}
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

export default memo(function ChatMessage({ role, content, animate = false, timing, tokenUsage, proMode = false, streaming = false, streamStatus = null }) {
  const isUser = role === 'user'
  const isSystem = role === 'system'
  const isAdmin = role === 'admin'

  if (isSystem) {
    return (
      <div className={`chat-bubble-row chat-bubble-row--system ${animate ? 'message-animate' : ''}`}>
        <div className="chat-bubble chat-bubble--system">
          <div className="message-content"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
        </div>
      </div>
    )
  }

  const isReport = !isUser && content && (content.match(/^###\s+/gm) || []).length >= 2
  const rowClass = [
    'chat-bubble-row',
    isUser ? 'chat-bubble-row--user' : 'chat-bubble-row--ai',
    proMode ? 'chat-bubble-row--pro' : '',
    animate ? 'message-animate' : '',
  ].filter(Boolean).join(' ')

  const bubbleClass = [
    'chat-bubble',
    isUser ? 'chat-bubble--user' : 'chat-bubble--ai',
    isAdmin ? 'chat-bubble--admin' : '',
    isReport ? 'chat-bubble--report' : '',
    proMode ? 'chat-bubble--pro' : '',
  ].filter(Boolean).join(' ')

  const aiLabel = isAdmin ? '人工客服' : (proMode ? 'AI 专业顾问' : 'AI 助手')

  return (
    <div className={rowClass}>
      {!isUser && (
        <div className={`msg-avatar msg-avatar--ai ${proMode ? 'msg-avatar--pro' : ''}`}>
          {isAdmin ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
          )}
        </div>
      )}

      <div className="chat-bubble-col">
        <div className={bubbleClass}>
          {!isUser && (
            <div className="chat-bubble-label">{aiLabel}</div>
          )}
          {isUser ? (
            <p className="chat-bubble-text chat-bubble-text--user">{content}</p>
          ) : isReport ? (
            <>
              <ReportContent content={content} />
              <MessageActions content={content} />
              <MessageMeta timing={timing} tokenUsage={tokenUsage} />
            </>
          ) : (
            <>
              {streaming && shouldShowBubbleStreamStatus(streamStatus, content?.length || 0) && (
                <StreamStatusBar status={streamStatus} proMode={proMode} />
              )}
              {streaming && !content ? (
                <div className="flex gap-1.5 items-center py-1">
                  <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
                  <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
                  <div className={`typing-dot w-2 h-2 rounded-full ${proMode ? 'bg-orange-300' : 'bg-[#07C160]/40'}`} />
                </div>
              ) : (
                <div
                  className="message-content chat-bubble-text"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
                />
              )}
              {streaming && content && <span className="stream-cursor" aria-hidden="true">▍</span>}
              {!streaming && content && <MessageActions content={content} />}
              {!streaming && <MessageMeta timing={timing} tokenUsage={tokenUsage} />}
            </>
          )}
        </div>
      </div>

      {isUser && (
        <div className="msg-avatar msg-avatar--user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
        </div>
      )}
    </div>
  )
})
