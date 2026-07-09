import { Target, Clock, Flag, Shield, LogIn, RotateCcw, CalendarClock, Gauge } from 'lucide-react'
import { stanceClass, toNumber } from '../lib/reportDecision'

/**
 * 決策儀表板：報告頁頂、重點速覽卡之上。一屏看完今日操作結論。
 * 讀 frontmatter 的 decision 物件（契約 §1）。
 *
 * 降級規則（最重要）：decision 缺失或為空 → 整塊不顯示；個別欄位缺 → 顯示「—」，
 * 合理區間三值不齊 → 退化成純數字 chip，不畫刻度條。任何情況都不得破版。
 *
 * 顏色鐵則：立場色塊只用 score/中性系（見 reportDecision.js），
 * 絕不借用漲跌紅綠（--up/--down）。
 */

function val(x) {
  return x == null || x === '' ? '—' : x
}

/** 信心 5 格條（非交通燈；靠格數表達高低，符合 MASTER）。 */
function ConfidenceBar({ value }) {
  const raw = toNumber(value)
  const n = raw == null ? 0 : Math.max(0, Math.min(5, Math.round(raw)))
  return (
    <div className="conf-bar" role="img" aria-label={`信心 ${n || '未評'} / 5`}>
      <span className="conf-segs" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`conf-seg${i <= n ? ' on' : ''}`} />
        ))}
      </span>
      <span className="conf-num">{n ? `${n}/5` : '—'}</span>
    </div>
  )
}

/** 合理價刻度條：保守-中性-樂觀＋現價位置。三值不齊時退化成 chip 列。 */
function FairValueRange({ low, mid, high, price }) {
  const lo = toNumber(low)
  const hi = toNumber(high)
  const md = toNumber(mid)
  const pr = toNumber(price)
  const hasChips = low != null || mid != null || high != null
  if (!hasChips) return null

  // 能畫刻度條：需要 low/high 為數字且 high>low
  if (lo != null && hi != null && hi > lo) {
    const clamp = (v) => Math.max(0, Math.min(100, v))
    const midPct = md != null ? clamp(((md - lo) / (hi - lo)) * 100) : null
    const pricePct = pr != null ? clamp(((pr - lo) / (hi - lo)) * 100) : null
    return (
      <div className="dd-range">
        <div className="dd-range-track">
          {midPct != null && (
            <span className="dd-range-mid" style={{ left: `${midPct}%` }} aria-hidden="true" />
          )}
          {pricePct != null && (
            <span className="dd-range-price" style={{ left: `${pricePct}%` }}>
              <span className="dd-range-price-dot" aria-hidden="true" />
              <span className="dd-range-price-tag">現價</span>
            </span>
          )}
        </div>
        <div className="dd-range-scale">
          <span><i>保守</i>{val(low)}</span>
          <span className="dd-range-scale-mid"><i>中性</i>{val(mid)}</span>
          <span className="dd-range-scale-hi"><i>樂觀</i>{val(high)}</span>
        </div>
      </div>
    )
  }

  // 退化：純 chip 列
  return (
    <div className="dd-range-chips">
      {low != null && <span className="dd-chip"><i>保守</i>{low}</span>}
      {mid != null && <span className="dd-chip"><i>中性</i>{mid}</span>}
      {high != null && <span className="dd-chip"><i>樂觀</i>{high}</span>}
    </div>
  )
}

export default function DecisionDashboard({ decision }) {
  if (!decision || Object.keys(decision).length === 0) return null

  const {
    stance,
    price,
    fair_low,
    fair_mid,
    fair_high,
    entry,
    stop,
    take_profit,
    timeframe,
    confidence,
    invalidation,
    next_event,
  } = decision

  const hasValuation = fair_low != null || fair_mid != null || fair_high != null || price != null

  return (
    <section className="decision-dashboard" aria-label="決策儀表板">
      <div className="dd-head">
        <div className={`dd-stance ${stanceClass(stance)}`}>
          <span className="dd-stance-label">今日結論</span>
          <span className="dd-stance-value">{val(stance)}</span>
          {timeframe && <span className="dd-stance-tf"><Clock size={14} strokeWidth={1.75} aria-hidden="true" />{timeframe}</span>}
        </div>
        <div className="dd-confidence">
          <span className="dd-mini-label"><Gauge size={16} strokeWidth={1.75} aria-hidden="true" />信心</span>
          <ConfidenceBar value={confidence} />
        </div>
      </div>

      {hasValuation && (
        <div className="dd-valuation">
          <div className="dd-val-head">
            <span className="dd-mini-label"><Target size={16} strokeWidth={1.75} aria-hidden="true" />合理區間</span>
            {price != null && <span className="dd-price">現價 <b>{price}</b></span>}
          </div>
          <FairValueRange low={fair_low} mid={fair_mid} high={fair_high} price={price} />
        </div>
      )}

      <div className="dd-levels">
        <div className="dd-level">
          <span className="dd-level-k"><LogIn size={16} strokeWidth={1.75} aria-hidden="true" />進場</span>
          <b className="dd-level-v">{val(entry)}</b>
        </div>
        <div className="dd-level">
          <span className="dd-level-k"><Shield size={16} strokeWidth={1.75} aria-hidden="true" />停損</span>
          <b className="dd-level-v">{val(stop)}</b>
        </div>
        <div className="dd-level">
          <span className="dd-level-k"><Flag size={16} strokeWidth={1.75} aria-hidden="true" />停利</span>
          <b className="dd-level-v">{val(take_profit)}</b>
        </div>
      </div>

      {invalidation && (
        <div className="dd-note">
          <span className="dd-note-k"><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />翻盤條件</span>
          <span className="dd-note-v">{invalidation}</span>
        </div>
      )}
      {next_event && (
        <div className="dd-note">
          <span className="dd-note-k"><CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />下一事件</span>
          <span className="dd-note-v">{next_event}</span>
        </div>
      )}
    </section>
  )
}
