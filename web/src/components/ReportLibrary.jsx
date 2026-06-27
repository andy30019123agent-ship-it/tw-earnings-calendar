import { useEffect, useMemo, useState } from 'react'
import { loadReports } from '../lib/reports'
import { TYPE_LABEL, TYPE_ORDER, typeColorClass } from '../lib/reportTypes'

// 相對時間：今天 / 昨天 / N 天前（以台北日期計）
function relativeDay(dateStr) {
  if (!dateStr) return ''
  const today = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' })
  )
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${dateStr}T00:00:00+08:00`)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.round((today - d) / 86400000)
  if (diff <= 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${diff} 天前`
  if (diff < 30) return `${Math.floor(diff / 7)} 週前`
  return `${Math.floor(diff / 30)} 個月前`
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  const m = dateStr.match(/^\d{4}-(\d{2})-(\d{2})/)
  if (!m) return dateStr
  return `${Number(m[1])}/${Number(m[2])}`
}

export default function ReportLibrary() {
  const [reports, setReports] = useState(null) // null = loading
  const [err, setErr] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('date')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    loadReports()
      .then(setReports)
      .catch(() => {
        setErr(true)
        setReports([])
      })
  }, [])

  // 自動建議：依輸入比對「有報告的個股」，去重、最多 8 筆
  const suggestions = useMemo(() => {
    if (!reports) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    const seen = new Map()
    for (const r of reports) {
      const id = String(r.id)
      if (
        id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      ) {
        if (!seen.has(id)) seen.set(id, { id, name: r.name, count: 1 })
        else seen.get(id).count++
      }
    }
    return [...seen.values()].slice(0, 8)
  }, [reports, query])

  const filtered = useMemo(() => {
    if (!reports) return []
    const q = query.trim().toLowerCase()
    return reports.filter((r) => {
      const t = r.type === '詳細' ? '法說會' : r.type
      if (typeFilter !== 'all' && t !== typeFilter) return false
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      if (!q) return true
      return (
        String(r.id).toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      )
    })
  }, [reports, query, typeFilter, dateFrom, dateTo])

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
          <span className="range-label">{filtered.length} / {reports.length} 篇</span>
        </h2>
        <a href="#/" className="nav-back">← 返回首頁</a>
      </div>

      {err && <p className="error-note">報告載入失敗，請稍後再試。</p>}

      <div className="library-controls">
        <div className="search-box">
          <input
            className="search-input"
            type="search"
            placeholder="搜尋代號或名稱（例：23 → 2330 台積電）"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            aria-label="搜尋報告"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul className="suggest-list">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="suggest-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(String(s.id))
                      setSuggestOpen(false)
                    }}
                  >
                    <span className="suggest-code">{s.id}</span>
                    <span className="suggest-name">{s.name}</span>
                    <span className="suggest-count">{s.count} 篇</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 篩選器 */}
      <div className="filter-bar">
        <div className="filter-row">
          <span className="filter-label">類型</span>
          <div className="filter-chips">
            <button
              className={`filter-chip${typeFilter === 'all' ? ' active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              全部
            </button>
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                className={`filter-chip${typeFilter === t ? ' active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">排序</span>
          <div className="filter-chips">
            <button
              className={`filter-chip${groupBy === 'date' ? ' active' : ''}`}
              onClick={() => setGroupBy('date')}
            >
              依日期
            </button>
            <button
              className={`filter-chip${groupBy === 'stock' ? ' active' : ''}`}
              onClick={() => setGroupBy('stock')}
            >
              依股票
            </button>
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">期間</span>
          <div className="date-range">
            <input
              type="date"
              className="date-input"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="起始日期"
            />
            <span className="date-sep">～</span>
            <input
              type="date"
              className="date-input"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="結束日期"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                className="date-clear"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
                aria-label="清除日期"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="placeholder">
          {query || typeFilter !== 'all'
            ? '找不到符合條件的報告'
            : '目前尚無報告'}
        </p>
      ) : (
        <div className="library-groups">
          {grouped.map(([groupKey, items]) => (
            <div key={groupKey} className="library-group">
              <div className="library-group-label">
                {groupBy === 'date' ? `🗓 ${groupKey}` : groupKey}
                <span className="group-count">{items.length}</span>
              </div>
              <div className="report-cards">
                {items.map((r) => (
                  <a
                    key={r.filename}
                    href={`#/r/${encodeURIComponent(r.filename ?? '')}`}
                    className="report-card"
                  >
                    <div className="report-card-top">
                      <span className="report-code">{r.id}</span>
                      <span className="report-name">{r.name}</span>
                      <span className={`tag tag-${typeColorClass(r.type)}`}>
                        {TYPE_LABEL[r.type] ?? r.type ?? '—'}
                      </span>
                    </div>
                    <div className="report-card-meta">
                      <span>🗓 報告 {r.date}</span>
                      {relativeDay(r.date) && (
                        <span className="meta-rel">{relativeDay(r.date)}</span>
                      )}
                      {r.event_date && (
                        <span>📣 法說 {shortDate(r.event_date)}</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
