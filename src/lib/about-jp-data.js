// 会社概要 (fact table) and アクセス (access) data for the About JP page.
// NOT in Strapi — the `about-japan` single type only covers the ご挨拶
// greeting + signature (see normalizeAboutJapan in content.js). These two
// blocks were hardcoded i18n strings on the old site, so they're transcribed
// here verbatim from source, not invented.
//
// Sources:
// - git show main:src/i18n.jsx — jp.about.fact.* / jp.about.location.* keys
//   (lines ~198-223) hold the real copy.
// - git show main:src/pages.jsx — JpCompanySections() (lines ~440-503) shows
//   the real row order/labels used for both blocks: 商号, 事業部, 設立,
//   代表者, 資本金, 本社所在地, 業務内容 for facts; 所在地, 交通,
//   お問い合わせ for access. The old site's `.dc.html` prototype (lines
//   270-278, 287-298) uses different placeholder rows/labels for the mockup
//   only — this module follows the real old-site rows, not the prototype's
//   demo copy, per the task brief.
// - `dd`/`lines` are arrays: the old site rendered each value by splitting on
//   "\n" and joining with <br> (pages.jsx JpCompanySections), so several rows
//   are genuinely multi-line (商号, 設立, 本社所在地, 業務内容).
//
// Per-row provenance:
// - 商号 (company name): i18n.jsx jp.about.fact.shogo.v — real, unchanged.
// - 事業部 (division): i18n.jsx jp.about.fact.jigyobu.v — real, unchanged.
// - 設立 (founded): i18n.jsx jp.about.fact.setsuritsu.v — real, unchanged.
// - 代表者 (representative): i18n.jsx jp.about.fact.daihyo.v — real,
//   transcribed as-is. Note: this legacy hardcoded row says 代表取締役
//   ("Representative Director"), while the live Strapi `about-japan.
//   signature_role` (consumed directly on this page, not from this module)
//   says "CEO" — the two sources disagree on title; left as-is since this
//   module only transcribes the old site's company-fact copy verbatim.
// - 資本金 (capital): i18n.jsx jp.about.fact.shihon.v — real, unchanged.
// - 本社所在地 / 所在地 (HQ address): i18n.jsx jp.about.fact.jusho.v /
//   jp.about.location.address.v — transcribed VERBATIM, including
//   "KITANAKA BRICK&WHITE BRICK south ニサンカイ". Flagging, not
//   correcting: pages.jsx's English contact block and src/lib/studios.js's
//   JP addressLines both say "3F" for this building, while the old site's
//   JA copy says "ニサンカイ" — "ニサンカイ" may be the venue's own name
//   rather than a floor designation, but this is unconfirmed. The JA and EN
//   sources disagree and it isn't this module's place to guess which one is
//   right — left as the old site's exact JA string pending user
//   confirmation.
// - 業務内容 (services): i18n.jsx jp.about.fact.gyomu.v — real, unchanged.
// - 交通 (access/transit): i18n.jsx jp.about.location.access.v — real,
//   unchanged.
// - お問い合わせ (contact, access block): i18n.jsx
//   jp.about.location.contact.v = "team@mdmc.co" — real. Note this
//   intentionally differs from studios.js's JP footer email
//   (contact@mdmc.co); studios.js's own comment already documents that the
//   Yokohama office page specifically used team@mdmc.co while the footer
//   used contact@mdmc.co, so the two are expected to differ, not a
//   conflict to resolve.
//
// Nothing here is a genuine content gap — no placeholder copy needed.
export const ABOUT_JP = {
  facts: [
    {
      dt: '商号',
      dd: ['フィンレイソン ・ ホールディングス ・ ジャパン株式会社', 'Finlayson Holdings Japan Inc.'],
    },
    { dt: '事業部', dd: ['MDMC Japan事業部'] },
    { dt: '設立', dd: ['2016年8月（MDMC本体）', '2026年6月（MDMC Japan）'] },
    { dt: '代表者', dd: ['フィンレイソン・リアム（代表取締役）'] },
    { dt: '資本金', dd: ['500万円'] },
    {
      dt: '本社所在地',
      dd: ['〒231-0003', '神奈川県横浜市中区北仲通5丁目57-2', 'KITANAKA BRICK&WHITE BRICK south ニサンカイ'],
    },
    {
      dt: '業務内容',
      dd: [
        'ブランディング・アイデンティティ',
        'エクスペリエンス・サービスデザイン',
        'デジタルプロダクトデザイン',
        'ウェブデザイン・開発',
        '印刷物・制作物デザイン',
      ],
    },
  ],
  access: [
    {
      title: '所在地',
      lines: ['〒231-0003', '神奈川県横浜市中区北仲通5丁目57-2', 'KITANAKA BRICK&WHITE BRICK south ニサンカイ'],
    },
    {
      title: '交通',
      lines: [
        '横浜高速鉄道みなとみらい線 馬車道駅 4番出口より徒歩1分',
        'JR桜木町駅より徒歩10分',
        'JR関内駅より徒歩10分',
      ],
    },
    { title: 'お問い合わせ', lines: ['team@mdmc.co'] },
  ],
}
