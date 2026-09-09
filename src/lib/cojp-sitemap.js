// Sitemap for mdmc.co.jp.
//
// @astrojs/sitemap is single-site: it emits mdmc.co URLs, which is why the
// ja-proxy Worker 404s /sitemap-index.xml and /sitemap-N.xml on co.jp rather
// than serve mdmc.co addresses under the Japan host (see docs/JA-DOMAIN.md).
// Correct, but it left the Japan domain with no sitemap at all — and co.jp is
// the CANONICAL host for every Japanese page on the site, so those were
// discoverable only by crawling.
//
// This builds co.jp's own sitemap from the two origin trees the Worker serves
// there, so every URL in it is a real, canonical co.jp address:
//
//   origin /jp/…  ->  https://mdmc.co.jp/…      (Japanese, co.jp's root)
//   origin /en/…  ->  https://mdmc.co.jp/en/…   (English on the Japan domain)
//
// The root EN tree and /ja/ are deliberately absent: they are mdmc.co's
// surfaces and already covered by @astrojs/sitemap's output.

const ORIGIN = 'https://mdmc.co.jp'

// Origin pathname -> public co.jp URL, or null if the page is not served on
// co.jp at all. Exported for tests.
export function cojpUrlOf(pathname) {
  // Normalise to a trailing-slash directory path, which is what GitHub Pages
  // serves and what the Worker normalises visitors to.
  let p = pathname
  if (!p.startsWith('/')) p = '/' + p
  p = p.replace(/index\.html$/, '')
  if (!p.endsWith('/')) p += '/'

  // 404 is not a canonical page anywhere.
  if (p.includes('/404')) return null

  if (p === '/jp/') return `${ORIGIN}/`
  if (p.startsWith('/jp/')) return ORIGIN + p.slice('/jp'.length)
  // /en/ is served at the same prefix on co.jp, so it passes through as-is.
  if (p === '/en/' || p.startsWith('/en/')) return ORIGIN + p
  return null
}

export function cojpUrlsFrom(pathnames) {
  const urls = pathnames.map(cojpUrlOf).filter(Boolean)
  // Stable, de-duplicated output so the file only changes when the site does.
  return [...new Set(urls)].sort()
}

export function sitemapXml(urls) {
  const body = urls.map((u) => `<url><loc>${u}</loc></url>`).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</urlset>'
  )
}
