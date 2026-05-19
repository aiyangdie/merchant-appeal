import React from 'react'
import DOMPurify from 'dompurify'

// 清理 markdown 标记，返回纯净 HTML
function mdToHtml(text) {
  if (!text) return ''
  return DOMPurify.sanitize(text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="text-[10px] bg-gray-100 px-1 py-0.5 rounded">$1</code>'))
}

// 清理 markdown 标记，返回纯文本
function mdToText(text) {
  if (!text) return ''
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')
}

// 解析深度分析 markdown 为结构化 sections
function parseAnalysisSections(text) {
  if (!text) return []
  const lines = text.split('\n')
  const sections = []
  let current = null
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/)
    if (h2) {
      if (current) sections.push(current)
      const rawTitle = h2[1]
      const title = rawTitle.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\*\*/g, '').trim()
      const emoji = rawTitle.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu)?.[0] || ''
      current = { title, emoji, raw: '', items: [], subSections: [] }
    } else if (current) {
      current.raw += line + '\n'
      const h3 = line.match(/^###\s+(.+)/)
      if (h3) {
        current.subSections.push({ title: mdToText(h3[1]).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(), items: [] })
      } else {
        const bullet = line.match(/^[-·]\s+(.+)/) || line.match(/^\d+\.\s+(.+)/)
        const indentedBullet = line.match(/^\s{2,}[-·]\s+(.+)/) || line.match(/^\s{2,}\d+\.\s+(.+)/)
        if (indentedBullet) {
          const cleanItem = indentedBullet[1].trim()
          if (current.subSections.length > 0) {
            current.subSections[current.subSections.length - 1].items.push(cleanItem)
          }
          current.items.push(cleanItem)
        } else if (bullet) {
          const cleanItem = bullet[1].trim()
          if (current.subSections.length > 0) {
            current.subSections[current.subSections.length - 1].items.push(cleanItem)
          }
          current.items.push(cleanItem)
        }
      }
    }
  }
  if (current) sections.push(current)
  return sections
}

