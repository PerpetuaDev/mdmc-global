# Mobile & Tablet Re-composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mobile (<700px) and tablet (700–1023px) their own compositions — a touch-reachable drawer nav, an uncropped hero, a fluid type/space scale, and 44px tap targets — without moving desktop (>=1024px) by a single pixel.

**Architecture:** Token-first. A type/space scale lands in `src/styles/global.css`, fluid below 1024px and pinned to today's exact px at and above it, so desktop cannot move by construction. Component blocks are then re-expressed against those tokens, and the nine ad-hoc breakpoints collapse onto two (`max-width: 1023px`, `max-width: 699px`). A committed CDP-driven audit script measures real rendered geometry and is the gate for every CSS task.

**Tech Stack:** Astro 5.18 (SSG), vanilla CSS in per-component `<style>` blocks, vitest 269 tests over `src/lib`, Node 22 (global `WebSocket`, no CDP dependency needed), headless `google-chrome-stable`.

**Spec:** `docs/superpowers/specs/2026-09-03-mobile-tablet-recomposition-design.md`

## Global Constraints

- **Desktop (>=1024px) must not change.** Every token pins to its current literal px at `min-width: 1024px`. Proven by geometry snapshot diff at 1024, 1100 and 1440 — not by inspection.
- **Only exact matches adopt a token:** `12 -> --label`, `14 -> --text-s`, `20 -> --text`, `24 -> --text-l`. Sizes 13, 16, 17, 18, 19, 21, 22, 26, 28 keep literal px; where one reads too large on mobile it gets its own `clamp()` whose **upper bound is its current px**.
- **Two breakpoints only:** `@media (max-width: 1023px)` and `@media (max-width: 699px)`. Exception: the four `max-width: 1100px` rules straddle the desktop boundary and are split, never folded.
- **Audit gates, all must read zero:** horizontal overflow, text below 12px, interactive boxes below 44px.
- **Four trees:** every user-visible string goes through `t()` and existing `a11y.*` keys, in both dictionaries, covering `/`, `/en`, `/ja`, `/jp`.
- **Strapi is read-only in this pass.** No content edits; the 3 missing `hero_image` assets stay missing.
- **Tap targets grow by padding/min-height, never by scaling type** — visual weight must not change.
- **Commits are signed** (`commit.gpgsign=true`; gpg confirmed working this session). Commit locally; do not push until the user asks.
- **`--page-zoom` compensation applies only to `zoom`-world CSS (>=1024px).** Any viewport-height maths below 1024 must not divide by it.
- **Targeted de-inlining (spec §7):** when a task needs to style an element that carries an inline `style` attribute, move only that element's
  relevant declarations to a class in the component's `<style>` block, and only if the task already had to touch it. Never sweep a file. The
  `!important` count should fall as a side effect, never as a goal — `!important` remains correct where an inline layout style must be beaten
  (the established pattern; see the comment at `Header.astro:209`).

## File Structure

**Create:**
- `scripts/audit-responsive.mjs` — CDP audit + geometry snapshot/diff. The measuring instrument; no runtime dependency of the site.
- `src/components/NavDrawer.astro` — the below-1024 drawer (markup, styles, behaviour). Kept out of `Header.astro`, which is already 460 lines.
- `src/lib/text.js` — pure text helpers (manifesto unwrap). New file so `content.js` stays about content fetching.
- `test/text.test.js`, `test/audit-gates.test.js`

**Modify:**
- `src/styles/global.css` — token layer
- `src/components/Header.astro` — one-row header below 1024, mount drawer, stop rendering hover panels below 1024
- `src/views/HomeView.astro` — hero frame/source, manifesto unwrap, visible-slide cycling
- `src/lib/content.js` — `thumbSlidesOf()` alongside `heroSlidesOf()`
- `src/views/ContactView.astro` — jump-link list
- `src/views/WorkIndexView.astro`, `NewsIndexView.astro`, `CareersView.astro`, `JobView.astro`, `ArticleView.astro`, `AboutView.astro`, `AboutJpView.astro`, `src/pages/404.astro`, `src/components/WorkCard.astro`, `ProjectHeader.astro`, `PullQuote.astro`, `StoryView.astro`, `GalleryStack.astro`, `Footer.astro` — breakpoint consolidation, token adoption, tap targets
- `package.json` — `audit:responsive` script

---

### Task 1: Audit script (the measuring instrument)

Must come first: every later task is gated by it, and it captures the pre-change baseline.

**Files:**
- Create: `scripts/audit-responsive.mjs`
- Modify: `package.json`
- Create: `test/audit-gates.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run audit:responsive` (exit 1 on any gate violation); `node scripts/audit-responsive.mjs --snapshot <file> --widths 1024,1100,1440`; `node scripts/audit-responsive.mjs --diff <file>`. Also exports `evaluateGates(pageResult)` from the same file for unit testing.

- [ ] **Step 1: Write the failing test for the gate logic**

The browser-driving part isn't unit-testable, but the pass/fail rules are. Create `test/audit-gates.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { evaluateGates } from '../scripts/audit-responsive.mjs'

