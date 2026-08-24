import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mapPath, handleRequest } from '../workers/ja-proxy/worker.js'

describe('ja-proxy mapPath', () => {
  it('maps HTML routes onto the ja tree', () => {
    expect(mapPath('/')).toEqual({ kind: 'html', to: '/jp/' })
    expect(mapPath('/work/')).toEqual({ kind: 'html', to: '/jp/work/' })
    expect(mapPath('/work/youki/')).toEqual({ kind: 'html', to: '/jp/work/youki/' })
    expect(mapPath('/about/')).toEqual({ kind: 'html', to: '/jp/about/' })
  })

  it('fetches assets verbatim', () => {
    expect(mapPath('/_astro/index.abc123.css')).toEqual({
      kind: 'asset',
      to: '/_astro/index.abc123.css',
    })
    expect(mapPath('/fonts/inter.woff2')).toEqual({ kind: 'asset', to: '/fonts/inter.woff2' })
    expect(mapPath('/favicon.svg')).toEqual({ kind: 'asset', to: '/favicon.svg' })
  })

  it('normalizes extensionless paths to trailing slash', () => {
    expect(mapPath('/work')).toEqual({ kind: 'redirect', to: '/work/' })
    expect(mapPath('/contact')).toEqual({ kind: 'redirect', to: '/contact/' })
  })

  it('bounces a stray /ja prefix to the bare path', () => {
    expect(mapPath('/ja/work/')).toEqual({ kind: 'redirect', to: '/work/' })
    expect(mapPath('/ja/')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('/ja')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('/jp/work/')).toEqual({ kind: 'redirect', to: '/work/' })
    expect(mapPath('/jp/')).toEqual({ kind: 'redirect', to: '/' })
    expect(mapPath('/jp')).toEqual({ kind: 'redirect', to: '/' })
  })

  it('serves robots inline and hides the single-site sitemap', () => {
    expect(mapPath('/robots.txt')).toEqual({ kind: 'robots' })
    expect(mapPath('/sitemap-index.xml')).toEqual({ kind: 'none' })
    expect(mapPath('/sitemap-0.xml')).toEqual({ kind: 'none' })
  })
})

describe('ja-proxy handleRequest', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes through a 200 from the origin', async () => {
    fetchMock.mockResolvedValue(new Response('hello', { status: 200 }))
    const res = await handleRequest(new Request('https://mdmc.co.jp/about/'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('hello')
  })

  it('passes through a 304 Not Modified rather than 502ing it', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }))
    const res = await handleRequest(new Request('https://mdmc.co.jp/about/'))
    expect(res.status).toBe(304)
  })

  it('fails loud (502) on a real 301-with-Location from the origin', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 301, headers: { location: 'https://mdmc.co/about/' } }),
    )
    const res = await handleRequest(new Request('https://mdmc.co.jp/about/'))
    expect(res.status).toBe(502)
  })

  it('serves robots.txt inline with the right content-type and no origin fetch', async () => {
    const res = await handleRequest(new Request('https://mdmc.co.jp/robots.txt'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toContain('User-agent: *')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('404s the sitemap index without hitting the origin', async () => {
    const res = await handleRequest(new Request('https://mdmc.co.jp/sitemap-index.xml'))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redirects a stray /ja prefix on co.jp to the bare path', async () => {
    const res = await handleRequest(new Request('https://mdmc.co.jp/ja/foo'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mdmc.co.jp/foo')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the origin with the ja-proxy marker header and manual redirect', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))
    await handleRequest(new Request('https://mdmc.co.jp/about/'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [reqArg, initArg] = fetchMock.mock.calls[0]
    expect(reqArg.headers.get('x-mdmc-ja-proxy')).toBe('1')
    expect(reqArg.url).toBe('https://mdmc.co/jp/about/')
    expect(initArg).toEqual({ redirect: 'manual' })
  })

  it('serves English on the Japan domain from the origin /en tree', async () => {
    fetchMock.mockResolvedValue(new Response('english', { status: 200 }))
    const res = await handleRequest(new Request('https://mdmc.co.jp/en/work/'))
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0].url).toBe('https://mdmc.co/en/work/')
    expect(mapPath('/en/')).toEqual({ kind: 'html', to: '/en/' })
    expect(mapPath('/en')).toEqual({ kind: 'redirect', to: '/en/' })
  })
})
