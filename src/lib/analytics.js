// Thin wrapper over Plausible's window.plausible() — safe to call even when
// the script hasn't loaded (blocked, offline, or VITE_PLAUSIBLE_DOMAIN unset
// locally), since it's a no-op rather than an error in that case.
export function trackEvent(name, props) {
  window.plausible?.(name, props ? { props } : undefined)
}
