import React from 'react'

const variants = {
  default: 'bg-[var(--color-gray-100)] text-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
  error: 'bg-[var(--color-error-light)] text-[var(--color-error-dark)]',
  info: 'bg-[var(--color-info-light)] text-[var(--color-info-dark)]',
}

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

const dotSizes = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
}

const Badge = ({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  dotColor,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`
            ${dotSizes[size]}
            rounded-full flex-shrink-0
            ${dotColor || (variant === 'primary' && 'bg-[var(--color-primary)]') || 'bg-current'}
          `}
        />
      )}
      {children}
    </span>
  )
}

export default Badge
