import { useState, useEffect, useMemo } from 'react'
import { useT, useLocale, useSite, setSite, setLocale } from './i18n.jsx'
import mdmcLogo from './assets/mdmc-logo.png'

export function Header({ route, navigate, crumbs }) {
  const t = useT()
  const locale = useLocale()
  const site = useSite()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isHome = route === 'home'

  const NAV_ITEMS = [
    { id: 'work',    label: t('nav.work') },
    { id: 'about',   label: t('nav.about') },
    { id: 'contact', label: t('nav.contact') },
  ]

  return (
    <header className={`site-header${scrolled ? ' compact' : ''}${isHome ? ' home' : ' sub'}`}>
      {isHome ? (
        <a className="brand" onClick={(e) => { e.preventDefault(); navigate('home') }} href="#" aria-label="MDMC home">
          <img src={mdmcLogo} alt="MDMC" />
        </a>
      ) : (
        <div className="crumbs">
          {(crumbs || []).map((c, i) => (
            <>
              {c.href ? (
                <a key={`a-${i}`} className="crumb-faint" onClick={(e) => { e.preventDefault(); navigate(c.href) }} href="#">
                  {c.label}
                </a>
              ) : (
                <span key={`s-${i}`}>{c.label}</span>
              )}
              {i < crumbs.length - 1 && <span key={`sep-${i}`} className="crumb-sep">/</span>}
            </>
          ))}
        </div>
      )}

      {isHome ? (
        <nav className="nav" aria-label="Primary">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.id}
              href="#"
              className={route === n.id ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); navigate(n.id) }}
            >
              {n.label}
            </a>
          ))}
        </nav>
      ) : (
        <a className="brand brand-center" onClick={(e) => { e.preventDefault(); navigate('home') }} href="#" aria-label="MDMC home">
          <img src={mdmcLogo} alt="MDMC" />
        </a>
      )}

      <div className="header-controls">
        <div className="site-switch" role="group" aria-label="Site">
          <button
            type="button"
            className={`site-chip${site === 'global' ? ' selected' : ''}`}
            aria-pressed={site === 'global'}
            onClick={() => { if (site !== 'global') { setSite('global'); navigate('home') } }}
          >
            <span className="site-code">INT</span>
            Global
          </button>
          <button
            type="button"
            className={`site-chip${site === 'japan' ? ' selected' : ''}`}
            aria-pressed={site === 'japan'}
            onClick={() => { if (site !== 'japan') { setSite('japan'); navigate('home') } }}
          >
            <span className="site-code">JP</span>
            Japan
          </button>
        </div>
        <span className="header-divider" aria-hidden="true"></span>
        <div className="lang-switch" role="group" aria-label="Language">
          <button
            type="button"
            className={`lang-opt${locale === 'en' ? ' selected' : ''}`}
            aria-pressed={locale === 'en'}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
          <span className="lang-sep" aria-hidden="true">/</span>
          <button
            type="button"
            className={`lang-opt${locale === 'ja' ? ' selected' : ''}`}
            aria-pressed={locale === 'ja'}
            onClick={() => setLocale('ja')}
          >
            JA
          </button>
        </div>
      </div>
    </header>
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
  const site = useSite()
  const studios = [
    {
      city: 'Christchurch',
      addr: ['Level 2, 47 Salisbury St', 'Christchurch 8013'],
      tz: 'Pacific/Auckland',
      email: 'nz@mdmc.co',
    },
    {
      city: 'Sydney',
      addr: ['Level 5, 50 Holt St', 'Surry Hills NSW 2010'],
      tz: 'Australia/Sydney',
      email: 'au@mdmc.co',
    },
    {
      city: 'Yokohama',
      addr: ['5-57-2 Kitanakadori, Naka Ward', 'Yokohama 231-0003'],
      tz: 'Asia/Tokyo',
      email: 'team@mdmc.co',
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
        <span>© {year} MDMC Group Inc.</span>
        <div className="fv2-site-switch" role="group" aria-label="Site">
          <button
            type="button"
            className={`site-chip${site === 'global' ? ' selected' : ''}`}
            aria-pressed={site === 'global'}
            onClick={() => { if (site !== 'global') { setSite('global'); navigate('home'); window.scrollTo(0, 0) } }}
          >
            <span className="site-code">INT</span>
            Global
          </button>
          <button
            type="button"
            className={`site-chip${site === 'japan' ? ' selected' : ''}`}
            aria-pressed={site === 'japan'}
            onClick={() => { if (site !== 'japan') { setSite('japan'); navigate('home'); window.scrollTo(0, 0) } }}
          >
            <span className="site-code">JP</span>
            Japan
          </button>
        </div>
      </div>
    </footer>
  )
}

export function JpSuggestionPrompt() {
  const site = useSite()
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem('mdmc.jp-prompt-seen') === '1' } catch (e) {}
    if (dismissed) return
    if (site === 'japan') return
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
          日本語サイトをご覧になりますか?<br />
          <span className="jp-prompt-en">Looks like you're in Japan — switch to the MDMC Japan site?</span>
        </div>
        <div className="jp-prompt-actions">
          <button
            type="button"
            className="jp-prompt-go"
            onClick={() => { setSite('japan'); dismiss() }}
          >
            Go to MDMC Japan
          </button>
          <button type="button" className="jp-prompt-dismiss" onClick={dismiss}>
            Stay on Global
          </button>
        </div>
      </div>
    </div>
  )
}
