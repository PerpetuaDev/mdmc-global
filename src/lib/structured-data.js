// schema.org structured data (JSON-LD).
//
// The site had none at all. For a studio with three offices the useful shape
// is one Organization plus one ProfessionalService per studio, linked by
// @id — that is what lets a search engine understand "MDMC" as a single
// business that operates from Christchurch, North Sydney and Yokohama, rather
// than three unrelated pages that happen to list addresses.
//
// Everything here is derived from data already in the repo and already on the
// page: STUDIOS (addresses, emails, phone, photography) and the page's own
// title/description/canonical. Nothing is invented — in particular there is
// no sameAs, because the site links to no social profiles, and no legalName,
// because the registered entity names are not established anywhere in this
// codebase.
//
// ProfessionalService rather than LocalBusiness: it is a narrower subtype of
// LocalBusiness and accurate for a design agency, and it inherits the same
// address/telephone/openingHours vocabulary.

import { STUDIOS } from './studios.js'
import { SITES } from './i18n.js'

// Stable @id anchors. Fragment ids on the canonical host mean the same node is
// identifiable across every page that emits it, so the graph is understood as
// one organisation rather than one per URL. The organisation is anchored to
// mdmc.co in both trees on purpose: it is one company, not a company per
// domain, whatever the visitor's region.
const ORG_ID = `${SITES.co}/#organization`
const studioId = (id) => `${SITES.co}/#studio-${id}`

function postalAddress(studio) {
  const p = studio.postal
  if (!p) return undefined
  return {
    '@type': 'PostalAddress',
    streetAddress: p.streetAddress,
    addressLocality: p.addressLocality,
    ...(p.addressRegion ? { addressRegion: p.addressRegion } : {}),
    postalCode: p.postalCode,
    addressCountry: p.addressCountry,
  }
}

function studioNode(studio, origin) {
  return {
    '@type': 'ProfessionalService',
    '@id': studioId(studio.id),
    name: `MDMC ${studio.region}`,
    parentOrganization: { '@id': ORG_ID },
    address: postalAddress(studio),
    email: studio.email,
    // Only NZ has a published number; the others are null in STUDIOS and are
    // omitted rather than emitted empty.
    ...(studio.phone ? { telephone: studio.phone } : {}),
    // Studio photography is self-hosted, so it needs the origin prefixing to
    // become the absolute URL schema.org expects.
    ...(studio.image ? { image: origin + studio.image } : {}),
    areaServed: studio.region,
  }
}

// `origin` is the absolute base for this rendering (SITES.co or SITES.cojp) so
// self-hosted asset paths resolve on whichever domain is serving.
// `logo` is the 512px favicon: a real, public, square PNG of the wordmark,
// which is what Google asks a logo to be.
export function organizationGraph({ origin, description, locale }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'MDMC',
        url: SITES.co,
        logo: `${SITES.co}/icon-512.png`,
        image: `${SITES.co}/icon-512.png`,
        description,
        inLanguage: locale === 'ja' ? 'ja' : 'en',
        // Paired with each studio's parentOrganization, so the relationship is
        // stated in both directions and the graph reads as one organisation
        // operating three studios.
        subOrganization: STUDIOS.map((s) => ({ '@id': studioId(s.id) })),
      },
      ...STUDIOS.map((s) => studioNode(s, origin)),
    ],
  }
}

// Strips keys whose value is undefined so the emitted JSON carries no empty
// fields — JSON.stringify already drops undefined, but doing it explicitly
// keeps the nested objects clean and the output stable for tests.
export function jsonLd(value) {
  return JSON.stringify(value, (_k, v) => (v === undefined ? undefined : v))
}
