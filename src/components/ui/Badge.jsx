// Functional tag/badge — subject tags, status labels ("Available today",
// "Verified"). Flat fill, no drop shadow, minimal radius.
const VARIANTS = {
  default: 'bg-primary-soft text-primary',
  neutral: 'bg-paper text-ink-soft border border-line',
  success: 'bg-success-soft text-success',
}

export default function Badge({ variant = 'default', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}
