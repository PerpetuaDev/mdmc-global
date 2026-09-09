// GA4 event helper.
//
// The gtag snippet in Base.astro only installs itself on the real hostnames,
// so `window.gtag` is undefined on localhost and in preview builds — which
// means every call here is a no-op off production without needing its own
// environment check. That is deliberate: dev traffic must never reach the
// property.
//
// The overriding rule is that analytics may NEVER break the thing it is
// measuring. These fire from inside form submit handlers, so a missing tag, a
// blocked script, a thrown getter — anything — must be swallowed. A lost
// event is a rounding error; a lost enquiry is a lost client.

export function track(name, params = {}) {
  try {
    const gtag = typeof window !== 'undefined' ? window.gtag : undefined
    if (typeof gtag !== 'function') return false
    // GA4 rejects undefined/null param values inconsistently; drop them so
    // the payload is always clean.
    const clean = {}
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    }
    gtag('event', name, clean)
    return true
  } catch {
    return false
  }
}

// The page's own (site, locale, region) context, so a conversion can be read
// per market rather than as one undifferentiated total — the whole point of
// running Global and Japan as separate strategies.
//
// Region is the stored client preference the header manages (mdmc.region);
// on co.jp the domain IS the region, so it is fixed to jp there.
export function marketContext() {
  const ctx = {}
  try {
    const site = document.documentElement.dataset.site || undefined
    ctx.site = site
    ctx.locale = document.documentElement.lang || undefined
    ctx.region = site === 'cojp' ? 'jp' : localStorage.getItem('mdmc.region') || 'nz'
  } catch {
    // A blocked localStorage must not cost us the event itself.
  }
  return ctx
}
