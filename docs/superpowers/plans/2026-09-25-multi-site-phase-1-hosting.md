# Multi-site Phase 1 — Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve mdmc.co and mdmc.co.jp from one Cloudflare Worker with static assets, byte-for-byte the same behaviour as today, so GitHub Pages and `mdmc-ja-proxy` can later be retired.

**Architecture:** A new Worker `mdmc-site` (`workers/site/`) binds the Astro `dist/` as static assets with `run_worker_first`, resolves the site from the request host (`mdmc.co` → `global`, `mdmc.co.jp` → `jp`), and maps each path into today's build trees — `global` is an identity mapping, `jp` is a port of `mdmc-ja-proxy`'s `mapPath` reading assets instead of fetching the origin. CI keeps deploying GitHub Pages **and** adds a `wrangler deploy`. Cutover is by re-pointing Cloudflare Workers routes (atomic, instantly reversible), verified by a URL gate that diffs every live URL against a baseline captured before anything changed.

**Tech Stack:** Cloudflare Workers + static assets, wrangler 4, Astro 5 static build, vitest 3, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-25-multi-site-infrastructure-design.md` (Section 1 and Phase 1 of Section 5).

## Global Constraints

- **No visible change.** Every URL on mdmc.co / www.mdmc.co / mdmc.co.jp returns the same status, redirect target, `<title>` and canonical as before. The URL gate (Task 4) is the arbiter.
- Build trees are **unchanged** in this phase: `dist/` root = global en, `dist/ja/` = global ja, `dist/en/` = co.jp en, `dist/jp/` = co.jp ja. No Astro page, layout or config edits.
- Site ids are `global` and `jp` (the spec's registry ids — Phase 2 builds on them).
- Worker name `mdmc-site`; `compatibility_date` `"2026-08-20"` (matches the existing workers).
- Redirects are **301** and preserve the query string (GitHub Pages behaviour; `?utm_*`, `_gl` must survive).
- The `?site=` / `mdmc_site` cookie override works **only** on `*.workers.dev`, `localhost` and `127.0.0.1` — production hosts ignore both.
- **GitHub Pages keeps deploying** and **the repo stays public** throughout Phase 1 (toggling private deletes the Pages config — that is Phase 5, last).
- Never submit the contact/apply forms on the preview host: they send real Mailgun mail and Turnstile does not allow `*.workers.dev`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; signing is the machine default.
- Run the suite with `npm test` from the repo root (`~/projects/mdmc-website`).

## Review Focus

- **Revalidating visitors** (`If-None-Match` / `If-Modified-Since`) must still get a normal 304 on real pages, and a 404 page must never come back as a body-less 304 — pinned in Task 2 (`strips conditional headers when serving the 404 page`).
- **HEAD requests** (link checkers, uptime monitors) must reach the assets binding as HEAD — pinned in Task 2 (`passes the visitor's method and headers through`).
- **Query strings on redirects** (`/work?utm_source=x`, GA `_gl` linker) must survive the trailing-slash and www redirects — pinned in Task 2 (`keeps the query string on redirects`).
- **Percent-encoded paths** (a future Japanese slug like `/work/%E3%83%86/`) must map as HTML, not fall into the asset branch or be double-decoded — pinned in Task 1 (`maps percent-encoded paths as HTML`).
- **Override leakage**: a visitor on mdmc.co sending `?site=jp` or a `mdmc_site=jp` cookie must still get the global site — pinned in Task 1 (`ignores the override on production hosts`) and Task 2 (`does not honour ?site= on production`).

---

## File Structure

| File | Responsibility |
|---|---|
| `workers/site/worker.js` (create) | Host → site resolution, per-site path mapping, request handling against the `ASSETS` binding |
| `workers/site/wrangler.jsonc` (create) | Worker config: assets binding, `run_worker_first`, routes (added at cutover) |
| `test/site-worker.test.js` (create) | Unit tests for the Worker (pure functions + `handleRequest` with a fake `ASSETS`) |
| `scripts/lib/url-gate.js` (create) | Pure URL-gate logic: sitemap parsing, entry list, response fingerprint, diff |
| `scripts/url-gate.mjs` (create) | CLI: `capture` a baseline from production, `check` production or a preview against it |
| `test/url-gate.test.js` (create) | Unit tests for `scripts/lib/url-gate.js` |
| `.github/workflows/deploy.yml` (modify) | Add a `deploy-worker` job next to the Pages deploy |
| `docs/HOSTING.md` (create) | Runbook: how hosting works now, cutover state, rollback commands |
| `workers/ja-proxy/wrangler.jsonc` (modify, Task 6) | Drop its route so a stray deploy can't steal co.jp back |
| `package.json` (modify) | `wrangler` devDependency; `gate` script |

---

### Task 1: Site resolution and path mapping

**Files:**
- Create: `workers/site/worker.js`
- Test: `test/site-worker.test.js`

**Interfaces:**
- Produces:
  - `HOSTS: Record<string, 'global' | 'jp'>` — `{ 'mdmc.co': 'global', 'mdmc.co.jp': 'jp' }`
  - `isPreviewHost(hostname: string): boolean`
  - `resolveSite(hostname: string, cookieHeader: string | null): 'global' | 'jp'`
  - `mapPath(site: 'global' | 'jp', pathname: string): { kind: 'robots' } | { kind: 'none' } | { kind: 'redirect', to: string } | { kind: 'asset', to: string } | { kind: 'html', to: string }` — for `html`, `to` always ends in `/` (the directory; Task 2 appends `index.html`).

- [ ] **Step 1: Write the failing tests**

