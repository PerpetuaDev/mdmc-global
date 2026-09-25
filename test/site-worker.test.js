import { describe, it, expect } from 'vitest'
import { HOSTS, isPreviewHost, resolveSite, mapPath } from '../workers/site/worker.js'

describe('resolveSite', () => {
  it('maps the production hosts', () => {
    expect(HOSTS).toEqual({ 'mdmc.co': 'global', 'mdmc.co.jp': 'jp' })
    expect(resolveSite('mdmc.co', null)).toBe('global')
    expect(resolveSite('mdmc.co.jp', null)).toBe('jp')
  })

  it('serves global to an unknown host', () => {
    expect(resolveSite('example.com', null)).toBe('global')
  })

  it('recognises preview hosts', () => {
    expect(isPreviewHost('mdmc-site.perpetua-software.workers.dev')).toBe(true)
    expect(isPreviewHost('localhost')).toBe(true)
    expect(isPreviewHost('127.0.0.1')).toBe(true)
    expect(isPreviewHost('mdmc.co')).toBe(false)
    expect(isPreviewHost('workers.dev.example.com')).toBe(false)
  })

  it('reads the override cookie on preview hosts only', () => {
    expect(resolveSite('mdmc-site.x.workers.dev', 'mdmc_site=jp')).toBe('jp')
    expect(resolveSite('localhost', 'a=1; mdmc_site=jp; b=2')).toBe('jp')
    expect(resolveSite('localhost', null)).toBe('global')
    expect(resolveSite('localhost', 'mdmc_site=bogus')).toBe('global')
  })

  it('ignores the override on production hosts', () => {
    expect(resolveSite('mdmc.co', 'mdmc_site=jp')).toBe('global')
    expect(resolveSite('mdmc.co.jp', 'mdmc_site=global')).toBe('jp')
  })
})

describe('mapPath — global (today\'s mdmc.co, identity mapping)', () => {
  it('serves directory URLs from the same path', () => {
    expect(mapPath('global', '/')).toEqual({ kind: 'html', to: '/' })
    expect(mapPath('global', '/about/')).toEqual({ kind: 'html', to: '/about/' })
    expect(mapPath('global', '/ja/work/youki/')).toEqual({ kind: 'html', to: '/ja/work/youki/' })
    // GitHub Pages serves the co.jp trees publicly on mdmc.co today; keep that.
    expect(mapPath('global', '/jp/about/')).toEqual({ kind: 'html', to: '/jp/about/' })
    expect(mapPath('global', '/en/about/')).toEqual({ kind: 'html', to: '/en/about/' })
  })

  it('passes files through, robots and sitemaps included', () => {
    expect(mapPath('global', '/robots.txt')).toEqual({ kind: 'asset', to: '/robots.txt' })
    expect(mapPath('global', '/sitemap-index.xml')).toEqual({ kind: 'asset', to: '/sitemap-index.xml' })
    expect(mapPath('global', '/_astro/index.abc.css')).toEqual({ kind: 'asset', to: '/_astro/index.abc.css' })
  })

  it('adds the trailing slash', () => {
    expect(mapPath('global', '/about')).toEqual({ kind: 'redirect', to: '/about/' })
  })
})

describe('mapPath — jp (port of mdmc-ja-proxy)', () => {
  it('maps HTML routes onto the /jp tree', () => {
    expect(mapPath('jp', '/')).toEqual({ kind: 'html', to: '/jp/' })
    expect(mapPath('jp', '/work/youki/')).toEqual({ kind: 'html', to: '/jp/work/youki/' })
  })

  it('passes /en through unchanged', () => {
    expect(mapPath('jp', '/en/')).toEqual({ kind: 'html', to: '/en/' })
    expect(mapPath('jp', '/en/about/')).toEqual({ kind: 'html', to: '/en/about/' })
  })

  it('serves files from the dist root', () => {
    for (const path of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/icon-192.png',
      '/icon-512.png', '/site.webmanifest', '/_astro/x.css', '/fonts/a.woff2', '/sitemap-cojp.xml']) {
      expect(mapPath('jp', path)).toEqual({ kind: 'asset', to: path })
    }
  })

  it('bounces stray /ja and /jp prefixes to the bare path', () => {
    expect(mapPath('jp', '/ja/work/')).toEqual({ kind: 'redirect', to: '/work/' })
    expect(mapPath('jp', '/ja')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('jp', '/jp/')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('jp', '/jp/about/')).toEqual({ kind: 'redirect', to: '/about/' })
  })

  it('serves robots inline and hides the single-site sitemap', () => {
    expect(mapPath('jp', '/robots.txt')).toEqual({ kind: 'robots' })
    expect(mapPath('jp', '/sitemap-index.xml')).toEqual({ kind: 'none' })
    expect(mapPath('jp', '/sitemap-0.xml')).toEqual({ kind: 'none' })
  })

  it('adds the trailing slash', () => {
    expect(mapPath('jp', '/work')).toEqual({ kind: 'redirect', to: '/work/' })
  })
})

describe('mapPath — edge paths', () => {
  it('maps percent-encoded paths as HTML', () => {
    expect(mapPath('global', '/work/%E3%83%86/')).toEqual({ kind: 'html', to: '/work/%E3%83%86/' })
    expect(mapPath('jp', '/work/%E3%83%86/')).toEqual({ kind: 'html', to: '/jp/work/%E3%83%86/' })
  })

  it('treats a dot in a directory segment as HTML when the URL ends in a slash', () => {
    expect(mapPath('global', '/work/v1.2/')).toEqual({ kind: 'html', to: '/work/v1.2/' })
  })
})
