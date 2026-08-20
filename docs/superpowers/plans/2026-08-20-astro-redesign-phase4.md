# MDMC Redesign on Astro — Phase 4: Cutover Kit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything needed to take mdmc.co live on the redesign lands on the branch — deploy workflow, legacy-URL redirects, 404 page, sitemap/robots, rebuild-on-publish trigger, and a cutover runbook — so going live is a single user-triggered merge.

**Architecture:** The deploy workflow swap is inert until merged (it triggers on `main` only). Legacy hash URLs (`/#/work/<documentId>` etc.) only ever reach `/`, so one build-time-generated redirect script on the home page covers every old link. The Strapi→GitHub rebuild uses `repository_dispatch`; the GitHub-side trigger ships here, the Strapi-side webhook is a documented user step (needs a PAT only the user can mint).

**Tech Stack:** GitHub Actions (upload-pages-artifact@v3 / deploy-pages@v4, as today), @astrojs/sitemap, vanilla JS shim.

**Spec:** The Phase-1 plan's Phase-4 roadmap entry (docs/superpowers/plans/2026-08-19-astro-redesign-phase1.md) + old-site route shapes from `git show main:src/App.jsx` (parseHash, lines 64–80). ⚠ NOTHING in this phase pushes to or merges into `main` — the merge is the user's.

## Global Constraints

- All established conventions hold (commit style incl. Co-Authored-By trailer, puppeteer verification with READ screenshots, never submit the real forms, prototype voice for any new copy).
- Old-site route shapes (from `main:src/App.jsx` parseHash — the binding source): `#/work/<documentId>` → project, `#/news/<id>` → article, `#/careers/<id>` → job, bare `#/work|news|careers|about|contact` → index pages, anything else → home. IDs are Strapi documentIds; the new site's slugs are computed — the shim maps documentId → slug at build time.
- `deploy.yml` may be rewritten but MUST keep `on.push.branches: [main]` — that is the safety property keeping this phase inert. `redesign-check.yml` stays untouched.
- Secrets available in the repo: `VITE_STRAPI_TOKEN` (snapshot refresh uses it as-is; the Astro build maps it to `STRAPI_TOKEN`, same as redesign-check.yml).
- `astro.config.mjs` already sets `site: 'https://mdmc.co'` (sitemap needs it).

---

### Task 1: Astro deploy workflow

**Files:**
- Rewrite: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: on merge to main — test → snapshot refresh → Astro build → Pages deploy; plus a `repository_dispatch` trigger (`types: [strapi-publish]`) that Task 4's runbook wires to Strapi.

