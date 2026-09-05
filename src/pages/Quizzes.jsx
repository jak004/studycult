import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import CoverArt from '../components/CoverArt'
import QuickReview from '../components/QuickReview'
import QuizPlayer from '../components/QuizPlayer'
import CreateQuizForm from '../components/CreateQuizForm'

export default function Quizzes() {
  const { profile } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('browse') // browse | create | quick

  async function loadQuizzes() {
    setLoadingQuizzes(true)
    const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false })
    setQuizzes(data || [])
    setLoadingQuizzes(false)
  }

  useEffect(() => {
    loadQuizzes()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink">Quizzes</h1>
          <p className="mt-2 text-muted">Test your recall, or build a check for your students.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSelected(null)
              setMode('quick')
            }}
            className="btn btn-gold px-5 py-2.5 text-sm"
          >
            ⚡ Quick review
          </button>
          {profile?.role === 'tutor' && (
            <button
              onClick={() => {
                setSelected(null)
                setMode('create')
              }}
              className="btn btn-primary px-5 py-2.5 text-sm"
            >
              + Create quiz
            </button>
          )}
        </div>
      </div>

      {mode === 'quick' ? (
        <div className="card mt-8 min-h-[420px] p-6">
          <QuickReview onExit={() => setMode('browse')} />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="card flex flex-col gap-1 p-2">
            {loadingQuizzes ? (
              <p className="p-4 text-sm text-muted">Loading quizzes…</p>
            ) : (
              quizzes.length === 0 && <p className="p-4 text-sm text-muted">No quizzes yet.</p>
            )}
            {quizzes.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setSelected(q)
                  setMode('browse')
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selected?.id === q.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
                }`}
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <CoverArt seed={q.subject} className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{q.title}</span>
                  <span className={`block truncate text-xs ${selected?.id === q.id ? 'text-paper/70' : 'text-muted'}`}>
                    {q.subject}
                  </span>
                </span>
              </button>
            ))}
          </aside>

          <div className="card min-h-[420px] p-6">
            {mode === 'create' ? (
              <CreateQuizForm
                myId={profile.id}
                onCreated={async () => {
                  await loadQuizzes()
                  setMode('browse')
                }}
              />
            ) : selected ? (
              <QuizPlayer quiz={selected} myId={profile?.id} />
            ) : (
              <p className="text-sm text-muted">Pick a quiz from the list to take it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
