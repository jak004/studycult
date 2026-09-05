import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import CoverArt from '../../components/CoverArt'
import { initials } from '../../lib/format'

export default function StudentExtras({ profile }) {
  const [tutors, setTutors] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [myAttempts, setMyAttempts] = useState([])
  const [mastery, setMastery] = useState([])
  const [myCourses, setMyCourses] = useState([])

  useEffect(() => {
    if (!profile) return

    async function load() {
      const [{ data: tutorList }, { data: quizList }, { data: attempts }, { data: enrollments }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'tutor').limit(3),
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(3),
        supabase
          .from('quiz_attempts')
          .select('quiz_id, score, total, completed_at, quiz:quizzes(title, subject)')
          .eq('user_id', profile.id)
          .order('completed_at', { ascending: false }),
        supabase
          .from('course_enrollments')
          .select('course:courses(id, title, subject, tutor:profiles!courses_tutor_id_fkey(full_name))')
          .eq('student_id', profile.id),
      ])
      setTutors(tutorList || [])
      setQuizzes(quizList || [])
      const all = attempts || []
      setMyAttempts(all.slice(0, 3))

      const courses = (enrollments || []).map((e) => e.course).filter(Boolean)
      if (courses.length > 0) {
        const { data: courseQuizzes } = await supabase
          .from('quizzes')
          .select('id, course_id')
          .in('course_id', courses.map((c) => c.id))
        const attemptedQuizIds = new Set(all.map((a) => a.quiz_id))
        setMyCourses(
          courses.map((c) => {
            const quizIds = (courseQuizzes || []).filter((q) => q.course_id === c.id).map((q) => q.id)
            const done = quizIds.filter((id) => attemptedQuizIds.has(id)).length
            return { ...c, total: quizIds.length, done }
          })
        )
      } else {
        setMyCourses([])
      }

      const bySubject = new Map()
      all.forEach((a) => {
        const subject = a.quiz?.subject || 'Other'
        const entry = bySubject.get(subject) || { score: 0, total: 0, attempts: 0 }
        entry.score += a.score
        entry.total += a.total
        entry.attempts += 1
        bySubject.set(subject, entry)
      })
      setMastery(
        Array.from(bySubject.entries())
          .map(([subject, v]) => ({ subject, attempts: v.attempts, percent: v.total > 0 ? Math.round((v.score / v.total) * 100) : 0 }))
          .sort((a, b) => b.percent - a.percent)
      )
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  return (
    <>
      <Section title="Tutors you might like" to="/tutors" cta="See all tutors">
        {tutors.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {tutors.map((t) => (
              <Link key={t.id} to="/tutors" className="card overflow-hidden transition-transform hover:-translate-y-1">
                <div className="relative h-16">
                  <CoverArt seed={t.subjects?.[0] || t.full_name} className="h-full w-full" />
                  {t.avatar_url ? (
                    <img
                      src={t.avatar_url}
                      alt={t.full_name}
                      className="absolute -bottom-5 left-4 h-10 w-10 rounded-full border-4 border-paper-raised object-cover"
                    />
                  ) : (
                    <div className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full border-4 border-paper-raised bg-ink text-xs font-semibold text-paper">
                      {initials(t.full_name)}
                    </div>
                  )}
                </div>
                <div className="p-4 pt-7">
                  <p className="text-sm font-medium text-ink">{t.full_name}</p>
                  {t.subjects?.[0] && <p className="text-xs text-muted">{t.subjects[0]}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-muted">No tutors have joined yet — check back soon.</p>
        )}
      </Section>

      <Section title="Latest quizzes" to="/quizzes" cta="Go to Quizzes">
        {quizzes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {quizzes.map((q) => (
              <Link key={q.id} to="/quizzes" className="card flex items-center gap-3 p-4 transition-transform hover:-translate-y-1">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                  <CoverArt seed={q.subject} className="h-full w-full" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{q.title}</p>
                  <p className="truncate text-xs text-muted">{q.subject}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-muted">No quizzes yet.</p>
        )}
      </Section>

      {myCourses.length > 0 && (
        <Section title="Your courses" to="/courses" cta="Browse courses">
          <div className="grid gap-4 sm:grid-cols-3">
            {myCourses.map((c) => (
              <Link key={c.id} to="/courses" className="card p-4 transition-transform hover:-translate-y-1">
                <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                <p className="truncate text-xs text-muted">
                  {c.subject} · {c.tutor?.full_name || 'A tutor'}
                </p>
                {c.total > 0 && (
                  <>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${Math.round((c.done / c.total) * 100)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {c.done} / {c.total} quizzes done
                    </p>
                  </>
                )}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {mastery.length > 0 && (
        <Section title="Your progress by subject" to="/quizzes" cta="Practice more">
          <div className="card flex flex-col gap-4 p-6">
            {mastery.map((m) => {
              const badge = masteryBadge(m.percent)
              return (
                <div key={m.subject}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">
                      {badge.emoji} {m.subject} <span className="text-xs font-normal text-muted">· {badge.label}</span>
                    </span>
                    <span className="text-muted">
                      {m.percent}% · {m.attempts} attempt{m.attempts === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${m.percent >= 70 ? 'bg-teal' : m.percent >= 40 ? 'bg-gold' : 'bg-danger'}`}
                      style={{ width: `${m.percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <Section title="Your quiz history" to="/quizzes" cta="Take another">
        {myAttempts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myAttempts.map((a, i) => (
              <div key={i} className="card flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{a.quiz?.title || 'Quiz'}</p>
                  <p className="text-xs text-muted">{a.quiz?.subject}</p>
                </div>
                <p className="font-display text-lg font-semibold text-ink">
                  {a.score}/{a.total}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-muted">You haven't taken a quiz yet.</p>
        )}
      </Section>
    </>
  )
}

function masteryBadge(percent) {
  if (percent >= 85) return { emoji: '🥇', label: 'Gold' }
  if (percent >= 65) return { emoji: '🥈', label: 'Silver' }
  if (percent >= 40) return { emoji: '🥉', label: 'Bronze' }
  return { emoji: '🌱', label: 'Starting out' }
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
