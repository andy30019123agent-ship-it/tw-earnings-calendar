import { renderReportMarkdown, extractHighlights } from './reportMarkdown'

/**
 * 解析單一 YAML 純量值：去頭尾空白、剝引號、砍掉行內 `# 註解`。
 * 契約 §1 的欄位可能帶引號（"950–1080"）或行尾註解（# 建議進場區），都要吃掉。
 */
function parseScalar(raw) {
  let s = (raw ?? '').trim()
  if (s.startsWith('"') || s.startsWith("'")) {
    const q = s[0]
    const end = s.indexOf(q, 1)
    return end === -1 ? s.slice(1) : s.slice(1, end)
  }
  // 只把「空白後的 #」當註解（避免砍掉值本身可能含的 #）
  const c = s.search(/\s#/)
  if (c !== -1) s = s.slice(0, c)
  return s.trim()
}

/** 依引號狀態切逗號：inline 物件 { a: "x", b: y } 內的值可能含逗號，不能硬切。 */
function splitTopLevelCommas(s) {
  const out = []
  let cur = ''
  let quote = null
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null
      cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** 解析 inline 物件字串 `{ label: "本益比", value: "18.5x", status: 合理 }` → 物件；空則回 null。 */
function parseInlineObject(str) {
  let t = str.trim()
  if (t.startsWith('{')) t = t.slice(1)
  if (t.endsWith('}')) t = t.slice(0, -1)
  const obj = {}
  for (const part of splitTopLevelCommas(t)) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (k) obj[k] = parseScalar(part.slice(idx + 1))
  }
  return Object.keys(obj).length ? obj : null
}

/** 從 start 起吃連續縮排行，組成子物件（decision 用）。回傳 {obj, next}。 */
function consumeIndentedMap(lines, start) {
  const obj = {}
  let i = start
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (!/^\s/.test(line)) break // 非縮排（含空行）＝區塊結束
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf(':')
    if (idx === -1) continue
    const k = t.slice(0, idx).trim()
    if (k) obj[k] = parseScalar(t.slice(idx + 1))
  }
  return { obj, next: i }
}

/** 從 start 起吃連續縮排的 `- { ... }` list（key_stats 用）。回傳 {arr, next}。 */
function consumeInlineObjectList(lines, start) {
  const arr = []
  let i = start
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (!/^\s/.test(line)) break
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    if (t.startsWith('-')) {
      const parsed = parseInlineObject(t.slice(1).trim())
      if (parsed) arr.push(parsed)
    }
  }
  return { arr, next: i }
}

/**
 * 解析 markdown 檔案的 frontmatter（--- 區塊）與內文。
 * 除了原本的 key: value 純量，另支援契約 §1 的兩個結構化欄位：
 *   - decision:（縮排子物件）→ result.decision（物件）
 *   - key_stats:（`- { ... }` 清單）→ result.key_stats（物件陣列）
 * 舊報告沒有這兩欄時 result.decision / result.key_stats 為 undefined，呼叫端降級。
 * @param {string} raw  原始 markdown 字串
 * @returns {{ [key: string]: any, body: string }}
 */
export function parseFrontmatter(raw) {
  const result = {}

  // 必須以 --- 開頭才有 frontmatter
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { body: raw }
  }

  const lines = match[1].split(/\r?\n/)
  const body = match[2]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s/.test(line)) continue // 縮排行由結構化區塊消費者處理，這裡略過
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const rawVal = line.slice(colonIdx + 1)

    if (key === 'decision' && rawVal.trim() === '') {
      const { obj, next } = consumeIndentedMap(lines, i + 1)
      if (Object.keys(obj).length) result.decision = obj
      i = next - 1
      continue
    }
    if (key === 'key_stats' && rawVal.trim() === '') {
      const { arr, next } = consumeInlineObjectList(lines, i + 1)
      if (arr.length) result.key_stats = arr
      i = next - 1
      continue
    }
    if (key) result[key] = parseScalar(rawVal)
  }

  result.body = body
  return result
}

/**
 * 讀取 web/reports/*.md，解析 frontmatter，轉換成 HTML，依 date 降冪排序。
 * @returns {Promise<Array<{id:string,name:string,date:string,type:string,body:string,html:string}>>}
 */
export async function loadReports() {
  // Vite 5+ glob API: query + import
  const modules = import.meta.glob('../../reports/*.md', { query: '?raw', import: 'default' })

  const reports = await Promise.all(
    Object.entries(modules).map(async ([path, loader]) => {
      const raw = await loader()
      const meta = parseFrontmatter(raw)
      const { html, toc } = renderReportMarkdown(meta.body || '')
      const highlights = extractHighlights(meta.body || '')
      const filename = path.split('/').pop()
      return {
        id: meta.id ?? '',
        name: meta.name ?? '',
        date: meta.date ?? '',
        event_date: meta.event_date ?? '',
        type: meta.type ?? '',
        decision: meta.decision ?? null,
        keyStats: meta.key_stats ?? null,
        body: meta.body ?? '',
        html,
        toc,
        highlights,
        filename,
      }
    })
  )

  // 依 date 降冪排序（字串比較對 YYYY-MM-DD 格式有效）
  reports.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))

  return reports
}
