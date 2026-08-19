# MDMC Redesign on Astro — Phase 2: Work, Project, News, Article + Strapi Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the redesign's four content views — Work index with Region/Specialty filters, full Project page with Gallery/Case-study dual views, News index with kind filters, Article page — on the `redesign/astro` branch, plus the additive Strapi schema those views read from and the Phase-1 deferred content-layer items.

**Architecture:** Same as Phase 1 — Astro 5 static pages, vanilla `<script>` interactivity, all content via the memoized `loadContent()` build-time layer. Schema changes land in the separate `mdmc-strapi` repo (Strapi Cloud deploys on push to its `main`) and are strictly additive so the live SPA is unaffected. Every new view degrades gracefully: no case-study fields → no view toggle; empty gallery → hero only; zero articles → empty news grid.

**Tech Stack:** Astro ^5, Vitest, vanilla JS. Strapi 5.44 on Strapi Cloud (repo `~/projects/mdmc-strapi`, push-to-main deploys).

**Spec:** `design/handoff/README.md` §§2–3, 6–8 (Work, News, Project Gallery, Project Case Study, Article) + `design/handoff/design/MDMC Site.dc.html` — view boundaries: Work `<main>` lines 153–190, News 334–362, Article 365–390, Project 486–645 (Gallery `sc-if isGallery` 497–551, Case Study `sc-if isStory` 553–643). Phase-1 outcomes and deferred list: end of `docs/superpowers/plans/2026-08-19-astro-redesign-phase1.md`.

## Global Constraints

- All Phase-1 Global Constraints hold (tokens, gutters, label voice, type scale, arrows/CTA pattern, never-blue links, zoom ≥1024px, motion values, commit style). Components reuse `--gutter-l/r`, `--hairline`, `--muted`, `--faint`, `--ph`, `--ease`, `.label`, `.gutter` from `src/styles/global.css`.
- Prototype `{{ }}` bindings → static Astro output or data-attributes; `style-hover` → real CSS `:hover`. Measurements literal.
- Strapi schema changes are ADDITIVE ONLY — never rename/remove/retype an existing field or type; the live SPA on main reads this same production CMS.
- mdmc-strapi GOTCHA (bit us 7/08): any schema commit MUST run `npx strapi ts:generate-types` and commit `types/generated/` — the cloud build typechecks against committed generated types.
- Strapi richtext is Blocks JSON → render as plain paragraphs via the ported `blocksToParagraphs` (Phase-1 `normalize.js` pattern; original in `git show main:src/strapi.js` lines 14–37). No markdown library.
- Media URLs: full-resolution `media.url` for full-width imagery (old-site convention), `alternativeText` for alt.
- URL scheme: `/work/`, `/work/<slug>/`, `/news/`, `/news/<slug>/`. Slugs computed (`assignSlugs`), never stored.
- Filters/toggles are client-side over server-rendered DOM (data-attributes + hidden), so pages work fully rendered before JS and filter instantly after.
- This dev machine reports `prefers-reduced-motion: reduce` — verify animations via CDP `emulateMediaFeatures`, and interactions via in-page clicks/`page.mouse` per the Phase-1 zoom quirk (getBoundingClientRect returns physical px under `.zoom`).
- Puppeteer verification: `puppeteer-core` via `npm install --no-save` (never into package.json), executablePath `/usr/bin/google-chrome-stable`, screenshots under the session scratchpad, READ every screenshot, kill background dev servers when done.
- Current content reality: 6 projects (3 with hero_image, 0 galleries, no case-study fields yet), 0 published articles — every view must render correctly TODAY in its degraded state, and the degraded states are part of each task's verification.

---

### Task 1: Additive Strapi schema (mdmc-strapi repo) + cloud deploy

**Files (all in `/home/kaisei/projects/mdmc-strapi` — a SEPARATE git repo on `main`):**
- Create: `src/components/project/gallery-slot.json`
- Modify: `src/api/project/content-types/project/schema.json` (add 7 attributes)
- Modify: `src/api/article/content-types/article/schema.json` (add 2 attributes)
- Regenerate: `types/generated/` (commit it)

