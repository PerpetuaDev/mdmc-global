import { useState, useEffect, useMemo, useRef } from 'react'
import { useT, useLocale, setLocale } from './i18n.jsx'
import mdmcLogo from './assets/mdmc-logo.png'

// Language is the single locale axis (the old Global/Japan site split is
// gone): switching stays on the current page and re-renders in place.
export function LangSwitch({ className = 'site-switch' }) {
  const t = useT()
  const locale = useLocale()
  return (
    <div className={className} role="group" aria-label="Language">
      <button
        type="button"
        className={`site-chip${locale === 'en' ? ' selected' : ''}`}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('lang.en')}
      </button>
      <span className="lang-slash" aria-hidden="true">/</span>
      <button
        type="button"
        className={`site-chip${locale === 'ja' ? ' selected' : ''}`}
        aria-pressed={locale === 'ja'}
        onClick={() => setLocale('ja')}
      >
        {t('lang.ja')}
      </button>
    </div>
  )
}

// The dropdown mega panel: unfolds beneath the header (both the in-flow and
// pinned states — it anchors to the header's bottom edge in either). Contents
// follow the HOVERED nav item — Work lists recent projects, News the latest
// articles, About nests the studio pages (incl. Careers). Desktop-only; the
// mobile overlay menu covers small screens.
function MegaPanel({ section, navigate, navigateItem, projects, articles, onEnter, onLeave }) {
  const t = useT()
  const open = !!section
  // Keep rendering the last section while closed so the fade-out doesn't
  // empty the box mid-animation (and the measured height stays meaningful).
  const lastSectionRef = useRef(null)
  if (section) lastSectionRef.current = section
  const active = section ?? lastSectionRef.current

  // The panel's height follows its content: an inner wrapper is measured via
  // ResizeObserver and the outer box animates to it, so switching between a
  // long section (Work) and a short one (About) morphs instead of snapping —
  // and short menus don't inherit the tallest section's whitespace.
  const innerRef = useRef(null)
  const [panelH, setPanelH] = useState(null)
  useEffect(() => {
    const el = innerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  let label = ''
  let items = []
  let allLink = null
  if (active === 'work') {
    label = t('nav.work')
    items = projects.slice(0, 4).map((p) => ({ key: p.id, label: p.name, page: 'project', id: p.id }))
    allLink = { label: t('menu.allWork'), page: 'work' }
  } else if (active === 'news') {
    label = t('nav.news')
    items = articles.slice(0, 3).map((a) => ({ key: a.id, label: a.title, page: 'article', id: a.id }))
    allLink = { label: t('menu.allNews'), page: 'news' }
  } else if (active === 'about') {
    label = t('nav.about')
    items = [
      { key: 'about', label: t('nav.about'), page: 'about' },
      { key: 'careers', label: t('nav.careers'), page: 'careers' },
    ]
  }

  return (
    <div
      className={`mega-panel${open ? ' open' : ''}`}
      style={panelH != null ? { height: panelH } : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      aria-hidden={!open}
    >
      <div className="mp-inner" ref={innerRef}>
      <div className="mp-col">
        <div className="mp-head">
          <div className="mp-label">{label}</div>
          {allLink && (
            <a
              className="mp-all"
              href="#"
              tabIndex={open ? 0 : -1}
              onClick={(e) => { e.preventDefault(); navigate(allLink.page) }}
            >
              {allLink.label} <span className="arrow">→</span>
            </a>
          )}
        </div>
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              <a
                href="#"
                tabIndex={open ? 0 : -1}
                onClick={(e) => { e.preventDefault(); navigateItem(item.page, item.id ?? null) }}
              >
                {item.label}
              </a>
            </li>
          ))}
          {active === 'news' && items.length === 0 && (
            <li className="mp-muted">{t('menu.newsSoon')}</li>
          )}
        </ul>
      </div>

      </div>
    </div>
  )
}

