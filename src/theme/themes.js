/** 可选主题：默认微信绿 */
export const THEMES = {
  wechat: {
    id: 'wechat',
    name: '微信绿',
    primary: '#07C160',
    primaryHover: '#06A854',
    primaryLight: '#E8F8EE',
    primaryDark: '#059048',
    bubbleUserShadow: '0 1px 4px rgba(7,193,96,0.25)',
  },
  teal: {
    id: 'teal',
    name: '青绿',
    primary: '#26B3A0',
    primaryHover: '#1FA090',
    primaryLight: '#E6F7F4',
    primaryDark: '#1A8A7A',
    bubbleUserShadow: '0 1px 4px rgba(38,179,160,0.25)',
  },
  blue: {
    id: 'blue',
    name: '天空蓝',
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    primaryLight: '#EFF6FF',
    primaryDark: '#1D4ED8',
    bubbleUserShadow: '0 1px 4px rgba(59,130,246,0.25)',
  },
  indigo: {
    id: 'indigo',
    name: '靛蓝',
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: '#EEF2FF',
    primaryDark: '#4338CA',
    bubbleUserShadow: '0 1px 4px rgba(99,102,241,0.25)',
  },
  orange: {
    id: 'orange',
    name: '活力橙',
    primary: '#F97316',
    primaryHover: '#EA580C',
    primaryLight: '#FFF7ED',
    primaryDark: '#C2410C',
    bubbleUserShadow: '0 1px 4px rgba(249,115,22,0.25)',
  },
  rose: {
    id: 'rose',
    name: '玫红',
    primary: '#F43F5E',
    primaryHover: '#E11D48',
    primaryLight: '#FFF1F2',
    primaryDark: '#BE123C',
    bubbleUserShadow: '0 1px 4px rgba(244,63,94,0.25)',
  },
  purple: {
    id: 'purple',
    name: '梦幻紫',
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    primaryLight: '#F5F3FF',
    primaryDark: '#6D28D9',
    bubbleUserShadow: '0 1px 4px rgba(139,92,246,0.25)',
  },
}

export const THEME_LIST = Object.values(THEMES)
export const DEFAULT_THEME_ID = 'wechat'
export const STORAGE_KEY = 'appeal_theme'
