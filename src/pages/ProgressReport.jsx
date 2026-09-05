import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Public — no login. Reached only via a share link a student generated from
// Profile > Progress reports, so there's no navbar-driven way to land here.
export default function ProgressReport() {
  const { token } = useParams()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error: invokeError } = await supabase.functions.invoke('progress-report', { body: { token } })
      if (invokeError || data?.error) {
        setError(data?.error || invokeError.message)
      } else {
        setReport(data)
      }
      setLoading(false)
    }
    load()
  }, [token])

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-teal">StudyCult · Progress report</p>

      {loading && <p className="mt-4 text-sm text-muted">Loading…</p>}

      {!loading && error && (
        <div className="card mt-6 p-8 text-center">
          <p className="text-ink">{error}</p>
        </div>
      )}

      {!loading && report && (
        <>
          <h1 className="mt-1 font-display text-4xl font-semibold text-ink">{report.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            Generated {new Date(report.generated_at).toLocaleString()}
            {report.last_activity && ` · last quiz on ${new Date(report.last_activity).toLocaleDateString()}`}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <p className="text-sm font-medium text-muted">Quizzes taken</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">{report.total_quizzes}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm font-medium text-muted">Sessions completed</p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">{report.total_sessions_completed}</p>
            </div>
          </div>

          <div className="card mt-6 p-6">
            <p className="mb-4 text-sm font-semibold text-ink">Performance by subject</p>
            {report.subjects.length === 0 ? (
              <p className="text-sm text-muted">No quizzes taken yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {report.subjects.map((s) => (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{s.subject}</span>
                      <span className="text-muted">
                        {s.percent}% · {s.attempts} attempt{s.attempts === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${s.percent >= 70 ? 'bg-teal' : s.percent >= 40 ? 'bg-gold' : 'bg-danger'}`}
                        style={{ width: `${s.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted">
            This is a read-only summary shared by the student. It shows nothing beyond quiz and session activity.
          </p>
        </>
      )}
    </div>
  )
}
