import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import Button from './ui/Button'
import { SearchIcon, MenuIcon, CloseIcon, SunIcon, MoonIcon } from './ui/icons'
import { getStoredHighContrast, applyHighContrast } from '../lib/accessibility'
import { getEffectiveTheme, applyTheme } from '../lib/theme'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [highContrast, setHighContrast] = useState(getStoredHighContrast)
  const [theme, setTheme] = useState(getEffectiveTheme)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

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

  function submitSearch(e) {
    e.preventDefault()
    const q = searchInput.trim()
    navigate(q ? `/tutors?q=${encodeURIComponent(q)}` : '/tutors')
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
    <header className="sticky top-0 z-30 border-b border-line bg-paper-raised">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link to={session ? '/dashboard' : '/'} className="shrink-0 text-xl font-black tracking-tight text-ink">
          StudyCult
        </Link>

        {session && profile?.role !== 'tutor' && (
          <form onSubmit={submitSearch} className="hidden max-w-md flex-1 md:block">
            <label className="relative block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search tutors, subjects, exam prep…"
                aria-label="Search tutors"
                className="input w-full py-2 pl-9"
              />
            </label>
          </form>
        )}

        {session && (
          <nav className="ml-auto hidden shrink-0 gap-5 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`border-b-2 py-1 text-sm font-bold transition-colors ${
                  location.pathname === l.to
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                className={`border-b-2 py-1 text-sm font-bold transition-colors ${
                  location.pathname === '/admin'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        )}

        <div className={`flex shrink-0 items-center gap-2 ${session ? '' : 'ml-auto'}`}>
          <button
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-ink-soft hover:border-ink/30 sm:flex"
          >
            {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleHighContrast}
            aria-pressed={highContrast}
            title={highContrast ? 'Turn off high-contrast mode' : 'Turn on high-contrast mode (for low vision/readability)'}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded border text-xs font-bold sm:flex ${
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
                className="hidden items-center gap-2 rounded border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-ink/30 sm:flex"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {(profile?.full_name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{profile?.full_name || 'Profile'}</span>
              </Link>
              <Button onClick={handleSignOut} variant="danger" size="sm" className="hidden sm:inline-flex">
                Sign out
              </Button>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-ink-soft md:hidden"
              >
                {mobileOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-bold text-ink-soft hover:text-ink">
                Log in
              </Link>
              <Button as={Link} to="/signup" size="sm">
                Get started
              </Button>
            </>
          )}
        </div>
      </div>

      {session && mobileOpen && (
        <div className="border-t border-line bg-paper-raised px-6 py-4 md:hidden">
          {profile?.role !== 'tutor' && (
            <form onSubmit={submitSearch} className="mb-3">
              <label className="relative block">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search tutors, subjects…"
                  aria-label="Search tutors"
                  className="input w-full py-2 pl-9"
                />
              </label>
            </form>
          )}
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded px-3 py-2.5 text-sm font-bold ${
                  location.pathname === l.to ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-paper'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                className={`rounded px-3 py-2.5 text-sm font-bold ${
                  location.pathname === '/admin' ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-paper'
                }`}
              >
                Admin
              </Link>
            )}
            <Link
              to="/profile"
              className={`rounded px-3 py-2.5 text-sm font-bold ${
                location.pathname === '/profile' ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-paper'
              }`}
            >
              Profile
            </Link>
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <button
              onClick={toggleTheme}
              className="flex flex-1 items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm text-ink-soft"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={toggleHighContrast}
              className={`flex flex-1 items-center justify-center gap-2 rounded border px-3 py-2 text-sm ${
                highContrast ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft'
              }`}
            >
              High contrast
            </button>
          </div>

          <Button onClick={handleSignOut} variant="danger" className="mt-3 w-full">
            Sign out
          </Button>
        </div>
      )}
    </header>
  )
}
