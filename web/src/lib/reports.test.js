import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './reports'

describe('parseFrontmatter', () => {
  it('擷取 frontmatter 與內文', () => {
    const raw = `---\nid: 2330\nname: 台積電\ndate: 2026-06-27\ntype: 快報\n---\n內文一行`
    const r = parseFrontmatter(raw)
    expect(r.id).toBe('2330')
    expect(r.type).toBe('快報')
    expect(r.body.trim()).toBe('內文一行')
  })

  it('解析 decision 物件（含引號、行內註解、縮排）', () => {
    const raw = [
      '---',
      'id: 2454',
      'decision:',
      '  stance: 觀望        # 今日結論',
      '  price: 1180',
      '  fair_low: 950',
      '  entry: "950–1080"   # 建議進場區',
      '  confidence: 3',
      '  invalidation: "毛利率跌破 45%"',
      '# 註解行',
      'type: 快報',
      '---',
      '內文',
    ].join('\n')
    const r = parseFrontmatter(raw)
    expect(r.decision).toBeTypeOf('object')
    expect(r.decision.stance).toBe('觀望')
    expect(r.decision.price).toBe('1180')
    expect(r.decision.entry).toBe('950–1080')
    expect(r.decision.confidence).toBe('3')
    expect(r.decision.invalidation).toBe('毛利率跌破 45%')
    expect(r.type).toBe('快報') // decision 區塊後的頂層鍵仍正確解析
    expect(r.body.trim()).toBe('內文')
  })

  it('解析 key_stats（- { ... } inline 物件清單）', () => {
    const raw = [
      '---',
      'id: 2454',
      'key_stats:',
      '  - { label: "本益比", value: "18.5x", status: 合理 }',
      '  - { label: "股價位置", value: "半年 +32%", status: 偏貴 }',
      '---',
      '內文',
    ].join('\n')
    const r = parseFrontmatter(raw)
    expect(Array.isArray(r.key_stats)).toBe(true)
    expect(r.key_stats).toHaveLength(2)
    expect(r.key_stats[0]).toEqual({ label: '本益比', value: '18.5x', status: '合理' })
    expect(r.key_stats[1].value).toBe('半年 +32%')
  })

  it('舊報告（無 decision／key_stats）→ 兩欄皆 undefined（降級）', () => {
    const raw = `---\nid: 2330\nname: 台積電\ntype: 快報\n---\n內文`
    const r = parseFrontmatter(raw)
    expect(r.decision).toBeUndefined()
    expect(r.key_stats).toBeUndefined()
  })
})
