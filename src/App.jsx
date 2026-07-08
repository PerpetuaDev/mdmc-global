import { useState, useEffect, cloneElement } from 'react'
import { useT, useSite } from './i18n.jsx'
import { fetchProjects, fetchMembers, fetchHomepage, fetchAbout, fetchAboutJa } from './strapi.js'
import { Header, Footer, JpSuggestionPrompt } from './chrome.jsx'
import { HomePage, WorkPage, AboutPage, ContactPage, ProjectPage } from './pages.jsx'

export default function App() {
  const [route, setRoute] = useState({ page: 'home', id: null })
  // null = still loading (show skeletons). Resilience lives in strapi.js:
  // live CMS → build-time content snapshot → only then the empty state here.
  const [projects, setProjects] = useState(null)
  const [members, setMembers] = useState([])
  const [homepage, setHomepage] = useState(null)
  const [about, setAbout] = useState(null)
  const [aboutJa, setAboutJa] = useState(null)
  const t = useT()
  const site = useSite()
  const locale = site === 'japan' ? 'ja' : 'en'

  useEffect(() => {
    let cancelled = false
    setProjects(null) // re-enter loading state on mount and on locale change
    fetchProjects(locale)
      .then((data) => { if (!cancelled) setProjects(data) })
      // Both live Strapi AND the baked snapshot failed — show the empty state.
      .catch(() => { if (!cancelled) setProjects([]) })
    fetchMembers()
      .then((data) => { if (!cancelled && data.length > 0) setMembers(data) })
      .catch(() => {})
    fetchHomepage(locale)
      .then((data) => { if (!cancelled && data) setHomepage(data) })
      .catch(() => {})
    fetchAbout()
      .then((data) => { if (!cancelled && data) setAbout(data) })
      .catch(() => {})
    fetchAboutJa()
      .then((data) => { if (!cancelled && data) setAboutJa(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [locale])

  const navigate = (page, id = null) => {
    setRoute({ page, id })
    window.scrollTo({ top: 0, behavior: 'instant' })
    const hash = page === 'home' ? '' : page === 'project' ? `#/work/${id}` : `#/${page}`
    history.replaceState(null, '', hash || window.location.pathname)
  }

  useEffect(() => {
    const parseHash = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      if (!h) return { page: 'home', id: null }
      const parts = h.split('/')
      if (parts[0] === 'work' && parts[1]) return { page: 'project', id: parts[1] }
      if (['work', 'about', 'contact'].includes(parts[0])) return { page: parts[0], id: null }
      return { page: 'home', id: null }
    }
    setRoute(parseHash())
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const loading = projects === null
  const projectList = projects ?? []

  let crumbs = null
  if (route.page === 'project') {
    const proj = projectList.find((p) => p.id === route.id)
    crumbs = [
      { label: t('crumb.work'), href: 'work' },
      { label: proj ? proj.name : 'Project' },
    ]
  } else if (route.page === 'work') {
    crumbs = [{ label: t('crumb.home'), href: 'home' }, { label: t('crumb.work') }]
  } else if (route.page === 'about') {
    crumbs = [{ label: t('crumb.home'), href: 'home' }, { label: t('crumb.about') }]
  } else if (route.page === 'contact') {
    crumbs = [{ label: t('crumb.home'), href: 'home' }, { label: t('crumb.contact') }]
  }

  let view
  if (route.page === 'home')         view = <HomePage navigate={navigate} projects={projectList} loading={loading} homepage={homepage} />
  else if (route.page === 'work')    view = <WorkPage navigate={navigate} projects={projectList} loading={loading} />
  else if (route.page === 'about')   view = <AboutPage members={members} about={site === 'japan' ? aboutJa : about} />
  else if (route.page === 'contact') view = <ContactPage />
  else if (route.page === 'project') view = <ProjectPage id={route.id} navigate={navigate} projects={projectList} loading={loading} />
  else                               view = <HomePage navigate={navigate} projects={projectList} loading={loading} />

  return (
    <>
      <Header route={route.page} navigate={navigate} crumbs={crumbs} />
      {view && cloneElement(view, { key: route.page + (route.id || '') })}
      <Footer navigate={navigate} />
      <JpSuggestionPrompt />
    </>
  )
}
