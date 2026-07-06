/**
 * 章節目錄 pill 列。點擊捲動到對應標題（用 scrollIntoView，不碰 URL）。
 *
 * 為什麼用 button 而不是 <a href="#rh-x">：App.jsx 用真實路徑路由並全域攔截站內
 * <a> 點擊（見 lib/router.js），in-page 錨點連結會被誤攔成路由跳轉。改用
 * button + scrollIntoView 完全不動 URL，天然安全。
 *
 * h2 少於 3 個時 ReportView 不會渲染這個元件（降級規則）。
 */
export default function ReportToc({ toc }) {
  if (!toc || toc.length < 3) return null

  function handleClick(id) {
    document.getElementById(id)?.scrollIntoView()
  }

  return (
    <nav className="report-toc" aria-label="報告章節目錄">
      <div className="report-toc-scroll">
        {toc.map((item) => (
          <button
            key={item.id}
            type="button"
            className="report-toc-pill"
            onClick={() => handleClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
