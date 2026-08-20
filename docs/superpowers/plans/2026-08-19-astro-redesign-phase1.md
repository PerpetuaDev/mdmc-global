# MDMC Redesign on Astro — Phase 1: Foundation, Chrome, Home

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new Astro static site on a `redesign/astro` branch with the redesign's design system, build-time Strapi content layer, shared chrome (header + supermenu, footer accordions with live clocks), and the redesigned Home page.

**Architecture:** Astro 5 static output replaces the React/Vite hash-router SPA, folding the long-planned SSG migration into the redesign. No UI framework — interactivity (supermenu, slideshow, accordions, clocks) is plain `<script>` in Astro components. Content is fetched from Strapi Cloud at build time with the committed snapshot as fallback, so CMS outages are never visitor-facing.

**Tech Stack:** Astro ^5, Vitest for the content-layer unit tests, vanilla JS for interactions. Strapi Cloud stays the CMS (existing instance, no schema changes in Phase 1).

**Spec:** `design/handoff/README.md` + `design/handoff/design/MDMC Site.dc.html` (copied into the repo by Task 1 from `~/Downloads/mdmc-site-redesign/design_handoff_mdmc_site/`). Screenshots in `design/handoff/screenshots/`. The prototype HTML is the measurement source of truth; the README is the token source of truth.

## Global Constraints

Copied verbatim from the handoff README — every task inherits these:

- Colors: ink `#000000`; page `#ffffff`; muted `rgba(0,0,0,0.36)`; hairline `rgba(0,0,0,0.12)`; faint `rgba(0,0,0,0.22)`; placeholder `rgb(217,217,217)`. Footer top rule is full black; all other rules the 0.12 hairline.
- Type: "Söhne" buch 400 / kräftig 500; fallback stack (from the prototype `<head>`, includes JP): `"Söhne", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Helvetica Neue", Helvetica, Arial, sans-serif`. Larsseit woff2s ship in the handoff but are **unused** (one stray `'Larsseit'` first in the home hero overlay name at prototype line 119 — treat as a prototype artifact, use Söhne; flag at review).
- Label voice everywhere: 12px (sometimes 11px), `letter-spacing: .14em`, uppercase, muted.
- Type scale: statements `clamp(48px,5.6vw,88px)/1.02 -0.025em 500`; page titles `clamp(40px,4.4vw,64px)/1.05 -0.02em 500`; section h2 32px 500 -0.01em; card titles 24px 500 -0.005em; lead 26px/1.45 -0.01em; body 20px/1.6; secondary 17–18px; captions 14px muted.
- Page gutters on every section: `padding-left: clamp(24px, 8.6458vw, 220px); padding-right: clamp(24px, 5.94vw, 152px)`.
- Spacing rhythm: 160px major sections (144–176 variants), 96px content blocks, 26px grid gutter, 48px label-column gap; label-column grid `240px minmax(0,720px)`.
- Arrows `→ ← ↓ ↗` set in Söhne 400. CTA: 20px text, `padding: 6px 0`, transparent bottom border → `currentColor` on hover.
- Motion: `pageIn .5–.6s cubic-bezier(.2,.7,.2,1)`; accordion `+` rotates 45° over .3s same easing; hovers .2s.
- `a { color: inherit; text-decoration: none }` — never blue browser links.
- Zoom: the prototype wraps everything in `zoom: 0.85`. We apply it **≥1024px only** (matches the live site's `--page-zoom` behavior so mobile text isn't shrunk) — deliberate deviation, confirm at first visual review.
- Reduced motion: this dev machine reports `prefers-reduced-motion: reduce` (GTK animations off), so guarded animations won't play in local Firefox. Verify motion with headless Chrome + CDP media-feature emulation (puppeteer-core recipe in scratchpad memory), not by eye in Firefox.
- Fonts are licensed (Klim). The current public repo already commits the OTFs, so committing the handoff woff2s is status quo — but **production licensing must be confirmed** (carry-over flag from the handoff README).
- Commit style: repo uses plain imperative subjects (see `git log`), Co-Authored-By Claude trailer.

---

### Task 1: Branch + Astro scaffold

