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

const ENDPOINTS = {
  projects_en: '/projects?populate=*&sort=date:desc&locale=en',
  projects_ja: '/projects?populate=*&sort=date:desc&locale=ja',
  articles_en: '/articles?populate=*&sort=date:desc&locale=en',
  articles_ja: '/articles?populate=*&sort=date:desc&locale=ja',
  members: '/members?populate=*&sort=order:asc',
  homepage_en: '/homepage?locale=en',
  homepage_ja: '/homepage?locale=ja',
  about: '/about?populate=*',
  about_japan: '/about-japan?populate=*',
  career_en: '/career?populate=*&locale=en',
  career_ja: '/career?populate=*&locale=ja',
  jobs_en: '/jobs?populate=*&locale=en',
  jobs_ja: '/jobs?populate=*&locale=ja',
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
