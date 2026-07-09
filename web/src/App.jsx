import { useEffect, useState } from 'react'
import { CalendarDays, Compass } from 'lucide-react'
import CalendarCard from './components/CalendarCard'
import ReportList from './components/ReportList'
import ReportLibrary from './components/ReportLibrary'
import ReportView from './components/ReportView'
import Scorecard from './components/Scorecard'
import { BASE, parsePath, pathFor, legacyHashToPath } from './lib/router'
import './App.css'

// 啟動時：舊 hash 連結（#/r/xxx.md 等）用 replaceState 轉成新真實路徑，
// 已發出去的舊連結不會壞。回傳解析後的初始路由。
function initialLocation() {
  const legacy = legacyHashToPath(window.location.hash)
  if (legacy) {
    window.history.replaceState(null, '', legacy)
  }
  return parsePath(window.location.pathname)
}

export default function App() {
  const [loc, setLoc] = useState(initialLocation)
  // 首頁行事曆載入完成後回報統計數字，供 hero 大數字列顯示（僅首頁使用）
  const [heroStats, setHeroStats] = useState(null)

  useEffect(() => {
    // 前進/後退
    const onPop = () => setLoc(parsePath(window.location.pathname))
    window.addEventListener('popstate', onPop)

    // 站內連結全域攔截：改用 pushState 不整頁重載
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target.closest?.('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href || a.target === '_blank') return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (!url.pathname.startsWith(BASE)) return
      e.preventDefault()
      const to = url.pathname + url.search
      if (to !== window.location.pathname + window.location.search) {
        window.history.pushState(null, '', to)
        window.scrollTo(0, 0)
      }
      setLoc(parsePath(url.pathname))
    }
    document.addEventListener('click', onClick)

    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
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
              href={pathFor('home')}
              className={`seg-btn${isHome ? ' on' : ''}`}
              aria-current={isHome ? 'page' : undefined}
            >
              首頁
            </a>
            <a
              href={pathFor('library')}
              className={`seg-btn${loc.route === 'library' || loc.route === 'report' ? ' on' : ''}`}
              aria-current={loc.route === 'library' || loc.route === 'report' ? 'page' : undefined}
            >
              報告庫
            </a>
            <a
              href={pathFor('scorecard')}
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
        {loc.route === 'report' && <ReportView slug={loc.slug} />}
        {loc.route === 'notFound' && (
          <section className="report-view-wrap">
            <div className="report-not-found">
              <Compass size={40} strokeWidth={1.5} className="report-not-found-icon" aria-hidden="true" />
              <p className="report-not-found-title">找不到這個頁面</p>
              <p className="report-not-found-hint">
                這個網址不存在或已變更，請回首頁或報告庫重新開始。
              </p>
              <div className="not-found-actions">
                <a href={pathFor('home')} className="btn-secondary">回首頁</a>
                <a href={pathFor('library')} className="btn-secondary">前往報告庫</a>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>本站資料由 AI 輔助整理，僅供參考，不構成投資建議。</p>
      </footer>
    </div>
  )
}
