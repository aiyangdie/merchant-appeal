import React from 'react'

const PageFooter = ({
  children,
  className = '',
  safeArea = true,
  ...props
}) => {
  return (
    <footer
      className={`
        flex-shrink-0
        bg-white/90 backdrop-blur-xl
        border-t border-[var(--color-border)]
        ${safeArea ? 'safe-bottom' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </footer>
  )
}

export default PageFooter
