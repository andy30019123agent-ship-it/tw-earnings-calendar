import { describe, it, expect } from 'vitest'
import { extractHighlights, renderReportMarkdown, iconSvg } from './reportMarkdown'

describe('extractHighlights', () => {
  it('抽到「一句話總結」正文與「多空評估」標題行', () => {
    const body = `## 一句話總結\n這是**重點**摘要第一段。\n\n第二段不算。\n\n## 多空評估：偏多（測試用）\n- 多：xxx\n`
    const h = extractHighlights(body)
    expect(h.summaryHtml).toContain('這是<strong>重點</strong>摘要第一段。')
    expect(h.summaryHtml).not.toContain('第二段不算')
    expect(h.outlookHtml).toBe('多空評估：偏多（測試用）')
  })

  it('支援「一句話定位」標題', () => {
    const body = `## 一句話定位\n定位文字。\n\n## 近期業績\n內容\n`
    const h = extractHighlights(body)
    expect(h.summaryHtml).toContain('定位文字。')
  })

  it('抽不到一句話總結／定位就整張卡降級為 null（不硬湊）', () => {
    const body = `## 重點摘要\n這篇報告用不同的標題格式。\n\n### 關鍵觀察指標\n- a\n`
    const h = extractHighlights(body)
    expect(h.summaryHtml).toBeNull()
    expect(h.outlookHtml).toBeNull()
  })

  it('數字編號前綴的多空評估標題也抓得到', () => {
    const body = `## 一句話總結\n摘要。\n\n## 3. 多空評估：中性偏多，但風險高\n內容\n`
    const h = extractHighlights(body)
    expect(h.outlookHtml).toBe('多空評估：中性偏多，但風險高')
  })
})

describe('renderReportMarkdown', () => {
  it('h2 標題加上 id 並收進 toc', () => {
    const body = `## 第一節\n內容一\n\n## 第二節\n內容二\n\n## 第三節\n內容三\n`
    const { html, toc } = renderReportMarkdown(body)
    expect(toc).toHaveLength(3)
    expect(toc[0].label).toBe('第一節')
    expect(html).toContain(`id="${toc[0].id}"`)
    expect(html).toContain(`id="${toc[1].id}"`)
  })

  it('對得到表的 h2 開頭 emoji 轉成 icon，不留原始 emoji 字元', () => {
    const { html } = renderReportMarkdown('## 🔍 深度延伸\n內容\n')
    expect(html).toContain('h-icon')
    expect(html).toContain('<svg')
    expect(html).not.toContain('🔍')
  })

  it('對不到表的 emoji 直接去掉、不留豆腐字也不強塞 icon', () => {
    const { html } = renderReportMarkdown('## 🆕 新題材\n內容\n')
    expect(html).not.toContain('🆕')
    expect(html).not.toContain('h-icon')
    expect(html).toContain('新題材')
  })

  it('h2 少於 3 個時 toc 仍照實回傳（顯示與否交給呼叫端判斷）', () => {
    const { toc } = renderReportMarkdown('## 只有一節\n內容\n')
    expect(toc).toHaveLength(1)
  })

  it('toc 標上「先看(primary)／深入(deep)」分組', () => {
    const body = `## 0. 操作結論\na\n\n## 估值面\nb\n\n## 財務品質紅旗\nc\n`
    const { toc } = renderReportMarkdown(body)
    const g = Object.fromEntries(toc.map((t) => [t.label, t.group]))
    expect(g['操作結論']).toBe('primary')
    expect(g['估值面']).toBe('primary')
    expect(g['財務品質紅旗']).toBe('deep')
  })

  it('進階洞察（含舊名深度延伸）章節包進 <details> 折疊', () => {
    const { html } = renderReportMarkdown('## 進階洞察\n供應鏈內容\n\n## 來源彙整\nx\n')
    expect(html).toContain('<details class="report-advanced"')
    expect(html).toContain('report-advanced-summary')
    expect(html).toContain('供應鏈內容')
    // 折疊區塊保留原 h2 的 id，供目錄 scrollIntoView
    expect(html).toMatch(/<details class="report-advanced" id="rh-\d+"/)
  })

  it('內文標記 emoji 弱化成 .emoji-mark 小標籤', () => {
    const { html } = renderReportMarkdown('段落 ✅ 命中 🔮 想像\n')
    expect(html).toContain('<span class="emoji-mark">✅</span>')
    expect(html).toContain('<span class="emoji-mark">🔮</span>')
  })

  it('table 外面包一層 .table-scroll 容器', () => {
    const body = `| a | b |\n|---|---|\n| 1 | 2 |\n`
    const { html } = renderReportMarkdown(body)
    expect(html).toContain('<div class="table-scroll">')
    expect(html).toContain('<table>')
  })

  it('去掉「（請先讀）」類註記並截 8 字內', () => {
    const body = `## 一句話總結\n摘要\n\n## ⚠️ 資料誠實聲明（請先讀）\n內容\n\n## 第三節\n內容\n`
    const { toc } = renderReportMarkdown(body)
    const target = toc.find((t) => t.label.startsWith('資料誠實聲明'))
    expect(target.label).toBe('資料誠實聲明')
  })
})

describe('iconSvg', () => {
  it('未知 icon 名稱回傳空字串', () => {
    expect(iconSvg('not-a-real-icon')).toBe('')
  })

  it('已知 icon 產生帶 stroke 屬性的 svg 字串', () => {
    const svg = iconSvg('zap', { size: 18 })
    expect(svg).toContain('<svg')
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).toContain('width="18"')
  })
})
