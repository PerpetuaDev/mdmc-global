// Build-time content snapshot: fetches all Strapi content and writes it to
// src/content-snapshot.json, which the frontend uses as a last-known-good
// fallback when the live CMS is unreachable at runtime (see strapi.js).
//
// Runs in CI before `vite build` (refreshing the snapshot on every deploy)
// and can be run locally any time:
//
//   node scripts/snapshot-content.mjs
//
// If Strapi is unreachable, the existing snapshot is left untouched and the
// script exits 0 so a CMS outage never blocks a deploy — the last good
// snapshot ships instead. Token from $VITE_STRAPI_TOKEN or .env.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://upbeat-approval-82a9e54c20.strapiapp.com/api'
const OUT = resolve(ROOT, 'src/content-snapshot.json')

async function token() {
  if (process.env.VITE_STRAPI_TOKEN) return process.env.VITE_STRAPI_TOKEN
  try {
    const env = await readFile(resolve(ROOT, '.env'), 'utf8')
    const m = env.match(/^VITE_STRAPI_TOKEN=(.*)$/m)
    return m ? m[1].trim() : ''
  } catch { return '' }
}

// Kept in lockstep with src/lib/content.js's PROJECTS_POPULATE/ARTICLES_POPULATE.
// `populate=*` alone doesn't reach a component's nested media (gallery.image),
// and combining `populate=*` with ANY `populate[x]=...` bracket key 500s on
// this Strapi Cloud instance (confirmed live) — so these list every
// relation/media field explicitly instead of using the wildcard at all.
const PROJECTS_POPULATE =
  'populate[thumbnail]=true&populate[hero_image]=true&populate[gallery][populate]=image&populate[disciplines][fields][0]=name'
const ARTICLES_POPULATE = 'populate[cover]=true&populate[hero_image]=true&populate[project]=true'
// Kept in lockstep with src/lib/content.js's ABOUT_POPULATE/ABOUT_JAPAN_POPULATE/
// CAREER_POPULATE/JOBS_POPULATE. `offers` is deliberately not populated on
// career — ignored this phase per the content-layer-v3 brief.
const ABOUT_POPULATE =
  'populate[hero_image]=true'
const ABOUT_JAPAN_POPULATE = 'populate[hero_image]=true&populate[signature_portrait]=true'
const CAREER_POPULATE = 'populate[hero_image]=true'
const JOBS_POPULATE = 'populate[hero_image]=true'

const ENDPOINTS = {
  projects_en: `/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=en`,
  projects_ja: `/projects?${PROJECTS_POPULATE}&sort=date:desc&locale=ja`,
  articles_en: `/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=en`,
  articles_ja: `/articles?${ARTICLES_POPULATE}&sort=date:desc&locale=ja`,
  about: `/about?${ABOUT_POPULATE}`,
  about_japan: `/about-japan?${ABOUT_JAPAN_POPULATE}`,
  career_en: `/career?${CAREER_POPULATE}&locale=en`,
  career_ja: `/career?${CAREER_POPULATE}&locale=ja`,
  jobs_en: `/jobs?${JOBS_POPULATE}&locale=en`,
  jobs_ja: `/jobs?${JOBS_POPULATE}&locale=ja`,
}

const tok = await token()
const headers = tok ? { Authorization: `Bearer ${tok}` } : {}

let existing = {}
try { existing = JSON.parse(await readFile(OUT, 'utf8')) } catch {}

const snapshot = { generatedAt: new Date().toISOString() }
let fetched = 0

// Per-endpoint tolerance: a 404 (content type not deployed yet) or a single
// flaky endpoint keeps that key's previous value instead of aborting the
// whole snapshot. If NOTHING could be fetched, keep the old file untouched.
for (const [key, path] of Object.entries(ENDPOINTS)) {
  try {
    const res = await fetch(`${API}${path}`, { headers })
    if (!res.ok) throw new Error(`${res.status}`)
    snapshot[key] = (await res.json()).data ?? null
    fetched++
  } catch (err) {
    console.warn(`snapshot-content: ${path} failed (${err.message}) — keeping previous value`)
    snapshot[key] = existing[key] ?? null
  }
}

if (fetched === 0) {
  console.warn('snapshot-content: nothing fetched — keeping existing snapshot')
  process.exit(0)
}

await writeFile(OUT, JSON.stringify(snapshot))
const projects = snapshot.projects_en?.length ?? 0
console.log(`snapshot-content: wrote ${OUT.replace(ROOT + '/', '')} (${projects} projects, generated ${snapshot.generatedAt})`)
