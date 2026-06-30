import React from 'react'
import { isDDScenario } from '../utils.js'

function BentoCard({ icon, label, desc, tone, active, onClick, large }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bento-card bento-${tone} ${large ? 'bento-large' : ''} ${active ? 'active' : ''}`}
    >
      <span className="bento-icon">{icon}</span>
      <span className="bento-label">{label}</span>
      {desc && <span className="bento-desc">{desc}</span>}
    </button>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="bento-section-title">
      <span className="bento-section-bar" />
      <span>{children}</span>
    </div>
  )
}

export default function ToolsHubPage({
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
}) {
  const isDD = isDDScenario(collectedInfo)
  const showDD = isDD || showDueDiligence

  return (
    <div className="tools-hub-page flex-1 min-h-0 overflow-y-auto">
      <div className="tools-hub-inner">
        <SectionTitle>申诉写作</SectionTitle>
        <div className="bento-grid bento-grid-2">
          {!isDD && (
            <BentoCard
              tone="green"
              large
              icon="📝"
              label="申诉文案"
              desc="生成可提交的申诉内容"
              active={showAppealPanel}
              onClick={onToggleAppeal}
            />
          )}
          <BentoCard
            tone="blue"
            icon="📋"
            label="申诉材料包"
            desc="微信申诉表单全套整理"
            active={showComplaintDoc}
            onClick={onToggleComplaint}
          />
          <BentoCard
            tone="teal"
            icon="🧭"
            label="申诉指导"
            desc="步骤与注意事项"
            active={showAppealGuide}
            onClick={onToggleGuide}
          />
        </div>

        <SectionTitle>分析与资料</SectionTitle>
        <div className="bento-grid bento-grid-3">
          <BentoCard
            tone="indigo"
            icon="✨"
            label="AI 分析"
            active={showAIPanel}
            onClick={onToggleAI}
          />
          <BentoCard
            tone="mint"
            icon="📁"
            label="客户信息"
            active={showInfoPanel}
            onClick={onToggleInfo}
          />
          {showDD && (
            <BentoCard
              tone="orange"
              icon="🔍"
              label="尽调助手"
              active={showDueDiligence}
              onClick={onToggleDueDiligence}
            />
          )}
        </div>

        {hasInfoData && (
          <p className="tools-hub-hint">资料收集中，可在「我的 → 已收集信息」查看进度</p>
        )}
      </div>
    </div>
  )
}
