import CoverArt from './CoverArt'

const FEATURES = [
  { icon: '💬', title: 'Live 1:1 tutoring', body: 'Message a tutor in real time and actually get unstuck.' },
  { icon: '🧑‍🤝‍🧑', title: 'Study rooms', body: 'Join peers cramming the same exam, any time of night.' },
  { icon: '🤖', title: 'AI help on call', body: 'Ask AI explains, checks your understanding, then gives you practice.' },
]

const TRUST_BADGES = ['🔒 Payments held safely', '✅ Verified tutors', '🤖 AI help included']

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <div className="grid overflow-hidden rounded-3xl border border-line bg-paper-raised shadow-[0_30px_80px_-40px_rgba(22,35,61,0.35)] md:grid-cols-2">
        <div className="relative hidden md:block">
          <CoverArt seed="studycult-auth" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-ink/45" />
          <div className="relative flex h-full flex-col justify-between p-10 text-paper">
            <p className="font-display text-2xl font-semibold">StudyCult</p>
            <div>
              <p className="font-display text-3xl font-semibold leading-tight">Study out loud, not alone.</p>
              <div className="mt-8 flex flex-col gap-5">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper/15 text-lg">
                      {f.icon}
                    </span>
                    <div>
                      <p className="font-medium">{f.title}</p>
                      <p className="text-sm text-paper/75">{f.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRUST_BADGES.map((badge) => (
                <span key={badge} className="rounded-full bg-paper/15 px-3 py-1 text-xs font-medium text-paper/90">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
          <div className="mx-auto w-full max-w-sm">
            {eyebrow && <p className="text-sm font-medium text-teal">{eyebrow}</p>}
            <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
