import React from 'react'

const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[3px]',
    xl: 'w-12 h-12 border-4',
  }

  return (
    <div
      className={`
        inline-block animate-spin rounded-full
        border-[var(--color-gray-200)]
        border-t-[var(--color-primary)]
        ${sizes[size]}
        ${className}
      `}
      role="status"
      aria-label="loading"
    >
      <span className="sr-only">加载中...</span>
    </div>
  )
}

const LoadingOverlay = ({ message = '加载中...', className = '' }) => (
  <div className={`
    absolute inset-0 flex flex-col items-center justify-center
    bg-white/80 backdrop-blur-sm z-10
    ${className}
  `}>
    <Spinner size="lg" />
    {message && (
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p>
    )}
  </div>
)

const LoadingPage = ({ message = '加载中...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
    <div className="text-center">
      <Spinner size="xl" className="mx-auto" />
      {message && (
        <p className="mt-4 text-[var(--color-text-secondary)]">{message}</p>
      )}
    </div>
  </div>
)

const LoadingDots = ({ size = 'md', className = '' }) => {
  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            ${dotSizes[size]}
            bg-[var(--color-primary)] rounded-full
            animate-bounce
          `}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

export { Spinner, LoadingOverlay, LoadingPage, LoadingDots }
export default Spinner
