export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Converts a wall-clock date+time that's local to `timeZone` into the
// equivalent UTC instant. There's no native inverse of Intl's zone-aware
// formatting, so this uses the standard trick: format the same instant in
// both the target zone and UTC, and use the difference as the offset. Good
// enough for scheduling a session; a dedicated library (date-fns-tz, Luxon)
// would be worth it if this app ever needs to be precise across a DST
// transition down to the second.
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const asIfUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const inZone = new Date(asIfUtc.toLocaleString('en-US', { timeZone }))
  const inUtc = new Date(asIfUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = inUtc.getTime() - inZone.getTime()
  return new Date(asIfUtc.getTime() + offset)
}

// Formats a UTC instant in whichever timezone the *viewer's* browser is set
// to — never the timezone it was booked or stored in.
export function formatInViewerTimezone(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

// Just the clock time, for chat message timestamps — e.g. "2:34 PM".
export function formatTimeOnly(date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date))
}

// "Today" / "Yesterday" / "Sep 2, 2025" — for the day-divider between groups
// of chat messages, compared against the viewer's own local calendar day
// rather than a fixed 24-hour window (so a message from 1am today doesn't
// read as "yesterday" just because it's less than 24h old).
export function formatDayLabel(date) {
  const d = new Date(date)
  const now = new Date()
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}
