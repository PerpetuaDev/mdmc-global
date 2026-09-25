# Multi-site infrastructure — design

Date: 2026-09-25 · Status: approved in conversation, awaiting written-spec review

## Intent

Turn MDMC's two-domain site into a **group of sites**: a global site plus one
site per country, each with its own layout set and SEO profile, all offering
the same languages. This spec is **infrastructure only** — content stays as it
is today and diverges per site later, page by page (the Japan About page is the
first existing case of a per-site layout).

What the user asked for (their words, condensed):

- mdmc.co is positioned as the **global** site, in preparation for an eventual
  mdmc.com.
- Local sites: **mdmc.co.nz**, **mdmc.co.jp**, and **mdmc.com.au** (domain not
  yet obtainable — a disabled slot).
- A visitor to the global site whose location/language doesn't match gets a
  **brand-aligned bar at the top** of the page, written in their browser
  language, offering their local site or to stay on global. The bar **pushes
  the header down**, never covers the logo. Reference: apple.com.
- **Manual choices are respected.** Language changes never change layout;
  layout changes only with the domain (site). mdmc.co is fully viewable in
  Japanese, mdmc.co.jp fully viewable in English.
- **Separate SEO profiles** per local site.
- Willing to change hosting (paid if needed); does **not** want a public repo.
- Every site offers **English + Japanese**; **Korean** is likely later.

Success criteria:

1. Every URL live today on mdmc.co and mdmc.co.jp still resolves to the same
   page after the migration.
2. mdmc.co.nz is live, serving the global content with the NZ studio first.
3. mdmc.co.jp/en/about/ renders the Japan (会社概要) layout in English;
   mdmc.co/ja/about/ renders the global (essay) layout in Japanese.
4. Each page is self-canonical and carries a complete hreflang cluster.
5. The suggestion bar follows the decision table below, is in the first paint
   (zero layout shift), and never reappears after a choice.
6. The repo is private and GitHub Pages is retired.
7. Adding `ko`, enabling `au`, or moving global to mdmc.com is a registry edit
   plus content — no structural change.

## Current state (what this replaces)

- Astro static build in GitHub Actions (`.github/workflows/deploy.yml`:
  `npm test` → Strapi snapshot → build) → **GitHub Pages**. Public repo
  `PerpetuaDev/mdmc-global`.
- mdmc.co is Cloudflare-proxied to Pages.
- mdmc.co.jp is the **`mdmc-ja-proxy` Worker** (`workers/ja-proxy/`), which
  fetches from `https://mdmc.co` and maps paths (`co.jp/*` → origin `/jp/*`,
  `co.jp/en/*` → origin `/en/*`, `/ja` + `/jp` bounce to the bare path, custom
  robots.txt, trailing-slash normalisation).
- Strapi publish → `mdmc-strapi-relay` Worker → `repository_dispatch` →
  the same Actions build.
- The site dimension is a `co | cojp` pair (`SITES` in `src/lib/i18n.js`,
  `site` props, ~11 inline `site === "cojp"` checks). Languages are a
  hardcoded `['en','ja']`. 39 thin page wrappers exist across four trees
  (`src/pages/`, `ja/`, `en/`, `jp/`).
- **Layout follows language**: every `ja` page renders the Japan About layout,
  every `en` page the global one — the bug that started this work.
- **Canonical follows language**: all `ja` canonicalises to co.jp, all `en` to
  mdmc.co. hreflang is `en` / `ja` / `x-default` only.
- Region NZ/AU on mdmc.co is a client-side preference (`localStorage
  mdmc.region`, carried cross-domain as `?r=`); it only orders studios, picks
  the contact form's default recipient, and tags analytics.
- No location or browser-language detection anywhere.

## 1. Hosting and routing

**One Cloudflare Worker with static assets** serves every domain. Builds stay
in GitHub Actions; the final step becomes `wrangler deploy` instead of the
Pages upload. The relay Worker and its `repository_dispatch` path are
unchanged.

### URL shape — unchanged for existing sites

Each site serves its default language at the root and other languages under a
prefix:

| Site | Root | Prefixed |
|---|---|---|
| mdmc.co (global) | en | `/ja/` (later `/ko/`) |
| mdmc.co.nz | en | `/ja/` (later `/ko/`) |
| mdmc.co.jp | ja | `/en/` (later `/ko/`) |
| mdmc.com.au (disabled) | en | `/ja/` (later `/ko/`) |

### Build output

One directory per site, languages nested inside it by the same prefix rule:
`dist/global/`, `dist/global/ja/`, `dist/nz/`, `dist/nz/ja/`, `dist/jp/`,
`dist/jp/en/`. Shared assets (`/_astro/`, `/fonts/`, images, favicons) stay at
the dist root and are served identically on every host.

### Worker responsibilities

1. Host → site id (from the sites registry). Unknown host, or the bare
   `*.workers.dev` preview host, serves **global**. On preview/non-production
   hosts only, `?site=<id>` overrides the site.
2. Map the path into that site's directory and serve from the assets binding.
   Asset paths (have a file extension) are served from the dist root.
