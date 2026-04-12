import React from 'react'

const PageHeader = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  className = '',
  style = {},
}) => {
  return (
    <header
      className={`
        sticky top-0 z-40
        bg-white/90 backdrop-blur-xl
        border-b border-[var(--color-border)]
        safe-top
        ${className}
      `}
      style={style}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {leftAction && (
          <div className="flex-shrink-0">{leftAction}</div>
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {rightAction && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {rightAction}
          </div>
        )}
      </div>
    </header>
  )
}

export default PageHeader
