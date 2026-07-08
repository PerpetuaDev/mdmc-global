import { useState, useEffect, useRef } from 'react'
import { useT, useSite, NL } from './i18n.jsx'
import { submitContact } from './strapi.js'

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

// Flips true once (and stays true) when the element scrolls into view. Drives
// .scroll-reveal entrances for below-the-fold content — unlike .reveal, which
// plays on mount and has long finished by the time the user scrolls down.
function useInView(threshold = 0.3) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
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

export function WorkPage({ navigate, projects = [], loading = false }) {
  const t = useT()
  return (
    <main className="page">
      <section className="work-section with-top">
        <h2 className="section-title reveal">{t('work.title')}</h2>
        <div className="work-grid">
          {loading
            ? <SkeletonWorkGrid count={6} />
            : projects.map((p, i) => (
                <WorkCard key={p.id} project={p} navigate={navigate} revealDelay={80 + i * 70} />
              ))}
        </div>
      </section>
    </main>
  )
}

export function AboutPage({ members = [], about = null }) {
  const site = useSite()
  if (site === 'japan') return <AboutPageJa about={about} />
  return <AboutPageEn members={members} about={about} />
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

function AboutPageEn({ members = [], about = null }) {
  const t = useT()
  const team = members.length > 0 ? members : STATIC_TEAM

  const ledeParagraphs = about?.lede?.length > 0
    ? about.lede
    : [t('about.lede.1')]

  const kvItems = about?.kv_items?.length > 0
    ? about.kv_items
    : FALLBACK_KV.map(({ key }) => ({
        title: t(`about.kv.${key}.dt`),
        body: t(`about.kv.${key}.dd`),
        image: null,
      }))

  return (
    <main className="page">
      <section className="about-hero-image">
        <div className="ah-image reveal" aria-hidden={!about?.hero_image}>
          {about?.hero_image
            ? <img src={about.hero_image} alt="" />
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

function AboutPageJa({ about = null }) {
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
    <main className="page jp-about">
      <section className="about-hero-image">
        <div className="ah-image reveal" aria-hidden={!about?.hero_image}>
          {about?.hero_image
            ? <img src={about.hero_image} alt="" />
            : <span className="ph-label">{t('project.detail.full')}</span>
          }
        </div>
      </section>
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
    </main>
  )
}

export function ContactPage() {
  const t = useT()
  const site = useSite()
  const isJapan = site === 'japan'
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', company: '', budget: '', message: '' })

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setSending(true)
    setError(null)
    try {
      await submitContact(form)
      setSubmitted(true)
    } catch {
      setError(true)
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
            {error && (
              <div className="full" style={{ color: 'red', fontSize: 15 }}>
                {t('contact.form.error')}
              </div>
            )}
            <div className="full">
              <button type="submit" className="submit-btn" disabled={sending}>
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
  if (loading) return <ProjectSkeleton />
  const project = projects.find((p) => p.id === id) || projects[0] || {}
  const curIdx = projects.indexOf(project)
  const [previewIdx, setPreviewIdx] = useState(projects.length > 1 ? (curIdx + 1) % projects.length : 0)
  useEffect(() => { setPreviewIdx(projects.length > 1 ? (curIdx + 1) % projects.length : 0) }, [curIdx, projects.length])
  const next = projects[previewIdx] || project
  const goPrev = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx - 1 + projects.length) % projects.length) }
  const goNext = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx + 1) % projects.length) }

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

      <section className="project-body reveal" style={{ '--reveal-delay': '160ms' }}>
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
    </main>
  )
}
