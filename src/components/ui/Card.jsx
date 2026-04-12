import React from 'react'

const variants = {
  default: 'bg-white border-[var(--color-border)]',
  elevated: 'bg-white shadow-[var(--shadow-card)] border border-[var(--color-border-light)]',
  outlined: 'bg-transparent border border-[var(--color-border-medium)]',
  filled: 'bg-[var(--color-gray-100)] border-transparent',
  primary: 'bg-[var(--color-primary-light)] border border-[var(--color-primary)]/20',
}

const paddingSizes = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  hover = false,
  onClick,
  ...props
}) => {
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      className={`
        rounded-[var(--radius-lg)] border
        ${variants[variant]}
        ${paddingSizes[padding]}
        ${hover || isClickable ? 'transition-all duration-[var(--duration-normal)] cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5' : ''}
        ${isClickable ? 'active:scale-[0.99]' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`flex items-center justify-between mb-3 ${className}`} {...props}>
    {children}
  </div>
)

const CardTitle = ({ children, className = '', ...props }) => (
  <h3 className={`text-base font-semibold text-[var(--color-text-primary)] ${className}`} {...props}>
    {children}
  </h3>
)

const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-sm text-[var(--color-text-secondary)] ${className}`} {...props}>
    {children}
  </p>
)

const CardContent = ({ children, className = '', ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
)

const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`flex items-center gap-3 mt-4 pt-4 border-t border-[var(--color-border)] ${className}`} {...props}>
    {children}
  </div>
)

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter

export default Card