Create `test/site-worker.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { HOSTS, isPreviewHost, resolveSite, mapPath } from '../workers/site/worker.js'

describe('resolveSite', () => {
  it('maps the production hosts', () => {
    expect(HOSTS).toEqual({ 'mdmc.co': 'global', 'mdmc.co.jp': 'jp' })
    expect(resolveSite('mdmc.co', null)).toBe('global')
    expect(resolveSite('mdmc.co.jp', null)).toBe('jp')
  })

  it('serves global to an unknown host', () => {
    expect(resolveSite('example.com', null)).toBe('global')
  })

  it('recognises preview hosts', () => {
    expect(isPreviewHost('mdmc-site.perpetua-software.workers.dev')).toBe(true)
    expect(isPreviewHost('localhost')).toBe(true)
    expect(isPreviewHost('127.0.0.1')).toBe(true)
    expect(isPreviewHost('mdmc.co')).toBe(false)
    expect(isPreviewHost('workers.dev.example.com')).toBe(false)
  })

  it('reads the override cookie on preview hosts only', () => {
    expect(resolveSite('mdmc-site.x.workers.dev', 'mdmc_site=jp')).toBe('jp')
    expect(resolveSite('localhost', 'a=1; mdmc_site=jp; b=2')).toBe('jp')
    expect(resolveSite('localhost', null)).toBe('global')
    expect(resolveSite('localhost', 'mdmc_site=bogus')).toBe('global')
  })

  it('ignores the override on production hosts', () => {
    expect(resolveSite('mdmc.co', 'mdmc_site=jp')).toBe('global')
    expect(resolveSite('mdmc.co.jp', 'mdmc_site=global')).toBe('jp')
  })
})

describe('mapPath — global (today\'s mdmc.co, identity mapping)', () => {
  it('serves directory URLs from the same path', () => {
    expect(mapPath('global', '/')).toEqual({ kind: 'html', to: '/' })
    expect(mapPath('global', '/about/')).toEqual({ kind: 'html', to: '/about/' })
    expect(mapPath('global', '/ja/work/youki/')).toEqual({ kind: 'html', to: '/ja/work/youki/' })
    // GitHub Pages serves the co.jp trees publicly on mdmc.co today; keep that.
    expect(mapPath('global', '/jp/about/')).toEqual({ kind: 'html', to: '/jp/about/' })
    expect(mapPath('global', '/en/about/')).toEqual({ kind: 'html', to: '/en/about/' })
  })

  it('passes files through, robots and sitemaps included', () => {
    expect(mapPath('global', '/robots.txt')).toEqual({ kind: 'asset', to: '/robots.txt' })
    expect(mapPath('global', '/sitemap-index.xml')).toEqual({ kind: 'asset', to: '/sitemap-index.xml' })
    expect(mapPath('global', '/_astro/index.abc.css')).toEqual({ kind: 'asset', to: '/_astro/index.abc.css' })
  })

  it('adds the trailing slash', () => {
    expect(mapPath('global', '/about')).toEqual({ kind: 'redirect', to: '/about/' })
  })
})

describe('mapPath — jp (port of mdmc-ja-proxy)', () => {
  it('maps HTML routes onto the /jp tree', () => {
    expect(mapPath('jp', '/')).toEqual({ kind: 'html', to: '/jp/' })
    expect(mapPath('jp', '/work/youki/')).toEqual({ kind: 'html', to: '/jp/work/youki/' })
  })

  it('passes /en through unchanged', () => {
    expect(mapPath('jp', '/en/')).toEqual({ kind: 'html', to: '/en/' })
    expect(mapPath('jp', '/en/about/')).toEqual({ kind: 'html', to: '/en/about/' })
  })

  it('serves files from the dist root', () => {
    for (const path of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/icon-192.png',
      '/icon-512.png', '/site.webmanifest', '/_astro/x.css', '/fonts/a.woff2', '/sitemap-cojp.xml']) {
      expect(mapPath('jp', path)).toEqual({ kind: 'asset', to: path })
    }
  })

  it('bounces stray /ja and /jp prefixes to the bare path', () => {
    expect(mapPath('jp', '/ja/work/')).toEqual({ kind: 'redirect', to: '/work/' })
    expect(mapPath('jp', '/ja')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('jp', '/jp/')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('jp', '/jp/about/')).toEqual({ kind: 'redirect', to: '/about/' })
  })

  it('serves robots inline and hides the single-site sitemap', () => {
    expect(mapPath('jp', '/robots.txt')).toEqual({ kind: 'robots' })
    expect(mapPath('jp', '/sitemap-index.xml')).toEqual({ kind: 'none' })
    expect(mapPath('jp', '/sitemap-0.xml')).toEqual({ kind: 'none' })
  })

  it('adds the trailing slash', () => {
    expect(mapPath('jp', '/work')).toEqual({ kind: 'redirect', to: '/work/' })
  })
})

describe('mapPath — edge paths', () => {
  it('maps percent-encoded paths as HTML', () => {
    expect(mapPath('global', '/work/%E3%83%86/')).toEqual({ kind: 'html', to: '/work/%E3%83%86/' })
    expect(mapPath('jp', '/work/%E3%83%86/')).toEqual({ kind: 'html', to: '/jp/work/%E3%83%86/' })
  })

  it('treats a dot in a directory segment as HTML when the URL ends in a slash', () => {
    expect(mapPath('global', '/work/v1.2/')).toEqual({ kind: 'html', to: '/work/v1.2/' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/site-worker.test.js`
Expected: FAIL — `Failed to load url ../workers/site/worker.js`.

- [ ] **Step 3: Implement**

Create `workers/site/worker.js`:

