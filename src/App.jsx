import { useState, useEffect, cloneElement } from 'react'
import { useT } from './i18n.jsx'
import STATIC_PROJECTS from './data.js'
import { fetchProjects } from './strapi.js'
import { Header, Footer, JpSuggestionPrompt } from './chrome.jsx'
import { HomePage, WorkPage, AboutPage, ContactPage, ProjectPage } from './pages.jsx'

export default function App() {
  const [route, setRoute] = useState({ page: 'home', id: null })
  const [projects, setProjects] = useState(STATIC_PROJECTS)
  const t = useT()

  useEffect(() => {
    fetchProjects()
      .then((data) => { if (data.length > 0) setProjects(data) })
      .catch(() => {})
  }, [])

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

  let crumbs = null
  if (route.page === 'project') {
    const proj = projects.find((p) => p.id === route.id)
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
  if (route.page === 'home')         view = <HomePage navigate={navigate} projects={projects} />
  else if (route.page === 'work')    view = <WorkPage navigate={navigate} projects={projects} />
  else if (route.page === 'about')   view = <AboutPage />
  else if (route.page === 'contact') view = <ContactPage />
  else if (route.page === 'project') view = <ProjectPage id={route.id} navigate={navigate} projects={projects} />
  else                               view = <HomePage navigate={navigate} projects={projects} />

  return (
    <>
      <Header route={route.page} navigate={navigate} crumbs={crumbs} />
      {view && cloneElement(view, { key: route.page + (route.id || '') })}
      <Footer navigate={navigate} />
      <JpSuggestionPrompt />
    </>
  )
}
