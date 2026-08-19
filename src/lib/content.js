// Build-time only: import from .astro frontmatter (or scripts run under
// Node/Vite where `import.meta.env` resolves), never from client code.
import snapshot from '../content-snapshot.json'
import {
  mergeLocales,
  assignSlugs,
  blocksToParagraphs,
  LOCALIZED_PROJECT_FIELDS,
  LOCALIZED_ARTICLE_FIELDS,
} from './normalize.js'

const API = 'https://upbeat-approval-82a9e54c20.strapiapp.com/api'
// CI maps the deploy secret to STRAPI_TOKEN, so that name wins; local dev's
// existing .env convention (shared with scripts/snapshot-content.mjs) is
// VITE_STRAPI_TOKEN, kept as a fallback so both paths share one token.
const TOKEN =
  import.meta.env.STRAPI_TOKEN ??
  process.env.STRAPI_TOKEN ??
  import.meta.env.VITE_STRAPI_TOKEN ??
  process.env.VITE_STRAPI_TOKEN ??
  ''

async function fetchJson(path, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 8000)
      const res = await fetch(API + path, {
        headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
        signal: ctl.signal,
      })
      clearTimeout(t)
      if (res.ok) return (await res.json()).data
      // 4xx (bad token, unpublished endpoint, permission gap) won't get
      // better on a retry — stop immediately and fall back.
      if (res.status >= 400 && res.status < 500) break
    } catch { /* retry */ }
  }
  return null
}

// Media relations come back as Strapi's full entity shape; callers only ever
// need a URL + alt text. Strapi Cloud's media provider returns absolute
// URLs already, so no origin-prefixing is needed.
function mediaOf(media) {
  if (!media) return null
  return { url: media.url, alt: media.alternativeText ?? '' }
}

function splitList(value) {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
}

// Case-study story: overview/challenge/approach/outcome each become a
// paragraph array; `story` itself is null unless at least one section has
// content — on live data today all four are empty (fields exist, unauthored)
// so this correctly collapses to null. The pull quote is intentionally NOT
// part of this object — it closes the gallery view too per the design spec,
// so it must not depend on story existing (a quote-only entry, with all four
// sections empty, should still surface the quote). It's a top-level Project
// field instead (see normalizeProject/normalizeProjectJa).
function storyOf(item) {
  const overview = blocksToParagraphs(item.overview)
  const challenge = blocksToParagraphs(item.challenge)
  const approach = blocksToParagraphs(item.approach)
  const outcome = blocksToParagraphs(item.outcome)
  if (!overview.length && !challenge.length && !approach.length && !outcome.length) return null
  return { overview, challenge, approach, outcome }
}

// Repeatable `project.gallery-slot` component -> flat slot list. Slots
// without a resolved image (shouldn't happen given the required field, but
// defensive against partially-populated responses) are dropped.
function galleryOf(slots) {
  if (!Array.isArray(slots)) return []
  return slots
    .map((slot) => {
      const media = mediaOf(slot.image)
      if (!media) return null
      return { url: media.url, alt: media.alt, kind: slot.kind ?? 'two_up', caption: slot.caption ?? null }
    })
    .filter(Boolean)
}

// Normalizes the `.ja` overlay (built by mergeLocales from raw Strapi
// fields) down to the same shape consumers get at the top level, restricted
// to the fields that are actually localized. `null` when no ja override
// exists for a given field, so callers can `project.ja?.title ?? project.title`.
function normalizeProjectJa(overlay) {
  if (!overlay) return null
  const services = overlay.services != null ? splitList(overlay.services) : null
  return {
    title: overlay.title ?? null,
    description: overlay.description ?? null,
    services,
    specialties: services,
    story: storyOf(overlay),
    pullQuote: overlay.pull_quote ?? null,
    pullQuoteAttribution: overlay.pull_quote_attribution ?? null,
  }
}

function normalizeProject(item) {
  const services = splitList(item.services)
  return {
    documentId: item.documentId,
    title: item.title ?? '',
    description: item.description ?? '',
    client: item.client ?? '',
    date: item.date ?? '',
    region: item.region ?? '',
    regions: splitList(item.region),
    services,
    specialties: services,
    darkHero: item.dark_hero ?? false,
    thumbnail: mediaOf(item.thumbnail),
    heroImage: mediaOf(item.hero_image),
    gallery: galleryOf(item.gallery),
    story: storyOf(item),
    pullQuote: item.pull_quote ?? null,
    pullQuoteAttribution: item.pull_quote_attribution ?? null,
    ja: normalizeProjectJa(item.ja),
  }
}

