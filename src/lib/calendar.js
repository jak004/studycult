function toIcsDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(text) {
  return String(text).replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
}

export function buildGoogleCalendarUrl({ title, description, startUtc, durationMinutes }) {
  const start = new Date(startUtc)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toIcsDate(start)}/${toIcsDate(end)}`,
    details: description || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Works with any calendar app (Apple Calendar, Outlook, etc.), not just
// Google — and the VALARM block gives it a native reminder popup that fires
// independently of our own email/in-app notifications.
export function downloadIcsFile({ uid, title, description, startUtc, durationMinutes }) {
  const start = new Date(startUtc)
  const end = new Date(start.getTime() + durationMinutes * 60000)

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyCult//Session//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@studycult.app`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description || '')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^a-z0-9]/gi, '-')}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
