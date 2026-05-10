import { useState, useEffect, useCallback } from 'react'

const STRINGS = {
  en: {
    "nav.work": "Work",
    "nav.about": "About",
    "nav.contact": "Contact",
    "lang.label": "English",
    "lang.en": "English",
    "lang.ja": "日本語",

    "title.suffix": "An integrated design & digital strategy agency",

    "home.manifesto.1": "We're MDMC—an integrated design &\ndigital strategy agency.",
    "home.manifesto.2": "We help great products find the people\nwho'll love them, and help good, honest\nbusinesses stand out from the noise.",
    "home.manifesto.3": "The result? Your customers trust you,\nstay with you, and bring others with them.",

    "home.hero.placeholder": "{name} — HERO IMAGE",
    "home.hero.dotLabel": "Show slide {n}",
    "home.work.placeholder": "{name} — IMAGE",
    "home.work.view": "View project",

    "work.title": "Work",

    "about.headline": "A small studio for the long, useful work.",
    "about.lede.1": "MDMC is a small team split across Christchurch, Sydney, and Yokohama. We work with founders, operators, and in-house teams on the design problems that don't fit neatly into a brief — the ones that touch product, brand, and operations at the same time.",
    "about.lede.2": "We've been at it since 2017. We've never run a Series A, never franchised, never opened a third office. Most of our work comes from clients who've worked with us before.",

    "about.kv.what.dt": "What we do",
    "about.kv.what.dd": "Brand identity, product design, editorial websites, packaging, and the occasional wayfinding system. We do it end-to-end — research, concept, design, and a launch we stay in the room for.",
    "about.kv.how.dt": "How we work",
    "about.kv.how.dd": "Two-week loops, one project per team at a time, no account managers between us and the people building the work. We write fewer decks than we used to. We ship more.",
    "about.kv.who.dt": "Who we work with",
    "about.kv.who.dd": "Healthcare, finance, food, and the regulated middle of the economy. Mostly companies between Series A and Series C, plus the public-sector teams that have to design services real people depend on.",
    "about.kv.dont.dt": "What we don't do",
    "about.kv.dont.dd": "Spec work, RFPs over twenty pages, projects without a named decision-maker, anything in crypto, and any campaign whose primary metric is impressions.",

    "about.team.title": "The team",
    "about.team.portrait": "PORTRAIT",

    "contact.headline": "Tell us what you're working on.",
    "contact.label.newWork": "New work",
    "contact.label.careers": "Careers",
    "contact.label.christchurch": "Christchurch",
    "contact.label.sydney": "North Sydney",
    "contact.label.yokohama": "Yokohama",

    "contact.form.name": "Name",
    "contact.form.email": "Email",
    "contact.form.company": "Company",
    "contact.form.budget": "Budget",
    "contact.form.budgetPh": "Range is fine",
    "contact.form.message": "What are you working on?",
    "contact.form.send": "Send",
    "contact.form.gotIt": "Got it.",
    "contact.form.thanks": "Thanks, {name}. A partner will read this within a working day and get back to you personally — not a form reply.",
    "contact.form.error": "Something went wrong — please try again or email us directly.",

    "crumb.home": "Home",
    "crumb.work": "Work",
    "crumb.about": "About",
    "crumb.contact": "Contact",

    "project.section.overview": "Overview",
    "project.detail.full": "DETAIL — FULL BLEED",
    "project.detail.02": "DETAIL 02",
    "project.detail.03": "DETAIL 03",
    "project.detail.case": "CASE — IN SITU",
    "project.key": "{name} — KEY IMAGE",
    "project.next": "Next project",
    "project.meta.client": "Client",
    "project.meta.year": "Year",
    "project.meta.sector": "Sector",
    "project.meta.region": "Region",
    "project.meta.services": "Services",

    "footer.studio.nz": "New Zealand",
    "footer.studio.au": "Australia",
    "footer.studio.jp": "Japan",
    "footer.site.global": "Global",
    "footer.site.japan": "Japan",

    "footer.cta.label": "Have a project in mind?",
    "footer.cta.action": "Let's talk.",
    "footer.studios": "Studios",
    "footer.inquiries": "Inquiries",
    "footer.index": "Index",
    "footer.follow": "Follow",
    "footer.copy": "© 2026 MDMC Group Inc.",

  },

  ja: {
    "nav.work": "ワーク",
    "nav.about": "私たちについて",
    "nav.contact": "お問い合わせ",
    "lang.label": "日本語",
    "lang.en": "English",
    "lang.ja": "日本語",

    "title.suffix": "デザイン & デジタル戦略の統合エージェンシー",

    "home.manifesto.1": "MDMCは、デザインとデジタル戦略を\n横断する統合エージェンシーです。",
    "home.manifesto.2": "優れたプロダクトを愛してくれる人々と\n結びつけ、誠実なビジネスがノイズの中で\n際立つお手伝いをしています。",
    "home.manifesto.3": "結果として、お客様はあなたを信頼し、\n長く付き合い、新たな仲間を連れてきてくれます。",

    "home.hero.placeholder": "{name} — ヒーローイメージ",
    "home.hero.dotLabel": "スライド{n}を表示",
    "home.work.placeholder": "{name} — イメージ",
    "home.work.view": "プロジェクトを見る",

    "work.title": "ワーク",

    "about.headline": "長く、実りある仕事のための小さなスタジオ。",
    "about.lede.1": "MDMCはクライストチャーチ、シドニー、横浜にまたがる小さなチームです。創業者、現場の運営者、社内チームと共に、ひとつのブリーフに収まらないデザイン課題——プロダクト、ブランド、オペレーションが同時に絡む問題——に取り組んでいます。",
    "about.lede.2": "活動は2017年から。シリーズAの調達も、フランチャイズも、3つ目のオフィスもありません。仕事の大半は、過去にご一緒したクライアントからの再依頼です。",

    "about.kv.what.dt": "私たちがすること",
    "about.kv.what.dd": "ブランドアイデンティティ、プロダクトデザイン、エディトリアルなウェブサイト、パッケージ、ときにサインシステム。リサーチ、コンセプト、デザイン、そしてローンチまで——ずっと現場に留まります。",
    "about.kv.how.dt": "私たちの働き方",
    "about.kv.how.dd": "2週間のループ、1チーム1プロジェクトずつ、間にアカウントマネージャーを挟みません。デッキを書く時間は減り、リリースする回数は増えました。",
    "about.kv.who.dt": "ご一緒する相手",
    "about.kv.who.dd": "ヘルスケア、ファイナンス、食、そして規制のある中間領域。多くはシリーズA〜Cの企業、加えて生活者が頼るサービスを設計する公共機関のチーム。",
    "about.kv.dont.dt": "私たちがしないこと",
    "about.kv.dont.dd": "スペックワーク、20ページを超えるRFP、意思決定者の名前がないプロジェクト、暗号資産関連、そしてインプレッション数を主指標にするキャンペーン。",

    "about.team.title": "チーム",
    "about.team.portrait": "ポートレート",

    "jp.about.greeting.title": "「長く、誠実に。」その姿勢で、皆さまと向き合います。",
    "jp.about.greeting.p1": "このたびは、MDMC横浜のページをご覧いただき、誠にありがとうございます。私たちは2017年の創業以来、ブランディング、プロダクトデザイン、ウェブサイトといった領域で、企業や行政の皆さまと共に歩んでまいりました。",
    "jp.about.greeting.p2": "横浜オフィスでは、日本国内のお客さまに寄り添い、現場に足を運び、丁寧に課題を読み解くことを何よりも大切にしております。海外3拠点との連携により、グローバルな視点と、日本のものづくりが培ってきた緻密さの両方をご提供できることを強みとしています。",
    "jp.about.greeting.p3": "デザインは、企業の姿勢を映す鏡だと考えております。短期的な見栄えではなく、十年後も価値の続く仕事を、皆さまと一緒に育ててまいりたく存じます。何卒よろしくお願い申し上げます。",
    "jp.about.signature.role": "MDMC Japan 代表取締役",
    "jp.about.signature.name": "リアム・フィンレイソン",
    "jp.about.signature.romaji": "Liam Finlayson",

    "jp.about.eyebrow.overview": "会社概要",
    "jp.about.overview.title": "会社概要",
    "jp.about.fact.shogo": "商号",
    "jp.about.fact.shogo.v": "フィンレイソン ・ ホールディングス ・ ジャパン株式会社\nFinlayson Holdings Japan Inc.",
    "jp.about.fact.setsuritsu": "設立",
    "jp.about.fact.setsuritsu.v": "2016年8月（MDMC本体）\n2026年6月（MDMC Japan）",
    "jp.about.fact.daihyo": "代表者",
    "jp.about.fact.daihyo.v": "フィンレイソン・リアム（代表取締役）",
    "jp.about.fact.shihon": "資本金",
    "jp.about.fact.shihon.v": "500万円",
    "jp.about.fact.jusho": "本社所在地",
    "jp.about.fact.jusho.v": "〒231-0003\n神奈川県横浜市中区北仲通5丁目57-2\nKITANAKA BRICK&WHITE BRICK south ニサンカイ",
    "jp.about.fact.gyomu": "業務内容",
    "jp.about.fact.gyomu.v": "ブランディング・アイデンティティ\nエクスペリエンス・サービスデザイン\nデジタルプロダクトデザイン\nウェブデザイン・開発\n印刷物・制作物デザイン",
    "jp.about.fact.jigyobu": "事業部",
    "jp.about.fact.jigyobu.v": "MDMC Japan事業部",

    "jp.about.eyebrow.location": "アクセス",
    "jp.about.location.title": "横浜オフィス",
    "jp.about.location.address": "所在地",
    "jp.about.location.address.v": "〒231-0003\n神奈川県横浜市中区北仲通5丁目57-2\nKITANAKA BRICK&WHITE BRICK south ニサンカイ",
    "jp.about.location.access": "交通",
    "jp.about.location.access.v": "横浜高速鉄道みなとみらい線 馬車道駅 4番出口より徒歩1分\nJR桜木町駅より徒歩10分\nJR関内駅より徒歩10分",
    "jp.about.location.contact": "お問い合わせ",
    "jp.about.location.contact.v": "team@mdmc.co",
    "jp.about.location.directions": "Google マップで開く",

    "contact.headline": "取り組まれていることを聞かせてください。",
    "contact.label.newWork": "新規ご相談",
    "contact.label.careers": "採用情報",
    "contact.label.christchurch": "クライストチャーチ",
    "contact.label.sydney": "ノースシドニー",
    "contact.label.yokohama": "横浜",

    "contact.form.name": "お名前",
    "contact.form.email": "メールアドレス",
    "contact.form.company": "会社名",
    "contact.form.budget": "ご予算",
    "contact.form.budgetPh": "レンジで結構です",
    "contact.form.message": "どんなことに取り組まれていますか?",
    "contact.form.send": "送信",
    "contact.form.gotIt": "受け取りました。",
    "contact.form.thanks": "{name}様、ありがとうございます。営業日中にパートナーが直接拝読し、定型文ではないご返信を差し上げます。",
    "contact.form.error": "送信中にエラーが発生しました。もう一度お試しいただくか、直接メールでお問い合わせください。",

    "crumb.home": "ホーム",
    "crumb.work": "ワーク",
    "crumb.about": "私たちについて",
    "crumb.contact": "お問い合わせ",

    "project.section.overview": "概要",
    "project.detail.full": "ディテール — フルブリード",
    "project.detail.02": "ディテール 02",
    "project.detail.03": "ディテール 03",
    "project.detail.case": "ケース — 設置事例",
    "project.key": "{name} — キーイメージ",
    "project.next": "次のプロジェクト",
    "project.meta.client": "クライアント",
    "project.meta.year": "年",
    "project.meta.sector": "セクター",
    "project.meta.region": "地域",
    "project.meta.services": "サービス",

    "footer.studio.nz": "ニュージーランド",
    "footer.studio.au": "オーストラリア",
    "footer.studio.jp": "日本",
    "footer.site.global": "グローバル",
    "footer.site.japan": "日本",

    "footer.cta.label": "ご検討中のプロジェクトはありますか?",
    "footer.cta.action": "話しましょう。",
    "footer.studios": "スタジオ",
    "footer.inquiries": "お問い合わせ",
    "footer.index": "目次",
    "footer.follow": "フォロー",
    "footer.copy": "© 2026 MDMC Group Inc.",
  },
}

