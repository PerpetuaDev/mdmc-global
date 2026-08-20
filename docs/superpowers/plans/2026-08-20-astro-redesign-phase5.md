# MDMC Redesign on Astro — Phase 5: Japanese Localization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real language switch — a mirrored `/ja/` route tree rendering the old site's shipped Japanese strings and the CMS's `.ja` content overlays (EN fallback), with locale-aware chrome replacing the client-side About-href hack, correct `lang`/hreflang, and the switcher navigating between counterpart pages.

**Architecture:** Page bodies move into `src/views/*.astro` components taking `{ locale }` (mechanical extraction, EN output byte-stable); `src/pages/**` become thin EN wrappers and `src/pages/ja/**` thin JA wrappers. UI strings come from `src/lib/i18n.js`, ported verbatim from the old site's dictionaries — **never invented**. Locale is URL-derived; the header's language buttons are plain links to the current page's counterpart.

**Tech Stack:** No new dependencies. Old-site string source: `git show main:src/i18n.jsx` (STRINGS.en lines ~3–146, STRINGS.ja lines ~147–326, 153 ja keys).

**Spec:** design/handoff/README.md §Locale ("language ja switches About to the JP page" — this phase deliberately EXCEEDS the prototype, restoring the old site's full bilinguality, per user direction 2026-08-20) + old-site behavior (`main:src/i18n.jsx`, locale-merged content). The JP About page (`/ja/about/`) stays its own distinct composition — it becomes the ja counterpart of `/about/` for switching/hreflang purposes.

## Global Constraints

- **NEVER INVENT JAPANESE.** Every ja string comes verbatim from `main:src/i18n.jsx`'s ja dict or from CMS `.ja` overlays. A redesign string with no old-dict ja equivalent stays English on the ja tree AND gets listed in the task report under "needs native JA pass" (accumulate the list phase-wide; Task 7 compiles it). This mirrors the user's standing rule (July: "JA labels need user native pass").
- **EN output is byte-stable through the refactor**: the i18n en dict entries MUST equal the currently hardcoded strings exactly; Task 3/4 verify EN pages' rendered HTML is unchanged (modulo Astro's scoping-hash attrs) before/after extraction.
- Content on ja pages: `item.ja?.field ?? item.field` (locale-merge fallback, old-site behavior — JA visitors see the full portfolio with EN where untranslated). The content layer's `.ja` overlays already exist (projects/articles/jobs); `career` ja 404s → EN.
- All established conventions hold (prototype literals preserved through extraction, commit style, puppeteer conventions incl. READ screenshots, interception-only for forms, no main pushes; gpg fallback pattern if pinentry times out).
- Locale model: URL-derived (`/ja/` prefix). `localePath('ja', '/work/')` → `/ja/work/`; `localePath('en', p)` → p. Language buttons in the header panel become `<a>` to the CURRENT page's counterpart (Base computes it); clicking still writes `mdmc.locale` to localStorage (kept for a possible future landing-redirect; region switcher behavior unchanged). The Phase-3 client-side About-href flip (`data-about-link` rewriting in renderLocaleUI) is REMOVED.
- Counterpart mapping is mechanical (`/x` ↔ `/ja/x`) with one special case: `/about/` ↔ `/ja/about/` already follows the rule; no exceptions needed. 404 stays a single EN page (no ja counterpart; its strings go on the native-pass list).
- `Base` derives `lang` from its `locale` prop; the existing explicit `lang` prop usage on `/ja/about/` is migrated to `locale="ja"`.
- hreflang: every paired page emits `<link rel="alternate" hreflang="en">`, `hreflang="ja"`, and `x-default` (= en) with absolute URLs; canonical stays self-referential.
- Region filter labels on `/ja/work/`: old dict has `work.region.*` ja keys — use them for the CHIP LABELS while filtering still matches the underlying EN region values via data-attributes. Specialty chips show raw (possibly mixed-language) service values — old-site parity, note in report.
- Date labels stay in the existing EN format on both trees (JA date format goes on the native-pass list).
- TurnstileBox gains an optional `language` prop (`language: 'ja'` in the render options when set) — resolves the Phase-3 deferred item.
- **JA domain readiness (user decision 2026-08-20):** the user is purchasing `mdmc.co.jp`, which will serve the JA tree with the URL bar as the trust signal (no visible header element). All origin logic goes through ONE config: `export const ORIGINS = { en: 'https://mdmc.co', ja: null }` in `src/lib/i18n.js` — `ja: null` means "same-origin `/ja/` prefix mode" (this phase's live behavior). When later set to `'https://mdmc.co.jp'`: ja links render as absolute `JA_ORIGIN + unprefixed path`, EN links rendered ON ja pages become absolute `ORIGINS.en + path`, EN pages keep relative EN links, and hreflang/canonical follow. Link construction everywhere uses `linkHref(fromLocale, toLocale, path)` (Task 1) so the flip is one constant + rebuild. Serving mdmc.co.jp (Cloudflare Worker proxy, DNS, 301 of mdmc.co/ja/* to co.jp) is documented in Task 6's runbook and activated by the user post-purchase.

---

### Task 1: i18n module

**Files:**
- Create: `src/lib/i18n.js`
- Test: `test/i18n.test.js`

**Interfaces (binding):**
- `export const LOCALES = ['en', 'ja']`
- `export function makeT(locale)` → `t(key)` returning the locale string, falling back to the en string, falling back to the key itself (and the module records misses — export `export function tMisses()` returning `{ ja: [keysServedAsEN...] }` for report tooling; simple module-level Set).
- `export function localePath(locale, path)` → `'/ja' + path` for ja (path always starts with `/`; `/ja` itself never doubled), path unchanged for en.
- `export function counterpartPath(locale, path)` → the same page in the OTHER locale (`counterpartPath('en', '/work/')` → `/ja/work/`; `counterpartPath('ja', '/ja/work/')` → `/work/`).
- `export const ORIGINS = { en: 'https://mdmc.co', ja: null }` (see Global Constraints — ja null = same-origin prefix mode).
- `export function linkHref(fromLocale, toLocale, path, origins = ORIGINS)` — `path` is always the EN-shaped path (`/work/`, `/`). With `origins.ja == null`: returns `localePath(toLocale, path)` (today's relative behavior). With `origins.ja` set: ja targets → `origins.ja + path` (absolute, unprefixed); en targets rendered FROM ja pages → `origins.en + path` (absolute); en targets from en pages → `path` (relative). Tests cover both modes via the `origins` parameter:

```js
describe('linkHref', () => {
  const live = { en: 'https://mdmc.co', ja: 'https://mdmc.co.jp' }
  it('is relative in same-origin mode', () => {
    expect(linkHref('en', 'ja', '/work/')).toBe('/ja/work/')
    expect(linkHref('ja', 'ja', '/work/')).toBe('/ja/work/')
    expect(linkHref('ja', 'en', '/work/')).toBe('/work/')
  })
  it('crosses domains when the ja origin is live', () => {
    expect(linkHref('en', 'ja', '/work/', live)).toBe('https://mdmc.co.jp/work/')
    expect(linkHref('ja', 'ja', '/work/', live)).toBe('https://mdmc.co.jp/work/')
    expect(linkHref('ja', 'en', '/work/', live)).toBe('https://mdmc.co/work/')
    expect(linkHref('en', 'en', '/work/', live)).toBe('/work/')
  })
})
```
- Dictionaries: `STRINGS.en` / `STRINGS.ja` ported from `git show main:src/i18n.jsx` — port ONLY keys the redesign uses (audit while porting; dead old keys like breadcrumbs stay behind), PLUS new keys for redesign-only strings whose en values are the EXACT current hardcoded literals. New keys without old-dict ja: OMIT from ja dict (fallback covers) and list in the report.

- [ ] **Step 1: Failing tests** (`test/i18n.test.js`):

```js
import { describe, it, expect } from 'vitest'
import { makeT, localePath, counterpartPath, LOCALES, STRINGS } from '../src/lib/i18n.js'

describe('makeT', () => {
  it('returns locale strings and falls back to en, then the key', () => {
    const t = makeT('ja')
    expect(t('nav.work')).toBe('ワーク')
    expect(STRINGS.ja['nav.work']).toBe('ワーク')
    expect(makeT('en')('nav.work')).toBe('Work')
    expect(t('definitely.missing.key')).toBe('definitely.missing.key')
  })
})

describe('paths', () => {
  it('prefixes ja and leaves en alone', () => {
    expect(localePath('ja', '/work/')).toBe('/ja/work/')
    expect(localePath('en', '/work/')).toBe('/work/')
    expect(localePath('ja', '/')).toBe('/ja/')
  })
  it('maps counterparts both directions', () => {
    expect(counterpartPath('en', '/work/')).toBe('/ja/work/')
    expect(counterpartPath('ja', '/ja/work/')).toBe('/work/')
    expect(counterpartPath('ja', '/ja/')).toBe('/')
    expect(counterpartPath('en', '/about/')).toBe('/ja/about/')
  })
})
```

- [ ] **Step 2: verify failure. Step 3: implement** (port dicts — spot-check at least nav.*, home.manifesto.*, work.*, news.*, careers.*, job.*, contact.*, footer.* against `git show main:src/i18n.jsx`; en values for redesign literals copied from the live components). **Step 4: green** (35+ total tests). **Step 5: commit** — `"Add i18n module with ported en/ja dictionaries"`.

---

### Task 2: Locale-aware chrome (Base / Header / Footer)

**Files:**
- Modify: `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/TurnstileBox.astro`

**Interfaces (binding):**
- `Base` props gain `locale?: 'en' | 'ja'` (default `'en'`); `lang` prop REMOVED (derived from locale); Base computes `currentPath = Astro.url.pathname` and passes `locale` + `counterpart = counterpartPath(locale, currentPath)` to Header; emits hreflang alternates (en URL, ja URL, x-default=en) built from `ORIGINS` (ja alternate = `ORIGINS.ja ? ORIGINS.ja + enShapedPath : Astro.site + '/ja' + enShapedPath`); the language-switch links and ALL cross-locale links use `linkHref`, so the co.jp flip is config-only.
- `Header` props gain `locale`, `counterpart`; all nav/panel labels via `makeT(locale)`; all internal links wrapped in `localePath(locale, …)`; the locale panel's language rows become `<a href={counterpart}>` (EN row links en counterpart, 日本語 row links ja counterpart; the CURRENT locale's row is the active/black one); clicking a language link ALSO writes `mdmc.locale` before navigation (small inline handler; navigation proceeds normally). REMOVE `data-about-link` and its renderLocaleUI rewriting. Region rows unchanged (localStorage only).
- `Footer` props gain `locale`; strings via dict (CTA "Have a project in mind? Let's talk.", region labels via `work.region.*` keys, "Send us a message", "Privacy & Terms", © line stays as-is); links via localePath (contact link etc.). Addresses stay as `studios.js` EN on both trees (report note).
- `TurnstileBox` gains optional `language?: string` — passed into `turnstile.render` options as `language` when set.

- [ ] **Step 1: implement.** **Step 2: verify** — build; EN pages' header/footer byte-identical to before (diff `dist/index.html` pre/post change ignoring hash attrs — capture a pre-change build first); no ja pages exist yet, so exercise Header with `locale="ja"` via a throwaway page (deleted): labels ja (ワーク/私たちについて/ニュース/お問い合わせ), links `/ja/…`-prefixed, language rows link counterparts. Puppeteer: mega panels + locale panel still function; footer accordions + clocks unaffected. **Step 3: commit** — `"Make the chrome locale-aware"`.

---

### Task 3: Extract views — home, work index, project (EN byte-stable)

**Files:**
- Create: `src/views/HomeView.astro`, `src/views/WorkIndexView.astro`, `src/views/ProjectView.astro`
- Modify: `src/pages/index.astro`, `src/pages/work/index.astro`, `src/pages/work/[slug].astro` (become thin wrappers passing `locale="en"` + data)
- Components (`WorkCard`, `ProjectHeader`, `GalleryStack`, `StoryView`, `PullQuote`) gain `locale`/`t` only where they contain literals (WorkCard "View project"; ProjectHeader toggle labels; StoryView section titles OVERVIEW/CHALLENGE/APPROACH/OUTCOME + "Next project"/"View project").

**Interfaces:** each view takes `{ locale, ...the exact data its page loads today }`; content-string selection INSIDE views/components via `const pick = (item, field) => (locale === 'ja' ? (item.ja?.[field] ?? item[field]) : item[field])` (define once in `src/lib/i18n.js` as `export function pickLocalized(locale, item, field)` — add in this task with a unit test, same fallback shape).
- CRITICAL: the legacy-redirect shim and hero scripts move INTO HomeView unchanged; the shim stays home-only (ja home gets it too via the view — harmless, map is locale-independent).

- [ ] **Step 1: capture baseline** — build; save `dist/index.html`, `dist/work/index.html`, one project page to the scratchpad.
- [ ] **Step 2: extract** (mechanical moves; literals → `t()` with en values equal to the removed literals; data loading STAYS in the page wrappers, views are pure templates).
- [ ] **Step 3: verify byte-stability** — rebuild; diff each captured page against the new build with Astro's scoped-style hashes normalized (`sed -E 's/astro-[a-z0-9]+/astro-X/g'` on both sides); differences beyond hashes = regression, fix before committing. `npm test` green.
- [ ] **Step 4: commit** — `"Extract home, work and project views for localization"`.

---

### Task 4: Extract remaining views + full /ja/ tree

**Files:**
- Create: `src/views/NewsIndexView.astro`, `src/views/ArticleView.astro`, `src/views/CareersView.astro`, `src/views/JobView.astro`, `src/views/ContactView.astro`
- Modify: their EN pages into wrappers (same byte-stable procedure as Task 3, baselines first)
- Create JA wrappers: `src/pages/ja/index.astro`, `ja/work/index.astro`, `ja/work/[slug].astro`, `ja/news/index.astro`, `ja/news/[slug].astro`, `ja/careers/index.astro`, `ja/careers/[slug].astro`, `ja/contact/index.astro`
- Modify: `src/pages/ja/about/index.astro` (switch `lang="ja"` prop → `locale="ja"`; content unchanged)

**Interfaces:** JA wrappers = EN wrappers with `locale="ja"`; `getStaticPaths` in ja/[slug] wrappers reuse the same loaders. Home statement on `/ja/`: `home.manifesto.1`/`home.manifesto.2` ja strings replace the hardcoded EN statement (the en dict entries must equal the current hardcoded copy incl. line breaks — `<br>` handling: dict stores `\n`, views split on it, EN byte-stability check still applies). Work region chips: label via `t('work.region.' + value)` fallback raw value. Forms on ja pages: labels/success/error via dict where old keys exist (contact.*/job.*/apply.* in old dict — port what exists); `<TurnstileBox language="ja">` on ja pages. Contact recipient labels: dict keys if present, else EN + native-pass list. dateLabel unchanged.

- [ ] **Step 1: baselines for the five EN pages. Step 2: extract + wrappers. Step 3: EN byte-stability + `npm test`. Step 4: build — route count roughly doubles (report exact); spot-render `/ja/`, `/ja/work/`, a `/ja/work/<slug>` with a ja-overlay project (Youki/Zenrise have ja) showing ja title/description, `/ja/contact/` labels. Step 5: commit** — `"Add the Japanese route tree"`.

---

### Task 5: hreflang/meta verification + locale-switch UX pass

**Files:**
- Modify: only what the checks below demand (Base/views), plus `src/pages/404.astro` if the locale prop migration touched it.

- [ ] **Step 1: verify** (build + dist inspection + puppeteer):
  - Every paired page emits exactly 3 alternates (en/ja/x-default), absolute, correct pairings both directions (spot: `/` ↔ `/ja/`, `/about/` ↔ `/ja/about/`, a project page pair); canonical self-referential; `<html lang>` right on both trees.
  - ja pages' `<title>`/description: title suffix via `title.suffix` ja where the page uses the default description; per-page descriptions fall back to EN (native-pass list) — verify no page LOST its description.
  - Locale switch round-trip in the browser: on `/work/` open locale panel → click 日本語 → land `/ja/work/` (server-rendered ja chrome, active row 日本語) → click English → back on `/work/`. Same from a project page and from `/about/` ↔ `/ja/about/`. `mdmc.locale` persisted on click.
  - Cross-page fades still work tree-internally; legacy hash shim still redirects (spot `#/work/<docId>`); sitemap includes both trees.
- [ ] **Step 2: fix anything the checks surface (scoped to those files). Step 3: commit** — `"Verify and polish locale switching, hreflang and ja metadata"`.

---

### Task 6: JA-domain activation runbook

**Files:**
- Create: `docs/JA-DOMAIN.md`

- [ ] **Step 1: Write the runbook** — terse operator's checklist for taking mdmc.co.jp live once purchased, all concrete:
  1. **DNS/zone**: add mdmc.co.jp as a Cloudflare zone; proxied DNS records per Cloudflare's Worker-routes requirements.
  2. **The Worker** (full code in the doc): on the mdmc.co.jp zone, route `mdmc.co.jp/*` → Worker that fetches the Pages origin: HTML routes map `P` → `https://mdmc.co/ja/P` (with `/` → `/ja/`), everything with a file extension (assets: `/_astro/*`, `/fonts/*`, `/favicon.svg`, `/robots.txt` special-cased below) fetched from `https://mdmc.co/P` verbatim; pass through status/headers; do NOT cache HTML beyond origin headers.
  3. **robots/sitemap on co.jp**: Worker serves a co.jp-specific `/robots.txt` (inline in the Worker, `Sitemap: https://mdmc.co.jp/sitemap-index.xml`) and maps `/sitemap-index.xml`/`/sitemap-0.xml` from origin ONLY IF the flag-on build emits co.jp URLs for ja pages — document honestly: after the flag flip, verify which URLs the sitemap emits and note that @astrojs/sitemap is single-site; the pragmatic v1 is EN-only sitemap on mdmc.co + GSC domain-property for mdmc.co.jp without a sitemap, with a proper per-domain sitemap as a follow-up.
  4. **The flag flip**: set `ORIGINS.ja = 'https://mdmc.co.jp'` in `src/lib/i18n.js`, run tests (the live-mode tests already cover it), merge/deploy.
  5. **301 consolidation**: Cloudflare redirect rule on the mdmc.co zone: `mdmc.co/ja/*` → `https://mdmc.co.jp/$1` (ONLY after the Worker serves correctly — order matters; the Worker's origin fetches to mdmc.co/ja/* must bypass the redirect: fetch the Pages origin host directly or scope the redirect rule to exclude the Worker's requests — document the resolution, e.g. fetch `PerpetuaDev.github.io/ja/...` with a Host override, or add a header check to the rule).
  6. **Verification**: curl checks for co.jp HTML/assets/hreflang pairs; GSC for the new domain.
  7. **Rollback**: disable the Worker route + revert the flag commit.
- [ ] **Step 2: sanity-check the Worker code** (syntax; dry-run the path-mapping logic in Node with a few table cases inline in the doc).
- [ ] **Step 3: Commit** — `"Add mdmc.co.jp activation runbook"`.

---

### Task 7: Checkpoint — sweep, push, CI

- [ ] **Step 1:** `npm test` + `npm run build`.
- [ ] **Step 2:** Puppeteer sweep across BOTH trees (the Phase-4 sweep list + its ja mirror; forms interception-only as always; zero console errors).
- [ ] **Step 3:** Push branch (controller-authorized), `gh run watch` to green.
- [ ] **Step 4:** Report incl. the compiled **needs-native-JA-pass list** (every string served as EN on the ja tree) and the route-count/sitemap numbers.

---

## Deferred (not this phase)

JA date formatting; ja-specific meta descriptions; 404 ja copy; JP-address display in the ja footer; region-aware content filtering; the standing post-merge cleanups.

---

## Phase 5 execution outcome (2026-08-20)

Executed via subagent-driven development in COORDINATION with a parallel session that took mdmc.co.jp live mid-phase (zone active, Worker `mdmc-ja-proxy` deployed, ORIGINS.ja flipped): main-session commits 638c8ff..20dde9f + 6841a60 + fix waves; peer commits b7eb69a + 5344b03 (reviewed in the final whole-branch pass); final fix wave 4e36ba5. 123 tests, 27 routes, CI green. Full bilingual tree live on the branch: ja links absolute co.jp, hreflang/canonical cross-domain, locale switch = counterpart links.

**⚠ Before merge:** (1) peer must REDEPLOY the Worker from repo source ≥4e36ba5 (the deployed version 502s on 304 revalidation — fixed in repo) and verify with `curl -sI -H 'If-None-Match: "x"' https://mdmc.co.jp/robots.txt`; (2) re-sign `f9d6397` (rebase rewrites subsequent SHAs incl. peer's — coordinate); (3) CUTOVER.md gates incl. "zone active + Worker answering" (satisfied, re-verify at merge time).

**Needs native JA pass (user):** the 30 en-only dict keys (full list in task-7 report: form labels, filters, project section titles, 404, footer bottom bar, share/back links), the "Language" panel header, mixed "日本 Studio" recipient label, contact headline/anchor labels, JA date formats, ja meta descriptions. **Deferred:** split-origin locale-indicator drift (cosmetic, needs UX decision); dead dict keys (footer.copy/privacyTerms/notFound.* unused); Worker asset-heuristic comment + cookie stripping; per-domain sitemap for co.jp.
