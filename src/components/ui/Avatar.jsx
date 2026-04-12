import React from 'react'

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
}

const shapeVariants = {
  rounded: 'rounded-[var(--radius-md)]',
  'rounded-full': 'rounded-full',
  square: 'rounded-none',
}

const colorVariants = {
  primary: 'bg-[var(--color-primary)] text-white',
  secondary: 'bg-[var(--color-secondary)] text-white',
  success: 'bg-[var(--color-success)] text-white',
  warning: 'bg-[var(--color-warning)] text-white',
  error: 'bg-[var(--color-error)] text-white',
  gray: 'bg-[var(--color-gray-200)] text-[var(--color-text-secondary)]',
  'gray-dark': 'bg-[var(--color-gray-600)] text-white',
}

const Avatar = ({
  src,
  alt = '',
  size = 'md',
  shape = 'rounded',
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const initials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  const isImage = !!src

  return (
    <div
      className={`
        inline-flex items-center justify-center
        font-medium overflow-hidden flex-shrink-0
        ${sizes[size]}
        ${shapeVariants[shape]}
        ${isImage ? '' : colorVariants[variant]}
        ${className}
      `}
      {...props}
    >
      {isImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : children ? (
        children
      ) : (
        initials(alt)
      )}
    </div>
  )
}

export default Avatar
