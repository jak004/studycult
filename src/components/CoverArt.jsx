// Solid brand-blue shades, monochrome on purpose — a structured placeholder
// block (flat color + thin diagonal rule pattern) reads as "no photo yet"
// rather than decorative gradient-blob art.
const PALETTE = ['#0056d2', '#00419e', '#1f1f1f', '#003876', '#0063eb']

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic placeholder cover art seeded by a string (subject, name,
// id) — same seed always renders the same fill + line pattern.
export default function CoverArt({ seed = '', className = '' }) {
  const h = hashString(seed)
  const fill = PALETTE[h % PALETTE.length]
  const offset = h % 24

  return (
    <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={fill} />
      <path
        d={Array.from({ length: 7 }, (_, i) => {
          const x = -20 + i * 24 + offset
          return `M${x} 100 L${x + 40} 0`
        }).join(' ')}
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="10"
      />
    </svg>
  )
}
