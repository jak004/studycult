import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import SpeakButton from './SpeakButton'

const QUESTION_COUNT = 8
const SECONDS_PER_QUESTION = 20

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A stripped-down, timed, rapid-fire revision mode that pulls random
// questions across every quiz on the platform — meant for last-minute
// cramming, not for the graded/persisted flow a single quiz's QuizPlayer
// uses, so nothing here writes to quiz_attempts.
export default function QuickReview({ onExit }) {
  const [phase, setPhase] = useState('loading') // loading | empty | active | done
  const [pool, setPool] = useState([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION)
  const advanceTimeoutRef = useRef(null)

  async function start() {
    setPhase('loading')
    const { data } = await supabase
      .from('quiz_questions')
      .select('*, quiz:quizzes(subject, title)')
      .limit(200)
    const all = data || []
    if (all.length === 0) {
      setPhase('empty')
      return
    }
    setPool(shuffle(all).slice(0, QUESTION_COUNT))
    setIndex(0)
    setPicked(null)
    setCorrectCount(0)
    setTimeLeft(SECONDS_PER_QUESTION)
    setPhase('active')
  }

  useEffect(() => {
    start()
    return () => clearTimeout(advanceTimeoutRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'active' || picked !== null) return
    if (timeLeft <= 0) {
      handlePick(null)
      return
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, picked])

  function handlePick(optionIndex) {
    if (picked !== null) return
    const question = pool[index]
    const isCorrect = optionIndex === question.correct_index
    setPicked(optionIndex)
    if (isCorrect) setCorrectCount((c) => c + 1)

    advanceTimeoutRef.current = setTimeout(() => {
      if (index + 1 >= pool.length) {
        setPhase('done')
      } else {
        setIndex((i) => i + 1)
        setPicked(null)
        setTimeLeft(SECONDS_PER_QUESTION)
      }
    }, 900)
  }

  if (phase === 'loading') return <p className="text-sm text-muted">Loading questions…</p>

  if (phase === 'empty') {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">There aren't any quiz questions on the platform yet to review.</p>
        <button onClick={onExit} className="btn btn-outline mt-4 px-5 py-2.5 text-sm">
          Back to quizzes
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="text-center">
        <p className="font-display text-4xl font-semibold text-ink">
          {correctCount} / {pool.length}
        </p>
        <p className="mt-2 text-sm text-muted">Quick review complete.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={start} className="btn btn-primary px-5 py-2.5 text-sm">
            Go again
          </button>
          <button onClick={onExit} className="btn btn-outline px-5 py-2.5 text-sm">
            Back to quizzes
          </button>
        </div>
      </div>
    )
  }

  const question = pool[index]

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-teal">⚡ Quick review · {question.quiz?.subject}</p>
          <p className="text-xs text-muted">
            Question {index + 1} of {pool.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-display text-xl font-semibold ${timeLeft <= 5 ? 'text-danger' : 'text-ink'}`}>{timeLeft}s</span>
          <button onClick={onExit} className="text-xs font-medium text-muted hover:text-ink">
            Exit
          </button>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-teal transition-[width] duration-1000 ease-linear"
          style={{ width: `${(timeLeft / SECONDS_PER_QUESTION) * 100}%` }}
        />
      </div>

      <div className="mt-6 flex items-start gap-2">
        <p className="font-medium text-ink">{question.question}</p>
        <SpeakButton text={question.question} className="mt-0.5 shrink-0 text-muted hover:text-ink" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((opt, idx) => {
          const isPicked = picked === idx
          const isCorrect = idx === question.correct_index
          let style = 'border-line hover:border-ink/30'
          if (picked !== null) {
            if (isCorrect) style = 'border-teal bg-teal-soft'
            else if (isPicked) style = 'border-danger bg-danger/10'
          }
          return (
            <button
              key={idx}
              disabled={picked !== null}
              onClick={() => handlePick(idx)}
              className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${style}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
