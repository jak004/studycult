import { StarIcon } from './icons'

// Real-data rating display — "4.7 ★ (128)" — not a decorative star row.
// Renders nothing when there's no rating yet, so cards don't show a fake 0.0.
export default function Rating({ value, count, size = 'sm', className = '' }) {
  if (value == null) return null
  const textSize = size === 'lg' ? 'text-base' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-1 ${textSize} ${className}`}>
      <span className="font-bold text-ink">{value.toFixed(1)}</span>
      <StarIcon className="h-3.5 w-3.5 text-primary-dark" />
      {count != null && <span className="text-muted">({count.toLocaleString()})</span>}
    </span>
  )
}
