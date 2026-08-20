// Pure data-shaping helpers for the build-time content layer. No I/O here —
// fetching and fallback logic live in content.js.

// Text fields with i18n enabled in the Strapi project schema; everything else
// (media, dates, client, region…) is shared across locales. `intro`/`body`
// are legacy fields no longer surfaced by the content layer (superseded by
// the case-study `story` fields below) and are intentionally left off this
// list — the `.ja` overlay should only carry fields consumers actually read.
export const LOCALIZED_PROJECT_FIELDS = [
  'title',
  'description',
  'services',
  'overview',
  'challenge',
  'approach',
  'outcome',
  'pull_quote',
  'pull_quote_attribution',
]
export const LOCALIZED_ARTICLE_FIELDS = ['title', 'excerpt', 'body', 'tag']

// Strapi 5 richtext blocks → array of paragraph strings. Ported as-is from
// main:src/strapi.js (lines 27-36) so both the old and new content layers
// agree on shape. Handles both markdown-string richtext (current schema) and
// legacy blocks-array content that may still be lingering on old fields.
export function blocksToParagraphs(value) {
  if (!value) return []
  if (typeof value === 'string') return value.split('\n').filter(Boolean)
  if (Array.isArray(value)) {
    return value
      .map((block) => (block.children || []).map((c) => c.text ?? '').join(''))
      .filter(Boolean)
  }
  return []
}

// Next project in the date-desc list, wrapping around at the end. Used by
// the case-study "Next project" block. Returns null when the slug isn't
// found or the list doesn't have another project to point to.
export function nextProject(projects, slug) {
  if (!projects || projects.length < 2) return null
  const idx = projects.findIndex((p) => p.slug === slug)
  if (idx === -1) return null
  return projects[(idx + 1) % projects.length]
}

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
