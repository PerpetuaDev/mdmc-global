# JA-domain activation runbook — mdmc.co.jp

mdmc.co.jp serves the JA tree, proxied from the mdmc.co build. Sections 1–4
were **executed 2026-08-20** via the Cloudflare and XServer APIs and are
recorded here with their real IDs so they can be audited or torn down.
Sections 5–7 are the steps that remain, in order — **§5's gate is hard**.

---

## 1. DNS/zone — DONE (2026-08-20)

- **Registrar:** XServer Domain (expiry 2027-08-31). Nameservers set via the
  XServer API (`PUT /v1/domain/mdmc.co.jp/nameservers`) to the pair
  Cloudflare assigned.
- **Cloudflare zone:** `mdmc.co.jp`, zone id `6aa496716cccb4f18268026bc040067c`,
  account `Perpetua Software` (`9813fce676784ce42cff45a8d6123546`).
- **Nameservers:** `aleena.ns.cloudflare.com`, `jay.ns.cloudflare.com`.
- **DNS records:** one proxied `AAAA mdmc.co.jp → 100::` (discard-prefix
  placeholder — the Worker route answers everything; deliberately NOT a CNAME
  to the Pages origin, so if the route is ever removed the domain goes dark
  instead of serving the EN site under the JA host).
- Delegation check: `dig +short NS mdmc.co.jp` returns the two Cloudflare
  hosts and the zone shows **active** (was pending at execution time; JPRS
  republishes the co.jp zone every ~15 minutes).

## 2. The Worker — DONE (2026-08-20)

The deployed source of truth is **`workers/ja-proxy/worker.js`** (config in
`workers/ja-proxy/wrangler.jsonc`, path-mapping tests in
`test/ja-proxy.test.js`, run by `npm test`). Deployed as `mdmc-ja-proxy`
with route `mdmc.co.jp/*` on the mdmc.co.jp zone.

Behavior:

- HTML routes (`/`, `/work/`, …) → fetch `https://mdmc.co/ja/<path>`, pass
  status/headers through (no extra HTML caching). It fetches **mdmc.co
  directly** — not `perpetuadev.github.io`, which 301s to the custom domain
  and would add a hop for nothing.
- Anything with a file extension (`/_astro/*`, `/fonts/*`, `/favicon.svg`) →
  fetch `https://mdmc.co/<path>` verbatim (ja pages reference the same asset
  URLs as en pages).
- Extensionless paths without a trailing slash → 301 to the slashed form,
  so GitHub Pages' host-revealing directory redirect never reaches visitors.
