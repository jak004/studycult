export default function ErrorFallback({ resetError }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <p className="font-display text-2xl font-semibold text-ink">Something went wrong.</p>
      <p className="max-w-sm text-sm text-muted">
        The error's been reported. Try reloading — if it keeps happening, let us know what you were doing.
      </p>
      <button
        onClick={resetError}
        className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
      >
        Try again
      </button>
    </div>
  )
}
