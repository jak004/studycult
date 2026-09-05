import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import { getStoredHighContrast, applyHighContrast } from '../lib/accessibility'
import { getEffectiveTheme, applyTheme } from '../lib/theme'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [highContrast, setHighContrast] = useState(getStoredHighContrast)
  const [theme, setTheme] = useState(getEffectiveTheme)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Closes the mobile menu on every navigation, including a link click
  // inside it (the link itself also closes it directly, but this covers any
  // other way the route could change while it's open).
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  function toggleHighContrast() {
    const next = !highContrast
    applyHighContrast(next)
    setHighContrast(next)
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  // Browsing/booking other tutors doesn't apply to a tutor account — they
  // manage their own listing from Profile instead.
  const links =
    profile?.role === 'tutor'
      ? [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/messages', label: 'Messages' },
          { to: '/courses', label: 'Courses' },
          { to: '/quizzes', label: 'Quizzes' },
          { to: '/ask-ai', label: 'Ask AI' },
        ]
      : [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/tutors', label: 'Tutors' },
          { to: '/peers', label: 'Peers' },
          { to: '/messages', label: 'Messages' },
          { to: '/courses', label: 'Courses' },
          { to: '/quizzes', label: 'Quizzes' },
          { to: '/ask-ai', label: 'Ask AI' },
        ]

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_28px_-24px_rgba(22,35,61,0.4)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to={session ? '/dashboard' : '/'} className="font-display text-xl font-semibold tracking-tight text-ink">
          StudyCult
        </Link>

        {session && (
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  location.pathname === l.to
                    ? 'bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(22,35,61,0.55)]'
                    : 'text-ink-soft hover:bg-teal-soft'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  location.pathname === '/admin'
                    ? 'bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(22,35,61,0.55)]'
                    : 'text-ink-soft hover:bg-teal-soft'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm text-ink-soft hover:border-ink/30 sm:flex"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            onClick={toggleHighContrast}
            aria-pressed={highContrast}
            title={highContrast ? 'Turn off high-contrast mode' : 'Turn on high-contrast mode (for low vision/readability)'}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold sm:flex ${
              highContrast ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink/30'
            }`}
          >
            A
          </button>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          {session ? (
            <>
              <NotificationBell userId={profile?.id} />
              <Link
                to="/profile"
                className="hidden items-center gap-2 rounded-full border border-line bg-paper-raised px-3 py-1.5 text-sm text-ink-soft sm:flex"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span>{profile?.avatar_emoji || '🎓'}</span>
                )}
                <span>{profile?.full_name || 'Profile'}</span>
              </Link>
              <button onClick={handleSignOut} className="btn btn-danger-outline hidden px-4 py-2 text-sm sm:inline-flex">
                Sign out
              </button>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft md:hidden"
              >
                {mobileOpen ? '✕' : '☰'}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-ink-soft hover:text-ink">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary px-4 py-2 text-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {session && mobileOpen && (
        <div className="border-t border-line bg-paper px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                  location.pathname === l.to ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                  location.pathname === '/admin' ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
                }`}
              >
                Admin
              </Link>
            )}
            <Link
              to="/profile"
              className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                location.pathname === '/profile' ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-teal-soft'
              }`}
            >
              Profile
            </Link>
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <button
              onClick={toggleTheme}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-soft"
            >
              {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
            </button>
            <button
              onClick={toggleHighContrast}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm ${
                highContrast ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft'
              }`}
            >
              High contrast
            </button>
          </div>

          <button onClick={handleSignOut} className="btn btn-danger-outline mt-3 w-full px-4 py-2 text-sm">
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
