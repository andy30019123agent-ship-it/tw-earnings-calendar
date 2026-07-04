import { marked, Renderer } from 'marked'

/**
 * 這個檔案處理「報告閱讀體驗優化」的三件事：
 * 1. renderReportMarkdown()：把報告 markdown 轉成 HTML，同時
 *    - 幫每個標題（h2/h3/h4）加上 id，供目錄 pill 點擊後 scrollIntoView 用
 *    - h2/h3 開頭若是對得上表的 emoji，轉成 Lucide icon（inline SVG 字串）；
 *      對不到表的 emoji 直接去掉，不留豆腐字
 *    - table 外面包一層 .table-scroll，手機才能左右捲動不撐爆版面
 *    同時回傳 toc（h2 清單，給目錄 pill 用）
 * 2. extractHighlights()：從「還沒轉 HTML 的」原始 markdown 內文抽「一句話總結/定位」
 *    與「多空評估」標題行，組出重點卡內容；抽不到總結就回傳 summaryHtml: null（不硬湊）
 *
 * 安全性：跟 reports.js 原本註解一致——這裡處理的都是 build time 靜態打包進來的
 * 本地 .md 檔，不含使用者輸入，dangerouslySetInnerHTML 沒有 XSS 風險。
 */

// ── Lucide icon 資料（複製自 lucide-react v1.23.0 對應 icon 的 __iconNode，
// 只取用得到的幾顆；因為這裡輸出的是 marked 產生的原始 HTML 字串，
// 不是 React tree，沒辦法直接塞 <Icon /> component，所以手刻等價 SVG）──
const ICON_NODES = {
  search: [
    ['path', { d: 'm21 21-4.34-4.34' }],
    ['circle', { cx: '11', cy: '11', r: '8' }],
  ],
  network: [
    ['rect', { x: '16', y: '16', width: '6', height: '6', rx: '1' }],
    ['rect', { x: '2', y: '16', width: '6', height: '6', rx: '1' }],
    ['rect', { x: '9', y: '2', width: '6', height: '6', rx: '1' }],
    ['path', { d: 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3' }],
    ['path', { d: 'M12 12V8' }],
  ],
  lightbulb: [
    [
      'path',
      {
        d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
      },
    ],
    ['path', { d: 'M9 18h6' }],
    ['path', { d: 'M10 22h4' }],
  ],
  brain: [
    ['path', { d: 'M12 18V5' }],
    ['path', { d: 'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4' }],
    ['path', { d: 'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5' }],
    ['path', { d: 'M17.997 5.125a4 4 0 0 1 2.526 5.77' }],
    ['path', { d: 'M18 18a4 4 0 0 0 2-7.464' }],
    ['path', { d: 'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517' }],
    ['path', { d: 'M6 18a4 4 0 0 1-2-7.464' }],
    ['path', { d: 'M6.003 5.125a4 4 0 0 0-2.526 5.77' }],
  ],
  pin: [
    ['path', { d: 'M12 17v5' }],
    [
      'path',
      {
        d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
      },
    ],
  ],
  target: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['circle', { cx: '12', cy: '12', r: '6' }],
    ['circle', { cx: '12', cy: '12', r: '2' }],
  ],
  'alert-triangle': [
    [
      'path',
      { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
    ],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }],
  ],
  'bar-chart-3': [
    ['path', { d: 'M3 3v16a2 2 0 0 0 2 2h16' }],
    ['path', { d: 'M18 17V9' }],
    ['path', { d: 'M13 17V5' }],
    ['path', { d: 'M8 17v-3' }],
  ],
  calendar: [
    ['path', { d: 'M8 2v4' }],
    ['path', { d: 'M16 2v4' }],
    ['rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' }],
    ['path', { d: 'M3 10h18' }],
  ],
  sparkles: [
    [
      'path',
      {
        d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
      },
    ],
    ['path', { d: 'M20 2v4' }],
    ['path', { d: 'M22 4h-4' }],
    ['circle', { cx: '4', cy: '20', r: '2' }],
  ],
  zap: [
    [
      'path',
      {
        d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
      },
    ],
  ],
}

