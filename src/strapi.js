import SNAPSHOT from './content-snapshot.json'

const BASE = import.meta.env.DEV
  ? '/strapi/api'
  : (import.meta.env.VITE_STRAPI_URL ?? 'https://upbeat-approval-82a9e54c20.strapiapp.com/api')
const TOKEN = import.meta.env.VITE_STRAPI_TOKEN ?? ''

// Cycles through placeholder gradient classes for work cards / hero slides.
const CLASSES = [
  'thumb-zenrise', 'thumb-myocp', 'thumb-northway', 'thumb-fold',
  'thumb-coast', 'thumb-mira', 'thumb-paragon', 'thumb-orchard', 'thumb-soma',
]

// Strapi 5 richtext blocks → array of paragraph strings.
function blocksToText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((block) => (block.children || []).map((c) => c.text ?? '').join(''))
      .filter(Boolean)
      .join('\n')
  }
  return String(value)
}

function blocksToParagraphs(value) {
  if (!value) return []
  if (typeof value === 'string') return value.split('\n').filter(Boolean)
  if (Array.isArray(value)) {
    return value
      .map((block) => (block.children || []).map((c) => c.text ?? '').join(''))
      .filter(Boolean)
  }
  return []
}

function bestUrl(media) {
  if (!media) return null
  return media.formats?.large?.url ?? media.url ?? null
}

// Full-resolution original. Used for full-width contexts (hero, project images,
// gallery) where Strapi's 'large' derivative (≤1000px) would visibly upscale.
// Load weight is managed at the component level via lazy-loading + fetchPriority.
function originalUrl(media) {
  if (!media) return null
  return media.url ?? null
}

// Strapi Cloud can hang or cold-start; without a timeout the UI sits on
// skeletons indefinitely because the static-fallback paths only trigger on
// rejection, never on a hung request. Abort slow requests and retry once
// (cold starts usually answer on the second attempt), then reject so callers
// fall back. 4xx responses don't retry — they won't get better.
// Live fetch with last-known-good fallback: if Strapi is unreachable, serve
// the content snapshot baked in at build time (scripts/snapshot-content.mjs —
// real case studies from the last deploy, not placeholders). Only if the
// snapshot also has nothing does the error propagate to the caller.
async function withSnapshot(liveFn, snapshotKey, mapFn) {
  try {
    return await liveFn()
  } catch (err) {
    const data = SNAPSHOT[snapshotKey]
    if (data == null || (Array.isArray(data) && data.length === 0)) throw err
    return mapFn(data)
  }
}

async function fetchJSON(url, { timeout = 8000, retries = 1 } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController()
    const tm = setTimeout(() => ctl.abort(), timeout)
    try {
      const res = await fetch(url, { headers, signal: ctl.signal })
      if (!res.ok) {
        const err = new Error(`Strapi ${res.status}`)
        err.noRetry = res.status < 500
        throw err
      }
      return await res.json()
    } catch (err) {
      if (err.noRetry || attempt >= retries) throw err
    } finally {
      clearTimeout(tm)
    }
  }
}

function mapProject(item, index) {
  const year = item.date
    ? String(new Date(item.date).getFullYear())
    : ''
  const images = Array.isArray(item.images)
    ? item.images.map(originalUrl).filter(Boolean)
    : []

  return {
    id: item.documentId ?? String(item.id),
    name: item.title ?? '',
    client: item.client ?? '',
    desc: item.description ?? '',
    year,
    services: item.services ? [item.services] : [],
    sector: item.sector ?? '',
    region: item.region ?? '',
    intro: blocksToText(item.intro),
    body: blocksToParagraphs(item.body),
    thumbnail: originalUrl(item.thumbnail),
    // Art-directed 2.16:1 asset for the homepage hero carousel. Falls back to
    // the work-card thumbnail until a dedicated hero image is uploaded.
    heroImage: originalUrl(item.hero_image) ?? originalUrl(item.thumbnail),
    images,
    cls: CLASSES[index % CLASSES.length],
    darkHero: item.dark_hero ?? false,
  }
}

function mapMember(item) {
  const nameParts = [item.first_name, item.last_name].filter(Boolean)
  return {
    id: item.documentId ?? String(item.id),
    name: nameParts.join(' '),
    role: item.role ?? '',
    portrait: item.portrait?.formats?.medium?.url ?? item.portrait?.url ?? null,
  }
}

