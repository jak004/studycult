export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-teal">Legal</p>
      <h1 className="mt-1 font-display text-4xl font-semibold text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">
        Draft placeholder text — this has not been reviewed by a lawyer and should not be treated as a real,
        binding policy until it has been.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-ink-soft">
        <Section title="What we collect">
          Account info (name, email, role), profile details you add (bio, subjects, hourly rate, avatar),
          messages and study room activity, quiz results, session bookings, and — for tutors — payout details and
          verification documents.
        </Section>
        <Section title="How it's used">
          To run the core features: matching students with tutors, real-time chat, scheduling, quizzes, payments,
          and notifications. We also use aggregated, non-identifying activity data for basic product analytics.
        </Section>
        <Section title="Who can see what">
          Enforced at the database level, not just hidden in the UI: only members of a conversation can read its
          messages, only session participants can review each other, and verification documents are visible only
          to you and admin reviewers.
        </Section>
        <Section title="Third parties">
          Supabase (hosting, database, auth), Paystack (payments), SendGrid (email), Daily.co (video calls),
          OpenAI (quiz generation from uploaded slides/resumes, and optional message moderation), Sentry (error
          tracking), and Plausible (cookieless analytics — no personal data, no tracking cookies).
        </Section>
        <Section title="Your choices">
          You can opt out of individual notification types from your account, request account deletion, and
          (for tutors) choose whether your profile photo may be used in promotional material — separately from
          agreeing to these terms.
        </Section>
        <Section title="Data retention">
          Data is kept while your account is active. Deleting your account removes your profile and cascades to
          related records (messages, sessions, reviews) tied to it.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1.5">{children}</p>
    </div>
  )
}