- [ ] **Step 1: Rewrite the workflow** (structure mirrors the current one + redesign-check.yml's build steps):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:
  repository_dispatch:
    types: [strapi-publish]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - name: Refresh content snapshot
        run: node scripts/snapshot-content.mjs
        env:
          VITE_STRAPI_TOKEN: ${{ secrets.VITE_STRAPI_TOKEN }}
      - name: Build
        run: npm run build
        env:
          STRAPI_TOKEN: ${{ secrets.VITE_STRAPI_TOKEN }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

(Dropped vs the old file: `VITE_BASE_URL` and `VITE_GOOGLE_MAPS_KEY` — the Astro app reads neither; grep to confirm before committing and note the result in your report.)

- [ ] **Step 2: Verify** — `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))"` parses; diff the build steps against `.github/workflows/redesign-check.yml` (they must match except test/snapshot ordering); confirm the trigger block. `npm test` + `npm run build` still green locally.
- [ ] **Step 3: Commit** — `"Swap the deploy workflow to the Astro build"`

---

### Task 2: Legacy hash-URL redirects + 404 page

**Files:**
- Modify: `src/pages/index.astro` (redirect shim, inline script near the top of the page body)
- Create: `src/pages/404.astro`
- Test: `test/redirects.test.js` + `src/lib/legacy-redirects.js`

**Interfaces:**
- Produces: `legacyRedirect(hash, map)` in `src/lib/legacy-redirects.js` — pure; `hash` is `location.hash` verbatim; `map = { work: {documentId: slug}, news: {...}, careers: {...} }`; returns a path string (`/work/<slug>/`, `/news/`, `/about/`, …) or `null` (no redirect — includes empty hash and unrecognized hashes, which stay on home). Unknown documentId in a known section → that section's index (`/work/` etc.).
- index.astro builds `map` at build time from `loadContent()` (projects/articles/jobs documentId→slug) and inlines `if (location.hash) { const t = legacyRedirect(...); if (t) location.replace(t) }` via `define:vars` (the function body must therefore be self-contained/serializable — implement it so the inline script re-declares it, and the unit-tested module export shares the same source via a template-string or duplicated-with-comment approach; simplest: keep the canonical implementation in the module and inline a minified duplicate with a comment pointing at the module + test).

- [ ] **Step 1: Failing tests** (`test/redirects.test.js`):

```js
import { describe, it, expect } from 'vitest'
import { legacyRedirect } from '../src/lib/legacy-redirects.js'

const map = { work: { d1: 'zenrise-website' }, news: { a1: 'first-post' }, careers: { j1: 'bilingual-administrator' } }

describe('legacyRedirect', () => {
  it('maps project documentIds to slug routes', () => {
    expect(legacyRedirect('#/work/d1', map)).toBe('/work/zenrise-website/')
  })
  it('maps bare section hashes to index routes', () => {
    expect(legacyRedirect('#/work', map)).toBe('/work/')
    expect(legacyRedirect('#/about', map)).toBe('/about/')
    expect(legacyRedirect('#/contact', map)).toBe('/contact/')
  })
  it('sends unknown ids to the section index', () => {
    expect(legacyRedirect('#/news/zzz', map)).toBe('/news/')
  })
  it('returns null for empty or unrecognized hashes', () => {
    expect(legacyRedirect('', map)).toBeNull()
    expect(legacyRedirect('#/whatever', map)).toBeNull()
  })
  it('tolerates the no-leading-slash form', () => {
    expect(legacyRedirect('#work/d1', map)).toBe('/work/zenrise-website/')
  })
})
```

- [ ] **Step 2: Verify failure**, **Step 3: implement** (mirror `main:src/App.jsx` parseHash semantics: strip `^#\/?`, split on `/`), **Step 4: tests green**.
- [ ] **Step 5: 404 page** — `src/pages/404.astro`: `<Base title="Page not found — MDMC">`, statement-scale headline "Page not found.", one paragraph ("The page you're looking for doesn't exist or has moved."), `.cta` link "Back to home →" → `/`. House voice, `.gutter` section, pageIn on main like every page. (New surface not in the handoff — flag for user review.)
- [ ] **Step 6: Verify** — build emits `dist/404.html`; puppeteer: `http://localhost:4321/#/work/<real documentId>` lands on the project page (grab a real documentId from the content layer); `#/careers` → `/careers/`; `#/junk` stays home without errors; 404 page renders (`/definitely-not-a-page/` via preview server returns the 404 content — `npm run preview` serves 404.html; note dev-server behavior differs).
- [ ] **Step 7: Commit** — `"Add legacy hash redirects and a 404 page"`

---

### Task 3: Sitemap + robots

**Files:**
- Modify: `astro.config.mjs`, `package.json` (add `@astrojs/sitemap`)
- Create: `public/robots.txt`

- [ ] **Step 1:** `npm install @astrojs/sitemap` (regular dependency; commit lockfile), add to `astro.config.mjs`:

```js
import sitemap from '@astrojs/sitemap'
// integrations: [sitemap()]
```

- [ ] **Step 2:** `public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://mdmc.co/sitemap-index.xml
```

- [ ] **Step 3: Verify** — build emits `dist/sitemap-index.xml` + `dist/sitemap-0.xml` containing all 15 pages (14 + 404? sitemap excludes 404 automatically — confirm and report the URL count); robots.txt in dist.
- [ ] **Step 4: Commit** — `"Add sitemap and robots.txt"`

---

### Task 4: Cutover runbook + final sweep

**Files:**
- Create: `docs/CUTOVER.md`

- [ ] **Step 1: Full gate + sweep** — `npm test`, `npm run build`; puppeteer sweep across all pages (home incl. hero fold rule, /work/ filters, a project page, /news/ empty state, /about/, /ja/about/, /careers/ + job page (Turnstile mounts), /contact/ (clocks + recipient), 404, a legacy-hash redirect) with zero console errors. READ screenshots.
- [ ] **Step 2: Write `docs/CUTOVER.md`** with exactly these sections, fully concrete:
  1. **Pre-merge checklist**: user visual pass done; Strapi `signature_role` edited; content state acknowledged (galleries/articles may be empty — site degrades by design).
  2. **The merge** (user runs): `git checkout main && git pull && git merge --no-ff redesign/astro && git push origin main` — then `gh run watch` the "Deploy to GitHub Pages" run.
  3. **Post-deploy verification**: `curl -sI https://mdmc.co/ | head -5` (200 via Cloudflare); spot-check `/work/`, `/about/`, `/contact/` in a browser; test one legacy URL `https://mdmc.co/#/work/<documentId>` redirects; confirm Pages custom-domain setting intact (Cloudflare-proxied — GitHub's own cert never provisions, `https_enforced` false is NORMAL, do not wait for it).
  4. **Strapi rebuild webhook** (user, ~5 min): GitHub → Settings → Developer settings → fine-grained PAT, repo `PerpetuaDev/mdmc-global`, permission Contents: Read & Write, 1-year expiry. Strapi Cloud → Settings → Webhooks → new webhook: URL `https://api.github.com/repos/PerpetuaDev/mdmc-global/dispatches`, headers `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`, events: entry publish/unpublish/update; payload isn't configurable in Strapi webhooks — Strapi sends its own body, GitHub requires `{"event_type":"strapi-publish"}` — ⚠ VERIFY during writing whether Strapi Cloud webhooks allow a custom body; if not, document the fallback: a `workflow_dispatch` call instead (`https://api.github.com/repos/PerpetuaDev/mdmc-global/actions/workflows/deploy.yml/dispatches` with body `{"ref":"main"}` — Strapi can't set that body either) — in that case recommend the well-trodden middleman: keep it simple and document GitHub's `repository_dispatch` requirement plus a note that if Strapi's webhook body is rejected, the rebuild trigger needs a tiny relay (Cloudflare Worker, ~10 lines, sketch it in the runbook) — investigate and write down what's actually true.
  5. **Search Console**: add property mdmc.co (domain property via Cloudflare DNS TXT), submit `https://mdmc.co/sitemap-index.xml`.
  6. **Rollback**: `git revert -m 1 <merge-commit> && git push` → the SPA redeploys in ~1 min; nothing else to undo (Strapi schema was additive, old app ignores it).
  7. **Post-cutover backlog pointer**: the deferred lists at the end of the three phase plan docs.
- [ ] **Step 3: Commit** — `"Add cutover runbook"` — and push the branch (controller-authorized checkpoint) + `gh run watch` the branch CI to green.

---

## Deferred (not this phase)

The merge itself; Strapi-side webhook creation and PAT (user-only); GSC property verification (needs user's Google account); post-merge cleanups already ledgered (shared form lifecycle, og:image on indexes, twitter:card, JA pass).

---

## Phase 4 execution outcome (2026-08-20)

Executed via subagent-driven development: deploy workflow swap (inert until merge), legacy hash shim + 404 page, sitemap/robots, cutover runbook (docs/CUTOVER.md). All task reviews + final whole-branch review clean ("Ready to merge: Yes"); CI green; safety property (nothing touches main) verified across the diff. Deferred: legacy-redirect brief home flash (cosmetic; view-transition browsers smooth it); deploy.yml/redesign-check.yml step duplication (redesign-check is legacy post-cutover). THE MERGE IS THE USER'S ACTION — see docs/CUTOVER.md.
