import { useId } from 'react'

// Brand-toned gradient pairs — picked from the theme palette so generated
// art always feels on-brand instead of arbitrary rainbow hues.
const PALETTE = [
  ['#1f8a70', '#16233d'],
  ['#e2a33b', '#16233d'],
  ['#c4453b', '#16233d'],
  ['#16233d', '#5b6472'],
  ['#1f8a70', '#5b6472'],
  ['#e2a33b', '#c4453b'],
]

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic abstract cover art seeded by a string (subject, name, id) —
// same seed always renders the same gradient + blob layout.
export default function CoverArt({ seed = '', className = '' }) {
  const uid = useId()
  const h = hashString(seed)
  const [from, to] = PALETTE[h % PALETTE.length]
  const blobs = [0, 1, 2].map((i) => ({
    cx: 10 + ((h >> (i * 6)) % 80),
    cy: 10 + ((h >> (i * 6 + 3)) % 80),
    r: 18 + ((h >> (i * 6 + 5)) % 26),
  }))

  return (
    <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${uid})`} />
      {blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="white" opacity={0.07 + i * 0.05} />
      ))}
    </svg>
  )
}
