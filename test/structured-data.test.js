import { describe, it, expect } from 'vitest'
import { organizationGraph, jsonLd } from '../src/lib/structured-data.js'
import { STUDIOS } from '../src/lib/studios.js'

const graph = (over = {}) =>
  organizationGraph({ origin: 'https://mdmc.co', description: 'd', locale: 'en', ...over })

const nodes = (g) => g['@graph']
const org = (g) => nodes(g).find((n) => n['@type'] === 'Organization')
const studios = (g) => nodes(g).filter((n) => n['@type'] === 'ProfessionalService')

describe('organizationGraph', () => {
  it('emits one Organization and one node per studio', () => {
    const g = graph()
    expect(nodes(g)).toHaveLength(1 + STUDIOS.length)
    expect(studios(g)).toHaveLength(3)
    expect(g['@context']).toBe('https://schema.org')
  })

  it('links organisation and studios in both directions by @id', () => {
    const g = graph()
    const id = org(g)['@id']
    // Every studio points up...
    for (const s of studios(g)) expect(s.parentOrganization['@id']).toBe(id)
    // ...and the organisation points down to exactly those nodes.
    expect(org(g).subOrganization.map((r) => r['@id']).sort())
      .toEqual(studios(g).map((s) => s['@id']).sort())
  })

  it('anchors @ids to mdmc.co on BOTH domains — one company, not one per domain', () => {
    const co = graph({ origin: 'https://mdmc.co' })
    const jp = graph({ origin: 'https://mdmc.co.jp' })
    expect(org(jp)['@id']).toBe(org(co)['@id'])
    expect(org(jp)['@id']).toContain('mdmc.co/#')
    expect(studios(jp).map((s) => s['@id'])).toEqual(studios(co).map((s) => s['@id']))
  })

  it('makes self-hosted studio images absolute against the serving origin', () => {
    for (const s of studios(graph({ origin: 'https://mdmc.co.jp' }))) {
      expect(s.image.startsWith('https://mdmc.co.jp/images/studios/')).toBe(true)
    }
  })

  it('carries each studio’s real address, broken into PostalAddress fields', () => {
    const byName = Object.fromEntries(studios(graph()).map((s) => [s.name, s]))
    expect(byName['MDMC New Zealand'].address).toMatchObject({
      '@type': 'PostalAddress', addressLocality: 'Christchurch', postalCode: '8013', addressCountry: 'NZ',
    })
    expect(byName['MDMC Australia'].address).toMatchObject({
      addressLocality: 'North Sydney', addressRegion: 'NSW', addressCountry: 'AU',
    })
    expect(byName['MDMC Japan'].address).toMatchObject({
      addressLocality: 'Yokohama', addressRegion: 'Kanagawa', postalCode: '231-0003', addressCountry: 'JP',
    })
  })

  it('omits telephone where no number exists rather than emitting an empty one', () => {
    const byName = Object.fromEntries(studios(graph()).map((s) => [s.name, s]))
    expect(byName['MDMC New Zealand'].telephone).toBe('+64 3 660 0336')
    expect('telephone' in byName['MDMC Australia']).toBe(false)
    expect('telephone' in byName['MDMC Japan']).toBe(false)
  })

  it('omits addressRegion where the transcribed address states none', () => {
    const nz = studios(graph()).find((s) => s.name === 'MDMC New Zealand')
    expect('addressRegion' in nz.address).toBe(false)
  })

  it('claims nothing the site cannot back up', () => {
    const g = graph()
    // No social profiles exist on the site, and no registered entity name is
    // established in this codebase — so neither may be asserted here.
    expect('sameAs' in org(g)).toBe(false)
    expect('legalName' in org(g)).toBe(false)
  })

  it('reports the rendering language', () => {
    expect(org(graph({ locale: 'ja' })).inLanguage).toBe('ja')
    expect(org(graph({ locale: 'en' })).inLanguage).toBe('en')
  })

  it('every studio in STUDIOS has the postal data the graph needs', () => {
    for (const s of STUDIOS) {
      expect(s.postal, `${s.id} is missing its postal block`).toBeTruthy()
      expect(s.postal.addressCountry).toMatch(/^[A-Z]{2}$/)
    }
  })
})

describe('jsonLd', () => {
  it('serialises without undefined leaking into the output', () => {
    const s = jsonLd(graph())
    expect(s).not.toContain('undefined')
    expect(() => JSON.parse(s)).not.toThrow()
  })

  it('produces no </script> sequence that could break out of the tag', () => {
    // Guards the one real injection risk of inlining JSON-LD.
    expect(jsonLd(graph())).not.toContain('</script')
  })
})
