import { useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Clock, Gauge, XCircle } from 'lucide-react'
import scorecardData from '../data/scorecard.json'
import { computeStats, sortByPredictedOnDesc, statsByDimension, uniqueStocks } from '../lib/scorecard'
import { pathFor, slugFromFilename } from '../lib/router'

const STATUS_LABEL = { hit: '命中', miss: '未中', pending: '未到期' }
const STATUS_ICON = { hit: CheckCircle2, miss: XCircle, pending: Clock }
const STATUS_ORDER = ['hit', 'miss', 'pending']

/** 5 級信心量表對照表：信心分數（1-5）→ 顯示標籤。 */
const CONFIDENCE_LABEL = {
  5: '🟢 很可能（~80%↑）',
  4: '🟢 有機會（~60–80%）',
  3: '🟡 一半一半（~40–60%）',
  2: '🟠 偏低（~20–40%）',
  1: '🔴 不太可能（~<20%）',
}
const confidenceLabel = (level) => CONFIDENCE_LABEL[level] ?? `信心 ${level}`

/** 分維度統計卡：一列一個維度值，附命中率、細項與進度條。labelFor 可自訂列標籤顯示（預設直接顯示 key）。 */
function DimensionCard({ title, rows, labelFor = (key) => key }) {
  return (
    <div className="dim-card">
      <h4 className="dim-card-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="dim-empty">無資料</p>
      ) : (
        <ul className="dim-list">
          {rows.map((row) => {
            const rateDisplay = row.hitRate === null ? '—' : `${Math.round(row.hitRate * 100)}%`
            return (
              <li className="dim-row" key={row.key}>
                <div className="dim-row-top">
                  <span className="dim-name">{labelFor(row.key)}</span>
                  <span className={row.hitRate === null ? 'dim-rate' : 'dim-rate dim-rate-value'}>
                    {rateDisplay}
                  </span>
                </div>
                <div className="dim-bar-track">
                  {row.judged > 0 && (
                    <div className="dim-bar-fill" style={{ width: `${row.hitRate * 100}%` }} />
                  )}
                </div>
                <div className="dim-detail">
                  命中 {row.hit}／未中 {row.miss}／未到期 {row.pending}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Scorecard() {
  const predictions = scorecardData.predictions ?? []
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')

  const stats = useMemo(() => computeStats(predictions), [predictions])
  const stockOptions = useMemo(() => uniqueStocks(predictions), [predictions])
  const categoryStats = useMemo(() => statsByDimension(predictions, 'category'), [predictions])
  const industryStats = useMemo(() => statsByDimension(predictions, 'industry'), [predictions])
  const confidenceStats = useMemo(
    () => [...statsByDimension(predictions, 'confidence')].sort((a, b) => b.key - a.key),
    [predictions],
  )
  const confidenceJudged = confidenceStats.reduce((sum, row) => sum + row.judged, 0)
  const judgedCount = stats.hit + stats.miss

  const filtered = useMemo(() => {
    return sortByPredictedOnDesc(predictions).filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (stockFilter !== 'all' && p.stock_id !== stockFilter) return false
      return true
    })
  }, [predictions, statusFilter, stockFilter])

  const rateDisplay = stats.hitRate === null ? '—' : `${Math.round(stats.hitRate * 100)}%`

  return (
    <div className="library-wrap scorecard-wrap">
      <div className="library-header">
        <h2 className="section-title">
          <ClipboardList size={20} strokeWidth={1.75} aria-hidden="true" />
          預測命中率成績單
          <span className="range-label">
            {filtered.length} / {predictions.length} 筆
          </span>
        </h2>
        <a href={pathFor('home')} className="nav-back">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          返回首頁
        </a>
      </div>

      <div className="stat-grid sc-stat-grid">
        <div className="stat-tile sc-rate-tile">
          <div className="st-name">已判定命中率</div>
          <div className="st-value">{rateDisplay}</div>
        </div>
        <div className="stat-tile">
          <div className="st-name">命中</div>
          <div className="st-value sc-value-hit">{stats.hit}</div>
        </div>
        <div className="stat-tile">
          <div className="st-name">未中</div>
          <div className="st-value sc-value-miss">{stats.miss}</div>
        </div>
        <div className="stat-tile">
          <div className="st-name">未到期</div>
          <div className="st-value sc-value-pending">{stats.pending}</div>
        </div>
      </div>

      <p className="sc-note">
        回驗規則：寫新報告順手回驗＋每月全面回驗；準確第一，判不準維持未到期。
      </p>
      <p className="sc-disclaimer">AI 輔助研究，僅供參考，非投資建議。</p>

      <div className="dim-stats-section">
        <h3 className="section-title dim-stats-title">
          <BarChart3 size={18} strokeWidth={1.75} aria-hidden="true" />
          分維度統計
        </h3>
        <div className="dim-stats-grid">
          <DimensionCard title="按預測類型" rows={categoryStats} />
          <DimensionCard title="按產業" rows={industryStats} />
        </div>
        <p className="dim-stats-note">
          已判定樣本滿 30 筆將啟動「研究驗證分」回饋選股（規格已備）；目前已判定 {judgedCount} 筆，樣本仍少，命中率僅供參考。
        </p>
      </div>

      <div className="dim-stats-section">
        <h3 className="section-title dim-stats-title">
          <Gauge size={18} strokeWidth={1.75} aria-hidden="true" />
          信心校準
        </h3>
        <p className="dim-stats-note">
          檢視「說越有把握，是否真的越常命中」；只計入已標註信心分數的預測，舊預測（未評分）不列入。
        </p>
        {confidenceJudged === 0 ? (
          <p className="dim-empty" style={{ marginTop: 16 }}>
            預測陸續驗證後，這裡會顯示各信心級的命中率。
          </p>
        ) : (
          <div className="dim-stats-grid" style={{ gridTemplateColumns: '1fr' }}>
            <DimensionCard title="依信心級命中率" rows={confidenceStats} labelFor={confidenceLabel} />
          </div>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-row">
          <span className="filter-label">狀態</span>
          <div className="filter-chips">
            <button
              type="button"
              className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              全部
            </button>
            {STATUS_ORDER.map((s) => {
              const Icon = STATUS_ICON[s]
              return (
                <button
                  key={s}
                  type="button"
                  className={`filter-chip${statusFilter === s ? ' active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </button>
              )
            })}
          </div>
        </div>
        <div className="filter-row">
          <span className="filter-label">股票</span>
          <select
            className="input sc-stock-select"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            aria-label="依股票篩選"
          >
            <option value="all">全部股票</option>
            {stockOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {id} {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="placeholder">找不到符合條件的預測</p>
      ) : (
        <div className="report-cards sc-cards">
          {filtered.map((p) => {
            const Icon = STATUS_ICON[p.status] ?? Clock
            return (
              <a
                key={p.pid}
                href={pathFor('report', slugFromFilename(p.report))}
                className="report-card sc-card"
              >
                <div className="report-card-top">
                  <span className="report-code">{p.stock_id}</span>
                  <span className="report-name">{p.stock_name}</span>
                  <span className={`status-pill status-${p.status}`}>
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <p className="sc-claim">{p.claim}</p>
                <div className="report-card-meta">
                  <span className="meta-item">
                    <CalendarClock size={14} strokeWidth={1.75} aria-hidden="true" />
                    預測 {p.predicted_on}
                  </span>
                  {p.verifiable?.deadline && (
                    <span className="meta-item">
                      <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                      期限 {p.verifiable.deadline}
                    </span>
                  )}
                </div>
                {p.status !== 'pending' && p.evidence && (
                  <p className="sc-evidence">{p.evidence}</p>
                )}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
