import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { track, marketContext } from '../src/lib/analytics.js'

// These run in node, so window/document are stubbed per test. That is the
// point: the helper has to behave sanely when the page context is missing or
// hostile, because it fires from inside form submit handlers.
const stub = ({ gtag, lang = 'en', site = 'co', storage } = {}) => {
  globalThis.window = { gtag }
  globalThis.document = { documentElement: { lang, dataset: site ? { site } : {} } }
  globalThis.localStorage = storage ?? { getItem: () => null }
}

afterEach(() => {
  delete globalThis.window
  delete globalThis.document
  delete globalThis.localStorage
})

describe('track', () => {
  it('sends the event when gtag is present', () => {
    const calls = []
    stub({ gtag: (...a) => calls.push(a) })
    expect(track('generate_lead', { form: 'contact' })).toBe(true)
    expect(calls).toEqual([['event', 'generate_lead', { form: 'contact' }]])
  })

  it('no-ops when gtag is absent — which is how dev and previews stay clean', () => {
    stub({ gtag: undefined })
    expect(track('generate_lead')).toBe(false)
  })

  it('never throws, whatever gtag does', () => {
    stub({ gtag: () => { throw new Error('blocked by an extension') } })
    expect(() => track('generate_lead')).not.toThrow()
    expect(track('generate_lead')).toBe(false)
  })

  it('never throws when there is no window at all', () => {
    delete globalThis.window
    expect(() => track('generate_lead')).not.toThrow()
    expect(track('generate_lead')).toBe(false)
  })

  it('drops empty params rather than sending null/undefined to GA4', () => {
    const calls = []
    stub({ gtag: (...a) => calls.push(a) })
    track('contact_click', { method: 'email', target: undefined, extra: null, blank: '' })
    expect(calls[0][2]).toEqual({ method: 'email' })
  })
})

describe('marketContext', () => {
  it('reports site, locale and the stored region on mdmc.co', () => {
    stub({ gtag: () => {}, lang: 'ja', site: 'co', storage: { getItem: () => 'au' } })
    expect(marketContext()).toEqual({ site: 'co', locale: 'ja', region: 'au' })
  })

  it('fixes region to jp on co.jp, ignoring any stored preference', () => {
    // The domain IS the region there, so a stale localStorage value from
    // mdmc.co must not mislabel a Japanese conversion.
    stub({ gtag: () => {}, lang: 'ja', site: 'cojp', storage: { getItem: () => 'au' } })
    expect(marketContext().region).toBe('jp')
  })

  it('defaults region to nz on mdmc.co when nothing is stored', () => {
    stub({ gtag: () => {}, site: 'co', storage: { getItem: () => null } })
    expect(marketContext().region).toBe('nz')
  })

  it('still returns a usable context when localStorage throws', () => {
    stub({
      gtag: () => {}, lang: 'en', site: 'co',
      storage: { getItem: () => { throw new Error('storage disabled') } },
    })
    const ctx = marketContext()
    expect(ctx.site).toBe('co')
    expect(ctx.locale).toBe('en')
  })
})