// 获取 section 的样式配置
function getSectionStyle(title) {
  if (title.includes('案件概况') || title.includes('案情')) return { bg: 'bg-blue-50', border: 'border-blue-200', icon: '📋', iconBg: 'bg-blue-500', dot: 'bg-blue-500', color: 'text-blue-700', light: 'bg-blue-50/50' }
  if (title.includes('对话') || title.includes('信息提取')) return { bg: 'bg-purple-50', border: 'border-purple-200', icon: '💬', iconBg: 'bg-purple-500', dot: 'bg-purple-500', color: 'text-purple-700', light: 'bg-purple-50/50' }
  if (title.includes('风险评估')) return { bg: 'bg-red-50', border: 'border-red-200', icon: '📊', iconBg: 'bg-red-500', dot: 'bg-red-500', color: 'text-red-700', light: 'bg-red-50/50' }
  if (title.includes('资质')) return { bg: 'bg-violet-50', border: 'border-violet-200', icon: '🏢', iconBg: 'bg-violet-500', dot: 'bg-violet-500', color: 'text-violet-700', light: 'bg-violet-50/50' }
  if (title.includes('证据链')) return { bg: 'bg-sky-50', border: 'border-sky-200', icon: '🔗', iconBg: 'bg-sky-500', dot: 'bg-sky-500', color: 'text-sky-700', light: 'bg-sky-50/50' }
  if (title.includes('话术')) return { bg: 'bg-rose-50', border: 'border-rose-200', icon: '🎯', iconBg: 'bg-rose-500', dot: 'bg-rose-500', color: 'text-rose-700', light: 'bg-rose-50/50' }
  if (title.includes('违规')) return { bg: 'bg-orange-50', border: 'border-orange-200', icon: '🔍', iconBg: 'bg-orange-500', dot: 'bg-orange-500', color: 'text-orange-700', light: 'bg-orange-50/50' }
  if (title.includes('警告')) return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '⚠️', iconBg: 'bg-yellow-500', dot: 'bg-yellow-500', color: 'text-yellow-700', light: 'bg-yellow-50/50' }
  if (title.includes('策略') || title.includes('建议')) return { bg: 'bg-green-50', border: 'border-green-200', icon: '🎯', iconBg: 'bg-green-500', dot: 'bg-green-500', color: 'text-green-700', light: 'bg-green-50/50' }
  if (title.includes('材料') || title.includes('清单')) return { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: '📦', iconBg: 'bg-indigo-500', dot: 'bg-indigo-500', color: 'text-indigo-700', light: 'bg-indigo-50/50' }
  if (title.includes('行动') || title.includes('计划') || title.includes('步骤')) return { bg: 'bg-teal-50', border: 'border-teal-200', icon: '📌', iconBg: 'bg-teal-500', dot: 'bg-teal-500', color: 'text-teal-700', light: 'bg-teal-50/50' }
  if (title.includes('风控') || title.includes('逆向') || title.includes('推演')) return { bg: 'bg-rose-50', border: 'border-rose-200', icon: '🔬', iconBg: 'bg-rose-500', dot: 'bg-rose-500', color: 'text-rose-700', light: 'bg-rose-50/50' }
  if (title.includes('话术') || title.includes('电话')) return { bg: 'bg-pink-50', border: 'border-pink-200', icon: '📞', iconBg: 'bg-pink-500', dot: 'bg-pink-500', color: 'text-pink-700', light: 'bg-pink-50/50' }
  if (title.includes('时机') || title.includes('最佳')) return { bg: 'bg-lime-50', border: 'border-lime-200', icon: '⏰', iconBg: 'bg-lime-600', dot: 'bg-lime-600', color: 'text-lime-700', light: 'bg-lime-50/50' }
  if (title.includes('报价') || title.includes('服务') || title.includes('价格')) return { bg: 'bg-amber-50', border: 'border-amber-200', icon: '💰', iconBg: 'bg-amber-500', dot: 'bg-amber-500', color: 'text-amber-700', light: 'bg-amber-50/50' }
  if (title.includes('提交') || title.includes('指南')) return { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: '📮', iconBg: 'bg-cyan-500', dot: 'bg-cyan-500', color: 'text-cyan-700', light: 'bg-cyan-50/50' }
  return { bg: 'bg-gray-50', border: 'border-gray-200', icon: '📄', iconBg: 'bg-gray-500', dot: 'bg-gray-500', color: 'text-gray-700', light: 'bg-gray-50/50' }
}

// 渲染单个条目文本（支持 bold）
function ItemText({ text, className = '' }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
}

