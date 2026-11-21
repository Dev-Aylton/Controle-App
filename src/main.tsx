import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './app/App.tsx'
import { prepareOAuthCallbackUrl } from './lib/supabase'
import { ErrorBoundary } from './components/ErrorBoundary'

prepareOAuthCallbackUrl()

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister())
  })
  if ('caches' in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
