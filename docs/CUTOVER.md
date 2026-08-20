# Cutover runbook — Astro redesign → main

This is the operator's checklist for merging `redesign/astro` into `main` and
turning the new static site live at mdmc.co. Follow it top to bottom. Nothing
in here pushes or merges anything automatically — every command below is run
by hand, by whoever is doing the cutover.

---

## 1. Pre-merge checklist

Confirm all three before touching `main`:

- [ ] **User visual pass done.** Someone has clicked through the live
      `redesign/astro` preview (dev server or a deployed preview) and signed
      off on the look — hero fold, Work/News filters, About EN/JP, Careers,
      Contact, 404. This is a subjective design sign-off, not a test suite —
      no command replaces it.
- [ ] **Strapi `signature_role` edited.** The About-Japan single type's
      `signature_role` field currently holds a placeholder value ("CEO")
      pulled from the old CMS migration. The old site's own 会社概要 fact
      table uses 代表取締役 (the JP title, not the EN one) — confirm with the
      user which is correct and set it in Strapi (Content Manager → About
      Japan → signature_role) before merge. This is a content edit in Strapi,
      not a code change, and does not require a rebuild by itself (it's
      picked up on the next build, i.e. the merge-triggered deploy).
- [ ] **Content state acknowledged.** As of this write-up: 6 projects (all
      six galleries still empty, 3 with no `hero_image`), 0 articles
      (`/news/` renders its filter UI and an empty grid — the fixed
      News/Article/Case Study filter enum still applies, is by design, and
      is covered by the sweep in Task 4), 1 job. The site is built to
      degrade gracefully on all of this — nothing 404s or breaks — so this
      is a "yes, we know" checkbox, not a blocker.

---

## 2. The merge (user runs)

```bash
git checkout main
git pull
git merge --no-ff redesign/astro
git push origin main
```

Then watch the deploy:

```bash
gh run watch "$(gh run list --workflow 'Deploy to GitHub Pages' --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
```

(Bare `gh run watch` also works and prompts an interactive run picker. `Deploy to GitHub Pages` is the workflow name in `.github/workflows/deploy.yml`;
the push to `main` is what triggers it — the `on: push: branches: [main]`
trigger is live as of the `redesign/astro` merge, since that same commit is
what swaps `deploy.yml` from the old React build to the Astro build.)

---

## 3. Post-deploy verification

```bash
curl -sI https://mdmc.co/ | head -5
```

Expect `HTTP/2 200` (or `HTTP/1.1 200 OK` depending on how curl negotiates)
served via Cloudflare — look for a `cf-ray` or `server: cloudflare` header
confirming the proxy is in front, not GitHub Pages directly.

Spot-check in a real browser:
- `https://mdmc.co/work/` — Region/Specialty filters open and narrow the grid
- `https://mdmc.co/about/`
- `https://mdmc.co/contact/` — three studio clocks ticking, JP "Send us a
  message" updates the form's "To ·" label

Legacy URL check — pick one real project's old hash URL and confirm it lands
on the new static route:

```
https://mdmc.co/#/work/f2rlvrowisfks2tde5lfhw4q
```

