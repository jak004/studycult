import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { initSentry, SentryErrorBoundary } from './lib/sentry.js'
import ErrorFallback from './components/ErrorFallback.jsx'
import { getStoredHighContrast } from './lib/accessibility.js'
import { applyStoredThemeOnLoad } from './lib/theme.js'

initSentry()

// Applied before the first paint so a returning visitor who enabled high
// contrast, or picked light/dark explicitly, doesn't see a flash of the
// wrong theme.
if (getStoredHighContrast()) document.documentElement.classList.add('high-contrast')
applyStoredThemeOnLoad()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SentryErrorBoundary fallback={ErrorFallback}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </SentryErrorBoundary>
  </StrictMode>,
)
