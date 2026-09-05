const HIGH_CONTRAST_KEY = 'studycult:high-contrast'

export function getStoredHighContrast() {
  try {
    return localStorage.getItem(HIGH_CONTRAST_KEY) === '1'
  } catch {
    return false
  }
}

export function applyHighContrast(on) {
  document.documentElement.classList.toggle('high-contrast', on)
  try {
    localStorage.setItem(HIGH_CONTRAST_KEY, on ? '1' : '0')
  } catch {
    // localStorage unavailable (private browsing, etc.) — the toggle still
    // works for the current page load, it just won't persist.
  }
}
