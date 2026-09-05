import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'
import AuthLayout from '../components/AuthLayout'
import { checkPassword } from '../lib/password'
import { trackEvent } from '../lib/analytics'

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referredBy = searchParams.get('ref')
  const [role, setRole] = useState('student')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [photoConsent, setPhotoConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const captchaContainerRef = useRef(null)
  const captchaWidgetIdRef = useRef(null)

  const passwordChecks = checkPassword(password)
  const passwordValid = passwordChecks.length && passwordChecks.variety && passwordChecks.noRepeats

  // hCaptcha's script loads once via a plain <script> tag in index.html;
  // this waits for it rather than adding an npm dependency, and uses the
  // explicit render API since the widget's container only exists once React
  // mounts this route — hCaptcha's implicit auto-render can't see it in time.
  useEffect(() => {
    if (!HCAPTCHA_SITE_KEY) return
    let cancelled = false
    function tryRender() {
      if (cancelled) return
      if (window.hcaptcha && captchaContainerRef.current && captchaWidgetIdRef.current === null) {
        captchaWidgetIdRef.current = window.hcaptcha.render(captchaContainerRef.current, {
          sitekey: HCAPTCHA_SITE_KEY,
        })
      } else if (!window.hcaptcha) {
        setTimeout(tryRender, 200)
      }
    }
    tryRender()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passwordValid || !agreedToTerms) return
    setError('')

    let captchaToken
    if (HCAPTCHA_SITE_KEY) {
      captchaToken = window.hcaptcha?.getResponse(captchaWidgetIdRef.current)
      if (!captchaToken) {
        setError('Please complete the captcha.')
        return
      }
    }

    setBusy(true)
    const { data, error } = await signUp({
      email,
      password,
      firstName,
      middleName,
      lastName,
      role,
      photoConsent,
      referredBy,
      captchaToken,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      window.hcaptcha?.reset(captchaWidgetIdRef.current)
      return
    }
    trackEvent('Signup', { role })
    if (data?.session) {
      navigate('/dashboard')
    } else {
      setConfirmSent(true)
    }
  }

  return (
    <AuthLayout
      eyebrow="Join StudyCult"
      title="Create your free account"
      subtitle="Book a tutor, join a study room, or ask AI — whichever gets you unstuck fastest."
    >
      {confirmSent ? (
        <div className="text-center">
          <p className="text-sm text-muted">
            We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Confirm it, then
            log in to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <RoleOption
              current={role}
              value="student"
              onSelect={setRole}
              label="I'm a student"
              hint="Tutors, study rooms & AI help"
            />
            <RoleOption
              current={role}
              value="tutor"
              onSelect={setRole}
              label="I'm a tutor"
              hint="Teach live, get paid safely"
            />
          </div>

          <div className="mt-6">
            <GoogleButton label="Sign up with Google" />
            <p className="mt-1.5 text-center text-xs text-muted">
              Google sign-ups pick their role on the next screen. By continuing, you agree to our{' '}
              <Link to="/terms" target="_blank" className="underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input"
                  placeholder="Ama"
                />
              </Field>
              <Field label="Surname">
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input"
                  placeholder="Owusu"
                />
              </Field>
            </div>
            <Field label="Middle name (optional)">
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="input"
                placeholder="Serwaa"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="At least 8 characters"
              />
            </Field>

            {password && (
              <div className="rounded-xl border border-line bg-paper p-3">
                <p className="mb-1.5 text-xs font-medium text-ink-soft">Your password must contain:</p>
                <ul className="flex flex-col gap-1">
                  <ChecklistItem passed={passwordChecks.length}>At least 8 characters</ChecklistItem>
                  <ChecklistItem passed={passwordChecks.variety}>
                    At least 3 of: lowercase, uppercase, numbers, symbols
                  </ChecklistItem>
                  <ChecklistItem passed={passwordChecks.noRepeats}>
                    No more than 2 identical characters in a row
                  </ChecklistItem>
                </ul>
              </div>
            )}

            {HCAPTCHA_SITE_KEY && <div ref={captchaContainerRef} />}

            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-teal underline">
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-teal underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {role === 'tutor' && (
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={photoConsent}
                  onChange={(e) => setPhotoConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I consent to StudyCult using my profile photo for promotional purposes (optional).</span>
              </label>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={busy || !passwordValid || !agreedToTerms} className="btn btn-primary mt-2 px-6 py-3 text-sm">
              {busy ? 'Creating your account…' : 'Create account'}
            </button>
            <p className="text-center text-xs text-muted">Free to join · no card required</p>
          </form>

          <p className="mt-6 text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-teal">
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

function ChecklistItem({ passed, children }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${passed ? 'text-teal' : 'text-muted'}`}>
      <span>{passed ? '✓' : '○'}</span>
      {children}
    </li>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

function RoleOption({ current, value, onSelect, label, hint }) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? 'border-teal bg-teal-soft' : 'border-line bg-paper-raised hover:border-ink/30'
      }`}
    >
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </button>
  )
}
