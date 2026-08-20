// i18n module — plain data + lookup helpers, no framework/DOM dependency.
// Not wired into any component/page yet (that's a later phase-5 task); this
// module is the dictionary + path/link helpers only.
//
// Dictionaries are ported from `git show main:src/i18n.jsx` (STRINGS.en/ja),
// restricted to keys the redesign actually uses, plus new keys for
// redesign-only strings that have no old-dict equivalent (or whose current
// hardcoded wording differs from the old dict's wording for that concept —
// in that case the old ja translation cannot be safely reused, since it was
// written against different English words, so the key is added en-only).
// See task-1-report.md for the full ported-vs-new-EN-only breakdown and the
// "needs native JA pass" list.

export const LOCALES = ['en', 'ja']

export const STRINGS = {
  en: {
    // --- nav.* (ported verbatim from main:src/i18n.jsx) ---
    'nav.work': 'Work',
    'nav.about': 'About',
    'nav.news': 'News',
    'nav.contact': 'Contact',
    'nav.careers': 'Careers',

    // --- nav.region: redesign-only, no old-dict equivalent (old site used
    // a Global/Japan "site" model, not a Region picker). ---
    'nav.region': 'Region',

    // --- lang.* (ported verbatim) ---
    'lang.label': 'English',
    'lang.en': 'English',
    'lang.ja': '日本語',

    // --- home.manifesto.* (ported verbatim; only 1/2 are used by the
    // redesign's home page — .3 is a dead old key, left behind) ---
    'home.manifesto.1': "We're MDMC—an integrated design &\ndigital strategy agency.",
    'home.manifesto.2': "We help great products find the people\nwho'll love them, and help good, honest\nbusinesses stand out from the noise.",

    // --- home.work.view (ported verbatim; reused by WorkCard.astro and
    // StoryView.astro's "Next project" teaser, both literally "View
    // project") ---
    'home.work.view': 'View project',

    // --- work.* (ported verbatim) ---
    'work.title': 'Work',
    'work.region.Japan': 'Japan',
    'work.region.New Zealand': 'New Zealand',
    'work.region.Australia': 'Australia',

    // --- work.filter.*: redesign-only, no old-dict equivalent (old site had
    // no work-filtering UI) ---
    'work.filter.region': 'Region',
    'work.filter.specialty': 'Specialty',

    // --- news.title (ported verbatim) ---
    'news.title': 'News',

    // --- news.*: redesign-only, no old-dict equivalent ---
    'news.filter.filters': 'Filters',
    'news.backToAll': 'Back to all news',
    'news.shareArticle': 'Share this article',
    'news.seeFullCaseStudy': 'See the full case study',

    // --- careers.* / job.* (ported verbatim where wording is unchanged) ---
    'careers.title': 'Careers',
    'careers.job.about': 'About the role',
    'careers.job.apply': 'Apply for this position',
    'careers.form.upload': 'CV & cover letter',
    'careers.form.uploadBtn': 'Choose files',
    'careers.form.uploadHint': '.pdf, .doc, .docx — up to 4 files, 15MB total',
    'careers.form.send': 'Submit application',

    // --- careers.*: redesign-only, no old-dict equivalent, or old-dict key
    // exists under this prefix but with different wording (see report) ---
    'careers.openPositions': 'Open positions',
    'careers.speculativeCta': 'Think you belong here anyway? Write to us',
    'careers.meta.studio': 'Studio',
    'careers.meta.type': 'Type',
    'careers.job.readByHuman': 'Read by a human',
    'careers.form.aboutYou': 'About you',
    'careers.form.portfolioLinkedin': 'Portfolio / LinkedIn',

    // --- contact.* (ported verbatim: field labels whose current wording is
    // unchanged from the old dict) ---
    'contact.form.name': 'Name',
    'contact.form.email': 'Email',
    'contact.form.company': 'Company',
    'contact.form.budget': 'Budget',
    'contact.form.budgetPh': 'Range is fine',

    // --- contact.*: redesign-only, no old-dict equivalent, or old-dict key
    // exists under this prefix but with different wording (see report) ---
    'contact.form.messageLabel': 'Message',
    'contact.form.sendMessage': 'Send message',
    'contact.form.sendAMessage': 'Send a message',
    'contact.form.sendUsAMessage': 'Send us a message',
    'contact.form.to': 'To',

    // --- form.*: shared between the contact and careers-apply forms
    // (identical literal text in both scripts today); redesign-only ---
    'form.thankYou': "Thank you — we'll be in touch.",
    'form.error': 'Something went wrong — please try again.',

    // --- project.section.overview (ported verbatim); challenge/approach/
    // outcome are redesign-only (old dict only ever had "overview") ---
    'project.section.overview': 'Overview',
    'project.section.challenge': 'Challenge',
    'project.section.approach': 'Approach',
    'project.section.outcome': 'Outcome',

    // --- project.next (ported verbatim) ---
    'project.next': 'Next project',

    // --- project.*: redesign-only, no old-dict equivalent (the old site had
    // no gallery/story view toggle) ---
    'project.viewDetails': 'View project details',
    'project.viewGallery': 'View gallery',

    // --- footer.* (ported verbatim) ---
    'footer.cta.label': 'Have a project in mind?',
    'footer.cta.action': "Let's talk.",
    'footer.copy': '© 2026 MDMC Group Inc.',

    // --- footer.privacyTerms: redesign-only, no old-dict equivalent ---
    'footer.privacyTerms': 'Privacy & Terms',

    // --- notFound.*: new surface, not part of the old site at all ---
    'notFound.title': 'Page not found.',
    'notFound.body': "The page you're looking for doesn't exist or has moved.",
    'notFound.backHome': 'Back to home',
  },

  ja: {
    'nav.work': 'ワーク',
    'nav.about': '私たちについて',
    'nav.news': 'ニュース',
    'nav.contact': 'お問い合わせ',
    'nav.careers': '採用情報',

    'lang.label': '日本語',
    'lang.en': 'English',
    'lang.ja': '日本語',

    'home.manifesto.1': 'MDMCは、デザインとデジタル戦略を\n横断する統合エージェンシーです。',
    'home.manifesto.2': '優れたプロダクトを愛してくれる人々と\n結びつけ、誠実なビジネスがノイズの中で\n際立つお手伝いをしています。',

    'home.work.view': 'プロジェクトを見る',

    'work.title': 'ワーク',
    'work.region.Japan': '日本',
    'work.region.New Zealand': 'ニュージーランド',
    'work.region.Australia': 'オーストラリア',

    'news.title': 'ニュース',

    'careers.title': '採用情報',
    'careers.job.about': '仕事内容',
    'careers.job.apply': 'このポジションに応募する',
    'careers.form.upload': '履歴書・カバーレター',
    'careers.form.uploadBtn': 'ファイルを選択',
    'careers.form.uploadHint': '.pdf、.doc、.docx — 最大4ファイル、合計15MBまで',
    'careers.form.send': '応募を送信',

    'contact.form.name': 'お名前',
    'contact.form.email': 'メールアドレス',
    'contact.form.company': '会社名',
    'contact.form.budget': 'ご予算',
    'contact.form.budgetPh': 'レンジで結構です',

    'project.section.overview': '概要',
    'project.next': '次のプロジェクト',

    'footer.cta.label': 'ご検討中のプロジェクトはありますか?',
    'footer.cta.action': '話しましょう。',
    'footer.copy': '© 2026 MDMC Group Inc.',
  },
}