describe('evaluateGates', () => {
  const clean = { path: '/', overflowPx: 0, tinyText: [], smallTaps: [] }

  it('passes a clean page', () => {
    expect(evaluateGates(clean)).toEqual([])
  })

  it('ignores negative overflow (reserved scrollbar gutter)', () => {
    expect(evaluateGates({ ...clean, overflowPx: -15 })).toEqual([])
  })

  it('fails on positive overflow', () => {
    const v = evaluateGates({ ...clean, overflowPx: 3 })
    expect(v).toHaveLength(1)
    expect(v[0].gate).toBe('overflow')
  })

  it('fails on text below 12px', () => {
    const v = evaluateGates({ ...clean, tinyText: [{ fs: 10, cls: 'locale-code' }] })
    expect(v[0].gate).toBe('type-floor')
  })

  it('fails on an interactive box below 44px', () => {
    const v = evaluateGates({ ...clean, smallTaps: [{ w: 25, h: 30, cls: 'studio-plus' }] })
    expect(v[0].gate).toBe('tap-floor')
  })

  it('reports every violated gate at once', () => {
    const v = evaluateGates({
      path: '/x', overflowPx: 5,
      tinyText: [{ fs: 11, cls: 'a' }],
      smallTaps: [{ w: 20, h: 20, cls: 'b' }],
    })
    expect(v.map((x) => x.gate).sort()).toEqual(['overflow', 'tap-floor', 'type-floor'])
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run test/audit-gates.test.js`
Expected: FAIL — cannot resolve `../scripts/audit-responsive.mjs`.

- [ ] **Step 3: Write the script**

Create `scripts/audit-responsive.mjs`. Node 22 has a global `WebSocket`, so CDP needs no dependency. Measuring the real top-level viewport (via `Emulation.setDeviceMetricsOverride`) is deliberate — an iframe harness reports the gutter-inset frame width, not the viewport, and gets media queries subtly wrong.

```js
#!/usr/bin/env node
// Responsive audit. Drives headless Chrome over CDP (no deps — Node 22 has a
// global WebSocket) and measures real rendered geometry against three gates:
// no horizontal overflow, no text under 12px, no interactive box under 44px.
//
// Needs `npm run dev` on :4321 and google-chrome-stable installed. It is a
// dev-machine tool, not a hermetic unit test — hence not in the vitest suite.
//
//   npm run audit:responsive
//   node scripts/audit-responsive.mjs --widths 390,768 --json out.json
//   node scripts/audit-responsive.mjs --snapshot desktop.json --widths 1024,1100,1440
//   node scripts/audit-responsive.mjs --diff desktop.json --widths 1024,1100,1440
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const TYPE_FLOOR_PX = 12
export const TAP_FLOOR_PX = 44
export const ORIGIN = process.env.AUDIT_ORIGIN ?? 'http://localhost:4321'

// The 10 distinct page types. Locale trees are separate runs (--prefix).
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
      else console.warn(`  (no ${section} detail page found — template not audited)`)
    } catch {
      console.warn(`  (could not reach ${section} index)`)
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
  if (page.tinyText?.length) {
    v.push({ gate: 'type-floor', detail: `${page.tinyText.length} under ${TYPE_FLOOR_PX}px`, offenders: page.tinyText })
  }
  if (page.smallTaps?.length) {
    v.push({ gate: 'tap-floor', detail: `${page.smallTaps.length} under ${TAP_FLOOR_PX}px`, offenders: page.smallTaps })
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
    rmSync(this.profile, { recursive: true, force: true })
  }
}

// Runs INSIDE the page. Returns geometry + gate offenders.
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
    // A control inside an open <dialog> that is closed measures 0 and is skipped above.
    if (interactive && (r.width < ${TAP_FLOOR_PX} || r.height < ${TAP_FLOOR_PX})) {
      smallTaps.push({ tag, cls: clsOf(el), w: Math.round(r.width), h: Math.round(r.height), txt: txt.slice(0, 20) });
    }
  }
  const dedupe = (a, k, n) => { const m = new Map(); for (const o of a) if (!m.has(k(o))) m.set(k(o), o); return [...m.values()].slice(0, n) };
  return {
    vw,
    overflowPx: Math.round(Math.max(de.scrollWidth, document.body.scrollWidth) - vw),
    bodyFs: parseFloat(getComputedStyle(document.body).fontSize),
    offenders: dedupe(offenders, (o) => o.tag + o.cls, 8),
    tinyText: dedupe(tinyText, (o) => o.tag + o.cls + o.fs, 8),
    smallTaps: dedupe(smallTaps, (o) => o.tag + o.cls + o.w + 'x' + o.h, 12),
  };
})()`

// Geometry fingerprint for desktop-protection diffing. Deliberately coarse:
// stable landmark boxes, rounded to the pixel, so a real layout shift shows
// up but sub-pixel text reflow does not.
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
  out['zoom'] = getComputedStyle(document.querySelector('.zoom') || document.body).zoom;
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
    let diffs = 0
    for (const [i, run] of runs.entries()) {
      for (const [j, page] of run.results.entries()) {
        const was = before[i]?.results[j]?.snapshot ?? {}
        for (const k of new Set([...Object.keys(was), ...Object.keys(page.snapshot)])) {
          const a = JSON.stringify(was[k]), b = JSON.stringify(page.snapshot[k])
          if (a !== b) { console.log(`DIFF ${run.width}px ${page.path} ${k}: ${a} -> ${b}`); diffs++ }
        }
      }
    }
    console.log(diffs ? `\nDESKTOP CHANGED: ${diffs} geometry diffs` : '\nno desktop geometry diffs')
    return diffs ? 1 : 0
  }

  if (jsonTo) writeFileSync(jsonTo, JSON.stringify(runs, null, 2))

  let failed = 0
  for (const run of runs) {
    console.log(`\n=== ${run.width}px ===`)
    console.log('path'.padEnd(38) + 'ovf'.padStart(5) + 'tiny'.padStart(6) + 'taps'.padStart(6))
    for (const page of run.results) {
      const v = evaluateGates(page)
      console.log(page.path.padEnd(38) + String(page.overflowPx).padStart(5)
        + String(page.tinyText.length).padStart(6) + String(page.smallTaps.length).padStart(6))
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
```

- [ ] **Step 4: Add the npm script**

In `package.json` `scripts`, after `"test"`:

```json
"audit:responsive": "node scripts/audit-responsive.mjs --widths 390,768"
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `npx vitest run test/audit-gates.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Confirm 404 path handling**

`/__404__/` is a deliberately non-existent path used to render the 404 page. Verify the dev server serves the 404 view there:

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4321/__404__/`
Expected: `404`. If the audit reports `error` for that path, change `PATHS` to use `/404/` — Astro dev serves the 404 page at a real path in some configs. Fix and re-run before proceeding.

- [ ] **Step 7: Capture the pre-change baselines**

With `npm run dev` running:

```bash
mkdir -p .audit
node scripts/audit-responsive.mjs --widths 390,768 --json .audit/before-mobile.json
node scripts/audit-responsive.mjs --snapshot .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: mobile run reports violations (that is the point — roughly 22–40 tap failures and 4–15 type failures per page). Desktop snapshot writes 3 widths x 10 paths.

Add `.audit/` to `.gitignore` — these are local measurements, not artifacts.

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-responsive.mjs test/audit-gates.test.js package.json .gitignore
git commit -S -m "Add a responsive audit script with three numeric gates

Drives headless Chrome over CDP (no dependency — Node 22 ships a global
WebSocket) and measures real rendered geometry: no horizontal overflow,
no text under 12px, no interactive box under 44px.

Also snapshots landmark geometry at desktop widths so a later change can
prove it did not move desktop, rather than asserting it."
```

---

### Task 2: Token layer

**Files:**
- Modify: `src/styles/global.css:31-38` (the `:root` block) and `:72-75` (the zoom block)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--label`, `--tap`, `--text-s`, `--text`, `--text-l`, `--sp-1` … `--sp-7`. Fluid below 1024px, pinned above.

This task adds tokens with **no consumers**, so desktop and mobile geometry must both be byte-identical afterwards. That is the test.

- [ ] **Step 1: Add the tokens**

In `src/styles/global.css`, extend the existing `:root` block (which currently holds `--ink`, `--paper`, `--muted`, `--hairline`, `--faint`, `--ph`, `--gutter-l`, `--gutter-r`, `--ease`) with:

```css
  /* Type and space scale (2026-09-03). Fluid below 1024px; pinned to the
     literal desktop px in the min-width:1024px block below, so desktop
     cannot move. Only sizes that already EQUAL a token's desktop value may
     adopt it — see the spec: adopting a near-miss would shift desktop.
     The display tier is deliberately absent: the five heading clamp()s are
     already fluid and are left alone. */
  --label: 12px;   /* hard floor — the header locale code was 10px */
  --tap: 44px;

  --text-s: clamp(13px, 3.4vw, 14px);
  --text:   clamp(16px, 4.1vw, 20px);
  --text-l: clamp(19px, 5.2vw, 24px);

  /* The observed 8/16/24/32/48/64/96 rhythm, compressed on narrow
     viewports — 96px section gaps cost real scroll at 390px. */
  --sp-1: 8px;
  --sp-2: 16px;
  --sp-3: clamp(16px, 4.1vw, 24px);
  --sp-4: clamp(20px, 5.5vw, 32px);
  --sp-5: clamp(28px, 8.2vw, 48px);
  --sp-6: clamp(36px, 11vw, 64px);
  --sp-7: clamp(44px, 16vw, 96px);
```

- [ ] **Step 2: Pin them at desktop**

Extend the existing `@media (min-width: 1024px)` block (which currently sets `--page-zoom: 0.85` and `.zoom { zoom: 0.85 }`) — do not create a second one:

```css
@media (min-width: 1024px) {
  :root { --page-zoom: 0.85; }
  .zoom { zoom: 0.85; }
  /* Pin the scale so desktop is unaffected by the fluid definitions above.
     --label/--tap/--sp-1/--sp-2 are constants and need no pinning. */
  :root {
    --text-s: 14px; --text: 20px; --text-l: 24px;
    --sp-3: 24px; --sp-4: 32px; --sp-5: 48px; --sp-6: 64px; --sp-7: 96px;
  }
}
```

- [ ] **Step 3: Verify nothing moved anywhere**

Tokens have no consumers yet, so both gates must be unchanged.

```bash
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
node scripts/audit-responsive.mjs --widths 390,768 --json .audit/after-t2.json
```

