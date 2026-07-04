import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Clock, XCircle } from 'lucide-react'
import scorecardData from '../data/scorecard.json'
import { computeStats, sortByPredictedOnDesc, uniqueStocks } from '../lib/scorecard'

const STATUS_LABEL = { hit: '命中', miss: '未中', pending: '未到期' }
const STATUS_ICON = { hit: CheckCircle2, miss: XCircle, pending: Clock }
const STATUS_ORDER = ['hit', 'miss', 'pending']

export default function Scorecard() {
  const predictions = scorecardData.predictions ?? []
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')

  const stats = useMemo(() => computeStats(predictions), [predictions])
  const stockOptions = useMemo(() => uniqueStocks(predictions), [predictions])

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
        <a href="#/" className="nav-back">
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
                href={`#/r/${encodeURIComponent(p.report ?? '')}`}
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
