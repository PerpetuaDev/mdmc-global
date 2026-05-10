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

function originalUrl(media) {
  if (!media) return null
  return media.url ?? null
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

export async function fetchMembers() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/members?populate=*&sort=order:asc`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  return Array.isArray(data) ? data.map(mapMember) : []
}

export async function fetchHomepage(locale = 'en') {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/homepage?locale=${locale}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  if (!data) return null
  return {
    manifesto: (data.manifesto ?? '').split(/\n\n+/).map((s) => s.trim()).filter(Boolean),
  }
}

export async function fetchAbout() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/about?populate=*`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
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

export async function fetchAboutJa() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/about-japan?populate=*`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
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

export async function submitContact({ name, email, company, budget, message }) {
  const url = `${BASE.replace(/\/api$/, '')}/api/contact`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, company, budget, message }),
  })
  if (!res.ok) throw new Error(`Contact ${res.status}`)
  return res.json()
}

export async function fetchProjects(locale = 'en') {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/projects?populate=*&sort=date:desc&locale=${locale}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  return Array.isArray(data) ? data.map(mapProject) : []
}