Expected: `no desktop geometry diffs`, and the 390/768 violation counts identical to `.audit/before-mobile.json`. If either moved, a token name collided with something — fix before proceeding.

- [ ] **Step 4: Confirm the tokens actually resolve**

A token that is defined but shadowed is a silent no-op, so prove both branches
resolve. Add this one-off script (delete it afterwards; it reuses the audit
script's Chrome class):

```js
// scratch/token-probe.mjs
import { Chrome } from '../scripts/audit-responsive.mjs'
const chrome = await Chrome.launch(9224)
await chrome.attach()
for (const w of [390, 1440]) {
  await chrome.setWidth(w)
  await chrome.visit('http://localhost:4321/')
  const v = await chrome.evaluate(`JSON.stringify({
    text: getComputedStyle(document.body).fontSize,
    sp7: getComputedStyle(document.documentElement).getPropertyValue('--sp-7').trim(),
  })`)
  console.log(w, v)
}
chrome.close()
```

Run: `node scratch/token-probe.mjs`
Expected: at 390 `--sp-7` resolves through the clamp (a computed px value near
62px); at 1440 it is exactly `96px`. Record both numbers in the commit message.

This requires `Chrome` to be exported from the audit script — add `export` to
the `class Chrome` declaration in Task 1 if it is not already there.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css
git commit -S -m "Add a type and space scale, fluid below 1024px

Tokens are pinned to their literal desktop px at min-width:1024px, so
desktop cannot move. No consumers yet — verified zero geometry diff at
1024/1100/1440 and unchanged mobile gate counts.

The display tier is untouched: its five heading clamp()s are already fluid."
```

---

### Task 3: Breakpoint consolidation

**Files:**
- Modify: `src/components/ProjectHeader.astro:86`, `PullQuote.astro:44`, `StoryView.astro:231`, `WorkCard.astro:78`, `src/pages/404.astro:16,22`, `src/views/AboutJpView.astro:47`, `AboutView.astro:40`, `ArticleView.astro:95,117`, `CareersView.astro:40`, `ContactView.astro:316`, `HomeView.astro:112`, `JobView.astro:144,230`

**Interfaces:**
- Consumes: Task 2 tokens (not yet used, but the two-block grammar is what Task 4 writes into).
- Produces: exactly two breakpoints site-wide, `max-width: 1023px` and `max-width: 699px`, plus explicitly-justified desktop-side rules for the 1100px band.

- [ ] **Step 1: Inventory every stray with its current effect**

```bash
grep -rn --include='*.astro' -E "max-width: *(1100|900|880|820|720|640|560|460|400)px" src/
```

For each, record in a scratch note: file, line, the width, and which of the two target blocks it belongs in. Rules:
- `900, 880, 820, 720` -> `max-width: 1023px` (tablet). These all sit inside the tablet band already.
- `640, 560, 460, 400` -> `max-width: 699px` (mobile).
- `1100` -> **split** (Step 3).

- [ ] **Step 2: Move the eight non-1100 strays**

For each, change the media query width to its target and merge into an existing
block for that component if one is already present. **Copy the declarations
verbatim** — do not retype them, and do not tidy them. Shape of the change
(selectors and values will differ per file; use whatever is actually there):

```css
/* before */
@media (max-width: 720px) { <existing selector> { <existing declarations> } }

/* after — same declarations, moved onto the tablet breakpoint and merged
   into this component's existing max-width:1023px block if it has one */
@media (max-width: 1023px) {
  /* …declarations already in this block… */
  <existing selector> { <existing declarations> }
}
```

Do not change any declaration values in this task. Only the query widths and block merging. Value changes belong to Task 4, so that a geometry diff here is unambiguously a breakpoint mistake.

- [ ] **Step 3: Split the four 1100px rules**

Each `max-width: 1100px` block currently applies to 1024–1100 (desktop zoom world) **and** everything below. Folding it into `1023px` would remove it from 1024–1100 and change desktop. Split each into two blocks with the same declarations:

```css
/* before */
@media (max-width: 1100px) { .foo { padding-left: 40px; } }

/* after — desktop band keeps the rule verbatim; tablet-and-below gets it too */
@media (min-width: 1024px) and (max-width: 1100px) { .foo { padding-left: 40px; } }
@media (max-width: 1023px)                        { .foo { padding-left: 40px; } }
```

Add a comment on each desktop-side block noting it exists to preserve the 1024–1100 band and must not be folded.

- [ ] **Step 4: Verify desktop is untouched and mobile is unchanged**

```bash
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
node scripts/audit-responsive.mjs --widths 390,768 --json .audit/after-t3.json
```

Expected: `no desktop geometry diffs` — the 1100 split is the risky part and this is what proves it. Mobile violation counts identical to `.audit/before-mobile.json`, because no values changed.

- [ ] **Step 5: Confirm only two breakpoints remain**

```bash
grep -rho --include='*.astro' --include='*.css' "max-width: *[0-9]*px" src/ | sort | uniq -c
```

Expected: only `max-width: 1023px` and `max-width: 699px`, plus the four `max-width: 1100px` desktop-side rules (which will be paired with `min-width: 1024px`). Anything else is a miss.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -S -m "Collapse nine ad-hoc breakpoints onto the two-tier grammar

1023px for tablet, 699px for mobile. No declaration values change here, so
any geometry diff would be a breakpoint mistake — verified none at
1024/1100/1440 and unchanged mobile gate counts.

The four max-width:1100px rules are split rather than folded: they span
1024-1100, inside the desktop zoom world, so folding them into 1023px
would have changed desktop."
```

---

### Task 4: Token adoption and the 12px type floor

**Files:**
- Modify: `src/components/Header.astro:120` (10px locale code), `src/views/CareersView.astro:77,83` (11px meta), plus the 12/14/20/24px sites across the files listed in File Structure

**Interfaces:**
- Consumes: Task 2 tokens; Task 3's two-block grammar.
- Produces: no text below 12px at any width; the `type-floor` gate reads zero.

- [ ] **Step 1: Replace exact-match sizes with tokens**

Only these four substitutions, everywhere they appear as a literal `font-size`:

| Current | Becomes |
|---|---|
| `font-size: 12px` | `font-size: var(--label)` |
| `font-size: 14px` | `font-size: var(--text-s)` |
| `font-size: 20px` | `font-size: var(--text)` |
| `font-size: 24px` | `font-size: var(--text-l)` |

Find them with:

```bash
grep -rn --include='*.astro' --include='*.css' -E "font-size: *(12|14|20|24)px" src/
```

Leave `13, 16, 17, 18, 19, 21, 22, 26, 28` alone — they have no exact token and adopting a near-miss would move desktop.

Note `.label` in `global.css:39` sets `font-size: 12px`; that becomes `var(--label)` and most `.label` consumers then need no change.

- [ ] **Step 2: Lift the two sub-12px sizes**

`src/components/Header.astro:120` — the locale code, currently the smallest text on the site at 10px:

```astro
<span data-locale-code style="font-size: var(--label); letter-spacing: 0.14em; color: var(--muted); position: relative; top: -1px">{defaultLocale.toUpperCase()}</span>
```

`src/views/CareersView.astro:77,83` — drop the 11px override so the `.label` class value applies:

```astro
<div class="label">{t("careers.meta.studio")}</div>
<div class="label">{t("careers.meta.type")}</div>
```

- [ ] **Step 3: Verify the type gate is clean and desktop is untouched**

```bash
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: `tiny` column reads `0` on every path at both widths. `no desktop geometry diffs` — the locale code goes 10px -> 12px at *all* widths, which is a deliberate exception to "desktop cannot move"; it is a 2px type change on one element, not a layout change, so the landmark snapshot should not move. **If the snapshot does diff on `header[data-header]`, stop and report** — the header may be sized by that span.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -S -m "Adopt the type tokens and lift everything to a 12px floor

Only exact matches adopt (12/14/20/24); the in-between sizes keep literal
px because a token pins to one desktop value and adopting a near-miss
would shift desktop.

The header locale code (10px) and careers meta (11px) rise to 12px at all
widths — the one intentional sub-pixel-budget change to desktop, and a
type change rather than a layout one."
```

---

### Task 5: 44px tap-target floor

**Files:**
- Modify: `src/components/Header.astro` (`.nav-link`, `.locale-trigger`), `Footer.astro` (`.studio-plus`, footer links), `src/views/WorkIndexView.astro` (`.filter-trigger`), `ContactView.astro` (jump links)

**Interfaces:**
- Consumes: `--tap` from Task 2.
- Produces: the `tap-floor` gate reads zero at 390 and 768.

Grow by padding and min-height only. Type size and visual weight must not change — these are text links in an editorial design, and making them look like buttons would be wrong.

- [ ] **Step 1: Establish a shared helper class**

In `src/styles/global.css`, after `.label`:

```css
/* Touch ergonomics (2026-09-03): below the zoom world, interactive text
   needs a 44px box without gaining visual weight. Padding grows the hit
   area; the negative margin keeps the *optical* position unchanged so the
   desktop composition's spacing still reads correctly. Desktop opts out
   entirely — it has a cursor. */
@media (max-width: 1023px) {
  .tap {
    min-height: var(--tap);
    display: inline-flex;
    align-items: center;
  }
}
```

- [ ] **Step 2: Apply it in the tablet/mobile blocks**

`Header.astro`, inside the existing `@media (max-width: 1023px)` block:

```css
    header[data-header] .nav-link,
    header[data-header] .locale-trigger {
      min-height: var(--tap) !important;
      display: inline-flex !important;
      align-items: center !important;
    }
```

`Footer.astro`, in its `max-width: 1023px` block — `.studio-plus` is 25x30, the worst offender:

```css
    .studio-plus {
      min-width: var(--tap) !important;
      min-height: var(--tap) !important;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
    }
    .footer-link { min-height: var(--tap); display: inline-flex; align-items: center; }
```

`WorkIndexView.astro` — `.filter-trigger` is 28px tall:

```css
    .filter-trigger {
      min-height: var(--tap) !important;
      display: inline-flex !important;
      align-items: center;
    }
```

The `!important` is required because these elements carry inline layout styles from the handoff transcription — the established pattern in this codebase (see the comment at `Header.astro:209`).

- [ ] **Step 3: Verify**

```bash
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: `taps` column reads `0` on every path at both widths; `no desktop geometry diffs` (the rules are scoped to `max-width: 1023px`).

If any offender remains, the audit prints its tag/class/size — fix and re-run. Expect the contact jump links to still fail here; they are restructured in Task 8, so it is acceptable for `/contact/` to be the one remaining failure entering Task 6. **Record that explicitly in the commit message rather than leaving it implied.**

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -S -m "Give interactive text a 44px hit area below 1024px

Grown by padding and min-height, never by scaling type — these are
editorial text links and should not gain button weight. Scoped to
max-width:1023px, so desktop (which has a cursor) is untouched.

Worst offenders closed: .studio-plus 25x30, .filter-trigger 28px tall,
.nav-link 37px, .locale-trigger 33px. The contact jump links still fail
the gate; they are restructured in Task 8."
```

---

### Task 6: Manifesto unwrap

**Files:**
- Create: `src/lib/text.js`, `test/text.test.js`
- Modify: `src/views/HomeView.astro:40-41`

**Interfaces:**
- Consumes: nothing.
- Produces: `unwrapAuthoredBreaks(text: string): string` from `src/lib/text.js` — collapses authored newlines to single spaces, preserving paragraph breaks (blank lines).

`HomeView.astro:40-41` currently does `t("home.manifesto.1").split("\n").map(escAmp)`, rendering one element per authored line. Those breaks are sized for desktop; at 390 each line wraps again and orphans its last word.

- [ ] **Step 1: Write the failing test**

Create `test/text.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { unwrapAuthoredBreaks } from '../src/lib/text.js'

describe('unwrapAuthoredBreaks', () => {
  it('joins single newlines with a space', () => {
    expect(unwrapAuthoredBreaks('We help great products find the people\nwho\'ll love them'))
      .toBe("We help great products find the people who'll love them")
  })

  it('preserves paragraph breaks', () => {
    expect(unwrapAuthoredBreaks('one\ntwo\n\nthree')).toBe('one two\n\nthree')
  })

  it('collapses runs of whitespace introduced by the join', () => {
    expect(unwrapAuthoredBreaks('a  \n  b')).toBe('a b')
  })

  it('trims each resulting paragraph', () => {
    expect(unwrapAuthoredBreaks('  a\nb  ')).toBe('a b')
  })

  it('is a no-op on text with no newlines', () => {
    expect(unwrapAuthoredBreaks('nothing to do')).toBe('nothing to do')
  })

  it('handles CRLF', () => {
    expect(unwrapAuthoredBreaks('a\r\nb')).toBe('a b')
  })

  it('returns empty string for empty or nullish input', () => {
    expect(unwrapAuthoredBreaks('')).toBe('')
    expect(unwrapAuthoredBreaks(undefined)).toBe('')
    expect(unwrapAuthoredBreaks(null)).toBe('')
  })

  it('does not merge Japanese lines with a space (no inter-character space in JA)', () => {
    expect(unwrapAuthoredBreaks('私たちは\nデザイン')).toBe('私たちはデザイン')
  })
})
```

The last case matters: joining Japanese lines with a Latin space inserts a visible gap that is wrong in JA typesetting. The implementation must join with `''` when the characters either side of the break are CJK.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/text.test.js`
Expected: FAIL — cannot resolve `../src/lib/text.js`.

- [ ] **Step 3: Implement**

Create `src/lib/text.js`:

```js
// Pure text helpers. Kept out of content.js, which is about fetching and
// normalizing Strapi payloads.

// CJK ranges wide enough for the copy this site carries: hiragana, katakana,
// CJK unified ideographs, and full-width punctuation.
const CJK = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/

/**
 * Collapse authored single newlines into spaces, preserving paragraph breaks.
 *
 * The home manifesto carries line breaks sized for the desktop measure. At a
 * narrow measure each authored line wraps again and orphans its last word, so
 * below 1024px the copy is rendered as flowing paragraphs instead.
 *
 * Japanese does not put spaces between characters, so a break between two CJK
 * characters joins with nothing rather than a space.
 */
export function unwrapAuthoredBreaks(text) {
  if (!text) return ''
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
          if (!acc) return line
          const joiner = CJK.test(acc.slice(-1)) && CJK.test(line[0]) ? '' : ' '
          return acc + joiner + line
        }, '')
        .replace(/[ \t]{2,}/g, ' ')
    )
    .filter(Boolean)
    .join('\n\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/text.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Use it in HomeView**

`HomeView.astro` currently splits on `\n` and renders a line per element. Keep the desktop rendering exactly as-is and add a second, unwrapped rendering for below 1024, toggled by CSS so no JavaScript is involved:

```astro
---
import { unwrapAuthoredBreaks } from "../lib/text.js";
// …existing imports…

const manifesto1 = t("home.manifesto.1").split("\n").map(escAmp);
const manifesto2 = t("home.manifesto.2").split("\n").map(escAmp);
// Below 1024 the authored line breaks orphan their last word at a narrow
// measure, so the same copy is also emitted as flowing paragraphs and the
// two are swapped by media query. Both are in the DOM; only one is shown.
const manifesto1Flow = escAmp(unwrapAuthoredBreaks(t("home.manifesto.1")));
const manifesto2Flow = escAmp(unwrapAuthoredBreaks(t("home.manifesto.2")));
---
```

Wrap the existing per-line markup in `<span class="manifesto-lined">` and add the flowing version as `<span class="manifesto-flow">`, then:

```css
  .manifesto-flow { display: none; }
  @media (max-width: 1023px) {
    .manifesto-lined { display: none; }
    .manifesto-flow  { display: block; }
  }
```

Emitting both is deliberate: the copy is two short paragraphs, so the duplicated bytes are negligible, and a CSS swap keeps it correct with JavaScript disabled and immune to resize.

- [ ] **Step 6: Verify**

```bash
npx vitest run
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: 269 + 8 + 6 = 283 tests pass. `no desktop geometry diffs`.

Then screenshot `/` at 390 and confirm the manifesto reads as paragraphs with no orphaned single words:

```bash
google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=390,1600 --screenshot=.audit/t6-manifesto.png http://localhost:4321/
```

Look at the image. Also check `/ja/` — the JA manifesto must not gain spaces between characters.

- [ ] **Step 7: Commit**

```bash
git add src/lib/text.js test/text.test.js src/views/HomeView.astro
git commit -S -m "Let the home manifesto flow below 1024px

Its authored line breaks are sized for the desktop measure; at 390px each
one wrapped again and orphaned its last word ('people', 'honest',
'noise.'). Both renderings are emitted and swapped by media query, so it
stays correct without JavaScript and across resizes.

Japanese joins with no space, since JA does not space between characters."
```

---

### Task 7: Hero re-composition

The most delicate task: the slide *set* differs by breakpoint, so the cycling script must count visible slides.

**Files:**
- Modify: `src/lib/content.js:404-406`, `src/views/HomeView.astro` (frame CSS, slide markup, cycling script)
- Modify: `test/content.test.js`

**Interfaces:**
- Consumes: `unwrapAuthoredBreaks` is unrelated; nothing from Task 6.
- Produces: `thumbSlidesOf(projects, count?)` from `src/lib/content.js` — the newest `count` projects that have a `thumbnail`, default 6.

- [ ] **Step 1: Write the failing test**

Append to `test/content.test.js`:

```js
import { thumbSlidesOf } from '../src/lib/content.js'

describe('thumbSlidesOf', () => {
  const p = (slug, thumb, hero) => ({ slug, thumbnail: thumb, heroImage: hero })

  it('returns projects that have a thumbnail', () => {
    const out = thumbSlidesOf([p('a', 'a.jpg'), p('b', 'b.jpg')])
    expect(out.map((x) => x.slug)).toEqual(['a', 'b'])
  })

  it('skips projects with no thumbnail', () => {
    const out = thumbSlidesOf([p('a', 'a.jpg'), p('b', null), p('c', 'c.jpg')])
    expect(out.map((x) => x.slug)).toEqual(['a', 'c'])
  })

  it('does not require a heroImage — that is the whole point', () => {
    const out = thumbSlidesOf([p('a', 'a.jpg', null)])
    expect(out).toHaveLength(1)
  })

  it('caps at six by default', () => {
    const many = Array.from({ length: 9 }, (_, i) => p(`p${i}`, 't.jpg'))
    expect(thumbSlidesOf(many)).toHaveLength(6)
  })

  it('honours an explicit count', () => {
    const many = Array.from({ length: 9 }, (_, i) => p(`p${i}`, 't.jpg'))
    expect(thumbSlidesOf(many, 3)).toHaveLength(3)
  })

  it('tolerates nullish input', () => {
    expect(thumbSlidesOf(null)).toEqual([])
    expect(thumbSlidesOf(undefined)).toEqual([])
  })

  it('is a superset of heroSlidesOf when every project has both', () => {
    const both = [p('a', 'a.jpg', 'A.jpg'), p('b', 'b.jpg', 'B.jpg')]
    expect(thumbSlidesOf(both).length).toBeGreaterThanOrEqual(heroSlidesOf(both).length)
  })
})
```

`heroSlidesOf` is already imported at the top of that file; add `thumbSlidesOf` to the existing import rather than a second import statement.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/content.test.js`
Expected: FAIL — `thumbSlidesOf is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/content.js`, beside `heroSlidesOf` (line 404):

```js
// Mobile and tablet slide on thumbnails, not hero images: the hero assets are
// 2600x1200 and object-fit:cover into a narrow frame discarded 74% of each
// one (measured 2026-09-03). Thumbnails are 4:3 and every project has one, so
// the narrow hero shows the full set rather than the three with hero art.
export const THUMB_SLIDE_COUNT = 6

export function thumbSlidesOf(projects, count = THUMB_SLIDE_COUNT) {
  return (projects ?? []).filter((p) => p?.thumbnail).slice(0, count)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/content.test.js`
Expected: PASS. The existing `heroSlidesOf` tests stay green.

- [ ] **Step 5: Render the union of both slide sets**

In `HomeView.astro`, replace `const heroSlides = heroSlidesOf(projects)` with the thumbnail set, and mark which members also have hero art:

```astro
const thumbSlides = thumbSlidesOf(projects);
const first = thumbSlides[0];
```

For each slide, emit one `<picture>` whose `<source media="(min-width: 1024px)">` points at the hero image and whose `<img>` src is the thumbnail. The browser downloads exactly one. Slides with no `heroImage` get `class="hero-slide is-thumb-only"`:

```astro
{thumbSlides.map((p, i) => (
  <div
    class:list={["hero-slide", { "is-thumb-only": !p.heroImage }]}
    data-hero-slide
    style={`opacity: ${i === 0 ? 1 : 0}`}
  >
    <picture>
      {p.heroImage && <source media="(min-width: 1024px)" srcset={p.heroImage.url} />}
      <img src={p.thumbnail.url} alt="" width="1600" height="1200" />
    </picture>
  </div>
))}
```

Then hide the hero-less slides in the zoom world, so desktop still shows exactly the three it shows today:

```css
  @media (min-width: 1024px) {
    /* Desktop keeps the hero-art-only set: heroSlidesOf()'s guard, expressed
       in CSS now that the DOM carries the wider thumbnail set. */
    .hero-slide.is-thumb-only { display: none; }
  }
```

- [ ] **Step 6: Make the frame 4:3 below 1024**

In `HomeView.astro`'s `.hero-frame` rules, add to the `max-width: 1023px` block:

```css
    .hero-frame {
      /* The desktop fold rule (100svh/--page-zoom - 266.7px) encodes desktop
         header metrics and is meaningless against a one-row header, so the
         narrow frame is a plain 4:3 box instead — which is also the
         thumbnail's own ratio, so nothing crops. */
      height: auto !important;
      min-height: 0 !important;
      aspect-ratio: 4 / 3;
    }
```

Also confirm the JS re-measure at `HomeView.astro:246-251` is desktop-only. It reads `.zoom`'s computed `zoom` and sets a height; below 1024 that must not run. Guard it:

```js
    // The fold rule is a zoom-world concept — below 1024 the frame is a 4:3
    // box sized by CSS and this measurement must not fight it.
    if (!matchMedia('(min-width: 1024px)').matches) return
```

- [ ] **Step 7: Make the cycling script count visible slides**

The script currently cycles over all slide elements. With six in the DOM and three shown at desktop, it would fade to `display: none` slides for 6s each. Change it to build its list from visible slides and rebuild on resize:

```js
  // The DOM carries the mobile slide set (all projects with a thumbnail);
  // desktop hides the ones without hero art. So the cycle must run over
  // *visible* slides, and be rebuilt when a resize crosses 1024.
  const allSlides = [...document.querySelectorAll('[data-hero-slide]')]
  let slides = []
  let index = 0
  let timer = null

  const visible = () => allSlides.filter((el) => getComputedStyle(el).display !== 'none')

  function rebuild() {
    const next = visible()
    const changed = next.length !== slides.length
    slides = next
    if (changed) {
      index = 0
      allSlides.forEach((el) => { el.style.opacity = '0' })
      if (slides[0]) slides[0].style.opacity = '1'
    }
    if (timer) clearInterval(timer)
    if (slides.length > 1) timer = setInterval(advance, 6000)
  }

  function advance(step = 1) {
    if (slides.length < 2) return
    slides[index].style.opacity = '0'
    index = (index + step + slides.length) % slides.length
    slides[index].style.opacity = '1'
  }

  rebuild()
  addEventListener('resize', rebuild)
```

Wire the existing prev/next arrow handlers to `advance(-1)` and `advance(1)`, and make them reset the interval so a manual advance does not immediately auto-advance.

- [ ] **Step 8: Verify slide counts at both worlds**

```bash
# desktop: 3 visible, 0 placeholders
google-chrome-stable --headless=new --disable-gpu --no-sandbox --window-size=1440,900 \
  --virtual-time-budget=9000 --dump-dom http://localhost:4321/ | grep -c 'hero-slide'
```

Better, measure it properly — add a one-off check with the audit script's CDP path, or in a browser console at each width:

```js
[...document.querySelectorAll('[data-hero-slide]')]
  .filter(el => getComputedStyle(el).display !== 'none').length
```

Expected: `6` at 390 and 768; `3` at 1440. Also confirm exactly one network request per slide (DevTools Network, filter Img) — if both the hero and the thumbnail download, the `<picture>` is wrong.

Then:

```bash
npx vitest run
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: all tests pass; gates unchanged or better; **`no desktop geometry diffs`** — note `.hero-frame` is in the snapshot selector list, so this specifically proves the desktop hero did not move.

- [ ] **Step 9: Screenshot and look at it**

```bash
google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=390,1200 --virtual-time-budget=9000 --screenshot=.audit/t7-hero-390.png http://localhost:4321/
google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=768,1200 --virtual-time-budget=9000 --screenshot=.audit/t7-hero-768.png http://localhost:4321/
```

Look at both. The hero must be an uncropped 4:3 image with the project title and arrows legible over it. A letterboxed or centre-cropped slice means the `<picture>` is still serving the hero asset.

- [ ] **Step 10: Commit**

```bash
git add src/lib/content.js test/content.test.js src/views/HomeView.astro
git commit -S -m "Slide thumbnails, uncropped, in a 4:3 hero below 1024px

The narrow hero was a portrait box fed 2600x1200 landscape art through
object-fit:cover, so 74% of every image was cropped away (measured: frame
319x558, image scaled to 1209px wide, visible fraction 0.264).

Below 1024 it now slides each project's 4:3 thumbnail at its own ratio, so
nothing crops and all six projects appear instead of the three with hero
art. One <picture> per slide means one download, not both.

The cycle counts visible slides and rebuilds on resize, since desktop
hides the hero-less ones. Desktop geometry verified unchanged."
```

---

### Task 8: Contact jump-links and tablet two-column identity

**Files:**
- Modify: `src/views/ContactView.astro`, `src/views/WorkIndexView.astro`, `src/views/NewsIndexView.astro`

**Interfaces:**
- Consumes: `--tap`, `--sp-*` from Task 2.
- Produces: the `tap-floor` gate reads zero on `/contact/` and `/jp/contact/`, closing the exception Task 5 recorded.

- [ ] **Step 1: Make the jump-links a list on mobile**

The four studio jump-links currently wrap into a lumpy 2x2 cluster. In `ContactView.astro`'s `max-width: 699px` block:

```css
    .contact-jumps {
      display: flex !important;
      flex-direction: column;
      gap: 0 !important;
      align-items: flex-start;
    }
    .contact-jumps > a {
      min-height: var(--tap);
      display: inline-flex;
      align-items: center;
      width: 100%;
      border-bottom: 1px solid var(--hairline);
    }
```

If the container has no class, add `class="contact-jumps"` to it rather than styling by element position.

- [ ] **Step 2: Give tablet its two-column grids**

Tablet currently inherits mobile's single column, which wastes a 768px measure. In `WorkIndexView.astro` and `NewsIndexView.astro`, inside `max-width: 1023px` (and *not* inside `max-width: 699px`):

```css
    /* Tablet earns two columns — at 768 a single column leaves the measure
       half empty. Mobile stays one column via the 699px block below. */
    .work-grid, .news-grid { grid-template-columns: 1fr 1fr !important; gap: var(--sp-5) var(--sp-4) !important; }
```

Confirm the existing `max-width: 699px` block still forces one column; if it does not, add it.

- [ ] **Step 3: Apply the compressed spacing rhythm**

Replace section-gap literals with tokens in the views, using the mapping from the spec: `96px -> var(--sp-7)`, `80px -> var(--sp-7)`, `64px -> var(--sp-6)`, `48px -> var(--sp-5)`, `32px -> var(--sp-4)`, `24px -> var(--sp-3)`, `16px -> var(--sp-2)`, `8px -> var(--sp-1)`.

Apply **only to vertical section rhythm** (`margin-top`, `margin-bottom`, `padding-top`, `padding-bottom`, and grid `row-gap` between sections). Leave horizontal padding and small intra-component gaps as literals — they are not the scroll problem and changing them widens the diff for no gain.

Because `--sp-*` pin at 1024, desktop values are unchanged.

- [ ] **Step 4: Verify**

```bash
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: **all three gates read zero on every path at both widths** — this is the first task where that should be fully true. `no desktop geometry diffs`.

- [ ] **Step 5: Screenshot tablet and mobile contact**

```bash
for w in 390 768; do
  google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=$w,1600 --virtual-time-budget=9000 \
    --screenshot=.audit/t8-contact-$w.png http://localhost:4321/contact/
  google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=$w,1600 --virtual-time-budget=9000 \
    --screenshot=.audit/t8-work-$w.png http://localhost:4321/work/
done
```

Look at all four. Contact's jump-links should read as a ruled list; work at 768 should be two columns, at 390 one.

- [ ] **Step 6: Commit**

```bash
git add src/views/
git commit -S -m "Give tablet two columns and make contact's jumps a list

The four studio jump-links wrapped into a lumpy 2x2 cluster with 22px-tall
targets; they are a ruled list with 44px rows on mobile now. Tablet gets
two-column work and news grids — a single column left a 768px measure half
empty, which is why tablet read as 'mobile, wider'.

Section rhythm moves onto the space tokens, compressing large gaps about a
third at 390 (96->62, 64->43) while desktop stays pinned. All three audit
gates now read zero at 390 and 768."
```

---

### Task 9: Drawer — markup and styles

Split from behaviour so a reviewer can reject the composition without rejecting the mechanics.

**Files:**
- Create: `src/components/NavDrawer.astro`
- Modify: `src/components/Header.astro`

**Interfaces:**
- Consumes: `t()`, `href()`, `pickLocalized`, and the `workItems` / `newsItems` / `regions` / `languages` arrays already computed in `Header.astro`.
- Produces: `<NavDrawer {locale} {site} {active} {workItems} {newsItems} {regions} {languages} {defaultRegion} {defaultLocale} />`, rendering a `<dialog data-drawer>` plus a `<button data-drawer-open>` trigger.

- [ ] **Step 1: Create the component**

`src/components/NavDrawer.astro`. It takes the same data the hover panels use, so there is one source of truth. Props are passed in rather than re-fetched — `Header.astro` already has them.

Contents, in order: the four nav destinations, recent work, latest news, studios (region), language.

```astro
---
// The below-1024 nav. The desktop supermenu opens on mouseenter only
// (Header.astro), so before this existed no touch user could reach its four
// panels — 17 links shipped as unreachable DOM. This renders the same data as
// a full-screen dialog and the hover panels stop rendering below 1024, so
// nothing is shipped twice.
//
// <dialog> is deliberate: showModal() gives focus containment, Escape, and a
// backdrop natively, none of which this codebase has machinery for.
import { pickLocalized } from "../lib/i18n.js";

const { locale, active, workItems, newsItems, regions, languages, defaultRegion, defaultLocale, t, href } = Astro.props;
---

<button
  type="button"
  data-drawer-open
  class="drawer-trigger"
  aria-expanded="false"
  aria-label={t("a11y.openMenu")}
>
  <span class="drawer-bar" aria-hidden="true"></span>
  <span class="drawer-bar" aria-hidden="true"></span>
</button>

<dialog data-drawer class="drawer" aria-label={t("a11y.primaryNav")}>
  <div class="drawer-head">
    <span class="label">{t("nav.menu")}</span>
    <button type="button" data-drawer-close class="drawer-close" aria-label={t("a11y.closeMenu")}>
      <span aria-hidden="true">✕</span>
    </button>
  </div>

  <nav class="drawer-nav" aria-label={t("a11y.primaryNav")}>
    <a href={href("/work/")}    class:list={["drawer-link", { "is-active": active === "work" }]}>{t("nav.work")}</a>
    <a href={href("/news/")}    class:list={["drawer-link", { "is-active": active === "news" }]}>{t("nav.news")}</a>
    <a href={href("/about/")}   class:list={["drawer-link", { "is-active": active === "about" }]}>{t("nav.about")}</a>
    <a href={href("/careers/")} class:list={["drawer-link", { "is-active": active === "careers" }]}>{t("nav.careers")}</a>
    <a href={href("/contact/")} class:list={["drawer-link", { "is-active": active === "contact" }]}>{t("nav.contact")}</a>
  </nav>

  <div class="drawer-section">
    <span class="label">{t("work.title")}</span>
    <ul>
      {workItems.slice(0, 4).map((p) => (
        <li><a href={href(`/work/${p.slug}/`)} class="drawer-sublink">{pickLocalized(locale, p, "title")}</a></li>
      ))}
    </ul>
  </div>

  {newsItems.length > 0 && (
    <div class="drawer-section">
      <span class="label">{t("news.title")}</span>
      <ul>
        {newsItems.slice(0, 3).map((n) => (
          <li><a href={href(`/news/${n.slug}/`)} class="drawer-sublink">{pickLocalized(locale, n, "title")}</a></li>
        ))}
      </ul>
    </div>
  )}

  <div class="drawer-section">
    <span class="label">{t("nav.region")}</span>
    <ul class="drawer-inline">
      {regions.map((r) => (
        <li>{r.href
          ? <a href={r.href} data-region={r.code} data-region-link class="drawer-chip">{r.label}</a>
          : <button type="button" data-region={r.code} class:list={["drawer-chip", { "is-active": r.code === defaultRegion }]}>{r.label}</button>}
        </li>
      ))}
    </ul>
  </div>

  <div class="drawer-section">
    <span class="label">{t("nav.language")}</span>
    <ul class="drawer-inline">
      {languages.map((l) => (
        <li><a href={l.href} data-locale={l.code} data-locale-link
               class:list={["drawer-chip", { "is-active": l.code === defaultLocale }]}>{l.label}</a></li>
      ))}
    </ul>
  </div>
</dialog>
```

- [ ] **Step 2: Add the two new i18n keys**

`nav.menu`, `a11y.openMenu` and `a11y.closeMenu` do not exist yet. Add to **both** dictionaries in `src/lib/i18n.js`, matching the existing `a11y.*` style:

`src/lib/i18n.js` uses single quotes and groups `a11y.*` together under a
comment (see `'a11y.homeLink': 'MDMC home'` at line 153). Match that exactly:

```js
// en dict, beside the other a11y.* entries
'nav.menu': 'Menu',
'a11y.openMenu': 'Open menu',
'a11y.closeMenu': 'Close menu',

// ja dict, same positions
'nav.menu': 'メニュー',
'a11y.openMenu': 'メニューを開く',
'a11y.closeMenu': 'メニューを閉じる',
```

The JA strings are machine-drafted and belong on the native-review list in `project_mdmc_status` memory — flag them in the commit message.

- [ ] **Step 3: Verify the i18n parity test still passes**

`test/i18n.test.js` has 85 tests, some asserting full key parity between dictionaries.

Run: `npx vitest run test/i18n.test.js`
Expected: PASS. A failure here means a key was added to one dictionary only.

- [ ] **Step 4: Style it, and switch the header to one row**

In `NavDrawer.astro`'s `<style>`: hide the trigger and dialog at `min-width: 1024px` entirely; below that, full-viewport dialog, `--sp-*` rhythm, `var(--tap)` on every link and chip, `var(--text-l)` on `.drawer-link`.

```css
  .drawer-trigger, .drawer { display: none; }
  @media (max-width: 1023px) {
    .drawer-trigger {
      display: inline-flex; flex-direction: column; justify-content: center; gap: 6px;
      min-width: var(--tap); min-height: var(--tap);
    }
    .drawer-bar { display: block; width: 26px; height: 1px; background: var(--ink); }
    .drawer[open] {
      display: flex; flex-direction: column; gap: var(--sp-5);
      position: fixed; inset: 0; width: 100%; max-width: none; height: 100%; max-height: none;
      margin: 0; border: 0; padding: var(--sp-4) var(--gutter-r) var(--sp-6) var(--gutter-l);
      background: var(--paper); color: var(--ink); overflow-y: auto;
    }
    .drawer::backdrop { background: rgba(0,0,0,0.4); }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; }
    .drawer-close { min-width: var(--tap); min-height: var(--tap); display: inline-flex; align-items: center; justify-content: center; }
    .drawer-nav { display: flex; flex-direction: column; }
    .drawer-link {
      font-size: var(--text-l); min-height: var(--tap);
      display: inline-flex; align-items: center; border-bottom: 1px solid var(--hairline);
    }
    .drawer-link.is-active { font-weight: 500; }
    .drawer-section ul { list-style: none; }
    .drawer-section .label { display: block; margin-bottom: var(--sp-2); }
    .drawer-sublink { font-size: var(--text); min-height: var(--tap); display: inline-flex; align-items: center; }
    .drawer-inline { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); }
    .drawer-chip { min-height: var(--tap); display: inline-flex; align-items: center; font-size: var(--text); }
    .drawer-chip.is-active { text-decoration: underline; text-underline-offset: 5px; }
  }
```

In `Header.astro`, mount the drawer and collapse the header below 1024. Replace the `max-width: 1023px` and `max-width: 699px` header blocks with a single one-row treatment:

```css
  @media (max-width: 1023px) {
    header[data-header] {
      grid-template-columns: auto 1fr auto !important;
      padding-top: var(--sp-4) !important;
      padding-bottom: var(--sp-3) !important;
      row-gap: 0 !important;
    }
    /* The inline nav, the spacer and the locale trigger all move into the
       drawer below 1024 — the header is wordmark + hamburger only. */
    header[data-header] > nav,
    header[data-header] .header-spacer,
    header[data-header] .locale-trigger { display: none !important; }
    /* The hover panels are desktop-only; not rendering them below 1024
       keeps their 17 links off the wire instead of shipping them twice. */
    header[data-header] [data-mega] { display: none !important; }
  }
```

- [ ] **Step 5: Verify composition and gates**

```bash
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: all gates zero (the dialog is closed, so its controls measure 0 and are skipped — see the comment in `MEASURE`). `no desktop geometry diffs`, which specifically proves `header[data-header] > nav` did not move at desktop.

Screenshot the closed header at 390 and 768 and look at it: wordmark left, hamburger right, nothing else.

- [ ] **Step 6: Commit**

```bash
git add src/components/NavDrawer.astro src/components/Header.astro src/lib/i18n.js
git commit -S -m "Add the mobile and tablet nav drawer (markup and styles)

Below 1024 the header collapses to wordmark plus hamburger, and the nav,
region and language controls move into a full-screen <dialog>. It renders
the same data the desktop hover panels do, and those stop rendering below
1024 so nothing ships twice.

Behaviour lands in the next commit; the dialog is inert until then.

New keys nav.menu / a11y.openMenu / a11y.closeMenu are machine-drafted in
ja and need the native review pass."
```

---

### Task 10: Drawer — behaviour

**Files:**
- Modify: `src/components/NavDrawer.astro` (script block)

**Interfaces:**
- Consumes: `data-drawer`, `data-drawer-open`, `data-drawer-close` from Task 9.
- Produces: no exports; a self-contained inline script.

- [ ] **Step 1: Write the behaviour**

Append a `<script>` to `NavDrawer.astro`:

```js
  // <dialog>.showModal() handles focus containment, Escape and the backdrop.
  // What it does not handle: background scroll, and surviving a navigation.
  // The site uses cross-document view transitions, so a drawer left open
  // would still be painted as the next page fades in.
  const dialog = document.querySelector('[data-drawer]')
  const trigger = document.querySelector('[data-drawer-open]')
  const closer = document.querySelector('[data-drawer-close]')
  if (dialog && trigger) {
    const open = () => {
      dialog.showModal()
      trigger.setAttribute('aria-expanded', 'true')
      // Scroll lock. position:fixed on body would lose scroll position, so
      // overflow on the root is used; the reserved scrollbar-gutter in
      // global.css means this does not shift the page width.
      document.documentElement.style.overflow = 'hidden'
    }
    const close = () => {
      if (dialog.open) dialog.close()
    }
    // `close` fires for Escape and for dialog.close() alike, so the teardown
    // lives here rather than in the click handler.
    dialog.addEventListener('close', () => {
      trigger.setAttribute('aria-expanded', 'false')
      document.documentElement.style.overflow = ''
    })
    trigger.addEventListener('click', open)
    closer?.addEventListener('click', close)
    // Click on the backdrop (the dialog element itself, outside its content).
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close() })
    // Any in-drawer navigation must close it — see the view-transition note.
    dialog.addEventListener('click', (e) => { if (e.target.closest('a')) close() })
    addEventListener('pagehide', close)
    // Crossing into the zoom world hides the trigger; a drawer left open
    // would then be unclosable.
    matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) close() })
  }
