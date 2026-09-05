// A small hand-rolled SVG bar chart — deliberately not a charting library
// dependency for a handful of admin-only bars. One scale (the shared `max`)
// places every bar, and every bar carries its own value label so nothing on
// the chart is unlabeled.
export default function BarChart({ data, valueFormatter = (v) => String(v), height = 150 }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const barSlot = 34
  const barWidth = 22
  const width = Math.max(data.length * barSlot, 200)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="block" style={{ width, minWidth: '100%' }}>
        <line x1={0} y1={height - 22} x2={width} y2={height - 22} className="stroke-line" strokeWidth={1} />
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 50)
          const x = i * barSlot + (barSlot - barWidth) / 2
          const y = height - 22 - barHeight
          return (
            <g key={i}>
              {d.value > 0 && (
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-ink" fontSize={9} fontFamily="IBM Plex Mono, monospace">
                  {valueFormatter(d.value)}
                </text>
              )}
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, d.value > 0 ? 2 : 0)} rx={3} className="fill-teal" />
              <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-muted" fontSize={9}>
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