export default function AnalysisVisualView({ text }) {
  const sections = parseAnalysisSections(text)
  if (sections.length === 0) return <div className="text-center py-10 text-gray-400 text-sm">暂无可解析的分析内容</div>

  // 提取风险评估的关键数字
  const riskSection = sections.find(s => s.title.includes('风险评估'))
  let riskLevel = '', riskScore = '', successRate = '', riskFactors = []
  if (riskSection) {
    const raw = mdToText(riskSection.raw)
    const levelMatch = raw.match(/难度等级[：:]\s*([\u4e00-\u9fff/\w]+)/)
    const scoreMatch = raw.match(/难度评分[：:]\s*(\d+)/)
    const rateMatch = raw.match(/(?:预估)?成功率[：:]\s*([\d%～~\-—.]+)/)
    riskLevel = levelMatch?.[1] || ''
    riskScore = scoreMatch?.[1] || ''
    successRate = rateMatch?.[1] || ''
    // 提取核心难点/影响因素（包括缩进的子项）
    const riskLines = riskSection.raw.split('\n')
    let inFactors = false
    for (const l of riskLines) {
      const trimmed = l.trim()
      if (trimmed.match(/核心难点|影响因素/)) { inFactors = true; continue }
      if (trimmed.match(/^##/) || trimmed.match(/^###/)) { inFactors = false; continue }
      if (inFactors && (trimmed.startsWith('- ') || trimmed.startsWith('· '))) {
        riskFactors.push(mdToText(trimmed.replace(/^[-·]\s+/, '').trim()))
      }
    }
    if (riskFactors.length === 0) {
      const factorLines = riskLines.filter(l => l.trim().startsWith('·') || (l.trim().startsWith('- ') && !l.includes('难度') && !l.includes('成功率')))
      riskFactors = factorLines.map(l => mdToText(l.replace(/^[\s·\-]+/, '').trim())).filter(Boolean)
    }
    riskFactors = riskFactors.slice(0, 6)
  }

  // 提取资质要求 — 按子分类展示
  const qualSection = sections.find(s => s.title.includes('资质'))
  let qualGroups = []
  if (qualSection && qualSection.subSections.length > 0) {
    qualGroups = qualSection.subSections.filter(s => s.items.length > 0).map(sub => ({
      title: sub.title,
      items: sub.items.map(txt => mdToText(txt).trim())
    }))
  } else if (qualSection && qualSection.items.length > 0) {
    qualGroups = [{ title: '资质要求', items: qualSection.items.map(txt => mdToText(txt).trim()) }]
  }

  // 提取证据链 — 按层级展示
  const evidenceSection = sections.find(s => s.title.includes('证据链'))
  let evidenceLayers = []
  if (evidenceSection && evidenceSection.subSections.length > 0) {
    evidenceLayers = evidenceSection.subSections.filter(s => s.items.length > 0).map(sub => ({
      title: sub.title,
      items: sub.items.map(txt => mdToText(txt).trim())
    }))
  } else if (evidenceSection && evidenceSection.items.length > 0) {
    evidenceLayers = [{ title: '证据链', items: evidenceSection.items.map(txt => mdToText(txt).trim()) }]
  }

  // 提取材料清单 — 分必需和建议，按子分类
  const materialSection = sections.find(s => s.title.includes('材料') || s.title.includes('清单'))
  let materialGroups = []
  if (materialSection && materialSection.subSections.length > 0) {
    materialGroups = materialSection.subSections.filter(s => s.items.length > 0).map(sub => ({
      title: sub.title,
      items: sub.items.map(txt => ({
        text: mdToText(txt).replace(/【必需】|【建议】/g, '').trim(),
        required: txt.includes('必需') || txt.includes('【必需】'),
        original: txt
      }))
    }))
  } else if (materialSection) {
    // 没有子分类，按必需/建议分
    const required = [], suggested = []
    materialSection.items.forEach(txt => {
      const clean = mdToText(txt).replace(/【必需】|【建议】/g, '').trim()
      if (txt.includes('建议') || txt.includes('【建议】')) suggested.push({ text: clean, required: false })
      else required.push({ text: clean, required: true })
    })
    if (required.length) materialGroups.push({ title: '必需材料', items: required })
    if (suggested.length) materialGroups.push({ title: '建议补充', items: suggested })
  }

  // 提取行动计划步骤
  const actionSection = sections.find(s => s.title.includes('行动') || s.title.includes('计划'))
  let actionSteps = []
  if (actionSection) {
    actionSection.raw.split('\n').forEach(line => {
      const m = line.match(/^\d+\.\s+(.+)/)
      if (m) actionSteps.push(mdToText(m[1].trim()))
    })
  }

  // 风险颜色
  const riskColor = riskLevel.includes('极难') || riskLevel.includes('困难') ? 'from-red-500 to-rose-600'
    : riskLevel.includes('较难') ? 'from-orange-500 to-amber-600'
    : riskLevel.includes('中等') ? 'from-yellow-500 to-orange-500'
    : 'from-emerald-500 to-green-600'

  // 过滤掉已单独展示的 sections
  const specialTitles = ['风险评估', '资质', '证据链', '材料', '清单', '行动', '计划', '步骤']
  const otherSections = sections.filter(s => !specialTitles.some(t => s.title.includes(t)))

  return (
    <div className="space-y-3">
      {/* 风险评估卡片 */}
      {(riskLevel || successRate) && (
        <div className={`rounded-2xl bg-gradient-to-br ${riskColor} p-4 text-white shadow-lg relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
          <div className="flex items-center gap-2 mb-3 relative">
            <span className="text-base">📊</span>
            <span className="text-[13px] font-bold tracking-wide">风险评估</span>
          </div>
          <div className="grid grid-cols-3 gap-2 relative">
            {riskLevel && (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/10">
                <div className="text-[9px] opacity-70 mb-1">难度等级</div>
                <div className="text-[15px] font-black">{riskLevel}</div>
              </div>
            )}
            {riskScore && (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/10">
                <div className="text-[9px] opacity-70 mb-1">难度评分</div>
                <div className="text-[15px] font-black">{riskScore}<span className="text-[10px] opacity-60">/100</span></div>
              </div>
            )}
            {successRate && (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/10">
                <div className="text-[9px] opacity-70 mb-1">成功率</div>
                <div className="text-[15px] font-black">{successRate}</div>
              </div>
            )}
          </div>
          {riskFactors.length > 0 && (
            <div className="mt-3 space-y-1 relative">
              <div className="text-[9px] opacity-60 font-medium">影响因素</div>
              {riskFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] opacity-90 leading-snug">
                  <span className="w-1 h-1 rounded-full bg-white/60 flex-shrink-0 mt-1.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 资质要求 */}
      {qualGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100/80 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] shadow-sm">🏢</span>
            <span className="text-[13px] font-bold text-violet-700">资质要求</span>
          </div>
          <div className="p-3 space-y-3">
            {qualGroups.map((group, gi) => (
              <div key={gi}>
                <div className="text-[10px] font-bold text-violet-500 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-violet-400" />
                  {group.title}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-violet-50/40 hover:bg-violet-50/70 rounded-xl transition-colors">
                      <span className="w-5 h-5 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </span>
                      <div className="text-[11px] text-gray-700 leading-relaxed flex-1">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 证据链构建 */}
      {evidenceLayers.length > 0 && (
        <div className="bg-white rounded-2xl border border-sky-100 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-sky-50 to-blue-50 border-b border-sky-100/80 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-[10px] shadow-sm">🔗</span>
            <span className="text-[13px] font-bold text-sky-700">证据链构建</span>
            <span className="ml-auto text-[10px] text-sky-400 bg-sky-100/60 px-2 py-0.5 rounded-full">{evidenceLayers.length} 层</span>
          </div>
          <div className="p-3">
            <div className="relative">
              <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-gradient-to-b from-sky-300 via-blue-200 to-sky-100" />
              <div className="space-y-3">
                {evidenceLayers.map((layer, li) => (
                  <div key={li} className="relative">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 shadow-sm">{li + 1}</div>
                      <div className="text-[11px] font-bold text-sky-700">{layer.title}</div>
                    </div>
                    <div className="ml-9 space-y-1">
                      {layer.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-gray-700 leading-relaxed px-2.5 py-1.5 bg-sky-50/40 rounded-lg">
                          <span className="w-1 h-1 rounded-full bg-sky-400 flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 材料准备清单 */}
      {materialGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100/80 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-[10px] shadow-sm">📦</span>
            <span className="text-[13px] font-bold text-indigo-700">材料准备清单</span>
            <span className="ml-auto text-[10px] text-indigo-400 bg-indigo-100/60 px-2 py-0.5 rounded-full">
              {materialGroups.reduce((a, g) => a + g.items.length, 0)} 项
            </span>
          </div>
          <div className="p-3 space-y-3">
            {materialGroups.map((group, gi) => (
              <div key={gi}>
                <div className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className={`w-2 h-2 rounded-sm ${group.title.includes('必需') || group.items.some(m => m.required) ? 'bg-red-400' : 'bg-blue-400'}`} />
                  {group.title}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((m, i) => {
                    const isRequired = m.required || group.title.includes('必需')
                    return (
                      <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl transition-colors ${isRequired ? 'bg-red-50/40 hover:bg-red-50/70' : 'bg-blue-50/40 hover:bg-blue-50/70'}`}>
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 shadow-sm ${isRequired ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{i + 1}</span>
                        <div className="text-[11px] text-gray-700 leading-relaxed flex-1">{m.text}</div>
                        {isRequired && <span className="text-[8px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-bold flex-shrink-0 mt-0.5">必需</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行动计划时间线 */}
      {actionSteps.length > 0 && (
        <div className="bg-white rounded-2xl border border-teal-100 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100/80 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-[10px] shadow-sm">📌</span>
            <span className="text-[13px] font-bold text-teal-700">行动计划</span>
            <span className="ml-auto text-[10px] text-teal-400 bg-teal-100/60 px-2 py-0.5 rounded-full">{actionSteps.length} 步</span>
          </div>
          <div className="p-3">
            <div className="relative">
              <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-teal-200 to-emerald-100" />
              <div className="space-y-2">
                {actionSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 relative group">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 shadow-sm group-hover:scale-110 transition-transform">{i + 1}</div>
                    <div className="text-[11px] text-gray-700 leading-relaxed pt-1 flex-1 group-hover:text-gray-900 transition-colors">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 其他 sections 以卡片形式展示 */}
      {otherSections.map((sec, i) => {
        const style = getSectionStyle(sec.title)
        const hasContent = sec.raw.trim().split('\n').some(l => l.trim())
        if (!hasContent) return null

        // 区分有子标题的和纯列表的
        const hasSubSections = sec.subSections.length > 0 && sec.subSections.some(s => s.items.length > 0)

        return (
          <div key={i} className={`bg-white rounded-2xl border ${style.border} overflow-hidden shadow-sm`}>
            <div className={`px-4 py-2.5 bg-gradient-to-r ${style.bg} border-b ${style.border}/80 flex items-center gap-2`}>
              <span className={`w-6 h-6 rounded-lg bg-gradient-to-br ${style.iconBg} flex items-center justify-center text-white text-[10px] shadow-sm`}>{sec.emoji || style.icon}</span>
              <span className={`text-[13px] font-bold ${style.color}`}>{sec.title}</span>
              {sec.items.length > 0 && <span className={`ml-auto text-[10px] ${style.color} opacity-50`}>{sec.items.length} 条</span>}
            </div>
            <div className="px-4 py-3">
              {hasSubSections ? (
                <div className="space-y-3">
                  {sec.subSections.filter(s => s.items.length > 0).map((sub, j) => (
                    <div key={j}>
                      <div className="text-[11px] font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {sub.title}
                      </div>
                      <div className="space-y-1 ml-3">
                        {sub.items.map((item, k) => (
                          <div key={k} className={`flex items-start gap-2 text-[11px] text-gray-700 leading-relaxed px-2.5 py-1.5 ${style.light} rounded-lg`}>
                            <span className={`w-1 h-1 rounded-full ${style.dot} flex-shrink-0 mt-1.5`} />
                            <ItemText text={item} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : sec.items.length > 0 ? (
                <div className="space-y-1.5">
                  {sec.items.map((item, j) => (
                    <div key={j} className={`flex items-start gap-2 text-[11px] text-gray-700 leading-relaxed px-2.5 py-1.5 ${style.light} rounded-lg`}>
                      <span className={`w-1 h-1 rounded-full ${style.dot} flex-shrink-0 mt-1.5`} />
                      <ItemText text={item} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(sec.raw.trim())
                  .replace(/^###\s+(.+)/gm, '<div class="font-semibold text-gray-800 mt-2.5 mb-1 text-[12px]">$1</div>')
                  .replace(/^[-·]\s+(.+)/gm, '<div class="flex items-start gap-1.5 ml-1 my-0.5"><span class="text-gray-300 flex-shrink-0">·</span><span>$1</span></div>')
                  .replace(/^\d+\.\s+(.+)/gm, '<div class="ml-1 my-0.5">$&</div>')
                  .replace(/\n\n/g, '<br/>')
                  .replace(/\n/g, ' ')
                }} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
