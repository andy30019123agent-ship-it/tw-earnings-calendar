import CalendarCard from './components/CalendarCard'
import ReportList from './components/ReportList'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">台股法說會行事曆</h1>
        <p className="app-subtitle">法說會・財報・AI 快報</p>
      </header>

      <main className="app-main">
        <CalendarCard />
        <ReportList />
      </main>

      <footer className="app-footer">
        <p>本站資料由 AI 輔助整理，僅供參考，不構成投資建議。</p>
      </footer>
    </div>
  )
}