→ should redirect (via `location.replace`, so no back-button trap) to
`https://mdmc.co/work/zenrise-website/`. (Any live project's documentId works —
pull one from Strapi's Content Manager or from the built
`redirectMap` embedded in `index.html`'s inline script if you need another.)

Confirm the Pages custom-domain setting is intact: repo → Settings → Pages →
custom domain still shows `mdmc.co`. **`https_enforced: false` / no green
padlock badge from GitHub itself is NORMAL and expected** — mdmc.co is
Cloudflare-proxied (orange-clouded), so GitHub's own Let's Encrypt cert never
provisions (GitHub's ACME challenge can't reach the real Pages origin through
the proxy). Cloudflare is terminating TLS for visitors; that's the cert that
matters. Do not wait for GitHub's toggle to flip — it never will while the
record stays proxied, and that's the correct, intended configuration.

---

## 4. Strapi rebuild webhook

**Goal:** publishing/unpublishing/updating an entry in Strapi should trigger
a GitHub Pages rebuild automatically, the same way the old site's CMS did.

**What's actually true (verified against Strapi 5 docs while writing this):**
Strapi's webhook editor (Settings → Webhooks → Create new webhook) gives you
exactly four configurable things — **Name**, **URL**, **Request headers**,
and a checklist of **trigger events** (`entry.create`, `entry.update`,
`entry.publish`, `entry.unpublish`, `entry.delete`, plus media events). There
is no field anywhere in that form to set a custom request body. Every
Strapi webhook POSTs its own fixed payload shape:

```json
{ "event": "entry.publish", "createdAt": "...", "model": "project", "entry": { "...": "..." } }
```

GitHub's `repository_dispatch` endpoint (`POST /repos/{owner}/{repo}/dispatches`)
requires a body with a **required** `event_type` field:

```json
{ "event_type": "strapi-publish" }
```

Strapi's fixed `{event, createdAt, model, entry}` body has no `event_type`
key, so a webhook pointed directly at
`https://api.github.com/repos/PerpetuaDev/mdmc-global/dispatches` will fail
every time with **HTTP 422** ("Validation failed" — GitHub's schema check
rejects the missing required field). Custom headers work fine for the
`Authorization: Bearer <PAT>` part; it's the body that's the blocker.
`workflow_dispatch` (`POST /repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches`)
has the same problem — it requires `{"ref": "main"}`, which Strapi also can't
supply.

**Conclusion: a direct Strapi → GitHub webhook cannot work. The reliable path
is a tiny relay in between.** Since mdmc.co is already Cloudflare-proxied,
a Cloudflare Worker is zero new infrastructure — just another resource on
the same account.

### 4a. Create the relay (Cloudflare Worker)

Dashboard → Workers & Pages → Create → Create Worker. Name it
`mdmc-strapi-relay`. Paste this as the entire worker script:

```js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (request.headers.get('X-Relay-Secret') !== env.RELAY_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const res = await fetch(
      'https://api.github.com/repos/PerpetuaDev/mdmc-global/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'mdmc-strapi-relay',
        },
        body: JSON.stringify({ event_type: 'strapi-publish' }),
      }
    );

    return new Response(res.ok ? 'OK' : `GitHub error ${res.status}`, {
      status: res.ok ? 200 : 502,
    });
  },
};
```

Settings → Variables and Secrets → add two **secret** bindings (not plain
vars — both are credentials):
- `GITHUB_PAT` — the fine-grained PAT (see below)
- `RELAY_SECRET` — any long random string you generate once
  (`openssl rand -hex 32`), shared only with Strapi's webhook header

Deploy. Note the Worker's URL (`https://mdmc-strapi-relay.<subdomain>.workers.dev`,
or map it to a route like `https://relay.mdmc.co/strapi-publish` if you'd
rather not expose the `workers.dev` subdomain).

### 4b. Create the PAT

GitHub → Settings (your account, not the repo) → Developer settings →
Personal access tokens → Fine-grained tokens → Generate new token.
- Repository access: only select `PerpetuaDev/mdmc-global`
- Permissions: **Contents: Read and write** (this is what
  `repository_dispatch` needs)
- Expiration: 1 year (calendar-remind to rotate)

Paste the token value into the Worker's `GITHUB_PAT` secret (4a) — nowhere
else. It never needs to touch Strapi.

### 4c. Wire up the Strapi webhook

Strapi Cloud → your project → Settings → Webhooks → Create new webhook:
- **Name:** `Rebuild site`
- **URL:** the Worker URL from 4a
- **Headers:** `X-Relay-Secret: <the RELAY_SECRET value from 4a>`
- **Trigger events:** Entry → `Publish`, `Unpublish`, `Update` (check all
  three — an unpublish should pull a project/article back off the live
  site same as a publish should add it)

