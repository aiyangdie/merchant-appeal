import React, { useRef, useState, useMemo } from 'react'
import html2canvas from 'html2canvas'

const FIELD_LABELS = {
  industry: '业务类型', business_model: '经营模式',
  problem_type: '处罚类型', violation_reason: '违规原因',
  merchant_id: '商户号', merchant_name: '商户名称',
  company_name: '公司全称', license_no: '信用代码',
  legal_name: '法人姓名', contact_phone: '联系电话',
  complaint_status: '投诉情况', refund_policy: '退款政策',
  appeal_history: '申诉历史',
}

function parseSections(text) {
  if (!text) return {}
  const sections = {}
  const parts = text.split(/^## /gm)
  parts.forEach(part => {
    if (!part.trim()) return
    const lines = part.split('\n')
    const title = lines[0].trim()
    const content = lines.slice(1).join('\n').trim()
    if (title.includes('案件概况')) sections.overview = content
    else if (title.includes('对话')) sections.chatInsights = content
    else if (title.includes('风险评估')) sections.risk = content
    else if (title.includes('违规原因')) sections.violation = content
    else if (title.includes('风险警告') || title.includes('关键风险')) sections.warnings = content
    else if (title.includes('策略建议')) sections.strategies = content
    else if (title.includes('材料清单')) sections.materials = content
    else if (title.includes('行动计划')) sections.actionPlan = content
    else if (title.includes('报价') || title.includes('服务')) sections.pricing = content
  })
  return sections
}

function parseListItems(text) {
  if (!text) return []
  return text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('·')).map(l => l.replace(/^[\s\-·]+/, '').trim()).filter(Boolean)
}

function parseNumberedItems(text) {
  if (!text) return []
  return text.split('\n').filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
}

function parseMaterialGroups(text) {
  if (!text) return []
  const groups = []
  let current = null
  text.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('###')) {
      if (current) groups.push(current)
      current = { title: trimmed.replace(/^#+\s*/, ''), items: [] }
    } else if (trimmed.startsWith('-') || trimmed.startsWith('·')) {
      const item = trimmed.replace(/^[\-·]\s*/, '')
      if (current) current.items.push(item)
      else {
        if (!groups.length) groups.push({ title: '申诉材料', items: [] })
        groups[groups.length - 1].items.push(item)
      }
    }
  })
  if (current) groups.push(current)
  return groups
}

function parseRiskInfo(text) {
  if (!text) return {}
  const info = {}
  const levelMatch = text.match(/难度等级[：:]\s*(.+)/); if (levelMatch) info.level = levelMatch[1].trim()
  const scoreMatch = text.match(/难度评分[：:]\s*(\d+)/); if (scoreMatch) info.score = parseInt(scoreMatch[1])
  const rateMatch = text.match(/预估成功率[：:]\s*(.+)/); if (rateMatch) info.successRate = rateMatch[1].trim()
  const factors = parseListItems(text.split('影响因素')[1] || '')
  if (factors.length) info.factors = factors
  return info
}

