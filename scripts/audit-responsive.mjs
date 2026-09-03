#!/usr/bin/env node
// Responsive audit. Drives headless Chrome over CDP (no dependency — Node 22
// ships a global WebSocket) and measures real rendered geometry against three
// gates: no horizontal overflow, no text under 12px, no interactive box under
// 44px.
//
// Needs `npm run dev` on :4321 and google-chrome-stable installed. It is a
// dev-machine tool, not a hermetic unit test — hence not in the vitest suite.
//
// Measuring the top-level viewport (via Emulation.setDeviceMetricsOverride) is
// deliberate: an iframe harness reports the gutter-inset frame width rather
// than the viewport, and gets media queries subtly wrong.
//
//   npm run audit:responsive
//   node scripts/audit-responsive.mjs --widths 390,768 --json out.json
//   node scripts/audit-responsive.mjs --snapshot desktop.json --widths 1024,1100,1440
//   node scripts/audit-responsive.mjs --diff desktop.json --widths 1024,1100,1440
//   node scripts/audit-responsive.mjs --widths 390 --prefix /ja
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const TYPE_FLOOR_PX = 12
export const TAP_FLOOR_PX = 44
export const ORIGIN = process.env.AUDIT_ORIGIN ?? 'http://localhost:4321'

// Index pages are fixed; the three detail pages are DISCOVERED from their
// index at run time rather than hardcoded — slugs come from Strapi and any
// hardcoded list goes stale silently the next time content changes.
export const INDEX_PATHS = ['/', '/work/', '/news/', '/about/', '/careers/', '/contact/', '/__404__/']

/** Scrape one detail slug per section so the audit covers those templates. */
export async function discoverPaths(prefix = '') {
  const detail = []
  for (const section of ['work', 'news', 'careers']) {
    try {
      const html = await (await fetch(`${ORIGIN}${prefix}/${section}/`)).text()
      const m = html.match(new RegExp(`href="${prefix}/${section}/([^"/]+)/"`))
      if (m) detail.push(`${prefix}/${section}/${m[1]}/`)
      else console.warn(`  (no ${section} detail page found — that template is not audited)`)
    } catch {
      console.warn(`  (could not reach the ${section} index)`)
    }
  }
  return [...INDEX_PATHS.map((p) => (p === '/__404__/' ? p : prefix + p)), ...detail]
}

/** Pure gate evaluation — unit-tested in test/audit-gates.test.js. */
export function evaluateGates(page) {
  const v = []
  if (page.overflowPx > 0) {
    v.push({ gate: 'overflow', detail: `${page.overflowPx}px`, offenders: page.offenders ?? [] })
  }
  // Counts are the true totals (tinyTextCount/smallTapCount); the arrays are a
  // capped sample of distinct kinds. Fall back to array length so the pure
  // unit tests can pass minimal fixtures.
  const tinyN = page.tinyTextCount ?? page.tinyText?.length ?? 0
  if (tinyN) {
    v.push({ gate: 'type-floor', detail: `${tinyN} under ${TYPE_FLOOR_PX}px`, offenders: page.tinyText ?? [] })
  }
  const tapN = page.smallTapCount ?? page.smallTaps?.length ?? 0
  if (tapN) {
    v.push({ gate: 'tap-floor', detail: `${tapN} under ${TAP_FLOOR_PX}px`, offenders: page.smallTaps ?? [] })
  }
  return v
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class Chrome {
  static async launch(port = 9222) {
    const profile = mkdtempSync(join(tmpdir(), 'mdmc-audit-'))
    const proc = spawn('google-chrome-stable', [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore' })
    let wsUrl
    for (let i = 0; i < 60 && !wsUrl; i++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl } catch {}
      if (!wsUrl) await sleep(200)
    }
    if (!wsUrl) { proc.kill(); rmSync(profile, { recursive: true, force: true }); throw new Error('Chrome did not start') }
    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')) })
    return new Chrome(proc, ws, profile)
  }

  constructor(proc, ws, profile) {
    this.proc = proc; this.ws = ws; this.profile = profile
    this.id = 0; this.pending = new Map()
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id) }
    }
  }

  send(method, params = {}, sessionId) {
    return new Promise((res) => {
      const i = ++this.id
      this.pending.set(i, res)
      this.ws.send(JSON.stringify({ id: i, method, params, sessionId }))
    })
  }

  async attach() {
    const { result: { targetInfos } } = await this.send('Target.getTargets')
    const page = targetInfos.find((t) => t.type === 'page')
    const { result: { sessionId } } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
    await this.send('Page.enable', {}, sessionId)
    this.sessionId = sessionId
  }

  async setWidth(width) {
    await this.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 }, this.sessionId)
  }

  async visit(url) {
    await this.send('Page.navigate', { url }, this.sessionId)
    await sleep(1400)
  }

  async evaluate(expression) {
    const { result } = await this.send('Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true }, this.sessionId)
    return result?.result?.value
  }

  close() {
    try { this.ws.close() } catch {}
    this.proc.kill()
    // proc.kill() is async, so Chrome may still be flushing its profile when
    // we try to remove it (ENOTEMPTY on Default/). Retry a little, and never
    // let cleanup throw — a leftover temp dir is harmless, losing a completed
    // audit run to a teardown error is not.
    try {
      rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      // left in /tmp; the OS will reap it
    }
  }
}

