/**
 * 管理端 AI 简报 Markdown 渲染（与 AIAnalysisPanel 规则一致，DOMPurify 消毒）
 */
import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

export function markdownToAdminHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.*$)/gm, '<div class="mt-4 mb-2 flex items-center gap-2"><span class="w-1 h-4 rounded-full bg-indigo-500 flex-shrink-0"></span><h2 class="text-sm font-bold text-gray-900 m-0">$1</h2></div>')
    .replace(/^### (.*$)/gm, '<h3 class="text-[13px] font-semibold text-gray-700 mt-3 mb-1 pl-2 border-l-2 border-indigo-300 m-0">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    .replace(/^ +[-·] (.*$)/gm, '<div class="flex gap-1.5 ml-5 my-0.5"><span class="text-gray-300 flex-shrink-0">·</span><span class="text-gray-600">$1</span></div>')
    .replace(/^- (.*$)/gm, '<div class="flex gap-1.5 ml-1.5 my-0.5"><span class="text-indigo-400 flex-shrink-0 mt-0.5">·</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.*$)/gm, '<div class="flex gap-1.5 ml-1.5 my-0.5"><span class="text-indigo-500 font-bold flex-shrink-0 min-w-[16px]">$1.</span><span>$2</span></div>')
    .replace(/^---$/gm, '<hr class="my-3 border-gray-100"/>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br/>')
}

/**
 * @param {Object} props
 * @param {string} props.text - Markdown 原文
 * @param {string} [props.className]
 * @param {string} [props.generatedAt] - ISO 时间，显示页脚
 */
export default function AdminMarkdown({ text, className = '', generatedAt }) {
  const html = useMemo(() => markdownToAdminHtml(text), [text])
  if (!text) return null

  const footer = generatedAt
    ? new Date(generatedAt).toLocaleString('zh-CN')
    : null

  return (
    <div className={className}>
      <div
        className="admin-markdown text-sm text-gray-800 leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
      {footer ? (
        <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
          生成于 {footer}
        </p>
      ) : null}
    </div>
  )
}
