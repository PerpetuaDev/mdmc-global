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
| mdmc.co.jp | mdmc-site | 2026-09-25 |
| mdmc.co, www.mdmc.co | mdmc-site | 2026-09-25 |

## Credentials

CI deploys with the repo secrets `CLOUDFLARE_API_TOKEN` (token
`mdmc-site-deploy`, account Finlayson Holdings New Zealand, no expiry) and
`CLOUDFLARE_ACCOUNT_ID`; a local copy for route changes lives in
`~/.cloudflare-token-mdmc-workers`. It holds **Workers Admin** because the
first deploy had to create the Worker and the cutovers move routes between
two Workers — narrow it to **Editor on `mdmc-site` + Zone › Workers Routes ›
Write** once the move is finished (multi-site Phase 5).

## Rollback

**Order matters: roll back mdmc.co FIRST.** `mdmc-ja-proxy` fetches its pages
from `https://mdmc.co`, so while mdmc.co is on mdmc-site, a co.jp-only rollback
still serves whatever mdmc-site serves. If mdmc-site itself is broken, roll
back both, mdmc.co first. A co.jp-only rollback helps only with a fault in the
jp mapping.

Each rollback is two steps: **the API call first** (takes effect at once), then
**the config commit** (so the next deploy doesn't re-create the route). Route
ids are NOT stable — every `wrangler deploy` of mdmc-site re-creates its routes
with new ids — so the commands look them up.

**1. mdmc.co / www.mdmc.co** — delete mdmc-site's routes on the zone; DNS still
points at GitHub Pages, which keeps deploying until Phase 5:

    T=$(cat ~/.cloudflare-token-mdmc-workers); Z=efaa22332cc50dd8f1dffa127e8b3f39
    for R in $(curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes \
        | jq -r '.result[] | select(.script=="mdmc-site") | .id'); do
      curl -s -X DELETE -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/$R
    done

Then remove the `mdmc.co/*` and `www.mdmc.co/*` entries from
`workers/site/wrangler.jsonc` and push. If a deploy was already running, re-run
the list call afterwards and delete anything it re-created.

**2. mdmc.co.jp** — re-point its route back to the old Worker:

    T=$(cat ~/.cloudflare-token-mdmc-workers); Z=6aa496716cccb4f18268026bc040067c
    R=$(curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes \
      | jq -r '.result[] | select(.pattern=="mdmc.co.jp/*") | .id')
    curl -s -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
      https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/$R \
      -d '{"pattern":"mdmc.co.jp/*","script":"mdmc-ja-proxy"}'

Then, in one commit: remove the `mdmc.co.jp/*` entry from
`workers/site/wrangler.jsonc`, and restore it in `workers/ja-proxy/wrangler.jsonc`
(`"routes": [{ "pattern": "mdmc.co.jp/*", "zone_name": "mdmc.co.jp" }]`) — the
retired config says `[]`, and a `wrangler deploy` of ja-proxy from it would
strip the route it just got back.

## When a deploy fails

A red **`deploy-worker`** job means **production did not update** (the site
is still the previous build). A red **`deploy`** (Pages) job only means the
rollback target is stale. Re-run failed jobs from the Actions run; both
re-use the same build artifact.