function mapMembers(data) {
  return Array.isArray(data) ? data.map(mapMember) : []
}

function mapHomepage(data) {
  if (!data) return null
  return {
    manifesto: (data.manifesto ?? '').split(/\n\n+/).map((s) => s.trim()).filter(Boolean),
  }
}

function mapAbout(data) {
  if (!data) return null
  const kv_items = [
    { title: data.kv_1_title, body: data.kv_1_body, image: bestUrl(data.kv_1_image) },
    { title: data.kv_2_title, body: data.kv_2_body, image: bestUrl(data.kv_2_image) },
    { title: data.kv_3_title, body: data.kv_3_body, image: bestUrl(data.kv_3_image) },
    { title: data.kv_4_title, body: data.kv_4_body, image: bestUrl(data.kv_4_image) },
  ].filter((item) => item.title)
  return {
    hero_image: originalUrl(data.hero_image),
    headline: data.headline ?? null,
    lede: (data.lede ?? '').split(/\n\n+/).map((s) => s.trim()).filter(Boolean),
    kv_items,
  }
}

function mapAboutJa(data) {
  if (!data) return null
  return {
    hero_image: originalUrl(data.hero_image),
    greeting_title: data.greeting_title ?? null,
    greeting_body: (data.greeting_body ?? '').split(/\n\n+/).map((s) => s.trim()).filter(Boolean),
    signature_portrait: bestUrl(data.signature_portrait),
    signature_role: data.signature_role ?? null,
    signature_name: data.signature_name ?? null,
    signature_romaji: data.signature_romaji ?? null,
  }
}

export function fetchMembers() {
  return withSnapshot(
    async () => mapMembers((await fetchJSON(`${BASE}/members?populate=*&sort=order:asc`)).data),
    'members', mapMembers,
  )
}

export function fetchHomepage(locale = 'en') {
  return withSnapshot(
    async () => mapHomepage((await fetchJSON(`${BASE}/homepage?locale=${locale}`)).data),
    `homepage_${locale}`, mapHomepage,
  )
}

// The About essay is inherently the English composition (Japanese readers get
// the 会社概要 page from the about-japan type instead), so no locale handling.
export function fetchAbout() {
  return withSnapshot(
    async () => mapAbout((await fetchJSON(`${BASE}/about?populate=*`)).data),
    'about', mapAbout,
  )
}

export function fetchAboutJa() {
  return withSnapshot(
    async () => mapAboutJa((await fetchJSON(`${BASE}/about-japan?populate=*`)).data),
    'about_japan', mapAboutJa,
  )
}

