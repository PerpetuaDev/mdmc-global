# Language × Region matrix (2026-08-21)

User decision (supersedes the 8/20 /ja→co.jp 301 consolidation): **region and
language are independent axes.** Region picks the domain (NZ/AU → mdmc.co,
Japan → mdmc.co.jp); language picks the copy, on whatever domain you're on.
All four combinations exist. SEO: canonical-only (ja content canonicalizes to
co.jp, en content to mdmc.co; no noindex).

## Trees built at the origin (GitHub Pages)

| origin path | public surface        | ctx (site, lang) | internal links      |
|-------------|-----------------------|------------------|---------------------|
| `/`         | mdmc.co (EN)          | co, en           | `/x` (relative)     |
| `/ja/*`     | mdmc.co/ja (JA)       | co, ja           | `/ja/x` (relative)  |
| `/jp/*`     | mdmc.co.jp root (JA)  | cojp, ja         | `/x` (relative)     |
| `/en/*`     | mdmc.co.jp/en (EN)    | cojp, en         | `/en/x` (relative)  |

All internal links are same-domain relative. Cross-domain absolutes appear
only on region switches (and nowhere else).

## Canonical / hreflang (identical logic on all four trees)

- canonical: lang ja → `https://mdmc.co.jp` + enPath; lang en → `https://mdmc.co` + enPath
- hreflang: en → mdmc.co+enPath, ja → mdmc.co.jp+enPath, x-default = en
- mdmc.co sitemap excludes `/jp/*` and `/en/*` (duplicate surfaces).

## Supermenu semantics

- **Language rows**: swap language on the current domain (relative links).
- **Region rows**: Japan → co.jp counterpart, NZ/AU → mdmc.co counterpart,
  carrying the current language. On the domain a region already implies, its
  row is a preference button (stores `mdmc.region`), not a link.
- On co.jp the region is always Japan (the domain IS the region); on mdmc.co
  the stored region is nz/au. NZ-vs-AU preference rides cross-domain hops as
  `?r=nz|au`, consumed+stored+stripped (history.replaceState) on arrival —
  localStorage does not cross origins.
- `mdmc.locale` storage stays dead (removed in the previous fix).

## Worker (deploy AFTER the origin trees are live)

- `co.jp/en` + `co.jp/en/*` → origin same path
- `co.jp/ja/*` bounce (exists) + new `co.jp/jp/*` bounce → co.jp/<rest>
- everything else → origin `/jp` + path (was `/ja` + path)
- Stale window between origin deploy and Worker redeploy is safe: the old
  mapping still serves, and relative `/ja/...` links on co.jp hit the /ja
  bounce, which lands correctly.

## Cloudflare (user-side)

- DELETE the mdmc.co `/ja/*` → co.jp 301 (Rules → Redirect rules). Until
  then mdmc.co/ja keeps redirecting and the language switch can't land.
- Redeploy the Worker after the origin deploy:
  `npx wrangler deploy --config workers/ja-proxy/wrangler.jsonc`

## Code

- i18n.js: `SITES`, `sitePrefix`, `originPrefix`, `makeLinks(site, lang)`
  → `{ internal, toLang, toSite }`; `linkHref`/`ORIGINS` retired.
- Base.astro: `site` prop; canonical/hreflang per the table; passes site to
  Header/Footer.
- Header/Footer/views: `site` prop (default "co"), links via makeLinks.
- New wrapper trees src/pages/jp/** and src/pages/en/** mirroring ja/**.