const LOCALE_KEY = 'mdmc.locale'
const LOCALE_EVENT = 'mdmc:locale-change'

export function getLocale() {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    if (v === 'en' || v === 'ja') return v
  } catch (e) {}
  return 'en'
}

export function setLocale(loc) {
  try { localStorage.setItem(LOCALE_KEY, loc) } catch (e) {}
  document.documentElement.lang = loc
  document.documentElement.setAttribute('data-locale', loc)
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: loc }))
}

export function useLocale() {
  const [loc, setLoc] = useState(getLocale)
  useEffect(() => {
    const handler = (e) => setLoc(e.detail)
    window.addEventListener(LOCALE_EVENT, handler)
    document.documentElement.lang = loc
    document.documentElement.setAttribute('data-locale', loc)
    return () => window.removeEventListener(LOCALE_EVENT, handler)
  }, [])
  return loc
}

export function useT() {
  const loc = useLocale()
  return useCallback((key, vars) => {
    const dict = STRINGS[loc] || STRINGS.en
    let s = dict[key]
    if (s == null) s = STRINGS.en[key] != null ? STRINGS.en[key] : key
    if (vars) {
      for (const k in vars) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k])
      }
    }
    return s
  }, [loc])
}

export function NL({ text }) {
  const parts = String(text).split('\n')
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <br />}
    </span>
  ))
}

const SITE_KEY = 'mdmc.site'
const SITE_EVENT = 'mdmc:site-change'

export function getSite() {
  try {
    const v = localStorage.getItem(SITE_KEY)
    if (v === 'global' || v === 'japan') return v
  } catch (e) {}
  return 'global'
}

export function setSite(site) {
  try { localStorage.setItem(SITE_KEY, site) } catch (e) {}
  document.documentElement.setAttribute('data-site', site)
  window.dispatchEvent(new CustomEvent(SITE_EVENT, { detail: site }))
  setLocale(site === 'japan' ? 'ja' : 'en')
}

export function useSite() {
  const [site, set] = useState(getSite)
  useEffect(() => {
    const handler = (e) => set(e.detail)
    window.addEventListener(SITE_EVENT, handler)
    document.documentElement.setAttribute('data-site', site)
    return () => window.removeEventListener(SITE_EVENT, handler)
  }, [])
  return site
}