export function Header({ route, navigate, projects = [], articles = [] }) {
  const t = useT()
  // Pentagram-style header choreography, three modes:
  //   top    — in normal flow at the top of the page; scrolls away naturally
  //   hidden — fixed but translated above the viewport (page reads chrome-free)
  //   pinned — fixed compact header slid in, on upward scroll intent
  const TOP_ZONE = 24      // within this of the top, hand back to the in-flow header
  const HEADER_CLEAR = 170 // scroll depth at which the in-flow header is fully off-screen
  const [header, setHeader] = useState(() =>
    typeof window === 'undefined' || window.scrollY <= HEADER_CLEAR
      ? { mode: 'top', snap: false }
      : { mode: 'hidden', snap: true })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = Math.max(0, window.scrollY)
      const dy = y - lastY
      if (Math.abs(dy) < 4) return // ignore momentum jitter
      lastY = y
      setHeader((prev) => {
        const { mode } = prev
        let next
        if (y <= TOP_ZONE) next = 'top'
        else if (dy < 0) {
          // Reversing while the in-flow header is still partially on screen
          // continues the natural reveal; from deeper, slide the pinned one in.
          next = mode === 'top' && y <= HEADER_CLEAR ? 'top' : 'pinned'
        } else {
          // Scrolling down: let the in-flow header roll off naturally first,
          // then go (or stay) hidden; a pinned header slides back out.
          next = mode === 'top' && y <= HEADER_CLEAR ? 'top' : 'hidden'
        }
        if (next === mode) return prev
        // snap: entering hidden straight from the in-flow header must park the
        // floating header above the viewport with NO transition — otherwise it
        // visibly slides away as a phantom "second header". It animates only
        // once the first upward scroll pins it in.
        return { mode: next, snap: mode === 'top' && next === 'hidden' }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [route])

  // Mega panel: unfolds under the header on nav hover with per-item contents
  // (work/about/news; contact has no panel); closes on route change, Escape,
  // or mouse-out.
  const PANEL_SECTIONS = ['work', 'about', 'news']
  const [panelSection, setPanelSection] = useState(null)

  // Scroll is locked while either overlay is open — for the mega panel this
  // also means the header can never scroll-hide out from under it.
  useEffect(() => {
    document.body.style.overflow = (menuOpen || panelSection) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, panelSection])
  const panelTimer = useRef(null)
  const openPanel = (id) => {
    clearTimeout(panelTimer.current)
    setPanelSection(PANEL_SECTIONS.includes(id) ? id : null)
  }
  const holdPanel = () => clearTimeout(panelTimer.current)
  const scheduleClosePanel = () => {
    clearTimeout(panelTimer.current)
    panelTimer.current = setTimeout(() => setPanelSection(null), 220)
  }
  useEffect(() => { setPanelSection(null) }, [route])
  useEffect(() => { if (header.mode === 'hidden') setPanelSection(null) }, [header.mode])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setPanelSection(null) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(panelTimer.current) }
  }, [])

  const isHome = route === 'home'

  const NAV_ITEMS = [
    { id: 'work',    label: t('nav.work') },
    { id: 'about',   label: t('nav.about') },
    // News appears in the nav automatically once the first article publishes.
    ...(articles.length > 0 ? [{ id: 'news', label: t('nav.news') }] : []),
    { id: 'contact', label: t('nav.contact') },
  ]

  const handleNav = (id) => { setMenuOpen(false); navigate(id) }

  // The mobile menu's close button lives in the header — never hide it while open.
  const mode = menuOpen && header.mode === 'hidden' ? 'pinned' : header.mode

  return (
    <>
      {mode !== 'top' && <div className="header-spacer" aria-hidden="true" />}
      <header
        className={`site-header${mode !== 'top' ? ' floating' : ''}${mode === 'pinned' ? ' pinned' : ''}${mode === 'hidden' && header.snap ? ' no-anim' : ''}`}
        onMouseLeave={scheduleClosePanel}
      >
        <a className="brand" onClick={(e) => { e.preventDefault(); handleNav('home') }} href="#" aria-label="MDMC home">
          <img src={mdmcLogo} alt="MDMC" />
        </a>

        <nav className="nav" aria-label="Primary">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.id}
              href="#"
              className={route === n.id ? 'active' : ''}
              onMouseEnter={() => openPanel(n.id)}
              onClick={(e) => { e.preventDefault(); handleNav(n.id) }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="header-controls">
          <LangSwitch />
          <button
            className={`hamburger-btn${menuOpen ? ' is-open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>

        <MegaPanel
          section={panelSection}
          navigate={handleNav}
          navigateItem={(page, id) => { setPanelSection(null); navigate(page, id) }}
          projects={projects}
          articles={articles}
          onEnter={holdPanel}
          onLeave={scheduleClosePanel}
        />
      </header>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-label="Site navigation">
          <nav className="mobile-nav">
            {[...NAV_ITEMS, { id: 'careers', label: t('nav.careers') }].map((n) => (
              <a key={n.id} href="#" onClick={(e) => { e.preventDefault(); handleNav(n.id) }}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mobile-menu-footer">
            <LangSwitch />
          </div>
        </div>
      )}
    </>
  )
}

function StudioClock({ tz }) {
  const [now, setNow] = useState(() => new Date())
  const [colonOn, setColonOn] = useState(true)
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date())
      setColonOn((c) => !c)
    }, 1000)
    return () => clearInterval(tick)
  }, [])
  const fmt = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }), [tz])
  const parts = fmt.formatToParts(now)
  const h = parts.find((p) => p.type === 'hour')?.value || '--'
  const m = parts.find((p) => p.type === 'minute')?.value || '--'
  return (
    <span className="studio-clock" aria-label={`Local time ${h}:${m}`}>
      <span className="t-h">{h}</span>
      <span className={`t-colon${colonOn ? ' on' : ''}`}>:</span>
      <span className="t-m">{m}</span>
    </span>
  )
}

export function Footer({ navigate }) {
  const t = useT()
  const locale = useLocale()
  const isJapan = locale === 'ja'
  const studios = [
    {
      city: t('footer.studio.nz'),
      addr: ['Level 2, 47 Salisbury St', 'Christchurch 8013'],
      tz: 'Pacific/Auckland',
      email: 'nz@mdmc.co',
    },
    {
      city: t('footer.studio.au'),
      addr: ['100 Arthur Street, Level 10', 'North Sydney NSW 2060'],
      tz: 'Australia/Sydney',
      email: 'au@mdmc.co',
    },
    {
      city: t('footer.studio.jp'),
      addr: isJapan
        ? ['〒231-0003 神奈川県横浜市', '中区北仲通5丁目57-2', 'KITANAKA BRICK&WHITE BRICK south 3F']
        : ['5-57-2 Kitanakadori, Naka Ward', 'Yokohama, Kanagawa 231-0003'],
      tz: 'Asia/Tokyo',
      email: 'contact@mdmc.co',
    },
  ]
  const year = new Date().getFullYear()

  return (
    <footer className="footer-v2 editorial">
      <div className="fv2e-top">
        <div className="fv2e-cta">
          <div className="fv2-label">{t('footer.cta.label')}</div>
          <a
            className="fv2e-bigcta"
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('contact') }}
          >
            {t('footer.cta.action')} <span className="arrow">→</span>
          </a>
        </div>
      </div>

      <div className="fv2e-studios">
        {studios.map((s) => (
          <div className="studio-card" key={s.city}>
            <div className="studio-head">
              <div className="fv2-label">{s.city}</div>
              <StudioClock tz={s.tz} />
            </div>
            <div className="studio-addr">
              {s.addr.map((line, i) => (
                <span key={i}>
                  {line}{i < s.addr.length - 1 && <br />}
                </span>
              ))}
            </div>
            <a className="studio-email" href={`mailto:${s.email}`}>{s.email}</a>
          </div>
        ))}
      </div>

      <div className="fv2-bottom">
        <span>© {year} {isJapan ? 'Finlayson Holdings Japan Inc.' : 'MDMC Group Inc.'}</span>
        <LangSwitch className="fv2-site-switch" />
      </div>
    </footer>
  )
}

export function JpSuggestionPrompt() {
  const locale = useLocale()
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem('mdmc.jp-prompt-seen') === '1' } catch (e) {}
    if (dismissed) return
    if (locale === 'ja') return
    const lang = (navigator.language || '').toLowerCase()
    const langs = (navigator.languages || []).map((l) => l.toLowerCase())
    const isJa = lang.startsWith('ja') || langs.some((l) => l.startsWith('ja'))
    if (isJa) setShow(true)
  }, [])
  const dismiss = () => {
    try { localStorage.setItem('mdmc.jp-prompt-seen', '1') } catch (e) {}
    setShow(false)
  }
  if (!show) return null
  return (
    <div className="jp-prompt" role="dialog" aria-label="Region suggestion">
      <div className="jp-prompt-inner">
        <div className="jp-prompt-eyebrow">JP · Japan</div>
        <div className="jp-prompt-body">
          日本語で表示しますか?<br />
          <span className="jp-prompt-en">Looks like you read Japanese — view this site in Japanese?</span>
        </div>
        <div className="jp-prompt-actions">
          <button
            type="button"
            className="jp-prompt-go"
            onClick={() => { setLocale('ja'); dismiss() }}
          >
            日本語で表示
          </button>
          <button type="button" className="jp-prompt-dismiss" onClick={dismiss}>
            Continue in English
          </button>
        </div>
      </div>
    </div>
  )
}
