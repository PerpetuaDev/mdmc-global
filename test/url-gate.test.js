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