3. Carry over the existing rules: `/ja` and `/jp` bounces on co.jp,
   trailing-slash normalisation, the legacy `#/work/<docId>` shim (client-side,
   unchanged), per-host robots.txt and sitemap (Section 3).
4. Missing page → that site's own 404 page with status 404.
5. On the **global** host only, inject `data-geo="<CC>"` into `<html>` via
   HTMLRewriter (Section 4). Injection happens after the asset cache, so
   caching is unaffected.

`mdmc-ja-proxy` is retired; its `mapPath` tests are the starting point for the
new Worker's tests.

### Cutover (staged, reversible until the last step)

- **Phase 1 serves today's build unchanged**: the Worker maps mdmc.co to the
  current root tree and co.jp to the current `/jp` + `/en` trees (i.e. the
  ja-proxy's mapping, reading from assets instead of fetching the origin).
  Nothing visible changes.
- Order: preview URL verified → **mdmc.co.jp** (already a Worker; re-point the
  route) → **mdmc.co** (detach from Pages) → **mdmc.co.nz** (after Phase 2) →
  retire Pages → **make the repo private**.
- Making the repo private MUST be last: toggling private deletes the Pages
  configuration outright (7/16 outage). Before that step, rolling back any
  domain = re-pointing it at the old setup.

Prerequisites (user): a Cloudflare API token for Actions with Workers Scripts
edit + routes on the four zones, stored as a repo secret; the existing Claude
token is DNS-only.

## 2. Sites and languages

### Registries

`src/lib/sites.js` — the single source of truth for sites:

| id | host | defaultLang | country | studio order | entity / privacy | enabled |
|---|---|---|---|---|---|---|
| `global` | mdmc.co | en | — | NZ, AU, JP | NZ | yes |
| `nz` | mdmc.co.nz | en | NZ | NZ, AU, JP | NZ | yes |
| `jp` | mdmc.co.jp | ja | JP | JP, NZ, AU | JP (APPI) | yes |
| `au` | mdmc.com.au | en | AU | AU, NZ, JP | — | **no** |

Each entry also carries: its brand suffix (Section 3), its hreflang region,
and its layout overrides. Moving global to mdmc.com = changing one `host`.

A languages registry (`en`, `ja`; `ko` later) replaces `LOCALES` and holds
per-language properties now scattered in `i18n.js`: title separator, date
format, hreflang code. `STRINGS` stays per-language. All `co`/`cojp` checks
and `SITES`/`sitePrefix`/`originPrefix`/`makeLinks`/`brandSuffix`/`pageTitle`
move onto the two registries.

### Pages

The 39 wrappers collapse into one page file per page type (~10), under a
dynamic route (`src/pages/[site]/[...lang]/…`) whose `getStaticPaths` expands
every **enabled site × site language**. Adding a site or language adds pages,
never files.

### Layout sets follow the site

Each site may override the view for any page type; otherwise the default is
used:

- `jp`: About → `AboutJpView`, Privacy → `PrivacyJpView` (APPI).
- `global`, `nz`: default views (`AboutView`, `PrivacyView`, …).

Every view renders in every language. Consequences: co.jp/en/about/ = the
会社概要 layout in English; mdmc.co/ja/about/ = the essay layout in Japanese.
The footer's bare `/privacy/` link keeps resolving to the right entity per
site.

### Site switcher replaces the region preference

The header's region menu lists **sites** (Global, New Zealand, Japan;
Australia once enabled), each a cross-domain link carrying the current
language and page. `localStorage mdmc.region`, the `?r=` carry, and the
same-domain preference buttons are removed. Analytics reports the site id in
place of the stored region.

### Contact form default studio

From the site: `nz` → NZ, `jp` → JP, `au` → AU. On **global**, from the
visitor's detected country (`data-geo`, Section 4) if it is NZ/AU/JP, else NZ.
The visitor can still change it.

### Missing translations

