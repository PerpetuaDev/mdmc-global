import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

// Public sitekey for the mdmc.co Turnstile widget (Managed mode). The
// matching secret is TURNSTILE_SECRET_KEY on the Strapi side.
const SITE_KEY = '0x4AAAAAADx-FIVqP87bxM04'

// The api.js script is loaded once, on first form render, so the widget
// costs nothing on pages without forms.
let scriptPromise = null
function loadScript() {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

// Cloudflare Turnstile widget. Reports the token via onToken (null when it
// expires or errors). Tokens are single-use: after a failed submit the form
// must call ref.reset() to run the challenge again.
export const Turnstile = forwardRef(function Turnstile({ onToken, locale = 'en' }, ref) {
  const box = useRef(null)
  const widgetId = useRef(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current != null) window.turnstile?.reset(widgetId.current)
      onTokenRef.current(null)
    },
  }))

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !box.current) return
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          language: locale,
          theme: 'light',
          size: 'flexible',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => {}) // script blocked (adblock etc.) — server fails the submit instead
    return () => {
      cancelled = true
      if (widgetId.current != null) {
        window.turnstile?.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [locale])

  return <div className="turnstile-box" ref={box} />
})
