import { zonedTimeToUtc } from './timezone'

// Expands recurring weekly availability rows into concrete upcoming UTC
// instants, used both by the booking modal (Tutors.jsx) and the "available
// today" search filter.
export function generateUpcomingSlots(rows, weeksAhead = 4) {
  const now = new Date()
  const slots = []
  for (const row of rows) {
    for (let w = 0; w < weeksAhead; w++) {
      const candidate = new Date()
      const daysUntil = (row.weekday - candidate.getDay() + 7) % 7
      candidate.setDate(candidate.getDate() + daysUntil + w * 7)
      const dateStr = candidate.toISOString().slice(0, 10)
      const startUtc = zonedTimeToUtc(dateStr, row.start_time.slice(0, 5), row.timezone)
      const endUtc = zonedTimeToUtc(dateStr, row.end_time.slice(0, 5), row.timezone)
      if (startUtc > now) {
        slots.push({
          key: `${row.id}-${dateStr}`,
          scheduled_at: startUtc,
          duration_minutes: Math.round((endUtc.getTime() - startUtc.getTime()) / 60000),
          timezone: row.timezone,
        })
      }
    }
  }
  return slots.sort((a, b) => a.scheduled_at - b.scheduled_at)
}
