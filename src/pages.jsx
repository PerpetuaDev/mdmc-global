import { useState, useEffect, useRef } from 'react'
import { useT, useLocale, NL } from './i18n.jsx'
import { submitContact, submitApplication } from './strapi.js'
import { Turnstile } from './turnstile.jsx'

// Image that fades in once decoded, so the colored gradient backdrop transitions
// smoothly into the photo instead of popping. Handles cached images (which may
// not fire onLoad) by checking .complete on mount.
function FadeImg({ className = '', ...rest }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (ref.current?.complete) setLoaded(true) }, [])
  return (
    <img
      ref={ref}
      className={`img-fade${loaded ? ' is-loaded' : ''}${className ? ' ' + className : ''}`}
      onLoad={() => setLoaded(true)}
      {...rest}
    />
  )
}

// Flips true when the element scrolls into view. Drives .scroll-reveal /
// .fade-block entrances for below-the-fold content — unlike .reveal, which
// plays on mount and has long finished by the time the user scrolls down.
// Default is one-shot (stays true); pass { once: false } to also flip back
// off when the element leaves view (two-way fades). rootMargin shifts the
// trigger line, e.g. '0px 0px -12% 0px' fires once the element has cleared
// the bottom 12% of the viewport.
function useInView(threshold = 0.3, { once = true, rootMargin = '0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        if (once) io.disconnect()
      } else if (!once) {
        setInView(false)
      }
    }, { threshold, rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, once, rootMargin])
  return [ref, inView]
}

// Loading-state placeholder matching the work-card layout exactly, so swapping it
// for the real card causes zero layout shift.
function SkeletonWorkCard({ revealDelay = 0 }) {
  return (
    <div className="work-card is-skeleton reveal" aria-hidden="true" style={{ '--reveal-delay': `${revealDelay}ms` }}>
      <div className="work-thumb skeleton" />
      <div className="sk-line sk-line--title skeleton" />
      <div className="sk-line skeleton" />
      <div className="sk-line sk-line--short skeleton" />
    </div>
  )
}

function SkeletonWorkGrid({ count = 6 }) {
  return Array.from({ length: count }, (_, i) => (
    <SkeletonWorkCard key={i} revealDelay={i * 70} />
  ))
}

export function HomePage({ navigate, projects = [], loading = false, homepage = null }) {
  const t = useT()
  const featured = projects.slice(0, 4)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [featured.length])

  // Depends on idx so any manual arrow navigation restarts the full 5.5s
  // dwell instead of the pending auto-advance firing right after a click.
  useEffect(() => {
    if (featured.length <= 1) return
    const tm = setInterval(() => setIdx((i) => (i + 1) % featured.length), 5500)
    return () => clearInterval(tm)
  }, [featured.length, idx])

  // Only download hero images as they're needed: the visible slide, the next one
  // (so the crossfade is ready), and any already shown. Avoids pulling all four
  // full-res originals on first paint.
  const [seen, setSeen] = useState(() => new Set([0]))
  useEffect(() => {
    setSeen((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)))
  }, [idx])
  const nextIdx = featured.length ? (idx + 1) % featured.length : 0
  const shouldLoad = (i) => i === idx || i === nextIdx || seen.has(i)

  const current = featured[idx] ?? {}
  const goPrev = () => setIdx((i) => (i - 1 + featured.length) % featured.length)
  const goNext = () => setIdx((i) => (i + 1) % featured.length)
  const [manifestoRef, manifestoInView] = useInView()

  return (
    <main className="page">
      <section className="hero">
        {loading ? (
          <div key="hero-skel" className="hero-frame skeleton reveal" aria-hidden="true" />
        ) : (
        <div key="hero-real" className="hero-frame reveal">
          {featured.map((p, i) => (
            <div
              key={p.id}
              className={`hero-slide ${p.cls} ${i === idx ? 'active' : ''}${p.darkHero ? ' dark' : ''}`}
              onClick={() => navigate('project', p.id)}
              role="button"
              tabIndex={i === idx ? 0 : -1}
              aria-label={`Open ${p.name}`}
            >
              {p.heroImage
                ? (shouldLoad(i) && <FadeImg src={p.heroImage} alt={p.name} fetchPriority={i === idx ? 'high' : 'auto'} />)
                : <span className="ph-label">{t('home.hero.placeholder', { name: p.name.toUpperCase() })}</span>
              }
            </div>
          ))}
          {featured.length > 0 && (
            <div className={`hero-foot${current.darkHero ? ' on-dark' : ''}`}>
              <a
                className="name"
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('project', current.id) }}
              >
                {current.name}
              </a>
              <div className="np-nav" role="group" aria-label="Browse featured projects">
                <button type="button" className="np-arrow" onClick={goPrev} aria-label="Previous slide">←</button>
                <span className="np-nav-rule" aria-hidden="true"></span>
                <button type="button" className="np-arrow" onClick={goNext} aria-label="Next slide">→</button>
              </div>
            </div>
          )}
        </div>
        )}
      </section>

      <section className="manifesto" ref={manifestoRef}>
        <div className={manifestoInView ? 'is-inview' : ''}>
          {(homepage?.manifesto?.length > 0
            ? homepage.manifesto
            : [t('home.manifesto.1'), t('home.manifesto.2'), t('home.manifesto.3')]
          ).map((para, i) => (
            <p key={i} className="scroll-reveal" style={{ '--sr-delay': `${i * 150}ms` }}>
              <NL text={para} />
            </p>
          ))}
        </div>
      </section>

      <section className="work-section">
        <div className="work-grid">
          {loading
            ? <SkeletonWorkGrid count={6} />
            : projects.slice(0, 6).map((p, i) => (
                <WorkCard key={p.id} project={p} navigate={navigate} revealDelay={200 + i * 70} />
              ))}
        </div>
      </section>
    </main>
  )
}

