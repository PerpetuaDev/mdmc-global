import { describe, it, expect } from 'vitest'
import { cojpUrlOf, cojpUrlsFrom, sitemapXml } from '../src/lib/cojp-sitemap.js'

describe('cojpUrlOf', () => {
  it('maps the /jp tree onto the co.jp root, since the Worker serves it there', () => {
    expect(cojpUrlOf('/jp/')).toBe('https://mdmc.co.jp/')
    expect(cojpUrlOf('/jp/work/')).toBe('https://mdmc.co.jp/work/')
    expect(cojpUrlOf('/jp/work/zenrise-website/')).toBe('https://mdmc.co.jp/work/zenrise-website/')
  })

  it('passes the /en tree through, since co.jp serves it at the same prefix', () => {
    expect(cojpUrlOf('/en/')).toBe('https://mdmc.co.jp/en/')
    expect(cojpUrlOf('/en/contact/')).toBe('https://mdmc.co.jp/en/contact/')
  })

  it('excludes mdmc.co’s own surfaces — they are covered by @astrojs/sitemap', () => {
    expect(cojpUrlOf('/')).toBeNull()
    expect(cojpUrlOf('/work/')).toBeNull()
    expect(cojpUrlOf('/ja/')).toBeNull()
    expect(cojpUrlOf('/ja/work/zenrise-website/')).toBeNull()
  })

  it('excludes 404, which is not canonical on any host', () => {
    expect(cojpUrlOf('/404.html')).toBeNull()
    expect(cojpUrlOf('/404/')).toBeNull()
  })

  it('normalises the shapes Astro actually hands the hook', () => {
    // Astro reports pathnames without a leading slash and sometimes as files.
    expect(cojpUrlOf('jp/about/')).toBe('https://mdmc.co.jp/about/')
    expect(cojpUrlOf('/jp/about/index.html')).toBe('https://mdmc.co.jp/about/')
    expect(cojpUrlOf('/jp/about')).toBe('https://mdmc.co.jp/about/')
  })

  it('never emits an mdmc.co address', () => {
    const all = ['/jp/', '/jp/news/', '/en/', '/en/news/', '/', '/ja/', '/work/']
    for (const u of cojpUrlsFrom(all)) expect(u.startsWith('https://mdmc.co.jp/')).toBe(true)
  })
})

describe('cojpUrlsFrom', () => {
  it('de-duplicates and sorts so the file only changes when the site does', () => {
    const a = cojpUrlsFrom(['/jp/work/', '/jp/', '/jp/work/', '/en/'])
    expect(a).toEqual([
      'https://mdmc.co.jp/',
      'https://mdmc.co.jp/en/',
      'https://mdmc.co.jp/work/',
    ])
    expect(cojpUrlsFrom(['/jp/', '/en/'])).toEqual(cojpUrlsFrom(['/en/', '/jp/']))
  })
})

describe('sitemapXml', () => {
  it('emits a valid single urlset', () => {
    const xml = sitemapXml(['https://mdmc.co.jp/', 'https://mdmc.co.jp/work/'])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml.match(/<loc>/g)).toHaveLength(2)
    expect(xml).toContain('<url><loc>https://mdmc.co.jp/</loc></url>')
    expect(xml.endsWith('</urlset>')).toBe(true)
  })

  it('handles an empty list without emitting broken XML', () => {
    expect(sitemapXml([])).toContain('<urlset')
    expect(sitemapXml([])).toContain('</urlset>')
    expect(sitemapXml([])).not.toContain('<loc>')
  })
})
