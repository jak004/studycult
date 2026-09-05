import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const subjects = ['Mathematics', 'Physics', 'Chemistry', 'English', 'Economics', 'French']

const DEMO_SUBJECTS = [
  { label: 'Mathematics', icon: '📐' },
  { label: 'Physics', icon: '🧲' },
  { label: 'Chemistry', icon: '🧪' },
  { label: 'English', icon: '📖' },
  { label: 'Biology', icon: '🧬' },
  { label: 'Economics', icon: '📈' },
  { label: 'Accounting', icon: '🧮' },
  { label: 'French', icon: '🗣️' },
]

const AI_DEMO = [
  { from: 'them', text: "I don't get quadratic equations." },
  {
    from: 'ai',
    text: 'A quadratic is any equation with an x² in it — think ax² + bx + c = 0. Want a worked example first, or do you want to try one?',
  },
]

const TRUST_ITEMS = [
  { icon: '🔒', title: 'Payments held safely', body: 'Money stays in escrow until a session is actually completed.' },
  { icon: '✅', title: 'Verified tutors', body: 'A visible badge once ID verification clears.' },
  { icon: '💬', title: 'Real-time, always', body: 'Chat, video calls, and notifications the moment something happens.' },
  { icon: '🤖', title: 'AI help, any time', body: 'A study companion for the hours no tutor is online.' },
]

const STEPS = [
  { n: '01', title: 'Create your account', body: 'Sign up as a student or a tutor — Google or email, your call.' },
  { n: '02', title: 'Book a tutor, or ask AI', body: "Message a tutor and book a session, or open Ask AI for something quicker." },
  { n: '03', title: "Track what's sticking", body: 'Quiz scores roll into mastery badges by subject — visible to you, and a parent if you choose.' },
]

// Real stock photography (Unsplash) — this app has no photo upload pipeline of
// its own, so the marketing page borrows real, verified-working photo URLs
// instead of stand-in illustrations.
const PHOTO = {
  filmstrip: [
    {
      src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop&q=70',
      alt: 'Students laughing together while studying with laptops at a coffee shop',
    },
    {
      src: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&h=400&fit=crop&q=70',
      alt: 'A group of students sitting together outdoors',
    },
    {
      src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=400&fit=crop&q=70',
      alt: 'A tutor teaching at a whiteboard in front of a class',
    },
    {
      src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&h=400&fit=crop&q=70',
      alt: 'Graduates throwing their caps in the air',
    },
  ],
  feature1: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&h=220&fit=crop&q=70',
  feature2: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=300&h=220&fit=crop&q=70',
  feature3: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&h=220&fit=crop&q=70',
  cta: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&q=60',
}

