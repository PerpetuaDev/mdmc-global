// Build-time only: import from .astro frontmatter (or scripts run under
// Node/Vite where `import.meta.env` resolves), never from client code.
import snapshot from '../content-snapshot.json'
import {
  mergeLocales,
  assignSlugs,
  blocksToParagraphs,
  LOCALIZED_PROJECT_FIELDS,
  LOCALIZED_ARTICLE_FIELDS,
  LOCALIZED_JOB_FIELDS,
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
  // Specialties are not localized: the disciplines relation is shared across
  // locales, so ja pages render the EN discipline names (pickLocalized falls
  // through). The retired free-text `services` overlay used to live here.
  return {
    title: overlay.title ?? null,
    description: overlay.description ?? null,
    story: storyOf(overlay),
    pullQuote: overlay.pull_quote ?? null,
    pullQuoteAttribution: overlay.pull_quote_attribution ?? null,
  }
}

function normalizeProject(item) {
  // Disciplines: controlled-vocabulary relation (2026-08-20). The free-text
  // `services` string it replaced is deleted from the schema; the committed
  // snapshot carries disciplines, so there is no string path left to split.
  // specialtiesJa reads each discipline's name_ja label, falling back per
  // entry to the EN name so a half-labeled vocabulary still renders fully.
  const disciplines = (item.disciplines ?? []).filter((d) => d?.name)
  const services = disciplines.map((d) => d.name)
  const servicesJa = disciplines.map((d) => d.name_ja || d.name)
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
    specialtiesJa: servicesJa,
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
// PLACEHOLDER JA (machine-drafted 2026-08-20, pending native review) — same
// status as i18n.js's PLACEHOLDER JA block.
const ARTICLE_KIND_LABELS_JA = { news: 'ニュース', article: '記事', case_study: 'ケーススタディ' }

// 2026年8月16日 — parsed straight off the YYYY-MM-DD string, so it can't
// drift by timezone at all (mirrors dateLabelOf's UTC pinning).
function dateLabelJaOf(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return ''
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

function dateLabelOf(date) {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  // Pin to UTC: new Date('YYYY-MM-DD') parses as UTC midnight, so format
  // must use the same zone to avoid off-by-one dates on builds outside UTC.
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase()
}

function normalizeArticleJa(overlay) {
  if (!overlay) return null
  return {
    title: overlay.title ?? null,
    excerpt: overlay.excerpt ?? null,
    body: overlay.body != null ? blocksToParagraphs(overlay.body) : [],
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
    dateLabelJa: dateLabelJaOf(item.date),
    excerpt: item.excerpt ?? '',
    kind,
    kindLabel: ARTICLE_KIND_LABELS[kind] ?? 'News',
    kindLabelJa: ARTICLE_KIND_LABELS_JA[kind] ?? 'ニュース',
    projectSlug,
    cover: mediaOf(item.cover),
    heroImage: mediaOf(item.hero_image) ?? mediaOf(item.cover),
    body: blocksToParagraphs(item.body),
    ja: normalizeArticleJa(item.ja),
  }
}

// `about` single type: headline/lede + up to 4 key-value sections
// (kv_1..kv_4 title/body/image). A kv slot with no title is unauthored and
// dropped — body/image alone shouldn't produce a heading-less section.
function sectionsOf(item) {
  const sections = []
  for (let i = 1; i <= 4; i++) {
    const title = item[`kv_${i}_title`]
    if (!title) continue
    sections.push({
      title,
      body: blocksToParagraphs(item[`kv_${i}_body`]),
      // kv images intentionally not mapped: the redesign's About sections are
      // text-only (prototype) — the old site rendered them, the new one never
      // has. Fields still exist in the CMS until the post-cutover cleanup.
    })
  }
  return sections
}

function normalizeAbout(item) {
  if (!item) return null
  return {
    headline: item.headline ?? '',
    lede: item.lede ?? '',
    heroImage: mediaOf(item.hero_image),
    sections: sectionsOf(item),
  }
}

function normalizeAboutJapan(item) {
  if (!item) return null
  return {
    heroImage: mediaOf(item.hero_image),
    greetingTitle: item.greeting_title ?? '',
    greetingBody: blocksToParagraphs(item.greeting_body),
    signature: {
      role: item.signature_role ?? '',
      name: item.signature_name ?? '',
      romaji: item.signature_romaji ?? '',
      portrait: mediaOf(item.signature_portrait),
    },
  }
}

// `offers` (a repeatable component) is deliberately ignored this phase per
// the brief — not populated on the fetch, not surfaced here.
function normalizeCareer(item, jaItem = null) {
  if (!item) return null
  return {
    headline: item.headline ?? '',
    intro: blocksToParagraphs(item.intro),
    contactEmail: item.contact_email ?? null,
    heroImage: mediaOf(item.hero_image),
    // Single type, so the ja locale entry is merged here rather than via
    // mergeLocales — same `.ja` overlay shape consumers pickLocalized() on.
    ja: jaItem
      ? {
          headline: jaItem.headline ?? null,
          intro: jaItem.intro != null ? blocksToParagraphs(jaItem.intro) : null,
        }
      : null,
  }
}

// Confirmed live in the content snapshot (job kd13tzu1r1620jwmukdhbvw0):
// Strapi's `type` enum values are already display strings ("Part-time"), not
// the typical snake_case — so this maps known values to themselves and
// prettifies anything unrecognized (future enum additions) rather than
// falling back to a raw snake_case/kebab string.
const JOB_TYPE_LABELS = {
  'Full-time': 'Full-time',
  'Part-time': 'Part-time',
  Contract: 'Contract',
  Internship: 'Internship',
}

function prettifyRaw(raw) {
  if (!raw) return ''
  return raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

// PLACEHOLDER JA (machine-drafted 2026-08-20, pending native review). Keys
// are the job schema's enum values verbatim; unknown values fall back to the
// EN label.
const JOB_TYPE_LABELS_JA = {
  'Full-time': 'フルタイム',
  'Part-time': 'パートタイム',
  Contract: '契約社員',
  Internship: 'インターン',
}
const JOB_LOCATION_LABELS_JA = {
  Christchurch: 'クライストチャーチ',
  'North Sydney': 'ノースシドニー',
  Yokohama: '横浜',
  'Any location': '勤務地不問',
}

function normalizeJob(item) {
  const type = item.type ?? ''
  return {
    documentId: item.documentId,
    title: item.title ?? '',
    excerpt: item.excerpt ?? '',
    body: blocksToParagraphs(item.body),
    location: item.location ?? '',
    locationLabel: item.location ?? '',
    locationLabelJa: JOB_LOCATION_LABELS_JA[item.location ?? ''] ?? item.location ?? '',
    type,
    typeLabel: JOB_TYPE_LABELS[type] ?? prettifyRaw(type),
    typeLabelJa: JOB_TYPE_LABELS_JA[type] ?? JOB_TYPE_LABELS[type] ?? prettifyRaw(type),
    locationType: item.location_type ?? '',
    applyEmail: item.apply_email ?? '',
    heroImage: mediaOf(item.hero_image),
    ja: normalizeJobJa(item.ja),
  }
}

// Same overlay convention as normalizeProjectJa/normalizeArticleJa: null when
// no ja locale exists, else only the localized fields consumers read.
function normalizeJobJa(overlay) {
  if (!overlay) return null
  return {
    title: overlay.title ?? null,
    excerpt: overlay.excerpt ?? null,
    body: overlay.body != null ? blocksToParagraphs(overlay.body) : null,
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
const PROJECTS_POPULATE =
  'populate[thumbnail]=true&populate[hero_image]=true&populate[gallery][populate]=image&populate[disciplines][fields][0]=name&populate[disciplines][fields][1]=name_ja'
const ARTICLES_POPULATE = 'populate[cover]=true&populate[hero_image]=true&populate[project]=true'
const ABOUT_POPULATE =
  'populate[hero_image]=true'
const ABOUT_JAPAN_POPULATE = 'populate[hero_image]=true&populate[signature_portrait]=true'
// `offers` is intentionally NOT populated here — ignored this phase per the brief.
const CAREER_POPULATE = 'populate[hero_image]=true'
const JOBS_POPULATE = 'populate[hero_image]=true'

async function _load() {
  const [projectsEn, projectsJa, articlesEn, articlesJa, aboutRaw, aboutJapanRaw, careerRaw, careerJaRaw, jobsRaw, jobsJaRaw] =
    await Promise.all([
      fetchJson(`/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=en`),
      fetchJson(`/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=ja`),
      fetchJson(`/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=en`),
      fetchJson(`/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=ja`),
      fetchJson(`/about?${ABOUT_POPULATE}`),
      fetchJson(`/about-japan?${ABOUT_JAPAN_POPULATE}`),
      fetchJson(`/career?${CAREER_POPULATE}&locale=en`),
      fetchJson(`/career?${CAREER_POPULATE}&locale=ja`),
      fetchJson(`/jobs?${JOBS_POPULATE}&locale=en`),
      fetchJson(`/jobs?${JOBS_POPULATE}&locale=ja`),
    ])

  const rawProjectsEn = projectsEn ?? snapshot.projects_en ?? []
  const rawProjectsJa = projectsJa ?? snapshot.projects_ja ?? []
  const rawArticlesEn = articlesEn ?? snapshot.articles_en ?? []
  const rawArticlesJa = articlesJa ?? snapshot.articles_ja ?? []

  const mergedProjects = mergeLocales(rawProjectsEn, rawProjectsJa, LOCALIZED_PROJECT_FIELDS)
  const mergedArticles = mergeLocales(rawArticlesEn, rawArticlesJa, LOCALIZED_ARTICLE_FIELDS)

  const projects = assignSlugs(mergedProjects.map(normalizeProject))
  const articles = assignSlugs(mergedArticles.map((item) => normalizeArticle(item, projects)))

  const about = normalizeAbout(aboutRaw ?? snapshot.about ?? null)
  const aboutJapan = normalizeAboutJapan(aboutJapanRaw ?? snapshot.about_japan ?? null)
  const career = normalizeCareer(careerRaw ?? snapshot.career_en ?? null, careerJaRaw ?? snapshot.career_ja ?? null)
  const rawJobsEn = jobsRaw ?? snapshot.jobs_en ?? []
  const rawJobsJa = jobsJaRaw ?? snapshot.jobs_ja ?? []
  const jobs = assignSlugs(mergeLocales(rawJobsEn, rawJobsJa, LOCALIZED_JOB_FIELDS).map(normalizeJob))

  return { projects, articles, about, aboutJapan, career, jobs }
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

// Home hero slideshow window: the 4 newest projects (the list is already
// date-desc) that actually have a hero image. A project with `hero_image`
// unset in the CMS is skipped rather than rendered as an empty grey
// placeholder frame — three live projects have no hero today (2026-08-25),
// and Zenrise Brand Identity was 4th-newest, so the slideshow showed a blank
// slide every cycle. WorkCard/GalleryStack keep their own degraded states.
export const HERO_SLIDE_COUNT = 4
export function heroSlidesOf(projects) {
  return (projects ?? []).filter((p) => p?.heroImage).slice(0, HERO_SLIDE_COUNT)
}

// Mobile and tablet slide on thumbnails, not hero images. The hero assets are
// 2600x1200; object-fit:cover into the narrow frame (319x558 at a 390
// viewport) scaled them to 1209px wide and showed 319 of it — 74% of every
// image cropped away, measured 2026-09-03. Thumbnails are 4:3, which is the
// narrow frame's own ratio, so nothing crops.
//
// Every project has a thumbnail while only three have hero art, so the narrow
// hero also shows the full set instead of the three heroSlidesOf() allows.
// That divergence is deliberate and resolves itself when the missing
// 2600x1200 heroes land in Strapi.
export const THUMB_SLIDE_COUNT = 6

export function thumbSlidesOf(projects, count = THUMB_SLIDE_COUNT) {
  return (projects ?? []).filter((p) => p?.thumbnail).slice(0, count)
}

// Exported for unit testing the pure normalization logic in isolation from
// fetch/fallback (test/content.test.js). ARTICLE_KIND_LABELS is also
// consumed by src/pages/news/index.astro so its KINDS filter list derives
// from the same source of truth instead of a second hardcoded copy.
export {
  normalizeProject,
  normalizeArticle,
  normalizeAbout,
  normalizeAboutJapan,
  normalizeCareer,
  normalizeJob,
  ARTICLE_KIND_LABELS,
  ARTICLE_KIND_LABELS_JA,
}
