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

function mapProject(item, index) {
  const year = item.date
    ? String(new Date(item.date).getFullYear())
    : ''
  const images = Array.isArray(item.images)
    ? item.images.map(bestUrl).filter(Boolean)
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
    thumbnail: bestUrl(item.thumbnail),
    images,
    cls: CLASSES[index % CLASSES.length],
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

export async function fetchProjects(locale = 'en') {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/projects?populate=*&sort=date:desc&locale=${locale}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  return Array.isArray(data) ? data.map(mapProject) : []
}
