import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import CoverArt from '../components/CoverArt'
import QuizPlayer from '../components/QuizPlayer'
import CreateQuizForm from '../components/CreateQuizForm'

export default function Courses() {
  const { profile } = useAuth()
  const isTutor = profile?.role === 'tutor'
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [selected, setSelected] = useState(null)
  const [creatingCourse, setCreatingCourse] = useState(false)

  async function loadCourses() {
    setLoadingCourses(true)
    const { data } = await supabase
      .from('courses')
      .select('*, tutor:profiles!courses_tutor_id_fkey(full_name)')
      .order('created_at', { ascending: false })
    setCourses(data || [])
    setLoadingCourses(false)
    return data || []
  }

  useEffect(() => {
    loadCourses()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink">Courses</h1>
          <p className="mt-2 text-muted">A tutor's slides, readings, and quizzes, bundled into one place to work through.</p>
        </div>
        {isTutor && (
          <button
            onClick={() => {
              setSelected(null)
              setCreatingCourse(true)
            }}
            className="btn btn-primary px-5 py-2.5 text-sm"
          >
            + New course
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="card flex flex-col gap-1 p-2">
          {loadingCourses ? (
            <p className="p-4 text-sm text-muted">Loading courses…</p>
          ) : (
            courses.length === 0 && <p className="p-4 text-sm text-muted">No courses yet.</p>
          )}
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c)
                setCreatingCourse(false)
              }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                selected?.id === c.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
              }`}
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <CoverArt seed={c.subject} className="h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.title}</span>
                <span className={`block truncate text-xs ${selected?.id === c.id ? 'text-paper/70' : 'text-muted'}`}>
                  {c.subject} · {c.tutor?.full_name || 'A tutor'}
                </span>
              </span>
            </button>
          ))}
        </aside>

        <div className="card min-h-[420px] p-6">
          {creatingCourse ? (
            <CreateCourseForm
              myId={profile.id}
              onCreated={async (course) => {
                const list = await loadCourses()
                setSelected(list.find((c) => c.id === course.id) || course)
                setCreatingCourse(false)
              }}
            />
          ) : selected ? (
            <CourseDetail course={selected} profile={profile} />
          ) : (
            <p className="text-sm text-muted">Pick a course from the list, or create one.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateCourseForm({ myId, onCreated }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('courses')
      .insert({ tutor_id: myId, title, subject, description: description.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onCreated(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-medium text-ink">New course</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" className="input" />
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="input" />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What will students learn? (optional)"
        className="input min-h-24 w-full"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="btn btn-primary self-start px-6 py-3 text-sm">
        {saving ? 'Creating…' : 'Create course'}
      </button>
    </form>
  )
}

function CourseDetail({ course, profile }) {
  const isOwner = profile.role === 'tutor' && profile.id === course.tutor_id
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [readingText, setReadingText] = useState('')
  const [readingTitle, setReadingTitle] = useState('')
  const [addingQuiz, setAddingQuiz] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})

  async function load() {
    setLoading(true)
    const [{ data: materialRows }, { data: quizRows }, enrollmentResult] = await Promise.all([
      supabase.from('course_materials').select('*').eq('course_id', course.id).order('created_at', { ascending: true }),
      supabase.from('quizzes').select('*').eq('course_id', course.id).order('created_at', { ascending: true }),
      profile.role === 'student'
        ? supabase.from('course_enrollments').select('id').eq('course_id', course.id).eq('student_id', profile.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setMaterials(materialRows || [])
    setQuizzes(quizRows || [])
    setEnrolled(Boolean(enrollmentResult.data))
    setActiveQuiz(null)
    setAddingQuiz(false)
    setLoading(false)

    const withFiles = (materialRows || []).filter((m) => m.storage_path)
    if (withFiles.length > 0) {
      const pairs = await Promise.all(
        withFiles.map(async (m) => {
          const { data } = await supabase.storage.from('course-materials').createSignedUrl(m.storage_path, 3600)
          return [m.storage_path, data?.signedUrl]
        })
      )
      setSignedUrls(Object.fromEntries(pairs.filter(([, url]) => url)))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  async function toggleEnroll() {
    if (enrolled) {
      await supabase.from('course_enrollments').delete().eq('course_id', course.id).eq('student_id', profile.id)
    } else {
      await supabase.from('course_enrollments').insert({ course_id: course.id, student_id: profile.id })
    }
    setEnrolled((e) => !e)
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const path = `${course.id}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage.from('course-materials').upload(path, file)
      if (uploadErr) throw uploadErr

      let extractedText = null
      if (file.type === 'application/pdf') {
        const { extractPdfText } = await import('../lib/pdf')
        extractedText = await extractPdfText(file)
      }

      const { error: insertErr } = await supabase
        .from('course_materials')
        .insert({ course_id: course.id, title: file.name, storage_path: path, extracted_text: extractedText })
      if (insertErr) throw insertErr
      await load()
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function addReading(e) {
    e.preventDefault()
    if (!readingText.trim()) return
    await supabase.from('course_materials').insert({
      course_id: course.id,
      title: readingTitle.trim() || 'Reading',
      extracted_text: readingText.trim(),
    })
    setReadingText('')
    setReadingTitle('')
    await load()
  }

  async function deleteMaterial(material) {
    if (!confirm(`Remove "${material.title}" from this course?`)) return
    if (material.storage_path) {
      await supabase.storage.from('course-materials').remove([material.storage_path])
    }
    await supabase.from('course_materials').delete().eq('id', material.id)
    await load()
  }

  if (loading) return <p className="text-sm text-muted">Loading course…</p>

  if (activeQuiz) {
    return (
      <div>
        <button onClick={() => setActiveQuiz(null)} className="mb-4 text-sm font-medium text-teal">
          ← Back to {course.title}
        </button>
        <QuizPlayer quiz={activeQuiz} myId={profile.id} />
      </div>
    )
  }

  if (addingQuiz) {
    return (
      <div>
        <button onClick={() => setAddingQuiz(false)} className="mb-4 text-sm font-medium text-teal">
          ← Back to {course.title}
        </button>
        <CreateQuizForm
          myId={profile.id}
          courseId={course.id}
          initialSubject={course.subject}
          initialText={materials.find((m) => m.extracted_text)?.extracted_text || ''}
          onCreated={load}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="relative -mx-6 -mt-6 mb-5 h-28 overflow-hidden rounded-t-xl">
        <CoverArt seed={course.subject} className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/70 to-transparent p-4">
          <h2 className="font-display text-2xl font-medium text-paper">{course.title}</h2>
          <p className="text-sm text-paper/80">{course.subject}</p>
        </div>
      </div>

      {course.description && <p className="text-sm text-ink-soft">{course.description}</p>}

      {profile.role === 'student' && (
        <button
          onClick={toggleEnroll}
          className={`btn mt-4 px-5 py-2 text-sm ${enrolled ? 'btn-danger-outline' : 'btn-accent'}`}
        >
          {enrolled ? 'Enrolled ✓ (click to leave)' : 'Enroll in this course'}
        </button>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-ink">Materials</h3>
        </div>
        {materials.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No materials yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {materials.map((m) => (
              <div key={m.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    {m.storage_path && signedUrls[m.storage_path] && (
                      <a href={signedUrls[m.storage_path]} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal underline">
                        View file
                      </a>
                    )}
                    {isOwner && (
                      <button onClick={() => deleteMaterial(m)} className="text-xs text-muted hover:text-danger">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {!m.storage_path && m.extracted_text && (
                  <p className="mt-2 line-clamp-3 text-xs text-muted">{m.extracted_text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-line p-4">
            <label className="inline-block w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-teal hover:text-teal">
              {uploading ? 'Uploading…' : '📎 Upload a file'}
              <input type="file" onChange={uploadFile} className="hidden" disabled={uploading} />
            </label>
            {uploadError && <p className="text-sm text-danger">{uploadError}</p>}

            <form onSubmit={addReading} className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted">Or add a plain-text reading</p>
              <input
                value={readingTitle}
                onChange={(e) => setReadingTitle(e.target.value)}
                placeholder="Reading title"
                className="input"
              />
              <textarea
                value={readingText}
                onChange={(e) => setReadingText(e.target.value)}
                placeholder="Paste or write the reading content…"
                className="input min-h-20 w-full"
              />
              <button type="submit" className="self-start rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-teal hover:text-teal">
                + Add reading
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-ink">Quizzes</h3>
          {isOwner && (
            <button onClick={() => setAddingQuiz(true)} className="text-sm font-medium text-teal">
              + Add quiz
            </button>
          )}
        </div>
        {quizzes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No quizzes in this course yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quizzes.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveQuiz(q)}
                className="rounded-xl border border-line p-3 text-left text-sm font-medium text-ink hover:border-teal"
              >
                {q.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
