// Public, no-login endpoint behind a share-link token (see the /report/:token
// page and the ReportsTab settings page that generates the link). Deliberately
// returns only an aggregated summary — no message content, contact info, or
// payment data — since anyone holding the link can read it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  const { token } = await req.json().catch(() => ({ token: null }))
  if (!token || typeof token !== 'string') {
    return json({ error: 'Missing report link' })
  }

  const { data: link } = await serviceClient
    .from('progress_share_links')
    .select('student_id, revoked_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || link.revoked_at) {
    return json({ error: 'This report link is invalid or has been revoked.' })
  }

  const [{ data: profile }, { data: attempts }, { count: sessionCount }] = await Promise.all([
    serviceClient.from('profiles').select('full_name').eq('id', link.student_id).single(),
    serviceClient
      .from('quiz_attempts')
      .select('score, total, completed_at, quiz:quizzes(subject)')
      .eq('user_id', link.student_id),
    serviceClient
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', link.student_id)
      .eq('status', 'completed'),
  ])

  const bySubject = new Map<string, { score: number; total: number; attempts: number }>()
  let lastActivity: string | null = null
  for (const a of attempts ?? []) {
    const subject = (a as { quiz?: { subject?: string } }).quiz?.subject || 'Other'
    const entry = bySubject.get(subject) || { score: 0, total: 0, attempts: 0 }
    entry.score += a.score
    entry.total += a.total
    entry.attempts += 1
    bySubject.set(subject, entry)
    if (!lastActivity || a.completed_at > lastActivity) lastActivity = a.completed_at
  }

  const subjects = Array.from(bySubject.entries())
    .map(([subject, v]) => ({
      subject,
      percent: v.total > 0 ? Math.round((v.score / v.total) * 100) : 0,
      attempts: v.attempts,
    }))
    .sort((a, b) => b.percent - a.percent)

  return json({
    full_name: profile?.full_name || 'Student',
    subjects,
    total_quizzes: attempts?.length || 0,
    total_sessions_completed: sessionCount || 0,
    last_activity: lastActivity,
    generated_at: new Date().toISOString(),
  })
})