// Runs INSIDE the page. Returns geometry plus gate offenders.
const MEASURE = `(() => {
  const de = document.documentElement, vw = innerWidth;
  const offenders = [], tinyText = [], smallTaps = [];
  const clsOf = (el) => (typeof el.className === 'string' ? el.className : '').slice(0, 40);
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({ tag: el.tagName.toLowerCase(), cls: clsOf(el), right: Math.round(r.right), w: Math.round(r.width) });
    }
    const fs = parseFloat(cs.fontSize), txt = (el.textContent || '').trim();
    if (fs && fs < ${TYPE_FLOOR_PX} && txt && !el.children.length) {
      tinyText.push({ tag: el.tagName.toLowerCase(), cls: clsOf(el), fs: +fs.toFixed(1), txt: txt.slice(0, 24) });
    }
    const tag = el.tagName.toLowerCase();
    const interactive = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'summary';
    // A control inside a closed <dialog> measures 0 and is skipped above.
    //
    // Height is required of everything. WIDTH is only required of symbolic
    // controls — an icon or glyph button ('+', '<', '>') must be graspable in
    // both axes, but an inline text link is as wide as its word and demanding
    // 44px would force artificial padding onto 'Work' (40px) or 'English'
    // (43px), distorting an editorial design to satisfy a number. WCAG 2.5.8
    // exempts inline text for the same reason; text links here still get a
    // 44px height plus the 24px WCAG minimum width.
    if (interactive) {
      const symbolic = txt.replace(/\\s/g, '').length <= 2;
      const minW = symbolic ? ${TAP_FLOOR_PX} : 24;
      if (r.width < minW || r.height < ${TAP_FLOOR_PX}) {
        smallTaps.push({ tag, cls: clsOf(el), w: Math.round(r.width), h: Math.round(r.height),
                         txt: txt.slice(0, 20), need: minW + 'x' + ${TAP_FLOOR_PX} });
      }
    }
  }
  // Report TRUE totals alongside a capped sample of distinct kinds. Reporting
  // only the capped sample would saturate at the cap — every page reading
  // exactly 12 tells you nothing about whether a fix helped.
  const dedupe = (a, k, n) => { const m = new Map(); for (const o of a) if (!m.has(k(o))) m.set(k(o), o); return [...m.values()].slice(0, n) };
  return {
    vw,
    overflowPx: Math.round(Math.max(de.scrollWidth, document.body.scrollWidth) - vw),
    bodyFs: parseFloat(getComputedStyle(document.body).fontSize),
    offenderCount: offenders.length,
    tinyTextCount: tinyText.length,
    smallTapCount: smallTaps.length,
    offenders: dedupe(offenders, (o) => o.tag + o.cls, 8),
    tinyText: dedupe(tinyText, (o) => o.tag + o.cls + o.fs, 8),
    smallTaps: dedupe(smallTaps, (o) => o.tag + o.cls + o.w + 'x' + o.h, 12),
  };
})()`

// Geometry fingerprint for desktop-protection diffing. Deliberately coarse:
// stable landmark boxes rounded to the pixel, so a real layout shift shows up
// but sub-pixel text reflow does not.
const SNAPSHOT = `(() => {
  const sel = ['header[data-header]', 'header[data-header] > nav', 'main',
               '.hero-frame', '.work-grid', 'footer', '.gutter'];
  const out = {};
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out[s] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }
  out['body:fontSize'] = getComputedStyle(document.body).fontSize;
  out['zoom'] = String(getComputedStyle(document.querySelector('.zoom') || document.body).zoom);
  // Landmark boxes alone miss changes that do not move a box — a gutter's
  // padding can change without its element's width moving. So record the
  // resolved design tokens too: that makes "desktop is pinned" a directly
  // verified fact rather than something inferred from layout.
  // NOTE: this whole block is a JS template literal evaluated in the BROWSER.
  // Do not use backticks or \${} inside it — the backtick would close the
  // outer string and \${} would interpolate in Node, not in the page. String
  // concatenation only.
  const rs = getComputedStyle(document.documentElement);
  const TOKENS = ['--gutter-l', '--gutter-r', '--label', '--tap',
                  '--text-s', '--text', '--text-l',
                  '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7'];
  for (const t of TOKENS) {
    const v = rs.getPropertyValue(t).trim();
    if (v) out['token:' + t] = v;
  }
  const g = document.querySelector('.gutter') || document.querySelector('main');
  if (g) {
    const gs = getComputedStyle(g);
    out['gutter:padding'] = gs.paddingLeft + ' ' + gs.paddingRight;
  }
  return out;
})()`

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

