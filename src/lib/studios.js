// Studio directory for the footer accordions (and, per Phase 3, the Contact
// page). Address/email/phone are transcribed verbatim from the old site's
// footer (git show main:src/chrome.jsx, the `fv2`/Footer component) and
// cross-checked against the contact page (main:src/pages.jsx) and i18n
// strings (main:src/i18n.jsx, jp.about.location.*).
//
// Real data, not invented:
// - NZ: address + phone from pages.jsx contact-block; email nz@mdmc.co from
//   the old footer's studios array.
// - AU: address from pages.jsx + old footer; email au@mdmc.co from the old
//   footer. No AU phone number exists anywhere on the old site.
// - JP: address (English) from pages.jsx contact-block. Email is
//   contact@mdmc.co.jp as of 2026-09-02 — a real Workspace group ("MDMC
//   Japan", aliases jp@mdmc.co and the legacy tyo@mdmc.co) on the Japan
//   domain, replacing the transcribed-from-the-old-footer contact@mdmc.co.
//   The old site had no JP-domain address to point at; it does now, and the
//   JP studio should show it on both domains. The About page's own
//   お問い合わせ line (about-jp-data.js) moved to the same address, so the
//   two no longer deliberately differ. No JP phone number exists anywhere.
//
// image: self-hosted studio photography (public/images/studios/, 1600w webp,
// wired 2026-08-20): nz = the Christchurch office interior (the old About
// page's mdmc-about-us.jpg, user-confirmed as the real office), au = the
// North Sydney office (user-supplied sydney-office.webp), jp = the Nisankai
// Yokohama office (same photo the careers hero uses from Strapi). Self-hosted
// rather than Strapi-media URLs so the pending media-library purge can't
// break the site chrome. Images are decorative (alt="") — the address text
// beside them carries the information.
//
// closedLine: the footer's closed-accordion one-liner. The prototype
// deliberately shortens these (drops the middle address line for NZ, drops
// ", Kanagawa" and the building line for JP) rather than just joining
// addressLines — transcribed literally from the toggleNz/toggleAu/toggleJp
// closed-state buttons in design/handoff/design/MDMC Site.dc.html (lines
// 715, 735, 755). addressLines remains the full, separate value used in the
// open panel.
// Region-aware ordering (2026-08-21 matrix model): the DOMAIN leads with its
// local studio — mdmc.co.jp shows Japan first, mdmc.co shows the canonical
// NZ/AU/JP order — regardless of the page's language. Used by the footer,
// the Contact page, and any other studio directory surface.
export function studiosForSite(site) {
  if (site !== 'cojp') return STUDIOS
  return [...STUDIOS].sort((a, b) => (a.id === 'jp' ? -1 : 0) - (b.id === 'jp' ? -1 : 0))
}

export const STUDIOS = [
  {
    id: 'nz',
    region: 'New Zealand',
    tz: 'Pacific/Auckland',
    closedLine: 'Level 2, 47 Salisbury St, Christchurch 8013',
    addressLines: ['Level 2, 47 Salisbury St', 'Christchurch Central', 'Christchurch 8013'],
    email: 'nz@mdmc.co',
    phone: '+64 3 660 0336',
    image: '/images/studios/nz.webp',
  },
  {
    id: 'au',
    region: 'Australia',
    tz: 'Australia/Sydney',
    closedLine: '100 Arthur Street, Level 10, North Sydney NSW 2060',
    addressLines: ['100 Arthur Street, Level 10', 'North Sydney NSW 2060'],
    email: 'au@mdmc.co',
    phone: null,
    image: '/images/studios/au.webp',
  },
  {
    id: 'jp',
    region: 'Japan',
    tz: 'Asia/Tokyo',
    closedLine: '5-57-2 Kitanakadori, Naka-ku, Yokohama 231-0003',
    // Canonical EN address confirmed by the user 2026-08-20 (Nisankai is the
    // venue name, unit J-2 — supersedes the old site's "3F" wording).
    addressLines: [
      'Nisankai J-2,',
      'Brick South KITANAKA BRICK & WHITE',
      '5-57-2 Kitanakadori, Naka-ku',
      'Yokohama, Kanagawa 231-0003, Japan',
    ],
    email: 'contact@mdmc.co.jp',
    phone: null,
    image: '/images/studios/jp.webp',
    // Japanese-format address (user-confirmed 2026-08-20, same source as
    // the JA About page). Only the JP studio has one — NZ/AU postal
    // addresses stay in Latin script on every locale, standard practice
    // for foreign addresses (and what the old site did).
    closedLineJa: '〒231-0003 神奈川県横浜市中区北仲通5-57-2',
    addressLinesJa: [
      '〒231-0003 神奈川県横浜市中区北仲通5-57-2',
      'KITANAKA BRICK & WHITE Brick South',
      'ニサンカイ J-2',
    ],
  },
]
