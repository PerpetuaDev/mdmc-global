// mdmc.co.jp proxy (2026-08-21 matrix model — see the language-region-matrix
// plan doc). Runs on the mdmc.co.jp zone (route: mdmc.co.jp/*).
//   co.jp/<path>     → origin /jp/<path>  (Japanese, co.jp's default)
//   co.jp/en/<path>  → origin /en/<path>  (English on the Japan domain)
// Assets (anything with a file extension) are fetched verbatim, since every
// tree references the same /_astro/ and /fonts/ URLs.

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
  // Origin-tree prefixes that must not appear on co.jp itself: /ja belongs
  // to mdmc.co's Japanese surface and /jp is where THIS host's root tree is
  // built — either one on co.jp would double up. Send visitors to the bare
  // path (which maps back to the /jp tree below).
  if (pathname === '/ja' || pathname === '/ja/' || pathname.startsWith('/ja/')) {
    const bare = pathname.replace(/^\/ja\/?/, '/')
    return { kind: 'redirect', to: bare }
  }
  if (pathname === '/jp' || pathname === '/jp/' || pathname.startsWith('/jp/')) {
    const bare = pathname.replace(/^\/jp\/?/, '/')
    return { kind: 'redirect', to: bare }
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  if (lastSegment.includes('.')) return { kind: 'asset', to: pathname }
  // Directory-style URLs: normalize to the trailing slash GitHub Pages
  // serves, so the origin's host-revealing 301 never reaches the visitor.
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  // English on the Japan domain: /en/* is built at the origin under the same
  // prefix, so it passes through unchanged.
  if (pathname === '/en/' || pathname.startsWith('/en/')) {
    return { kind: 'html', to: pathname }
  }
  return { kind: 'html', to: '/jp' + (pathname === '/' ? '/' : pathname) }
}

// Exported (alongside the default { fetch } export Cloudflare invokes) so
// tests can call the handler directly with a stubbed global fetch, without
// needing a Miniflare/Workers runtime.
export async function handleRequest(request) {
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
      // mapPath normalizes every path the origin would redirect, so a
      // *followable* 3xx here (one with a Location) means misconfiguration
      // (e.g. the §6 rule matching this fetch) — fail loud rather than
      // bounce visitors around a loop.
      //
      // 304 Not Modified is excluded even though it's in the 3xx range: we
      // forward the visitor's conditional headers (If-None-Match /
      // If-Modified-Since) onto the origin request above, so a revalidating
      // repeat visitor legitimately gets a Location-less 304 back — that's
      // a normal passthrough response, not an unexpected redirect.
      const response = await fetch(originRequest, { redirect: 'manual' })
      const isUnexpectedRedirect =
        response.status >= 300 &&
        response.status < 400 &&
        response.status !== 304 &&
        response.headers.has('location')
      if (isUnexpectedRedirect) {
        return new Response('ja-proxy: unexpected origin redirect', { status: 502 })
      }
      return response
    }
  }
}

export default {
  fetch: (request) => handleRequest(request),
}
