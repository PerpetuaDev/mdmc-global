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
