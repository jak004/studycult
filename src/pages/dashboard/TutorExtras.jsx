import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { initials } from '../../lib/format'

// Must match PLATFORM_FEE_PERCENT in supabase/functions/release-payment —
// duplicated because that runs in Deno and this runs in the browser, so
// there's no single module they could actually share.
const PLATFORM_FEE_PERCENT = 10

export default function TutorExtras({ profile }) {
  const [earnings, setEarnings] = useState({ totalEarned: 0, pendingPayout: 0, currency: 'GHS' })
  const [students, setStudents] = useState([])
  const [myQuizzes, setMyQuizzes] = useState([])
  const [attemptCounts, setAttemptCounts] = useState({})
  const [reviews, setReviews] = useState({ avg: null, count: 0, recent: [] })
  const [needsAttention, setNeedsAttention] = useState([])

  useEffect(() => {
    if (!profile) return

    async function load() {
      const [{ data: payments }, { data: sessionRows }, { data: quizzes }, { data: reviewRows }] = await Promise.all([
        supabase.from('payments').select('amount_minor, currency, status').eq('tutor_id', profile.id),
        supabase
          .from('sessions')
          .select(
            'student_id, scheduled_at, status, student:profiles!sessions_student_id_fkey(full_name, avatar_url)'
          )
          .eq('tutor_id', profile.id),
        supabase.from('quizzes').select('*').eq('created_by', profile.id).order('created_at', { ascending: false }).limit(5),
        supabase
          .from('reviews')
          .select('rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)')
          .eq('reviewee_id', profile.id)
          .order('created_at', { ascending: false }),
      ])

      const feeMultiplier = 1 - PLATFORM_FEE_PERCENT / 100
      const sumMinor = (rows) => rows.reduce((total, p) => total + p.amount_minor, 0)
      const transferred = (payments || []).filter((p) => p.status === 'transferred')
      const pending = (payments || []).filter((p) => p.status === 'paid')
      setEarnings({
        totalEarned: (sumMinor(transferred) * feeMultiplier) / 100,
        pendingPayout: (sumMinor(pending) * feeMultiplier) / 100,
        currency: payments?.[0]?.currency || 'GHS',
      })

      const uniqueStudents = new Map()
      const lastSessionAt = new Map()
      ;(sessionRows || []).forEach((s) => {
        if (!uniqueStudents.has(s.student_id)) uniqueStudents.set(s.student_id, s.student)
        const prev = lastSessionAt.get(s.student_id)
        if (!prev || s.scheduled_at > prev) lastSessionAt.set(s.student_id, s.scheduled_at)
      })
      setStudents(Array.from(uniqueStudents.entries()).slice(0, 6))

      setMyQuizzes(quizzes || [])
      if (quizzes?.length > 0) {
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('quiz_id')
          .in('quiz_id', quizzes.map((q) => q.id))
        const counts = {}
        ;(attempts || []).forEach((a) => {
          counts[a.quiz_id] = (counts[a.quiz_id] || 0) + 1
        })
        setAttemptCounts(counts)
      }

      // A lightweight "who might need a check-in" signal, built entirely from
      // data already collected: struggling on this tutor's quizzes, or gone
      // quiet since their last session. Not a rigorous risk model — just a
      // nudge, similar in spirit to a teacher's at-a-glance class overview.
      const { data: allMyQuizIds } = await supabase.from('quizzes').select('id').eq('created_by', profile.id)
      let scoreByStudent = new Map()
      if (allMyQuizIds?.length > 0) {
        const { data: allAttempts } = await supabase
          .from('quiz_attempts')
          .select('user_id, score, total')
          .in('quiz_id', allMyQuizIds.map((q) => q.id))
        const totals = new Map()
        ;(allAttempts || []).forEach((a) => {
          const entry = totals.get(a.user_id) || { score: 0, total: 0 }
          entry.score += a.score
          entry.total += a.total
          totals.set(a.user_id, entry)
        })
        scoreByStudent = new Map(
          Array.from(totals.entries()).map(([id, v]) => [id, v.total > 0 ? Math.round((v.score / v.total) * 100) : null])
        )
      }

      const now = Date.now()
      const flagged = []
      uniqueStudents.forEach((student, studentId) => {
        const avgPercent = scoreByStudent.get(studentId)
        const last = lastSessionAt.get(studentId)
        const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null
        if (avgPercent != null && avgPercent < 55) {
          flagged.push({ id: studentId, student, reason: `Averaging ${avgPercent}% on your quizzes` })
        } else if (daysSince != null && daysSince >= 21) {
          flagged.push({ id: studentId, student, reason: `No session in ${daysSince} days` })
        }
      })
      setNeedsAttention(flagged.slice(0, 5))

      const list = reviewRows || []
      setReviews({
        avg: list.length > 0 ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : null,
        count: list.length,
        recent: list.slice(0, 3),
      })
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  return (
    <>
      {profile.verification_status !== 'verified' && (
        <div className="mt-8 card flex flex-wrap items-center justify-between gap-3 border-gold bg-gold-soft p-5">
          <div>
            <p className="text-sm font-semibold text-ink">
              {profile.verification_status === 'pending' ? 'Verification pending' : "You're not verified yet"}
            </p>
            <p className="text-sm text-ink-soft">
              {profile.verification_status === 'pending'
                ? "We're reviewing your document — check back soon."
                : 'Verified tutors get a badge students can see when browsing.'}
            </p>
          </div>
          {profile.verification_status !== 'pending' && (
            <Link to="/profile?tab=verification" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
              Get verified
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <p className="text-sm font-medium text-muted">Total earned</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            {earnings.currency} {earnings.totalEarned.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted">After the platform's {PLATFORM_FEE_PERCENT}% fee</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-muted">Pending payout</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            {earnings.currency} {earnings.pendingPayout.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted">Collected, not yet released to you</p>
        </div>
      </div>

      {needsAttention.length > 0 && (
        <Section title="Students who may need a check-in" to="/messages" cta="Open Messages">
          <div className="flex flex-col gap-3">
            {needsAttention.map(({ id, student, reason }) => (
              <div key={id} className="card flex items-center gap-3 p-4">
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt={student.full_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                    {initials(student?.full_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{student?.full_name || 'Student'}</p>
                  <p className="truncate text-xs text-ink-soft">⚠ {reason}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Your students" to="/messages" cta="Open Messages">
        {students.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {students.map(([id, student]) => (
              <div key={id} className="card flex items-center gap-3 p-4">
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt={student.full_name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                    {initials(student?.full_name)}
                  </span>
                )}
                <p className="truncate text-sm font-medium text-ink">{student?.full_name || 'Student'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-muted">
            No students yet — they'll show up once someone books a session with you.
          </p>
        )}
      </Section>

      <Section title="Your quizzes" to="/quizzes" cta="Manage quizzes">
        {myQuizzes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {myQuizzes.map((q) => (
              <Link key={q.id} to="/quizzes" className="card p-4 transition-transform hover:-translate-y-1">
                <p className="truncate text-sm font-medium text-ink">{q.title}</p>
                <p className="truncate text-xs text-muted">
                  {q.subject} · {attemptCounts[q.id] || 0} attempt{attemptCounts[q.id] === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">You haven't created a quiz yet.</p>
            <Link to="/quizzes" className="mt-2 inline-block text-sm font-medium text-teal">
              Create one →
            </Link>
          </div>
        )}
      </Section>

      <Section title="Recent reviews" to="/tutors" cta="See your public listing">
        {reviews.count > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink-soft">
              ⭐ {reviews.avg.toFixed(1)} average from {reviews.count} review{reviews.count === 1 ? '' : 's'}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {reviews.recent.map((r, i) => (
                <div key={i} className="card p-4">
                  <p className="text-sm text-ink">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)} <span className="text-muted">— {r.reviewer?.full_name || 'A student'}</span>
                  </p>
                  {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-muted">No reviews yet.</p>
        )}
      </Section>
    </>
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