```

- [ ] **Step 2: Drive it and confirm each behaviour**

There is no component-test harness in this repo, so verify by driving a real browser. Check every one of these:

1. Tap hamburger at 390 -> drawer opens full-screen
2. `aria-expanded` flips to `true`
3. Background does not scroll while open
4. Escape closes it; `aria-expanded` returns to `false`; background scrolls again
5. Tapping the backdrop closes it
6. Tapping a nav link navigates **and** the drawer is closed on the next page
7. Tab cycles only within the drawer (native `<dialog>` containment)
8. Resizing from 390 to 1440 with the drawer open closes it
9. At 1440 the hamburger is not rendered and the hover supermenu still works
10. Region and language links inside the drawer still switch tree — the existing delegated handlers in `Header.astro` bind on `[data-region-link]` / `[data-locale-link]`, which the drawer reuses. **If region switching does not work, the handlers are scoped to the header element; widen the selector to `document` and note it.**

Use the CDP script pattern from `scripts/audit-responsive.mjs` if driving it by hand is awkward.

- [ ] **Step 3: Run the full gates**

```bash
npx vitest run
node scripts/audit-responsive.mjs --widths 390,768
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: all tests pass, all gates zero, no desktop diffs.

- [ ] **Step 4: Audit the drawer while it is open**

