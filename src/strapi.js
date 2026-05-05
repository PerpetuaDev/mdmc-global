const BASE = import.meta.env.DEV
  ? '/strapi/api'
  : (import.meta.env.VITE_STRAPI_URL ?? 'https://grateful-excellence-5154b8bd7e.strapiapp.com/api')
const TOKEN = import.meta.env.VITE_STRAPI_TOKEN ?? ''

// Cycles through placeholder gradient classes for work cards / hero slides.
const CLASSES = [
  'thumb-zenrise', 'thumb-myocp', 'thumb-northway', 'thumb-fold',
  'thumb-coast', 'thumb-mira', 'thumb-paragon', 'thumb-orchard', 'thumb-soma',
]

// Strapi 5 richtext can be a plain string or the blocks JSON format.
function blockToText(value) {
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

function bestUrl(media) {
  if (!media) return null
  return media.formats?.large?.url ?? media.url ?? null
}

function mapProject(item, index) {
  const clientName = item.project_client?.client_name ?? ''
  const offices = Array.isArray(item.related_offices) ? item.related_offices : []
  const region = offices[0]?.office_name ?? ''
  const year = item.project_date
    ? String(new Date(item.project_date).getFullYear())
    : ''
  const body = [item.project_comment2, item.project_comment3, item.project_comment4]
    .map(blockToText)
    .filter(Boolean)
  const images = Array.isArray(item.project_images)
    ? item.project_images.map(bestUrl).filter(Boolean)
    : []

  return {
    id: item.documentId ?? String(item.id),
    name: item.project_title ?? '',
    client: clientName,
    desc: blockToText(item.project_description),
    year,
    services: item.service_type ? [item.service_type] : [],
    sector: item.industry ?? '',
    region,
    intro: blockToText(item.project_comment1),
    body,
    thumbnail: bestUrl(item.thumbnail_image),
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
    portrait: item.portrait_image?.formats?.medium?.url ?? item.portrait_image?.url ?? null,
  }
}

export async function fetchMembers() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/members?populate=*&sort=id:asc`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  return Array.isArray(data) ? data.map(mapMember) : []
}

export async function fetchProjects() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const url = `${BASE}/projects?populate=*&sort=project_date:desc`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Strapi ${res.status}`)
  const { data } = await res.json()
  return Array.isArray(data) ? data.map(mapProject) : []
}
