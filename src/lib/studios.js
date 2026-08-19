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
// - JP: address (English) from pages.jsx contact-block; email contact@mdmc.co
//   from the old footer (note: jp.about.location.contact.v uses team@mdmc.co
//   for the Yokohama office page — the *footer* specifically used
//   contact@mdmc.co, which is what we mirror here). No JP phone number
//   exists anywhere on the old site.
//
// image: null for all three — studio photography doesn't exist yet. Footer
// renders a var(--ph) placeholder box at the prototype's 220px/4:3 dimensions
// until real photos arrive (content needed from user).
export const STUDIOS = [
  {
    id: 'nz',
    region: 'New Zealand',
    tz: 'Pacific/Auckland',
    addressLines: ['Level 2, 47 Salisbury St', 'Christchurch Central', 'Christchurch 8013'],
    email: 'nz@mdmc.co',
    phone: '+64 3 660 0336',
    image: null,
  },
  {
    id: 'au',
    region: 'Australia',
    tz: 'Australia/Sydney',
    addressLines: ['100 Arthur Street, Level 10', 'North Sydney NSW 2060'],
    email: 'au@mdmc.co',
    phone: null,
    image: null,
  },
  {
    id: 'jp',
    region: 'Japan',
    tz: 'Asia/Tokyo',
    addressLines: [
      '5-57-2 Kitanakadori, Naka Ward',
      'Yokohama, Kanagawa 231-0003',
      'KITANAKA BRICK & WHITE BRICK south, 3F',
    ],
    email: 'contact@mdmc.co',
    phone: null,
    image: null,
  },
]