export default function ReportCard({ collectedData, analysisText, onClose }) {
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const d = collectedData || {}
  const sections = useMemo(() => parseSections(analysisText), [analysisText])
  const riskInfo = useMemo(() => parseRiskInfo(sections.risk), [sections.risk])
  const materialGroups = useMemo(() => parseMaterialGroups(sections.materials), [sections.materials])
  const actionItems = useMemo(() => parseNumberedItems(sections.actionPlan), [sections.actionPlan])
  const warningItems = useMemo(() => parseListItems(sections.warnings), [sections.warnings])
  const strategyItems = useMemo(() => parseNumberedItems(sections.strategies) || parseListItems(sections.strategies), [sections.strategies])

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 420 })
      const link = document.createElement('a')
      link.download = `申诉分析报告_${d.merchant_name || d.merchant_id || '报告'}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) { console.error('Download error:', e) }
    finally { setDownloading(false) }
  }

  const filledFields = Object.entries(FIELD_LABELS).filter(([k]) => d[k] && String(d[k]).trim())
  const now = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-[460px] w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[14px] font-bold text-gray-800">申诉分析报告</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} disabled={downloading} className="h-8 px-3 flex items-center gap-1.5 text-[11px] text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 rounded-lg shadow-sm transition-all">
              {downloading ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 生成中...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> 保存图片</>
              )}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div ref={cardRef} style={{ width: 420, padding: 24, backgroundColor: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* 报告头部 */}
            <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #e0e7ff' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#312e81', marginBottom: 4 }}>微信商户号申诉分析报告</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>DeepSeek AI · {now}</div>
            </div>

            {/* 客户基本信息 */}
            {filledFields.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#6366f1', borderRadius: 2 }}></span>
                  客户基本信息
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                  {filledFields.map(([k, label]) => (
                    <div key={k} style={{ fontSize: 11, padding: '4px 8px', backgroundColor: '#f8fafc', borderRadius: 6 }}>
                      <span style={{ color: '#94a3b8' }}>{label}：</span>
                      <span style={{ color: '#334155', fontWeight: 500 }}>{d[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 案件概况 */}
            {sections.overview && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#6366f1', borderRadius: 2 }}></span>
                  案件概况
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, padding: '8px 10px', backgroundColor: '#faf5ff', borderRadius: 8, borderLeft: '3px solid #a78bfa' }}>
                  {sections.overview.replace(/\*\*/g, '').replace(/\n+/g, '\n').trim()}
                </div>
              </div>
            )}

            {/* 风险评估 */}
            {riskInfo.level && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#6366f1', borderRadius: 2 }}></span>
                  风险评估
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', backgroundColor: riskInfo.score >= 70 ? '#fef2f2' : riskInfo.score >= 40 ? '#fffbeb' : '#f0fdf4', borderRadius: 10 }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>难度等级</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: riskInfo.score >= 70 ? '#dc2626' : riskInfo.score >= 40 ? '#d97706' : '#16a34a' }}>{riskInfo.level}</div>
                  </div>
                  {riskInfo.score != null && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', backgroundColor: '#f0f9ff', borderRadius: 10 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>难度评分</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{riskInfo.score}/100</div>
                    </div>
                  )}
                  {riskInfo.successRate && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', backgroundColor: '#f0fdf4', borderRadius: 10 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>成功率</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{riskInfo.successRate}</div>
                    </div>
                  )}
                </div>
                {riskInfo.factors?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {riskInfo.factors.map((f, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: 4 }}>{f.replace(/\*\*/g, '')}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 关键风险警告 */}
            {warningItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#ef4444', borderRadius: 2 }}></span>
                  关键风险警告
                </div>
                {warningItems.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#991b1b', padding: '6px 10px', backgroundColor: '#fef2f2', borderRadius: 6, marginBottom: 4, lineHeight: 1.6, borderLeft: '3px solid #fca5a5' }}>
                    ⚠ {w.replace(/\*\*/g, '')}
                  </div>
                ))}
              </div>
            )}

            {/* 申诉材料清单 */}
            {materialGroups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }}></span>
                  申诉材料清单
                </div>
                {materialGroups.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4, paddingLeft: 6, borderLeft: '2px solid #99f6e4' }}>{g.title}</div>
                    {g.items.map((item, ii) => {
                      const isRequired = item.includes('【必需】') || item.includes('必需')
                      const cleanItem = item.replace(/【必需】|【建议】/g, '').trim()
                      return (
                        <div key={ii} style={{ fontSize: 10, color: '#334155', padding: '5px 8px', marginBottom: 3, backgroundColor: isRequired ? '#fef3c7' : '#f0fdfa', borderRadius: 6, lineHeight: 1.6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, fontSize: 8, padding: '1px 4px', backgroundColor: isRequired ? '#f59e0b' : '#a7f3d0', color: isRequired ? '#fff' : '#065f46', borderRadius: 3, fontWeight: 700, marginTop: 2 }}>{isRequired ? '必需' : '建议'}</span>
                          <span>{cleanItem}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* 策略建议 */}
            {strategyItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#3b82f6', borderRadius: 2 }}></span>
                  申诉策略建议
                </div>
                {strategyItems.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#1e40af', padding: '6px 10px', backgroundColor: '#eff6ff', borderRadius: 6, marginBottom: 4, lineHeight: 1.6, display: 'flex', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>{i + 1}.</span>
                    <span>{s.replace(/\*\*/g, '')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 行动计划 */}
            {actionItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 3, height: 14, backgroundColor: '#8b5cf6', borderRadius: 2 }}></span>
                  行动计划
                </div>
                {actionItems.map((a, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#4c1d95', padding: '6px 10px', backgroundColor: '#f5f3ff', borderRadius: 6, marginBottom: 4, lineHeight: 1.6, display: 'flex', gap: 6 }}>
                    <span style={{ fontWeight: 800, color: '#7c3aed', flexShrink: 0, width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe', borderRadius: '50%', fontSize: 10 }}>{i + 1}</span>
                    <span>{a.replace(/\*\*/g, '')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 底部水印 */}
            <div style={{ textAlign: 'center', paddingTop: 12, borderTop: '1px solid #e5e7eb', marginTop: 8 }}>
              <div style={{ fontSize: 9, color: '#c7d2fe', letterSpacing: 1 }}>— 由 AI 智能分析系统生成 —</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
