import { describe, it, expect } from 'vitest'
import { computeStats, sortByPredictedOnDesc, uniqueStocks, statsByDimension } from './scorecard'

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

describe('statsByDimension', () => {
  it('空陣列回傳空陣列', () => {
    expect(statsByDimension([], 'category')).toEqual([])
  })

  it('全為 pending 時各維度 hitRate 為 null 且 judged 為 0', () => {
    const preds = [
      { category: '量產時程', status: 'pending' },
      { category: '量產時程', status: 'pending' },
      { category: '獲利能力', status: 'pending' },
    ]
    const result = statsByDimension(preds, 'category')
    expect(result).toEqual([
      { key: '量產時程', hit: 0, miss: 0, pending: 2, judged: 0, hitRate: null },
      { key: '獲利能力', hit: 0, miss: 0, pending: 1, judged: 0, hitRate: null },
    ])
  })

  it('混合情境：算出各維度 hit/miss/pending、命中率，並依總筆數多到少排序', () => {
    const preds = [
      { category: '量產時程', status: 'hit' },
      { category: '量產時程', status: 'miss' },
      { category: '量產時程', status: 'pending' },
      { category: '量產時程', status: 'pending' },
      { category: '獲利能力', status: 'hit' },
      { category: '獲利能力', status: 'hit' },
      { category: '獲利能力', status: 'miss' },
      { category: '題材發酵', status: 'pending' },
    ]
    const result = statsByDimension(preds, 'category')
    expect(result).toEqual([
      { key: '量產時程', hit: 1, miss: 1, pending: 2, judged: 2, hitRate: 0.5 },
      { key: '獲利能力', hit: 2, miss: 1, pending: 0, judged: 3, hitRate: 2 / 3 },
      { key: '題材發酵', hit: 0, miss: 0, pending: 1, judged: 0, hitRate: null },
    ])
  })

  it('缺該欄位的預測不計入任何維度', () => {
    const preds = [
      { category: '量產時程', status: 'hit' },
      { status: 'hit' },
      { category: null, status: 'miss' },
    ]
    const result = statsByDimension(preds, 'category')
    expect(result).toEqual([{ key: '量產時程', hit: 1, miss: 0, pending: 0, judged: 1, hitRate: 1 }])
  })

  it('依 industry 欄位聚合', () => {
    const preds = [
      { industry: '半導體業', status: 'miss' },
      { industry: '電子零組件業', status: 'hit' },
      { industry: '電子零組件業', status: 'hit' },
    ]
    const result = statsByDimension(preds, 'industry')
    expect(result).toEqual([
      { key: '電子零組件業', hit: 2, miss: 0, pending: 0, judged: 2, hitRate: 1 },
      { key: '半導體業', hit: 0, miss: 1, pending: 0, judged: 1, hitRate: 0 },
    ])
  })

  it('依 confidence（數字 key）聚合，confidence 為 null 的舊預測不計入', () => {
    const preds = [
      { confidence: 5, status: 'hit' },
      { confidence: 5, status: 'hit' },
      { confidence: 3, status: 'miss' },
      { confidence: 3, status: 'pending' },
      { confidence: null, status: 'hit' },
      { status: 'miss' },
    ]
    const result = statsByDimension(preds, 'confidence')
    expect(result).toEqual([
      { key: 5, hit: 2, miss: 0, pending: 0, judged: 2, hitRate: 1 },
      { key: 3, hit: 0, miss: 1, pending: 1, judged: 1, hitRate: 0 },
    ])
  })
})