export function WorkCard({ project, navigate, revealDelay = 0 }) {
  const t = useT()
  return (
    <a
      href="#"
      className="work-card reveal"
      style={{ '--reveal-delay': `${revealDelay}ms` }}
      onClick={(e) => { e.preventDefault(); navigate('project', project.id) }}
    >
      <div className={`work-thumb ${project.cls}`}>
        {project.thumbnail
          ? <FadeImg src={project.thumbnail} alt={project.name} loading="lazy" />
          : <span className="ph-label">{t('home.work.placeholder', { name: project.name.toUpperCase() })}</span>
        }
      </div>
      <h3>{project.name}</h3>
      <p className="desc">{project.desc}</p>
      <span className="view">
        {t('home.work.view')} <span className="arrow">→</span>
      </span>
    </a>
  )
}

// Split multi-region values ("New Zealand, Australia") into individual tags.
const projectRegions = (p) =>
  String(p.region || '').split(',').map((s) => s.trim()).filter(Boolean)

export function WorkPage({ navigate, projects = [], loading = false }) {
  const t = useT()
  const [region, setRegion] = useState(null)
  const regions = [...new Set(projects.flatMap(projectRegions))]
  const shown = region ? projects.filter((p) => projectRegions(p).includes(region)) : projects

  return (
    <main className="page">
      <section className="work-section with-top">
        <div className="work-head">
          <h2 className="section-title reveal">{t('work.title')}</h2>
          {regions.length > 1 && (
            <div className="work-filter reveal" role="group" aria-label="Filter by region" style={{ '--reveal-delay': '60ms' }}>
              <button
                type="button"
                className={`filter-chip${region === null ? ' selected' : ''}`}
                onClick={() => setRegion(null)}
              >
                {t('work.filter.all')}
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`filter-chip${region === r ? ' selected' : ''}`}
                  onClick={() => setRegion(r)}
                >
                  {t(`work.region.${r}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="work-grid">
          {loading
            ? <SkeletonWorkGrid count={6} />
            : shown.map((p, i) => (
                <WorkCard key={p.id} project={p} navigate={navigate} revealDelay={80 + i * 70} />
              ))}
        </div>
      </section>
    </main>
  )
}

// Two distinct About compositions, selected by language (not by the old
// Global/Japan site split): Japanese readers get the corporate format they
// expect — representative's greeting, 会社概要 company profile, office access —
// while English readers get the studio essay and team. Neither mixes into
// the other.
export function AboutPage({ members = [], about = null, aboutJa = null }) {
  const locale = useLocale()
  if (locale === 'ja') return <AboutBodyJa about={aboutJa} />
  return <AboutBody members={members} about={about} />
}

function AboutBodyJa({ about = null }) {
  const t = useT()
  return (
    <main className="page jp-about">
      <section className="about-hero-image">
        <div className="ah-image reveal" aria-hidden={!about?.hero_image}>
          {about?.hero_image
            ? <img src={about.hero_image} alt="" />
            : <span className="ph-label">{t('project.detail.full')}</span>
          }
        </div>
      </section>
      <JpGreetingSection about={about} />
      <JpCompanySections />
    </main>
  )
}

const STATIC_TEAM = [
  { id: 'liam',    name: 'Liam Finlayson',   role: 'CEO',                              portrait: null },
  { id: 'mitch',   name: 'Mitchell McMaugh',  role: 'Full-stack Developer',             portrait: null },
  { id: 'monique', name: 'Monique Park',       role: 'Graphic Designer & Illustrator',  portrait: null },
]

const FALLBACK_KV = [
  { key: 'what', title: null, body: null, image: null },
  { key: 'how',  title: null, body: null, image: null },
  { key: 'who',  title: null, body: null, image: null },
  { key: 'dont', title: null, body: null, image: null },
]

function AboutBody({ members = [], about = null }) {
  const t = useT()
  const team = members.length > 0 ? members : STATIC_TEAM
  const heroImage = about?.hero_image ?? null

  const ledeParagraphs = about?.lede?.length > 0
    ? about.lede
    : [t('about.lede.1'), t('about.lede.2')]

  // Per-field fallback: Strapi values win where present, the built-in strings
  // cover the rest. This lets a language without authored CMS copy still use
  // the CMS images (fetchAbout serves image-only entries for that case).
  const kvItems = FALLBACK_KV.map(({ key }, i) => {
    const s = about?.kv_items?.[i]
    return {
      title: s?.title ?? t(`about.kv.${key}.dt`),
      body: s?.body ?? t(`about.kv.${key}.dd`),
      image: s?.image ?? null,
    }
  })

  return (
    <main className="page">
      <section className="about-hero-image">
        <div className="ah-image reveal" aria-hidden={!heroImage}>
          {heroImage
            ? <img src={heroImage} alt="" />
            : <span className="ph-label">{t('project.detail.full')}</span>
          }
        </div>
      </section>

      <section className="page-section about-essay-section">
        <div className="about-essay-body reveal" style={{ '--reveal-delay': '100ms' }}>
          <h1 className="ae-headline">{about?.headline ?? t('about.headline')}</h1>
          <div className="ae-lede">
            {ledeParagraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          <ol className="ae-list">
            {kvItems.map((item, i) => (
              <li key={i}>
                <span className="ae-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="ae-text">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
                <div className="ae-img" aria-hidden={!item.image}>
                  {item.image
                    ? <img src={item.image} alt="" />
                    : <span className="ph-label">{String(i + 1).padStart(2, '0')}</span>
                  }
                </div>
              </li>
            ))}
          </ol>
        </div>

        <h2 className="section-title ae-team-title">{t('about.team.title')}</h2>
        <div className="team-grid">
          {team.map((member) => (
            <div key={member.id} className="team-card">
              <div className="portrait">
                {member.portrait
                  ? <img src={member.portrait} alt={member.name} />
                  : <span className="ph-label">{t('about.team.portrait')}</span>
                }
              </div>
              <h4>{member.name}</h4>
              <p>{member.role}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

const MAP_LAT = 35.4506521
const MAP_LNG = 139.6361745

function GoogleMap() {
  const ref = useRef(null)
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
    if (!key || !ref.current) return
    const init = () => {
      const map = new window.google.maps.Map(ref.current, {
        center: { lat: MAP_LAT, lng: MAP_LNG },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f0ede8' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#f0ede8' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bdd1dc' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      })
      new window.google.maps.Marker({ position: { lat: MAP_LAT, lng: MAP_LNG }, map })
    }
    if (window.google?.maps) { init(); return }
    if (!document.getElementById('gmaps-script')) {
      window._gmapsCb = init
      const s = document.createElement('script')
      s.id = 'gmaps-script'
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=_gmapsCb`
      s.async = true
      document.head.appendChild(s)
    }
  }, [])
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
}

// Japan-accent sections shown on the About page when reading in Japanese:
// representative's greeting + signature, and the 会社概要 / access blocks.
function JpGreetingSection({ about = null }) {
  const t = useT()
  return (
      <section className="jp-greeting">
        <div className="jp-greeting-inner reveal" style={{ '--reveal-delay': '100ms' }}>
          <h1 className="jp-greeting-title">{about?.greeting_title ?? t('jp.about.greeting.title')}</h1>
          <div className="jp-greeting-body">
            {(about?.greeting_body?.length > 0
              ? about.greeting_body
              : [t('jp.about.greeting.p1'), t('jp.about.greeting.p2'), t('jp.about.greeting.p3')]
            ).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="jp-signature">
            <div className="jp-sig-portrait" aria-hidden={!about?.signature_portrait}>
              {about?.signature_portrait
                ? <img src={about.signature_portrait} alt={about?.signature_name ?? ''} />
                : <span className="ph-label">{t('about.team.portrait')}</span>
              }
            </div>
            <div className="jp-sig-meta">
              <div className="jp-sig-role">{about?.signature_role ?? t('jp.about.signature.role')}</div>
              <div className="jp-sig-name">{about?.signature_name ?? t('jp.about.signature.name')}</div>
              <div className="jp-sig-romaji">{about?.signature_romaji ?? t('jp.about.signature.romaji')}</div>
            </div>
          </div>
        </div>
      </section>
  )
}

function JpCompanySections() {
  const t = useT()
  const facts = [
    ['jp.about.fact.shogo',    'jp.about.fact.shogo.v'],
    ['jp.about.fact.jigyobu',  'jp.about.fact.jigyobu.v'],
    ['jp.about.fact.setsuritsu', 'jp.about.fact.setsuritsu.v'],
    ['jp.about.fact.daihyo',   'jp.about.fact.daihyo.v'],
    ['jp.about.fact.shihon',   'jp.about.fact.shihon.v'],
    ['jp.about.fact.jusho',    'jp.about.fact.jusho.v'],
    ['jp.about.fact.gyomu',    'jp.about.fact.gyomu.v'],
  ]
  return (
    <>
      <section className="jp-overview">
        <div className="jp-overview-head">
          <h2 className="jp-overview-title">{t('jp.about.overview.title')}</h2>
        </div>
        <dl className="jp-fact-table">
          {facts.map(([k, v]) => (
            <div key={k} className="jp-fact-row">
              <dt>{t(k)}</dt>
              <dd>
                {t(v).split('\n').map((ln, i, a) => (
                  <span key={i}>{ln}{i < a.length - 1 ? <br /> : null}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="jp-location">
        <div className="jp-overview-head">
          <span className="jp-eyebrow">{t('jp.about.eyebrow.location')}</span>
          <h2 className="jp-overview-title">{t('jp.about.location.title')}</h2>
        </div>
        <div className="jp-location-grid">
          <div className="jp-map">
            <GoogleMap />
          </div>
          <div className="jp-location-meta">
            {[
              ['jp.about.location.address', 'jp.about.location.address.v'],
              ['jp.about.location.access',  'jp.about.location.access.v'],
              ['jp.about.location.contact', 'jp.about.location.contact.v'],
            ].map(([lk, vk]) => (
              <div key={lk} className="jp-loc-block">
                <div className="jp-loc-label">{t(lk)}</div>
                <div className="jp-loc-value">
                  {t(vk).split('\n').map((ln, i, a) => (
                    <span key={i}>{ln}{i < a.length - 1 ? <br /> : null}</span>
                  ))}
                </div>
              </div>
            ))}
            <a className="jp-directions" href="https://www.google.com/maps/search/%E3%83%8B%E3%82%B5%E3%83%B3%E3%82%AB%E3%82%A4/@35.4506521,139.6361745,18z" target="_blank" rel="noreferrer">
              {t('jp.about.location.directions')} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export function ContactPage() {
  const t = useT()
  const locale = useLocale()
  const isJapan = locale === 'ja'
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', company: '', budget: '', message: '' })
  const [captcha, setCaptcha] = useState(null)
  const captchaRef = useRef(null)

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message || !captcha) return
    setSending(true)
    setError(null)
    try {
      await submitContact({ ...form, turnstileToken: captcha })
      setSubmitted(true)
    } catch {
      setError(true)
      captchaRef.current?.reset() // tokens are single-use — re-run before retrying
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="page">
      <section className="page-section">
        <div className="contact-grid reveal">
          <h1>{t('contact.headline')}</h1>
          <div className="right">
            <div className="contact-block">
              <div className="label">{t('contact.label.newWork')}</div>
              <a className="value" href="mailto:contact@mdmc.co">contact@mdmc.co</a>
            </div>
            <div className="contact-block">
              <div className="label">{t('contact.label.careers')}</div>
              <a className="value" href={isJapan ? 'mailto:recruit@mdmc.co' : 'mailto:careers@mdmc.co'}>
                {isJapan ? 'recruit@mdmc.co' : 'careers@mdmc.co'}
              </a>
            </div>
            {!isJapan && (
              <>
                <div className="contact-block">
                  <div className="label">{t('contact.label.christchurch')}</div>
                  <div className="value">
                    Level 2, 47 Salisbury St<br />
                    Christchurch Central<br />
                    Christchurch 8013<br />
                    <br />
                    <a className="value" href="tel:+6436600336">+64 3 660 0336</a>
                  </div>
                </div>
                <div className="contact-block">
                  <div className="label">{t('contact.label.sydney')}</div>
                  <div className="value">
                    100 Arthur Street, Level 10<br />
                    North Sydney NSW 2060
                  </div>
                </div>
              </>
            )}
            <div className="contact-block">
              <div className="label">{t('contact.label.yokohama')}</div>
              <div className="value">
                5-57-2 Kitanakadori, Naka Ward<br />
                Yokohama, Kanagawa 231-0003<br />
                KITANAKA BRICK &amp; WHITE BRICK south, 3F
              </div>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="contact-form" style={{ display: 'block' }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>{t('contact.form.gotIt')}</h2>
            <p style={{ fontSize: 22, maxWidth: 640 }}>
              {t('contact.form.thanks', { name: form.name.split(' ')[0] })}
            </p>
          </div>
        ) : (
          <form className="contact-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="f-name">{t('contact.form.name')}</label>
              <input id="f-name" type="text" required value={form.name} onChange={handle('name')} />
            </div>
            <div className="field">
              <label htmlFor="f-email">{t('contact.form.email')}</label>
              <input id="f-email" type="email" required value={form.email} onChange={handle('email')} />
            </div>
            <div className="field">
              <label htmlFor="f-company">{t('contact.form.company')}</label>
              <input id="f-company" type="text" value={form.company} onChange={handle('company')} />
            </div>
            <div className="field">
              <label htmlFor="f-budget">{t('contact.form.budget')}</label>
              <input id="f-budget" type="text" placeholder={t('contact.form.budgetPh')} value={form.budget} onChange={handle('budget')} />
            </div>
            <div className="field full">
              <label htmlFor="f-msg">{t('contact.form.message')}</label>
              <textarea id="f-msg" rows="5" required value={form.message} onChange={handle('message')} />
            </div>
            <div className="field full">
              <Turnstile ref={captchaRef} onToken={setCaptcha} locale={locale} />
            </div>
            {error && (
              <div className="full" style={{ color: 'red', fontSize: 15 }}>
                {t('contact.form.error')}
              </div>
            )}
            <div className="full">
              <button type="submit" className="submit-btn" disabled={sending || !captcha}>
                {sending ? '…' : <>{t('contact.form.send')} <span className="arrow">→</span></>}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

function ProjectSkeleton() {
  return (
    <main className="page">
      <section className="project-hero">
        <div className="project-hero-head reveal">
          <div className="sk-line sk-line--title skeleton" style={{ height: 'clamp(40px, 6vw, 88px)', width: '55%', marginTop: 0 }} />
          <div className="sk-line skeleton" style={{ width: '220px', marginTop: 24 }} />
        </div>
        <div className="project-image skeleton reveal" style={{ '--reveal-delay': '80ms' }} aria-hidden="true" />
      </section>
      <section className="project-body reveal" style={{ '--reveal-delay': '160ms' }}>
        <h3>&nbsp;</h3>
        <div className="body-text">
          <div className="sk-line skeleton" />
          <div className="sk-line skeleton" />
          <div className="sk-line sk-line--short skeleton" />
        </div>
      </section>
    </main>
  )
}

export function ProjectPage({ id, navigate, projects = [], loading = false }) {
  const t = useT()
  const project = projects.find((p) => p.id === id) || projects[0] || {}
  const curIdx = projects.indexOf(project)
  const [previewIdx, setPreviewIdx] = useState(projects.length > 1 ? (curIdx + 1) % projects.length : 0)
  useEffect(() => { setPreviewIdx(projects.length > 1 ? (curIdx + 1) % projects.length : 0) }, [curIdx, projects.length])
  // Two-way: the overview copy fades in as it scrolls up into view and back
  // out when the user returns to the top for the clean image-only opening.
  const [bodyRef, bodyInView] = useInView(0, { once: false, rootMargin: '0px 0px -12% 0px' })
  // All hooks above this line — an early return before them crashes React
  // with a hook-count mismatch when `loading` flips (was a live bug).
  if (loading) return <ProjectSkeleton />
  const next = projects[previewIdx] || project
  const goPrev = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx - 1 + projects.length) % projects.length) }
  const goNext = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx + 1) % projects.length) }
  // Parked while the case studies are short — the card reads strangely when
  // it arrives this soon. Flip back on once the studies have more depth.
  const showNextProject = false

  return (
    <main className="page">
      <section className="project-hero">
        <div className="project-hero-head reveal">
          <h1 className="project-title">{project.name}</h1>
          <div className="project-hero-meta">
            {project.client} <span className="sep" aria-hidden="true">/</span> {project.year}
          </div>
        </div>
        {project.heroImage && (
          <div className={`project-image ${project.cls} reveal`} style={{ '--reveal-delay': '80ms' }}>
            <FadeImg src={project.heroImage} alt={project.name} fetchPriority="high" />
          </div>
        )}
      </section>

      <section ref={bodyRef} className={`project-body fade-block${bodyInView ? ' is-inview' : ''}`}>
        <h3>{t('project.section.overview')}</h3>
        <div className="body-text">
          {(project.intro ?? '').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          {(project.body ?? []).map((para, i) => <p key={i}>{para}</p>)}
        </div>
      </section>

      {project.images && project.images.length > 0 && (
        <section className="project-images">
          {project.images.map((src, i) => (
            <div key={i} className={`img ${i === 0 || i === project.images.length - 1 ? 'wide' : ''} ${project.cls}`}>
              <FadeImg src={src} alt={`${project.name} ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </section>
      )}

      {showNextProject && (
      <a
        className="next-project next-project--card"
        href="#"
        onClick={(e) => { e.preventDefault(); navigate('project', next.id) }}
      >
        <div className="np-meta">
          <span className="label">{t('project.next')}</span>
          <span className="np-index">{String(previewIdx + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>
        </div>
        <div className={`np-thumb ${next.cls}`}>
          {next.thumbnail && <img src={next.thumbnail} alt={next.name} />}
        </div>
        <div className="np-foot">
          <span className="name">{next.name}</span>
          <div className="np-nav" role="group" aria-label="Browse projects">
            <button type="button" className="np-arrow" onClick={goPrev} aria-label="Previous project">←</button>
            <span className="np-nav-rule" aria-hidden="true"></span>
            <button type="button" className="np-arrow" onClick={goNext} aria-label="Next project">→</button>
          </div>
        </div>
      </a>
      )}
    </main>
  )
}

// ---------------- News / Journal ----------------

function articleDateLabel(date, locale) {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString(
      locale === 'ja' ? 'ja-JP' : 'en-NZ',
      { year: 'numeric', month: 'long', day: 'numeric' },
    )
  } catch { return date }
}

// Mirrors the Work grid's large two-up presentation — monthly, substantial
// pieces presented like case studies rather than a dense blog index.
export function NewsPage({ navigate, articles = [], loading = false }) {
  const t = useT()
  const locale = useLocale()
  return (
    <main className="page">
      <section className="work-section with-top">
        <h2 className="section-title reveal">{t('news.title')}</h2>
        <div className="work-grid">
          {loading
            ? <SkeletonWorkGrid count={4} />
            : articles.map((a, i) => (
                <a
                  key={a.id}
                  href="#"
                  className="work-card reveal"
                  style={{ '--reveal-delay': `${80 + i * 70}ms` }}
                  onClick={(e) => { e.preventDefault(); navigate('article', a.id) }}
                >
                  <div className="work-thumb">
                    {a.cover
                      ? <FadeImg src={a.cover} alt={a.title} loading="lazy" />
                      : <span className="ph-label">{a.title.toUpperCase()}</span>
                    }
                  </div>
                  <div className="news-card-meta">
                    {a.tag && <span className="news-tag">{a.tag}</span>}
                    <span className="news-date">{articleDateLabel(a.date, locale)}</span>
                  </div>
                  <h3>{a.title}</h3>
                  {a.excerpt && <p className="desc">{a.excerpt}</p>}
                  <span className="view">
                    {t('news.read')} <span className="arrow">→</span>
                  </span>
                </a>
              ))}
        </div>
        {!loading && articles.length === 0 && (
          <p className="news-empty">{t('news.empty')}</p>
        )}
      </section>
    </main>
  )
}

// Reuses the project-page structure wholesale — title row, first-screenful
// hero via the shared .project-hero flex fill, scroll-fading body.
export function ArticlePage({ id, navigate, articles = [], loading = false }) {
  const t = useT()
  const locale = useLocale()
  const article = articles.find((a) => a.id === id) || articles[0] || {}
  const [bodyRef, bodyInView] = useInView(0, { once: false, rootMargin: '0px 0px -12% 0px' })
  if (loading) return <ProjectSkeleton />
  return (
    <main className="page">
      <section className="project-hero">
        <div className="project-hero-head reveal">
          <h1 className="project-title">{article.title}</h1>
          <div className="project-hero-meta">
            {article.tag && <>{article.tag} <span className="sep" aria-hidden="true">/</span> </>}
            {articleDateLabel(article.date, locale)}
          </div>
        </div>
        {article.heroImage && (
          <div className="project-image reveal" style={{ '--reveal-delay': '80ms' }}>
            <FadeImg src={article.heroImage} alt={article.title} fetchPriority="high" />
          </div>
        )}
      </section>

      <section ref={bodyRef} className={`project-body fade-block${bodyInView ? ' is-inview' : ''}`}>
        <h3>{t('news.title')}</h3>
        <div className="body-text">
          {(article.body ?? []).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </section>
    </main>
  )
}

// ---------------- Careers ----------------

export function CareersPage({ careers = null, jobs = [], loading = false, navigate }) {
  const t = useT()
  const email = careers?.contact_email ?? 'careers@mdmc.co'
  const intro = careers?.intro?.length > 0 ? careers.intro : [t('careers.intro')]
  return (
    <main className="page">
      <section className="about-hero-image">
        <div className="ah-image reveal" aria-hidden={!careers?.hero_image}>
          {careers?.hero_image
            ? <img src={careers.hero_image} alt="" />
            : <span className="ph-label">{t('careers.title').toUpperCase()}</span>
          }
        </div>
      </section>

      <section className="page-section about-essay-section careers-section">
        <div className="about-essay-body reveal" style={{ '--reveal-delay': '100ms' }}>
          <h1 className="ae-headline">{careers?.headline ?? t('careers.headline')}</h1>
          <div className="ae-lede">
            {intro.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        {loading ? (
          <div className="careers-roles">
            <div className="sk-line skeleton" style={{ width: '40%' }} />
            <div className="sk-line skeleton" style={{ width: '32%' }} />
          </div>
        ) : jobs.length > 0 ? (
          <ul className="careers-roles">
            {jobs.map((job, i) => (
              <li key={job.id}>
                <a
                  href="#"
                  className="careers-role reveal"
                  style={{ '--reveal-delay': `${i * 60}ms` }}
                  onClick={(e) => { e.preventDefault(); navigate('job', job.id) }}
                >
                  <div className="cr-main">
                    <h3>{job.title}</h3>
                    {job.excerpt && <p>{job.excerpt}</p>}
                  </div>
                  <div className="cr-meta">
                    {job.location && <span>{t(`job.enum.${job.location}`)}</span>}
                    {job.type && <span>{t(`job.enum.${job.type}`)}</span>}
                    <span className="cr-arrow" aria-hidden="true">→</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="careers-empty">{t('careers.noRoles')}</p>
        )}

        <p className="careers-contact">
          {t('careers.speculative')}{' '}
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      </section>
    </main>
  )
}

// Individual job page — modeled on Perpetua's careers/:id (title + meta,
// full-bleed image, "What we offer", apply block) recomposed in this site's
// language: the project-page first-screenful fold, ruled offer rows instead
// of accordions, and a mailto CTA instead of an upload form.
export function JobPage({ id, careers = null, jobs = [], loading = false }) {
  const t = useT()
  const job = jobs.find((j) => j.id === id) || {}
  const [bodyRef, bodyInView] = useInView(0, { once: false, rootMargin: '0px 0px -12% 0px' })
  if (loading) return <ProjectSkeleton />

  // "What we offer" (careers.offers + the careers.offer.N fallbacks) is
  // parked until its design/copy pass — schema and strings stay for its return.
  const email = job.applyEmail ?? careers?.contact_email ?? 'careers@mdmc.co'
  const meta = [job.location, job.type].filter(Boolean).map((v) => t(`job.enum.${v}`))

  return (
    <main className="page">
      <section className="project-hero">
        <div className="project-hero-head reveal">
          <h1 className="project-title">{job.title}</h1>
          <div className="project-hero-meta">
            {meta.map((m, i) => (
              <span key={i}>
                {m}{i < meta.length - 1 && <span className="sep" aria-hidden="true">/</span>}
              </span>
            ))}
          </div>
        </div>
        {/* Frame always renders — the section is sized to the first screenful,
            so an absent image must show as a placeholder, not dead whitespace. */}
        <div className="project-image reveal" style={{ '--reveal-delay': '80ms' }}>
          {job.heroImage
            ? <FadeImg src={job.heroImage} alt={job.title} fetchPriority="high" />
            : <span className="ph-label">{(job.title ?? '').toUpperCase()} — IMAGE</span>
          }
        </div>
      </section>

      <section ref={bodyRef} className={`project-body fade-block${bodyInView ? ' is-inview' : ''}`}>
        <h3>{t('careers.job.about')}</h3>
        <div className="body-text">
          {(job.body ?? []).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </section>

      <section className="page-section job-apply-section">
        <h2 className="section-title">{t('careers.job.apply')}</h2>
        <p className="job-apply-note">{t('careers.job.applyNote')}</p>
        <ApplyForm job={job} fallbackEmail={email} />
      </section>
    </main>
  )
}

const MAX_APPLY_FILES = 4
const MAX_APPLY_BYTES = 15 * 1024 * 1024

// Application form (after perpetua's careers form, in this site's voice):
// name/email, portfolio link, a short note, and CV/cover-letter uploads that
// arrive at the hiring inbox as email attachments via the /apply endpoint.
function ApplyForm({ job, fallbackEmail }) {
  const t = useT()
  const locale = useLocale()
  const [form, setForm] = useState({ name: '', email: '', portfolio: '', message: '' })
  const [files, setFiles] = useState([])
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [fileError, setFileError] = useState(null)
  const [captcha, setCaptcha] = useState(null)
  const fileInput = useRef(null)
  const captchaRef = useRef(null)

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const addFiles = (e) => {
    const chosen = Array.from(e.target.files ?? [])
      .filter((f) => /\.(pdf|docx?)$/i.test(f.name))
    const next = [...files, ...chosen].slice(0, MAX_APPLY_FILES)
    const total = next.reduce((sum, f) => sum + f.size, 0)
    if (total > MAX_APPLY_BYTES) {
      setFileError(t('careers.form.tooBig'))
    } else {
      setFileError(null)
      setFiles(next)
    }
    e.target.value = ''
  }

  const removeFile = (i) => { setFiles(files.filter((_, idx) => idx !== i)); setFileError(null) }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !captcha || state === 'sending') return
    setState('sending')
    try {
      await submitApplication({ ...form, jobId: job.id, files, turnstileToken: captcha })
      setState('done')
    } catch {
      setState('error')
      captchaRef.current?.reset() // tokens are single-use — re-run before retrying
    }
  }

  // Success state mirrors the contact form's exactly (same type sizes).
  if (state === 'done') {
    return (
      <div className="apply-form is-done">
        <h2 className="section-title" style={{ marginBottom: 16 }}>{t('careers.form.received')}</h2>
        <p style={{ fontSize: 22, maxWidth: 640 }}>
          {t('careers.form.thanks', { name: form.name.split(' ')[0] })}
        </p>
      </div>
    )
  }

  return (
    <form className="contact-form apply-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="af-name">{t('contact.form.name')}</label>
        <input id="af-name" type="text" required value={form.name} onChange={handle('name')} />
      </div>
      <div className="field">
        <label htmlFor="af-email">{t('contact.form.email')}</label>
        <input id="af-email" type="email" required value={form.email} onChange={handle('email')} />
      </div>
      <div className="field full">
        <label htmlFor="af-portfolio">{t('careers.form.portfolio')}</label>
        <input id="af-portfolio" type="url" placeholder="https://" value={form.portfolio} onChange={handle('portfolio')} />
      </div>
      <div className="field full">
        <label htmlFor="af-message">{t('careers.form.message')}</label>
        <textarea id="af-message" rows="4" value={form.message} onChange={handle('message')} />
      </div>
      <div className="field full">
        <label htmlFor="af-files">{t('careers.form.upload')}</label>
        <button type="button" className="file-btn" onClick={() => fileInput.current?.click()}>
          {t('careers.form.uploadBtn')} <span className="arrow" aria-hidden="true">→</span>
        </button>
        <input
          ref={fileInput}
          id="af-files"
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          hidden
          onChange={addFiles}
        />
        {files.length > 0 && (
          <div className="file-chips">
            {files.map((f, i) => (
              <span className="file-chip" key={`${f.name}-${i}`}>
                {f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => removeFile(i)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className={`file-hint${fileError ? ' is-error' : ''}`}>
          {fileError ?? t('careers.form.uploadHint')}
        </div>
      </div>
      <div className="field full">
        <Turnstile ref={captchaRef} onToken={setCaptcha} locale={locale} />
      </div>
      <div className="full">
        <button className="submit-btn" type="submit" disabled={state === 'sending' || !captcha}>
          {state === 'sending' ? t('careers.form.sending') : t('careers.form.send')}
          {' '}<span className="arrow">→</span>
        </button>
        {state === 'error' && (
          <p className="af-error">
            {t('contact.form.error')}{' '}
            <a href={`mailto:${fallbackEmail}?subject=${encodeURIComponent(`Application — ${job.title ?? ''}`)}`}>{fallbackEmail}</a>
          </p>
        )}
      </div>
    </form>
  )
}
