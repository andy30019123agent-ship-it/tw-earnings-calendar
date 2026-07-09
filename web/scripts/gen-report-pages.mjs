/**
 * build 後置腳本：為每篇報告產生 dist/r/<slug>/index.html，
 * 把 <title> 換成該報告標題並注入 Open Graph meta，讓 LINE/Telegram
 * 預覽機器人抓得到正確的報告標題與摘要（它們看不到 SPA client render 的內容）。
 * 另外產生 dist/404.html（＝index.html 複本，通用 og），讓未預產生的路徑
 * 仍能落回 app（GitHub Pages 對缺頁自動回 404.html）。
 *
 * 抽摘要的正則刻意與 web/src/lib/reportMarkdown.js 的 SUMMARY_HEADING_RE 一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(WEB_DIR, 'dist')
const REPORTS_DIR = path.join(WEB_DIR, 'reports')

// 與 vite.config.js 的 base 對齊；正式站網址
const BASE = '/tw-earnings-calendar/'
const SITE_ORIGIN = 'https://andy30019123agent-ship-it.github.io'
const SITE_TITLE = '台股法說會行事曆'
const FALLBACK_DESC = '台股法說會行事曆的 AI 研究報告'

// 與 reportMarkdown.js SUMMARY_HEADING_RE 一致
const SUMMARY_HEADING_RE =
  /^##[ \t]*(?:\p{Extended_Pictographic}️?[ \t]*)?(?:一句話總結|一句話定位|一句話投資論點)[^\n]*\n+([\s\S]*?)(?=\n##[ \t]|\n---[ \t]*\n|$)/mu

/** 解析 frontmatter（與 reports.js parseFrontmatter 同邏輯）。 */
function parseFrontmatter(raw) {
  const result = {}
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { body: raw }
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) result[key] = value
  }
  result.body = match[2]
  return result
}

/** 去除 markdown 符號與指定 emoji，壓成單行純文字。 */
function stripMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 圖片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 連結留文字
    .replace(/~~/g, '') // 刪除線符號（單一 ~ 是數字區間如 5~25%，要保留）
    .replace(/[*_`]/g, '') // 粗斜體/行內碼符號
    .replace(/^[ \t]*[#>-]+[ \t]*/gm, '') // 標題/引用/清單標記
    .replace(/[✅🔮🟡]\s*/gu, '') // 指定 emoji（連同其後空格）
    .replace(/\s+/g, ' ')
    .trim()
}

/** 從報告內文抽「一句話總結」首段，清理後截 ~120 字。抽不到回 fallback。 */
function extractDescription(body) {
  const m = (body || '').match(SUMMARY_HEADING_RE)
  if (!m) return FALLBACK_DESC
  const firstPara = m[1].trim().split(/\n[ \t]*\n/)[0].trim()
  const clean = stripMarkdown(firstPara)
  if (!clean) return FALLBACK_DESC
  const chars = Array.from(clean)
  return chars.length > 120 ? chars.slice(0, 120).join('') + '…' : clean
}

/** HTML 屬性值轉義。 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function main() {
  const indexHtml = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8')

  // dist/404.html：index 複本（通用 og），讓未預產生路徑落回 app
  fs.writeFileSync(path.join(DIST_DIR, '404.html'), indexHtml)

  // /library、/scorecard 深連結：預產出實體頁（index 複本），讓伺服器直接回 200，
  // 不必靠 404 fallback。noindex meta 隨 index.html 複本一併帶入。
  for (const route of ['library', 'scorecard']) {
    const dir = path.join(DIST_DIR, route)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), indexHtml)
  }

  const files = fs.existsSync(REPORTS_DIR)
    ? fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.md'))
    : []

  let count = 0
  for (const file of files) {
    const raw = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8')
    const meta = parseFrontmatter(raw)
    const slug = file.replace(/\.md$/, '')
    const name = meta.name || ''
    const type = meta.type || ''
    const date = meta.date || ''

    const titleHead = `${name}｜${type} ${date}`.trim()
    const fullTitle = `${titleHead}｜${SITE_TITLE}`
    const desc = extractDescription(meta.body)
    const url = `${SITE_ORIGIN}${BASE}r/${slug}/`

    // 換掉 <title>
    let html = indexHtml.replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${esc(fullTitle)}</title>`,
    )

    // 把既有通用 description 換成該報告的（避免重複 meta）
    html = html.replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${esc(desc)}" />`,
    )

    // </head> 前注入 og meta
    const og = [
      `<meta property="og:title" content="${esc(titleHead)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:site_name" content="${esc(SITE_TITLE)}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
    ].join('\n    ')

    html = html.replace('</head>', `    ${og}\n  </head>`)

    const outDir = path.join(DIST_DIR, 'r', slug)
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'index.html'), html)
    count++
  }

  console.log(`[gen-report-pages] 產生 ${count} 篇報告 stub + 404.html + library/scorecard 深連結頁`)
}

main()
