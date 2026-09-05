import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import CoverArt from '../components/CoverArt'
import { formatInViewerTimezone } from '../lib/timezone'
import { buildGoogleCalendarUrl, downloadIcsFile } from '../lib/calendar'
import { paymentStatusLabel } from '../lib/payments'
import { displayName } from '../lib/names'
import TutorExtras from './dashboard/TutorExtras'
import StudentExtras from './dashboard/StudentExtras'

export default function Dashboard() {
  const { profile } = useAuth()
  const isTutor = profile?.role === 'tutor'
  const [stats, setStats] = useState({ conversations: 0, quizzes: 0 })
  const [recentConvos, setRecentConvos] = useState([])
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [reviewingSession, setReviewingSession] = useState(null)

  async function loadSessions() {
    if (!profile) return
    setLoadingSessions(true)
    const { data } = await supabase
      .from('sessions')
      .select(
        '*, tutor:profiles!sessions_tutor_id_fkey(full_name), student:profiles!sessions_student_id_fkey(full_name)'
      )
      .or(`tutor_id.eq.${profile.id},student_id.eq.${profile.id}`)
      .in('status', ['pending', 'confirmed', 'completed'])
      .order('scheduled_at', { ascending: true })
      .limit(5)

    const sessionList = data || []
    const ids = sessionList.map((s) => s.id)
    let paymentsBySessionId = {}
    let myReviewBySessionId = {}
    if (ids.length > 0) {
      const [{ data: paymentRows }, { data: reviewRows }] = await Promise.all([
        supabase.from('payments').select('*').in('session_id', ids),
        supabase.from('reviews').select('session_id').eq('reviewer_id', profile.id).in('session_id', ids),
      ])
      paymentsBySessionId = Object.fromEntries((paymentRows || []).map((p) => [p.session_id, p]))
      myReviewBySessionId = Object.fromEntries((reviewRows || []).map((r) => [r.session_id, true]))
    }
    setSessions(
      sessionList.map((s) => ({
        ...s,
        payment: paymentsBySessionId[s.id],
        myReview: myReviewBySessionId[s.id] || false,
      }))
    )
    setLoadingSessions(false)
  }

  async function submitReview(session, rating, comment) {
    const revieweeId = session.tutor_id === profile.id ? session.student_id : session.tutor_id
    const { error } = await supabase.from('reviews').insert({
      session_id: session.id,
      reviewer_id: profile.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    })
    if (error) throw error
    await loadSessions()
  }

  async function payNow(session) {
    const { data, error } = await supabase.functions.invoke('create-payment', { body: { session_id: session.id } })
    if (error || data?.error) {
      alert(data?.error || error.message)
      return
    }
    window.location.href = data.authorization_url
  }

  async function markCompleted(session) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', session.id)
    await loadSessions()
  }

  async function releasePayment(session) {
    const { data, error } = await supabase.functions.invoke('release-payment', { body: { session_id: session.id } })
    if (error || data?.error) {
      alert(data?.error || error.message)
      return
    }
    await loadSessions()
  }

  async function confirmSession(session) {
    await supabase.from('sessions').update({ status: 'confirmed' }).eq('id', session.id)
    await supabase.from('events').insert({
      user_id: session.student_id,
      type: 'session_confirmed',
      payload: {
        session_id: session.id,
        other_name: profile.full_name,
        when_text: formatInViewerTimezone(session.scheduled_at),
      },
    })
    await loadSessions()
  }

  async function cancelSession(session) {
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', session.id)
    const otherId = session.tutor_id === profile.id ? session.student_id : session.tutor_id
    await supabase.from('events').insert({
      user_id: otherId,
      type: 'session_cancelled',
      payload: { session_id: session.id, other_name: profile.full_name },
    })
    await loadSessions()
  }

  useEffect(() => {
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setLoadingConvos(true)

    async function load() {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      const convoIds = (memberships || []).map((m) => m.conversation_id)

      let convos = []
      if (convoIds.length > 0) {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .in('id', convoIds)
          .order('created_at', { ascending: false })
          .limit(3)
        convos = data || []

        const directIds = convos.filter((c) => !c.is_group).map((c) => c.id)
        if (directIds.length > 0) {
          const { data: members } = await supabase
            .from('conversation_members')
            .select('conversation_id, profiles(full_name, username, role)')
            .in('conversation_id', directIds)
            .neq('user_id', profile.id)
          const names = {}
          ;(members || []).forEach((m) => {
            names[m.conversation_id] = m.profiles ? displayName(m.profiles, profile.role) : undefined
          })
          convos = convos.map((c) => (c.is_group ? c : { ...c, partnerName: names[c.id] }))
        }
      }

      const { count: quizCount } = isTutor
        ? await supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('created_by', profile.id)
        : await supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)

      if (cancelled) return
      setStats({ conversations: convoIds.length, quizzes: quizCount || 0 })
      setRecentConvos(convos)
      setLoadingConvos(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, isTutor])

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="relative overflow-hidden rounded-3xl shadow-[0_30px_70px_-30px_rgba(22,35,61,0.55)]">
        <CoverArt seed={profile?.id || 'dashboard'} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="relative px-8 py-12 sm:px-12">
          <p className="text-sm font-medium text-paper/80">{isTutor ? 'Tutor dashboard' : 'Student dashboard'}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-paper">
            Hey {profile?.full_name?.split(' ')[0] || 'there'} {profile?.avatar_emoji || '👋'}
          </h1>
          <p className="mt-3 max-w-lg text-paper/85">
            {isTutor
              ? "Here's what's happening with your students, rooms, and quizzes."
              : "Here's what's happening across your tutors, rooms, and quizzes."}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <DashCard
          to="/messages"
          title="Messages & study rooms"
          body="Continue a conversation or join a group cramming your subject."
          emoji="💬"
          stat={stats.conversations}
        />
        <DashCard
          to="/quizzes"
          title="Quizzes"
          body={isTutor ? 'Build a quiz for your students.' : 'Test yourself on a topic in under 5 minutes.'}
          emoji="📝"
          stat={stats.quizzes}
        />
        <DashCard
          to={isTutor ? '/profile' : '/tutors'}
          title={isTutor ? 'Your profile & rates' : 'Find a tutor'}
          body={isTutor ? 'Keep your subjects and rate current.' : 'Browse tutors by subject and start a chat.'}
          emoji="🧭"
        />
      </div>

      <Section
        title="Upcoming sessions"
        to={isTutor ? '/profile?tab=availability' : '/tutors'}
        cta={isTutor ? 'Manage availability' : 'Book a tutor'}
      >
        {loadingSessions ? (
          <p className="card p-6 text-center text-sm text-muted">Loading sessions…</p>
        ) : sessions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => {
              const otherName = isTutor ? s.student?.full_name : s.tutor?.full_name
              const payment = s.payment
              return (
                <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {formatInViewerTimezone(s.scheduled_at)} · {otherName || 'Someone'}
                    </p>
                    <p className="text-xs text-muted">
                      {s.status === 'pending' && 'Waiting on confirmation'}
                      {s.status !== 'pending' &&
                        (payment ? paymentStatusLabel(payment.status) : `${s.status} · unpaid`)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {s.status === 'confirmed' && (
                      <>
                        <a
                          href={buildGoogleCalendarUrl({
                            title: `Session with ${otherName || 'StudyCult'}`,
                            description: 'StudyCult tutoring session',
                            startUtc: s.scheduled_at,
                            durationMinutes: s.duration_minutes,
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline px-3 py-1.5 text-xs"
                        >
                          📅 Google Calendar
                        </a>
                        <button
                          onClick={() =>
                            downloadIcsFile({
                              uid: s.id,
                              title: `Session with ${otherName || 'StudyCult'}`,
                              description: 'StudyCult tutoring session',
                              startUtc: s.scheduled_at,
                              durationMinutes: s.duration_minutes,
                            })
                          }
                          className="btn btn-outline px-3 py-1.5 text-xs"
                        >
                          ⬇ .ics
                        </button>
                      </>
                    )}
                    {isTutor && s.status === 'pending' && (
                      <button onClick={() => confirmSession(s)} className="btn btn-accent px-3 py-1.5 text-xs">
                        Confirm
                      </button>
                    )}
                    {!isTutor && s.status === 'confirmed' && !payment && (
                      <button onClick={() => payNow(s)} className="btn btn-gold px-3 py-1.5 text-xs">
                        Pay now
                      </button>
                    )}
                    {isTutor && s.status === 'confirmed' && (
                      <button onClick={() => markCompleted(s)} className="btn btn-primary px-3 py-1.5 text-xs">
                        Mark completed
                      </button>
                    )}
                    {isTutor && s.status === 'completed' && payment?.status === 'paid' && (
                      <button onClick={() => releasePayment(s)} className="btn btn-accent px-3 py-1.5 text-xs">
                        Release payment
                      </button>
                    )}
                    {s.status === 'completed' && !s.myReview && (
                      <button onClick={() => setReviewingSession(s)} className="btn btn-outline px-3 py-1.5 text-xs">
                        Leave a review
                      </button>
                    )}
                    {s.status !== 'completed' && (
                      <button onClick={() => cancelSession(s)} className="btn btn-danger-outline px-3 py-1.5 text-xs">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            body="No upcoming sessions."
            to={isTutor ? '/profile?tab=availability' : '/tutors'}
            cta={isTutor ? 'Set your availability' : 'Book a tutor'}
          />
        )}
      </Section>

      <Section title="Continue chatting" to="/messages" cta="Open Messages">
        {loadingConvos ? (
          <p className="card p-6 text-center text-sm text-muted">Loading conversations…</p>
        ) : recentConvos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {recentConvos.map((c) => (
              <Link
                key={c.id}
                to={`/messages?c=${c.id}`}
                className="card flex items-center gap-3 p-4 transition-transform hover:-translate-y-1"
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <CoverArt seed={c.is_group ? c.subject || c.name : c.partnerName || c.id} className="h-full w-full" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.is_group ? c.name : c.partnerName || 'Conversation'}
                  </p>
                  {c.is_group && c.subject && <p className="truncate text-xs text-muted">{c.subject}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            body={
              isTutor ? "No conversations yet — they'll show up once a student reaches out." : 'No conversations yet.'
            }
            to={isTutor ? undefined : '/tutors'}
            cta={isTutor ? undefined : 'Message a tutor'}
          />
        )}
      </Section>

      {isTutor ? <TutorExtras profile={profile} /> : <StudentExtras profile={profile} />}

      {reviewingSession && (
        <ReviewModal
          session={reviewingSession}
          onSubmit={submitReview}
          onClose={() => setReviewingSession(null)}
        />
      )}
    </div>
  )
}

function ReviewModal({ session, onSubmit, onClose }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(session, rating, comment.trim() || null)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-6 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-6">
        <h2 className="font-display text-xl font-medium text-ink">Leave a review</h2>
        <div className="mt-4 flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={n <= rating ? 'text-gold' : 'text-line'}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment"
          className="input mt-4 min-h-20 w-full"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary px-5 py-2.5 text-sm">
            {busy ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </form>
    </div>
  )
}


function DashCard({ to, title, body, emoji, stat }) {
  return (
    <Link
      to={to}
      className="card group flex flex-col gap-3 p-6 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-28px_rgba(22,35,61,0.5)]"
    >
      <div className="flex items-center justify-between">
        <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-[0_6px_16px_-6px_rgba(22,35,61,0.4)] transition-transform duration-200 group-hover:scale-105">
          <CoverArt seed={title} className="absolute inset-0 h-full w-full" />
          <span className="relative text-xl drop-shadow">{emoji}</span>
        </span>
        {stat != null && <span className="font-display text-3xl font-semibold text-ink">{stat}</span>}
      </div>
      <span className="font-display text-lg font-medium text-ink">{title}</span>
      <span className="text-sm text-muted">{body}</span>
      <span className="mt-auto text-sm font-medium text-teal opacity-0 transition-opacity group-hover:opacity-100">
        Go →
      </span>
    </Link>
  )
}

function Section({ title, to, cta, children }) {
  return (
    <div className="mt-12">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-medium text-ink">{title}</h2>
        <Link to={to} className="text-sm font-medium text-teal">
          {cta} →
        </Link>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function EmptyState({ body, to, cta }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-muted">{body}</p>
      {to && (
        <Link to={to} className="mt-3 inline-block text-sm font-medium text-teal">
          {cta} →
        </Link>
      )}
    </div>
  )
}
