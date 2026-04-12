import React, { forwardRef } from 'react'

const variants = {
  primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm hover:shadow-md',
  secondary: 'bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-hover)] active:bg-[var(--color-secondary-active)]',
  outline: 'bg-transparent border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-gray-100)]',
  danger: 'bg-[var(--color-error)] text-white hover:bg-[var(--color-error-dark)]',
  success: 'bg-[var(--color-success)] text-white hover:bg-[var(--color-success-dark)]',
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
  md: 'h-10 px-4 text-sm rounded-[var(--radius-md)]',
  lg: 'h-12 px-6 text-base rounded-[var(--radius-lg)]',
  full: 'h-10 px-4 text-sm rounded-[var(--radius-full)]',
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

const LoadingSpinner = ({ size = 'md' }) => (
  <svg className={`${iconSizes[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium transition-all duration-[var(--duration-normal)]
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      style={{
        boxShadow: variant === 'primary' ? 'var(--shadow-sm)' : 'none',
      }}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size={size} />
      ) : Icon && iconPosition === 'left' ? (
        <Icon className={iconSizes[size]} />
      ) : null}
      {children}
      {!loading && Icon && iconPosition === 'right' ? (
        <Icon className={iconSizes[size]} />
      ) : null}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