async function run() {
  const widths = String(arg('widths', '390,768')).split(',').map(Number)
  const prefix = arg('prefix', '')
  const snapshotTo = arg('snapshot')
  const diffFrom = arg('diff')
  const jsonTo = arg('json')

  const paths = await discoverPaths(prefix)
  console.log(`auditing ${paths.length} paths: ${paths.join(' ')}`)

  const chrome = await Chrome.launch()
  await chrome.attach()

  const runs = []
  try {
    for (const width of widths) {
      await chrome.setWidth(width)
      const results = []
      for (const path of paths) {
        await chrome.visit(ORIGIN + path)
        const data = snapshotTo || diffFrom
          ? await chrome.evaluate(SNAPSHOT)
          : await chrome.evaluate(MEASURE)
        results.push({ path, ...(snapshotTo || diffFrom ? { snapshot: data } : data) })
      }
      runs.push({ width, results })
    }
  } finally {
    chrome.close()
  }

  if (snapshotTo) {
    writeFileSync(snapshotTo, JSON.stringify(runs, null, 2))
    console.log(`snapshot written: ${snapshotTo} (${runs.length} widths x ${paths.length} paths)`)
    return 0
  }

  if (diffFrom) {
    const before = JSON.parse(readFileSync(diffFrom, 'utf8'))
    // Key by width and path, NEVER by array position: snapshotting 1024,1100,
    // 1440 and diffing 1024,1440 would otherwise compare 1440 against the
    // 1100 baseline and report a page full of phantom diffs.
    const baseline = new Map()
    for (const run of before) {
      for (const page of run.results) baseline.set(`${run.width}|${page.path}`, page.snapshot ?? {})
    }
    // A key that APPEARED is additive — introducing a design token where none
    // existed cannot have moved desktop, and the token layer is meant to do
    // exactly that. A key whose value CHANGED is the regression we care about.
    // Conflating the two would make the token step unpassable by construction.
    let changed = 0
    let missing = 0
    const added = new Map()
    for (const run of runs) {
      for (const page of run.results) {
        const key = `${run.width}|${page.path}`
        const was = baseline.get(key)
        if (!was) {
          console.log(`NO BASELINE for ${key} — cannot verify this one`)
          missing++
          continue
        }
        for (const k of new Set([...Object.keys(was), ...Object.keys(page.snapshot)])) {
          const a = JSON.stringify(was[k]), b = JSON.stringify(page.snapshot[k])
          if (a === b) continue
          if (was[k] === undefined) {
            // Collapse across paths — the same token appears on all of them.
            added.set(`${run.width}px ${k}`, b)
          } else if (page.snapshot[k] === undefined) {
            console.log(`REMOVED ${run.width}px ${page.path} ${k}: was ${a}`)
            changed++
          } else {
            console.log(`CHANGED ${run.width}px ${page.path} ${k}: ${a} -> ${b}`)
            changed++
          }
        }
      }
    }
    if (added.size) {
      console.log('\nnew keys (additive — check the values are the intended desktop pins):')
      for (const [k, v] of [...added.entries()].sort()) console.log(`  + ${k} = ${v}`)
    }
    if (missing) console.log(`\n${missing} path/width pairs had no baseline — re-snapshot to cover them`)
    console.log(changed ? `\nDESKTOP CHANGED: ${changed} value diffs` : '\nno desktop geometry diffs')
    return changed || missing ? 1 : 0
  }

  if (jsonTo) writeFileSync(jsonTo, JSON.stringify(runs, null, 2))

  let failed = 0
  for (const run of runs) {
    console.log(`\n=== ${run.width}px ===`)
    console.log('path'.padEnd(38) + 'ovf'.padStart(5) + 'tiny'.padStart(6) + 'taps'.padStart(6))
    for (const page of run.results) {
      const v = evaluateGates(page)
      console.log(page.path.padEnd(38) + String(page.overflowPx).padStart(5)
        + String(page.tinyTextCount ?? page.tinyText.length).padStart(6)
        + String(page.smallTapCount ?? page.smallTaps.length).padStart(6))
      for (const x of v) {
        failed++
        console.log(`   FAIL ${x.gate}: ${x.detail}`)
        for (const o of x.offenders.slice(0, 4)) console.log(`        ${JSON.stringify(o)}`)
      }
    }
  }
  console.log(failed ? `\n${failed} gate violations` : '\nall gates pass')
  return failed ? 1 : 0
}

// Only run when invoked as a CLI, so the unit test can import evaluateGates.
if (process.argv[1] && process.argv[1].endsWith('audit-responsive.mjs')) {
  run().then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(2) })
}