The standing audit measures the closed state. Confirm the open drawer also has no undersized targets and no overflow, by opening it and evaluating the same measurement — every `.drawer-link` and `.drawer-chip` must be >= 44px.

- [ ] **Step 5: Commit**

```bash
git add src/components/NavDrawer.astro
git commit -S -m "Wire the drawer: modal focus, scroll lock, close on navigate

<dialog>.showModal() covers focus containment, Escape and the backdrop.
Added on top: root-level scroll lock, close on any in-drawer link (the
site uses cross-document view transitions, so an open drawer would be
painted over the incoming page), close on pagehide, and close when a
resize crosses into the zoom world where the trigger is not rendered.

Verified open-state targets clear the 44px floor too — the standing audit
only sees the closed state."
```

---

### Task 11: Full-matrix verification and cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-09-03-mobile-tablet-recomposition.md` (append an outcomes section, matching the convention of the phase plans in this directory)

- [ ] **Step 1: Run the whole matrix across all four trees**

```bash
for prefix in "" "/en" "/ja" "/jp"; do
  echo "=== tree: ${prefix:-/} ==="
  node scripts/audit-responsive.mjs --widths 390,768 --prefix "$prefix"
done
```

Expected: `all gates pass` for every tree. The `/jp` tree is only reachable on the co.jp origin in production but exists in the origin build, so it audits locally like the rest.

