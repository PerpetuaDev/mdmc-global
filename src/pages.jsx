import { useState, useEffect } from 'react'
import { useT, useSite, NL } from './i18n.jsx'
import PROJECTS from './data.js'

export function HomePage({ navigate }) {
  const t = useT()
  const featured = PROJECTS.slice(0, 4)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const tm = setInterval(() => setIdx((i) => (i + 1) % featured.length), 5500)
    return () => clearInterval(tm)
  }, [featured.length])

  const current = featured[idx]
  const isDark = current.id === 'northway'

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-frame">
          {featured.map((p, i) => (
            <div
              key={p.id}
              className={`hero-slide ${p.id} ${i === idx ? 'active' : ''}`}
              onClick={() => navigate('project', p.id)}
              role="button"
              tabIndex={i === idx ? 0 : -1}
              aria-label={`Open ${p.name}`}
            >
              <span className="ph-label">{t('home.hero.placeholder', { name: p.name.toUpperCase() })}</span>
              <h2>{p.name}</h2>
              <p>{p.desc}</p>
            </div>
          ))}
          <div className={`hero-dots${isDark ? '' : ' dark'}`}>
            {featured.map((_, i) => (
              <button
                key={i}
                className={i === idx ? 'active' : ''}
                onClick={() => setIdx(i)}
                aria-label={t('home.hero.dotLabel', { n: i + 1 })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto">
        <div>
          <p><NL text={t('home.manifesto.1')} /></p>
          <p><NL text={t('home.manifesto.2')} /></p>
          <p><NL text={t('home.manifesto.3')} /></p>
        </div>
      </section>

      <section className="work-section">
        <div className="work-grid">
          {PROJECTS.slice(0, 6).map((p) => (
            <WorkCard key={p.id} project={p} navigate={navigate} />
          ))}
        </div>
      </section>
    </main>
  )
}

export function WorkCard({ project, navigate }) {
  const t = useT()
  return (
    <a
      href="#"
      className="work-card"
      onClick={(e) => { e.preventDefault(); navigate('project', project.id) }}
    >
      <div className={`work-thumb ${project.cls}`}>
        <span className="ph-label">{t('home.work.placeholder', { name: project.name.toUpperCase() })}</span>
      </div>
      <h3>{project.name}</h3>
      <p className="desc">{project.desc}</p>
      <span className="view">
        {t('home.work.view')} <span className="arrow">→</span>
      </span>
    </a>
  )
}

export function WorkPage({ navigate }) {
  const t = useT()
  return (
    <main className="page">
      <section className="work-section with-top">
        <h2 className="section-title">{t('work.title')}</h2>
        <div className="work-grid">
          {PROJECTS.map((p) => (
            <WorkCard key={p.id} project={p} navigate={navigate} />
          ))}
        </div>
      </section>
    </main>
  )
}

export function AboutPage() {
  const site = useSite()
  if (site === 'japan') return <AboutPageJa />
  return <AboutPageEn />
}

function AboutPageEn() {
  const t = useT()
  const team = [
    ['Maya Devereux',   'about.team.role.partnerDesign'],
    ['Daniel Mwangi',   'about.team.role.partnerStrategy'],
    ['Mariko Chen',     'about.team.role.designDirector'],
    ['Ciaran O\'Reilly', 'about.team.role.designDirector'],
    ['Sofia Barros',    'about.team.role.seniorDesigner'],
    ['Theo Lindqvist',  'about.team.role.seniorDesigner'],
    ['Aïcha Diop',      'about.team.role.brandDesigner'],
    ['Wren Tanaka',     'about.team.role.productDesigner'],
  ]
  return (
    <main className="page">
      <section className="about-hero-image">
        <div className="ah-image" aria-hidden="true">
          <span className="ph-label">{t('project.detail.full')}</span>
        </div>
      </section>

      <section className="page-section about-essay-section">
        <div className="about-essay-body">
          <h1 className="ae-headline">{t('about.headline')}</h1>
          <div className="ae-lede">
            <p>{t('about.lede.1')}</p>
            <p>{t('about.lede.2')}</p>
          </div>

          <ol className="ae-list">
            {[
              ['about.kv.what.dt', 'about.kv.what.dd'],
              ['about.kv.how.dt',  'about.kv.how.dd'],
              ['about.kv.who.dt',  'about.kv.who.dd'],
              ['about.kv.dont.dt', 'about.kv.dont.dd'],
            ].map(([dtKey, ddKey], i) => (
              <li key={dtKey}>
                <span className="ae-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="ae-text">
                  <h3>{t(dtKey)}</h3>
                  <p>{t(ddKey)}</p>
                </div>
                <div className="ae-img" aria-hidden="true">
                  <span className="ph-label">{String(i + 1).padStart(2, '0')}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <h2 className="section-title ae-team-title">{t('about.team.title')}</h2>
        <div className="team-grid">
          {team.map(([name, roleKey]) => (
            <div key={name} className="team-card">
              <div className="portrait">
                <span className="ph-label">{t('about.team.portrait')}</span>
              </div>
              <h4>{name}</h4>
              <p>{t(roleKey)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function AboutPageJa() {
  const t = useT()
  const facts = [
    ['jp.about.fact.shogo',    'jp.about.fact.shogo.v'],
    ['jp.about.fact.setsuritsu', 'jp.about.fact.setsuritsu.v'],
    ['jp.about.fact.daihyo',   'jp.about.fact.daihyo.v'],
    ['jp.about.fact.shihon',   'jp.about.fact.shihon.v'],
    ['jp.about.fact.jusho',    'jp.about.fact.jusho.v'],
    ['jp.about.fact.gyomu',    'jp.about.fact.gyomu.v'],
    ['jp.about.fact.torihiki', 'jp.about.fact.torihiki.v'],
  ]
  return (
    <main className="page jp-about">
      <section className="jp-greeting">
        <div className="jp-greeting-inner">
          <span className="jp-eyebrow">{t('jp.about.eyebrow.greeting')}</span>
          <h1 className="jp-greeting-title">{t('jp.about.greeting.title')}</h1>
          <div className="jp-greeting-body">
            <p>{t('jp.about.greeting.p1')}</p>
            <p>{t('jp.about.greeting.p2')}</p>
            <p>{t('jp.about.greeting.p3')}</p>
          </div>
          <div className="jp-signature">
            <div className="jp-sig-portrait" aria-hidden="true">
              <span className="ph-label">{t('about.team.portrait')}</span>
            </div>
            <div className="jp-sig-meta">
              <div className="jp-sig-role">{t('jp.about.signature.role')}</div>
              <div className="jp-sig-name">{t('jp.about.signature.name')}</div>
              <div className="jp-sig-romaji">{t('jp.about.signature.romaji')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="jp-overview">
        <div className="jp-overview-head">
          <span className="jp-eyebrow">{t('jp.about.eyebrow.overview')}</span>
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
          <div className="jp-map" aria-hidden="true">
            <span className="ph-label">MAP — YOKOHAMA</span>
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
            <a className="jp-directions" href="https://maps.google.com" target="_blank" rel="noreferrer">
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
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '', budget: '', message: '' })

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setSubmitted(true)
  }

  return (
    <main className="page">
      <section className="page-section">
        <div className="contact-grid">
          <h1>{t('contact.headline')}</h1>
          <div className="right">
            <div className="contact-block">
              <div className="label">{t('contact.label.newWork')}</div>
              <a className="value" href="mailto:hello@mdmc.studio">hello@mdmc.studio</a>
            </div>
            <div className="contact-block">
              <div className="label">{t('contact.label.press')}</div>
              <a className="value" href="mailto:press@mdmc.studio">press@mdmc.studio</a>
            </div>
            <div className="contact-block">
              <div className="label">{t('contact.label.christchurch')}</div>
              <div className="value">
                Level 2, 47 Salisbury St<br />
                Christchurch Central<br />
                Christchurch 8013
              </div>
            </div>
            <div className="contact-block">
              <div className="label">{t('contact.label.sydney')}</div>
              <div className="value">
                Level 5, 50 Holt St<br />
                Surry Hills NSW 2010
              </div>
            </div>
            <div className="contact-block">
              <div className="label">{t('contact.label.yokohama')}</div>
              <div className="value">
                1-7-20 Shinyamashita<br />
                Naka Ward, Yokohama<br />
                Kanagawa 231-0801
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
            <div className="full">
              <button type="submit" className="submit-btn">
                {t('contact.form.send')} <span className="arrow">→</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export function ProjectPage({ id, navigate }) {
  const t = useT()
  const project = PROJECTS.find((p) => p.id === id) || PROJECTS[0]
  const curIdx = PROJECTS.indexOf(project)
  const [previewIdx, setPreviewIdx] = useState((curIdx + 1) % PROJECTS.length)
  useEffect(() => { setPreviewIdx((curIdx + 1) % PROJECTS.length) }, [curIdx])
  const next = PROJECTS[previewIdx]
  const goPrev = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx - 1 + PROJECTS.length) % PROJECTS.length) }
  const goNext = (e) => { e.preventDefault(); e.stopPropagation(); setPreviewIdx((previewIdx + 1) % PROJECTS.length) }

  return (
    <main className="page">
      <section className="project-hero">
        <div className="project-hero-head">
          <h1 className="project-title">{project.name}</h1>
          <div className="project-hero-meta">
            {project.client} <span className="sep" aria-hidden="true">/</span> {project.year}
          </div>
        </div>
        <div className={`project-image ${project.cls}`}>
          <span className="ph-label">{t('project.key', { name: project.name.toUpperCase() })}</span>
        </div>
      </section>

      <section className="project-body">
        <h3>{t('project.section.overview')}</h3>
        <div className="body-text">
          <p>{project.intro}</p>
          {project.body.map((para, i) => <p key={i}>{para}</p>)}
        </div>
      </section>

      <section className="project-images">
        <div className={`img wide ${project.cls}`}>
          <span className="ph-label">{t('project.detail.full')}</span>
        </div>
        <div className={`img ${project.cls}`}>
          <span className="ph-label">{t('project.detail.02')}</span>
        </div>
        <div className={`img ${project.cls}`}>
          <span className="ph-label">{t('project.detail.03')}</span>
        </div>
        <div className={`img wide ${project.cls}`}>
          <span className="ph-label">{t('project.detail.case')}</span>
        </div>
      </section>

      <a
        className="next-project next-project--card"
        href="#"
        onClick={(e) => { e.preventDefault(); navigate('project', next.id) }}
      >
        <div className="np-meta">
          <span className="label">{t('project.next')}</span>
          <span className="np-index">{String(previewIdx + 1).padStart(2, '0')} / {String(PROJECTS.length).padStart(2, '0')}</span>
        </div>
        <div className={`np-thumb ${next.cls}`}>
          <span className="ph-label">{next.name.toUpperCase()}</span>
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
