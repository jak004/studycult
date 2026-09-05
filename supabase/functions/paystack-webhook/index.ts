// Registered as the webhook URL in the Paystack dashboard. This is the ONLY
// place payment/payout status is ever written — never trust a client saying
// "I paid" or "I got paid", only Paystack's own signed callback.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyWebhookSignature } from '../_shared/paystack.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function logAudit(action: string, targetId: string, metadata: Record<string, unknown>) {
  return supabase.from('audit_log').insert({ action, target_table: 'payments', target_id: targetId, metadata })
}

Deno.serve(async (req) => {
  const rawBody = await req.text()
  const valid = await verifyWebhookSignature(rawBody, req.headers.get('x-paystack-signature'))
  if (!valid) return new Response('invalid signature', { status: 401 })

  const event = JSON.parse(rawBody)

  if (event.event === 'charge.success') {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, student_id, tutor_id')
      .eq('paystack_reference', event.data.reference)
      .single()

    if (payment && payment.status === 'pending') {
      await supabase.from('payments').update({ status: 'paid' }).eq('id', payment.id)
      await logAudit('payment_status_changed', payment.id, { from: 'pending', to: 'paid', via: 'paystack_webhook' })
      const { data: student } = await supabase.from('profiles').select('full_name').eq('id', payment.student_id).single()
      await supabase.from('events').insert({
        user_id: payment.tutor_id,
        type: 'payment_received',
        payload: { other_name: student?.full_name },
      })
    }
  }

  if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, tutor_id, student_id')
      .eq('paystack_transfer_code', event.data.transfer_code)
      .single()

    if (payment) {
      // A failed transfer falls back to 'paid' (not 'failed') so release-payment
      // can simply be retried — the money is still sitting in the platform
      // account, nothing was lost.
      const nextStatus = event.event === 'transfer.success' ? 'transferred' : 'paid'
      await supabase.from('payments').update({ status: nextStatus }).eq('id', payment.id)
      await logAudit('payment_status_changed', payment.id, { to: nextStatus, via: 'paystack_webhook', event: event.event })

      if (event.event === 'transfer.success') {
        const { data: student } = await supabase.from('profiles').select('full_name').eq('id', payment.student_id).single()
        await supabase.from('events').insert({
          user_id: payment.tutor_id,
          type: 'payout_sent',
          payload: { other_name: student?.full_name },
        })
      }
    }
  }

  return new Response('ok')
})
