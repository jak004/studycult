// Called by the student's browser (via supabase.functions.invoke, which
// forwards their session JWT). The amount is computed here from the tutor's
// hourly_rate and the session's duration — never trusted from the client —
// then Paystack's hosted checkout page handles the actual card/mobile-money
// entry, so no payment details ever touch this app's own servers.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeTransaction } from '../_shared/paystack.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await anonClient.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' })

  const { session_id } = await req.json()

  const { data: session } = await serviceClient
    .from('sessions')
    .select('id, tutor_id, student_id, status, duration_minutes, tutor:profiles!sessions_tutor_id_fkey(hourly_rate)')
    .eq('id', session_id)
    .single()

  if (!session || session.student_id !== user.id) return json({ error: 'Session not found' })
  if (session.status !== 'confirmed') return json({ error: 'Session is not confirmed yet' })

  const { data: existing } = await serviceClient
    .from('payments')
    .select('id')
    .eq('session_id', session_id)
    .neq('status', 'failed')
    .maybeSingle()
  if (existing) return json({ error: 'A payment already exists for this session' })

  const hourlyRate = session.tutor?.hourly_rate ?? 0
  const amountMinor = Math.round(hourlyRate * (session.duration_minutes / 60) * 100)
  if (amountMinor <= 0) return json({ error: 'This tutor has no hourly rate set' })

  const reference = `sess_${session_id}_${Date.now()}`
  const appUrl = Deno.env.get('APP_URL') ?? ''

  let paystackData
  try {
    paystackData = await initializeTransaction({
      email: user.email!,
      amountMinor,
      reference,
      callbackUrl: `${appUrl}/dashboard`,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not start payment — try again' })
  }

  await serviceClient.from('payments').insert({
    session_id,
    student_id: session.student_id,
    tutor_id: session.tutor_id,
    amount_minor: amountMinor,
    currency: 'GHS',
    paystack_reference: reference,
    status: 'pending',
  })

  return json({ authorization_url: paystackData.authorization_url })
})
