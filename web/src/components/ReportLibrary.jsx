import { useEffect, useMemo, useState } from 'react'
import { loadReports } from '../lib/reports'
import { TYPE_LABEL, typeColorClass } from '../lib/reportTypes'

export default function ReportLibrary() {
  const [reports, setReports] = useState(null) // null = loading
  const [err, setErr] = useState(false)
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState('date') // 'date' | 'stock'

  useEffect(() => {
    loadReports()
      .then(setReports)
      .catch(() => {
        setErr(true)
        setReports([])
      })
  }, [])

  const filtered = useMemo(() => {
    if (!reports) return []
    const q = query.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(
      (r) =>
        String(r.id).toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    )
  }, [reports, query])

  // 分組
  const grouped = useMemo(() => {
    if (groupBy === 'stock') {
      const map = new Map()
      for (const r of filtered) {
        const key = r.id ? `${r.id} ${r.name}` : '（未分類）'
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(r)
      }
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-Hant'))
    }
    // 依日期
    const map = new Map()
    for (const r of filtered) {
      const key = r.date || '（未知日期）'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.entries()].sort(([a], [b]) => (b > a ? 1 : b < a ? -1 : 0))
  }, [filtered, groupBy])

  if (reports === null) {
    return (
      <div className="library-wrap">
        <h2 className="section-title">📚 報告庫</h2>
        <p className="placeholder">載入中…</p>
      </div>
    )
  }

  return (
    <div className="library-wrap">
      <div className="library-header">
        <h2 className="section-title">
          📚 報告庫
          <span className="range-label">{reports.length} 篇</span>
        </h2>
        <a href="#/" className="nav-back">← 返回首頁</a>
      </div>

      {err && <p className="error-note">報告載入失敗，請稍後再試。</p>}

      <div className="library-controls">
        <input
          className="search-input"
          type="search"
          placeholder="搜尋代號或名稱…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜尋報告"
        />
        <div className="group-toggle">
          <button
            className={`toggle-btn${groupBy === 'date' ? ' active' : ''}`}
            onClick={() => setGroupBy('date')}
          >
            依日期
          </button>
          <button
            className={`toggle-btn${groupBy === 'stock' ? ' active' : ''}`}
            onClick={() => setGroupBy('stock')}
          >
            依股票
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="placeholder">
          {query ? `找不到「${query}」相關報告` : '目前尚無報告'}
        </p>
      ) : (
        <div className="library-groups">
          {grouped.map(([groupKey, items]) => (
            <div key={groupKey} className="library-group">
              <div className="library-group-label">{groupKey}</div>
              <ul className="report-list">
                {items.map((r) => (
                  <li key={r.filename} className="report-item">
                    <a
                      href={`#/r/${encodeURIComponent(r.filename ?? '')}`}
                      className="report-link"
                    >
                      <span className="report-code">{r.id}</span>
                      <span className="report-name">{r.name}</span>
                      <span
                        className={`report-type tag tag-${typeColorClass(r.type)}`}
                      >
                        {TYPE_LABEL[r.type] ?? r.type ?? '—'}
                      </span>
                      <span className="report-date">{r.date}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
