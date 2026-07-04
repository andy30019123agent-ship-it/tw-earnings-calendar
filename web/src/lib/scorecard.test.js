import { describe, it, expect } from 'vitest'
import { computeStats, sortByPredictedOnDesc, uniqueStocks } from './scorecard'

describe('computeStats', () => {
  it('算出 hit/miss/pending 與命中率', () => {
    const preds = [
      { status: 'hit' },
      { status: 'hit' },
      { status: 'miss' },
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
    ]
    const s = computeStats(preds)
    expect(s).toEqual({ hit: 2, miss: 1, pending: 3, total: 6, hitRate: 2 / 3 })
  })

  it('分母為 0（無 hit 也無 miss）時 hitRate 為 null', () => {
    const s = computeStats([{ status: 'pending' }, { status: 'pending' }])
    expect(s.hitRate).toBeNull()
  })

  it('空陣列不會出錯', () => {
    const s = computeStats([])
    expect(s).toEqual({ hit: 0, miss: 0, pending: 0, total: 0, hitRate: null })
  })
})

describe('sortByPredictedOnDesc', () => {
  it('依 predicted_on 新到舊排序，不改動原陣列', () => {
    const preds = [
      { pid: 'a', predicted_on: '2026-06-01' },
      { pid: 'b', predicted_on: '2026-06-27' },
      { pid: 'c', predicted_on: '2026-06-15' },
    ]
    const sorted = sortByPredictedOnDesc(preds)
    expect(sorted.map((p) => p.pid)).toEqual(['b', 'c', 'a'])
    expect(preds.map((p) => p.pid)).toEqual(['a', 'b', 'c'])
  })
})

describe('uniqueStocks', () => {
  it('依代號去重並排序', () => {
    const preds = [
      { stock_id: '2308', stock_name: '台達電' },
      { stock_id: '2303', stock_name: '聯電' },
      { stock_id: '2308', stock_name: '台達電' },
    ]
    expect(uniqueStocks(preds)).toEqual([
      ['2303', '聯電'],
      ['2308', '台達電'],
    ])
  })
})
