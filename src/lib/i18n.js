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
//
// 2026-08-20: every formerly-EN-only key now has a machine-drafted Japanese
// PLACEHOLDER (user-authorized, pending proper native review). Placeholder
// entries are grouped under the "PLACEHOLDER JA" banner in STRINGS.ja below —
// treat every value in that block as reviewable copy, not settled brand voice.

export const LOCALES = ['en', 'ja']

export const STRINGS = {
  en: {
    // --- nav.* (ported verbatim from main:src/i18n.jsx) ---
    'nav.work': 'Work',
    'nav.about': 'About',
    'nav.news': 'News',
    'nav.contact': 'Contact',
    'nav.careers': 'Careers',

    // --- nav.region / nav.language: redesign-only, no old-dict equivalent
    // (old site used a Global/Japan "site" model, not a Region picker). ---
    'nav.region': 'Region',
    'nav.language': 'Language',

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

    // --- contact.headline / contact.studio: redesign-only. headline uses \n
    // for the designed line break (same convention as home.manifesto.*);
    // studio is the visible "<Region> Studio" recipient word — display only,
    // the POSTed `recipient` payload value stays the EN string on every
    // locale (backend contract). ---
    'contact.headline': "Tell us what\nyou're working on.",
    'contact.studio': 'Studio',

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
    // Site-keyed (not language-keyed): mdmc.co.jp is operated by the JP
    // entity, so its footer credits it on both languages — same value in
    // both dicts, like footer.copy. (Old site keyed this on language;
    // the matrix model keys it on region/domain.)
    'footer.copyJp': '© 2026 Finlayson Holdings Japan Inc.',

    // --- footer.privacyTerms: redesign-only, no old-dict equivalent ---
    'footer.privacyTerms': 'Privacy & Terms',

    // --- notFound.*: new surface, not part of the old site at all ---
    'notFound.title': 'Page not found.',
    'notFound.body': "The page you're looking for doesn't exist or has moved.",
    'notFound.backHome': 'Back to home',

    // --- a11y.*: screen-reader strings (aria-label/alt), previously
    // hardcoded EN in components. {region}/{title} are interpolate() slots. ---
    'a11y.homeLink': 'MDMC home',
    'a11y.primaryNav': 'Primary',
    'a11y.toggleStudio': 'Toggle {region} studio details',
    'a11y.localTime': 'Local time in {region}',
    'a11y.openProject': 'Open {title}',
    'a11y.browseProjects': 'Browse featured projects',
    'a11y.prevSlide': 'Previous slide',
    'a11y.nextSlide': 'Next slide',
    'a11y.filterByType': 'Filter by type',
    'a11y.filterBySpecialty': 'Filter by specialty',
    'a11y.filterByRegion': 'Filter by region',
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
    'footer.copyJp': '© 2026 Finlayson Holdings Japan Inc.',

    // ------------------------------------------------------------------
    // PLACEHOLDER JA (2026-08-20) — machine-drafted from the EN values,
    // user-authorized as placeholders PENDING PROPER NATIVE REVIEW.
    // Nothing below is ported from the old dict; every value here is
    // reviewable copy. Register aims to match the ported keys above
    // (polite です/ます, katakana loans where the old dict used them).
    // ------------------------------------------------------------------
    'nav.region': '地域',
    'nav.language': '言語',

    'work.filter.region': '地域',
    'work.filter.specialty': '専門分野',

    'news.filter.filters': 'フィルター',
    'news.backToAll': 'ニュース一覧へ戻る',
    'news.shareArticle': 'この記事をシェアする',
    'news.seeFullCaseStudy': 'ケーススタディの全文を見る',

    'careers.openPositions': '募集中のポジション',
    'careers.speculativeCta': '募集がなくても、ここが自分の場所だと思う方はご連絡ください',
    'careers.meta.studio': 'スタジオ',
    'careers.meta.type': '雇用形態',
    'careers.job.readByHuman': '応募はすべて人が読みます',
    'careers.form.aboutYou': '自己紹介',
    'careers.form.portfolioLinkedin': 'ポートフォリオ / LinkedIn',

    'contact.headline': 'いま取り組んでいることを\nお聞かせください。',
    'contact.studio': 'スタジオ',
    'contact.form.messageLabel': 'メッセージ',
    'contact.form.sendMessage': 'メッセージを送信',
    'contact.form.sendAMessage': 'メッセージを送る',
    'contact.form.sendUsAMessage': 'メッセージを送る',
    'contact.form.to': '宛先',

    'form.thankYou': 'ありがとうございます。追ってご連絡いたします。',
    'form.error': 'エラーが発生しました。もう一度お試しください。',

    'project.section.challenge': '課題',
    'project.section.approach': 'アプローチ',
    'project.section.outcome': '成果',
    'project.viewDetails': 'プロジェクト詳細を見る',
    'project.viewGallery': 'ギャラリーを見る',

    'footer.privacyTerms': 'プライバシー・利用規約',

    'notFound.title': 'ページが見つかりません。',
    'notFound.body': 'お探しのページは存在しないか、移動した可能性があります。',
    'notFound.backHome': 'ホームへ戻る',

    'a11y.homeLink': 'MDMCホーム',
    'a11y.primaryNav': 'メインナビゲーション',
    'a11y.toggleStudio': '{region}スタジオの詳細を開閉',
    'a11y.localTime': '{region}の現地時間',
    'a11y.openProject': '{title}を開く',
    'a11y.browseProjects': '注目プロジェクトを見る',
    'a11y.prevSlide': '前のスライド',
    'a11y.nextSlide': '次のスライド',
    'a11y.filterByType': '種類で絞り込み',
    'a11y.filterBySpecialty': '専門分野で絞り込み',
    'a11y.filterByRegion': '地域で絞り込み',
    // ---------------------------- end PLACEHOLDER JA -------------------
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

// Fills {slot} tokens in a dict string: interpolate(t('a11y.localTime'),
// { region: '日本' }) → '日本の現地時間'. Slots without a matching var are
// left literal (visible in output = a bug you can see).
export function interpolate(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m,
  )
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

// ---------------------------------------------------------------------------
// Region × language link model (2026-08-21, see the language-region-matrix
// plan doc). Region picks the domain (site), language picks the copy; the
// two are independent, so links are built from a (site, lang) context.
// ---------------------------------------------------------------------------

export const SITES = { co: 'https://mdmc.co', cojp: 'https://mdmc.co.jp' }

// Path prefix of a (site, lang) tree ON ITS OWN PUBLIC SURFACE: what the
// visitor's URL bar shows in front of the EN-shaped path.
export function sitePrefix(site, lang) {
  if (site === 'cojp') return lang === 'en' ? '/en' : ''
  return lang === 'ja' ? '/ja' : ''
}

// Path prefix where the tree is BUILT at the origin (GitHub Pages). Differs
// from sitePrefix only for co.jp's Japanese tree, which the Worker serves at
// the co.jp root but is built under /jp.
export function originPrefix(site, lang) {
  if (site === 'cojp') return lang === 'en' ? '/en' : '/jp'
  return lang === 'ja' ? '/ja' : ''
}

function withPrefix(prefix, path) {
  if (!prefix) return path
  return path === '/' ? `${prefix}/` : `${prefix}${path}`
}

// Link builder for one rendering context. Every method takes the EN-shaped
// path ('/', '/work/…'). internal/toLang are same-domain relative; toSite is
// the only place cross-domain absolutes are ever built (region switches).
export function makeLinks(site, lang) {
  return {
    internal: (path) => withPrefix(sitePrefix(site, lang), path),
    toLang: (lang2, path) => withPrefix(sitePrefix(site, lang2), path),
    toSite: (site2, path, lang2 = lang) => SITES[site2] + withPrefix(sitePrefix(site2, lang2), path),
  }
}

// EN-shaped path of a page from its origin pathname + rendering context.
export function enPathOf(site, lang, pathname) {
  const prefix = originPrefix(site, lang)
  if (!prefix) return pathname
  const stripped = pathname.slice(prefix.length)
  return stripped === '' ? '/' : stripped
}
