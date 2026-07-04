/**
 * 命中率成績單的純函式：統計與排序，抽出來方便單元測試。
 */

/**
 * 依 predictions 陣列算出命中率統計。
 * 已判定命中率 = hit / (hit + miss)；分母為 0 時回傳 null（畫面顯示「—」）。
 * @param {Array<{status: string}>} predictions
 * @returns {{hit:number, miss:number, pending:number, total:number, hitRate:number|null}}
 */
export function computeStats(predictions) {
  let hit = 0
  let miss = 0
  let pending = 0
  for (const p of predictions) {
    if (p.status === 'hit') hit++
    else if (p.status === 'miss') miss++
    else pending++
  }
  const decided = hit + miss
  const hitRate = decided === 0 ? null : hit / decided
  return { hit, miss, pending, total: predictions.length, hitRate }
}

/** 依 predicted_on 新到舊排序（不改動原陣列）。 */
export function sortByPredictedOnDesc(predictions) {
  return [...predictions].sort((a, b) => {
    if (a.predicted_on === b.predicted_on) return 0
    return a.predicted_on > b.predicted_on ? -1 : 1
  })
}

/** 依代號去重取得「股票下拉選單」用的清單，依代號排序。 */
export function uniqueStocks(predictions) {
  const map = new Map()
  for (const p of predictions) {
    if (!map.has(p.stock_id)) map.set(p.stock_id, p.stock_name)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}