**Files:**
- Create: branch `redesign/astro` (worktree via superpowers:using-git-worktrees)
- Create: `design/handoff/` (copy of `~/Downloads/mdmc-site-redesign/design_handoff_mdmc_site/`)
- Rewrite: `package.json`
- Create: `astro.config.mjs`, `src/pages/index.astro`
- Delete (on branch only): `index.html`, `vite.config.js`, `src/App.jsx`, `src/pages.jsx`, `src/chrome.jsx`, `src/i18n.jsx`, `src/main.jsx`, `src/turnstile.jsx`, `src/strapi.js`, `src/styles.css`, `src/assets/` (old app; `main` keeps everything)
- Keep: `public/CNAME`, `scripts/snapshot-content.mjs`, `src/content-snapshot.json`, `.github/`, `.gitignore`

**Interfaces:**
- Produces: a repo where `npm run dev` serves Astro on :4321 and `npm run build` emits `dist/`. Later tasks add files under `src/` freely.

- [ ] **Step 1: Create the worktree/branch** — `redesign/astro` off `main`, per superpowers:using-git-worktrees.

- [ ] **Step 2: Copy the handoff into the repo**

```bash
cp -r ~/Downloads/mdmc-site-redesign/design_handoff_mdmc_site design/handoff
```

- [ ] **Step 3: Replace the app scaffold.** Delete the Vite/React files listed above. Write:

`package.json`
```json
{
  "name": "mdmc-website",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.13.0"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
  }
}
```

`astro.config.mjs`
```js
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://mdmc.co',
  output: 'static',
  devToolbar: { enabled: false },
})
```

`src/pages/index.astro`
```astro
---
---
<h1>MDMC — Astro scaffold</h1>
```

- [ ] **Step 4: Install and verify**

Run: `rm -rf node_modules package-lock.json && npm install && npm run build`
Expected: `dist/index.html` exists and contains "Astro scaffold".
Then: `npm run dev` in background, `curl -s localhost:4321 | grep scaffold` → match.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Replace Vite SPA scaffold with Astro; vendor redesign handoff"
```

---

### Task 2: Content layer (build-time Strapi fetch + snapshot fallback)

**Files:**
- Create: `src/lib/content.js`, `src/lib/normalize.js`
- Test: `test/normalize.test.js`
- Reference: `main:src/strapi.js` (port `mergeLocales` + field lists from it: `git show main:src/strapi.js`), `scripts/snapshot-content.mjs` (kept as-is; CI refreshes `src/content-snapshot.json` before build)

**Interfaces:**
- Produces: `loadContent()` → `Promise<{ projects: Project[], articles: Article[] }>` where
  `Project = { slug, documentId, title, description, client, date, region, services: string[], darkHero, thumbnail: {url, alt} | null, heroImage: {url, alt} | null }`
  (locale-merged EN⊕JA per `mergeLocales`, sorted newest-first by `date`; `articles` analogous with `{ slug, documentId, title, date, excerpt, cover }`).
- Produces: `slugify(title, documentId)` and `mergeLocales(en, ja)` from `src/lib/normalize.js`.

- [ ] **Step 1: Write failing tests**

`test/normalize.test.js`
```js
import { describe, it, expect } from 'vitest'
import { slugify, assignSlugs, mergeLocales } from '../src/lib/normalize.js'

describe('slugify', () => {
  it('kebab-cases a latin title', () => {
    expect(slugify('myOCP Online Booking', 'abc123')).toBe('myocp-online-booking')
  })
  it('falls back to documentId for non-latin titles', () => {
    expect(slugify('ご挨拶', 'abc123')).toBe('abc123')
  })
})

describe('assignSlugs', () => {
  it('suffixes documentId on collision, deterministically', () => {
    const items = [
      { documentId: 'id1', title: 'Zenrise' },
      { documentId: 'id2', title: 'Zenrise' },
    ]
    const out = assignSlugs(items)
    expect(out[0].slug).toBe('zenrise')
    expect(out[1].slug).toBe('zenrise-id2')
  })
})

