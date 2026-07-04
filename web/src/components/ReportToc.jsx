/**
 * 章節目錄 pill 列。點擊捲動到對應標題（用 scrollIntoView，不碰 window.location.hash）。
 *
 * 為什麼不用 <a href="#rh-x">：App.jsx 是 hash-based router（#/、#/library、#/r/xxx），
 * 若真的把 hash 改成 #rh-x，會觸發 hashchange、被 parseHash() 判定成不存在的路由、
 * 整頁被導回首頁。改用 button + scrollIntoView 完全不動 hash，天然安全。
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
