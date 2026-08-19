import { describe, it, expect } from 'vitest'
import { slugify, assignSlugs, mergeLocales } from '../src/lib/normalize.js'

describe('slugify', () => {
  it('kebab-cases a latin title', () => {
    expect(slugify('myOCP Online Booking', 'abc123')).toBe('myocp-online-booking')
  })
  it('falls back to documentId for non-latin titles', () => {
    expect(slugify('ご挨拶', 'abc123')).toBe('abc123')
  })
})

describe('assignSlugs', () => {
  it('suffixes documentId on collision, deterministically', () => {
    const items = [
      { documentId: 'id1', title: 'Zenrise' },
      { documentId: 'id2', title: 'Zenrise' },
    ]
    const out = assignSlugs(items)
    expect(out[0].slug).toBe('zenrise')
    expect(out[1].slug).toBe('zenrise-id2')
  })
})

describe('mergeLocales', () => {
  it('overlays ja localized fields onto en by documentId', () => {
    const en = [{ documentId: 'd1', title: 'Zenrise Website', description: 'EN desc' }]
    const ja = [{ documentId: 'd1', title: 'ゼンライズ', description: 'JA desc' }]
    const merged = mergeLocales(en, ja, ['title', 'description'])
    expect(merged[0].ja.title).toBe('ゼンライズ')
    expect(merged[0].title).toBe('Zenrise Website')
  })
})
