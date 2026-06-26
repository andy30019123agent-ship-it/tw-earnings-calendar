import { useEffect, useState } from 'react'
import { loadReports } from '../lib/reports'

const TYPE_LABEL = {
  快報: '快報',
  詳報: '詳報',
  提醒: '提醒',
}

export default function ReportList() {
  const [reports, setReports] = useState(null) // null = loading
  const [err, setErr] = useState(false)

  useEffect(() => {
    loadReports()
      .then((all) => setReports(all.slice(0, 10)))
      .catch(() => {
        setErr(true)
        setReports([])
      })
  }, [])

  if (reports === null) {
    return (
      <section className="report-list-section">
        <h2 className="section-title">📄 最近報告</h2>
        <p className="placeholder">載入中…</p>
      </section>
    )
  }

  return (
    <section className="report-list-section">
      <h2 className="section-title">📄 最近報告</h2>

      {err && <p className="error-note">報告載入失敗，請稍後再試。</p>}

      {reports.length === 0 && !err ? (
        <p className="placeholder">目前尚無報告</p>
      ) : (
        <ul className="report-list">
          {reports.map((r) => (
            <li key={r.filename} className="report-item">
              <a href={`#/r/${encodeURIComponent(r.filename ?? '')}`} className="report-link">
                <span className="report-code">{r.id}</span>
                <span className="report-name">{r.name}</span>
                <span className={`report-type tag tag-${r.type === '法說會' ? 'conf' : 'earn'}`}>
                  {TYPE_LABEL[r.type] ?? r.type ?? '—'}
                </span>
                <span className="report-date">{r.date}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
