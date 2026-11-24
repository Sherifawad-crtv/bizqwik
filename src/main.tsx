import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system/tokens/tokens.css'
import './design-system/styles.css'
import './app/app.css'
import App from './app/App.tsx'
import { startAutoUpdate } from './app/autoUpdate'
import { installNativeFeel } from './shared/platform/native'
import { startAnalytics } from './shared/platform/analytics'

// The camera (coach QR scanning) only works on a secure, top-level page. If the
// app is ever reached over plain http, or framed by another site (e.g. a domain
// forwarded "with masking"), move to the real https page first.
function ensureSecureTopLevel(): boolean {
  const { protocol, hostname, host, pathname, search, hash } = window.location
  const local = hostname === 'localhost' || hostname === '127.0.0.1'
  if (protocol === 'http:' && !local) {
    window.location.replace(`https://${host}${pathname}${search}${hash}`)
    return false
  }
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = window.location.href
      return false
    }
  } catch {
    // A cross-origin parent blocks access; nothing more we can do from here.
  }
  return true
}

if (ensureSecureTopLevel()) {
  installNativeFeel()
  startAutoUpdate()
  startAnalytics()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
