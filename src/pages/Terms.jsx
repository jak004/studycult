export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-teal">Legal</p>
      <h1 className="mt-1 font-display text-4xl font-semibold text-ink">Terms & Conditions</h1>
      <p className="mt-2 text-sm text-muted">
        Draft placeholder text — this has not been reviewed by a lawyer and should not be treated as a real,
        binding policy until it has been.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-ink-soft">
        <Section title="1. Accepting these terms">
          By creating an account, booking a session, or using StudyCult in any way, you agree to these Terms and
          our Privacy Policy.
        </Section>
        <Section title="2. Accounts">
          You're responsible for keeping your login credentials secure and for anything that happens under your
          account. Tell us if you believe your account has been compromised.
        </Section>
        <Section title="3. Tutors and students">
          Tutors are independent — StudyCult connects people, it doesn't employ tutors or guarantee the quality of
          any session. Sessions, quizzes, and study rooms should stay respectful; harassment, hate speech, and
          scams are not tolerated and may result in account suspension.
        </Section>
        <Section title="4. Payments">
          Session payments are processed by Paystack. StudyCult holds a student's payment until the tutor marks a
          session completed, then releases the tutor's share (minus a platform fee) via a separate payout.
          Refund and dispute handling isn't automated yet — contact support for a manual review.
        </Section>
        <Section title="5. Content you upload">
          You keep ownership of anything you upload (quiz content, verification documents, profile photos, chat
          attachments). You're responsible for having the rights to upload it, and for its accuracy.
        </Section>
        <Section title="6. Termination">
          You can delete your account at any time. We may suspend or terminate accounts that violate these terms.
        </Section>
        <Section title="7. Liability">
          StudyCult is provided "as is." We aren't liable for the conduct of tutors or students, or for outcomes
          of any tutoring session or quiz result.
        </Section>
        <Section title="8. Changes">
          We may update these terms as the platform changes. Continued use after an update means you accept the
          new terms.
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
