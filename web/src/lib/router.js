/**
 * 極簡自寫路由（history.pushState + popstate，不引入 react-router）。
 *
 * 網站部署在 GitHub Pages 子路徑（vite base = /tw-earnings-calendar/），
 * 所有路徑都以 BASE 為前綴。報告頁改用真實路徑 <base>r/<slug>/，
 * 讓 LINE/Telegram 預覽機器人抓得到（# 後面的東西它們看不到）。
 */

// Vite 注入的 base（含結尾斜線），例：'/tw-earnings-calendar/'
export const BASE = import.meta.env.BASE_URL

/** 檔名去掉 .md 就是 slug（保留中文）。 */
export function slugFromFilename(filename) {
  return String(filename ?? '').replace(/\.md$/, '')
}

/**
 * 產生某路由的絕對路徑（含 base）。
 * @param {'home'|'library'|'scorecard'|'report'} route
 * @param {string} [slug] route === 'report' 時的報告 slug
 */
export function pathFor(route, slug) {
  switch (route) {
    case 'library':
      return `${BASE}library`
    case 'scorecard':
      return `${BASE}scorecard`
    case 'report':
      return `${BASE}r/${slug}/`
    default:
      return BASE
  }
}

/**
 * 把 pathname 解析成路由描述。接受報告路徑有無結尾斜線。
 * @param {string} pathname window.location.pathname
 * @returns {{route:string, slug?:string}}
 */
export function parsePath(pathname) {
  let rel = pathname
  if (rel.startsWith(BASE)) rel = rel.slice(BASE.length)
  else rel = rel.replace(/^\//, '')
  rel = rel.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!rel) return { route: 'home' }
  if (rel === 'library') return { route: 'library' }
  if (rel === 'scorecard') return { route: 'scorecard' }
  const m = rel.match(/^r\/(.+)$/)
  if (m) {
    let slug = m[1]
    try {
      slug = decodeURIComponent(slug)
    } catch {
      // 非法百分比編碼就原樣使用
    }
    return { route: 'report', slug }
  }
  return { route: 'home' }
}

/**
 * 把舊 hash 連結（#/、#/library、#/scorecard、#/r/<檔名>.md）換算成新路徑；
 * 不是可辨識的舊路由就回 null（呼叫端不動）。
 * @param {string} hash window.location.hash
 * @returns {string|null} 新的絕對路徑，或 null
 */
export function legacyHashToPath(hash) {
  const h = String(hash ?? '').replace(/^#/, '')
  if (!h) return null
  if (h === '/' ) return pathFor('home')
  if (h === '/library') return pathFor('library')
  if (h === '/scorecard') return pathFor('scorecard')
  const m = h.match(/^\/r\/(.+)$/)
  if (m) {
    let filename = m[1]
    try {
      filename = decodeURIComponent(filename)
    } catch {
      // 保持原樣
    }
    return pathFor('report', slugFromFilename(filename))
  }
  return null
}
