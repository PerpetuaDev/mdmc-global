import { describe, it, expect } from 'vitest'
import {
  normalizeProject,
  normalizeArticle,
  normalizeAbout,
  normalizeAboutJapan,
  normalizeCareer,
  normalizeJob,
  ARTICLE_KIND_LABELS,
} from '../src/lib/content.js'
import { assignSlugs } from '../src/lib/normalize.js'

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

describe('ARTICLE_KIND_LABELS', () => {
  it('is importable and provides the three fixed article kinds', () => {
    expect(ARTICLE_KIND_LABELS).toEqual({
      news: 'News',
      article: 'Article',
      case_study: 'Case Study',
    })
  })
})

describe('normalizeAbout', () => {
  it('builds sections only from kv_N pairs that have a title, mapping body via blocksToParagraphs', () => {
    const raw = {
      headline: 'We are in it for good work.',
      lede: 'MDMC is a small team.',
      hero_image: { url: 'https://x/about-hero.jpg', alternativeText: 'About hero' },
      kv_1_title: 'What we do',
      kv_1_body: 'Branding.\nDigital product design.',
      kv_1_image: { url: 'https://x/kv1.jpg', alternativeText: null },
      kv_2_title: 'How we work',
      kv_2_body: 'Two-week loops.',
      kv_2_image: null,
      kv_3_title: '',
      kv_3_body: 'Should not appear.',
      kv_4_title: null,
      kv_4_body: 'Should not appear either.',
    }
    const out = normalizeAbout(raw)
    expect(out.headline).toBe('We are in it for good work.')
    expect(out.lede).toBe('MDMC is a small team.')
    expect(out.heroImage).toEqual({ url: 'https://x/about-hero.jpg', alt: 'About hero' })
    expect(out.sections).toHaveLength(2)
    expect(out.sections[0]).toEqual({
      title: 'What we do',
      body: ['Branding.', 'Digital product design.'],
      image: { url: 'https://x/kv1.jpg', alt: '' },
    })
    expect(out.sections[1]).toEqual({
      title: 'How we work',
      body: ['Two-week loops.'],
      image: null,
    })
  })

  it('returns null when the single-type entry is absent', () => {
    expect(normalizeAbout(null)).toBeNull()
  })
})

describe('normalizeAboutJapan', () => {
  it('maps hero image, greeting fields, and the signature block', () => {
    const raw = {
      hero_image: { url: 'https://x/aj-hero.jpg', alternativeText: null },
      greeting_title: '長く、誠実に。',
      greeting_body: 'このたびは、ありがとうございます。\n\n何卒よろしくお願い申し上げます。',
      signature_role: 'CEO',
      signature_name: 'フィンレイソン・リアム',
      signature_romaji: 'Liam Finlayson',
      signature_portrait: { url: 'https://x/portrait.png', alternativeText: null },
    }
    const out = normalizeAboutJapan(raw)
    expect(out.heroImage).toEqual({ url: 'https://x/aj-hero.jpg', alt: '' })
    expect(out.greetingTitle).toBe('長く、誠実に。')
    expect(out.greetingBody).toEqual(['このたびは、ありがとうございます。', '何卒よろしくお願い申し上げます。'])
    expect(out.signature).toEqual({
      role: 'CEO',
      name: 'フィンレイソン・リアム',
      romaji: 'Liam Finlayson',
      portrait: { url: 'https://x/portrait.png', alt: '' },
    })
  })

  it('returns null when the single-type entry is absent', () => {
    expect(normalizeAboutJapan(null)).toBeNull()
  })
})

describe('normalizeCareer', () => {
  it('maps headline, intro paragraphs, contactEmail, and heroImage', () => {
    const raw = {
      headline: 'Join a talented, international team',
      intro: "We're always looking to hire great people.",
      contact_email: 'careers@mdmc.co',
      hero_image: { url: 'https://x/career-hero.jpg', alternativeText: 'Career hero' },
      offers: [{ id: 1 }],
    }
    const out = normalizeCareer(raw)
    expect(out.headline).toBe('Join a talented, international team')
    expect(out.intro).toEqual(["We're always looking to hire great people."])
    expect(out.contactEmail).toBe('careers@mdmc.co')
    expect(out.heroImage).toEqual({ url: 'https://x/career-hero.jpg', alt: 'Career hero' })
    expect(out.offers).toBeUndefined()
  })

  it('degrades contactEmail to null and returns null for an absent entry', () => {
    const out = normalizeCareer({ headline: 'H', intro: 'I' })
    expect(out.contactEmail).toBeNull()
    expect(normalizeCareer(null)).toBeNull()
  })
})

describe('normalizeJob', () => {
  // Real enum values confirmed from the content snapshot's one published job
  // (kd13tzu1r1620jwmukdhbvw0): `type` is already a display string
  // ("Part-time"), not Strapi's typical snake_case — the label map keys off
  // that literal value, with an unknown value falling back to a prettified
  // raw string.
  const raw = {
    documentId: 'kd13tzu1r1620jwmukdhbvw0',
    title: 'Bilingual Administrator',
    location: 'Yokohama',
    type: 'Part-time',
    location_type: 'Onsite',
    excerpt: 'Keep the Yokohama studio running.',
    body: 'MDMC Japan is looking for a part-time bilingual administrator.\n\nDay to day, that means handling correspondence.',
    apply_email: 'recruit@mdmc.co',
    hero_image: { url: 'https://x/job-hero.jpg', alternativeText: null },
  }

  it('maps labels (typeLabel from the real enum value) and all pass-through fields', () => {
    const out = normalizeJob(raw)
    expect(out.documentId).toBe('kd13tzu1r1620jwmukdhbvw0')
    expect(out.title).toBe('Bilingual Administrator')
    expect(out.excerpt).toBe('Keep the Yokohama studio running.')
    expect(out.body).toEqual([
      'MDMC Japan is looking for a part-time bilingual administrator.',
      'Day to day, that means handling correspondence.',
    ])
    expect(out.location).toBe('Yokohama')
    expect(out.locationLabel).toBe('Yokohama')
    expect(out.type).toBe('Part-time')
    expect(out.typeLabel).toBe('Part-time')
    expect(out.locationType).toBe('Onsite')
    expect(out.applyEmail).toBe('recruit@mdmc.co')
    expect(out.heroImage).toEqual({ url: 'https://x/job-hero.jpg', alt: '' })
  })

  it('prettifies an unrecognized type value rather than crashing', () => {
    const out = normalizeJob({ ...raw, type: 'weekend_casual' })
    expect(out.typeLabel).toBe('Weekend Casual')
  })

  it('assignSlugs gives the job a routable slug from its title', () => {
    const [out] = assignSlugs([normalizeJob(raw)])
    expect(out.slug).toBe('bilingual-administrator')
  })
})
