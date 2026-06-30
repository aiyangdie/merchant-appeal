import React from 'react'
import { useTheme } from '../../../theme/ThemeProvider.jsx'
import { THEME_LIST } from '../../../theme/themes.js'

export default function ThemePicker({ open, onClose }) {
  const { themeId, setThemeId } = useTheme()
  if (!open) return null

  return (
    <div className="theme-picker-overlay" onClick={onClose}>
      <div className="theme-picker-sheet mp-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="theme-picker-title">选择主题色</h3>
        <p className="theme-picker-desc">切换后全局生效，设置会自动保存</p>
        <div className="theme-grid">
          {THEME_LIST.map(t => (
            <button
              key={t.id}
              type="button"
              className={`theme-swatch ${themeId === t.id ? 'active' : ''}`}
              onClick={() => setThemeId(t.id)}
            >
              <span className="swatch-color" style={{ background: t.primary }} />
              <span className="swatch-name">{t.name}</span>
              {themeId === t.id && <span className="swatch-check">✓</span>}
            </button>
          ))}
        </div>
        <button type="button" className="sheet-cancel" onClick={onClose}>完成</button>
      </div>
    </div>
  )
}
