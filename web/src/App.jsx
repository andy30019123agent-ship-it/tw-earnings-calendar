import { useEffect, useState } from 'react'
import CalendarCard from './components/CalendarCard'
import ReportList from './components/ReportList'
import ReportLibrary from './components/ReportLibrary'
import ReportView from './components/ReportView'
import './App.css'

function parseHash(hash) {
  const h = hash.replace(/^#/, '')
  if (!h || h === '/') return { route: 'home' }
  if (h === '/library') return { route: 'library' }
  const m = h.match(/^\/r\/(.+)$/)
  if (m) return { route: 'report', filename: decodeURIComponent(m[1]) }
  return { route: 'home' }
}

export default function App() {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setLoc(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">台股法說會行事曆</h1>
        <p className="app-subtitle">法說會・財報・AI 快報</p>
        <nav className="app-nav">
          <a href="#/" className={`app-nav-link${loc.route === 'home' ? ' active' : ''}`}>首頁</a>
          <a href="#/library" className={`app-nav-link${loc.route === 'library' || loc.route === 'report' ? ' active' : ''}`}>報告庫</a>
        </nav>
      </header>

      <main className="app-main">
        {loc.route === 'home' && (
          <>
            <CalendarCard />
            <ReportList />
          </>
        )}
        {loc.route === 'library' && <ReportLibrary />}
        {loc.route === 'report' && <ReportView filename={loc.filename} />}
      </main>

      <footer className="app-footer">
        <p>本站資料由 AI 輔助整理，僅供參考，不構成投資建議。</p>
      </footer>
    </div>
  )
}
