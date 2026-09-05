// Called by the tutor after marking a session completed. Initiates the
// Paystack transfer, but does NOT mark the payment 'transferred' itself —
// that only happens once the transfer.success webhook confirms it actually
// went through, since transfers are asynchronous and can still fail after
// being accepted here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initiateTransfer } from '../_shared/paystack.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const PLATFORM_FEE_PERCENT = 10

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
    .select('id, tutor_id, status')
    .eq('id', session_id)
    .single()
  if (!session || session.tutor_id !== user.id) return json({ error: 'Session not found' })
  if (session.status !== 'completed') return json({ error: 'Session is not marked completed yet' })

  const { data: payment } = await serviceClient
    .from('payments')
    .select('*')
    .eq('session_id', session_id)
    .eq('status', 'paid')
    .maybeSingle()
  if (!payment) return json({ error: 'No paid payment found for this session' })

  const { data: tutorProfile } = await serviceClient
    .from('profiles')
    .select('paystack_recipient_code')
    .eq('id', user.id)
    .single()
  if (!tutorProfile?.paystack_recipient_code) return json({ error: 'Set up your payout details first' })

  const tutorShare = Math.round(payment.amount_minor * (1 - PLATFORM_FEE_PERCENT / 100))
  const reference = `payout_${payment.id}_${Date.now()}`

  let transfer
  try {
    transfer = await initiateTransfer({
      amountMinor: tutorShare,
      recipientCode: tutorProfile.paystack_recipient_code,
      reference,
      reason: 'StudyCult session payout',
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not release payment — try again' })
  }

  await serviceClient.from('payments').update({ paystack_transfer_code: transfer.transfer_code }).eq('id', payment.id)
  await serviceClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'payout_initiated',
    target_table: 'payments',
    target_id: payment.id,
    metadata: { tutor_share_minor: tutorShare, transfer_code: transfer.transfer_code },
  })

  return json({ ok: true })
})
