import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import BarChart from '../components/BarChart'

const CHART_DAYS = 14

function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (n - 1 - i))
    return d
  })
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function dayLabel(date) {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function Admin() {
  const { profile } = useAuth()
  const [metrics, setMetrics] = useState({ signups: 0, activeConversations: 0, quizzesThisWeek: 0 })
  const [pendingTutors, setPendingTutors] = useState([])
  const [reports, setReports] = useState([])
  const [docsByTutor, setDocsByTutor] = useState({})
  const [signupSeries, setSignupSeries] = useState([])
  const [revenueSeries, setRevenueSeries] = useState([])
  const [sessionBreakdown, setSessionBreakdown] = useState([])
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')

  async function loadAnalytics() {
    const days = lastNDays(CHART_DAYS)
    const since = days[0].toISOString()

    const [{ data: profileRows }, { data: paymentRows }, { data: sessionRows }] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', since),
      supabase.from('payments').select('amount_minor, created_at').eq('status', 'transferred').gte('created_at', since),
      supabase.from('sessions').select('status'),
    ])

    const signupBuckets = Object.fromEntries(days.map((d) => [dayKey(d), 0]))
    ;(profileRows || []).forEach((p) => {
      const key = p.created_at.slice(0, 10)
      if (key in signupBuckets) signupBuckets[key] += 1
    })
    setSignupSeries(days.map((d) => ({ label: dayLabel(d), value: signupBuckets[dayKey(d)] })))

    const revenueBuckets = Object.fromEntries(days.map((d) => [dayKey(d), 0]))
    ;(paymentRows || []).forEach((p) => {
      const key = p.created_at.slice(0, 10)
      if (key in revenueBuckets) revenueBuckets[key] += p.amount_minor / 100
    })
    setRevenueSeries(days.map((d) => ({ label: dayLabel(d), value: Math.round(revenueBuckets[dayKey(d)]) })))

    const statusCounts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
    ;(sessionRows || []).forEach((s) => {
      if (s.status in statusCounts) statusCounts[s.status] += 1
    })
    setSessionBreakdown(Object.entries(statusCounts).map(([label, value]) => ({ label, value })))
  }

  async function runDemoAction(action) {
    setDemoBusy(true)
    setDemoMessage('')
    const { data, error } = await supabase.functions.invoke('seed-demo-data', { body: { action } })
    setDemoBusy(false)
    if (error || data?.error) {
      setDemoMessage(data?.error || error.message)
      return
    }
    setDemoMessage(
      action === 'cleanup'
        ? `Removed ${data.result.removed} demo account${data.result.removed === 1 ? '' : 's'} and everything tied to them.`
        : `Seeded ${data.result.tutors} tutors, ${data.result.students} students, ${data.result.courses} courses, and ${data.result.sessions} sessions.`
    )
    await loadMetrics()
    await loadAnalytics()
  }

  async function loadMetrics() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [{ count: signups }, { count: quizzesThisWeek }, { data: recentMessages }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).gte('completed_at', weekAgo),
      supabase.from('messages').select('conversation_id').gte('created_at', weekAgo),
    ])
    const activeConversations = new Set((recentMessages || []).map((m) => m.conversation_id)).size
    setMetrics({ signups: signups || 0, activeConversations, quizzesThisWeek: quizzesThisWeek || 0 })
  }

  async function loadPendingTutors() {
    const { data } = await supabase.from('profiles').select('*').eq('verification_status', 'pending')
    setPendingTutors(data || [])

    const docsEntries = await Promise.all(
      (data || []).map(async (tutor) => {
        const { data: files } = await supabase.storage.from('verification-documents').list(tutor.id)
        const signed = await Promise.all(
          (files || []).map(async (f) => {
            const { data: signedData } = await supabase.storage
              .from('verification-documents')
              .createSignedUrl(`${tutor.id}/${f.name}`, 3600)
            return { name: f.name, url: signedData?.signedUrl }
          })
        )
        return [tutor.id, signed]
      })
    )
    setDocsByTutor(Object.fromEntries(docsEntries))
  }

  async function loadReports() {
    const { data } = await supabase
      .from('reports')
      .select(
        '*, reporter:profiles!reports_reporter_id_fkey(full_name), reported:profiles!reports_reported_user_id_fkey(full_name)'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    setReports(data || [])
  }

  useEffect(() => {
    loadMetrics()
    loadPendingTutors()
    loadReports()
    loadAnalytics()
  }, [])

  async function logAdminAction(action, targetTable, targetId, metadata = {}) {
    await supabase.from('audit_log').insert({
      actor_id: profile.id,
      action,
      target_table: targetTable,
      target_id: targetId,
      metadata,
    })
  }

  async function decideVerification(tutor, approve) {
    const nextStatus = approve ? 'verified' : 'unverified'
    await supabase.from('profiles').update({ verification_status: nextStatus }).eq('id', tutor.id)
    await supabase.from('notifications').insert({
      user_id: tutor.id,
      title: approve ? "You're verified! 🎉" : 'Verification not approved',
      body: approve
        ? 'Your tutor profile now shows a verified badge.'
        : 'Your submitted document could not be verified — you can upload another from your profile.',
      link: '/profile',
    })
    await logAdminAction(approve ? 'verify_tutor' : 'reject_tutor', 'profiles', tutor.id)
    await loadPendingTutors()
  }

  async function updateReportStatus(report, status) {
    await supabase.from('reports').update({ status }).eq('id', report.id)
    await logAdminAction('update_report_status', 'reports', report.id, { status })
    await loadReports()
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold text-ink">Admin</h1>
      <p className="mt-2 text-muted">Platform health, tutor verification, and reports.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <MetricTile label="Total signups" value={metrics.signups} />
        <MetricTile label="Active conversations (7d)" value={metrics.activeConversations} />
        <MetricTile label="Quizzes taken (7d)" value={metrics.quizzesThisWeek} />
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <p className="text-sm font-medium text-ink">Signups, last {CHART_DAYS} days</p>
          <div className="mt-4">
            <BarChart data={signupSeries} />
          </div>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-ink">Revenue processed (GHS), last {CHART_DAYS} days</p>
          <p className="text-xs text-muted">Released payouts only — matches what's actually left the platform's balance.</p>
          <div className="mt-4">
            <BarChart data={revenueSeries} valueFormatter={(v) => `₵${v}`} />
          </div>
        </div>
      </div>

      <div className="mt-8 card p-6">
        <p className="text-sm font-medium text-ink">Sessions by status, all time</p>
        <div className="mt-4">
          <BarChart data={sessionBreakdown} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Pending tutor verifications</h2>
        {pendingTutors.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing pending.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {pendingTutors.map((tutor) => (
              <div key={tutor.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{tutor.full_name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(docsByTutor[tutor.id] || []).length === 0 ? (
                        <span className="text-xs text-muted">No document found in storage.</span>
                      ) : (
                        docsByTutor[tutor.id].map((doc) => (
                          <a
                            key={doc.name}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-teal underline"
                          >
                            View {doc.name}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decideVerification(tutor, true)} className="btn btn-accent px-4 py-2 text-xs">
                      Approve
                    </button>
                    <button onClick={() => decideVerification(tutor, false)} className="btn btn-danger-outline px-4 py-2 text-xs">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Open reports</h2>
        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No open reports.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="card p-4">
                <p className="text-sm text-ink">
                  <span className="font-medium">{r.reporter?.full_name || 'Someone'}</span> reported{' '}
                  <span className="font-medium">{r.reported?.full_name || 'someone'}</span>
                </p>
                <p className="mt-1 text-sm text-muted">{r.reason}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => updateReportStatus(r, 'reviewing')} className="btn btn-outline px-3 py-1.5 text-xs">
                    Mark reviewing
                  </button>
                  <button onClick={() => updateReportStatus(r, 'resolved')} className="btn btn-accent px-3 py-1.5 text-xs">
                    Resolve
                  </button>
                  <button onClick={() => updateReportStatus(r, 'dismissed')} className="btn btn-danger-outline px-3 py-1.5 text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Demo data</h2>
        <p className="mt-2 text-sm text-muted">
          Populates a handful of realistic tutors, students, courses, sessions, and quiz history — useful for a
          walkthrough. Every demo account's email ends in <code>@studycult.demo</code>, which is how cleanup finds
          them again; nothing here ever touches a real user.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => runDemoAction('seed')} disabled={demoBusy} className="btn btn-primary px-5 py-2.5 text-sm">
            {demoBusy ? 'Working…' : 'Seed demo data'}
          </button>
          <button onClick={() => runDemoAction('cleanup')} disabled={demoBusy} className="btn btn-danger-outline px-5 py-2.5 text-sm">
            {demoBusy ? 'Working…' : 'Clear demo data'}
          </button>
        </div>
        {demoMessage && <p className="mt-3 text-sm text-ink-soft">{demoMessage}</p>}
      </div>
    </div>
  )
}

function MetricTile({ label, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold text-ink">{value}</p>
    </div>
  )
}
