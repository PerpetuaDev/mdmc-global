# MDMC Redesign on Astro — Phase 3: About EN/JP, Careers, Job, Contact + Forms

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the remaining five views — About EN, About JP, Careers, Job posting, Contact — with Turnstile-gated forms posting to the existing Strapi endpoints, plus the deferred Base.astro metadata pass. After this phase only the Phase-4 cutover remains.

**Architecture:** Same as Phases 1–2 (Astro 5 static, vanilla scripts, memoized `loadContent()`). No Strapi schema changes — all five views read EXISTING content types (about, about-japan, career, job). Forms reuse the production endpoints `POST /api/contact` (JSON) and `POST /api/apply` (multipart) with the existing Cloudflare Turnstile widget (site key `0x4AAAAAADx-FIVqP87bxM04`, Managed, hostnames mdmc.co + localhost).

**Tech Stack:** Astro ^5, Vitest, vanilla JS, Cloudflare Turnstile.

**Spec:** `design/handoff/README.md` §§4–5, 9–10 + Shared chrome §Locale; `design/handoff/design/MDMC Site.dc.html` — view boundaries: About EN 193–240, About JP 243–302, Careers 305–331, Contact 393–483, Job 648–702. Phase-1/2 outcome notes at the end of their plan docs.

## Global Constraints

- All Phase-1/2 Global Constraints hold (tokens, gutters, label voice, prototype-literals-over-prose precedent, never-blue links, zoom ≥1024px, commit style, puppeteer conventions incl. the `.zoom` physical-px quirk and READ-your-screenshots, reduced-motion machine caveat, fixtures marked + removed + grep-verified).
- ⚠⚠ **PRODUCTION EMAIL DANGER:** `POST /api/contact` and `POST /api/apply` on Strapi Cloud send REAL email via Mailgun. Verification must NEVER complete a real submission — use puppeteer request interception (`page.setRequestInterception(true)`, respond 200 `{"ok":true}` to those URLs) and assert the intercepted payload instead.
- Turnstile: the real widget renders on localhost (allowed hostname). Verification asserts the widget mounts and the submit button is disabled until a token exists; token acquisition is NOT reliable headless — verify the gating + submit path by dispatching the token event manually (the TurnstileBox contract below exists for exactly this).
- Existing content reality (from the committed snapshot): `about` has headline, lede, kv_1..kv_4 title/body/image, hero_image; `about_japan` has greeting_title, greeting_body, signature_role/name/romaji, signature_portrait, hero_image (NO 会社概要/アクセス fields — those get hardcoded data, see Task 4); `career` (en) has headline, intro, contact_email, hero_image, offers; `career` ja locale 404s (pre-existing — treat as absent); `job` has title, location, type, location_type, excerpt, body, apply_email, hero_image (1 published job). All richtext via `blocksToParagraphs`.
- Legacy payload contracts (binding — the backend is NOT changing): contact = JSON `{ name, email, company, budget, message, turnstileToken }` (+ we add `recipient` — the controller ignores unknown fields; ledgered); apply = multipart FormData `name, email, portfolio?, message?, jobId?, turnstileToken, files` (repeated `files` entries with filenames).
- Strapi populate: NEVER `populate=*` combined with bracket keys on this instance (500s) — use explicit lists, mirrored in `scripts/snapshot-content.mjs` if queries change.
- URL scheme: `/about/`, `/ja/about/`, `/careers/`, `/careers/<slug>/` (job slugs computed via `assignSlugs`), `/contact/`. Trailing-slash link forms as in Phase 2.

---

### Task 1: Content layer v3 (about / aboutJapan / career / jobs) + deferred exports

**Files:**
- Modify: `src/lib/content.js`, `src/lib/normalize.js` (only if a new pure helper is needed)
- Modify: `src/pages/news/index.astro` (import the newly exported labels — deferred item)
- Test: `test/content.test.js` (extend)

