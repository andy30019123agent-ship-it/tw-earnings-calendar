import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Inbox, Link2 } from 'lucide-react'
import { loadReports } from '../lib/reports'
import { TYPE_LABEL, typeColorClass } from '../lib/reportTypes'
import { pathFor, slugFromFilename } from '../lib/router'
import ReportHighlightCard from './ReportHighlightCard'
import ReportToc from './ReportToc'
import DecisionDashboard from './DecisionDashboard'
import KeyStatsStrip from './KeyStatsStrip'
import BottomDecisionBar from './BottomDecisionBar'

const SITE_TITLE = '台股法說會行事曆'

/** 組報告頁標題：「<name>｜<type> <date>｜台股法說會行事曆」。 */
function reportTitle(report) {
  return `${report.name}｜${report.type} ${report.date}｜${SITE_TITLE}`
}

export default function ReportView({ slug }) {
  const [report, setReport] = useState(undefined) // undefined = loading, null = not found
  const [err, setErr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug) {
      setReport(null)
      return
    }
    loadReports()
      .then((all) => {
        const found = all.find((r) => slugFromFilename(r.filename) === slug)
        setReport(found ?? null)
      })
      .catch(() => {
        setErr(true)
        setReport(null)
      })
  }, [slug])

  // 進報告頁把 document.title 換成該報告；離開／找不到時還原站名。
  useEffect(() => {
    if (report && report !== null) {
      document.title = reportTitle(report)
    }
    return () => {
      document.title = SITE_TITLE
    }
  }, [report])

  async function handleCopy() {
    const url = `${window.location.origin}${pathFor('report', slug)}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard API 不可用時的手動 fallback
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        window.prompt('複製這個連結：', url)
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

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
        <a href={pathFor('home')} className="nav-back">
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
        <a href={pathFor('home')} className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          返回首頁
        </a>
        <div className="report-not-found">
          <Inbox size={40} strokeWidth={1.5} className="report-not-found-icon" aria-hidden="true" />
          <p className="report-not-found-title">找不到這篇報告</p>
          <p className="report-not-found-hint">
            可能已移除或連結有誤，請回首頁查看最近報告。
          </p>
          <a href={pathFor('library')} className="btn-secondary">前往報告庫</a>
        </div>
      </div>
    )
  }

  const typeClass = typeColorClass(report.type)

  return (
    <article className="report-view-wrap">
      <nav className="report-view-nav">
        <a href={pathFor('home')} className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          首頁
        </a>
        <a href={pathFor('library')} className="nav-back">報告庫</a>
        <button
          type="button"
          className="nav-back"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={handleCopy}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              已複製
            </>
          ) : (
            <>
              <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
              複製分享連結
            </>
          )}
        </button>
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

      <DecisionDashboard decision={report.decision} />
      <KeyStatsStrip keyStats={report.keyStats} />
      <ReportHighlightCard highlights={report.highlights} />
      <ReportToc toc={report.toc} />

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

      <BottomDecisionBar decision={report.decision} />
    </article>
  )
}
