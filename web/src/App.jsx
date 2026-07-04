import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import CalendarCard from './components/CalendarCard'
import ReportList from './components/ReportList'
import ReportLibrary from './components/ReportLibrary'
import ReportView from './components/ReportView'
import Scorecard from './components/Scorecard'
import './App.css'

function parseHash(hash) {
  const h = hash.replace(/^#/, '')
  if (!h || h === '/') return { route: 'home' }
  if (h === '/library') return { route: 'library' }
  if (h === '/scorecard') return { route: 'scorecard' }
  const m = h.match(/^\/r\/(.+)$/)
  if (m) return { route: 'report', filename: decodeURIComponent(m[1]) }
  return { route: 'home' }
}

export default function App() {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash))
  // 首頁行事曆載入完成後回報統計數字，供 hero 大數字列顯示（僅首頁使用）
  const [heroStats, setHeroStats] = useState(null)

  useEffect(() => {
    const onHashChange = () => setLoc(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isHome = loc.route === 'home'

  return (
    <div className="app">
      <header className="hero">
        <span className="hero-blob b1" aria-hidden="true" />
        <span className="hero-blob b2" aria-hidden="true" />
        <div className="hero-top">
          <div className="hero-titles">
            <span className="badge-pill">
              <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />
              法說會與財報追蹤
            </span>
            <h1>台股法說會行事曆</h1>
            <p className="subtitle">法說會・財報・AI 快報，每週自動更新</p>
          </div>
          <nav className="seg app-nav">
            <a
              href="#/"
              className={`seg-btn${isHome ? ' on' : ''}`}
              aria-current={isHome ? 'page' : undefined}
            >
              首頁
            </a>
            <a
              href="#/library"
              className={`seg-btn${loc.route === 'library' || loc.route === 'report' ? ' on' : ''}`}
              aria-current={loc.route === 'library' || loc.route === 'report' ? 'page' : undefined}
            >
              報告庫
            </a>
            <a
              href="#/scorecard"
              className={`seg-btn${loc.route === 'scorecard' ? ' on' : ''}`}
              aria-current={loc.route === 'scorecard' ? 'page' : undefined}
            >
              成績單
            </a>
          </nav>
        </div>

        {isHome && heroStats && (
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="st-name">下週場次</div>
              <div className="st-value">{heroStats.total}</div>
            </div>
            <div className="stat-tile">
              <div className="st-name">今日場次</div>
              <div className="st-value">{heroStats.today}</div>
            </div>
          </div>
        )}
      </header>

      <main className="app-main">
        {isHome && (
          <>
            <CalendarCard onStats={setHeroStats} />
            <ReportList />
          </>
        )}
        {loc.route === 'library' && <ReportLibrary />}
        {loc.route === 'scorecard' && <Scorecard />}
        {loc.route === 'report' && <ReportView filename={loc.filename} />}
      </main>

      <footer className="app-footer">
        <p>本站資料由 AI 輔助整理，僅供參考，不構成投資建議。</p>
      </footer>
    </div>
  )
}
