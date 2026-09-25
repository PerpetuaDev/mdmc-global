// mdmc-site — serves every MDMC domain from one Worker with static assets
// (multi-site spec, 2026-09-25, Phase 1). Phase 1 reproduces today's hosting
// exactly: mdmc.co is GitHub Pages' identity mapping of dist/, and mdmc.co.jp
// is mdmc-ja-proxy's mapping (co.jp/* → /jp/*, co.jp/en/* → /en/*) reading
// the assets binding instead of fetching the origin. See docs/HOSTING.md.

export const HOSTS = { 'mdmc.co': 'global', 'mdmc.co.jp': 'jp' }
const SITE_IDS = new Set(Object.values(HOSTS))
const PREVIEW_COOKIE = 'mdmc_site'

// Preview hosts may pick a site with ?site= (sticky via cookie) so every site
// can be checked before cutover. Production hosts never honour it.
export function isPreviewHost(hostname) {
  return hostname.endsWith('.workers.dev') || hostname === 'localhost' || hostname === '127.0.0.1'
}

export function resolveSite(hostname, cookieHeader) {
  const site = HOSTS[hostname]
  if (site) return site
  if (isPreviewHost(hostname) && cookieHeader) {
    const m = new RegExp(`(?:^|;\\s*)${PREVIEW_COOKIE}=([a-z]+)`).exec(cookieHeader)
    if (m && SITE_IDS.has(m[1])) return m[1]
  }
  return 'global'
}

function isFile(pathname) {
  return pathname.slice(pathname.lastIndexOf('/') + 1).includes('.')
}

function hasPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

// Today's mdmc.co: GitHub Pages serves dist/ as-is.
function mapGlobal(pathname) {
  if (isFile(pathname)) return { kind: 'asset', to: pathname }
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  return { kind: 'html', to: pathname }
}

// Today's mdmc.co.jp: ported from workers/ja-proxy/worker.js mapPath.
function mapJp(pathname) {
  if (pathname === '/robots.txt') return { kind: 'robots' }
  // @astrojs/sitemap describes mdmc.co only; co.jp's own is sitemap-cojp.xml.
  if (pathname === '/sitemap-index.xml' || /^\/sitemap-\d+\.xml$/.test(pathname)) return { kind: 'none' }
  // /ja is mdmc.co's Japanese surface and /jp is where this host's root tree
  // is built — either on co.jp would double up, so bounce to the bare path.
  for (const prefix of ['/ja', '/jp']) {
    if (hasPrefix(pathname, prefix)) return { kind: 'redirect', to: pathname.slice(prefix.length) || '/' }
  }
  if (isFile(pathname)) return { kind: 'asset', to: pathname }
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  if (hasPrefix(pathname, '/en')) return { kind: 'html', to: pathname }
  return { kind: 'html', to: '/jp' + pathname }
}

export function mapPath(site, pathname) {
  return site === 'jp' ? mapJp(pathname) : mapGlobal(pathname)
}

export const WWW_REDIRECTS = { 'www.mdmc.co': 'mdmc.co' }

// co.jp's robots.txt, verbatim from mdmc-ja-proxy: no Sitemap line, because
// dist/robots.txt names mdmc.co's sitemap.
const JP_ROBOTS = 'User-agent: *\nAllow: /\n'

function assetRequest(request, path, init) {
  const url = new URL(request.url)
  url.pathname = path
  url.search = ''
  return init ? new Request(url, init) : new Request(url, request)
}

// A plain GET: a visitor revalidating a missing URL must get the 404 page's
// body, never a body-less 304 re-labelled 404.
async function notFound(request, env) {
  const page = await env.ASSETS.fetch(assetRequest(request, '/404.html', { method: 'GET' }))
  return new Response(request.method === 'HEAD' ? null : page.body, {
    status: 404,
    headers: { 'content-type': page.headers.get('content-type') ?? 'text/html' },
  })
}

// The assets binding sends max-age=0; GitHub Pages sent max-age=600, so
// browsers re-checked every file on every view after the move. Astro's
// /_astro/ files are content-hashed, so they can be cached for good.
function cacheControlFor(path) {
  return path.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=600'
}

async function serveFile(request, env, path) {
  const res = await env.ASSETS.fetch(assetRequest(request, path))
  if (res.status === 404) return notFound(request, env)
  if (res.status !== 200 && res.status !== 304) return res
  const out = new Response(res.body, res)
  out.headers.set('cache-control', cacheControlFor(path))
  return out
}

export async function handleRequest(request, env) {
  const url = new URL(request.url)

  const apex = WWW_REDIRECTS[url.hostname]
  if (apex) return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301)

  const preview = isPreviewHost(url.hostname)
  if (preview && url.searchParams.has('site')) {
    const requested = url.searchParams.get('site')
    url.searchParams.delete('site')
    const headers = new Headers({ location: url.toString() })
    if (SITE_IDS.has(requested)) headers.set('set-cookie', `${PREVIEW_COOKIE}=${requested}; Path=/; SameSite=Lax`)
    return new Response(null, { status: 302, headers })
  }

  const site = resolveSite(url.hostname, preview ? request.headers.get('cookie') : null)
  const mapped = mapPath(site, url.pathname)

  switch (mapped.kind) {
    case 'robots':
      return new Response(JP_ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    case 'none':
      return new Response('Not found', { status: 404 })
    case 'redirect':
      return Response.redirect(`${url.origin}${mapped.to}${url.search}`, 301)
    case 'asset':
      return serveFile(request, env, mapped.to)
    default:
      return serveFile(request, env, mapped.to + 'index.html')
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
}