const ARTICLE_KIND_LABELS = { news: 'News', article: 'Article', case_study: 'Case Study' }

function dateLabelOf(date) {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase()
}

function normalizeArticleJa(overlay) {
  if (!overlay) return null
  return {
    title: overlay.title ?? null,
    excerpt: overlay.excerpt ?? null,
    body: overlay.body != null ? blocksToParagraphs(overlay.body) : [],
    tag: overlay.tag ?? null,
  }
}

// `projects` is the already-normalized+slugged project list, so the
// `project` relation (a documentId) resolves to a routable slug here rather
// than callers having to cross-reference it themselves.
function normalizeArticle(item, projects = []) {
  const kind = item.kind ?? 'news'
  const projectDocId = item.project?.documentId ?? null
  const projectSlug = projectDocId
    ? (projects.find((p) => p.documentId === projectDocId)?.slug ?? null)
    : null
  return {
    documentId: item.documentId,
    title: item.title ?? '',
    date: item.date ?? '',
    dateLabel: dateLabelOf(item.date),
    excerpt: item.excerpt ?? '',
    kind,
    kindLabel: ARTICLE_KIND_LABELS[kind] ?? 'News',
    projectSlug,
    cover: mediaOf(item.cover),
    heroImage: mediaOf(item.hero_image) ?? mediaOf(item.cover),
    body: blocksToParagraphs(item.body),
    ja: normalizeArticleJa(item.ja),
  }
}

// Fetches projects + articles (en and ja locales), falling back per endpoint
// to the matching section of the last-known-good snapshot when the live
// fetch fails or is unauthorized (articles/jobs 403 without a token — that's
// expected, not a hard failure). Query strings mirror
// scripts/snapshot-content.mjs exactly so live and snapshot shapes agree.
// mergeLocales already sorts newest-first by date, and normalizing/slugging
// afterward preserves that order.
// NOTE: `populate=*` combined with any `populate[x]=...` bracket key on the
// SAME request 500s on this Strapi Cloud instance (qs can't merge a wildcard
// string value with bracket-object keys under one `populate` param) —
// confirmed live, reproducible on both endpoints. So these list every
// relation/media field the normalizers actually read, explicitly, with no
// wildcard. Scalar/richtext fields (title, date, kind, overview, etc.) come
// back regardless of populate, so nothing else is lost by dropping `*`.
const PROJECTS_POPULATE = 'populate[thumbnail]=true&populate[hero_image]=true&populate[gallery][populate]=image'
const ARTICLES_POPULATE = 'populate[cover]=true&populate[hero_image]=true&populate[project]=true'

async function _load() {
  const [projectsEn, projectsJa, articlesEn, articlesJa] = await Promise.all([
    fetchJson(`/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=en`),
    fetchJson(`/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=ja`),
    fetchJson(`/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=en`),
    fetchJson(`/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=ja`),
  ])

  const rawProjectsEn = projectsEn ?? snapshot.projects_en ?? []
  const rawProjectsJa = projectsJa ?? snapshot.projects_ja ?? []
  const rawArticlesEn = articlesEn ?? snapshot.articles_en ?? []
  const rawArticlesJa = articlesJa ?? snapshot.articles_ja ?? []

  const mergedProjects = mergeLocales(rawProjectsEn, rawProjectsJa, LOCALIZED_PROJECT_FIELDS)
  const mergedArticles = mergeLocales(rawArticlesEn, rawArticlesJa, LOCALIZED_ARTICLE_FIELDS)

  const projects = assignSlugs(mergedProjects.map(normalizeProject))
  const articles = assignSlugs(mergedArticles.map((item) => normalizeArticle(item, projects)))

  return { projects, articles }
}

// Every page's frontmatter calls loadContent() independently, and each call
// fetches Strapi (falling back to the snapshot) on its own. A transient
// mid-build failure could then make some pages see live data and others see
// the snapshot, emitting inconsistent slugs across pages on an otherwise
// green build. Memoizing on a module-level promise ensures every caller
// within a build awaits the same fetch/fallback outcome.
let _p
export function loadContent() {
  return (_p ??= _load())
}

// Exported for unit testing the pure normalization logic in isolation from
// fetch/fallback (test/content.test.js).
export { normalizeProject, normalizeArticle }
