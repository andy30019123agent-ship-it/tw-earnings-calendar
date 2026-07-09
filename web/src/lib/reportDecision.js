/**
 * 決策 UI 的共用對照表（立場色塊、關鍵數字 status 色標）。
 *
 * 硬性約束（design-system/MASTER.md）：立場與 status 一律走 score/primary/accent/中性系，
 * 「絕不」借用 --up/--down（那是紅漲綠跌的行情語意色）。所以：
 *   - 正向（偏多／便宜）＝ score-hit（主題粉，正向）
 *   - 警示（偏空／偏貴／危險／避開）＝ score-miss（中性琥珀，未達標但非「下跌」）
 *   - 中性（觀望／合理）＝ flat / border（灰）
 */

/** 立場 → className 後綴。認不出的歸中性。 */
export function stanceClass(stance) {
  switch ((stance || '').trim()) {
    case '偏多':
      return 'stance-bull'
    case '偏空':
    case '避開':
    case '逢高減碼':
      return 'stance-bear'
    case '觀望':
    default:
      return 'stance-hold'
  }
}

/** 關鍵數字 status → className 後綴。認不出的歸中性。 */
export function statStatusClass(status) {
  switch ((status || '').trim()) {
    case '便宜':
      return 'stat-cheap'
    case '偏貴':
      return 'stat-expensive'
    case '危險':
      return 'stat-danger'
    case '合理':
    default:
      return 'stat-fair'
  }
}

/** 把字串／數字取出可用的浮點數；取不到回 null。 */
export function toNumber(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}
