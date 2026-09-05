import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function emptyQuestion() {
  return { question: '', options: ['', '', '', ''], correct_index: 0 }
}

// Shared by the standalone Quizzes page and Courses (where a quiz can
// optionally hang off a course via courseId, and prefill its subject from
// the course's, and — when generating from a course material — skip the PDF
// upload step since the text was already extracted when the material was
// added).
export default function CreateQuizForm({ myId, courseId = null, initialSubject = '', initialText = '', onCreated }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  async function generateFrom(text) {
    setGenError('')
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: { text, count: 5 },
      })
      if (error || data?.error) throw new Error(data?.error || error.message)

      setQuestions((prev) => {
        const kept = prev.filter((q) => q.question.trim() || q.options.some((o) => o.trim()))
        const generated = data.questions.map((g) => ({
          question: g.question,
          options: g.options,
          correct_index: g.correct_index,
        }))
        return [...kept, ...generated]
      })
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateFromSlides(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Loaded on demand — pdfjs-dist is large enough that it shouldn't sit in
    // every visitor's initial bundle just for this one feature.
    const { extractPdfText } = await import('../lib/pdf')
    const text = await extractPdfText(file)
    await generateFrom(text)
  }

  function updateQuestion(i, patch) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  function updateOption(qi, oi, value) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q))
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert({ title, subject, created_by: myId, course_id: courseId })
      .select()
      .single()

    if (!error && quiz) {
      const rows = questions
        .filter((q) => q.question.trim())
        .map((q, i) => ({
          quiz_id: quiz.id,
          question: q.question,
          options: q.options.filter((o) => o.trim()),
          correct_index: q.correct_index,
          position: i,
        }))
      if (rows.length > 0) await supabase.from('quiz_questions').insert(rows)
    }
    setSaving(false)
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-medium text-ink">New quiz</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" className="input" />
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="input" />
      </div>

      <div className="rounded-xl border border-dashed border-line p-4">
        <p className="text-sm font-medium text-ink-soft">Generate from slides</p>
        <p className="mt-1 text-xs text-muted">
          {initialText
            ? 'Use the material already uploaded to this course, or upload a different PDF — either way, AI drafts questions below for you to review and edit before publishing.'
            : 'Upload a PDF of your slides or notes — AI drafts multiple-choice questions from it below, which you review and edit before publishing (nothing here is auto-published).'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {initialText && (
            <button
              type="button"
              onClick={() => generateFrom(initialText)}
              disabled={generating}
              className="inline-block cursor-pointer rounded-full border border-teal px-4 py-2 text-sm font-medium text-teal hover:bg-teal-soft disabled:opacity-60"
            >
              {generating ? 'Generating…' : '✨ Use this material'}
            </button>
          )}
          <label className="inline-block cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-teal hover:text-teal">
            {generating ? 'Reading & generating…' : '📄 Upload PDF'}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleGenerateFromSlides}
              className="hidden"
              disabled={generating}
            />
          </label>
        </div>
        {genError && <p className="mt-2 text-sm text-danger">{genError}</p>}
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-xl border border-line p-4">
          <input
            required
            value={q.question}
            onChange={(e) => updateQuestion(qi, { question: e.target.value })}
            placeholder={`Question ${qi + 1}`}
            className="input w-full"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correct_index === oi}
                  onChange={() => updateQuestion(qi, { correct_index: oi })}
                />
                <input
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                  className="input flex-1"
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">Select the radio next to the correct option.</p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
        className="self-start rounded-full border border-dashed border-line px-4 py-2 text-sm font-medium text-teal hover:bg-teal-soft"
      >
        + Add question
      </button>

      <button type="submit" disabled={saving} className="btn btn-primary self-start px-6 py-3 text-sm">
        {saving ? 'Saving…' : 'Publish quiz'}
      </button>
    </form>
  )
}