// Job application: multipart (fields + documents) to the custom /apply
// endpoint, which forwards to the hiring inbox with files attached. No JSON
// content-type — the browser sets the multipart boundary itself.
export async function submitApplication({ name, email, portfolio, message, jobId, turnstileToken, files = [] }) {
  const url = `${BASE.replace(/\/api$/, '')}/api/apply`
  const fd = new FormData()
  fd.append('name', name)
  fd.append('email', email)
  if (portfolio) fd.append('portfolio', portfolio)
  if (message) fd.append('message', message)
  if (jobId) fd.append('jobId', jobId)
  if (turnstileToken) fd.append('turnstileToken', turnstileToken)
  files.forEach((f) => fd.append('files', f, f.name))
  const res = await fetch(url, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Apply ${res.status}`)
  return res.json()
}

export async function submitContact({ name, email, company, budget, message, turnstileToken }) {
  const url = `${BASE.replace(/\/api$/, '')}/api/contact`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, company, budget, message, turnstileToken }),
  })
  if (!res.ok) throw new Error(`Contact ${res.status}`)
  return res.json()
}

function mapProjects(data) {
  return Array.isArray(data) ? data.map(mapProject) : []
}

function mapArticle(item) {
  return {
    id: item.documentId ?? String(item.id),
    title: item.title ?? '',
    date: item.date ?? '',
    excerpt: item.excerpt ?? '',
    body: blocksToParagraphs(item.body),
    cover: originalUrl(item.cover),
    heroImage: originalUrl(item.hero_image) ?? originalUrl(item.cover),
    tag: item.tag ?? '',
  }
}

function mapArticles(data) {
  return Array.isArray(data) ? data.map(mapArticle) : []
}

function mapCareers(data) {
  if (!data) return null
  return {
    headline: data.headline ?? null,
    intro: blocksToParagraphs(data.intro),
    hero_image: originalUrl(data.hero_image),
    offers: Array.isArray(data.offers) ? data.offers.map((o) => ({
      title: o.title ?? '',
      body: o.body ?? '',
    })) : [],
    contact_email: data.contact_email ?? null,
  }
}

function mapJob(item) {
  return {
    id: item.documentId ?? String(item.id),
    title: item.title ?? '',
    location: item.location ?? '',
    type: item.type ?? '',
    locationType: item.location_type ?? '',
    excerpt: item.excerpt ?? '',
    body: blocksToParagraphs(item.body),
    heroImage: originalUrl(item.hero_image),
    applyEmail: item.apply_email ?? null,
  }
}

function mapJobs(data) {
  return Array.isArray(data) ? data.map(mapJob) : []
}

async function rawProjects(locale) {
  try {
    const { data } = await fetchJSON(`${BASE}/projects?populate=*&sort=date:desc&locale=${locale}`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    const snap = SNAPSHOT[`projects_${locale}`]
    if (Array.isArray(snap) && snap.length > 0) return snap
    throw err
  }
}

// Text fields with i18n enabled in the Strapi project schema; everything else
// (media, dates, client, region…) is shared across locales.
const LOCALIZED_PROJECT_FIELDS = ['title', 'description', 'intro', 'body', 'services']

// Full-catalogue localization: the requested language sees EVERY entry — with
// localized text overlaid where a ja localization exists in Strapi (matched
// by documentId) and English otherwise — rather than only the ja-localized
// subset the old Global/Japan site split showed.
function mergeLocales(en, ja, localizedFields) {
  const jaById = new Map(ja.map((p) => [p.documentId, p]))
  const enIds = new Set(en.map((p) => p.documentId))
  const merged = en.map((p) => {
    const j = jaById.get(p.documentId)
    if (!j) return p
    const out = { ...p }
    for (const f of localizedFields) {
      if (j[f] != null && j[f] !== '') out[f] = j[f]
    }
    return out
  })
  const jaOnly = ja.filter((p) => !enIds.has(p.documentId))
  return [...merged, ...jaOnly]
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
}

export async function fetchProjects(locale = 'en') {
  const en = await rawProjects('en')
  if (locale === 'en') return mapProjects(en)
  let ja = []
  try { ja = await rawProjects('ja') } catch (e) {} // ja unavailable → English text everywhere
  return mapProjects(mergeLocales(en, ja, LOCALIZED_PROJECT_FIELDS))
}

const LOCALIZED_ARTICLE_FIELDS = ['title', 'excerpt', 'body', 'tag']

async function rawArticles(locale) {
  try {
    const { data } = await fetchJSON(`${BASE}/articles?populate=*&sort=date:desc&locale=${locale}`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    const snap = SNAPSHOT[`articles_${locale}`]
    if (Array.isArray(snap) && snap.length > 0) return snap
    throw err
  }
}

export async function fetchArticles(locale = 'en') {
  const en = await rawArticles('en')
  if (locale === 'en') return mapArticles(en)
  let ja = []
  try { ja = await rawArticles('ja') } catch (e) {}
  return mapArticles(mergeLocales(en, ja, LOCALIZED_ARTICLE_FIELDS))
}

const LOCALIZED_JOB_FIELDS = ['title', 'excerpt', 'body']

async function rawJobs(locale) {
  try {
    const { data } = await fetchJSON(`${BASE}/jobs?populate=*&locale=${locale}`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    const snap = SNAPSHOT[`jobs_${locale}`]
    if (Array.isArray(snap) && snap.length > 0) return snap
    throw err
  }
}

export async function fetchJobs(locale = 'en') {
  const en = await rawJobs('en')
  if (locale === 'en') return mapJobs(en)
  let ja = []
  try { ja = await rawJobs('ja') } catch (e) {}
  return mapJobs(mergeLocales(en, ja, LOCALIZED_JOB_FIELDS))
}

export async function fetchCareers(locale = 'en') {
  const load = async (loc) => {
    try {
      return (await fetchJSON(`${BASE}/career?populate=*&locale=${loc}`)).data ?? null
    } catch (err) {
      const snap = SNAPSHOT[`career_${loc}`]
      if (snap) return snap
      throw err
    }
  }
  let data = null
  try { data = await load(locale) } catch (e) {}
  if (!data && locale !== 'en') data = await load('en') // ja not written yet → English
  return mapCareers(data)
}
