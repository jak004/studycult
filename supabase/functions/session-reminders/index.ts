// Invoked every 15 minutes by cron (see the scheduling_cron migration) with a
// shared secret. Scans confirmed sessions crossing the T-24h/T-1h thresholds
// and queues one 'events' row per participant — the existing
// send-notification-email function (Sections 2-3) handles the rest (template,
// SendGrid, in-app notification fan-out) without this function knowing about
// any of that.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Wide enough that a 15-minute cron cadence can't skip a session between runs.
const WINDOW_MINUTES = 20

function formatWhen(scheduledAt: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(new Date(scheduledAt)) + ` (${timeZone})`
  } catch {
    return new Date(scheduledAt).toUTCString()
  }
}

async function queueReminders(hoursOut: 24 | 1) {
  const target = new Date(Date.now() + hoursOut * 60 * 60 * 1000)
  const windowStart = new Date(target.getTime() - WINDOW_MINUTES * 60 * 1000).toISOString()
  const windowEnd = new Date(target.getTime() + WINDOW_MINUTES * 60 * 1000).toISOString()
  const sentColumn = hoursOut === 24 ? 'reminder_24h_sent' : 'reminder_1h_sent'
  const eventType = hoursOut === 24 ? 'session_reminder_24h' : 'session_reminder_1h'

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, tutor_id, student_id, scheduled_at, timezone, tutor:profiles!sessions_tutor_id_fkey(full_name), student:profiles!sessions_student_id_fkey(full_name)')
    .eq('status', 'confirmed')
    .eq(sentColumn, false)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  for (const s of sessions ?? []) {
    const whenText = formatWhen(s.scheduled_at, s.timezone)
    await supabase.from('events').insert([
      { user_id: s.tutor_id, type: eventType, payload: { other_name: s.student?.full_name, when_text: whenText } },
      { user_id: s.student_id, type: eventType, payload: { other_name: s.tutor?.full_name, when_text: whenText } },
    ])
    await supabase.from('sessions').update({ [sentColumn]: true }).eq('id', s.id)
  }
}

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('unauthorized', { status: 401 })
  }

  await queueReminders(24)
  await queueReminders(1)

  return new Response('ok')
})
