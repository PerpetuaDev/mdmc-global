// Sitemap for mdmc.co.jp.
//
// @astrojs/sitemap is single-site: it emits mdmc.co URLs, which is why the
// ja-proxy Worker 404s /sitemap-index.xml and /sitemap-N.xml on co.jp rather
// than serve mdmc.co addresses under the Japan host (see docs/JA-DOMAIN.md).
// Correct, but it left the Japan domain with no sitemap at all — and co.jp is
// the CANONICAL host for every Japanese page on the site, so those were
// discoverable only by crawling.
//
// This builds co.jp's own sitemap from the one origin tree that is
// SELF-CANONICAL on the Japan domain:
//
//   origin /jp/…  ->  https://mdmc.co.jp/…   (Japanese, co.jp's root)
//
// Nothing else belongs in it. A sitemap should list only self-canonical URLs,
// and co.jp/en/* canonicalises to mdmc.co (English consolidates there), so
// listing it would just point Google at addresses that redirect its attention
// elsewhere — the same reason mdmc.co's sitemap drops /ja/. Between the two
// sitemaps every canonical URL on the site is listed exactly once.

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
  // Everything else — the root EN tree, /ja/, and co.jp's own /en/ — either
  // belongs to mdmc.co or canonicalises there. See the header note.
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
