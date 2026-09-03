# Mobile & tablet re-composition (2026-09-03)

Design spec. No per-breakpoint designs exist yet — proper ones come later, and
this pass is built so those designs land as token edits rather than a CSS
rewrite.

Scope: **full re-composition** below 1024px. Mobile and tablet become their own
compositions rather than the desktop composition rescaled. Desktop (>=1024, the
`zoom: 0.85` world) must not change — that is a hard constraint, verified by
before/after capture, not by inspection.

## Why this pass exists

Audited 2026-09-03, 10 page types at 390 and 768 via headless Chrome measuring
real rendered geometry. Findings:

- **Horizontal overflow is clean** — 0px everywhere (`-15` readings are the
  reserved `scrollbar-gutter`). The 2026-08-24 responsive layer did its job.
  This pass is not a breakage fix.
- **No type or space scale.** `body { font-size: 20px }` at every width;
  `zoom: 1` below 1024. Tokens cover colour, gutters and easing only.
- **Undersized tap targets**, 22–40 per page (contact worst at 38):
  `.studio-plus` 25x30, `.filter-trigger` 87x28, footer/jump links 94x22,
  `.locale-trigger` 107x33, `.nav-link` 40–119x37.
- **Smallest text is 10px** — the header locale code (`EN`/`JA`), on every page.
  Then 11px careers meta and 12px `.label` (15 instances on contact, 13 on
  news, 12 on about).
- **The supermenu is unreachable on touch.** It opens only on `mouseenter`
  (`Header.astro:330`); only the locale trigger has a click handler. Its 4
  panels and 17 links ship to mobile as dead DOM.
- **The mobile hero crops 74% of every image.** Frame renders 319x558
  (portrait, 0.57) and is fed 2600x1200 (landscape, 2.17) via `object-fit:
  cover`, so the image scales to 1209px wide to cover and only 319 of those are
  visible. Measured `visibleFraction: 0.264`.
- **The home manifesto double-wraps.** Copy carries authored `\n` breaks sized
  for desktop; at 390 each line wraps again, orphaning "people", "honest",
  "noise."
- **Structural debt: `!important`, but NOT stray breakpoints.**
  **CORRECTED 2026-09-03 during execution.** The original audit claimed nine
  ad-hoc breakpoints (1100, 900, 880, 820, 720, 640, 560, 460, 400). That was
  wrong: the grep behind it counted `max-width` **CSS properties** — element
  measure caps like `.work-card-desc { max-width: 460px }` — not media
  queries. Those caps are legitimate and unrelated to breakpoints.
  The real inventory is **exactly two breakpoints**, already consistent:
  `max-width: 1023px` (7 uses) and `max-width: 700px` (16 uses), plus one
  `min-width: 1024px`. The 2026-08-24 grammar was followed cleanly and needs
  no consolidation. There is likewise no `max-width: 1100px` media query, so
  the "four rules straddling the desktop boundary" risk does not exist.
  The `!important` count was also understated: it is **173** occurrences, not
  ~120 (the original count was of lines, not occurrences). **154 of the 173
  sit inside `@media` blocks** — confirming the cause: the handoff was
  transcribed as **inline styles**, so every responsive override must outrank
  them.
- **Tablet has no identity.** At 768 every metric is identical to 390 — same
  body size, same zoom, same overrides. It is "mobile, wider".

Nothing in the 269-test vitest suite guards any of this: all tests are pure-JS
unit tests over `src/lib`, with no component rendering and no markup
assertions. Layout has never had a checker, which is how the above accumulated.

## Decisions taken

| Question | Decision |
|---|---|
| Scope | Full re-composition below 1024 |
| Mobile nav | Drawer / full-screen menu, carrying supermenu content |
| Tiers | Two: mobile <=700, tablet 701–1023; drawer below 1024 |
| Mobile hero | 4:3 thumbnail, uncropped, all 6 projects |
| Slide divergence | Accepted — 6 on mobile, 3 on desktop; resolves when real heroes land |
| Audit script | Committed as a permanent regression check |

## 1. Token layer

`src/styles/global.css`.

