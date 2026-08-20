import { describe, it, expect } from 'vitest'
import { mapPath } from '../workers/ja-proxy/worker.js'

describe('ja-proxy mapPath', () => {
  it('maps HTML routes onto the ja tree', () => {
    expect(mapPath('/')).toEqual({ kind: 'html', to: '/ja/' })
    expect(mapPath('/work/')).toEqual({ kind: 'html', to: '/ja/work/' })
    expect(mapPath('/work/youki/')).toEqual({ kind: 'html', to: '/ja/work/youki/' })
    expect(mapPath('/about/')).toEqual({ kind: 'html', to: '/ja/about/' })
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
  })

  it('serves robots inline and hides the single-site sitemap', () => {
    expect(mapPath('/robots.txt')).toEqual({ kind: 'robots' })
    expect(mapPath('/sitemap-index.xml')).toEqual({ kind: 'none' })
    expect(mapPath('/sitemap-0.xml')).toEqual({ kind: 'none' })
  })
})
