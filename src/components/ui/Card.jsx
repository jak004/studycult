// Rectangular card: 1px border, minimal radius, near-flat shadow — no
// floating rounded-2xl surfaces. `interactive` adds a hover border/shadow
// step for clickable cards (catalog grids) without any lift/scale motion.
export default function Card({ as: Component = 'div', interactive = false, className = '', children, ...props }) {
  return (
    <Component
      className={`rounded-md border border-line bg-paper-raised transition-shadow ${
        interactive ? 'hover:border-ink/25 hover:shadow-md' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