describe('mergeLocales', () => {
  it('overlays ja localized fields onto en by documentId', () => {
    const en = [{ documentId: 'd1', title: 'Zenrise Website', description: 'EN desc' }]
    const ja = [{ documentId: 'd1', title: 'ゼンライズ', description: 'JA desc' }]
    const merged = mergeLocales(en, ja, ['title', 'description'])
    expect(merged[0].ja.title).toBe('ゼンライズ')
    expect(merged[0].title).toBe('Zenrise Website')
  })
})
```

- [ ] **Step 2: Run tests, verify failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/normalize.js`.** Port `mergeLocales` and the `LOCALIZED_*_FIELDS` lists from `main:src/strapi.js`, adapting the return shape so the merged item keeps EN fields at top level and exposes the JA overlay under `.ja` (both locales are needed once JA routes arrive in later phases). Add:

```js
export function slugify(title, documentId) {
  const s = (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || documentId
}

export function assignSlugs(items) {
  const seen = new Set()
  return items.map((it) => {
    let slug = slugify(it.title, it.documentId)
    if (seen.has(slug)) slug = `${slug}-${it.documentId}`
    seen.add(slug)
    return { ...it, slug }
  })
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm test` → 5 passing.

- [ ] **Step 5: Implement `src/lib/content.js`.** Build-time only (imported from `.astro` frontmatter):

```js
import snapshot from '../content-snapshot.json'
import { mergeLocales, assignSlugs, LOCALIZED_PROJECT_FIELDS } from './normalize.js'

const API = 'https://upbeat-approval-82a9e54c20.strapiapp.com/api'
const TOKEN = import.meta.env.STRAPI_TOKEN ?? process.env.STRAPI_TOKEN ?? ''

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
```

plus `loadContent()` that fetches projects (en + ja locales, `populate` thumbnail/hero_image) and articles, falls back **per endpoint** to the matching section of `snapshot` when the fetch returns null, then normalizes into the `Project`/`Article` shapes above (media → absolute `url` + `alternativeText`; `services` split on commas; sort by `date` desc; `assignSlugs`). Match the exact populate/query strings used by `scripts/snapshot-content.mjs` so live and snapshot shapes agree — read that script first.

- [ ] **Step 6: Verify against live Strapi**

