# Hosting

Multi-site spec: `docs/superpowers/specs/2026-09-25-multi-site-infrastructure-design.md`.

## How it works

- `.github/workflows/deploy.yml` builds `dist/` on every push to `main` and every
  Strapi publish (`repository_dispatch: strapi-publish`, via the
  `mdmc-strapi-relay` Worker), then deploys it twice: to GitHub Pages and to the
  **`mdmc-site`** Worker (`workers/site/`).
- `mdmc-site` resolves the site from the host (`mdmc.co` → global,
  `mdmc.co.jp` → jp; `www.mdmc.co` 301s to the apex) and serves files from its
  assets binding. Mapping: `workers/site/worker.js`; tests:
  `test/site-worker.test.js`.
- A domain is served by `mdmc-site` only once a **Workers route** points at it.
  Without a route, the zone's DNS record decides (mdmc.co → GitHub Pages).

## Preview

`https://mdmc-site.perpetua-software.workers.dev/` serves global. Append `?site=jp`
once to switch the preview to co.jp (sticky cookie); `?site=global` switches
back. Never submit the forms on preview — they send real mail, and Turnstile
rejects the host.

## Verifying

`npm run gate -- capture` (once, before any cutover) records every live URL's
status, redirect, title and canonical to `.audit/url-baseline.json`.
`npm run gate -- check` re-checks production; `npm run gate -- check --preview
<base>` checks the preview. Both must report 0 mismatches.

## Cutover state

| Domain | Served by | Since |
|---|---|---|
| mdmc.co.jp | mdmc-ja-proxy → GitHub Pages | 2026-08-21 |
| mdmc.co, www.mdmc.co | GitHub Pages | 2026-07 |

## Credentials

CI deploys with the repo secrets `CLOUDFLARE_API_TOKEN` (token
`mdmc-site-deploy`, account Finlayson Holdings New Zealand, no expiry) and
`CLOUDFLARE_ACCOUNT_ID`; a local copy for route changes lives in
`~/.cloudflare-token-mdmc-workers`. It holds **Workers Admin** because the
first deploy had to create the Worker and the cutovers move routes between
two Workers — narrow it to **Editor on `mdmc-site` + Zone › Workers Routes ›
Write** once the move is finished (multi-site Phase 5).

## Rollback

Filled in per domain at cutover (plan Tasks 6–7).
