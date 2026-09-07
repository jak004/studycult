// Minimal inline SVG icon set — kept deliberately small (only what the
// shared components below need) so we're not pulling in an icon library
// for a handful of glyphs, and never falling back to emoji as icons.

export function StarIcon({ className = '', filled = true }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5} aria-hidden="true">
      <path d="M10 1.6l2.47 5.29 5.72.72-4.24 4.02 1.14 5.77L10 14.9l-5.09 2.5 1.14-5.77L1.81 7.6l5.72-.72L10 1.6z" />
    </svg>
  )
}

export function CheckBadgeIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 1.5l2.03 1.36 2.44-.2 1.02 2.2 2.2 1.02-.2 2.44L19 10l-1.51 1.68.2 2.44-2.2 1.02-1.02 2.2-2.44-.2L10 18.5l-2.03-1.36-2.44.2-1.02-2.2-2.2-1.02.2-2.44L1 10l1.51-1.68-.2-2.44 2.2-1.02 1.02-2.2 2.44.2L10 1.5zm3.7 6.1a.9.9 0 00-1.3-1.24L9 9.87 7.6 8.46a.9.9 0 10-1.27 1.28l2 2c.36.36.94.35 1.3-.02l4.06-4z" />
    </svg>
  )
}

export function SearchIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" />
      <path d="M18 18l-4.3-4.3" />
    </svg>
  )
}

export function ChevronDownIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  )
}

export function MenuIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" />
    </svg>
  )
}

export function CloseIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export function SunIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4M15.6 15.6l-1.4-1.4M5.8 5.8L4.4 4.4" />
    </svg>
  )
}

export function MoonIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 12.2A7.7 7.7 0 018.3 2.6a.7.7 0 00-.9-.86 8.5 8.5 0 1010.9 10.9.7.7 0 00-.8-.44z" />
    </svg>
  )
}
