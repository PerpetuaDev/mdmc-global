import { describe, it, expect } from 'vitest'
import { normalizeProject, normalizeArticle } from '../src/lib/content.js'

describe('normalizeProject', () => {
  const withStory = {
    documentId: 'p1',
    title: 'Test Project',
    description: 'Desc',
    client: 'Client Co',
    date: '2026-01-01',
    region: 'Japan, Asia',
    services: 'Web Design, Strategy',
    dark_hero: false,
    thumbnail: null,
    hero_image: null,
    overview: 'Overview para.',
    challenge: [{ type: 'paragraph', children: [{ text: 'Challenge para.' }] }],
    approach: 'Approach para.',
    outcome: 'Outcome para.',
    pull_quote: 'Great quote',
    pull_quote_attribution: 'CEO',
    gallery: [
      { image: { url: 'https://x/img1.jpg', alternativeText: 'Img1' }, kind: 'hero', caption: 'Caption 1' },
      { image: { url: 'https://x/img2.jpg', alternativeText: null }, kind: 'square', caption: null },
    ],
    ja: null,
  }

  const bare = {
    documentId: 'p2',
    title: 'Bare Project',
    description: 'Desc2',
    client: 'Client2',
    date: '2026-02-02',
    region: 'USA',
    services: 'Branding',
    dark_hero: false,
    thumbnail: null,
    hero_image: null,
    ja: null,
  }

  it('maps regions, specialties, gallery, and story from a fixture with those fields', () => {
    const out = normalizeProject(withStory)
    expect(out.regions).toEqual(['Japan', 'Asia'])
    expect(out.specialties).toEqual(['Web Design', 'Strategy'])
    expect(out.services).toEqual(['Web Design', 'Strategy'])
    expect(out.gallery).toEqual([
      { url: 'https://x/img1.jpg', alt: 'Img1', kind: 'hero', caption: 'Caption 1' },
      { url: 'https://x/img2.jpg', alt: '', kind: 'square', caption: null },
    ])
    expect(out.story).toEqual({
      overview: ['Overview para.'],
      challenge: ['Challenge para.'],
      approach: ['Approach para.'],
      outcome: ['Outcome para.'],
    })
    expect(out.pullQuote).toBe('Great quote')
    expect(out.pullQuoteAttribution).toBe('CEO')
  })

  it('yields gallery: [], story: null, and pullQuote: null when those fields are absent', () => {
    const out = normalizeProject(bare)
    expect(out.regions).toEqual(['USA'])
    expect(out.gallery).toEqual([])
    expect(out.story).toBeNull()
    expect(out.pullQuote).toBeNull()
    expect(out.pullQuoteAttribution).toBeNull()
  })

  it('yields story: null but a populated top-level pullQuote when only the quote is set (quote-only entry)', () => {
    const quoteOnly = {
      ...bare,
      documentId: 'p3',
      pull_quote: 'Quote with no story',
      pull_quote_attribution: 'Founder',
    }
    const out = normalizeProject(quoteOnly)
    expect(out.story).toBeNull()
    expect(out.pullQuote).toBe('Quote with no story')
    expect(out.pullQuoteAttribution).toBe('Founder')
  })

  it('normalizes the .ja overlay to the same shape (localized fields only), including pullQuote', () => {
    const withJa = {
      ...withStory,
      ja: {
        title: 'テストプロジェクト',
        description: 'JA desc',
        services: 'ウェブデザイン',
        pull_quote: 'JA quote',
        pull_quote_attribution: 'JA CEO',
      },
    }
    const out = normalizeProject(withJa)
    expect(out.ja).toEqual({
      title: 'テストプロジェクト',
      description: 'JA desc',
      services: ['ウェブデザイン'],
      specialties: ['ウェブデザイン'],
      story: null,
      pullQuote: 'JA quote',
      pullQuoteAttribution: 'JA CEO',
    })
  })

  it('leaves ja null when no ja overlay exists', () => {
    expect(normalizeProject(bare).ja).toBeNull()
  })
})

describe('normalizeArticle', () => {
  const projects = [{ documentId: 'p1', slug: 'test-project' }]

  it('resolves a case_study article: kind, kindLabel, projectSlug, heroImage, body, dateLabel', () => {
    const raw = {
      documentId: 'a1',
      title: 'Case Study Article',
      date: '2026-03-03',
      excerpt: 'Excerpt',
      kind: 'case_study',
      project: { documentId: 'p1', title: 'Test Project' },
      hero_image: { url: 'https://x/hero.jpg', alternativeText: 'Hero' },
      cover: null,
      body: 'Body para 1\nBody para 2',
      ja: null,
    }
    const out = normalizeArticle(raw, projects)
    expect(out.kind).toBe('case_study')
    expect(out.kindLabel).toBe('Case Study')
    expect(out.projectSlug).toBe('test-project')
    expect(out.heroImage).toEqual({ url: 'https://x/hero.jpg', alt: 'Hero' })
    expect(out.body).toEqual(['Body para 1', 'Body para 2'])
    expect(out.dateLabel).toBe('MAR 3, 2026')
  })

  it('defaults kind to news, kindLabel to News, projectSlug to null, and falls back cover -> heroImage', () => {
    const raw = {
      documentId: 'a2',
      title: 'News Article',
      date: '2026-04-04',
      excerpt: 'Excerpt2',
      project: null,
      hero_image: null,
      cover: { url: 'https://x/cover.jpg', alternativeText: null },
      body: null,
      ja: null,
    }
    const out = normalizeArticle(raw, projects)
    expect(out.kind).toBe('news')
    expect(out.kindLabel).toBe('News')
    expect(out.projectSlug).toBeNull()
    expect(out.heroImage).toEqual({ url: 'https://x/cover.jpg', alt: '' })
    expect(out.body).toEqual([])
  })
})
