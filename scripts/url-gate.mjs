// URL gate for the hosting move (multi-site Phase 1). Proves every URL a
// visitor can reach today behaves the same after the move.
//
//   npm run gate -- capture                       baseline from production → .audit/url-baseline.json
//   npm run gate -- check                         production vs baseline
//   npm run gate -- check --preview <base-url>    a preview host vs baseline (www probes skipped)
//
// Exits 1 on any mismatch. Capture BEFORE the first cutover and keep the file.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildEntries, diffFingerprints, entryKey, extractLocs, fingerprint } from './lib/url-gate.js'

const BASELINE = new URL('../.audit/url-baseline.json', import.meta.url)
const ORIGINS = { global: 'https://mdmc.co', jp: 'https://mdmc.co.jp' }

async function text(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

async function productionEntries() {
  const index = await text('https://mdmc.co/sitemap-index.xml')
  const coLocs = []
  for (const sitemap of extractLocs(index)) coLocs.push(...extractLocs(await text(sitemap)))
  const cojpLocs = extractLocs(await text('https://mdmc.co.jp/sitemap-cojp.xml'))
  return buildEntries(coLocs, cojpLocs)
}

function requestFor(entry, previewBase) {
  if (previewBase) {
    return { url: previewBase.replace(/\/$/, '') + entry.path, headers: { cookie: `mdmc_site=${entry.site}` } }
  }
  const origin = entry.host ? `https://${entry.host}` : ORIGINS[entry.site]
  return { url: origin + entry.path, headers: {} }
}

async function fingerprintAll(entries, previewBase) {
  const result = {}
  const queue = entries.filter((e) => !(previewBase && e.host))
  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const { url, headers } = requestFor(e, previewBase)
      const res = await fetch(url, { redirect: 'manual', headers })
      const body = await res.text()
      result[entryKey(e)] = fingerprint(res.status, (n) => res.headers.get(n), body, new URL(url).origin)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return result
}

const [mode, flag, previewBase] = process.argv.slice(2)

if (mode === 'capture') {
  const entries = await productionEntries()
  const fingerprints = await fingerprintAll(entries)
  await mkdir(new URL('.', BASELINE), { recursive: true })
  await writeFile(BASELINE, JSON.stringify({ capturedAt: new Date().toISOString(), entries, fingerprints }, null, 2))
  console.log(`captured ${entries.length} URLs → .audit/url-baseline.json`)
} else if (mode === 'check') {
  const preview = flag === '--preview' ? previewBase : null
  const baseline = JSON.parse(await readFile(BASELINE, 'utf-8'))
  const current = await fingerprintAll(baseline.entries, preview)
  const expected = preview
    ? Object.fromEntries(Object.entries(baseline.fingerprints).filter(([k]) => k in current))
    : baseline.fingerprints
  const diffs = diffFingerprints(expected, current)
  for (const d of diffs) console.log(`✗ ${d.key}  ${d.field}: ${JSON.stringify(d.expected)} → ${JSON.stringify(d.actual)}`)
  console.log(`${Object.keys(current).length} URLs checked against baseline from ${baseline.capturedAt}: ${diffs.length} mismatches`)
  process.exit(diffs.length ? 1 : 0)
} else {
  console.error('usage: npm run gate -- capture | check [--preview <base-url>]')
  process.exit(2)
}
