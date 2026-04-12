import React from 'react'

const PageContent = ({
  children,
  className = '',
  maxWidth = '2xl',
  padding = true,
  ...props
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    full: 'max-w-full',
  }

  return (
    <main
      className={`
        flex-1 overflow-y-auto
        ${padding ? 'px-4 py-4' : ''}
        ${className}
      `}
      {...props}
    >
      <div className={`mx-auto ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </main>
  )
}

export default PageContent