/** 產生一顆 Lucide 風格的 inline SVG 字串（stroke 1.75，跟全站 icon 一致）。 */
export function iconSvg(name, { size = 18, className = '' } = {}) {
  const nodes = ICON_NODES[name]
  if (!nodes) return ''
  const inner = nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${attrStr}></${tag}>`
    })
    .join('')
  const cls = className ? ` class="${className}"` : ''
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}

// h2/h3 開頭 emoji（含常見 VS16 變體）→ icon 名稱對照表。
// 對不到表的 emoji（如 🆕💡）不當 icon，直接去掉、不留豆腐字。
const EMOJI_ICON_MAP = {
  '🔍': 'search',
  '🕸': 'network',
  '💭': 'lightbulb',
  '🧠': 'brain',
  '📌': 'pin',
  '🎯': 'target',
  '⚠': 'alert-triangle',
  '📊': 'bar-chart-3',
  '📅': 'calendar',
  '🔮': 'sparkles',
}

// 開頭 emoji（unicode pictographic + 可選 VS16）＋其後空白
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}️?)[ \t]*/u

/** 目錄 pill 標籤清理：去開頭 emoji、去「（請先讀）」類註記、截 8 字內。 */
function cleanTocLabel(rawText) {
  let text = rawText.replace(LEADING_EMOJI_RE, '').trim()
  // 去掉「請先讀」類提示性註記（全形/半形括號都算）
  text = text.replace(/[（(]請先讀[）)]/g, '').trim()
  if (!text) return ''
  const chars = Array.from(text)
  if (chars.length <= 8) return text
  return chars.slice(0, 8).join('') + '…'
}

/**
 * 建立一個「新的」marked Renderer（每次呼叫都是全新 instance，
 * 不共用任何跨報告的計數器狀態，Promise.all 平行處理多篇報告時不會互相污染）。
 * @returns {{ renderer: Renderer, getToc: () => Array<{id:string,label:string}> }}
 */
function createReportRenderer() {
  const renderer = new Renderer()
  const toc = []
  let counter = 0

  const defaultTable = Renderer.prototype.table

  renderer.heading = function headingRenderer(token) {
    const { depth, tokens, text } = token
    const id = `rh-${counter++}`
    let inlineHtml = this.parser.parseInline(tokens)
    let iconPrefix = ''

    if (depth === 2 || depth === 3) {
      const m = text.match(LEADING_EMOJI_RE)
      if (m) {
        const emojiChar = m[1].replace(/️/g, '')
        const iconName = EMOJI_ICON_MAP[emojiChar]
        if (iconName) {
          iconPrefix = `<span class="h-icon">${iconSvg(iconName, { size: depth === 2 ? 20 : 18 })}</span>`
        }
        // 不論對不對得到表，都要把 emoji 從渲染結果開頭移除（不留豆腐字）
        inlineHtml = inlineHtml.replace(LEADING_EMOJI_RE, '')
      }
    }

    if (depth === 2) {
      const label = cleanTocLabel(text)
      if (label) toc.push({ id, label })
    }

    return `<h${depth} id="${id}">${iconPrefix}${inlineHtml}</h${depth}>\n`
  }

  renderer.table = function tableRenderer(token) {
    return `<div class="table-scroll">${defaultTable.call(this, token)}</div>`
  }

  return { renderer, getToc: () => toc }
}

/**
 * 把報告 markdown 內文轉成 HTML，並回傳目錄（h2 清單）。
 * @param {string} body 已去除 frontmatter 的 markdown 內文
 * @returns {{ html: string, toc: Array<{id:string,label:string}> }}
 */
export function renderReportMarkdown(body) {
  const { renderer, getToc } = createReportRenderer()
  const html = marked(body || '', { renderer })
  return { html, toc: getToc() }
}

// ── 重點卡抽取（在轉 HTML 之前，直接對原始 markdown 抽字） ──

const SUMMARY_HEADING_RE =
  /^##[ \t]*(?:\p{Extended_Pictographic}️?[ \t]*)?(?:一句話總結|一句話定位|一句話投資論點)[ \t]*\n+([\s\S]*?)(?=\n##[ \t]|\n---[ \t]*\n|$)/mu

const OUTLOOK_HEADING_RE = /^##[ \t]*(?:\d+\.[ \t]*)?(?:\p{Extended_Pictographic}️?[ \t]*)?(多空評估[^\n]*)$/mu

/**
 * 從原始 markdown 抽重點卡內容：
 * ①「## 一句話總結」或「## 一句話定位」段落正文（第一段）
 * ②「多空評估」段標題行（找不到有意義文字則回傳 null）
 * 降級規則：抽不到①就整個回傳 summaryHtml: null，呼叫端要整張卡都不顯示。
 * @param {string} body 已去除 frontmatter 的 markdown 內文
 * @returns {{ summaryHtml: string|null, outlookHtml: string|null }}
 */
export function extractHighlights(body) {
  const src = body || ''

  const summaryMatch = src.match(SUMMARY_HEADING_RE)
  if (!summaryMatch) {
    return { summaryHtml: null, outlookHtml: null }
  }

  const block = summaryMatch[1].trim()
  const firstPara = block.split(/\n[ \t]*\n/)[0].trim()
  if (!firstPara) {
    return { summaryHtml: null, outlookHtml: null }
  }

  const summaryHtml = marked.parseInline(firstPara)

  const outlookMatch = src.match(OUTLOOK_HEADING_RE)
  const outlookText = outlookMatch ? outlookMatch[1].trim() : ''
  const outlookHtml = outlookText ? marked.parseInline(outlookText) : null

  return { summaryHtml, outlookHtml }
}
