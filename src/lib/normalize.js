// Pure data-shaping helpers for the build-time content layer. No I/O here —
// fetching and fallback logic live in content.js.

// Text fields with i18n enabled in the Strapi project schema; everything else
// (media, dates, client, region…) is shared across locales.
export const LOCALIZED_PROJECT_FIELDS = ['title', 'description', 'intro', 'body', 'services']
export const LOCALIZED_ARTICLE_FIELDS = ['title', 'excerpt', 'body', 'tag']

export function slugify(title, documentId) {
  const s = (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || documentId
}

export function assignSlugs(items) {
  const seen = new Set()
  return items.map((it) => {
    let slug = slugify(it.title, it.documentId)
    if (seen.has(slug)) slug = `${slug}-${it.documentId}`
    seen.add(slug)
    return { ...it, slug }
  })
}

// Full-catalogue localization: every entry appears — with localized text
// overlaid from the ja entry sharing its documentId, where one exists. Unlike
// the old site's mergeLocales (which flattened ja text onto the top-level
// fields), the merged item keeps EN fields at top level and exposes the ja
// overlay under `.ja`, since both locales are needed once JA routes arrive
// in later phases.
export function mergeLocales(en, ja, localizedFields) {
  const jaById = new Map(ja.map((item) => [item.documentId, item]))
  const enIds = new Set(en.map((item) => item.documentId))

  const merged = en.map((item) => {
    const j = jaById.get(item.documentId)
    if (!j) return item
    const overlay = {}
    for (const field of localizedFields) {
      if (j[field] != null && j[field] !== '') overlay[field] = j[field]
    }
    return { ...item, ja: overlay }
  })

  const jaOnly = ja.filter((item) => !enIds.has(item.documentId))

  return [...merged, ...jaOnly].sort((a, b) =>
    String(b.date ?? '').localeCompare(String(a.date ?? '')),
  )
}
