import { Shield, CalendarClock } from 'lucide-react'
import { stanceClass } from '../lib/reportDecision'

/**
 * 手機底部常駐條：立場＋停損＋下一事件（契約 §4）。滑到報告深處仍看得到主判斷。
 * 只在手機（≤767）顯示（由 CSS 控制），桌機隱藏。
 *
 * 降級規則：decision 缺失 → 不顯示（回傳 null）。個別欄位缺 → 該格顯示「—」。
 */
export default function BottomDecisionBar({ decision }) {
  if (!decision || Object.keys(decision).length === 0) return null

  const stance = decision.stance || '—'
  const stop = decision.stop == null || decision.stop === '' ? '—' : decision.stop
  const nextEvent = decision.next_event

  return (
    <div className="bottom-decision-bar" role="complementary" aria-label="決策速覽（常駐）">
      <span className={`bdb-stance ${stanceClass(decision.stance)}`}>{stance}</span>
      <span className="bdb-item">
        <Shield size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="bdb-k">停損</span>
        <b>{stop}</b>
      </span>
      {nextEvent && (
        <span className="bdb-item bdb-next">
          <CalendarClock size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="bdb-v">{nextEvent}</span>
        </span>
      )}
    </div>
  )
}