- [ ] **Step 2: Prove desktop never moved**

```bash
node scripts/audit-responsive.mjs --diff .audit/desktop-baseline.json --widths 1024,1100,1440
```

Expected: `no desktop geometry diffs`. This baseline was captured in Task 1 before any change, so it is the whole-pass guarantee, not a per-task one.

- [ ] **Step 3: Build and run the real suite**

```bash
npx vitest run
npm run build
```

Expected: 283+ tests pass; build succeeds with 27 routes (or more — the route count should not drop).

- [ ] **Step 4: Screenshot review at both widths**

```bash
mkdir -p .audit/shots
for w in 390 768; do
  for path in / /work/ /about/ /contact/ /careers/ /news/ /ja/ /ja/about/; do
    name=$(echo "$path" | tr -c 'a-zA-Z0-9' '-')
    google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
      --window-size=$w,1800 --virtual-time-budget=9000 \
      --screenshot=".audit/shots/${w}${name}.png" "http://localhost:4321${path}"
  done
done
ls .audit/shots/
```

**Look at every image** — a screenshot you did not open is not a review.
Confirm on each: no orphaned single words in the manifesto, hero uncropped and
4:3, two columns at 768 and one at 390, drawer trigger present and nav/locale
absent from the header bar, and JA copy with no spaces inserted between
characters.

