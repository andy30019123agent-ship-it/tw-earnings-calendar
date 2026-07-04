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

/**
 * 依指定欄位（如 category、industry）聚合命中率統計，供成績單頁「分維度統計」使用。
 * 每個維度值算出 hit/miss/pending 與已判定命中率（分母為 0 時 hitRate 為 null）。
 * 缺該欄位（undefined/null）的預測不計入任何維度。
 * 結果依「該維度總筆數（hit+miss+pending）」多到少排序。
 * @param {Array<{status: string}>} predictions
 * @param {string} key - 要聚合的欄位名稱，如 'category' 或 'industry'
 * @returns {Array<{key:string, hit:number, miss:number, pending:number, judged:number, hitRate:number|null}>}
 */
export function statsByDimension(predictions, key) {
  const map = new Map()
  for (const p of predictions) {
    const dimValue = p[key]
    if (dimValue === undefined || dimValue === null) continue
    if (!map.has(dimValue)) map.set(dimValue, { hit: 0, miss: 0, pending: 0 })
    const entry = map.get(dimValue)
    if (p.status === 'hit') entry.hit++
    else if (p.status === 'miss') entry.miss++
    else entry.pending++
  }
  return [...map.entries()]
    .map(([dimValue, v]) => {
      const judged = v.hit + v.miss
      return {
        key: dimValue,
        hit: v.hit,
        miss: v.miss,
        pending: v.pending,
        judged,
        hitRate: judged === 0 ? null : v.hit / judged,
      }
    })
    .sort((a, b) => (b.hit + b.miss + b.pending) - (a.hit + a.miss + a.pending))
}