The **display tier is already fluid** — five existing heading clamps
(`clamp(48px, 5.6vw, 88px)` and four smaller). Those stay untouched. The gap is
the **text/UI tier**, which is fixed px throughout: 10, 11, 12, 13, 14, 16, 17,
18, 19, 20 (28 uses), 21, 22, 24, 26, 28.

Four text tokens replace it, plus a space scale and a tap floor:

**Ramps use `calc(intercept + Nvw)`, not a bare `Nvw`** — corrected during
execution. The first cut used proportional terms and measurement killed it:
`16vw` reaches 96px at a **600px** viewport, so every token was already at its
desktop value by 768px and the scale did nothing across the entire tablet band
— the exact problem this pass exists to fix. The intercepts are solved so each
token sits at its floor near 390px and reaches its cap at 1024px.

```css
:root {
  --label: 12px;                        /* hard floor — never 10 or 11 */
  --tap:   44px;

  /* text tier: fluid below 1024 */
  --text-s: clamp(13px, calc(12.4px + 0.16vw), 14px);
  --text:   clamp(16px, calc(13.5px + 0.63vw), 20px);
  --text-l: clamp(19px, calc(16px   + 0.79vw), 24px);

  /* space tier: the observed 8/16/24/32/48/64/96 rhythm, compressed
     on narrow viewports — 96px section gaps cost real scroll at 390 */
  --sp-1: 8px;
  --sp-2: 16px;
  --sp-3: clamp(16px, calc(11px + 1.26vw), 24px);
  --sp-4: clamp(20px, calc(14px + 1.74vw), 32px);
  --sp-5: clamp(28px, calc(22px + 2.52vw), 48px);
  --sp-6: clamp(36px, calc(30px + 3.31vw), 64px);
  --sp-7: clamp(44px, calc(41px + 5.36vw), 96px);
}
@media (min-width: 1024px) {            /* pin desktop to today's px */
  :root {
    --text-s: 14px; --text: 20px; --text-l: 24px;
    --sp-3: 24px; --sp-4: 32px; --sp-5: 48px; --sp-6: 64px; --sp-7: 96px;
  }
}
```

Fluid below 1024, pinned above. Desktop therefore cannot move: every token
resolves at >=1024 to the literal value in the file today. `--label`, `--tap`,
`--sp-1` and `--sp-2` are constants and need no pinning.

Measured resolution (2026-09-03), showing the ramp is continuous across the
1024 boundary so nothing snaps where the zoom world begins:

| width | `--text` | `--sp-5` | `--sp-7` |
|---|---|---|---|
| 390  | 16   | 31.8 | 61.9 |
| 768  | 18.3 | 41.3 | 82.2 |
| 1023 | 19.9 | 47.8 | 95.8 |
| 1024 | 20   | 48   | 96   |

**Only exact matches adopt a token.** A token pins to one desktop value, so
letting a 19px element adopt `--text` (20px at desktop) would move it by 1px at
desktop — which the hard constraint forbids. Adoption is therefore limited to
sizes that already equal a token's desktop value: 12 -> `--label`,
14 -> `--text-s`, 20 -> `--text` (28 uses, the body size), 24 -> `--text-l`.

The in-between sizes (13, 16, 17, 18, 19, 21, 22, 26, 28) keep their literal px
at all widths. Where one of them reads too large on mobile it gets its own
`clamp()` whose upper bound is its current px — again pinning desktop. This is
more verbose than a full token sweep and deliberately so: it makes "desktop
cannot move" a property of the mechanism rather than a thing to be careful
about.

## 2. Breakpoints — no change required

**Superseded 2026-09-03 during execution.** This section originally called for
consolidating nine strays onto two blocks and splitting four `max-width: 1100px`
rules. Neither exists (see the corrected finding above). The codebase already
uses exactly:

- `@media (max-width: 1023px)` — tablet and below (7 uses)
- `@media (max-width: 700px)` — mobile (16 uses)
- `@media (min-width: 1024px)` — the zoom world (1 use)

The boundary is `700px` inclusive, so tablet is 701–1023. The spec's original
`699px` was arbitrary; rewriting 16 media queries to move a boundary one pixel
is churn with no visual consequence and a real typo risk, so **700px stands**
and every later section reads `max-width: 700px`.

No work in this section. Later tasks write into the two existing blocks.

## 3. Drawer

`src/components/Header.astro`.

