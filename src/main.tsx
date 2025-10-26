import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { RoleProvider } from './contexts/RoleContext'
import './index.css'
import { logUIError } from '@/services/errorLogging'

// DEV safeguard: unregister any previously installed Service Workers (e.g., Workbox)
// to prevent white screen caused by SW intercepting requests during local development.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length) {
      console.info('[DEV] Unregistering existing Service Workers to avoid Workbox intercepts...')
      registrations.forEach((reg) => reg.unregister())
      // Clear caches that may hold outdated assets from other ports
      if ('caches' in globalThis) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
      }
    }
  }).catch(() => {
    // ignore
  })
}

// Global UI error hooks: forward window errors and unhandled rejections to Supabase via logUIError
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      const err = event.error instanceof Error ? event.error : new Error(event.message || 'Window error')
      logUIError(err).catch(() => {})
    } catch {
      // no-op
    }
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    try {
      const reason: any = event.reason
      let err: Error
      if (reason instanceof Error) {
        err = reason
      } else if (typeof reason === 'string') {
        err = new Error(reason)
      } else {
        err = new Error('Unhandled rejection: ' + (reason ? JSON.stringify(reason) : 'unknown'))
      }
      logUIError(err).catch(() => {})
    } catch {
      // no-op
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </React.StrictMode>,
)