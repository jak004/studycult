// Invoked on a schedule (see supabase/migrations/..._weekly_digest_cron.sql)
// with a shared secret, not by the events table — a digest aggregates a week
// of activity per tutor rather than reacting to one row.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendgrid.ts'
import { buildUnsubscribeUrl } from '../_shared/unsubscribe.ts'
import { weeklyDigestTemplate } from '../_shared/templates.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: tutors } = await supabase
    .from('profiles')
    .select('id, full_name, notification_prefs')
    .eq('role', 'tutor')

  for (const tutor of tutors ?? []) {
    const prefs = (tutor.notification_prefs ?? {}) as Record<string, boolean>
    if (prefs.weekly_digest === false) continue

    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', tutor.id)
    const conversationIds = (memberships ?? []).map((m) => m.conversation_id)

    let messageCount = 0
    if (conversationIds.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', tutor.id)
        .gte('created_at', since)
      messageCount = count ?? 0
    }

    const { data: quizzes } = await supabase.from('quizzes').select('id').eq('created_by', tutor.id)
    const quizIds = (quizzes ?? []).map((q) => q.id)

    let quizAttemptCount = 0
    if (quizIds.length > 0) {
      const { count } = await supabase
        .from('quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .in('quiz_id', quizIds)
        .gte('completed_at', since)
      quizAttemptCount = count ?? 0
    }

    if (messageCount === 0 && quizAttemptCount === 0) continue

    const { data: authUser } = await supabase.auth.admin.getUserById(tutor.id)
    const email = authUser?.user?.email
    if (!email) continue

    const unsubscribeUrl = await buildUnsubscribeUrl(tutor.id, 'weekly_digest')
    const template = weeklyDigestTemplate({ fullName: tutor.full_name, messageCount, quizAttemptCount }, unsubscribeUrl)

    try {
      await sendEmail({ to: email, subject: template.subject, html: template.html })
    } catch (err) {
      console.error(`weekly-digest failed for tutor ${tutor.id}`, err)
    }
  }

  return new Response('ok')
})
