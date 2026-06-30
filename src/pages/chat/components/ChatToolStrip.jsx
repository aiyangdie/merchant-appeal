import React from 'react'
import { isDDScenario } from '../utils.js'

function Chip({ label, active, onClick, badge }) {
  return (
    <button type="button" onClick={onClick} className={`tool-chip ${active ? 'active' : ''}`}>
      {label}
      {badge && <span className="chip-dot" />}
    </button>
  )
}

/** 桌面端：单行紧凑工具条；手机端隐藏，改由底栏「工具」打开 */
export default function ChatToolStrip({
  collectedInfo,
  hasInfoData,
  showAppealPanel,
  showComplaintDoc,
  showAppealGuide,
  showDueDiligence,
  showAIPanel,
  showInfoPanel,
  onToggleAppeal,
  onToggleComplaint,
  onToggleGuide,
  onToggleDueDiligence,
  onToggleAI,
  onToggleInfo,
  onOpenMore,
}) {
  const isDD = isDDScenario(collectedInfo)
  const showDD = isDD || showDueDiligence

  const chips = [
    ...(!isDD ? [{ key: 'appeal', label: '申诉文案', active: showAppealPanel, onClick: onToggleAppeal }] : []),
    { key: 'complaint', label: '申诉材料', active: showComplaintDoc, onClick: onToggleComplaint },
    { key: 'guide', label: '申诉指导', active: showAppealGuide, onClick: onToggleGuide },
    ...(showDD ? [{ key: 'dd', label: '尽调', active: showDueDiligence, onClick: onToggleDueDiligence }] : []),
    { key: 'ai', label: 'AI 分析', active: showAIPanel, onClick: onToggleAI },
    { key: 'info', label: '客户信息', active: showInfoPanel, badge: hasInfoData, onClick: onToggleInfo },
    { key: 'more', label: '更多', active: false, onClick: onOpenMore },
  ]

  return (
    <section className="tool-strip hidden md:block flex-shrink-0">
      <div className="tool-strip-scroll no-scrollbar">
        {chips.map(c => (
          <Chip key={c.key} label={c.label} active={c.active} badge={c.badge} onClick={c.onClick} />
        ))}
      </div>
    </section>
  )
}
