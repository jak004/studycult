import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import CoverArt from './CoverArt'
import SpeakButton from './SpeakButton'
import { scoreQuiz } from '../lib/quiz'
import { trackEvent } from '../lib/analytics'

export default function QuizPlayer({ quiz, myId }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    setSubmitted(false)
    setAnswers({})
    setSubmitError('')
    setLoading(true)
    supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('position', { ascending: true })
      .then(({ data }) => {
        setQuestions(data || [])
        setLoading(false)
      })
  }, [quiz.id])

  async function handleSubmit() {
    setSubmitError('')
    const correct = scoreQuiz(questions, answers)

    if (myId) {
      const { error } = await supabase.from('quiz_attempts').insert({
        quiz_id: quiz.id,
        user_id: myId,
        score: correct,
        total: questions.length,
      })
      if (error) {
        setSubmitError(error.message)
        return
      }
      await supabase.from('events').insert({
        user_id: myId,
        type: 'quiz_result',
        payload: { quiz_title: quiz.title, score: correct, total: questions.length },
      })
      trackEvent('Quiz Taken', { subject: quiz.subject })
    }

    setScore(correct)
    setSubmitted(true)
  }

  if (loading) return <p className="text-sm text-muted">Loading questions…</p>
  if (questions.length === 0) return <p className="text-sm text-muted">This quiz has no questions yet.</p>

  return (
    <div>
      <div className="relative -mx-6 -mt-6 mb-5 h-24 overflow-hidden rounded-t-xl">
        <CoverArt seed={quiz.subject} className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/70 to-transparent p-4">
          <h2 className="font-display text-2xl font-medium text-paper">{quiz.title}</h2>
          <p className="text-sm text-paper/80">{quiz.subject}</p>
        </div>
      </div>

      {submitted ? (
        <div className="mt-6 rounded-xl bg-teal-soft p-6 text-center">
          <p className="font-display text-3xl font-semibold text-ink">
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {score === questions.length ? 'Perfect score! 🎉' : 'Nice work — review what you missed below.'}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {questions.map((q, i) => (
          <div key={q.id}>
            <div className="flex items-start gap-2">
              <p className="font-medium text-ink">
                {i + 1}. {q.question}
              </p>
              <SpeakButton text={q.question} className="mt-0.5 shrink-0 text-muted hover:text-ink" />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {q.options.map((opt, idx) => {
                const isPicked = answers[q.id] === idx
                const isCorrect = idx === q.correct_index
                let style = 'border-line hover:border-ink/30'
                if (submitted) {
                  if (isCorrect) style = 'border-teal bg-teal-soft'
                  else if (isPicked) style = 'border-danger bg-danger/10'
                } else if (isPicked) {
                  style = 'border-ink bg-paper'
                }
                return (
                  <button
                    key={idx}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${style}`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <>
          {submitError && <p className="mt-4 text-sm text-danger">{submitError}</p>}
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            Submit answers
          </button>
        </>
      )}
    </div>
  )
}
