import { AlertTriangle } from 'lucide-react'
import { statStatusClass } from '../lib/reportDecision'

/**
 * 關鍵數字卡：橫向可捲的小卡列，每張 label / value / status 色標（契約 §4）。
 * 讀 frontmatter 的 key_stats（物件陣列）。
 *
 * 降級規則：keyStats 缺失或空陣列 → 整塊不顯示。單張缺 value 仍畫（顯示 —）。
 * status 色標只用 score/中性系，不用漲跌紅綠（見 reportDecision.js）。
 */
export default function KeyStatsStrip({ keyStats }) {
  if (!Array.isArray(keyStats) || keyStats.length === 0) return null

  return (
    <section className="key-stats" aria-label="關鍵數字">
      <div className="key-stats-scroll">
        {keyStats.map((s, i) => {
          const status = s.status || ''
          const cls = statStatusClass(status)
          const isDanger = status.trim() === '危險'
          return (
            <div key={i} className={`ks-card ${cls}`}>
              <span className="ks-label">{s.label || '—'}</span>
              <span className="ks-value">{s.value ?? '—'}</span>
              {status && (
                <span className="ks-status">
                  {isDanger && <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />}
                  {status}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
