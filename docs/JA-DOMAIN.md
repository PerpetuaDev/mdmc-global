# JA-domain activation runbook — mdmc.co.jp

This is the operator's checklist for taking mdmc.co.jp live once the domain is
purchased and configured. Every step below is concrete — follow it top to bottom
with no research needed. Nothing here pushes or deploys automatically.

---

## 1. DNS/zone setup

1. **Create Cloudflare zone for mdmc.co.jp:**
   - Dashboard → Websites → Add site → enter `mdmc.co.jp`
   - Cloudflare will inspect and propose nameservers
   - Update your domain registrar's nameserver settings to use Cloudflare's
   - Wait for nameserver propagation (~5–60 minutes, confirm with `dig +short NS mdmc.co.jp`)

2. **Add DNS records:**
   - DNS → Records → Add record
   - **Type:** `CNAME`
   - **Name:** `@` (apex)
   - **Content:** `perpetuadev.github.io` (this is the GitHub Pages IP/hostname for user/org sites)
   - **Proxy status:** Proxied (orange cloud)
   - Save

   (Repeat if you want `www.mdmc.co.jp` too, but it's optional for this runbook.)

3. **SSL/TLS:**
   - Dashboard → SSL/TLS → Overview
   - Confirm **Encryption mode** is `Full (strict)`. This tells Cloudflare to expect a
     valid HTTPS cert from the origin (GitHub Pages provides one automatically).
   - **HSTS:** Optional; if you want to enforce HTTPS site-wide, Dashboard →
     SSL/TLS → Edge Certificates → HSTS, enable and set `Max Age` to something
     like 6 months.

---

## 2. The Worker

The Worker on the mdmc.co.jp zone routes all traffic, mapping EN-shaped
paths (`/work/`, `/`) to JA paths (`/ja/work/`, `/ja/`), and fetching from
the GitHub Pages origin. It serves a co.jp-specific `/robots.txt` and passes
through status/headers from the origin without caching HTML.

### Worker code

Create the Worker on the mdmc.co.jp zone (or map an existing Worker):

**Dashboard → Workers & Pages → Create → Create Worker** (or edit an existing one).
Name it something like `mdmc-co-jp-relay`. Paste this entire script:

```javascript
/**
 * mdmc.co.jp Worker
 * Maps EN paths to JA, fetches from Pages origin, avoids redirect loops.
 */

const PAGES_ORIGIN = 'https://perpetuadev.github.io';
const EN_ORIGIN = 'https://mdmc.co';

// Paths with file extensions (assets, static files) pass through verbatim.
// Everything else gets '/ja' prefixed (unless it's already a special case).
function getOriginUrl(pathname) {
  // Special cases: no JA prefix.
  if (pathname === '/robots.txt') return PAGES_ORIGIN + '/ja/robots.txt';
  if (pathname === '/sitemap-index.xml') return PAGES_ORIGIN + '/ja/sitemap-index.xml';
  if (pathname === '/sitemap-0.xml') return PAGES_ORIGIN + '/ja/sitemap-0.xml';

  // Paths with file extensions (assets, fonts, etc.) — pass through.
  // This regex matches files with any extension.
  if (/\.[a-zA-Z0-9]{1,}$/.test(pathname)) {
    return PAGES_ORIGIN + pathname;
  }

  // HTML routes: prefix with '/ja' and fetch the EN route from Pages.
  // '/' → '/ja/', '/work/' → '/ja/work/', etc.
  const jaPath = pathname === '/' ? '/ja/' : `/ja${pathname}`;
  return PAGES_ORIGIN + jaPath;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originUrl = getOriginUrl(url.pathname);

    // Add a marker header so the 301 redirect rule can exclude this traffic.
    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      cf: request.cf,
    });
    originRequest.headers.set('X-MDMC-Worker: 1');

    const response = await fetch(originRequest);

    // Pass through the origin's status and most headers.
    // Do NOT cache HTML (respect origin's Cache-Control).
    const headers = new Headers(response.headers);

    // Always set a no-cache header for HTML to avoid stale content.
    if (response.headers.get('content-type')?.includes('text/html')) {
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
```

### Deploy the Worker

1. **Dashboard → Workers & Pages → [your-worker-name] → Settings → Triggers → Routes**
2. **Add route:**
   - **Route:** `mdmc.co.jp/*`
   - **Zone:** mdmc.co.jp
3. Click Save. The Worker is now live.

### Dry-run: path-mapping test (run in Node.js)

Paste this snippet into a Node.js REPL or `.js` file to verify the path
logic before going live:

```javascript
function getOriginUrl(pathname) {
  if (pathname === '/robots.txt') return 'https://perpetuadev.github.io/ja/robots.txt';
  if (pathname === '/sitemap-index.xml') return 'https://perpetuadev.github.io/ja/sitemap-index.xml';
  if (pathname === '/sitemap-0.xml') return 'https://perpetuadev.github.io/ja/sitemap-0.xml';
  if (/\.[a-zA-Z0-9]{1,}$/.test(pathname)) {
    return 'https://perpetuadev.github.io' + pathname;
  }
  const jaPath = pathname === '/' ? '/ja/' : `/ja${pathname}`;
  return 'https://perpetuadev.github.io' + jaPath;
}

// Test cases
const tests = [
  ['/', 'https://perpetuadev.github.io/ja/'],
  ['/work/', 'https://perpetuadev.github.io/ja/work/'],
  ['/work/project-slug/', 'https://perpetuadev.github.io/ja/work/project-slug/'],
  ['/about/', 'https://perpetuadev.github.io/ja/about/'],
  ['/contact/', 'https://perpetuadev.github.io/ja/contact/'],
  ['/_astro/app-hash.css', 'https://perpetuadev.github.io/_astro/app-hash.css'],
  ['/_astro/app-hash.js', 'https://perpetuadev.github.io/_astro/app-hash.js'],
  ['/fonts/family-400.woff2', 'https://perpetuadev.github.io/fonts/family-400.woff2'],
  ['/favicon.svg', 'https://perpetuadev.github.io/favicon.svg'],
  ['/robots.txt', 'https://perpetuadev.github.io/ja/robots.txt'],
  ['/sitemap-index.xml', 'https://perpetuadev.github.io/ja/sitemap-index.xml'],
];

console.log('Path-mapping test results:');
tests.forEach(([path, expected]) => {
  const actual = getOriginUrl(path);
  const pass = actual === expected ? '✓' : '✗';
  console.log(`${pass} ${path.padEnd(35)} → ${actual}`);
  if (actual !== expected) console.log(`  expected: ${expected}`);
});
```

Expected output:
```
Path-mapping test results:
✓ /                                   → https://perpetuadev.github.io/ja/
✓ /work/                              → https://perpetuadev.github.io/ja/work/
✓ /work/project-slug/                 → https://perpetuadev.github.io/ja/work/project-slug/
✓ /about/                             → https://perpetuadev.github.io/ja/about/
✓ /contact/                           → https://perpetuadev.github.io/ja/contact/
✓ /_astro/app-hash.css                → https://perpetuadev.github.io/_astro/app-hash.css
✓ /_astro/app-hash.js                 → https://perpetuadev.github.io/_astro/app-hash.js
✓ /fonts/family-400.woff2             → https://perpetuadev.github.io/fonts/family-400.woff2
✓ /favicon.svg                        → https://perpetuadev.github.io/favicon.svg
✓ /robots.txt                         → https://perpetuadev.github.io/ja/robots.txt
✓ /sitemap-index.xml                  → https://perpetuadev.github.io/ja/sitemap-index.xml
```

---

## 3. robots.txt and sitemap on co.jp

### The inline robots.txt

The Worker above serves a co.jp-specific `/robots.txt` from the Astro build's
`/ja/robots.txt` (which will exist once the flag flip below is live). For now,
it passes through from the origin.

**After the flag flip** (§4 below), verify that the Astro sitemap build
included the new domain. As noted in the task brief:

- `@astrojs/sitemap` is single-site; the v1 approach is to keep the
  primary sitemap (`sitemap-index.xml`, `sitemap-0.xml`) on **mdmc.co** only,
  with EN-only URLs and a note in Google Search Console that the JA content
  is on a separate property.
- Add **mdmc.co.jp** as a new domain property in GSC without uploading a
  sitemap; GSC's automatic crawl will find the content.
- A per-domain sitemap for co.jp is a follow-up task once content expands.

### Verification checklist

Once the Worker is live:

```bash
# Check that robots.txt exists and mentions co.jp domain
curl -sI https://mdmc.co.jp/robots.txt | head -3
curl -s https://mdmc.co.jp/robots.txt

# Check sitemap routing
curl -sI https://mdmc.co.jp/sitemap-index.xml | head -3
```

You should see `HTTP/2 200` (or `HTTP/1.1 200`) and the robot rules.

---

## 4. The flag flip

Once the Worker is passing traffic correctly, set the JA origin in `src/lib/i18n.js`:

1. **Open** `src/lib/i18n.js`
2. **Change line 231** from:
   ```javascript
   export const ORIGINS = { en: 'https://mdmc.co', ja: null }
   ```
   to:
   ```javascript
   export const ORIGINS = { en: 'https://mdmc.co', ja: 'https://mdmc.co.jp' }
   ```
3. **Run live-mode tests** (these are already in the test suite and specifically
   cover the `linkHref()` behavior when `origins.ja` is set):
   ```bash
   npm test -- --run
   ```
4. **Commit the change** (§7 below).
5. **Merge/deploy** to `main` (the GitHub Pages deploy workflow picks it up).

This single-line change enables:
- `linkHref('en', 'ja', '/work/')` → `'https://mdmc.co.jp/work/'` (not
  `/ja/work/` on mdmc.co)
- `linkHref('ja', 'en', '/work/')` → `'https://mdmc.co/work/'` (escape to EN)
- Language toggle links in the UI now point to the JA domain for JA, EN domain
  for EN.

---

## 5. 301 consolidation: mdmc.co/ja/* → mdmc.co.jp

### The problem

Once mdmc.co.jp is live and the Worker is serving traffic, you want to 301
redirect all old JA traffic from `mdmc.co/ja/*` to `https://mdmc.co.jp/*`
so that:
- Users bookmarking `/ja/` paths are sent to the JA domain
- Search engines update their index
- The UI's language toggle links point to the clean domain

**But:** the Worker fetches content from the Pages origin by requesting
`https://perpetuadev.github.io/ja/...`. If you set a blanket 301 rule on
`mdmc.co/ja/*`, Cloudflare will intercept the Worker's origin requests
too, sending them to co.jp — and the Worker would then fetch from co.jp,
which has no `/ja/` path (it IS the JA site) — creating a loop.

### The solution: header-scoped redirect rule

**Cloudflare redirect rules support header conditions.** The Worker adds
a header (`X-MDMC-Worker: 1`) to its origin requests. The redirect rule
matches only requests **WITHOUT** that header:

**Dashboard → Websites (mdmc.co zone) → Rules → Redirect Rules → Create rule**

- **Name:** `Redirect /ja to co.jp`
- **When incoming requests match:**
  - **Condition 1:** Path → Path contains → `/ja`
  - **Operator:** AND
  - **Condition 2:** Header → Header → `X-MDMC-Worker` → does not contain → `1`
- **Then:** Redirect to → `https://mdmc.co.jp/$1` with status code **301**

**Expression syntax** (if you prefer to edit the expression directly):

```
(http.request.uri.path contains "/ja") and (http.request.headers["X-MDMC-Worker"] != "1")
```

This ensures:
- Visitor requests to `mdmc.co/ja/*` are redirected to `mdmc.co.jp/*`
- The Worker's internal origin-fetch to `https://perpetuadev.github.io/ja/...`
  passes through Cloudflare's proxy without hitting the redirect (because the
  Worker added the header before Cloudflare forwarded the request)