Field-level fallback: requested language → site default language → English
(today's behaviour, generalised).

### Strapi: About types gain i18n

Neither `about` nor `about-japan` is localised today (the essay exists only in
English, the greeting only in Japanese). Both get i18n enabled in
mdmc-strapi. Enabling it files existing content under the default locale
(`en`), so `about-japan`'s Japanese content must be **copied into its `ja`
locale** before an `en` locale is written. Missing versions are filled with
**machine drafts marked for review** (same convention as the 8/24 JA pass):
English greeting + signature, Japanese essay + sections. The hardcoded
会社概要/アクセス tables in `about-jp-data.js` gain English rows the same way.
Requires a temporary full-access Strapi token (user flips it back to
read-only afterwards) and a Strapi Cloud redeploy.

## 3. Per-site SEO

### Self-canonical

Every page's canonical is its own URL on its own host. The language-based
consolidation (ja → co.jp, en → mdmc.co) is retired.

### hreflang clusters

Every paired page lists every enabled site × language:

| Rendering | hreflang |
|---|---|
| mdmc.co (en) | `en`, plus `x-default` |
| mdmc.co/ja/ | `ja` |
| mdmc.co.nz (en) | `en-NZ` |
| mdmc.co.nz/ja/ | `ja-NZ` |
| mdmc.co.jp (ja) | `ja-JP` |
| mdmc.co.jp/en/ | `en-JP` |
| mdmc.com.au (en), when enabled | `en-AU` |

Global uses bare language codes: it targets everyone no country variant
covers. **Privacy pages are excluded** from clusters (different legal
documents for different entities, not equivalents). The 404 stays excluded.

### robots.txt and sitemaps per host

The Worker serves each host its own `robots.txt` pointing at its own sitemap;
each sitemap lists that host's self-canonical URLs in all its languages. The
special-cased `sitemap-cojp.xml` becomes the general case.

### Titles and descriptions per site

Brand suffix follows the site: global **MDMC**, nz **MDMC New Zealand**, jp
unchanged. NZ descriptions reuse global's until the user writes NZ copy
(copy is the user's call — no invented wording).

### Structured data

Global declares the **parent Organization** (stable `@id` on mdmc.co). Each
local site declares its studio as a local business with its address and
`parentOrganization` → that `@id`.

### User-side

Search Console property for mdmc.co.nz; add the new domain to the GA4
stream's domain list; review Cloudflare's **managed robots.txt** on every zone
(it can prepend rules to the Worker's robots.txt, and currently blocks AI
crawlers the user wants unblocked).

### Expected churn

Flipping canonicals makes co.jp/en and mdmc.co/ja indexable in their own right
— a few weeks of canonical changes in Search Console. co.nz is near-duplicate
of global until content lands; hreflang covers that.

## 4. Suggestion bar (global site only)

### Inputs

- **Country**: `data-geo` on `<html>`, injected by the Worker from Cloudflare's
  request country, global host only. On preview/local hosts, `?geo=<CC>`
  overrides it.
- **Browser language**: `navigator.languages`, first entry whose primary
  subtag matches a site language (`ja-JP` → `ja`).

### Decision (one pure, unit-tested function)

`suggest({ country, languages, site, lang, sites }) → offer | null`. At most one
offer; the location rule is checked first.

| Visitor's country | Browser language vs. page | Offer |
|---|---|---|
| Has an enabled local site (NZ, JP; AU later) | any | That local site, in the browser language if the site has it, else the site's default language |
| No local site | matches the page | none |
| No local site | differs, global has it | Global in their language (e.g. mdmc.co/ja/) |
| No local site | differs, global lacks it | none |

The bar's own copy is in the browser language when supported, else English.

### Suppression

No bar when: the visitor chose "Stay on Global" or dismissed it (remembered in
`localStorage`); the visitor has switched language or site via the header
(same flag); the visitor arrived from one of the group's own hosts (referrer
host in the sites registry). Blocked storage → bar still works, just not
remembered. No country → no location offer.

### Rendering — decided before first paint

A small inline script in `<head>` reads `data-geo`, the languages, the flag
and the referrer, and decides synchronously. If there is an offer, the bar is
in the document from the **first frame**, above the header, with the header
laid out below it — **zero layout shift**. The pop-down feel comes from the
bar's contents sliding/fading in inside already-reserved space. Dismissing
collapses the bar and the header rises; that follows the user's input, so it
doesn't count as layout shift. Home hero fold measurement already observes
header geometry and must be checked against the bar.

Look: site type, spacing tokens, hairline, Söhne arrow glyph; exact look
settled on screen during implementation. Accessibility: a labelled region,
doesn't steal focus, Escape dismisses, `prefers-reduced-motion` skips the
motion. Strings live in `STRINGS`; ja is machine-drafted, marked for review.

### Analytics

`suggest_shown`, `suggest_accepted`, `suggest_dismissed`, with site/lang/country.

## 5. Build order, testing, failure behaviour, scope

### Phases (one implementation plan each, each ships independently)

1. **Hosting** — Worker serves today's build unchanged; cut over co.jp then
   mdmc.co; retire `mdmc-ja-proxy`.
2. **Sites & languages** — registries, collapsed pages, per-site layouts
   (About fix), Strapi i18n migration + machine drafts, site switcher, launch
   mdmc.co.nz.
3. **SEO** — self-canonicals, hreflang clusters, per-host robots/sitemaps,
   per-site titles, parent/local structured data.
4. **Suggestion bar** — `data-geo` injection, pre-paint decision, bar,
   analytics.
5. **Private repo** — retire GitHub Pages, then toggle private.

### Testing

- Unit: registries; Worker host→site mapping and redirects (from
  `ja-proxy.test.js`); every page self-canonical with a complete hreflang
  cluster; `suggest()` against every row of the decision table.
- **URL gate**: every URL live today (both sitemaps + the co.jp paths) resolves
  to the same page after Phases 1 and 2.
- Browser: walk every site × language on the preview URL before each cutover;
  extend `npm run audit:responsive` to nz; measure the bar's first paint for
  layout shift.

### Failure behaviour

Unknown host / bare preview → global. Missing page → that site's 404. No
country or failed injection → no bar, page served normally. Blocked storage →
bar unremembered.

### Out of scope

Per-site content divergence (user); AU launch; the mdmc.com move; Korean;
Search Console / GA4 console work (user); a Japanese rendering of the NZ
privacy policy. The structure supports all of them without rework.