export default function Landing() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSearch(e) {
    e.preventDefault()
    navigate('/signup')
  }

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="grid gap-14 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <p className="mb-5 text-sm font-medium text-teal">For students and the tutors who get them</p>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Study out loud,
              <br />
              not alone.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              StudyCult puts you in live conversation with a tutor who knows the
              subject, or a study room full of people cramming the same exam. Ask
              the dumb question. Get the real answer.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-8 flex max-w-lg overflow-hidden rounded-full border border-line bg-paper-raised shadow-[0_10px_30px_-15px_rgba(22,35,61,0.3)]"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you need help with? e.g. Calculus"
                className="w-full bg-transparent px-5 py-3.5 text-sm text-ink outline-none placeholder:text-muted"
              />
              <button type="submit" className="btn btn-primary shrink-0 px-6 py-3.5 text-sm">
                Find a tutor
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink-soft">Trending:</span>
              {subjects.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="rounded-full border border-line bg-paper-raised px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-teal hover:text-teal"
                >
                  {s}
                </button>
              ))}
            </div>

            <p className="mt-6 text-sm text-muted">
              Want to teach instead?{' '}
              <Link to="/signup" className="font-medium text-teal">
                Join as a tutor
              </Link>
            </p>
          </div>

          <TryItWidget navigate={navigate} />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-line bg-paper-raised py-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-base">
                {t.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Photo filmstrip */}
      <section className="border-b border-line py-8">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-4 text-sm font-medium text-ink-soft">Real people, real study sessions</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PHOTO.filmstrip.map((p) => (
              <img
                key={p.src}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                width={400}
                height={400}
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Any subject, any syllabus */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-ink">Any subject. Any syllabus.</h2>
            <p className="mt-2 max-w-md text-muted">
              Not locked to one curriculum — tutors set their own subjects, so the list grows with who joins.
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEMO_SUBJECTS.map((s) => (
            <button
              key={s.label}
              onClick={() => navigate('/tutors')}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-paper-raised px-4 py-6 text-center transition-transform hover:-translate-y-1"
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="text-sm font-medium text-ink">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* AI companion + feature trio */}
      <section className="bg-ink py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-medium text-gold-soft">Ask AI</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-paper sm:text-4xl">
                A tutor when you book one.
                <br />A companion the rest of the time.
              </h2>
              <p className="mt-4 max-w-md text-paper/75">
                Between sessions, Ask AI explains a concept, checks you actually understood it, then hands you
                something to practice — the same way a good tutor would, on call at 1am before an exam.
              </p>
              <Link to="/signup" className="mt-6 inline-block text-sm font-medium text-gold-soft hover:text-gold">
                Try Ask AI after signing up →
              </Link>
            </div>

            <div className="rounded-2xl border border-paper/15 bg-paper-raised p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-teal">A real exchange with Ask AI</p>
              <div className="flex flex-col gap-2">
                {AI_DEMO.map((line, i) => (
                  <div key={i} className={`flex ${line.from === 'them' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2 text-[13px] leading-snug ${
                        line.from === 'them' ? 'bg-ink text-paper' : 'bg-teal-soft text-ink'
                      }`}
                    >
                      {line.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft">
                  Show a worked example
                </span>
                <span className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft">
                  I'll try one
                </span>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            <MiniFeature
              icon="⚡"
              title="Quick Review"
              body="Cramming before an exam? A timed, rapid-fire round pulled from every quiz on the platform."
            />
            <MiniFeature
              icon="🤖"
              title="Ask AI"
              body="A patient study companion that explains, checks understanding, then gives you something to practice."
            />
            <MiniFeature
              icon="📊"
              title="Progress reports"
              body="A read-only link a parent or guardian can open without an account — honest progress, by subject."
            />
          </div>
        </div>
      </section>

      {/* Three things that make it different */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-3xl font-semibold text-ink">Three ways to learn here</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <FeatureCard
            photo={PHOTO.feature1}
            alt="A tutor teaching at a whiteboard"
            title="1:1 tutoring, live"
            body="Message a tutor, book time, and work through problems in a real-time chat — no waiting on email replies."
          />
          <FeatureCard
            photo={PHOTO.feature2}
            alt="A group of students studying together outdoors"
            title="Study rooms with peers"
            body="Group chats organized by subject and exam, so you're never stuck studying the same topic alone at midnight."
          />
          <FeatureCard
            photo={PHOTO.feature3}
            alt="A stack of books"
            title="Quizzes that check retention"
            body="Tutors build short quizzes per topic. Take them solo or race a study room to see who actually gets it."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-paper-raised py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-medium text-teal">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Three steps, then you're studying.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-6">
                <p className="font-display text-2xl font-semibold text-teal">{s.n}</p>
                <h3 className="mt-3 font-display text-lg font-medium text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl px-10 py-16 text-center">
          <img
            src={PHOTO.cta}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/80" />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold text-paper">
              Your next study session starts with one message.
            </h2>
            <Link to="/signup" className="btn btn-gold mt-7 px-8 py-3.5 text-sm">
              Create your account
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// Mirrors the "pick options, see an instant preview" pattern from competitor
// research — but the preview reflects what this platform actually is (a
// marketplace + an AI companion), not a single AI-only flow. Purely a
// client-side preview: the numbers/labels below the fold change instantly,
// nothing here calls the backend until "Start free" is pressed.
function TryItWidget({ navigate }) {
  const [role, setRole] = useState('student')
  const [subject, setSubject] = useState('Mathematics')

  return (
    <div className="rounded-3xl border border-line bg-paper-raised p-5 shadow-[0_20px_50px_-20px_rgba(22,35,61,0.35)] sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">Try it now</p>
          <p className="mt-1 font-display text-lg font-medium text-ink">What do you need help with?</p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-soft px-2.5 py-1 text-[10px] font-medium text-teal">
          Interactive demo
        </span>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
        Example: 128 learners active right now · Ama is reviewing {subject}
      </p>

      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">I am a</p>
      <div className="mt-2 flex gap-2">
        {[
          { id: 'student', label: 'Student' },
          { id: 'tutor', label: 'Tutor' },
        ].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRole(r.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              role === r.id ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink/30'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Pick a subject</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DEMO_SUBJECTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setSubject(s.label)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              subject === s.label ? 'border-teal bg-teal-soft text-ink' : 'border-line text-ink-soft hover:border-teal/50'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-line p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">You could</p>
        <p className="mt-1 font-display text-base font-medium text-ink">
          {role === 'student' ? `Find a ${subject} tutor, or ask AI right now` : `Build a ${subject} quiz for your students`}
        </p>
      </div>

      <button type="button" onClick={() => navigate('/signup')} className="btn btn-primary mt-5 w-full px-6 py-3 text-sm">
        Start free — no card needed →
      </button>
      <p className="mt-2 text-center text-xs text-muted">Free to join · under a minute to get set up</p>
    </div>
  )
}

function MiniFeature({ icon, title, body }) {
  return (
    <div className="rounded-2xl border border-paper/15 bg-[rgba(255,255,255,0.06)] p-6 backdrop-blur">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 font-display text-lg font-medium text-paper">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-paper/70">{body}</p>
    </div>
  )
}

function FeatureCard({ photo, alt, title, body }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
      <img src={photo} alt={alt} loading="lazy" width={300} height={220} className="h-36 w-full object-cover" />
      <div className="p-5">
        <h3 className="font-display text-xl font-medium text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  )
}