**Interfaces:**
- Produces (Strapi API, consumed by Task 2): project gains `overview`, `challenge`, `approach`, `outcome` (richtext blocks, localized), `pull_quote` (text, localized), `pull_quote_attribution` (string, localized), `gallery` (repeatable component `project.gallery-slot`, NOT localized — one gallery shared across locales); component fields: `image` (single media), `kind` (enum `hero|two_up|square|full_bleed`, default `two_up`), `caption` (string). Article gains `kind` (enum `news|article|case_study`, default `news`, NOT localized) and `project` (relation oneToOne → `api::project.project`, NOT localized).

- [ ] **Step 1: Sandbox check.** This session's controller shell is worktree-locked; you may not be. Verify you can operate on the repo: `git -C /home/kaisei/projects/mdmc-strapi status --short`. If ANY git or npm command against that path is refused by the harness, STOP and report BLOCKED immediately — do not work around it.

- [ ] **Step 2: Confirm clean baseline.** `git -C /home/kaisei/projects/mdmc-strapi status --short` must be empty and `git -C /home/kaisei/projects/mdmc-strapi log --oneline -1` should show `6638d03` (if the tree is dirty or the tip differs, report BLOCKED with what you found — another session may have touched it).

- [ ] **Step 3: Write the component** `src/components/project/gallery-slot.json`:

```json
{
  "collectionName": "components_project_gallery_slots",
  "info": {
    "displayName": "Gallery slot",
    "description": "One gallery image with its layout slot and caption"
  },
  "options": {},
  "attributes": {
    "image": {
      "type": "media",
      "multiple": false,
      "required": true,
      "allowedTypes": ["images"]
    },
    "kind": {
      "type": "enumeration",
      "enum": ["hero", "two_up", "square", "full_bleed"],
      "default": "two_up",
      "required": true
    },
    "caption": {
      "type": "string"
    }
  }
}
```

- [ ] **Step 4: Extend the project schema.** In `src/api/project/content-types/project/schema.json`, add to `attributes` (keep every existing attribute untouched):

```json
"overview":  { "type": "richtext", "pluginOptions": { "i18n": { "localized": true } } },
"challenge": { "type": "richtext", "pluginOptions": { "i18n": { "localized": true } } },
"approach":  { "type": "richtext", "pluginOptions": { "i18n": { "localized": true } } },
"outcome":   { "type": "richtext", "pluginOptions": { "i18n": { "localized": true } } },
"pull_quote": { "type": "text", "pluginOptions": { "i18n": { "localized": true } } },
"pull_quote_attribution": { "type": "string", "pluginOptions": { "i18n": { "localized": true } } },
"gallery": {
  "type": "component",
  "repeatable": true,
  "component": "project.gallery-slot",
  "pluginOptions": { "i18n": { "localized": false } }
}
```

- [ ] **Step 5: Extend the article schema.** In `src/api/article/content-types/article/schema.json`, add:

```json
"kind": {
  "type": "enumeration",
  "enum": ["news", "article", "case_study"],
  "default": "news",
  "pluginOptions": { "i18n": { "localized": false } }
},
"project": {
  "type": "relation",
  "relation": "oneToOne",
  "target": "api::project.project",
  "pluginOptions": { "i18n": { "localized": false } }
}
```

- [ ] **Step 6: Regenerate types.** `cd /home/kaisei/projects/mdmc-strapi && npx strapi ts:generate-types`. Confirm `types/generated/` changed (`git status --short`) and includes the new component UID `project.gallery-slot`. If the local strapi CLI fails on the known-broken local sqlite (`no such table: about_en`), note it — `ts:generate-types` reads schemas, not the DB, and should still succeed; if it genuinely cannot run, report BLOCKED.

- [ ] **Step 7: Commit + push (this DEPLOYS to production Strapi Cloud — controller-authorized).**

```bash
git -C /home/kaisei/projects/mdmc-strapi add -A
git -C /home/kaisei/projects/mdmc-strapi commit -m "Add case-study fields, gallery slots, and article kinds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git -C /home/kaisei/projects/mdmc-strapi push origin main
```

