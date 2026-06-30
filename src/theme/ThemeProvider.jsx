import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME_ID, STORAGE_KEY, THEMES } from './themes.js'

const ThemeContext = createContext(null)

function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME_ID]
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.setProperty('--theme-primary', theme.primary)
  root.style.setProperty('--theme-primary-hover', theme.primaryHover)
  root.style.setProperty('--theme-primary-light', theme.primaryLight)
  root.style.setProperty('--theme-primary-dark', theme.primaryDark)
  root.style.setProperty('--shadow-bubble-user', theme.bubbleUserShadow)
  root.style.setProperty('--wechat-green', theme.primary)
  root.style.setProperty('--wechat-green-dark', theme.primaryHover)
  root.style.setProperty('--wechat-green-light', theme.primaryLight)
  return theme
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return THEMES[saved] ? saved : DEFAULT_THEME_ID
    } catch {
      return DEFAULT_THEME_ID
    }
  })

  const theme = useMemo(() => THEMES[themeId] || THEMES[DEFAULT_THEME_ID], [themeId])

  useEffect(() => {
    applyTheme(themeId)
  }, [themeId])

  function setThemeId(id) {
    if (!THEMES[id]) return
    setThemeIdState(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }

  return (
    <ThemeContext.Provider value={{ themeId, theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** 初始化主题（Provider 挂载前防闪烁） */
export function initThemeEarly() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    applyTheme(THEMES[saved] ? saved : DEFAULT_THEME_ID)
  } catch {
    applyTheme(DEFAULT_THEME_ID)
  }
}