---

## 6. Verification

### cURL checks

After the 301 rule is live:

```bash
# HTML route: should serve JA content
curl -sI https://mdmc.co.jp/ | head -1
# Expected: HTTP/2 200

# Old JA URL on mdmc.co: should 301 to co.jp
curl -sIL https://mdmc.co/ja/ | head -5
# Expected: first response HTTP/2 301, Location: https://mdmc.co.jp/
# Second response (after redirect): HTTP/2 200

# Assets: should be served from co.jp with correct content-type
curl -sI https://mdmc.co.jp/_astro/app-hash.css | head -3
# Expected: HTTP/2 200, content-type: text/css

# robots.txt: should exist and mention co.jp
curl -s https://mdmc.co.jp/robots.txt | head -3
# Expected: User-agent lines and Sitemap pointing to co.jp

# Check hreflang pairs (inspect HTML)
curl -s https://mdmc.co.jp/ | grep -i hreflang
# Expected: <link rel="alternate" hreflang="en" href="https://mdmc.co/" />
#           <link rel="alternate" hreflang="ja" href="https://mdmc.co.jp/" />
```

### Google Search Console

1. **Add mdmc.co.jp as a new property:**
   - https://search.google.com/search-console → Add property → Domain property → `mdmc.co.jp`
   - Verify ownership via DNS TXT record (same process as §5 in CUTOVER.md)