// Records every (locale, key) pair that fell back to the en dict, so report
// tooling can enumerate exactly what still needs a native JA pass. A Set of
// "locale:key" is enough for our two-locale setup; tMisses() reshapes it into
// { ja: [...] } (en never "falls back" to anything, so it never appears).
const missLog = new Set()

export function makeT(locale) {
  const dict = STRINGS[locale] || STRINGS.en
  return function t(key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key]
    if (Object.prototype.hasOwnProperty.call(STRINGS.en, key)) {
      // Actually served as EN — this is the case tMisses() reports.
      if (locale !== 'en') missLog.add(`${locale}:${key}`)
      return STRINGS.en[key]
    }
    return key
  }
}

export function tMisses() {
  const out = {}
  for (const entry of missLog) {
    const i = entry.indexOf(':')
    const locale = entry.slice(0, i)
    const key = entry.slice(i + 1)
    if (!out[locale]) out[locale] = []
    out[locale].push(key)
  }
  return out
}

// Content-field localization: picks a `.ja` overlay field (see
// normalize.js's mergeLocales/normalizeProjectJa) when one exists, falling
// back to the top-level (en) field otherwise — for en callers this is
// always a pass-through to `item[field]`, so it's safe to introduce ahead of
// any ja page actually consuming it (byte-stability unaffected).
export function pickLocalized(locale, item, field) {
  return locale === 'ja' ? (item.ja?.[field] ?? item[field]) : item[field]
}

// path always starts with '/'. '/ja' is never doubled onto an already-'/ja'
// path (localePath is meant to take an EN-shaped path in, not a ja one).
export function localePath(locale, path) {
  if (locale !== 'ja') return path
  return path === '/' ? '/ja/' : `/ja${path}`
}

export function counterpartPath(locale, path) {
  if (locale === 'ja') return path.slice(3) // '/ja' is always exactly 3 chars
  return localePath('ja', path)
}

export const ORIGINS = { en: 'https://mdmc.co', ja: 'https://mdmc.co.jp' }

// `path` is always the EN-shaped path ('/work/', '/'), regardless of
// fromLocale/toLocale — same convention as localePath/counterpartPath above.
export function linkHref(fromLocale, toLocale, path, origins = ORIGINS) {
  if (origins.ja == null) return localePath(toLocale, path)
  if (toLocale === 'ja') return origins.ja + path
  // toLocale === 'en'
  if (fromLocale === 'ja') return origins.en + path
  return path
}
