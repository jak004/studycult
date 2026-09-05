import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatInViewerTimezone } from '../../lib/timezone'
import { paymentStatusLabel } from '../../lib/payments'

export default function PaymentHistoryTab({ profile }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const isTutor = profile.role === 'tutor'

  useEffect(() => {
    async function load() {
      const column = isTutor ? 'tutor_id' : 'student_id'
      const { data } = await supabase
        .from('payments')
        .select(
          `*, session:sessions(scheduled_at,
            tutor:profiles!sessions_tutor_id_fkey(full_name),
            student:profiles!sessions_student_id_fkey(full_name))`
        )
        .eq(column, profile.id)
        .order('created_at', { ascending: false })
      setPayments(data || [])
      setLoading(false)
    }
    load()
  }, [profile.id, isTutor])

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Payment history</h1>
      <p className="mt-2 text-muted">
        {isTutor ? 'Payments received for your sessions.' : 'Payments you have made for sessions.'}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          payments.map((p) => {
            const otherName = isTutor ? p.session?.student?.full_name : p.session?.tutor?.full_name
            return (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{otherName || 'Session'}</p>
                  <p className="text-xs text-muted">
                    {p.session?.scheduled_at ? formatInViewerTimezone(p.session.scheduled_at) : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-ink">
                    {p.currency} {(p.amount_minor / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted">{paymentStatusLabel(p.status)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
