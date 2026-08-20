// mdmc.co.jp → mdmc.co/ja proxy.
// Runs on the mdmc.co.jp zone (route: mdmc.co.jp/*). HTML routes are fetched
// from the ja tree on the canonical origin; assets (anything with a file
// extension) are fetched verbatim, since the ja pages reference the same
// /_astro/ and /fonts/ URLs as the en tree.

const ORIGIN = 'https://mdmc.co'

// co.jp gets its own robots.txt: no Sitemap line for now — @astrojs/sitemap
// is single-site and emits mdmc.co URLs, so the origin sitemap must not be
// exposed under this host (see docs/JA-DOMAIN.md).
const ROBOTS = 'User-agent: *\nAllow: /\n'

// Decide what to do with an incoming co.jp pathname.
// Returns one of:
//   { kind: 'robots' }
//   { kind: 'none' }                    — 404 (sitemap files, see above)
//   { kind: 'redirect', to: string }    — 301 within co.jp
//   { kind: 'asset', to: string }       — fetch ORIGIN + to verbatim
//   { kind: 'html', to: string }        — fetch ORIGIN + to (ja tree)
export function mapPath(pathname) {
  if (pathname === '/robots.txt') return { kind: 'robots' }
  if (pathname === '/sitemap-index.xml' || /^\/sitemap-\d+\.xml$/.test(pathname)) {
    return { kind: 'none' }
  }
  // A /ja prefix on co.jp would double up — send visitors to the bare path.
  if (pathname === '/ja' || pathname === '/ja/' || pathname.startsWith('/ja/')) {
    const bare = pathname.replace(/^\/ja\/?/, '/')
    return { kind: 'redirect', to: bare }
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  if (lastSegment.includes('.')) return { kind: 'asset', to: pathname }
  // Directory-style URLs: normalize to the trailing slash GitHub Pages
  // serves, so the origin's host-revealing 301 never reaches the visitor.
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  return { kind: 'html', to: '/ja' + (pathname === '/' ? '/' : pathname) }
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const mapped = mapPath(url.pathname)

    switch (mapped.kind) {
      case 'robots':
        return new Response(ROBOTS, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      case 'none':
        return new Response('Not found', { status: 404 })
      case 'redirect':
        return Response.redirect(`${url.origin}${mapped.to}${url.search}`, 301)
      default: {
        const originRequest = new Request(`${ORIGIN}${mapped.to}${url.search}`, request)
        // Marker for the mdmc.co/ja/* → co.jp redirect rule to exclude the
        // Worker's own fetches (docs/JA-DOMAIN.md §6).
        originRequest.headers.set('x-mdmc-ja-proxy', '1')
        // mapPath normalizes every path the origin would redirect, so a 3xx
        // here means misconfiguration (e.g. the §6 rule matching this fetch)
        // — fail loud rather than bounce visitors around a loop.
        const response = await fetch(originRequest, { redirect: 'manual' })
        if (response.status >= 300 && response.status < 400) {
          return new Response('ja-proxy: unexpected origin redirect', { status: 502 })
        }
        return response
      }
    }
  },
}