- [ ] **Step 5: Confirm the supermenu is off the wire below 1024**

```bash
curl -s http://localhost:4321/ | grep -c 'data-mega'
```

The markup is CSS-hidden rather than omitted, so this still returns a count — that is expected and matches what Task 9 implemented. **If removing the bytes entirely is wanted, it needs a server-side breakpoint, which Astro cannot do at build time for a single static page.** Note this honestly in the outcomes section rather than claiming the bytes are saved.

- [ ] **Step 6: Append outcomes to this plan**

Follow the convention in `docs/superpowers/plans/2026-08-21-language-region-matrix.md`: record what shipped, what was deferred, and any gotchas discovered — especially anything that contradicts the spec.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/2026-09-03-mobile-tablet-recomposition.md
git commit -S -m "Record the mobile and tablet pass outcomes

All three gates read zero across 10 page types x {390,768} x four trees,
and desktop geometry is unchanged at 1024/1100/1440 against the baseline
captured before any edit."
```

---

## Deferred (not in this plan)

- The 3 missing 2600x1200 `hero_image` assets in Strapi. The thumbnail hero makes them non-blocking below 1024, but desktop still shows 3 slides until they exist.
- Native-JA review of `nav.menu`, `a11y.openMenu`, `a11y.closeMenu`.
- Wiring `audit:responsive` into CI.
- A global inline-style refactor. Only touched elements were de-inlined.
- Removing the supermenu markup from the below-1024 payload (needs a runtime breakpoint; see Task 11 Step 5).
