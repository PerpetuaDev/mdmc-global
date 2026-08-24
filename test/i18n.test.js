import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeT, localePath, counterpartPath, LOCALES, STRINGS, SITES, sitePrefix, originPrefix, makeLinks, enPathOf, tMisses, pickLocalized, interpolate } from '../src/lib/i18n.js'

describe('makeT', () => {
  it('returns locale strings and falls back to en, then the key', () => {
    const t = makeT('ja')
    expect(t('nav.work')).toBe('ワーク')
    expect(STRINGS.ja['nav.work']).toBe('ワーク')
    expect(makeT('en')('nav.work')).toBe('Work')
    expect(t('definitely.missing.key')).toBe('definitely.missing.key')
  })
})

describe('paths', () => {
  it('prefixes ja and leaves en alone', () => {
    expect(localePath('ja', '/work/')).toBe('/ja/work/')
    expect(localePath('en', '/work/')).toBe('/work/')
    expect(localePath('ja', '/')).toBe('/ja/')
  })
  it('maps counterparts both directions', () => {
    expect(counterpartPath('en', '/work/')).toBe('/ja/work/')
    expect(counterpartPath('ja', '/ja/work/')).toBe('/work/')
    expect(counterpartPath('ja', '/ja/')).toBe('/')
    expect(counterpartPath('en', '/about/')).toBe('/ja/about/')
  })
})

describe('makeLinks (region × language matrix, 2026-08-21)', () => {
  it('internal links are same-domain relative, prefixed per tree', () => {
    expect(makeLinks('co', 'en').internal('/work/')).toBe('/work/')
    expect(makeLinks('co', 'ja').internal('/work/')).toBe('/ja/work/')
    expect(makeLinks('cojp', 'ja').internal('/work/')).toBe('/work/')
    expect(makeLinks('cojp', 'en').internal('/work/')).toBe('/en/work/')
    expect(makeLinks('co', 'ja').internal('/')).toBe('/ja/')
    expect(makeLinks('cojp', 'en').internal('/')).toBe('/en/')
  })
  it('toLang switches language ON the current domain (relative)', () => {
    expect(makeLinks('co', 'en').toLang('ja', '/work/')).toBe('/ja/work/')
    expect(makeLinks('co', 'ja').toLang('en', '/work/')).toBe('/work/')
    expect(makeLinks('cojp', 'ja').toLang('en', '/work/')).toBe('/en/work/')
    expect(makeLinks('cojp', 'en').toLang('ja', '/work/')).toBe('/work/')
  })
  it('toSite is the only cross-domain absolute, carrying the language', () => {
    expect(makeLinks('co', 'en').toSite('cojp', '/work/')).toBe('https://mdmc.co.jp/en/work/')
    expect(makeLinks('co', 'ja').toSite('cojp', '/work/')).toBe('https://mdmc.co.jp/work/')
    expect(makeLinks('cojp', 'ja').toSite('co', '/work/')).toBe('https://mdmc.co/ja/work/')
    expect(makeLinks('cojp', 'en').toSite('co', '/work/')).toBe('https://mdmc.co/work/')
    expect(makeLinks('cojp', 'en').toSite('co', '/')).toBe('https://mdmc.co/')
  })
})

describe('sitePrefix / originPrefix / enPathOf', () => {
  it('surface prefixes: only co-ja and cojp-en carry one', () => {
    expect(sitePrefix('co', 'en')).toBe('')
    expect(sitePrefix('co', 'ja')).toBe('/ja')
    expect(sitePrefix('cojp', 'ja')).toBe('')
    expect(sitePrefix('cojp', 'en')).toBe('/en')
  })
  it('origin prefixes: cojp-ja is built under /jp', () => {
    expect(originPrefix('co', 'ja')).toBe('/ja')
    expect(originPrefix('cojp', 'ja')).toBe('/jp')
    expect(originPrefix('cojp', 'en')).toBe('/en')
    expect(originPrefix('co', 'en')).toBe('')
  })
  it('enPathOf strips the origin prefix back to the EN-shaped path', () => {
    expect(enPathOf('co', 'en', '/work/x/')).toBe('/work/x/')
    expect(enPathOf('co', 'ja', '/ja/work/x/')).toBe('/work/x/')
    expect(enPathOf('cojp', 'ja', '/jp/work/x/')).toBe('/work/x/')
    expect(enPathOf('cojp', 'en', '/en/work/x/')).toBe('/work/x/')
    expect(enPathOf('cojp', 'ja', '/jp/')).toBe('/')
    expect(enPathOf('co', 'ja', '/ja/')).toBe('/')
  })
})