Run: `node -e "import('./src/lib/content.js').then(m => m.loadContent()).then(c => console.log(c.projects.map(p => p.slug)))"` (if `import.meta.env` blocks plain node, verify via a throwaway `src/pages/debug.astro` that prints slugs, then delete it).
Expected: 6 slugs including `myocp-online-booking`, `zenrise-website`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "Add build-time Strapi content layer with snapshot fallback"`

---

### Task 3: Fonts, design tokens, base layout

**Files:**
- Create: `src/styles/global.css`, `src/layouts/Base.astro`, `public/fonts/sohne-400.woff2`, `public/fonts/sohne-500.woff2`
- Modify: `src/pages/index.astro` (render inside Base with a type specimen)

**Interfaces:**
- Produces: `Base.astro` with props `{ title: string }`, a `<slot />` for page content, and the `.zoom` wrapper; CSS custom props `--ink --paper --muted --hairline --faint --ph --gutter-l --gutter-r --ease`; utility classes `.label`, `.cta`, `.gutter`; `@keyframes pageIn`.

- [ ] **Step 1: Copy woff2 fonts** from `design/handoff/design/assets/` (sohne-400/500 only — Larsseit is unused by decision).

- [ ] **Step 2: Write `src/styles/global.css`** — transcribe the prototype `<head>` styles (handoff `MDMC Site.dc.html` lines 12–27) exactly, then add tokens/utilities:

```css
@font-face { font-family: "Söhne"; src: url("/fonts/sohne-400.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Söhne"; src: url("/fonts/sohne-500.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: #fff; color: #000;
  font-family: "Söhne", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 20px; line-height: 1.4;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
body { min-height: 100vh; overflow-x: hidden; }
a { color: inherit; text-decoration: none; cursor: pointer; }
img { display: block; max-width: 100%; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
input, textarea { font: inherit; }

:root {
  --ink: #000; --paper: #fff;
  --muted: rgba(0,0,0,0.36); --hairline: rgba(0,0,0,0.12); --faint: rgba(0,0,0,0.22);
  --ph: rgb(217,217,217);
  --gutter-l: clamp(24px, 8.6458vw, 220px);
  --gutter-r: clamp(24px, 5.94vw, 152px);
  --ease: cubic-bezier(.2,.7,.2,1);
}
.gutter { padding-left: var(--gutter-l); padding-right: var(--gutter-r); }
.label { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 400; }
.cta { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; padding: 6px 0; border-bottom: 1px solid transparent; transition: border-color .2s ease; }
.cta:hover { border-bottom-color: currentColor; }
.arrow { font-weight: 400; }
@keyframes pageIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@media (min-width: 1024px) { .zoom { zoom: 0.85; } }
@media (prefers-reduced-motion: reduce) { main { animation: none !important; } }
```

- [ ] **Step 3: Write `src/layouts/Base.astro`** — html/head (charset, viewport, `<title>`, import global.css) + `<body><div class="zoom"><slot /></div></body>`. Put a specimen in `index.astro`: one statement headline, one `.label`, one `.cta`, body copy.

- [ ] **Step 4: Verify** — `npm run build`; screenshot dev server with headless Chrome (`google-chrome-stable --headless=new --screenshot=... --window-size=1440,900 http://localhost:4321`). Check: Söhne renders (letterforms match `design/handoff/screenshots/01-home.png` wordmarks), no blue links, gutters match (left gutter at 1440px = clamp → 124.5px … verify ~125px to content edge under zoom).

- [ ] **Step 5: Commit** — `"Add design tokens, Söhne fonts, and base layout"`

---

### Task 4: Header + supermenu + locale panel

**Files:**
- Create: `src/components/Header.astro`
- Modify: `src/layouts/Base.astro` (render Header above slot; pass `active` page prop through)

**Interfaces:**
- Consumes: `loadContent()` from Task 2 (recent 4 projects + latest 4 articles for the panels).
- Produces: `<Header active="home|work|news|about|contact" projects={...} articles={...} />`; localStorage keys `mdmc.region` (`nz|au|jp`, default `nz`) and `mdmc.locale` (`en|ja`, migrating the existing `mdmc.locale` key from the old site).

- [ ] **Step 1: Transcribe the markup** from `design/handoff/design/MDMC Site.dc.html` lines 30–110 into `Header.astro`, keeping every measurement literal (logo `assets/mdmc.png` → copy to `public/mdmc.png`, height 22px; nav `gap: 72px; margin-left: 225px`; padding `64px var(--gutter-r) 36px var(--gutter-l)`; nav links `padding: 6px 0` with 1px bottom border, `currentColor` when active/hover, else transparent; locale trigger: region 16px + lang code 10px letterspaced muted, `top: -1px`). Panels (Work / News / About / Locale) render **all** server-side, toggled by script: full-width div at `top: 100%`, white, `border-top: 1px solid var(--hairline)`, `box-shadow: 0 1px 0 rgba(0,0,0,0.12), 0 32px 56px -40px rgba(0,0,0,0.18)`, translate/fade in. Work panel: `.label` "Work" + 4 recent project titles at 20px, 10px row gaps, hover `opacity: .55`. News panel: same with 4 article titles (no dates/rules). About panel: About + Careers links (prototype line ~101). Locale panel: right-aligned REGION (New Zealand / Australia / Japan) and LANGUAGE (EN / 日本語) lists, active black, others muted.

- [ ] **Step 2: Write the panel script** (inline `<script>` in Header.astro):

```js
const header = document.querySelector('[data-header]')
const panel = header.querySelector('[data-mega]')
const views = panel.querySelectorAll('[data-panel]')
let open = null

function show(name) {
  views.forEach(v => { v.hidden = v.dataset.panel !== name })
  panel.style.opacity = '1'
  panel.style.visibility = 'visible'
  panel.style.pointerEvents = 'auto'
  panel.style.transform = 'translateY(0)'
  open = name
}
function hide() {
  panel.style.opacity = '0'
  panel.style.visibility = 'hidden'
  panel.style.pointerEvents = 'none'
  panel.style.transform = 'translateY(-8px)'
  open = null
}
header.querySelectorAll('[data-mega-trigger]').forEach(el =>
  el.addEventListener('mouseenter', () => show(el.dataset.megaTrigger)))
header.querySelectorAll('[data-mega-close]').forEach(el =>
  el.addEventListener('mouseenter', hide))
header.addEventListener('mouseleave', hide)
panel.style.transition = 'opacity .25s var(--ease), transform .25s var(--ease), visibility .25s'
hide()
```

Locale/region clicks write localStorage and update the trigger label; language `ja` behavior beyond the label arrives with the About-JP page (Phase 3) — for now persist the choice only.

- [ ] **Step 3: Verify interactively** — puppeteer-core + headless Chrome (scratchpad script): load `/`, hover "Work", screenshot; assert the panel contains 4 project titles from live content. Hover-out closes. Compare against the header band of `design/handoff/screenshots/01-home.png` (note: screenshots were captured under the prototype's global zoom).

- [ ] **Step 4: Commit** — `"Add redesigned header with supermenu and locale panel"`

---

### Task 5: Footer — studio accordions + live clocks

**Files:**
- Create: `src/components/Footer.astro`, `src/lib/studios.js`
- Modify: `src/layouts/Base.astro` (render Footer below slot)

**Interfaces:**
- Produces: `STUDIOS` in `src/lib/studios.js`: `[{ id: 'nz', region: 'New Zealand', tz: 'Pacific/Auckland', addressLines: [...], email, phone, image: null }, { id: 'au', tz: 'Australia/Sydney', ... }, { id: 'jp', tz: 'Asia/Tokyo', ... }]` — Contact page (Phase 3) reuses this module.

- [ ] **Step 1: Build `src/lib/studios.js`.** Address lines / emails / phones: copy the real strings from the old site — `git show main:src/i18n.jsx | grep -n -A8 -i 'address\|studio'` (and `main:src/pages.jsx` contact section if i18n doesn't hold them). Any value the old site genuinely lacks (e.g. an AU street address) → use the prototype's copy and add it to the "content needed from user" list in the final report; do not invent.

- [ ] **Step 2: Transcribe footer markup** from the prototype (footer block near end of markup, before `<script type="text/x-dc">` — full-black top rule, `1fr 3fr` grid; left: "Have a project in mind? Let's talk. →" 32px 500; right: three hairline-ruled accordion rows; closed = one-line address + `+` far right; open = `220px` 4/3 image + address/time column + contact column with "Send us a message →" linking `/contact`).

- [ ] **Step 3: Accordion + clock script**

```js
const rows = document.querySelectorAll('[data-studio]')
rows.forEach(row => {
  row.querySelector('[data-toggle]').addEventListener('click', () => {
    const isOpen = !row.hidden && row.dataset.open === '1'
    rows.forEach(r => { r.dataset.open = '0' })
    row.dataset.open = isOpen ? '0' : '1'
  })
})
// data-open drives CSS: body max-height/opacity, and the + rotates 45° (.3s var(--ease))

const clocks = document.querySelectorAll('[data-clock]')
function tick() {
  const blink = new Date().getSeconds() % 2 === 0
  clocks.forEach(el => {
    const t = new Intl.DateTimeFormat('en-NZ', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: el.dataset.clock,
    }).format(new Date())
    el.innerHTML = t.replace(':', `<span style="opacity:${blink ? 1 : 0}">:</span>`)
  })
}
tick(); setInterval(tick, 1000)
```

Clock text style: 18px muted, `font-variant-numeric: tabular-nums`.

- [ ] **Step 4: Verify** — puppeteer: click NZ row → opens; click AU → NZ closes (single-open); capture two screenshots one second apart → colon opacity differs; the three times match `TZ=Pacific/Auckland date +%H:%M` etc.

- [ ] **Step 5: Commit** — `"Add footer with studio accordions and live clocks"`

---

### Task 6: Home page + stub project routes

**Files:**
- Rewrite: `src/pages/index.astro`
- Create: `src/pages/work/[slug].astro` (stub), `src/components/WorkCard.astro`

**Interfaces:**
- Consumes: `loadContent()`, `Base.astro`, `Header`/`Footer`.
- Produces: `WorkCard.astro` props `{ project, headingLevel? }` (Work index in Phase 2 reuses it); route `/work/<slug>/` exists for every project (stub: title + description only, completed in Phase 2).

- [ ] **Step 1: Transcribe home markup** from prototype lines 111–146: hero frame `height: calc(100svh - 200px); min-height: 720px` in a section with `padding: 40px var(--gutter-r) 0 var(--gutter-l)` (note the prototype's asymmetric order — left uses the big clamp); slides = 4 newest projects' `heroImage` stacked absolute, `object-fit: cover`, crossfade `opacity .8s ease`; overlay bar `left/right: 32px; bottom: 24px`: project name 20px black bottom-left (Söhne — see Global Constraints on the Larsseit artifact), `←|→` arrows bottom-right (18px, divider `2px × 18px` faint, hover `translateX(∓4px) .25s var(--ease)`); whole slide clicks through to `/work/<slug>/`. Then the statement section (32px/1.4, `-0.005em`, `max-width: 880px`, left padding `calc(var(--gutter-l) + 150px)`, `padding: 143px … 168px`) with the exact copy from the prototype ("We're MDMC—an integrated design & digital strategy agency…" with its `<br>`s). Then the work grid: 2 columns, `column-gap: 26px; row-gap: 64px`; card = 16/9 image (hover `translateY(-4px) .5s var(--ease)`), 24px title mt-24, description `max-width: 460px` mt-8, "View project →" mt-20 — extract as `WorkCard.astro`. Missing `heroImage`/`thumbnail` → grey `var(--ph)` box (real state today: 3 projects have no hero — the design's placeholder grey is the correct degraded look). News strip: README lists it for Home, but the prototype home `<main>` (lines 111–146) has hero + statement + grid only — match the prototype, note the discrepancy at review.

- [ ] **Step 2: Slideshow script**

```js
const slides = [...document.querySelectorAll('[data-slide]')]
const name = document.querySelector('[data-hero-name]')
let i = 0
function show(n) {
  i = (n + slides.length) % slides.length
  slides.forEach((s, j) => { s.style.opacity = j === i ? '1' : '0' })
  name.textContent = slides[i].dataset.title
  name.href = slides[i].dataset.href
}
document.querySelector('[data-hero-prev]').addEventListener('click', () => show(i - 1))
document.querySelector('[data-hero-next]').addEventListener('click', () => show(i + 1))
const auto = !matchMedia('(prefers-reduced-motion: reduce)').matches
if (auto) setInterval(() => show(i + 1), 6000)
show(0)
```

(6000ms and the 4-slide window come from the prototype runtime, `dc` script lines ~26–27. Pausing auto-rotate under reduced-motion is our addition — arrows still work; flag at review.)

- [ ] **Step 3: Stub `src/pages/work/[slug].astro`** — `getStaticPaths` from `loadContent().projects`; render Base + Header(active="work") + title + description. A one-line comment marks it Phase-2 scope.

- [ ] **Step 4: Verify** — `npm run build` (all 6 project routes emit); puppeteer at 1440×900: screenshot vs `design/handoff/screenshots/01-home.png` (structure + type, imagery differs — real heroes vs grey); click next arrow → name changes; click hero → lands on `/work/myocp-online-booking/` (or whichever slide); force reduced-motion OFF via CDP to watch the crossfade.

- [ ] **Step 5: Commit** — `"Add redesigned home page with hero slideshow and stub project routes"`

---

### Task 7: CI build check for the redesign branch

**Files:**
- Create: `.github/workflows/redesign-check.yml`
- Keep untouched: `.github/workflows/deploy.yml` (main keeps deploying the live SPA until Phase 4 cutover)

- [ ] **Step 1: Write the workflow**

```yaml
name: Redesign build check
on:
  push:
    branches: ['redesign/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm test
      - name: Refresh content snapshot
        run: node scripts/snapshot-content.mjs
        env:
          VITE_STRAPI_TOKEN: ${{ secrets.VITE_STRAPI_TOKEN }}
      - run: npm run build
        env:
          STRAPI_TOKEN: ${{ secrets.VITE_STRAPI_TOKEN }}
```

(Check first that `scripts/snapshot-content.mjs` still writes `src/content-snapshot.json` where `content.js` imports it; adjust the path constant if the Astro layout moved it.)

- [ ] **Step 2: Push the branch** (this is the Phase-1 checkpoint push; local-first batching applies before this) and verify the run passes: `gh run watch`.

- [ ] **Step 3: Commit/report** — Phase 1 done. Report to user for visual review on the dev server before Phase 2, including the flagged deviations: zoom ≥1024px only, Söhne-not-Larsseit hero name, reduced-motion pause, home news strip omitted (prototype-faithful), any studio content gaps.

---

## Roadmap (separate plan docs, written as each phase starts)

- **Phase 2 — Work, Project, News, Article + Strapi schema:** Work index with Region/Specialty filter groups (`+` rotates 45°, 9px circles, multi-select, 3×max-content specialty grid `gap: 16px 128px`); full Project page with Gallery/Case-study views (`?view=` param, .32s cross-fade, no scroll); News index with kind filters; Article page. Strapi additions (deploy schema FIRST; run `npx strapi ts:generate-types` and commit `types/generated/` — cloud build gotcha): article `kind` enum + project relation, project case-study fields (overview/challenge/approach/outcome, pull-quote + attribution), gallery as component list (image + slot kind + caption — supersedes the old 16:7-bookend spec; galleries were never re-attached, so re-prep imagery to the NEW design's slots: 16/9 hero, 4/3 two-up, 1/1 + captions, full-bleed), `next project` ordering. Old-URL redirects data (`#/work/<documentId>` → `/work/<slug>/`) prepared here, shipped in Phase 4.
- **Phase 3 — About EN/JP, Careers, Job, Contact + forms:** label-grid About EN (four sections + three-up studio strip); About JP (ご挨拶 / 会社概要 / アクセス) at `/ja/about` wired to the locale switcher; Careers index + Job page; Contact with per-studio folds (reusing `studios.js`, live clocks, alternating 7fr/4fr image sides, −96px smooth scroll, form recipient state); port Turnstile (vanilla loader, same site key `0x4AAAAAADx-FIVqP87bxM04`) posting to the existing `POST /api/contact` and multipart `POST /api/apply`.
- **Phase 4 — Cutover:** swap `deploy.yml` to the Astro build; hash-redirect script on `/` (translate old `#/…` URLs); merge to main; verify mdmc.co (Cloudflare-proxied — GitHub cert never provisions, that's normal); Strapi publish → `repository_dispatch` rebuild webhook; Google Search Console; confirm Söhne production licensing; retire `design-export/` strays.

## Content needed from the user (running list — not code tasks)

- Real photography for hero slides/thumbnails per the new slots (3 projects still have no `hero_image`; all 6 galleries empty — prep to Phase-2 slot specs, not the old 16:7 spec).
- Studio images (footer accordions + contact folds), AU studio address/phone if the old site lacks them.
- JP About copy (prototype's is placeholder), native-JA pass on job enum labels (carried over).
- Söhne license confirmation for production/web use.

---

## Phase 1 execution outcome (2026-08-19)

Executed via subagent-driven development: 12 commits + 2 final-review fix commits (`9a02683..36e662a`), all task reviews + final whole-branch review clean, CI green (`redesign-check.yml`).

**Deferred to Phase 2 (from reviews):**
- content.js: 4xx short-circuit in fetchJson retry; add a fallback-branching test; `.ja` overlay shape must be normalized (raw Strapi fields, unsplit `services`) before JA routes consume it; memo cache is process-lifetime (astro dev staleness).
- Header/Footer: SSR default-flash of region/locale labels for returning non-default visitors; Escape doesn't restore focus; three accordion toggles share one aria-label; footer open-row transition is grid-rows .3s (not prototype pageIn .35s slide) — confirm at visual review; footer scroll-then-open uses fixed 400ms + always-smooth scroll.
- Base: no meta description/favicon yet (SEO pass in Phase 2); decide fate of unused `.cta` utility and `--ink`/`--paper` tokens.

**Content needed from user (running list):** privacy/terms page (linked "#" in footer, absent from all 4 phases); studio photography (footer/contact); AU + JP phone numbers (absent from old site); JP email confirmation (footer contact@mdmc.co vs location page team@mdmc.co); project photography per new slots (3 heroes missing, all galleries); JP About copy; Söhne production licensing confirmation.
