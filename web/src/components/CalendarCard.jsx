import { useEffect, useState } from 'react'

/**
 * 將 YYYY-MM-DD 格式轉成中文日期標題，例如 06/30（一）
 */
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const wd = weekdays[d.getDay()]
  return `${mm}/${dd}（${wd}）`
}

export default function CalendarCard() {
  const [groupedEvents, setGroupedEvents] = useState(null) // null = loading
  const [range, setRange] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/latest.json`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const events = Array.isArray(data.events) ? data.events : []
        // 依 date 分組
        const groups = {}
        for (const ev of events) {
          const d = ev.date ?? ev.event_date ?? ''
          if (!d) continue
          if (!groups[d]) groups[d] = []
          groups[d].push(ev)
        }
        // 各日期內依市值降冪排序（0/未知排最後）
        for (const d of Object.keys(groups)) {
          groups[d].sort((a, b) => {
            const ca = a.market_cap || 0
            const cb = b.market_cap || 0
            if (ca === 0 && cb === 0) return 0
            if (ca === 0) return 1
            if (cb === 0) return -1
            return cb - ca
          })
        }
        // 排序日期
        const sorted = Object.fromEntries(
          Object.entries(groups).sort(([a], [b]) => (a > b ? 1 : -1))
        )
        setGroupedEvents(sorted)
        setRange(data.range ?? null)
      })
      .catch(() => {
        setError(true)
        setGroupedEvents({})
      })
  }, [])

  if (groupedEvents === null) {
    return (
      <section className="calendar-card">
        <h2 className="section-title">📅 下週法說會行事曆</h2>
        <p className="placeholder">載入中…</p>
      </section>
    )
  }

  const dates = Object.keys(groupedEvents)
  const isEmpty = dates.length === 0

  return (
    <section className="calendar-card">
      <h2 className="section-title">
        📅 下週法說會行事曆
        {range && Array.isArray(range) && range.length === 2 && (
          <span className="range-label">{range[0]} ～ {range[1]}</span>
        )}
      </h2>

      {isEmpty ? (
        <p className="placeholder">下週暫無行程{error ? '（資料讀取失敗）' : ''}</p>
      ) : (
        <div className="calendar-days">
          {dates.map((date) => (
            <div key={date} className="day-group">
              <h3 className="day-label">{formatDateLabel(date)}</h3>
              <ul className="event-list">
                {groupedEvents[date].map((ev, i) => (
                  <li key={i} className="event-item">
                    <span className="event-code">{ev.id ?? ev.stock_id ?? '—'}</span>
                    <span className="event-name">{ev.name ?? ev.stock_name ?? '—'}</span>
                    <span className={`event-type tag tag-${ev.type === '法說會' ? 'conf' : 'earn'}`}>
                      {ev.type ?? '—'}
                    </span>
                    {ev.industry && (
                      <span className="event-industry">{ev.industry}</span>
                    )}
                    {ev.market_cap ? (
                      <span className="event-mktcap">
                        {Math.round(ev.market_cap)} 億{ev.cap_is_estimate ? '(估)' : ''}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
