# Handoff: MDMC Studio Site

## Overview
Full marketing site for MDMC, a three-region creative studio (New Zealand / Australia / Japan). Ten views in a single-page design: Home, Work (filterable grid), Project detail (Gallery + Case Study views), News (filterable grid), Article, About (EN), About (JP corporate page), Careers, Job posting, and Contact — plus a shared header with supermenu panels and a shared footer with studio accordions.

## About the Design Files
The files in `design/` are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to ship. The task is to **recreate these designs in the target codebase's environment** (Next.js, Astro, etc.) using its established patterns. If no environment exists yet, choose an appropriate framework for a content-driven marketing site (static-friendly, per-page routes, i18n support for EN/JA).

The prototype is one file (`MDMC Site.dc.html`) with all pages as conditional views switched by internal state; in production these should be real routes (see Screens).

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final intent. Recreate pixel-perfectly. All imagery is placeholder (grey `rgb(217,217,217)` boxes with `assets/placeholder.svg`) — real photography to be supplied.

## Design Tokens
- **Colors**: text/ink `#000000`; page `#ffffff`; muted text `rgba(0,0,0,0.36)`; hairline rules `rgba(0,0,0,0.12)`; faint `rgba(0,0,0,0.22)`; image placeholder `rgb(217,217,217)`. Footer top rule is full-black `#000000`; all other rules are the 0.12 hairline.
- **Type families**: "Söhne" (body + display; buch 400 / kräftig 500, files in `design/assets/`), fallback `'Helvetica Neue', Helvetica, Arial, sans-serif`. Larsseit woff2s are included but unused in the final design.
- **Label style (used everywhere)**: 12px (sometimes 11px), `letter-spacing: .14em`, uppercase, muted color. This is the single "eyebrow/label" voice across filters, metadata, panel headers, form labels, footer rows.
- **Type scale**: statements `clamp(48px, 5.6vw, 88px)/1.02, -0.025em, 500`; page/article titles `clamp(40px, 4.4vw, 64px)/1.05, -0.02em, 500`; section h2 32px 500 -0.01em; card titles 24px 500 -0.005em; lead paragraphs 26px/1.45 -0.01em; body 20px/1.6; secondary 17-18px; captions 14px muted.
- **Page gutters**: `padding-left: clamp(24px, 8.6458vw, 220px); padding-right: clamp(24px, 5.94vw, 152px)` on every section.
- **Spacing rhythm**: 160px between major sections (144-176px variants), 96px between content blocks, 26px grid gutter, 48px label-column gap.
- **Label-column grid**: `grid-template-columns: 240px minmax(0, 720px); gap: 48px` — the article/About/job body pattern.
- **Arrows**: `→ ← ↓ ↗` set in Söhne 400. CTA pattern: 20px text, `padding: 6px 0`, transparent bottom border → `currentColor` on hover.
- **Motion**: page/view transitions `pageIn .5-.6s cubic-bezier(.2,.7,.2,1)` (fade + slight rise, defined as @keyframes); accordion `+` rotates 45° over .3s same easing; hover transitions .2s.

## Screens / Views
Reference screenshots in `screenshots/` (11 PNGs, numbered in this order).

