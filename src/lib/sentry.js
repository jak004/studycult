import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

// Safe to call even with no DSN configured (e.g. local dev) — Sentry just
// never activates, and every capture call below becomes a silent no-op.
export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
  })
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
