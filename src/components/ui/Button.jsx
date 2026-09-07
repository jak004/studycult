// Shared button — solid primary, outlined secondary, sharp corners, no
// gradients or hover-lift. `as` lets it render as a react-router Link (or
// any other component) while keeping identical visual treatment.
const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
}

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-dark border border-transparent',
  outline: 'bg-transparent text-primary border border-primary hover:bg-primary-soft',
  secondary: 'bg-transparent text-ink border border-line hover:border-ink',
  danger: 'bg-transparent text-ink-soft border border-line hover:border-danger hover:text-danger',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-paper',
}

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
