import { useEffect, useState } from 'react'

/**
 * 章節目錄 pill 列（sticky mini 目錄）。點擊捲動到對應標題（用 scrollIntoView，不碰 URL）。
 * 另加：捲動時「目前章節」高亮 + 一條閱讀進度條。
 *
 * 分組（契約 §4）：pill 依 toc[].group 分「先看(primary)／深入(deep)」兩排。
 * 降級：若沒有任何 primary 章節（舊報告），退化成單排不分組顯示，不破版。
 *
 * 為什麼用 button 而不是 <a href="#rh-x">：App.jsx 用真實路徑路由並全域攔截站內
 * <a> 點擊（見 lib/router.js），in-page 錨點連結會被誤攔成路由跳轉。改用
 * button + scrollIntoView 完全不動 URL，天然安全。
 *
 * 動效只改 transform/opacity/background，並全域尊重 prefers-reduced-motion（見 App.css）。
 * h2 少於 3 個時 ReportView 不會渲染這個元件（降級規則）。
 */
export default function ReportToc({ toc }) {
  const [activeId, setActiveId] = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!toc || toc.length < 3) return
    const headings = toc.map((t) => document.getElementById(t.id)).filter(Boolean)
    if (headings.length === 0) return

    // 目前章節：取「捲動線以上、最靠近的標題」為 active。
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    headings.forEach((h) => io.observe(h))

    // 閱讀進度：整頁捲動百分比。
    const onScroll = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - doc.clientHeight
      setProgress(total > 0 ? Math.min(1, Math.max(0, doc.scrollTop / total)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [toc])

  if (!toc || toc.length < 3) return null

  function handleClick(id) {
    document.getElementById(id)?.scrollIntoView()
  }

  const primary = toc.filter((t) => t.group === 'primary')
  const deep = toc.filter((t) => t.group !== 'primary')
  // 有 primary 才分組；否則（舊報告）退化成單排不分組
  const grouped = primary.length > 0

  const renderPill = (item) => {
    const isActive = activeId === item.id
    return (
      <button
        key={item.id}
        type="button"
        className={`report-toc-pill${isActive ? ' active' : ''}`}
        aria-current={isActive ? 'true' : undefined}
        onClick={() => handleClick(item.id)}
      >
        {item.label}
      </button>
    )
  }

  return (
    <nav className="report-toc" aria-label="報告章節目錄">
      {grouped ? (
        <>
          <div className="report-toc-group">
            <span className="report-toc-group-label">先看</span>
            <div className="report-toc-scroll">{primary.map(renderPill)}</div>
          </div>
          {deep.length > 0 && (
            <div className="report-toc-group">
              <span className="report-toc-group-label">深入</span>
              <div className="report-toc-scroll">{deep.map(renderPill)}</div>
            </div>
          )}
        </>
      ) : (
        <div className="report-toc-scroll">{toc.map(renderPill)}</div>
      )}
      <div className="report-toc-progress" aria-hidden="true">
        <div className="report-toc-progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </nav>
  )
}