- `/ja` or `/ja/*` on co.jp → 301 to the bare co.jp path. (This is a
  courtesy bounce ON the ja domain; it is NOT the SEO consolidation redirect
  — that's §6, a separate mechanism on the mdmc.co zone.)
- `/robots.txt` → served inline (`Allow: /`, **no Sitemap line** — §3).
- `/sitemap-index.xml` and `/sitemap-N.xml` → 404 (§3).
- Every origin fetch carries **`x-mdmc-ja-proxy: 1`** — the marker §6's
  redirect rule uses to exclude Worker traffic — and runs with
  `redirect: 'manual'`: an unexpected 3xx from the origin (e.g. the §6 rule
  misconfigured to catch Worker fetches) returns a loud 502 instead of
  looping visitors.

Redeploy after changes:

```bash
cd workers/ja-proxy
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=9813fce676784ce42cff45a8d6123546 npx wrangler deploy
```

## 3. robots/sitemap on co.jp — policy (recorded)

`@astrojs/sitemap` is single-site and emits `https://mdmc.co/...` URLs for
both trees, so the origin sitemap must not be exposed under the co.jp host:

- co.jp robots.txt: served inline by the Worker, no Sitemap line.
- co.jp sitemap files: 404 from the Worker.
- mdmc.co keeps the combined sitemap; GSC gets a co.jp domain property with
  no sitemap upload (§7). A per-domain co.jp sitemap is a follow-up task.

## 4. The flag flip — DONE (commit b7eb69a, this branch)

`ORIGINS.ja = 'https://mdmc.co.jp'` in `src/lib/i18n.js`. Effects (covered
by `test/i18n.test.js` live-mode cases and verified in `dist/`):

- ja links everywhere render absolute `https://mdmc.co.jp/<en-shaped path>`;
  en links on ja pages render absolute `https://mdmc.co/...`; en pages keep
  relative en links.
- hreflang ja alternates point at co.jp on both trees.
- ja pages' canonical (and og:url) is the co.jp URL — consolidating indexing
  while the same HTML stays reachable at mdmc.co/ja/* pre-§6.

To roll back just this: revert commit `b7eb69a`'s `src/lib/i18n.js` hunk
(`ja:` back to `null`) — everything downstream is derived.

## 5. Merge/deploy — REMAINING (user) — **GATED**

**Do NOT merge to main until the mdmc.co.jp zone is ACTIVE and the Worker
answers** (`curl -s https://mdmc.co.jp/robots.txt` returns the inline rules —
this works even before the merge, since it needs no origin). The flag flip
rides this branch: merging while the domain is dead would point every live
ja link, canonical and hreflang at an unresolvable host. This gate belongs
with `docs/CUTOVER.md`'s pre-merge checklist (added there).

Then merge `redesign/astro` → `main` per `docs/CUTOVER.md`. Until the deploy
lands, mdmc.co has no `/ja/` tree and co.jp HTML routes proxy mdmc.co's 404
page — harmless for an unannounced domain.

After deploy, verify end-to-end:

```bash
curl -sI https://mdmc.co.jp/ | head -1                            # HTTP/2 200
curl -s https://mdmc.co.jp/work/ | grep -o '<html lang="[a-z]*"'  # lang="ja"
curl -s https://mdmc.co.jp/robots.txt                             # inline rules, no Sitemap
curl -sI https://mdmc.co.jp/sitemap-index.xml | head -1           # 404
curl -s https://mdmc.co.jp/work/ | grep hreflang                  # en→mdmc.co, ja→mdmc.co.jp
curl -sI https://mdmc.co.jp/ja/work/ | head -2                    # 301 → /work/
curl -sI https://mdmc.co.jp/work | head -2                        # 301 → /work/

# Cache revalidation must pass through, never 502 (the Worker's redirect
# backstop excludes 304 — regression check for the bug fixed in 4e36ba5):
ET=$(curl -s -D - -o /dev/null https://mdmc.co.jp/favicon.svg | grep -i '^etag:' | tr -d '\r' | sed 's/^[Ee][Tt][Aa][Gg]: //')
curl -s -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $ET" https://mdmc.co.jp/favicon.svg   # 304
```

## 6. 301 consolidation: mdmc.co/ja/* → co.jp — REMAINING (user, after §5)

Purpose: consolidate visitors and search engines from the legacy
`mdmc.co/ja/*` URLs onto the ja domain. (Distinct from the Worker's own
`/ja` bounce in §2, which only tidies paths typed against co.jp.)

**Why the header guard:** the Worker fetches `https://mdmc.co/ja/...`
through the mdmc.co zone. A blanket 301 there would bounce the Worker's own
origin fetches (the `redirect: 'manual'` backstop would surface it as 502s —
loud, but still an outage). The Worker stamps `x-mdmc-ja-proxy: 1`; the rule
excludes it.

**Dashboard → mdmc.co zone → Rules → Redirect Rules → Create rule**, custom
filter expression (do NOT use a `$1` target with an expression match — `$1`
only binds in wildcard-pattern mode):

```
(starts_with(http.request.uri.path, "/ja/") or http.request.uri.path eq "/ja")
and not any(http.request.headers["x-mdmc-ja-proxy"][*] == "1")
```

Target: type **Dynamic**, status **301**, preserve query string, expression:

```
wildcard_replace(http.request.uri.path, "/ja*", "https://mdmc.co.jp${1}")
```

(`${1}` is `/work/` for `/ja/work/` and empty for bare `/ja`, which lands on
the co.jp root.)

Verify:

```bash
curl -sI https://mdmc.co/ja/work/ | grep -i '^HTTP\|^location'
# HTTP/2 301, location: https://mdmc.co.jp/work/
curl -sI https://mdmc.co.jp/work/ | head -1   # still 200 — Worker fetches excluded, no loop
```

## 7. Google Search Console — REMAINING (user)

- Add `mdmc.co.jp` as a **Domain property** (DNS TXT verification — add the
  TXT record on the co.jp zone in Cloudflare, unproxied).
- Do NOT upload a sitemap (§3); request indexing for `/`, `/work/`, `/about/`.

## 8. Rollback

1. Remove the Worker route (`mdmc.co.jp/*`) on the co.jp zone — the domain
   goes dark (placeholder DNS only, §1).
2. Revert the flag flip (§4) and redeploy — ja returns to same-origin `/ja/`
   prefix mode on mdmc.co.
3. Delete the §6 redirect rule if it was created.
