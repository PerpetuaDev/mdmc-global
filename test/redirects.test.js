import { describe, it, expect } from 'vitest'
import { legacyRedirect } from '../src/lib/legacy-redirects.js'

const map = { work: { d1: 'zenrise-website' }, news: { a1: 'first-post' }, careers: { j1: 'bilingual-administrator' } }

describe('legacyRedirect', () => {
  it('maps project documentIds to slug routes', () => {
    expect(legacyRedirect('#/work/d1', map)).toBe('/work/zenrise-website/')
  })
  it('maps bare section hashes to index routes', () => {
    expect(legacyRedirect('#/work', map)).toBe('/work/')
    expect(legacyRedirect('#/about', map)).toBe('/about/')
    expect(legacyRedirect('#/contact', map)).toBe('/contact/')
  })
  it('sends unknown ids to the section index', () => {
    expect(legacyRedirect('#/news/zzz', map)).toBe('/news/')
  })
  it('returns null for empty or unrecognized hashes', () => {
    expect(legacyRedirect('', map)).toBeNull()
    expect(legacyRedirect('#/whatever', map)).toBeNull()
  })
  it('tolerates the no-leading-slash form', () => {
    expect(legacyRedirect('#work/d1', map)).toBe('/work/zenrise-website/')
  })
})
