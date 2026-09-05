const THEME_KEY = 'studycult:theme'

// null means "no explicit choice" — the OS/browser preference decides, via
// the prefers-color-scheme media query in index.css.
export function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function applyStoredThemeOnLoad() {
  const stored = getStoredTheme()
  if (stored) document.documentElement.dataset.theme = stored
}

export function getEffectiveTheme() {
  const stamped = document.documentElement.dataset.theme
  if (stamped === 'light' || stamped === 'dark') return stamped
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // localStorage unavailable — the toggle still works for this page load.
  }
}
