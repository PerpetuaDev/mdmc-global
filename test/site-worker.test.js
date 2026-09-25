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

import { handleRequest } from '../workers/site/worker.js'

// A fake ASSETS binding over an in-memory file map. It records every request
// it receives and honours If-None-Match the way the real binding does.
function fakeAssets(files) {
  const calls = []
  return {
    calls,
    async fetch(req) {
      calls.push(req)
      const path = new URL(req.url).pathname
      if (!(path in files)) return new Response('missing', { status: 404 })
      if (req.headers.get('if-none-match') === '"v1"') return new Response(null, { status: 304 })
      return new Response(req.method === 'HEAD' ? null : files[path], {
        headers: { 'content-type': path.endsWith('.html') ? 'text/html' : 'text/plain', etag: '"v1"' },
      })
    },
  }
}

const FILES = {
  '/index.html': 'global home',
  '/about/index.html': 'global about',
  '/jp/index.html': 'jp home',
  '/jp/about/index.html': 'jp about',
  '/en/about/index.html': 'cojp en about',
  '/404.html': 'not found page',
  '/robots.txt': 'global robots',
  '/favicon.svg': '<svg/>',
}

const req = (url, init) => new Request(url, init)

describe('handleRequest', () => {
  it('serves a directory URL from its index.html', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/'), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('global about')
    expect(new URL(env.ASSETS.calls[0].url).pathname).toBe('/about/index.html')
  })

  it('serves co.jp from the /jp tree and /en passthrough', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    expect(await (await handleRequest(req('https://mdmc.co.jp/'), env)).text()).toBe('jp home')
    expect(await (await handleRequest(req('https://mdmc.co.jp/about/'), env)).text()).toBe('jp about')
    expect(await (await handleRequest(req('https://mdmc.co.jp/en/about/'), env)).text()).toBe('cojp en about')
  })

  it('serves files from the dist root on both hosts', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    expect(await (await handleRequest(req('https://mdmc.co.jp/favicon.svg'), env)).text()).toBe('<svg/>')
    expect(await (await handleRequest(req('https://mdmc.co/robots.txt'), env)).text()).toBe('global robots')
  })

  it('serves co.jp its inline robots.txt', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/robots.txt'), { ASSETS: fakeAssets(FILES) })
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toBe('User-agent: *\nAllow: /\n')
  })

  it('returns the 404 page with status 404 for a missing page or file', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    for (const url of ['https://mdmc.co/nope/', 'https://mdmc.co.jp/nope/', 'https://mdmc.co/missing.png']) {
      const res = await handleRequest(req(url), env)
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('not found page')
    }
  })

  // mdmc-ja-proxy answered the hidden sitemaps with a bare text 404, not the
  // 404 page — the URL gate holds us to that.
  it('hides the single-site sitemap on co.jp with a plain-text 404', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/sitemap-index.xml'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })

  it('strips conditional headers when serving the 404 page', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/nope/', { headers: { 'if-none-match': '"v1"' } }), env)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('not found page')
  })

  it('passes a revalidation 304 through on a real page', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/', { headers: { 'if-none-match': '"v1"' } }), env)
    expect(res.status).toBe(304)
  })

  it("passes the visitor's method and headers through", async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/', { method: 'HEAD', headers: { 'accept-language': 'ja' } }), env)
    expect(res.status).toBe(200)
    expect(env.ASSETS.calls[0].method).toBe('HEAD')
    expect(env.ASSETS.calls[0].headers.get('accept-language')).toBe('ja')
  })

  it('adds the trailing slash with a 301', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/about'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mdmc.co.jp/about/')
  })

  it('keeps the query string on redirects', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const slash = await handleRequest(req('https://mdmc.co/work?utm_source=x&_gl=1*abc'), env)
    expect(slash.headers.get('location')).toBe('https://mdmc.co/work/?utm_source=x&_gl=1*abc')
    const www = await handleRequest(req('https://www.mdmc.co/about/?utm_source=x'), env)
    expect(www.status).toBe(301)
    expect(www.headers.get('location')).toBe('https://mdmc.co/about/?utm_source=x')
  })

  it('bounces /jp on co.jp', async () => {
    const res = await handleRequest(req('https://mdmc.co.jp/jp/about/'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mdmc.co.jp/about/')
  })

  it('sets the preview override cookie and strips ?site=', async () => {
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/about/?site=jp&a=1'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://mdmc-site.x.workers.dev/about/?a=1')
    expect(res.headers.get('set-cookie')).toBe('mdmc_site=jp; Path=/; SameSite=Lax')
  })

  it('serves the overridden site on preview', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/about/', { headers: { cookie: 'mdmc_site=jp' } }), env)
    expect(await res.text()).toBe('jp about')
  })

  it('ignores an invalid ?site= value without setting a cookie', async () => {
    const res = await handleRequest(req('https://mdmc-site.x.workers.dev/?site=evil'), { ASSETS: fakeAssets(FILES) })
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('does not honour ?site= on production', async () => {
    const env = { ASSETS: fakeAssets(FILES) }
    const res = await handleRequest(req('https://mdmc.co/about/?site=jp', { headers: { cookie: 'mdmc_site=jp' } }), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('global about')
  })
})

// GitHub Pages sent max-age=600 on everything; the assets binding sends
// max-age=0, which made browsers revalidate every file on every view.
describe('cache headers', () => {
  const env = () => ({ ASSETS: fakeAssets({ ...FILES, '/_astro/index.abc.css': 'css', '/fonts/a.woff2': 'font' }) })

  it('marks hashed /_astro files immutable for a year', async () => {
    const res = await handleRequest(req('https://mdmc.co/_astro/index.abc.css'), env())
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  it('gives pages and unhashed files the 10 minutes GitHub Pages gave them', async () => {
    for (const url of ['https://mdmc.co/about/', 'https://mdmc.co.jp/about/', 'https://mdmc.co/fonts/a.woff2']) {
      const res = await handleRequest(req(url), env())
      expect(res.headers.get('cache-control')).toBe('public, max-age=600')
    }
  })

  it('refreshes freshness on a revalidation 304', async () => {
    const res = await handleRequest(req('https://mdmc.co/about/', { headers: { 'if-none-match': '"v1"' } }), env())
    expect(res.status).toBe(304)
    expect(res.headers.get('cache-control')).toBe('public, max-age=600')
  })

  it('keeps the ETag', async () => {
    const res = await handleRequest(req('https://mdmc.co/about/'), env())
    expect(res.headers.get('etag')).toBe('"v1"')
  })
})
