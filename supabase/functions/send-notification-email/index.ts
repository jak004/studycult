// Triggered by a Database Webhook on INSERT into public.events.
// Renders the right template, sends via SendGrid, and marks the event
// processed (sent or deliberately skipped) so it's never retried forever.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendgrid.ts'
import { buildUnsubscribeUrl } from '../_shared/unsubscribe.ts'
import {
  newMessageTemplate,
  quizResultTemplate,
  sessionBookedTemplate,
  sessionCancelledTemplate,
  sessionConfirmedTemplate,
  sessionReminderTemplate,
  welcomeTemplate,
} from '../_shared/templates.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const ACTIVE_WINDOW_MINUTES = 5

type EventType =
  | 'welcome'
  | 'new_message'
  | 'quiz_result'
  | 'weekly_digest'
  | 'session_booked'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'session_reminder_24h'
  | 'session_reminder_1h'
  | 'payment_received'
  | 'payout_sent'
  | 'video_call_started'

type EventRow = {
  id: string
  user_id: string
  type: EventType
  payload: Record<string, unknown>
}

Deno.serve(async (req) => {
  const { record } = (await req.json()) as { record: EventRow }

  async function markProcessed(skipReason?: string) {
    await supabase.from('events').update({ emailed: true, skip_reason: skipReason ?? null }).eq('id', record.id)
  }

  if (record.type === 'weekly_digest') {
    // Digests are aggregate and sent by the scheduled weekly-digest function,
    // not queued per-row here — nothing to do if one somehow lands in events.
    await markProcessed('weekly_digest is sent by the scheduled job')
    return new Response('ok')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, notification_prefs, last_active_at')
    .eq('id', record.user_id)
    .single()

  if (!profile) {
    await markProcessed('recipient not found')
    return new Response('ok')
  }

  const prefs = (profile.notification_prefs ?? {}) as Record<string, boolean>
  if (prefs[record.type] === false) {
    await markProcessed('recipient opted out')
    return new Response('ok')
  }

  if (record.type === 'new_message') {
    const minutesSinceActive = (Date.now() - new Date(profile.last_active_at).getTime()) / 60000
    if (minutesSinceActive < ACTIVE_WINDOW_MINUTES) {
      await markProcessed('recipient currently active')
      return new Response('ok')
    }
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(record.user_id)
  const email = authUser?.user?.email
  if (!email) {
    await markProcessed('no email on file')
    return new Response('ok')
  }

  const unsubscribeUrl = await buildUnsubscribeUrl(record.user_id, record.type)
  const payload = record.payload as {
    sender_name?: string
    preview?: string
    conversation_id?: string
    quiz_title?: string
    score?: number
    total?: number
    other_name?: string
    when_text?: string
  }

  // Not every event type has an email template — payment_received/payout_sent
  // are in-app-only today, and video_call_started deliberately has none (an
  // emailed call invite would arrive well after the call is over). Previously
  // this fell through the switch with `template` left unassigned and threw a
  // TypeError on `template.subject` below, caught by the try/catch and
  // silently swallowed — so those events just never got marked processed.
  let template: { subject: string; html: string } | undefined
  switch (record.type) {
    case 'welcome':
      template = welcomeTemplate({ fullName: profile.full_name }, unsubscribeUrl)
      break
    case 'new_message': {
      const appUrl = Deno.env.get('APP_URL') ?? ''
      template = newMessageTemplate(
        {
          senderName: payload.sender_name ?? 'Someone',
          preview: payload.preview ?? '',
          conversationUrl: `${appUrl}/messages?c=${payload.conversation_id}`,
        },
        unsubscribeUrl
      )
      break
    }
    case 'quiz_result':
      template = quizResultTemplate(
        { quizTitle: payload.quiz_title ?? 'Quiz', score: payload.score ?? 0, total: payload.total ?? 0 },
        unsubscribeUrl
      )
      break
    case 'session_booked':
      template = sessionBookedTemplate(
        { otherName: payload.other_name ?? 'a student', whenText: payload.when_text ?? '' },
        unsubscribeUrl
      )
      break
    case 'session_confirmed':
      template = sessionConfirmedTemplate(
        { otherName: payload.other_name ?? 'your tutor', whenText: payload.when_text ?? '' },
        unsubscribeUrl
      )
      break
    case 'session_cancelled':
      template = sessionCancelledTemplate({ otherName: payload.other_name ?? 'The other participant' }, unsubscribeUrl)
      break
    case 'session_reminder_24h':
    case 'session_reminder_1h':
      template = sessionReminderTemplate(
        {
          otherName: payload.other_name ?? 'someone',
          whenText: payload.when_text ?? '',
          hoursOut: record.type === 'session_reminder_24h' ? 24 : 1,
        },
        unsubscribeUrl
      )
      break
  }

  if (!template) {
    await markProcessed('no email template for this event type')
    return new Response('ok')
  }

  try {
    await sendEmail({ to: email, subject: template.subject, html: template.html })
    await markProcessed()
  } catch (err) {
    console.error('send-notification-email failed', err)
    // Leave emailed = false so it stays visible as unprocessed / retryable.
  }

  return new Response('ok')
})
