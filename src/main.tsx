import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
