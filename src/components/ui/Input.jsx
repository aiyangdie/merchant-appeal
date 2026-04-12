import React, { forwardRef, useState } from 'react'

const Input = forwardRef(({
  label,
  error,
  helper,
  icon: Icon,
  iconPosition = 'left',
  size = 'md',
  className = '',
  wrapperClassName = '',
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false)

  const sizes = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  }

  return (
    <div className={`w-full ${wrapperClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            <Icon className={iconSizes[size]} />
          </div>
        )}
        <input
          ref={ref}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          className={`
            w-full rounded-[var(--radius-md)] border bg-white
            text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
            transition-all duration-[var(--duration-normal)]
            disabled:bg-[var(--color-gray-100)] disabled:cursor-not-allowed
            ${sizes[size]}
            ${Icon && iconPosition === 'left' ? 'pl-10' : ''}
            ${Icon && iconPosition === 'right' ? 'pr-10' : ''}
            ${error
              ? 'border-[var(--color-error)] focus:ring-2 focus:ring-[var(--color-error)]/20'
              : 'border-[var(--color-border-medium)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20'
            }
            ${className}
          `}
          {...props}
        />
        {Icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            <Icon className={iconSizes[size]} />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[var(--color-error)]">{error}</p>
      )}
      {helper && !error && (
        <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">{helper}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
