import { marked } from 'marked'

/**
 * 解析 markdown 檔案的 frontmatter（--- 區塊）與內文。
 * @param {string} raw  原始 markdown 字串
 * @returns {{ [key: string]: string, body: string }}
 */
export function parseFrontmatter(raw) {
  const result = {}

  // 必須以 --- 開頭才有 frontmatter
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { body: raw }
  }

  const fmBlock = match[1]
  const body = match[2]

  // 逐行解析 key: value
  for (const line of fmBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key) result[key] = value
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
  const modules = import.meta.glob('../reports/*.md', { query: '?raw', import: 'default' })

  const reports = await Promise.all(
    Object.entries(modules).map(async ([path, loader]) => {
      const raw = await loader()
      const meta = parseFrontmatter(raw)
      const html = marked(meta.body || '')
      const filename = path.split('/').pop()
      return {
        id: meta.id ?? '',
        name: meta.name ?? '',
        date: meta.date ?? '',
        type: meta.type ?? '',
        body: meta.body ?? '',
        html,
        filename,
      }
    })
  )

  // 依 date 降冪排序（字串比較對 YYYY-MM-DD 格式有效）
  reports.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))

  return reports
}
