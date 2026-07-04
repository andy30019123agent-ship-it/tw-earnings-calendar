import { useEffect, useState } from 'react'
import { ArrowLeft, Inbox } from 'lucide-react'
import { loadReports } from '../lib/reports'
import { TYPE_LABEL, typeColorClass } from '../lib/reportTypes'

export default function ReportView({ filename }) {
  const [report, setReport] = useState(undefined) // undefined = loading, null = not found
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!filename) {
      setReport(null)
      return
    }
    loadReports()
      .then((all) => {
        const found = all.find((r) => r.filename === filename)
        setReport(found ?? null)
      })
      .catch(() => {
        setErr(true)
        setReport(null)
      })
  }, [filename])

  if (report === undefined) {
    return (
      <div className="report-view-wrap">
        <p className="placeholder">載入中…</p>
      </div>
    )
  }

  if (err) {
    return (
      <div className="report-view-wrap">
        <a href="#/" className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          返回首頁
        </a>
        <p className="error-note" style={{ marginTop: '16px' }}>
          報告載入失敗，請稍後再試。
        </p>
      </div>
    )
  }

  if (report === null) {
    return (
      <div className="report-view-wrap">
        <a href="#/" className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          返回首頁
        </a>
        <div className="report-not-found">
          <Inbox size={40} strokeWidth={1.5} className="report-not-found-icon" aria-hidden="true" />
          <p className="report-not-found-title">找不到這篇報告</p>
          <p className="report-not-found-hint">
            可能已移除或連結有誤，請回首頁查看最近報告。
          </p>
          <a href="#/library" className="btn-secondary">前往報告庫</a>
        </div>
      </div>
    )
  }

  const typeClass = typeColorClass(report.type)

  return (
    <article className="report-view-wrap">
      <nav className="report-view-nav">
        <a href="#/" className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          首頁
        </a>
        <a href="#/library" className="nav-back">報告庫</a>
      </nav>

      <header className="report-view-header">
        <div className="report-view-meta">
          <span className="report-code report-view-code">{report.id}</span>
          <span className="report-view-name">{report.name}</span>
          <span className={`tag tag-${typeClass} report-view-type`}>
            {TYPE_LABEL[report.type] ?? report.type ?? '—'}
          </span>
        </div>
        <div className="report-view-date">{report.date}</div>
      </header>

      {/*
        安全性說明：report.html 由 marked 轉換本地 .md 檔案而來，
        這些 md 檔在 Vite build time 透過 import.meta.glob 靜態打包，
        完全不含任何使用者輸入，無 XSS 風險，故直接渲染。
      */}
      <div
        className="report-view-body prose"
        dangerouslySetInnerHTML={{ __html: report.html }}
      />

      <footer className="report-view-footer">
        僅供研究參考，非投資建議。
      </footer>
    </article>
  )
}