1. **Home** (`01`): hero slideshow of projects (click opens project), recent work, news strip.
2. **Work** (`02`): "Work" h2, then two filter groups — **Region** and **Specialty** — as plain 20px words with a `+` that rotates 45° when open. Only one group open at a time; the open list renders beneath both triggers. Items: 18px with a 9px circle (1px border, `top: 1px` optical nudge) that fills solid black when active; inactive items muted, black on hover/active; multi-select. Region list vertical; Specialty is a 3×max-content grid, `gap: 16px 128px`. Lists sit 40px below triggers with 32px bottom padding. Grid: `{{ workCols }}` (2-col) with 26px column gap, 64px row gap; cards = image (hover: translateY(-4px)), 24px title, description ≤460px, "View project →". Filtering: (regions empty OR project.region ∈ regions) AND (specialties empty OR intersection).
3. **News** (`03`): same pattern with a single **Filters** group — News / Article / Case Study — laid out horizontally (64px gaps). Cards show `KIND ・ DATE` meta (spaces around ・) above title.
4. **About EN** (`04`): statement headline → full-width hero (1853/812) → ABOUT label-grid intro (26px lead) → four sections (WHAT WE DO / HOW WE WORK / WHO WE WORK WITH / WHAT WE DON'T DO) in the label-grid at 20px body, 96px row gaps → three-up studio strip (4/3 images, region label, address), 160px bottom padding.
5. **Contact** (`05`): stacked headline "Tell us what / you're working on." → anchor links (New Zealand ↓ / Australia ↓ / Japan ↓ / Send a message ↓) that smooth-scroll (offset −96px). A fold per studio (176px top padding): 16/10 image in a 7fr/4fr grid (image alternates sides: NZ left, AU right, JP left), info column bottom-aligned — region label + live local time (18px muted, tabular-nums, colon blinks 1s), 22px address, 20px email/phone links (hover: inset underline via box-shadow), "Send us a message →" sets the form recipient and scrolls. Form section header: SEND A MESSAGE left, `TO ・ [RECIPIENT]` right (default MDMC, or "[Region] Studio"). Form rows: ruled rows, label in 240px column, borderless 20px inputs; submit is "Send message →" text CTA.
6. **Project — Gallery** (`06`): 32px title, 22px description, specialty list (muted, `·` separators), "View project details ↓" toggle right. Image stack at 96px gaps: 16/9 hero (`data-image-id="hero"`), 4/3 two-up, 1/1 + captions, full-bleed pieces; closes with the pull-quote (clamp 28-46px, max 1100px) + "Example Client — Title, OCP Group".
7. **Project — Case Study** (`07`): same header; toggle cross-fades the content (fade out .32s → swap → pageIn; **no scroll**), view persisted in `?view=` query param. Layout: 50/50 two-column (`gap: 48px clamp(48px, 5vw, 112px)`): left = gallery-style image stack (72px gaps, captions 14px muted, first image is the same hero asset); right = continuous article, max-width 640px — small-caps section titles (OVERVIEW / CHALLENGE / APPROACH / OUTCOME), 16px below title, 112px between sections, 20px/1.6 body, no dividers, no subheadings. Full-width quote after, then "Next project" block (ruled top, wide image, title + "View project →").
8. **Article** (`08`): `NEWS ・ AUG 12, 2026` meta → clamp(40-64) title → full-width hero → body at max-width 720px, left-aligned with the hero edge: 26px lead, 20px body, ends with "See the full case study →" (routes to project Case Study view). Closing rule with "← Back to all news" left and "Share this article ↗" right. All news items open this page (Pentagram-style: links flow news → work only).
9. **Careers** (`09`): statement "Make things people love to use." → hero → CAREERS label-grid intro → OPEN POSITIONS: ruled row, grid `minmax(0,420px) 200px 160px 1fr`, vertically centered — title, STUDIO/Yokohama + TYPE/Part-time labelled pairs, arrow far right. 88px below: "Think you belong here anyway? Write to us →" (mailto). 64px bottom padding (footnote sits near footer).
10. **Job posting** (`10`): `YOKOHAMA ・ PART-TIME` meta → title → hero → ABOUT THE ROLE label-grid body → application form in ruled-row style (Name / Email / Portfolio / About you / CV & cover letter with "Choose files →" + 14px hint), "Submit application →"; header row has APPLY FOR THIS POSITION left, READ BY A HUMAN right.
11. **About JP** (`11`): shown when locale = 日本語 and page = About. Full-width hero → **ご挨拶** greeting band (clamp 32-48px title, 18px/2 body, signature: 96px circular portrait, role 13px muted, name 22px, romaji 12px letterspaced; bottom rule) → **会社概要** fact table (clamp 36-56px title, ruled rows `200px 1fr`, dt 14px muted, dd 17px/1.7) → **アクセス** (same title scale, `1.4fr 1fr` map/meta grid, meta blocks with top rules: 住所 / 最寄駅 / お問い合わせ). All JP copy is placeholder.

## Shared chrome
- **Header**: MDMC logo (`assets/mdmc.png`) left, nav (Work / News / About / Contact) with 1px underline on active/hover, locale trigger right ("[Region] EN" — region 16px + 10px letterspaced code). Hovering Work/News/About/locale opens a full-width **supermenu** below the header (white, hairline top, soft shadow, translate/fade in). Work + News panels: small-caps label + plain 20px title list (News shows 4 items, no dates/rules). Locale panel: right-aligned REGION and LANGUAGE lists, active in black, others muted.
- **Footer**: full-black top rule, 1fr/3fr grid. Left: "Have a project in mind? Let's talk. →" (32px, 500). Right: three studio accordion rows (NZ / AU / JP), hairline-ruled; closed = one-line address, `+` far right (rotates 45° open); open = 220px 4/3 studio image + address/live-time column + contact column ("Send us a message →" routes to Contact). Only one open at a time. Live times update every second, blinking colon.
- **Locale**: region switch changes header label; language ja switches About to the JP page (other pages remain EN in this prototype).

## State Management
- `page` route + `view` (gallery|story, persisted in `?view=`), `lang` (en|ja), `region`, work filters `regions[]`/`specialties[]` + open-group flags (mutually exclusive), news filter `kinds[]`, footer `studio` accordion (one of nz/au/jp/null), supermenu `mega` state, `formTo` (contact recipient), live clock tick (1s interval; times via `Intl.DateTimeFormat` with `Pacific/Auckland`, `Australia/Sydney`, `Asia/Tokyo`).

## Interactions & Behavior
- Filters: multi-select circles fill on tap; grids filter instantly; empty selection = show all.
- Project view toggle: fade out (.32s) → swap → fade in; no scrolling.
- Contact anchors + "Send us a message" CTAs: smooth scroll (avoid `scrollIntoView`; use `window.scrollTo` with rect math, −96px offset) and set the form's TO label.
- All text CTAs share the underline-on-hover treatment; footer/contact email links use inset box-shadow underline on hover.
- Never render blue browser-default links: `a { color: inherit; text-decoration: none }`.

## Assets
`design/assets/`: `mdmc.png` (logo), `placeholder.svg` (all imagery), Söhne buch/kräftig (otf + woff2). Fonts are licensed (Klim) — production must confirm licensing. All photography/maps are placeholders to be supplied.

## Files
- `design/MDMC Site.dc.html` — the full prototype (markup + logic; open in a browser to interact)
- `design/support.js` — prototype runtime (reference only, not for production)
- `design/assets/` — fonts, logo, placeholder
- `screenshots/01-…11-….png` — one per view, numbered per the Screens list