Below 1024 the header collapses to one row — wordmark plus hamburger. The
region label and locale code move out of the header bar and into the panel.

Panel contents: the 4 nav destinations, recent work, latest news, studios,
region picker, language switch — the same data the hover supermenu shows on
desktop, so touch users reach it for the first time.

Mechanics:

- `<dialog>`-based, for native focus trap, Escape handling and backdrop
- `inert` on background content while open
- scroll lock on `<html>`
- closes on route change (the site uses cross-document view transitions, so the
  panel must not survive a navigation)
- hamburger is a `<button>` with `aria-expanded` and an `a11y.*` label

The desktop hover panels **stop rendering below 1024** so their 17 links are
not shipped twice. Desktop hover behaviour at >=1024 is untouched.

All strings go through `t()` and the established `a11y.*` keys, in both
dictionaries, so all four trees (`/`, `/en`, `/ja`, `/jp`) are covered.

## 4. Hero

`src/views/HomeView.astro`, `src/lib/content.js`.

Below 1024:

- frame becomes **4:3**, uncropped
- the `height: calc(100svh / var(--page-zoom) - 266.7px)` fold rule is dropped.
  That 266.7px encodes desktop header metrics and is meaningless against a
  one-row header. The accompanying re-measure script is desktop-only.
- source swaps from `heroImage` (2600x1200) to the project **thumbnail** (4:3)

The swap uses a single `<picture>` with `media`, so the browser downloads **one**
image per slide rather than both.

**Slide-set divergence.** Mobile shows all 6 projects; desktop shows the 3 with
a `heroImage`, as `heroSlidesOf()` already enforces. Six slides render; the
three without a hero are hidden at >=1024.

Consequence for the cycling script: it currently counts slide elements, so it
must count **visible** slides and re-evaluate on resize. This is the most
delicate part of the pass and gets its own plan step and unit test.

The existing `heroSlidesOf()` test in `content.test.js` stays green; a new
sibling helper for the thumbnail set is added with its own tests.

## 5. Typography and composition fixes

- **Manifesto** (`HomeView`): authored `\n` breaks are stripped below 1024 so
  the copy flows as a paragraph. Presentation-only — no Strapi copy change. The
  unwrap is a pure function in `src/lib`, unit-tested.
- **Labels:** header locale code 10px -> `--label` (12px); careers meta 11px ->
  `--label`.
- **Contact:** the 2x2 jump-link cluster becomes a vertical list with 44px rows.

## 6. Tap targets

44px floor via `--tap` on `.nav-link` (37), `.locale-trigger` (33),
`.filter-trigger` (28), `.studio-plus` (25x30) and footer/jump links (22).
Achieved with padding and min-height, not by scaling type — the visual weight
of these elements should not change.

## 7. Targeted de-inlining

Inline styles become classes **only on elements this pass already touches**.
No global sweep: it would balloon the diff and risk desktop for no benefit
here. The `!important` count should fall as a side effect, not as a goal.

## 8. Verification

The audit harness is committed as `scripts/audit-responsive.mjs` with
`npm run audit:responsive`. It drives headless Chrome against a running dev
server, loads each page in a same-origin iframe at a given width, and measures
rendered geometry.

Gates, all of which must read zero:

- horizontal overflow
- text below 12px
- interactive boxes below 44px

Matrix: **10 page types** x {390, 768} x {en, ja} x {mdmc.co, mdmc.co.jp} —
`index`, `work/index`, `work/[slug]`, `news/index`, `news/[slug]`,
`about/index` (which is a different composition per language),
`careers/index`, `careers/[slug]`, `contact/index`, `404`.

It is a dev-machine tool, not a hermetic unit test — it needs Chrome and a
running server, so it stays out of the vitest suite and out of CI in this pass.

Additionally:

- **desktop protection:** capture at 1024, 1100 and 1440 before and after; any
  diff is a defect
- screenshot review at 390 and 768
- the 269 existing tests stay green; new pure-JS helpers (thumbnail slide set,
  manifesto unwrap, visible-slide count) get unit tests

## Out of scope

- Desktop (>=1024) appearance
- Strapi content: the 3 missing 2600x1200 heroes, native-JA review
- HSTS, GSC, privacy page, favicon
- Wiring the audit into CI
- A global inline-style refactor
