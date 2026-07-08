import { useState, useEffect, cloneElement } from 'react'
import { useLocale } from './i18n.jsx'
import { fetchProjects, fetchMembers, fetchHomepage, fetchAbout, fetchAboutJa, fetchArticles, fetchCareers, fetchJobs } from './strapi.js'
import { Header, Footer, JpSuggestionPrompt } from './chrome.jsx'
import { HomePage, WorkPage, AboutPage, ContactPage, ProjectPage, NewsPage, ArticlePage, CareersPage, JobPage } from './pages.jsx'

export default function App() {
  const [route, setRoute] = useState({ page: 'home', id: null })
  // null = still loading (show skeletons). Resilience lives in strapi.js:
  // live CMS → build-time content snapshot → only then the empty state here.
  const [projects, setProjects] = useState(null)
  const [articles, setArticles] = useState(null)
  const [careers, setCareers] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [members, setMembers] = useState([])
  const [homepage, setHomepage] = useState(null)
  const [about, setAbout] = useState(null)
  const [aboutJa, setAboutJa] = useState(null)
  const locale = useLocale()

  useEffect(() => {
    let cancelled = false
    setProjects(null) // re-enter loading state on mount and on locale change
    fetchProjects(locale)
      .then((data) => { if (!cancelled) setProjects(data) })
      // Both live Strapi AND the baked snapshot failed — show the empty state.
      .catch(() => { if (!cancelled) setProjects([]) })
    setArticles(null)
    fetchArticles(locale)
      .then((data) => { if (!cancelled) setArticles(data) })
      .catch(() => { if (!cancelled) setArticles([]) })
    fetchCareers(locale)
      .then((data) => { if (!cancelled) setCareers(data) })
      .catch(() => {})
    setJobs(null)
    fetchJobs(locale)
      .then((data) => { if (!cancelled) setJobs(data) })
      .catch(() => { if (!cancelled) setJobs([]) })
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
    const hash = page === 'home' ? ''
      : page === 'project' ? `#/work/${id}`
      : page === 'article' ? `#/news/${id}`
      : page === 'job' ? `#/careers/${id}`
      : `#/${page}`
    history.replaceState(null, '', hash || window.location.pathname)
  }

  useEffect(() => {
    const parseHash = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      if (!h) return { page: 'home', id: null }
      const parts = h.split('/')
      if (parts[0] === 'work' && parts[1]) return { page: 'project', id: parts[1] }
      if (parts[0] === 'news' && parts[1]) return { page: 'article', id: parts[1] }
      if (parts[0] === 'careers' && parts[1]) return { page: 'job', id: parts[1] }
      if (['work', 'about', 'contact', 'news', 'careers'].includes(parts[0])) return { page: parts[0], id: null }
      return { page: 'home', id: null }
    }
    setRoute(parseHash())
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const loading = projects === null
  const projectList = projects ?? []

  const articlesLoading = articles === null
  const articleList = articles ?? []

  let view
  if (route.page === 'home')         view = <HomePage navigate={navigate} projects={projectList} loading={loading} homepage={homepage} />
  else if (route.page === 'work')    view = <WorkPage navigate={navigate} projects={projectList} loading={loading} />
  else if (route.page === 'about')   view = <AboutPage members={members} about={about} aboutJa={aboutJa} />
  else if (route.page === 'contact') view = <ContactPage />
  else if (route.page === 'project') view = <ProjectPage id={route.id} navigate={navigate} projects={projectList} loading={loading} />
  else if (route.page === 'news')    view = <NewsPage navigate={navigate} articles={articleList} loading={articlesLoading} />
  else if (route.page === 'article') view = <ArticlePage id={route.id} navigate={navigate} articles={articleList} loading={articlesLoading} />
  else if (route.page === 'careers') view = <CareersPage careers={careers} jobs={jobs ?? []} loading={jobs === null} navigate={navigate} />
  else if (route.page === 'job')     view = <JobPage id={route.id} careers={careers} jobs={jobs ?? []} loading={jobs === null} />
  else                               view = <HomePage navigate={navigate} projects={projectList} loading={loading} />

  return (
    <>
      <Header route={route.page} navigate={navigate} projects={projectList} articles={articleList} />
      {view && cloneElement(view, { key: route.page + (route.id || '') })}
      <Footer navigate={navigate} />
      <JpSuggestionPrompt />
    </>
  )
}
