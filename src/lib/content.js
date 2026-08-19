// Build-time only: import from .astro frontmatter (or scripts run under
// Node/Vite where `import.meta.env` resolves), never from client code.
import snapshot from '../content-snapshot.json'
import {
  mergeLocales,
  assignSlugs,
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

function normalizeProject(item) {
  return {
    documentId: item.documentId,
    title: item.title ?? '',
    description: item.description ?? '',
    client: item.client ?? '',
    date: item.date ?? '',
    region: item.region ?? '',
    services: item.services ? item.services.split(',').map((s) => s.trim()).filter(Boolean) : [],
    darkHero: item.dark_hero ?? false,
    thumbnail: mediaOf(item.thumbnail),
    heroImage: mediaOf(item.hero_image),
    ja: item.ja ?? null,
  }
}

function normalizeArticle(item) {
  return {
    documentId: item.documentId,
    title: item.title ?? '',
    date: item.date ?? '',
    excerpt: item.excerpt ?? '',
    cover: mediaOf(item.cover),
    ja: item.ja ?? null,
  }
}

// Fetches projects + articles (en and ja locales), falling back per endpoint
// to the matching section of the last-known-good snapshot when the live
// fetch fails or is unauthorized (articles/jobs 403 without a token — that's
// expected, not a hard failure). Query strings mirror
// scripts/snapshot-content.mjs exactly so live and snapshot shapes agree.
// mergeLocales already sorts newest-first by date, and normalizing/slugging
// afterward preserves that order.
export async function loadContent() {
  const [projectsEn, projectsJa, articlesEn, articlesJa] = await Promise.all([
    fetchJson('/projects?populate=*&sort=date:desc&locale=en'),
    fetchJson('/projects?populate=*&sort=date:desc&locale=ja'),
    fetchJson('/articles?populate=*&sort=date:desc&locale=en'),
    fetchJson('/articles?populate=*&sort=date:desc&locale=ja'),
  ])

  const rawProjectsEn = projectsEn ?? snapshot.projects_en ?? []
  const rawProjectsJa = projectsJa ?? snapshot.projects_ja ?? []
  const rawArticlesEn = articlesEn ?? snapshot.articles_en ?? []
  const rawArticlesJa = articlesJa ?? snapshot.articles_ja ?? []

  const mergedProjects = mergeLocales(rawProjectsEn, rawProjectsJa, LOCALIZED_PROJECT_FIELDS)
  const mergedArticles = mergeLocales(rawArticlesEn, rawArticlesJa, LOCALIZED_ARTICLE_FIELDS)

  const projects = assignSlugs(mergedProjects.map(normalizeProject))
  const articles = assignSlugs(mergedArticles.map(normalizeArticle))

  return { projects, articles }
}