Save, then use Strapi's "Trigger" test button on the new webhook — the
Worker should return `200 OK` and, within a minute or two, a new "Deploy to
GitHub Pages" run should appear in `gh run list --workflow "Deploy to GitHub Pages"`.

### 4d. Manual fallback

If the webhook chain is ever down (Worker misconfigured, PAT expired, Strapi
webhook disabled) a rebuild is one command or one click away —
`workflow_dispatch` is already wired into `deploy.yml`:

```bash
gh workflow run deploy.yml
```

or GitHub → repo → Actions → "Deploy to GitHub Pages" → "Run workflow" button.

---

## 5. Search Console

1. https://search.google.com/search-console → Add property → **Domain**
   property (not URL-prefix) → enter `mdmc.co`.
2. Google gives a DNS TXT record to verify ownership. Add it in Cloudflare:
   DNS → Records → Add record → Type `TXT`, Name `@` (or `mdmc.co`), Content
   the value Google gives you, Proxy status **DNS only** (TXT records aren't
   proxied anyway). Click Verify back in Search Console once DNS propagates
   (usually under a few minutes on Cloudflare).
3. Once verified: Sitemaps (left nav) → enter `sitemap-index.xml` → Submit.
   Full URL is `https://mdmc.co/sitemap-index.xml` (generated by
   `@astrojs/sitemap` at build time — confirmed present in `dist/` as
   `sitemap-index.xml` pointing at `sitemap-0.xml`, which lists all 14
   indexable routes; `/404/` is correctly excluded).

---

## 6. Rollback

If the merge goes out and something's badly wrong:

```bash
git revert -m 1 <merge-commit>
git push
```

`<merge-commit>` is the SHA the `git merge --no-ff` in §2 produced on `main`
(`git log --oneline -5` on `main` right after the merge to find it — it'll be
the newest commit, message like `Merge branch 'redesign/astro'`). `-m 1`
tells revert to keep parent 1 (main's pre-merge history) as the mainline,
undoing everything the redesign branch introduced in one commit.

Pushing the revert redeploys automatically the same way the original merge
did (`deploy.yml`'s `push: branches: [main]` trigger) — the old React SPA
build is back live in about the same ~1 minute the forward deploy took.

**Nothing else needs undoing.** The Strapi schema changes made across Phases
2–3 (article `kind` enum + project relation, project case-study fields,
gallery component, `signature_role`, etc.) were all additive — new optional
fields and content types layered on top of the existing schema, nothing
renamed or removed. The reverted-to old React app never reads any of those
new fields, so it's unaffected by their continued existence in Strapi. No
Strapi-side rollback is needed.

If the webhook relay (§4) was already wired up before a rollback, leave it —
it's harmless pointed at a reverted `main`; it'll just trigger a rebuild of
whatever's live, which is what you want either way.

---

## 7. Post-cutover backlog pointer

Everything not done in this rebuild — content gaps, deferred polish, flagged
decisions — is tracked at the end of each phase's plan doc, not duplicated
here (so there's exactly one place each item can go stale):

- `docs/superpowers/plans/2026-08-19-astro-redesign-phase1.md` — "Deferred to
  Phase 2" + "Content needed from user" sections
- `docs/superpowers/plans/2026-08-19-astro-redesign-phase2.md` — "Deferred to
  Phase 3+" + "Content needed from user" sections
- `docs/superpowers/plans/2026-08-20-astro-redesign-phase3.md` — "Deferred to
  Phase 4" + "Content needed from user" + "User decisions needed" sections

Highlights that'll bite first if skipped: shared Turnstile/form-lifecycle
code isn't extracted yet (careers/[slug].astro and contact/index.astro carry
two independent copies — factor before a third form exists); `og:image` /
`twitter:card` are only on detail pages, not the index pages; the JA
translation pass covers About only — Work/News/Careers/Contact are still
English-only under `/ja/`; real studio and gallery photography is still
outstanding across all six projects.