```js
// mdmc-site — serves every MDMC domain from one Worker with static assets
// (multi-site spec, 2026-09-25, Phase 1). Phase 1 reproduces today's hosting
// exactly: mdmc.co is GitHub Pages' identity mapping of dist/, and mdmc.co.jp
// is mdmc-ja-proxy's mapping (co.jp/* → /jp/*, co.jp/en/* → /en/*) reading
// the assets binding instead of fetching the origin. See docs/HOSTING.md.

export const HOSTS = { 'mdmc.co': 'global', 'mdmc.co.jp': 'jp' }
const SITE_IDS = new Set(Object.values(HOSTS))
const PREVIEW_COOKIE = 'mdmc_site'

// Preview hosts may pick a site with ?site= (sticky via cookie) so every site
// can be checked before cutover. Production hosts never honour it.
export function isPreviewHost(hostname) {
  return hostname.endsWith('.workers.dev') || hostname === 'localhost' || hostname === '127.0.0.1'
}

export function resolveSite(hostname, cookieHeader) {
  const site = HOSTS[hostname]
  if (site) return site
  if (isPreviewHost(hostname) && cookieHeader) {
    const m = new RegExp(`(?:^|;\\s*)${PREVIEW_COOKIE}=([a-z]+)`).exec(cookieHeader)
    if (m && SITE_IDS.has(m[1])) return m[1]
  }
  return 'global'
}

function isFile(pathname) {
  return pathname.slice(pathname.lastIndexOf('/') + 1).includes('.')
}

function hasPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

// Today's mdmc.co: GitHub Pages serves dist/ as-is.
function mapGlobal(pathname) {
  if (isFile(pathname)) return { kind: 'asset', to: pathname }
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  return { kind: 'html', to: pathname }
}

// Today's mdmc.co.jp: ported from workers/ja-proxy/worker.js mapPath.
function mapJp(pathname) {
  if (pathname === '/robots.txt') return { kind: 'robots' }
  // @astrojs/sitemap describes mdmc.co only; co.jp's own is sitemap-cojp.xml.
  if (pathname === '/sitemap-index.xml' || /^\/sitemap-\d+\.xml$/.test(pathname)) return { kind: 'none' }
  // /ja is mdmc.co's Japanese surface and /jp is where this host's root tree
  // is built — either on co.jp would double up, so bounce to the bare path.
  for (const prefix of ['/ja', '/jp']) {
    if (hasPrefix(pathname, prefix)) return { kind: 'redirect', to: pathname.slice(prefix.length) || '/' }
  }
  if (isFile(pathname)) return { kind: 'asset', to: pathname }
  if (!pathname.endsWith('/')) return { kind: 'redirect', to: pathname + '/' }
  if (hasPrefix(pathname, '/en')) return { kind: 'html', to: pathname }
  return { kind: 'html', to: '/jp' + pathname }
}

export function mapPath(site, pathname) {
  return site === 'jp' ? mapJp(pathname) : mapGlobal(pathname)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/site-worker.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add workers/site/worker.js test/site-worker.test.js
git commit -m "Add the mdmc-site Worker's host and path mapping

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Request handling against the assets binding

**Files:**
- Modify: `workers/site/worker.js` (append)
- Test: `test/site-worker.test.js` (append)

**Interfaces:**
- Consumes: `resolveSite`, `mapPath`, `isPreviewHost` from Task 1.
- Produces:
  - `handleRequest(request: Request, env: { ASSETS: { fetch(req: Request): Promise<Response> } }): Promise<Response>`
  - `default export { fetch(request, env) }` — the Workers entry point.
  - `WWW_REDIRECTS: Record<string, string>` — `{ 'www.mdmc.co': 'mdmc.co' }`

Behaviour (html_handling is `none` in wrangler config — the Worker names exact files):
- `www.mdmc.co/*` → 301 `https://mdmc.co/*` keeping the query.
- Preview host with `?site=<id>` → 302 to the same URL without `site`, setting `mdmc_site=<id>` when the id is valid.
- `robots` → co.jp's inline robots (`User-agent: *\nAllow: /\n`, exactly as ja-proxy).
- `none` → a bare `Not found` text 404 (exactly as ja-proxy — not the 404 page).
- `redirect` → 301 to `origin + to + search`.
- `asset` → `ASSETS` fetch of `to`; `html` → `ASSETS` fetch of `to + 'index.html'`; either returning 404 → the 404 page.
- 404 page → `ASSETS` fetch of `/404.html` with a **plain GET** (no conditional headers), re-wrapped with status 404.

- [ ] **Step 1: Write the failing tests**

Append to `test/site-worker.test.js`:

```js
import { handleRequest } from '../workers/site/worker.js'

// A fake ASSETS binding over an in-memory file map. It records every request
// it receives and honours If-None-Match the way the real binding does.
function fakeAssets(files) {
  const calls = []
  return {
    calls,
    async fetch(req) {
      calls.push(req)
      const path = new URL(req.url).pathname
      if (!(path in files)) return new Response('missing', { status: 404 })
      if (req.headers.get('if-none-match') === '"v1"') return new Response(null, { status: 304 })
      return new Response(req.method === 'HEAD' ? null : files[path], {
        headers: { 'content-type': path.endsWith('.html') ? 'text/html' : 'text/plain', etag: '"v1"' },
      })
    },
  }
}

const FILES = {
  '/index.html': 'global home',
  '/about/index.html': 'global about',
  '/jp/index.html': 'jp home',
  '/jp/about/index.html': 'jp about',
  '/en/about/index.html': 'cojp en about',
  '/404.html': 'not found page',
  '/robots.txt': 'global robots',
  '/favicon.svg': '<svg/>',
}

const req = (url, init) => new Request(url, init)

describe('handleRequest', () => {
  it('serves a directory URL from its index.html', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/'), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('global about')
    expect(new URL(env.ASSETS.calls[0].url).pathname).toBe('/about/index.html')
  })

  it('serves co.jp from the /jp tree and /en passthrough', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    expect(await (await handleRequest(req('https://mdmc.co.jp/'), env)).text()).toBe('jp home')
    expect(await (await handleRequest(req('https://mdmc.co.jp/about/'), env)).text()).toBe('jp about')
    expect(await (await handleRequest(req('https://mdmc.co.jp/en/about/'), env)).text()).toBe('cojp en about')
  })

  it('serves files from the dist root on both hosts', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    expect(await (await handleRequest(req('https://mdmc.co.jp/favicon.svg'), env)).text()).toBe('<svg/>')
    expect(await (await handleRequest(req('https://mdmc.co/robots.txt'), env)).text()).toBe('global robots')
  })

  it('serves co.jp its inline robots.txt', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/robots.txt'), { ASSETS: fakeAssets(FILES) })
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toBe('User-agent: *\nAllow: /\n')
  })

  it('returns the 404 page with status 404 for a missing page or file', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    for (const url of ['https://mdmc.co/nope/', 'https://mdmc.co.jp/nope/', 'https://mdmc.co/missing.png']) {
      const res = await handleRequest(req(url), env)
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('not found page')
    }
  })

  // mdmc-ja-proxy answered the hidden sitemaps with a bare text 404, not the
  // 404 page — the URL gate holds us to that.
  it('hides the single-site sitemap on co.jp with a plain-text 404', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/sitemap-index.xml'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })

  it('strips conditional headers when serving the 404 page', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/nope/', { headers: { 'if-none-match': '"v1"' } }), env)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('not found page')
  })

  it('passes a revalidation 304 through on a real page', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/', { headers: { 'if-none-match': '"v1"' } }), env)
    expect(res.status).toBe(304)
  })

  it("passes the visitor's method and headers through", async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/', { method: 'HEAD', headers: { 'accept-language': 'ja' } }), env)
    expect(res.status).toBe(200)
    expect(env.ASSETS.calls[0].method).toBe('HEAD')
    expect(env.ASSETS.calls[0].headers.get('accept-language')).toBe('ja')
  })

  it('adds the trailing slash with a 301', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/about'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mdmc.co.jp/about/')
  })

  it('keeps the query string on redirects', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const slash = await handleRequest(req('https://mdmc.co/work?utm_source=x&_gl=1*abc'), env)
    expect(slash.headers.get('location')).toBe('https://mdmc.co/work/?utm_source=x&_gl=1*abc')
    const www = await handleRequest(req('https://www.mdmc.co/about/?utm_source=x'), env)
    expect(www.status).toBe(301)
    expect(www.headers.get('location')).toBe('https://mdmc.co/about/?utm_source=x')
  })

  it('bounces /jp on co.jp', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/jp/about/'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mdmc.co.jp/about/')
  })

  it('sets the preview override cookie and strips ?site=', async () => {
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/about/?site=jp&a=1'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://mdmc-site.x.workers.dev/about/?a=1')
    expect(res.headers.get('set-cookie')).toBe('mdmc_site=jp; Path=/; SameSite=Lax')
  })

  it('serves the overridden site on preview', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/about/', { headers: { cookie: 'mdmc_site=jp' } }), env)
    expect(await res.text()).toBe('jp about')
  })

  it('ignores an invalid ?site= value without setting a cookie', async () => {
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/?site=evil'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('does not honour ?site= on production', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/?site=jp', { headers: { cookie: 'mdmc_site=jp' } }), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('global about')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/site-worker.test.js`
Expected: FAIL — `handleRequest` is not exported.

- [ ] **Step 3: Implement**

Append to `workers/site/worker.js`:

```js
export const WWW_REDIRECTS = { 'www.mdmc.co': 'mdmc.co' }

// co.jp's robots.txt, verbatim from mdmc-ja-proxy: no Sitemap line, because
// dist/robots.txt names mdmc.co's sitemap.
const JP_ROBOTS = 'User-agent: *\nAllow: /\n'

function assetRequest(request, path, init) {
  const url = new URL(request.url)
  url.pathname = path
  url.search = ''
  return init ? new Request(url, init) : new Request(url, request)
}

// A plain GET: a visitor revalidating a missing URL must get the 404 page's
// body, never a body-less 304 re-labelled 404.
async function notFound(request, env) {
  const page = await env.ASSETS.fetch(assetRequest(request, '/404.html', { method: 'GET' }))
  return new Response(request.method === 'HEAD' ? null : page.body, {
    status: 404,
    headers: { 'content-type': page.headers.get('content-type') ?? 'text/html' },
  })
}

async function serveFile(request, env, path) {
  const res = await env.ASSETS.fetch(assetRequest(request, path))
  return res.status === 404 ? notFound(request, env) : res
}

export async function handleRequest(request, env) {
  const url = new URL(request.url)

  const apex = WWW_REDIRECTS[url.hostname]
  if (apex) return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301)

  const preview = isPreviewHost(url.hostname)
  if (preview && url.searchParams.has('site')) {
    const requested = url.searchParams.get('site')
    url.searchParams.delete('site')
    const headers = new Headers({ location: url.toString() })
    if (SITE_IDS.has(requested)) headers.set('set-cookie', `${PREVIEW_COOKIE}=${requested}; Path=/; SameSite=Lax`)
    return new Response(null, { status: 302, headers })
  }

  const site = resolveSite(url.hostname, preview ? request.headers.get('cookie') : null)
  const mapped = mapPath(site, url.pathname)

  switch (mapped.kind) {
    case 'robots':
      return new Response(JP_ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    case 'none':
      return new Response('Not found', { status: 404 })
    case 'redirect':
      return Response.redirect(`${url.origin}${mapped.to}${url.search}`, 301)
    case 'asset':
      return serveFile(request, env, mapped.to)
    default:
      return serveFile(request, env, mapped.to + 'index.html')
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
}
```

Note `url.searchParams.delete` leaves `?a=1` intact and removes the `?` entirely when nothing is left (`URL` serialises an empty search as `''`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/site-worker.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, no regressions (the stale `.claude/worktrees/redesign-astro` copy may double the file count; that is pre-existing).

- [ ] **Step 6: Commit**

```bash
git add workers/site/worker.js test/site-worker.test.js
git commit -m "Serve requests from the assets binding in the mdmc-site Worker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wrangler config and a local smoke run

**Files:**
- Create: `workers/site/wrangler.jsonc`
- Modify: `package.json` (devDependency)

**Interfaces:**
- Consumes: `workers/site/worker.js` default export (Task 2).
- Produces: a deployable Worker named `mdmc-site` whose assets binding is `ASSETS` over `dist/`.

- [ ] **Step 1: Pin wrangler as a devDependency**

Run: `npm install --save-dev wrangler@4`
Expected: `package.json` gains `"wrangler": "^4.x"` under `devDependencies`; `package-lock.json` updates.

- [ ] **Step 2: Create the config**

Create `workers/site/wrangler.jsonc`:

```jsonc
{
  // mdmc-site — every MDMC domain from one Worker (docs/HOSTING.md).
  // Routes are added at cutover (plan Tasks 6-7), never before: deploying
  // with a route live would cut that domain over.
  "name": "mdmc-site",
  "main": "worker.js",
  "compatibility_date": "2026-08-20",
  "workers_dev": true,
  "assets": {
    "directory": "../../dist",
    "binding": "ASSETS",
    // The Worker decides everything: host → site, path → file, 404s.
    "run_worker_first": true,
    // The Worker names exact files (…/index.html, /404.html), so the
    // binding must not rewrite or redirect paths itself.
    "html_handling": "none",
    "not_found_handling": "none"
  }
}
```

- [ ] **Step 3: Build and run it locally**

Run: `npm run build && npx wrangler dev --config workers/site/wrangler.jsonc --port 8787`
(leave it running; use a second shell for Step 4)
Expected: `Ready on http://localhost:8787`.

- [ ] **Step 4: Smoke-check both sites**

Run:

```bash
J=$(mktemp)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/about/                      # 200
curl -s http://localhost:8787/about/ | grep -o '<title>[^<]*</title>'                       # the EN About title
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:8787/about        # 301 …/about/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/nope/                        # 404
curl -s -c "$J" -o /dev/null -w '%{http_code}\n' 'http://localhost:8787/?site=jp'           # 302
curl -s -b "$J" http://localhost:8787/about/ | grep -o '<title>[^<]*</title>'               # the 会社概要 title
curl -s -b "$J" http://localhost:8787/robots.txt                                            # User-agent: * / Allow: /
curl -s -b "$J" -o /dev/null -w '%{http_code}\n' http://localhost:8787/favicon.svg          # 200
```

Expected: each line matches its comment. Stop `wrangler dev` afterwards.

- [ ] **Step 5: Commit**

```bash
git add workers/site/wrangler.jsonc package.json package-lock.json
git commit -m "Add the mdmc-site wrangler config

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: URL gate, and the baseline captured before anything changes

**Files:**
- Create: `scripts/lib/url-gate.js`, `scripts/url-gate.mjs`
- Test: `test/url-gate.test.js`
- Modify: `package.json` (`"gate": "node scripts/url-gate.mjs"`)

**Interfaces:**
- Produces:
  - `extractLocs(xml: string): string[]`
  - `buildEntries(coLocs: string[], cojpLocs: string[]): Array<{ site: 'global' | 'jp', path: string, host?: string }>`
  - `entryKey(entry): string` — `"<host or site> <path>"`
  - `fingerprint(status: number, getHeader: (name: string) => string | null, body: string, requestOrigin: string): { status, location?, type?, title?, canonical?, body? }`
  - `diffFingerprints(baseline: Record<string, object>, current: Record<string, object>): Array<{ key, field, expected, actual }>`
  - CLI: `npm run gate -- capture` writes `.audit/url-baseline.json`; `npm run gate -- check` diffs production; `npm run gate -- check --preview <base>` diffs a preview host (skipping `host` probes). Exit 1 on any mismatch.

- [ ] **Step 1: Write the failing tests**

Create `test/url-gate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { extractLocs, buildEntries, entryKey, fingerprint, diffFingerprints } from '../scripts/lib/url-gate.js'

const headers = (h) => (name) => h[name.toLowerCase()] ?? null

describe('extractLocs', () => {
  it('pulls every <loc> out of a sitemap', () => {
    const xml = '<urlset><url><loc>https://mdmc.co/</loc></url><url><loc> https://mdmc.co/about/ </loc></url></urlset>'
    expect(extractLocs(xml)).toEqual(['https://mdmc.co/', 'https://mdmc.co/about/'])
  })
})

describe('buildEntries', () => {
  const entries = buildEntries(['https://mdmc.co/', 'https://mdmc.co/about/'], ['https://mdmc.co.jp/', 'https://mdmc.co.jp/privacy/'])
  const keys = entries.map(entryKey)

  it('covers all four trees on the hosts that serve them today', () => {
    for (const k of ['global /', 'global /about/', 'global /en/about/', 'jp /en/about/',
      'jp /', 'jp /privacy/', 'global /ja/', 'global /ja/privacy/', 'global /jp/privacy/']) {
      expect(keys).toContain(k)
    }
  })

  it('adds redirect, 404, file and www probes', () => {
    for (const k of ['global /about', 'global /nope/', 'global /robots.txt', 'global /work?utm_source=gate',
      'jp /about', 'jp /ja/about/', 'jp /jp/about/', 'jp /robots.txt', 'jp /sitemap-index.xml', 'www.mdmc.co /about/']) {
      expect(keys).toContain(k)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('fingerprint', () => {
  it('records title and canonical for HTML', () => {
    const html = '<title>About | MDMC</title><link rel="canonical" href="https://mdmc.co/about/">'
    expect(fingerprint(200, headers({ 'content-type': 'text/html; charset=utf-8' }), html, 'https://mdmc.co'))
      .toEqual({ status: 200, type: 'text/html', title: 'About | MDMC', canonical: 'https://mdmc.co/about/' })
  })

  it('makes same-origin redirect targets relative and ignores redirect content-type', () => {
    expect(fingerprint(301, headers({ location: 'https://mdmc.co/about/', 'content-type': 'text/html' }), '', 'https://mdmc.co'))
      .toEqual({ status: 301, location: '/about/' })
    expect(fingerprint(301, headers({ location: 'https://mdmc.co/about/' }), '', 'https://www.mdmc.co'))
      .toEqual({ status: 301, location: 'https://mdmc.co/about/' })
  })

  it('treats text/xml and application/xml as the same type', () => {
    expect(fingerprint(200, headers({ 'content-type': 'text/xml' }), '<x/>', 'https://mdmc.co').type).toBe('application/xml')
  })

  it('records plain-text bodies (robots.txt)', () => {
    expect(fingerprint(200, headers({ 'content-type': 'text/plain' }), 'User-agent: *\n', 'https://mdmc.co').body).toBe('User-agent: *')
  })
})

describe('diffFingerprints', () => {
  it('reports changed fields and missing keys', () => {
    const base = { a: { status: 200, title: 'X' }, b: { status: 301, location: '/b/' } }
    const cur = { a: { status: 200, title: 'Y' } }
    expect(diffFingerprints(base, cur)).toEqual([
      { key: 'a', field: 'title', expected: 'X', actual: 'Y' },
      { key: 'b', field: 'missing', expected: 'present', actual: 'absent' },
    ])
  })

  it('is empty when everything matches', () => {
    expect(diffFingerprints({ a: { status: 200 } }, { a: { status: 200 } })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/url-gate.test.js`
Expected: FAIL — cannot load `../scripts/lib/url-gate.js`.

- [ ] **Step 3: Implement the library**

Create `scripts/lib/url-gate.js`:

```js
// Pure logic for the hosting-migration URL gate (scripts/url-gate.mjs).
// A gate entry is one URL as a visitor reaches it today; its fingerprint is
// what must not change across the move: status, redirect target, <title>,
// canonical (and the body, for plain text like robots.txt).

export function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

const pathOf = (u) => {
  const x = new URL(u)
  return x.pathname + x.search
}

export function entryKey(entry) {
  return `${entry.host ?? entry.site} ${entry.path}`
}

// coLocs: mdmc.co's sitemap (the global en tree). cojpLocs: sitemap-cojp.xml
// (the co.jp ja tree). Together they imply all four built trees and which
// host serves each today (GitHub Pages serves /en and /jp on mdmc.co too).
export function buildEntries(coLocs, cojpLocs) {
  const entries = []
  const add = (site, path, extra = {}) => entries.push({ site, path, ...extra })
  for (const p of coLocs.map(pathOf)) {
    add('global', p)
    add('global', '/en' + p)
    add('jp', '/en' + p)
  }
  for (const q of cojpLocs.map(pathOf)) {
    add('jp', q)
    add('global', '/ja' + q)
    add('global', '/jp' + q)
  }
  for (const p of ['/about', '/nope/', '/robots.txt', '/sitemap-index.xml', '/sitemap-cojp.xml', '/favicon.svg', '/work?utm_source=gate']) {
    add('global', p)
  }
  for (const p of ['/about', '/ja/about/', '/jp/about/', '/nope/', '/robots.txt', '/sitemap-cojp.xml', '/sitemap-index.xml', '/favicon.svg']) {
    add('jp', p)
  }
  add('global', '/about/', { host: 'www.mdmc.co' })

  const seen = new Set()
  return entries.filter((e) => {
    const k = entryKey(e)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const TYPE_ALIASES = { 'text/xml': 'application/xml' }

export function fingerprint(status, getHeader, body, requestOrigin) {
  const fp = { status }
  const location = getHeader('location')
  if (location) {
    const l = new URL(location, requestOrigin)
    fp.location = l.origin === requestOrigin ? l.pathname + l.search : l.href
  }
  if (status >= 300 && status < 400) return fp
  const raw = (getHeader('content-type') ?? '').split(';')[0].trim().toLowerCase()
  fp.type = TYPE_ALIASES[raw] ?? raw
  if (fp.type === 'text/html' && body) {
    fp.title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? null
    fp.canonical = body.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null
  }
  if (fp.type === 'text/plain' && body) fp.body = body.trim()
  return fp
}

export function diffFingerprints(baseline, current) {
  const out = []
  for (const [key, expected] of Object.entries(baseline)) {
    const actual = current[key]
    if (!actual) {
      out.push({ key, field: 'missing', expected: 'present', actual: 'absent' })
      continue
    }
    for (const field of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      if (expected[field] !== actual[field]) out.push({ key, field, expected: expected[field], actual: actual[field] })
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/url-gate.test.js`
Expected: PASS.

- [ ] **Step 5: Implement the CLI**

Create `scripts/url-gate.mjs`:

```js
// URL gate for the hosting move (multi-site Phase 1). Proves every URL a
// visitor can reach today behaves the same after the move.
//
//   npm run gate -- capture                       baseline from production → .audit/url-baseline.json
//   npm run gate -- check                         production vs baseline
//   npm run gate -- check --preview <base-url>    a preview host vs baseline (www probes skipped)
//
// Exits 1 on any mismatch. Capture BEFORE the first cutover and keep the file.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildEntries, diffFingerprints, entryKey, extractLocs, fingerprint } from './lib/url-gate.js'

const BASELINE = new URL('../.audit/url-baseline.json', import.meta.url)
const ORIGINS = { global: 'https://mdmc.co', jp: 'https://mdmc.co.jp' }

async function text(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

async function productionEntries() {
  const index = await text('https://mdmc.co/sitemap-index.xml')
  const coLocs = []
  for (const sitemap of extractLocs(index)) coLocs.push(...extractLocs(await text(sitemap)))
  const cojpLocs = extractLocs(await text('https://mdmc.co.jp/sitemap-cojp.xml'))
  return buildEntries(coLocs, cojpLocs)
}

function requestFor(entry, previewBase) {
  if (previewBase) {
    return { url: previewBase.replace(/\/$/, '') + entry.path, headers: { cookie: `mdmc_site=${entry.site}` } }
  }
  const origin = entry.host ? `https://${entry.host}` : ORIGINS[entry.site]
  return { url: origin + entry.path, headers: {} }
}

async function fingerprintAll(entries, previewBase) {
  const result = {}
  const queue = entries.filter((e) => !(previewBase && e.host))
  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const { url, headers } = requestFor(e, previewBase)
      const res = await fetch(url, { redirect: 'manual', headers })
      const body = await res.text()
      result[entryKey(e)] = fingerprint(res.status, (n) => res.headers.get(n), body, new URL(url).origin)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return result
}

const [mode, flag, previewBase] = process.argv.slice(2)

if (mode === 'capture') {
  const entries = await productionEntries()
  const fingerprints = await fingerprintAll(entries)
  await mkdir(new URL('.', BASELINE), { recursive: true })
  await writeFile(BASELINE, JSON.stringify({ capturedAt: new Date().toISOString(), entries, fingerprints }, null, 2))
  console.log(`captured ${entries.length} URLs → .audit/url-baseline.json`)
} else if (mode === 'check') {
  const preview = flag === '--preview' ? previewBase : null
  const baseline = JSON.parse(await readFile(BASELINE, 'utf-8'))
  const current = await fingerprintAll(baseline.entries, preview)
  const expected = preview
    ? Object.fromEntries(Object.entries(baseline.fingerprints).filter(([k]) => k in current))
    : baseline.fingerprints
  const diffs = diffFingerprints(expected, current)
  for (const d of diffs) console.log(`✗ ${d.key}  ${d.field}: ${JSON.stringify(d.expected)} → ${JSON.stringify(d.actual)}`)
  console.log(`${Object.keys(current).length} URLs checked against baseline from ${baseline.capturedAt}: ${diffs.length} mismatches`)
  process.exit(diffs.length ? 1 : 0)
} else {
  console.error('usage: npm run gate -- capture | check [--preview <base-url>]')
  process.exit(2)
}
```

Add to `package.json` `scripts`: `"gate": "node scripts/url-gate.mjs"`.

- [ ] **Step 6: Capture the baseline from today's production**

Run: `npm run gate -- capture`
Expected: `captured N URLs → .audit/url-baseline.json` with N ≈ 150 (≈23 per sitemap × the tree multipliers, plus 16 probes). `.audit/` is gitignored — the baseline stays local; that is intended.

- [ ] **Step 7: Prove the gate is stable against itself**

Run: `npm run gate -- check`
Expected: `… 0 mismatches`. If anything differs on an unchanged site, the fingerprint is picking up noise — fix the fingerprint before relying on it.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/url-gate.js scripts/url-gate.mjs test/url-gate.test.js package.json
git commit -m "Add a URL gate for the hosting move

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Deploy to the preview host from CI, and write the runbook

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `docs/HOSTING.md`

**Interfaces:**
- Consumes: `workers/site/wrangler.jsonc` (Task 3), `npm run gate` (Task 4).
- Produces: every push / Strapi publish deploys GitHub Pages **and** `mdmc-site` (route-less, reachable only at its `*.workers.dev` URL).

- [ ] **Step 1: User — create the Cloudflare token and secrets (blocking)**

Ask the user to:
1. In the Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom, create **`mdmc-site-deploy`** with **Account › Workers Scripts › Edit** and **Zone › Workers Routes › Edit** on zones `mdmc.co`, `mdmc.co.jp`, `mdmc.co.nz`. No expiry (a lapsed token is the silent-failure mode this project has hit twice).
2. Store it for CI: `! gh secret set CLOUDFLARE_API_TOKEN -R PerpetuaDev/mdmc-global` (paste at the prompt).
3. Store it locally for the cutover API calls: `! install -m 600 /dev/stdin ~/.cloudflare-token-mdmc-workers` (paste, then Ctrl-D).

Then look up the account id yourself and store it:

```bash
curl -s -H "Authorization: Bearer $(cat ~/.cloudflare-token-mdmc-workers)" \
  https://api.cloudflare.com/client/v4/zones/efaa22332cc50dd8f1dffa127e8b3f39 | jq -r .result.account.id
gh secret set CLOUDFLARE_ACCOUNT_ID -R PerpetuaDev/mdmc-global --body '<that id>'
```

Expected: a 32-hex account id; `gh secret list -R PerpetuaDev/mdmc-global` shows both secrets.

- [ ] **Step 2: Add the deploy job**

In `.github/workflows/deploy.yml`, append to the `build` job's steps (after `actions/upload-pages-artifact@v3`):

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: site-dist
          path: dist
```

and add a job alongside `deploy`:

```yaml
  # Multi-site Phase 1: the same build, served by the mdmc-site Worker.
  # Runs next to the Pages deploy until Phase 5 so rollback stays current.
  deploy-worker:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - uses: actions/download-artifact@v4
        with:
          name: site-dist
          path: dist
      - run: npx wrangler deploy --config workers/site/wrangler.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 3: Write the runbook**

Create `docs/HOSTING.md`:

```markdown
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

`https://mdmc-site.<subdomain>.workers.dev/` serves global. Append `?site=jp`
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

## Rollback

Filled in per domain at cutover (plan Tasks 6–7).
```

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml docs/HOSTING.md
git commit -m "Deploy the build to the mdmc-site Worker alongside GitHub Pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Watch the run**

Run: `gh run watch -R PerpetuaDev/mdmc-global --exit-status "$(gh run list -R PerpetuaDev/mdmc-global -L 1 --json databaseId -q '.[0].databaseId')"`
Expected: `build`, `deploy` and `deploy-worker` all succeed. The `deploy-worker` log prints the `https://mdmc-site.<subdomain>.workers.dev` URL — record the subdomain in `docs/HOSTING.md`'s Preview section.

- [ ] **Step 6: Gate the preview**

Run: `npm run gate -- check --preview https://mdmc-site.<subdomain>.workers.dev`
Expected: `… 0 mismatches`. Any mismatch blocks Task 6: fix the Worker (with a failing test first), push, re-run.

- [ ] **Step 7: Browser spot-check**

Open the preview in a real browser: global home, a project page, `/ja/`; then `?site=jp` and the co.jp home, `/about/`, `/en/about/`. Check fonts, images and the favicon load (all are root-relative assets) and the home hero slideshow runs. Record the result in the commit message of Task 6.

- [ ] **Step 8: Commit the preview subdomain**

```bash
git add docs/HOSTING.md
git commit -m "Record the mdmc-site preview URL

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Cut over mdmc.co.jp

**Files:**
- Modify: `workers/site/wrangler.jsonc` (add route), `workers/ja-proxy/wrangler.jsonc` (drop route), `docs/HOSTING.md`

**Interfaces:**
- Consumes: the deployed `mdmc-site` (Task 5), `~/.cloudflare-token-mdmc-workers` (Task 5 Step 1).
- Produces: `mdmc.co.jp/*` served by `mdmc-site`.

- [ ] **Step 1: Find the existing route**

```bash
T=$(cat ~/.cloudflare-token-mdmc-workers); Z=6aa496716cccb4f18268026bc040067c
curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes | jq '.result'
```

Expected: one route `{ "id": "<ROUTE_ID>", "pattern": "mdmc.co.jp/*", "script": "mdmc-ja-proxy" }`. Note `<ROUTE_ID>`.

- [ ] **Step 2: Re-point it atomically**

```bash
curl -s -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/<ROUTE_ID> \
  -d '{"pattern":"mdmc.co.jp/*","script":"mdmc-site"}' | jq '.success, .result'
```

Expected: `true` and the route now naming `mdmc-site`. (A PUT swaps the script in one step — there is no window with no Worker on the domain.)

- [ ] **Step 3: Gate production**

Run: `npm run gate -- check`
Expected: `… 0 mismatches`. On any mismatch, **roll back immediately** (same PUT with `"script":"mdmc-ja-proxy"`), then debug.

- [ ] **Step 4: Make the config match reality**

In `workers/site/wrangler.jsonc`, after `"workers_dev": true,` add:

```jsonc
  "routes": [
    { "pattern": "mdmc.co.jp/*", "zone_name": "mdmc.co.jp" }
  ],
```

In `workers/ja-proxy/wrangler.jsonc`, replace the `routes` array with `"routes": []` and add above it:

```jsonc
  // RETIRED 2026-09-25: mdmc.co.jp is served by mdmc-site (docs/HOSTING.md).
  // Kept deployed, route-less, as the rollback target until multi-site Phase 5.
```

In `docs/HOSTING.md`, set the mdmc.co.jp row to `mdmc-site | <today>` and replace the Rollback section's placeholder line with:

```markdown
**mdmc.co.jp** — re-point its route back to the old Worker (instant):

    T=$(cat ~/.cloudflare-token-mdmc-workers); Z=6aa496716cccb4f18268026bc040067c
    curl -s -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
      https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/<ROUTE_ID> \
      -d '{"pattern":"mdmc.co.jp/*","script":"mdmc-ja-proxy"}'
```

(with the real `<ROUTE_ID>` from Step 1 written in).

- [ ] **Step 5: Commit and push, and confirm CI keeps the route**

```bash
git add workers/site/wrangler.jsonc workers/ja-proxy/wrangler.jsonc docs/HOSTING.md
git commit -m "Serve mdmc.co.jp from the mdmc-site Worker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

Watch the run as in Task 5 Step 5, then re-run `npm run gate -- check`.
Expected: all jobs green; the route still names `mdmc-site` (Step 1's command); 0 mismatches.

---

### Task 7: Cut over mdmc.co and www.mdmc.co

**Files:**
- Modify: `workers/site/wrangler.jsonc`, `docs/HOSTING.md`

**Interfaces:**
- Consumes: the deployed `mdmc-site` with co.jp live (Task 6).
- Produces: every MDMC domain served by `mdmc-site`; GitHub Pages still deployed but no longer reached.

- [ ] **Step 1: Confirm no routes exist on mdmc.co yet**

```bash
T=$(cat ~/.cloudflare-token-mdmc-workers); Z=efaa22332cc50dd8f1dffa127e8b3f39
curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes | jq '.result'
```

Expected: `[]`. If a route exists, stop and ask the user what it is.

- [ ] **Step 2: Add both routes**

```bash
for p in 'mdmc.co/*' 'www.mdmc.co/*'; do
  curl -s -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
    https://api.cloudflare.com/client/v4/zones/$Z/workers/routes \
    -d "{\"pattern\":\"$p\",\"script\":\"mdmc-site\"}" | jq -c '.success, .result'
done
```

Expected: two `true` results with ids. Note both ids.

- [ ] **Step 3: Gate production**

Run: `npm run gate -- check`
Expected: `… 0 mismatches`, including `www.mdmc.co /about/`. On any mismatch, **roll back** by deleting both routes (`curl -s -X DELETE … /workers/routes/<id>` for each) — traffic returns to GitHub Pages at once.

- [ ] **Step 4: Browser and pipeline check**

In a real browser on https://mdmc.co and https://mdmc.co.jp: home, Work, a project, About, Contact (do not submit), the language and region switches (they cross domains), and a legacy `https://mdmc.co/#/work/<docId>` link still lands on its project. Then ask the user to publish (or re-save + publish) anything in Strapi and confirm a `strapi-publish` run appears with `deploy-worker` green.

- [ ] **Step 5: Make the config match reality and commit**

In `workers/site/wrangler.jsonc`, extend `routes`:

```jsonc
  "routes": [
    { "pattern": "mdmc.co.jp/*", "zone_name": "mdmc.co.jp" },
    { "pattern": "mdmc.co/*", "zone_name": "mdmc.co" },
    { "pattern": "www.mdmc.co/*", "zone_name": "mdmc.co" }
  ],
```

In `docs/HOSTING.md`, set the mdmc.co row to `mdmc-site | <today>` and add to Rollback:

```markdown
**mdmc.co / www.mdmc.co** — delete the two routes; DNS still points at GitHub
Pages, which keeps deploying until Phase 5:

    T=$(cat ~/.cloudflare-token-mdmc-workers); Z=efaa22332cc50dd8f1dffa127e8b3f39
    curl -s -X DELETE -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/<APEX_ROUTE_ID>
    curl -s -X DELETE -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones/$Z/workers/routes/<WWW_ROUTE_ID>

(Also remove the two mdmc.co routes from workers/site/wrangler.jsonc, or the
next deploy re-creates them.)
```

(with the real ids from Step 2 written in).

```bash
git add workers/site/wrangler.jsonc docs/HOSTING.md
git commit -m "Serve mdmc.co from the mdmc-site Worker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

Watch the run, then `npm run gate -- check` once more.
Expected: all jobs green, 0 mismatches. Phase 1 is done: GitHub Pages and `mdmc-ja-proxy` are deployed but idle, kept as rollback targets until Phase 5.