**Interfaces (binding for Tasks 3–7):**
- `loadContent()` return gains: `about: { headline, lede, heroImage, sections: [{ title, body: string[], image }] } | null` (sections from kv_1..kv_4, only kvs with a title); `aboutJapan: { heroImage, greetingTitle, greetingBody: string[], signature: { role, name, romaji, portrait } } | null`; `career: { headline, intro: string[], contactEmail, heroImage } | null` (offers field ignored this phase); `jobs: [{ slug, documentId, title, excerpt, body: string[], location, type, locationType, applyEmail, heroImage, locationLabel, typeLabel }]` (slugs via `assignSlugs`; label maps EN: location values verbatim from Strapi strings; `typeLabel` from `JOB_TYPE_LABELS = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' }` — check the actual enum values in the snapshot's job entry and key the map off what's really there; unknown → prettified raw).
- Export `ARTICLE_KIND_LABELS` from content.js; `news/index.astro` derives its `KINDS` from it (deferred item #6 from Phase 2).
- Per-endpoint snapshot fallback keys already exist (`about`, `about_japan`, `career_en`, `jobs_en`) — reuse; single types fetch with explicit populate (`populate[hero_image]=true` etc. per field lists above).

- [ ] **Step 1: Failing tests** — extend `test/content.test.js`: about fixture with 2 populated kvs + 2 empty → `sections.length === 2`, body via blocksToParagraphs; aboutJapan fixture maps signature block; job fixture maps labels (use the snapshot's real enum values) + slug; `ARTICLE_KIND_LABELS` importable.
- [ ] **Step 2: Verify failure** (`npm test`).
- [ ] **Step 3: Implement** (normalizers pure + exported for tests; loadContent extended; memoization intact; News imports the labels).
- [ ] **Step 4: All tests pass; `npm run build` green** (existing pages unaffected).
- [ ] **Step 5: Live check** via throwaway debug page: about.headline non-null, jobs length 1 with a slug, career.contactEmail present. Delete debug page.
- [ ] **Step 6: Commit** — `"Extend content layer: about, about-japan, career, jobs"`

---

### Task 2: TurnstileBox component

**Files:**
- Create: `src/components/TurnstileBox.astro`

**Interfaces (binding for Tasks 6–7):**
- Usage: `<TurnstileBox name="contact" />` renders `<div class="turnstile-box" data-turnstile="contact"></div>` (CSS reserves 65px height so the layout doesn't jump).
- Script contract (one inline script, idempotent across multiple boxes on a page): lazy-loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once; renders the widget into each `[data-turnstile]` with site key `0x4AAAAAADx-FIVqP87bxM04`, `theme: 'light'`, `size: 'flexible'`; on `callback` dispatches `document` CustomEvent `mdmc:turnstile` with `detail: { name, token }`; on `expired-callback`/`error-callback` dispatches the same with `token: null`. Exposes `window.mdmcTurnstileReset(name)` calling `window.turnstile.reset(widgetId)` for that box (tokens are single-use — forms MUST reset after a failed submit).
- Port the semantics from `git show main:src/turnstile.jsx` (script-loader guard, explicit render, the three callbacks) — read it first.

- [ ] **Step 1: Implement** per the contract.
- [ ] **Step 2: Verify** on a throwaway test page (deleted before commit): widget iframe mounts on localhost (screenshot — READ it); manually dispatching `mdmc:turnstile` reaches a test listener; `mdmcTurnstileReset` exists and doesn't throw pre-render.
- [ ] **Step 3: Commit** — `"Add Turnstile widget component"`

---

### Task 3: About EN page

**Files:**
- Create: `src/pages/about/index.astro`

**Interfaces:** consumes `about` + `STUDIOS` (from `src/lib/studios.js` — region label + addressLines for the studio strip).

- [ ] **Step 1: Transcribe** prototype 193–240 (README §4): statement headline (statement scale) → full-width hero (1853/812 ratio; `about.heroImage` or grey) → ABOUT label-grid intro (`240px minmax(0,720px)` gap 48px; lede at 26px lead scale) → four sections in the label-grid at 96px row gaps: `.label` title left, 20px body right (from `about.sections`; render only populated ones) → three-up studio strip (4/3 images grey placeholders, region `.label`, address lines), 160px bottom padding. `<Base title="About — MDMC" active="about" description={about.lede first paragraph or default}>`.
- [ ] **Step 2: Verify** (build + screenshot vs `design/handoff/screenshots/04-about.png`; degraded: any missing kv/image renders without gaps). READ screenshots.
- [ ] **Step 3: Commit** — `"Add about page"`

---

### Task 4: About JP page + locale-aware About links

**Files:**
- Create: `src/pages/ja/about/index.astro`, `src/lib/about-jp-data.js`
- Modify: `src/components/Header.astro` (locale-aware About hrefs)

**Interfaces:** consumes `aboutJapan`; produces `ABOUT_JP` static data module (会社概要 rows + アクセス blocks).

- [ ] **Step 1: Build `src/lib/about-jp-data.js`.** The 会社概要 fact table and アクセス data are NOT in Strapi — extract the real values from the old site: `git show main:src/i18n.jsx` (the ja about/company sections) and `git show main:src/pages.jsx` (AboutBodyJa). Shape: `{ facts: [{ dt, dd }], access: [{ title, lines: [] }] }`. Values the old site lacks → prototype placeholder copy + content-needed list (never invent real-sounding data).
- [ ] **Step 2: Transcribe** prototype 243–302 (README §11): full-width hero → ご挨拶 band (clamp(32-48) title, 18px/2 body from `greetingBody`, signature: 96px circular portrait (`signature_portrait` or grey circle), role 13px muted, name 22px, romaji 12px letterspaced, bottom rule) → 会社概要 fact table (clamp(36-56) title, ruled rows `200px 1fr`, dt 14px muted, dd 17px/1.7) → アクセス (same title scale, `1.4fr 1fr` map/meta grid — map cell is a grey `var(--ph)` box this phase (real map deferred), meta blocks with top rules). `<Base title="会社概要 — MDMC" active="about">`. JP font fallbacks are already in the global stack.
- [ ] **Step 3: Locale-aware About links** in Header.astro's script: when stored locale is `ja`, rewrite the About nav link + About-panel link hrefs to `/ja/about/`; when `en`, to `/about/`; run at init and on locale click (extend `renderLocaleUI`). Both pages remain directly reachable regardless of stored locale (no redirects).
- [ ] **Step 4: Verify** (build; screenshot vs `design/handoff/screenshots/11-about-jp.png`; JP glyphs render; puppeteer: set locale ja via the panel → About nav href flips to `/ja/about/`, flip back). READ screenshots.
- [ ] **Step 5: Commit** — `"Add Japanese about page with locale-aware links"`

---

### Task 5: Careers page

**Files:**
- Create: `src/pages/careers/index.astro`

**Interfaces:** consumes `career` + `jobs`.

- [ ] **Step 1: Transcribe** prototype 305–331 (README §9): statement (career.headline, e.g. "Make things people love to use.") → hero (career.heroImage or grey) → CAREERS label-grid intro (career.intro) → OPEN POSITIONS: `.label` header, ruled rows, grid `minmax(0,420px) 200px 160px 1fr` vertically centered — job title, STUDIO/location labelled pair, TYPE/typeLabel pair, `→` far right — each row links `/careers/<slug>/`; 88px below: "Think you belong here anyway? Write to us →" → `mailto:` career.contactEmail (fallback careers@mdmc.co per prototype); 64px bottom padding. Degradation: zero jobs → section header renders with no rows (same pattern as News).
- [ ] **Step 2: Verify** (build; screenshot vs `design/handoff/screenshots/09-careers.png`; the 1 live job renders with its labels; row hover per prototype). READ screenshots.
- [ ] **Step 3: Commit** — `"Add careers page"`

---

### Task 6: Job page + application form

**Files:**
- Create: `src/pages/careers/[slug].astro`

**Interfaces:** consumes `jobs`, `TurnstileBox` (`name="apply"`), the apply payload contract (Global Constraints).

- [ ] **Step 1: Transcribe** prototype 648–702 (README §10): meta `LOCATION ・ TYPELABEL` (`.label` voice, uppercase, spaces around ・, conditional parts like News) → title (page-title scale) → hero → ABOUT THE ROLE label-grid body (`240px minmax(0,720px)`, 120px top/bottom margins; job.body paragraphs) → application form in ruled-row style: header row APPLY FOR THIS POSITION left / READ BY A HUMAN right (both `.label`); rows Name / Email / Portfolio / About you (textarea) / CV & cover letter (file input styled as "Choose files →" with 14px muted hint, multiple); TurnstileBox; submit "Send application →" text CTA disabled until token.
- [ ] **Step 2: Wire submission:** on submit, POST multipart per the legacy contract (`files` entries, `jobId` = job.documentId, `turnstileToken` from the `mdmc:turnstile` event state) to `https://upbeat-approval-82a9e54c20.strapiapp.com/api/apply`; disable during flight; success → replace form with a confirmation line (match the site's plain voice: "Thank you — we'll be in touch."); failure → inline error + `mdmcTurnstileReset('apply')` (tokens single-use) + re-enable. Never leave the button dead-ended.
- [ ] **Step 3: Verify** — ⚠ NO REAL SUBMISSION: puppeteer request interception answers `/api/apply` with 200; dispatch a fake `mdmc:turnstile` token event → submit enables; fill fields + attach a small temp file; submit → assert intercepted FormData contains name/email/jobId/turnstileToken/files; success line renders. Then intercept with 500 → error line + reset called (spy on `window.turnstile.reset` or the wrapper). Also degraded: widget mounts on localhost (screenshot). READ screenshots.
- [ ] **Step 4: Commit** — `"Add job page with Turnstile-gated application form"`

---

### Task 7: Contact page

**Files:**
- Create: `src/pages/contact/index.astro`

**Interfaces:** consumes `STUDIOS` (addressLines/email/phone/tz), `TurnstileBox` (`name="contact"`), the contact payload contract.

- [ ] **Step 1: Transcribe** prototype 393–483 (README §5): stacked statement headline ("Tell us what / you're working on.") → anchor row (New Zealand ↓ / Australia ↓ / Japan ↓ / Send a message ↓) smooth-scrolling with −96px offset via `window.scrollTo` + rect math (never scrollIntoView; respect reduced-motion with `behavior: 'auto'`) → per-studio folds (`#studio-nz|au|jp`, 176px top padding): 16/10 grey image in `7fr 4fr` grid, image side alternates NZ left / AU right / JP left; info column bottom-aligned: region `.label`, live local time (18px muted tabular-nums, blinking colon — same tick pattern as Footer, shared or duplicated per Footer's implementation; keep ONE interval), 22px address, 20px email/phone links (hover inset box-shadow underline), "Send us a message →" sets the form recipient AND scrolls to the form → form section (`#contact-form`, 176px top, 160px bottom): header row SEND A MESSAGE left / `TO ・ {recipient}` right (default "MDMC", or "{Region} Studio"); ruled rows with 240px label column, borderless 20px inputs: Name / Email / Company / Budget (placeholder "Range is fine") / Message (textarea); TurnstileBox; submit "Send message →" disabled until token.
- [ ] **Step 2: Wire submission:** JSON POST per legacy contract + `recipient` field (controller ignores unknown fields — ledgered ruling) to `.../api/contact`; same success/error/reset UX as Task 6.
- [ ] **Step 3: Verify** — ⚠ NO REAL SUBMISSION (interception, fake token event, payload assertion incl. recipient after clicking a studio's "Send us a message"); anchors scroll to ±5px of target minus 96 offset; three clocks match `TZ=... date +%H:%M`; image sides alternate correctly (screenshot vs `design/handoff/screenshots/05-contact.png`). READ screenshots.
- [ ] **Step 4: Commit** — `"Add contact page with per-studio folds and Turnstile-gated form"`

---

### Task 8: Base metadata pass (Phase-2 deferrals)

**Files:**
- Modify: `src/layouts/Base.astro`; touch each page ONLY where its props change

**Interfaces:** Base gains optional `ogImage?: string` (absolute URL). Behavior: emit `og:type` (`website`), `og:url` (canonical, from `Astro.site` + `Astro.url.pathname`), `<link rel="canonical">` same value, `og:image` when provided; detail pages get branded titles (`{project.title} — MDMC`, `{article.title} — MDMC`, `{job.title} — MDMC`) and pass `ogImage` = heroImage/thumbnail url when present; the default description string lives ONLY in Base (home stops duplicating it).

- [ ] **Step 1: Implement** (Base + the title/ogImage/description touches in work/[slug], news/[slug], careers/[slug], index.astro).
- [ ] **Step 2: Verify:** build; view dist HTML for one page of each type — canonical + og:url absolute and correct, og:image present on a project page with a hero, titles branded.
- [ ] **Step 3: Commit** — `"Complete social metadata and canonical links"`

---

### Task 9: Checkpoint — gate, sweep, push, CI

- [ ] **Step 1:** `npm test` + `npm run build` (now 14+ pages).
- [ ] **Step 2:** Puppeteer sweep: `/about/` renders; locale ja flips About links → `/ja/about/` renders JP; `/careers/` lists the job → job page renders with mounted Turnstile; `/contact/` anchors + clocks + recipient flow; existing pages unregressed (home, /work/, /news/); zero console errors (pageerror collector). READ screenshots.
- [ ] **Step 3:** Push `redesign/astro` (controller-authorized checkpoint) + `gh run watch` to green.
- [ ] **Step 4:** Report + updated content-needed list.

---

## Deferred to Phase 4 (do NOT do now)

Cutover (deploy.yml swap, hash-redirect shim, merge, webhook rebuild, GSC); real map embed on `/ja/about/` (grey placeholder this phase); JA translations of Work/News/Careers/Contact; job JA enum labels (needs user's native pass); restoring "What we offer" section (parked since 7/08, needs design/copy pass).

## Content needed from user (additions this phase)

Real map or map-embed decision for アクセス; About kv section images if the design wants them (currently text-only sections per prototype); confirmation of 会社概要 facts extracted from the old site; JP About real copy (greeting is CMS-editable now).

---

## Phase 3 execution outcome (2026-08-20)

Executed via subagent-driven development: 13 commits (`f6e7ce6..5d36c7d`, all signed after in-session re-sign); all task reviews + final whole-branch review clean after fix rounds; CI green; forms verified interception-only (zero requests ever reached the production endpoints).

**User decisions needed (content):** JP address wording — old site says "KITANAKA BRICK&WHITE BRICK south ニサンカイ", EN sources say "3F" (a ニサンカイ brochure exists in ~/Downloads suggesting it's the venue's name — confirm which is correct, then align studios.js + about-jp-data.js); 代表者 title — about-jp fact table says 代表取締役 (old site), CMS signature_role says "CEO"; career.contactEmail empty in CMS (careers@mdmc.co fallback live); JOB_TYPE_LABELS beyond "Part-time" inferred — confirm when authoring jobs; About kv images fetched but unused (design has text-only sections); real map embed for アクセス.

**Deferred to Phase 4 / next sessions:** extract shared gated-form lifecycle + clock tick into src/lib (first post-merge cleanup, before any third form); careers row double-hairline once a 2nd job exists + hardcoded hairline rgba; og:image on index pages + twitter:card; contact anchor hash/scroll-margin unification; client-side file count/size pre-check; lede truncation word-boundary; trim unused kv-image populate or render them; hreflang/og:locale strategy when real JA translations land; JA translations of Work/News/Careers/Contact; Turnstile widget language param; "What we offer" section restoration.