- [ ] **Step 8: Verify the cloud deploy.** Strapi Cloud builds take several minutes. Poll the live API (bounded loop, e.g. `until curl -s "https://upbeat-approval-82a9e54c20.strapiapp.com/api/projects?fields[0]=title&populate[gallery]=true&pagination[pageSize]=1" | grep -q '"data"'; do sleep 30; done` with a ~15-min cap): success = HTTP 200 JSON with `data` (an unknown-field 400 error means the schema isn't live yet; a persistent 400 after 15 min = report the exact error). Also confirm the old shape still works: `/api/projects?populate=*` returns 6 projects (additive change broke nothing).

- [ ] **Step 9: Report** — include the deploy verification output. No changes to the mdmc-website repo in this task.

---

### Task 2: Content layer v2 (mdmc-website: normalize + content + tests)

**Files:**
- Modify: `src/lib/normalize.js` (add `blocksToParagraphs`, `normalizeJa` handling)
- Modify: `src/lib/content.js` (extend project/article normalization; 4xx short-circuit)
- Test: `test/normalize.test.js` (extend), Create: `test/content.test.js`

**Interfaces:**
- Consumes: Task 1's API shape (gallery/kind/etc. may be EMPTY on all live entries — normalization must produce the documented nulls/empties from absent fields).
- Produces (binding for Tasks 3–7) — `Project` gains:
  - `regions: string[]` (split `region` on commas, trimmed; `[]` if null)
  - `specialties: string[]` (alias of the existing `services` array — same value, clearer name; keep `services` too)
  - `gallery: Array<{ url, alt, kind: 'hero'|'two_up'|'square'|'full_bleed', caption: string|null }>` (`[]` when absent)
  - `story: { overview: string[], challenge: string[], approach: string[], outcome: string[] } | null` — each section a paragraph array via `blocksToParagraphs`; `story` is `null` unless at least one of the four sections is non-empty
  - `pullQuote: string|null` and `pullQuoteAttribution: string|null` as TOP-LEVEL Project fields (localized — also present in the `.ja` overlay), independent of `story` — the quote closes the Gallery view whether or not case-study sections exist (controller amendment after Task 2 review)
  - `.ja` overlay NORMALIZED to the same shape as the top level (localized fields only: title, description, services/specialties, intro/body/story sections) — no raw Strapi fields in `.ja` anymore
  - `Article` gains: `kind: 'news'|'article'|'case_study'` (default `'news'`), `kindLabel: 'News'|'Article'|'Case Study'`, `projectSlug: string|null` (resolved against the projects list by documentId), `heroImage: {url, alt}|null` (from `hero_image`, falling back to `cover`), `body: string[]`, `dateLabel: string` (uppercase `AUG 12, 2026` style via `en-US` `toLocaleDateString(... { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()`)
  - `nextProject(projects, slug)` exported from `normalize.js`: next in the date-desc list, wrapping (for the Case-study "Next project" block)
  - `fetchJson` stops retrying on 4xx (`if (res.status >= 400 && res.status < 500) break` before the retry), still falls back per contract.

- [ ] **Step 1: Write the failing tests.** Extend `test/normalize.test.js`:

```js
import { blocksToParagraphs, nextProject } from '../src/lib/normalize.js'

describe('blocksToParagraphs', () => {
  it('flattens Strapi blocks to paragraph strings', () => {
    const blocks = [
      { type: 'paragraph', children: [{ text: 'First ' }, { text: 'para.' }] },
      { type: 'paragraph', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'Second.' }] },
    ]
    expect(blocksToParagraphs(blocks)).toEqual(['First para.', 'Second.'])
  })
  it('splits plain strings on newlines and passes empties through as []', () => {
    expect(blocksToParagraphs('a\nb')).toEqual(['a', 'b'])
    expect(blocksToParagraphs(null)).toEqual([])
  })
})

describe('nextProject', () => {
  const ps = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]
  it('returns the following project', () => { expect(nextProject(ps, 'a').slug).toBe('b') })
  it('wraps at the end', () => { expect(nextProject(ps, 'c').slug).toBe('a') })
  it('returns null when not found or list < 2', () => {
    expect(nextProject(ps, 'zzz')).toBeNull()
    expect(nextProject([{ slug: 'a' }], 'a')).toBeNull()
  })
})
```

Create `test/content.test.js` exercising the exported pure normalizers (export `normalizeProject`/`normalizeArticle` from `content.js` for this): a raw project fixture WITH gallery/story fields maps to the documented shape; one WITHOUT them yields `gallery: []`, `story: null`; an article fixture with `kind: 'case_study'` + project relation resolves `projectSlug` and `kindLabel: 'Case Study'`; one with no kind defaults `'news'`.

- [ ] **Step 2: Run tests, verify the new ones fail** (`npm test`).

- [ ] **Step 3: Implement** — port `blocksToParagraphs` from `git show main:src/strapi.js` (lines 14–37) into `normalize.js`; add `nextProject`; extend `content.js` normalizers per the Interfaces block; normalize the `.ja` overlay through the same project normalizer (localized fields only); add the 4xx short-circuit in `fetchJson`.

- [ ] **Step 4: Run tests, verify all pass** (old 4 + new). `npm run build` still green.

- [ ] **Step 5: Live check** — temporary debug page or node script printing one project's `gallery`/`story` (expect `[]`/`null` today — fields exist but are empty) and the articles array (expect `[]`). Delete the debug page.

- [ ] **Step 6: Commit** — `"Extend content layer: gallery slots, case-study story, article kinds"`

---

### Task 3: Work index with Region/Specialty filters

**Files:**
- Create: `src/pages/work/index.astro`
- Reuse: `src/components/WorkCard.astro` (unchanged if possible)

**Interfaces:**
- Consumes: `loadContent()`; `Project.regions`, `Project.specialties` from Task 2; `WorkCard` from Phase 1.

- [ ] **Step 1: Transcribe** prototype lines 153–190 (README §2). Structure: section `padding: 80px <gutter-r> 160px <gutter-l>`; "Work" h2 (32px 500 -0.01em); filter row 48px below: two triggers 64px apart — "Region +" and "Specialty +" — 20px words, the `+` in Söhne 400 rotating 45° over .3s var(--ease) when its group is open; ONE group open at a time (opening one closes the other); open list renders BENEATH both triggers, 40px below, 32px bottom padding. Region list vertical (10px row gaps); Specialty list `grid-template-columns: repeat(3, max-content); gap: 16px 128px`. Filter items 18px with a 9px circle (1px solid currentColor border, border-radius 50%, `position: relative; top: 1px` optical nudge, 10px gap) that fills solid black when active; inactive items muted, black on hover/active; multi-select. Grid below: 2 cols, `column-gap: 26px; row-gap: 64px`, WorkCard per project. Filter option values: regions = sorted unique of all `project.regions`; specialties = sorted unique of all `project.specialties`.

- [ ] **Step 2: Filter script** (server-render ALL cards; filter by toggling `hidden`):

```js
const state = { regions: new Set(), specialties: new Set(), open: null }
const cards = [...document.querySelectorAll('[data-work-card]')]
// each card carries data-regions="NZ|Japan" data-specialties="Web Design|Development" (pipe-joined)
function applyFilters() {
  cards.forEach((card) => {
    const r = card.dataset.regions ? card.dataset.regions.split('|') : []
    const s = card.dataset.specialties ? card.dataset.specialties.split('|') : []
    const okR = !state.regions.size || r.some((x) => state.regions.has(x))
    const okS = !state.specialties.size || s.some((x) => state.specialties.has(x))
    card.hidden = !(okR && okS)
  })
}
```

plus group open/close (one at a time, `+` rotation via `data-open` CSS) and item toggle handlers updating the Sets, circle fill (`data-active`), then `applyFilters()`.

- [ ] **Step 3: Verify** (puppeteer): default shows 6 cards; select one region → only matching cards remain; add a specialty → intersection logic (AND across groups, OR within); deselect all → 6 again; opening Specialty closes Region (and the `+` rotations swap); compare fold against `design/handoff/screenshots/02-work.png`. READ the screenshots.

- [ ] **Step 4: Commit** — `"Add work index with region and specialty filters"`

---

### Task 4: Project page — header + Gallery view (replaces the stub)

**Files:**
- Rewrite: `src/pages/work/[slug].astro`
- Create: `src/components/ProjectHeader.astro`, `src/components/GalleryStack.astro`

**Interfaces:**
- Consumes: `Project.gallery`, `Project.story`, `Project.specialties`, `heroImage`.
- Produces: page structure Task 5 extends — a `<div data-view-pane="gallery">` and (Task 5) `<div data-view-pane="story" hidden>`; `ProjectHeader` props `{ project, hasStory: boolean }`.

- [ ] **Step 1: Transcribe the header block** (prototype 488–496, README §6): section `padding: 80px <gutter-r> 0 <gutter-l>`; title 32px 500 -0.01em; description 22px below (12px gap); specialty list muted 18px with `·` separators (` · ` spacing per prototype); right-aligned toggle link "View project details ↓" / "View gallery ↓" (20px, arrow Söhne 400) — RENDERED ONLY when `hasStory` (degradation rule: no story → no toggle, gallery is the only view). Extract as `ProjectHeader.astro`.

- [ ] **Step 2: Transcribe the Gallery stack** (prototype 497–551): `section` grid `gap: 96px`, `padding: 96px <gutter-r> 0 <gutter-l>`; slot rendering by `kind`:
  - `hero` → full-width 16/9 (`data-image-id="hero"` on the first hero slot)
  - `two_up` → paired consecutive `two_up` slots in a 2-col grid (26px gap), 4/3 each; an unpaired trailing `two_up` renders full row
  - `square` → 1/1 with 14px muted caption below (16px gap) when `caption` present
  - `full_bleed` → escapes the gutters via negative margins (`margin-left: calc(-1 * var(--gutter-l))` etc.), natural ratio
  Close with the pull-quote block (prototype 544–548): `clamp(28px, 3vw, 46px)`, max-width 1100px, then 16px muted attribution (`{project.pullQuoteAttribution}`) — rendered only when `project.pullQuote` exists (top-level field, NOT `story`).
  **Degradation:** empty `gallery` → render `heroImage` as a single 16/9 hero if present, else render nothing between header and footer (no empty frames). Extract stack as `GalleryStack.astro` (props `{ gallery, heroImage, pullQuote, pullQuoteAttribution }`).

- [ ] **Step 3: Verify** (build + puppeteer): all 6 project pages build; a page WITH heroImage shows the single hero; a page with NO heroImage (e.g. OCP Brand Identity) shows header then no image block; no view toggle appears anywhere (no story content exists yet); compare the header block against `design/handoff/screenshots/06-project-gallery.png` (grey imagery expected). READ screenshots.

- [ ] **Step 4: Commit** — `"Add project page header and gallery view"`

---

### Task 5: Project page — Case Study view + toggle

**Files:**
- Modify: `src/pages/work/[slug].astro` (add story pane + script)
- Create: `src/components/StoryView.astro`

**Interfaces:**
- Consumes: Task 4's `data-view-pane` structure, `ProjectHeader hasStory`, `Project.story`, `nextProject()` from Task 2.

- [ ] **Step 1: Transcribe the Case Study view** (prototype 553–643, README §7): 50/50 two-col section `grid-template-columns: 1fr 1fr; gap: 48px clamp(48px, 5vw, 112px); align-items: start`, `padding: 96px <gutter-r> 0 <gutter-l>`. Left column: gallery-style image stack, 72px gaps, first image = the SAME hero asset (`data-image-id="hero"`), captions 14px muted. Right column: continuous article max-width 640px — per section (OVERVIEW / CHALLENGE / APPROACH / OUTCOME, only sections with content): small-caps `.label`-voice title, 16px below it the 20px/1.6 body paragraphs, 112px between sections, no dividers. After the two-col: full-width pull-quote (same block as gallery view), then "Next project" (prototype 622–643): ruled top (hairline), wide image (16/9, `nextProject` heroImage or grey), title 24px, "View project →" linking `/work/<nextSlug>/`.

- [ ] **Step 2: Toggle + `?view=` param script:**

```js
const panes = { gallery: document.querySelector('[data-view-pane="gallery"]'),
                story: document.querySelector('[data-view-pane="story"]') }
const toggle = document.querySelector('[data-view-toggle]')
let view = new URLSearchParams(location.search).get('view') === 'story' ? 'story' : 'gallery'
function render(instant) {
  const showing = panes[view], hiding = panes[view === 'story' ? 'gallery' : 'story']
  if (!panes.story) return
  const swap = () => {
    hiding.hidden = true; showing.hidden = false
    showing.style.animation = instant ? 'none' : 'pageIn .5s var(--ease)'
    toggle.textContent = ''  // rebuild label + arrow spans per state
  }
  if (instant) { swap() } else {
    hiding.style.transition = 'opacity .32s ease'; hiding.style.opacity = '0'
    setTimeout(() => { swap(); hiding.style.opacity = '' }, 320)
  }
  history.replaceState(null, '', view === 'story' ? '?view=story' : location.pathname)
}
```

(adapt as needed; binding requirements: fade out .32s → swap → pageIn, NO scroll on toggle, `?view=` persisted via replaceState, initial state honors the URL param instantly, toggle label flips "View project details ↓" ↔ "View gallery ↓", reduced-motion gets instant swaps.)

- [ ] **Step 3: Verify.** No live project has story content, so create the degraded verification first (no toggle rendered, `?view=story` on a story-less project shows gallery). Then verify the real flow with a LOCAL fixture: temporarily inject a fake `story` for one project in the page frontmatter (clearly marked, removed before commit), run puppeteer: toggle cross-fades without scrolling (record `scrollY` before/after), URL gains `?view=story`, reload with the param lands on story view, sections render in order, next-project block links the following project. Compare against `design/handoff/screenshots/07-project-case-study.png`. Remove the fixture, re-verify build, READ screenshots.

- [ ] **Step 4: Commit** — `"Add project case-study view with gallery toggle"`

---

### Task 6: News index with kind filters

**Files:**
- Create: `src/pages/news/index.astro`, `src/components/NewsCard.astro`

**Interfaces:**
- Consumes: `Article.kind/kindLabel/dateLabel`, `heroImage`, `slug` from Task 2.

- [ ] **Step 1: Transcribe** prototype 334–362 (README §3): same page skeleton as Work — "News" h2, then ONE filter group ("Filters +") whose open list is the three kinds laid out horizontally with 64px gaps (News / Article / Case Study), same 9px-circle multi-select items; grid 2-col 26/64; card = 16/9 image (heroImage or grey), meta line `KIND ・ DATE` in `.label` voice with SPACES around `・` (e.g. `NEWS ・ AUG 12, 2026`), title 24px, links to `/news/<slug>/`. Extract `NewsCard.astro`.
  **Degradation:** zero articles (today's reality) → h2 + filter trigger render, grid renders empty, nothing breaks. No "coming soon" copy — the design has none.

- [ ] **Step 2: Filter script** — same pattern as Work but a single group + `kinds` Set matching `card.dataset.kind`.

- [ ] **Step 3: Verify** (build + puppeteer): page renders today with 0 cards and a working (empty-result-safe) filter UI; then with a TEMPORARY local fixture array of 3 articles (one per kind, marked and removed before commit) verify: cards render with correct meta format, selecting "Case Study" filters to 1, deselect → 3. Compare fold vs `design/handoff/screenshots/03-news.png`. READ screenshots. Remove fixture, rebuild.

- [ ] **Step 4: Commit** — `"Add news index with kind filters"`

---

### Task 7: Article page

**Files:**
- Create: `src/pages/news/[slug].astro`

**Interfaces:**
- Consumes: `Article.body: string[]`, `kindLabel`, `dateLabel`, `heroImage`, `projectSlug`, `excerpt`.

- [ ] **Step 1: Transcribe** prototype 365–390 (README §8): meta line `KIND ・ DATE` (`.label` voice) → title `clamp(40px, 4.4vw, 64px)/1.05/-0.02em/500` → full-width hero (16/9-ish full-width image, grey if none) → body column max-width 720px LEFT-ALIGNED WITH THE HERO'S LEFT EDGE (i.e., at `--gutter-l`, not centered): lead paragraph 26px/1.45/-0.01em (first paragraph or `excerpt`), then 20px/1.6 paragraphs; when `projectSlug` exists, end with "See the full case study →" linking `/work/<projectSlug>/?view=story`. Closing rule (hairline): "← Back to all news" (→ `/news/`) left, "Share this article ↗" right (native `navigator.share` if available, else copies the URL — tiny script, and it must not crash where both are unavailable).

- [ ] **Step 2: `getStaticPaths`** from `loadContent().articles` — with 0 articles this emits no routes; the page file must still build clean (Astro allows an empty paths array).

- [ ] **Step 3: Verify:** build green with zero articles (no `/news/<slug>/` routes emitted, `/news/` still fine). Then temporary fixture (one article with body paragraphs + projectSlug, marked, removed before commit): route emits, layout per `design/handoff/screenshots/08-article.png`, case-study link carries `?view=story`, share button doesn't throw with `navigator.share` undefined. READ screenshots. Remove fixture, rebuild.

- [ ] **Step 4: Commit** — `"Add article page"`

---

### Task 8: Head metadata + deferred polish

**Files:**
- Modify: `src/layouts/Base.astro` (meta description, favicon, og:title/description)
- Create: `public/favicon.svg`
- Modify: `src/styles/global.css` (only if the `.cta` audit says remove)

**Interfaces:**
- Produces: Base gains optional prop `description?: string` (default: "MDMC is an integrated design & digital strategy agency working across New Zealand, Australia and Japan."); every existing page passes a sensible description (home = default; work = "Selected work by MDMC…"; project pages = `project.description`; news = "News and writing from MDMC."; articles = `excerpt`).

- [ ] **Step 1:** Add `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, and `<link rel="icon" href="/favicon.svg">` to Base's head. Favicon: minimal SVG — black canvas-less "MDMC"-style mark is overkill; use a plain black square dot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="black"/></svg>` (placeholder until brand favicon is supplied — add to content-needed list).
- [ ] **Step 2:** `.cta` audit: `grep -rn 'class=.*cta' src/` — if any component uses `.cta`, keep it; if none, delete the rule and its comment from global.css. Record which way it went.
- [ ] **Step 3:** Verify: build; view-source of dist pages shows per-page descriptions; favicon requests 200. Commit — `"Add page metadata and favicon; resolve .cta audit"`

---

### Task 9: Checkpoint — push, CI, cross-view sweep

- [ ] **Step 1:** Full local gate: `npm test` (all tests), `npm run build`.
- [ ] **Step 2:** Puppeteer sweep over the built site (`npm run preview` or dev server): home → supermenu Work panel link → project page → back to `/work/` via nav → filter interaction → `/news/` renders empty-state → footer accordion still works on the new pages (Base chrome regression check). READ the screenshots.
- [ ] **Step 3:** Push `redesign/astro` (controller-authorized checkpoint push); `gh run watch` the `Redesign build check` run to success.
- [ ] **Step 4:** Report: run URL, sweep results, and the updated content-needed list.

---

## Deferred to Phase 3+ (do NOT do in this phase)

About EN/JP, Careers, Job, Contact pages and forms/Turnstile; the hash-URL redirect shim and deploy cutover (Phase 4); JA routes (the `.ja` normalization in Task 2 only prepares data); header SSR label flash; Escape focus-restore; accordion aria-label differentiation; footer scroll-timing.

## Content needed from user (additions this phase)

Case-study text (overview/challenge/approach/outcome + pull quotes) per project; gallery images uploaded into the NEW `gallery` component slots (kinds: hero 16/9, two_up 4/3, square 1/1 + caption, full_bleed); articles (site has zero — News/Article pages ship empty until content exists); brand favicon.

---

## Phase 2 execution outcome (2026-08-19/20 overnight)

Executed via subagent-driven development: schema commit `6bc7ef6` on mdmc-strapi (deployed to production Strapi Cloud, verified additive + live) and 12 commits on mdmc-website (`505e8f4..f84fa57`); all task reviews + final whole-branch review clean after fix rounds; CI green throughout. ⚠ Commits from `6a0b8c7` onward are UNSIGNED (gpg pinentry unreachable overnight) — re-sign via rebase + force-push before merging to main.

**Deferred to Phase 3 (from final review):** og:image/og:url/og:type + canonical link + branded title suffix on detail pages (one Base.astro pass together with the real favicon); export ARTICLE_KIND_LABELS and share with News' KINDS on next content.js touch; Set-typing drift between the two filter scripts; default-description string duplicated in Base + home; share button `type="button"`; h1 semantics on index pages; `aria-controls` on filter triggers. All 7 earlier deferred minors triaged OK-TO-DEFER.

**Populated-tomorrow guarantees now in place:** UTC-pinned date labels; dateless articles render without dangling separators; article case-study CTA hidden until the target project has story content; gallery/story/articles light up from Strapi content with no code changes.
