import { Zap } from 'lucide-react'

/**
 * 重點卡：報告最上方的速覽摘要。
 * 降級規則：highlights.summaryHtml 抽不到就整張卡不顯示（由呼叫端 ReportView 決定，
 * 這裡只負責畫，不補內容）。
 *
 * 安全性同 ReportView：summaryHtml/outlookHtml 皆由本地 .md 內文經 marked.parseInline
 * 產生，build time 靜態打包、不含使用者輸入，dangerouslySetInnerHTML 無 XSS 風險。
 */
export default function ReportHighlightCard({ highlights }) {
  if (!highlights?.summaryHtml) return null

  return (
    <section className="report-highlight-card" aria-label="重點速覽">
      <p className="report-highlight-title">
        <Zap size={18} strokeWidth={1.75} aria-hidden="true" />
        重點速覽
      </p>
      <p
        className="report-highlight-summary"
        dangerouslySetInnerHTML={{ __html: highlights.summaryHtml }}
      />
      {highlights.outlookHtml && (
        <p
          className="report-highlight-outlook"
          dangerouslySetInnerHTML={{ __html: highlights.outlookHtml }}
        />
      )}
    </section>
  )
}