describe('pickLocalized', () => {
  const withOverlay = { title: 'EN Title', description: 'EN Desc', ja: { title: 'JA Title' } }
  const withoutOverlay = { title: 'EN Only', description: 'EN Only Desc' }
  const emptyOverlay = { title: 'EN Fallback', ja: {} }

  it('en always reads the top-level field, ja overlay or not', () => {
    expect(pickLocalized('en', withOverlay, 'title')).toBe('EN Title')
    expect(pickLocalized('en', withoutOverlay, 'title')).toBe('EN Only')
  })
  it('ja reads the overlay field when present', () => {
    expect(pickLocalized('ja', withOverlay, 'title')).toBe('JA Title')
  })
  it('ja falls back to the top-level field when the overlay field is missing', () => {
    expect(pickLocalized('ja', withOverlay, 'description')).toBe('EN Desc')
    expect(pickLocalized('ja', emptyOverlay, 'title')).toBe('EN Fallback')
  })
  it('ja falls back to the top-level field when there is no overlay at all', () => {
    expect(pickLocalized('ja', withoutOverlay, 'title')).toBe('EN Only')
  })
})

// --- Extended coverage below (not part of the brief's binding blocks) ---

describe('LOCALES', () => {
  it('is en/ja, in that order', () => {
    expect(LOCALES).toEqual(['en', 'ja'])
  })
})

describe('SITES', () => {
  it('ships both domains', () => {
    expect(SITES.co).toBe('https://mdmc.co')
    expect(SITES.cojp).toBe('https://mdmc.co.jp')
  })
})

describe('localePath', () => {
  it('root path prefixes to /ja/, not a bare /ja', () => {
    expect(localePath('ja', '/')).toBe('/ja/')
    expect(localePath('ja', '/')).not.toBe('/ja')
  })
  it('is a no-op for en on every path shape', () => {
    expect(localePath('en', '/')).toBe('/')
    expect(localePath('en', '/work/some-project/')).toBe('/work/some-project/')
  })
})

describe('counterpartPath', () => {
  it('round-trips en -> ja -> en for a nested path', () => {
    const ja = counterpartPath('en', '/work/some-project/')
    expect(ja).toBe('/ja/work/some-project/')
    expect(counterpartPath('ja', ja)).toBe('/work/some-project/')
  })
  it('round-trips en -> ja -> en for the home path', () => {
    const ja = counterpartPath('en', '/')
    expect(ja).toBe('/ja/')
    expect(counterpartPath('ja', ja)).toBe('/')
  })
})

describe('tMisses', () => {
  // Since the 2026-08-20 PLACEHOLDER JA pass, no real key is en-only any
  // more — inject a synthetic one so the fallback machinery stays covered.
  const TEST_KEY = '__test.enOnly'
  beforeEach(() => { STRINGS.en[TEST_KEY] = 'Test-only EN value' })
  afterEach(() => { delete STRINGS.en[TEST_KEY] })

  it('records ja keys served as EN fallback, keyed by locale', () => {
    const t = makeT('ja')
    t(TEST_KEY)
    const misses = tMisses()
    expect(misses.ja).toContain(TEST_KEY)
  })
  it('does not record a miss when the key exists in the ja dict', () => {
    const t = makeT('ja')
    t('nav.work')
    const misses = tMisses()
    expect(misses.ja).not.toContain('nav.work')
  })
  it('never creates an "en" bucket — en has nothing to fall back to', () => {
    const t = makeT('en')
    t(TEST_KEY)
    const misses = tMisses()
    expect(misses.en).toBeUndefined()
  })
  it('does not record a miss for a key missing from both dicts', () => {
    const t = makeT('ja')
    t('totally.unknown.key')
    const misses = tMisses()
    expect(misses.ja).not.toContain('totally.unknown.key')
  })
})

describe('interpolate', () => {
  it('fills {slot} tokens and leaves unmatched slots literal', () => {
    expect(interpolate('{region}の現地時間', { region: '日本' })).toBe('日本の現地時間')
    expect(interpolate('Toggle {region} studio details', { region: 'Japan' })).toBe('Toggle Japan studio details')
    expect(interpolate('Open {title}', {})).toBe('Open {title}')
  })
})