2. **Indexing:**
   - Search Console → Indexing → Index coverage
   - Request indexing of a few key pages (`/`, `/work/`, `/about/`)
   - Monitor for crawl errors — the Worker's status should propagate
     correctly, but confirm

3. **Sitemap:**
   - For now, do NOT upload a sitemap to the co.jp property
   - GSC will crawl the site automatically
   - Once a dedicated co.jp sitemap is built (future task), submit it here

---

## 7. Rollback

If something goes wrong with the co.jp setup, rollback is fast:

1. **Disable the Worker route:**
   - Dashboard → Workers & Pages → [mdmc-co-jp-relay] → Settings → Triggers → Routes
   - Delete or disable the `mdmc.co.jp/*` route

2. **Revert the flag commit:**
   - `git revert <sha-of-flag-flip-commit>`
   - `git push`
   - The GitHub Pages deploy will rebuild with `ja: null` (no separate JA domain)

3. **Remove the 301 rule (optional):**
   - If you rolled back the flag and disabled the Worker, you can also remove
     the redirect rule to avoid confusing traffic
   - Dashboard → Rules → Redirect Rules → delete the `/ja → co.jp` rule

**Result:** mdmc.co/ja/* is no longer proxied, traffic to the old URLs hits
the Pages origin directly, the redesign is still live with English-only content.

---

## Appendix: Why not fetch from github.io directly?

The Worker code above fetches from `https://perpetuadev.github.io/ja/...`
instead of `https://mdmc.co/ja/...`. This is intentional:

- **GitHub Pages custom domain behavior:** When you set a custom domain
  (CNAME) for a GitHub Pages site, requests to the naked `github.io` URL
  are redirected to the custom domain. So `perpetuadev.github.io/ja/...`
  would redirect to `mdmc.co/ja/...`.
- **Why that's a problem:** If the Worker fetches `perpetuadev.github.io/ja/...`
  and it redirects to `mdmc.co/ja/...`, the Worker would then hit the
  co.jp redirect rule (§5), creating a loop.
- **Why the header-scoped rule works:** By adding `X-MDMC-Worker: 1` to
  the origin request, the Worker signals to Cloudflare's redirect rule:
  "this is internal infrastructure, don't redirect me." The rule excludes
  requests with that header, so the Worker's fetch succeeds.

---

## Checklist for go-live

- [ ] Cloudflare zone created for mdmc.co.jp
- [ ] CNAME record points to perpetuadev.github.io
- [ ] SSL/TLS mode set to Full (strict)
- [ ] Worker deployed and route `mdmc.co.jp/*` is live
- [ ] Dry-run test shows all paths mapping correctly
- [ ] ORIGINS.ja flag flipped in src/lib/i18n.js
- [ ] Tests pass
- [ ] Flag-flip commit merged to main
- [ ] 301 rule deployed with header condition (no redirects to Worker)
- [ ] cURL and browser verification passes
- [ ] GSC property created for mdmc.co.jp
- [ ] Team notified; monitoring set up

---
