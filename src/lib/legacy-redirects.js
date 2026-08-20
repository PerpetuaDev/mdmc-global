// Legacy hash-URL redirects — the old SPA (main:src/App.jsx, parseHash,
// lines ~64-80) routed entirely off `location.hash`: `#/work/<id>`,
// `#/news/<id>`, `#/careers/<id>` for detail views; bare `#/work`,
// `#/about`, `#/contact`, `#/news`, `#/careers` for index views; anything
// else stayed on home. This mirrors that parsing exactly so old bookmarks
// and inbound links land on the equivalent Astro static route.
//
// `map` shape: { work: { [documentId]: slug }, news: { ... }, careers: { ... } }
// built at build time from loadContent()'s projects/articles/jobs.
//
// CANONICAL COPY: index.astro's inline shim script duplicates this
// function's body verbatim (define:vars can only serialize values, not
// import a module into an inline <script>) — keep the two in sync; this
// file + test/redirects.test.js are the source of truth.
export function legacyRedirect(hash, map) {
  const h = hash.replace(/^#\/?/, '')
  if (!h) return null
  const parts = h.split('/')
  const section = parts[0]
  const id = parts[1]

  if (section === 'work' || section === 'news' || section === 'careers') {
    if (id) {
      const slug = map[section] && map[section][id]
      return slug ? `/${section}/${slug}/` : `/${section}/`
    }
    return `/${section}/`
  }

  if (['about', 'contact'].includes(section)) return `/${section}/`

  return null
}