describe('STRINGS: dictionary invariants', () => {
  it('every ja key also has an en value (en is the superset)', () => {
    for (const key of Object.keys(STRINGS.ja)) {
      expect(STRINGS.en, `missing en counterpart for ja key "${key}"`).toHaveProperty(key)
    }
  })
  it('no dictionary value is an empty string', () => {
    for (const [locale, dict] of Object.entries(STRINGS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${locale}.${key} is empty`).not.toBe('')
      }
    }
  })
})

describe('STRINGS.en: nav.* (ported verbatim from main:src/i18n.jsx)', () => {
  it('nav.work', () => expect(STRINGS.en['nav.work']).toBe('Work'))
  it('nav.about', () => expect(STRINGS.en['nav.about']).toBe('About'))
  it('nav.news', () => expect(STRINGS.en['nav.news']).toBe('News'))
  it('nav.contact', () => expect(STRINGS.en['nav.contact']).toBe('Contact'))
  it('nav.careers', () => expect(STRINGS.en['nav.careers']).toBe('Careers'))
})

describe('STRINGS.ja: nav.* (ported verbatim)', () => {
  it('nav.work', () => expect(STRINGS.ja['nav.work']).toBe('ワーク'))
  it('nav.about', () => expect(STRINGS.ja['nav.about']).toBe('私たちについて'))
  it('nav.news', () => expect(STRINGS.ja['nav.news']).toBe('ニュース'))
  it('nav.contact', () => expect(STRINGS.ja['nav.contact']).toBe('お問い合わせ'))
  it('nav.careers', () => expect(STRINGS.ja['nav.careers']).toBe('採用情報'))
})

describe('STRINGS: home.manifesto.* (ported verbatim; .3 unused by the redesign, left behind)', () => {
  it('home.manifesto.1 en', () => {
    expect(STRINGS.en['home.manifesto.1']).toBe("We're MDMC—an integrated design &\ndigital strategy agency.")
  })
  it('home.manifesto.1 ja', () => {
    expect(STRINGS.ja['home.manifesto.1']).toBe('MDMCは、デザインとデジタル戦略を\n横断する統合エージェンシーです。')
  })
  it('home.manifesto.2 en', () => {
    expect(STRINGS.en['home.manifesto.2']).toBe("We help great products find the people\nwho'll love them, and help good, honest\nbusinesses stand out from the noise.")
  })
  it('home.manifesto.2 ja', () => {
    expect(STRINGS.ja['home.manifesto.2']).toBe('優れたプロダクトを愛してくれる人々と\n結びつけ、誠実なビジネスがノイズの中で\n際立つお手伝いをしています。')
  })
  it('home.manifesto.3 was not ported (dead — unused by the redesign home page)', () => {
    expect(STRINGS.en['home.manifesto.3']).toBeUndefined()
  })
})

describe('STRINGS: work.* (ported verbatim)', () => {
  it('work.title', () => {
    expect(STRINGS.en['work.title']).toBe('Work')
    expect(STRINGS.ja['work.title']).toBe('ワーク')
  })
  it('work.region.Japan', () => {
    expect(STRINGS.en['work.region.Japan']).toBe('Japan')
    expect(STRINGS.ja['work.region.Japan']).toBe('日本')
  })
  it('work.region.New Zealand', () => {
    expect(STRINGS.en['work.region.New Zealand']).toBe('New Zealand')
    expect(STRINGS.ja['work.region.New Zealand']).toBe('ニュージーランド')
  })
  it('work.region.Australia', () => {
    expect(STRINGS.en['work.region.Australia']).toBe('Australia')
    expect(STRINGS.ja['work.region.Australia']).toBe('オーストラリア')
  })
})

describe('STRINGS: news.title (ported verbatim)', () => {
  it('en/ja', () => {
    expect(STRINGS.en['news.title']).toBe('News')
    expect(STRINGS.ja['news.title']).toBe('ニュース')
  })
})

describe('STRINGS: careers.* / job.* (ported verbatim where wording is unchanged)', () => {
  it('careers.title', () => {
    expect(STRINGS.en['careers.title']).toBe('Careers')
    expect(STRINGS.ja['careers.title']).toBe('採用情報')
  })
  it('careers.job.about', () => {
    expect(STRINGS.en['careers.job.about']).toBe('About the role')
    expect(STRINGS.ja['careers.job.about']).toBe('仕事内容')
  })
  it('careers.job.apply', () => {
    expect(STRINGS.en['careers.job.apply']).toBe('Apply for this position')
    expect(STRINGS.ja['careers.job.apply']).toBe('このポジションに応募する')
  })
  it('careers.form.upload', () => {
    expect(STRINGS.en['careers.form.upload']).toBe('CV & cover letter')
    expect(STRINGS.ja['careers.form.upload']).toBe('履歴書・カバーレター')
  })
  it('careers.form.uploadBtn', () => {
    expect(STRINGS.en['careers.form.uploadBtn']).toBe('Choose files')
    expect(STRINGS.ja['careers.form.uploadBtn']).toBe('ファイルを選択')
  })
  it('careers.form.uploadHint', () => {
    expect(STRINGS.en['careers.form.uploadHint']).toBe('.pdf, .doc, .docx — up to 4 files, 15MB total')
  })
  it('careers.form.send', () => {
    expect(STRINGS.en['careers.form.send']).toBe('Submit application')
    expect(STRINGS.ja['careers.form.send']).toBe('応募を送信')
  })
})

describe('STRINGS: contact.* (ported verbatim: field labels whose wording is unchanged)', () => {
  it('contact.form.name', () => {
    expect(STRINGS.en['contact.form.name']).toBe('Name')
    expect(STRINGS.ja['contact.form.name']).toBe('お名前')
  })
  it('contact.form.email', () => {
    expect(STRINGS.en['contact.form.email']).toBe('Email')
    expect(STRINGS.ja['contact.form.email']).toBe('メールアドレス')
  })
  it('contact.form.company', () => {
    expect(STRINGS.en['contact.form.company']).toBe('Company')
    expect(STRINGS.ja['contact.form.company']).toBe('会社名')
  })
  it('contact.form.budget', () => {
    expect(STRINGS.en['contact.form.budget']).toBe('Budget')
    expect(STRINGS.ja['contact.form.budget']).toBe('ご予算')
  })
  it('contact.form.budgetPh', () => {
    expect(STRINGS.en['contact.form.budgetPh']).toBe('Range is fine')
    expect(STRINGS.ja['contact.form.budgetPh']).toBe('レンジで結構です')
  })
})

describe('STRINGS: footer.* (ported verbatim)', () => {
  it('footer.cta.label + footer.cta.action concatenate to the live literal', () => {
    expect(STRINGS.en['footer.cta.label']).toBe('Have a project in mind?')
    expect(STRINGS.en['footer.cta.action']).toBe("Let's talk.")
    expect(`${STRINGS.en['footer.cta.label']} ${STRINGS.en['footer.cta.action']}`).toBe("Have a project in mind? Let's talk.")
  })
  it('footer.copy', () => {
    expect(STRINGS.en['footer.copy']).toBe('© 2026 MDMC Group Inc.')
    expect(STRINGS.ja['footer.copy']).toBe('© 2026 MDMC Group Inc.')
  })
  it('lang.en / lang.ja', () => {
    expect(STRINGS.en['lang.en']).toBe('English')
    expect(STRINGS.ja['lang.ja']).toBe('日本語')
  })
})

describe('STRINGS.en: project.section.* (overview ported verbatim; challenge/approach/outcome are new)', () => {
  it('project.section.overview', () => {
    expect(STRINGS.en['project.section.overview']).toBe('Overview')
    expect(STRINGS.ja['project.section.overview']).toBe('概要')
  })
  it('project.section.challenge (redesign-only; ja is a placeholder)', () => {
    expect(STRINGS.en['project.section.challenge']).toBe('Challenge')
    expect(STRINGS.ja['project.section.challenge']).toBe('課題')
  })
  it('project.section.approach (redesign-only; ja is a placeholder)', () => {
    expect(STRINGS.en['project.section.approach']).toBe('Approach')
    expect(STRINGS.ja['project.section.approach']).toBe('アプローチ')
  })
  it('project.section.outcome (redesign-only; ja is a placeholder)', () => {
    expect(STRINGS.en['project.section.outcome']).toBe('Outcome')
    expect(STRINGS.ja['project.section.outcome']).toBe('成果')
  })
  it('project.next', () => {
    expect(STRINGS.en['project.next']).toBe('Next project')
    expect(STRINGS.ja['project.next']).toBe('次のプロジェクト')
  })
})

describe('STRINGS.en: new redesign-only keys, exact match to live component literals', () => {
  it('project.viewDetails / project.viewGallery (ProjectHeader/work/[slug] toggle)', () => {
    expect(STRINGS.en['project.viewDetails']).toBe('View project details')
    expect(STRINGS.en['project.viewGallery']).toBe('View gallery')
  })
  it('work.filter.region / work.filter.specialty (work/index.astro)', () => {
    expect(STRINGS.en['work.filter.region']).toBe('Region')
    expect(STRINGS.en['work.filter.specialty']).toBe('Specialty')
  })
  it('news.filter.filters (news/index.astro)', () => {
    expect(STRINGS.en['news.filter.filters']).toBe('Filters')
  })
  it('careers.openPositions (careers/index.astro)', () => {
    expect(STRINGS.en['careers.openPositions']).toBe('Open positions')
  })
  it('careers.speculativeCta — differs from the old dict\'s "...Write to" by trailing "us"', () => {
    expect(STRINGS.en['careers.speculativeCta']).toBe('Think you belong here anyway? Write to us')
  })
  it('careers.meta.studio / careers.meta.type (careers/index.astro row labels)', () => {
    expect(STRINGS.en['careers.meta.studio']).toBe('Studio')
    expect(STRINGS.en['careers.meta.type']).toBe('Type')
  })
  it('careers.job.readByHuman (careers/[slug].astro apply header)', () => {
    expect(STRINGS.en['careers.job.readByHuman']).toBe('Read by a human')
  })
  it('careers.form.aboutYou — differs from old dict\'s "A few lines about you"', () => {
    expect(STRINGS.en['careers.form.aboutYou']).toBe('About you')
  })
  it('careers.form.portfolioLinkedin — differs from old dict\'s "Portfolio or LinkedIn link"', () => {
    expect(STRINGS.en['careers.form.portfolioLinkedin']).toBe('Portfolio / LinkedIn')
  })
  it('contact.form.messageLabel — differs from old dict\'s "What are you working on?"', () => {
    expect(STRINGS.en['contact.form.messageLabel']).toBe('Message')
  })
  it('contact.form.sendMessage / sendAMessage / sendUsAMessage — three distinct CTA wordings', () => {
    expect(STRINGS.en['contact.form.sendMessage']).toBe('Send message')
    expect(STRINGS.en['contact.form.sendAMessage']).toBe('Send a message')
    expect(STRINGS.en['contact.form.sendUsAMessage']).toBe('Send us a message')
  })
  it('contact.form.to (contact form "To · {recipient}" header)', () => {
    expect(STRINGS.en['contact.form.to']).toBe('To')
  })
  it('form.thankYou / form.error — shared by contact and careers-apply forms', () => {
    expect(STRINGS.en['form.thankYou']).toBe("Thank you — we'll be in touch.")
    expect(STRINGS.en['form.error']).toBe('Something went wrong — please try again.')
  })
  it('footer.privacyTerms (footer bottom bar link)', () => {
    expect(STRINGS.en['footer.privacyTerms']).toBe('Privacy & Terms')
  })
  it('nav.region (header locale panel column header)', () => {
    expect(STRINGS.en['nav.region']).toBe('Region')
  })
  it('news.backToAll / news.shareArticle / news.seeFullCaseStudy (news/[slug].astro)', () => {
    expect(STRINGS.en['news.backToAll']).toBe('Back to all news')
    expect(STRINGS.en['news.shareArticle']).toBe('Share this article')
    expect(STRINGS.en['news.seeFullCaseStudy']).toBe('See the full case study')
  })
  it('notFound.* (404.astro — a new surface, not in the old site at all)', () => {
    expect(STRINGS.en['notFound.title']).toBe('Page not found.')
    expect(STRINGS.en['notFound.body']).toBe("The page you're looking for doesn't exist or has moved.")
    expect(STRINGS.en['notFound.backHome']).toBe('Back to home')
  })
  // 2026-08-20 PLACEHOLDER JA pass: every formerly-EN-only key now has a
  // machine-drafted ja placeholder (user-authorized, pending native review),
  // so the dictionaries are in full key parity — no key may be en-only.
  it('every en key has a ja value (full parity after the placeholder pass)', () => {
    for (const key of Object.keys(STRINGS.en)) {
      expect(STRINGS.ja, `expected ja to cover en key "${key}"`).toHaveProperty(key)
    }
  })
  it('placeholder ja values render Japanese, not the EN fallback', () => {
    const t = makeT('ja')
    expect(t('project.viewDetails')).toBe('プロジェクト詳細を見る')
    expect(t('careers.openPositions')).toBe('募集中のポジション')
    expect(t('form.thankYou')).toBe('ありがとうございます。追ってご連絡いたします。')
    expect(t('contact.form.to')).toBe('宛先')
    expect(t('nav.language')).toBe('言語')
    expect(t('contact.headline')).toBe('いま取り組んでいることを\nお聞かせください。')
    expect(t('contact.studio')).toBe('スタジオ')
  })
})
