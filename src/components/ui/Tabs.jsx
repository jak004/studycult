// Flat, underline-active-state tabs — Coursera's tab pattern, not pill
// buttons. `tabs` is [{ value, label }]; controlled via `active`/`onChange`.
export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`flex gap-6 overflow-x-auto border-b border-line ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          aria-current={active === t.value ? 'true' : undefined}
          className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-bold transition-colors ${
            active === t.value ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
