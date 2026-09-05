// Tutor payout onboarding — there's no Stripe-Connect-style hosted flow on
// Paystack, so this collects bank/mobile-money details directly (via a form
// in Profile.jsx) and registers them as a Paystack Transfer Recipient.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createTransferRecipient } from '../_shared/paystack.ts'
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

  const { type, account_number, bank_code, bank_name } = await req.json()

  const { data: profile } = await serviceClient.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'tutor') return json({ error: 'Only tutors can set up payouts' })

  let recipient
  try {
    recipient = await createTransferRecipient({
      type,
      name: profile.full_name,
      accountNumber: account_number,
      bankCode: bank_code,
      currency: 'GHS',
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not save payout details — try again' })
  }

  await serviceClient
    .from('profiles')
    .update({
      paystack_recipient_code: recipient.recipient_code,
      payout_bank_name: bank_name,
      payout_account_last4: String(account_number).slice(-4),
    })
    .eq('id', user.id)

  return json({ ok: true })
})
