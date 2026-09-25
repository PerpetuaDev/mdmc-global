// Pure logic for the hosting-migration URL gate (scripts/url-gate.mjs).
// A gate entry is one URL as a visitor reaches it today; its fingerprint is
// what must not change across the move: status, redirect target, <title>,
// canonical (and the body, for plain text like robots.txt).

export function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

const pathOf = (u) => {
  const x = new URL(u)
  return x.pathname + x.search
}

export function entryKey(entry) {
  return `${entry.host ?? entry.site} ${entry.path}`
}

// coLocs: mdmc.co's sitemap (the global en tree). cojpLocs: sitemap-cojp.xml
// (the co.jp ja tree). Together they imply all four built trees and which
// host serves each today (GitHub Pages serves /en and /jp on mdmc.co too).
export function buildEntries(coLocs, cojpLocs) {
  const entries = []
  const add = (site, path, extra = {}) => entries.push({ site, path, ...extra })
  for (const p of coLocs.map(pathOf)) {
    add('global', p)
    add('global', '/en' + p)
    add('jp', '/en' + p)
  }
  for (const q of cojpLocs.map(pathOf)) {
    add('jp', q)
    add('global', '/ja' + q)
    add('global', '/jp' + q)
  }
  for (const p of ['/about', '/nope/', '/robots.txt', '/sitemap-index.xml', '/sitemap-cojp.xml', '/favicon.svg', '/work?utm_source=gate']) {
    add('global', p)
  }
  for (const p of ['/about', '/ja/about/', '/jp/about/', '/nope/', '/robots.txt', '/sitemap-cojp.xml', '/sitemap-index.xml', '/favicon.svg']) {
    add('jp', p)
  }
  add('global', '/about/', { host: 'www.mdmc.co' })

  const seen = new Set()
  return entries.filter((e) => {
    const k = entryKey(e)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const TYPE_ALIASES = { 'text/xml': 'application/xml' }

export function fingerprint(status, getHeader, body, requestOrigin) {
  const fp = { status }
  const location = getHeader('location')
  if (location) {
    const l = new URL(location, requestOrigin)
    fp.location = l.origin === requestOrigin ? l.pathname + l.search : l.href
  }
  if (status >= 300 && status < 400) return fp
  const raw = (getHeader('content-type') ?? '').split(';')[0].trim().toLowerCase()
  fp.type = TYPE_ALIASES[raw] ?? raw
  if (fp.type === 'text/html' && body) {
    fp.title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? null
    fp.canonical = body.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null
  }
  if (fp.type === 'text/plain' && body) fp.body = body.trim()
  return fp
}

export function diffFingerprints(baseline, current) {
  const out = []
  for (const [key, expected] of Object.entries(baseline)) {
    const actual = current[key]
    if (!actual) {
      out.push({ key, field: 'missing', expected: 'present', actual: 'absent' })
      continue
    }
    for (const field of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      if (expected[field] !== actual[field]) out.push({ key, field, expected: expected[field], actual: actual[field] })
    }
  }
  return out
}
