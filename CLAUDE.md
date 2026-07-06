> 🧠 開工前先讀 `~/Desktop/agent/harness/thinking-core.md`（開工協定＋宣稱前防幻覺查核）；活大就派 subagent（`~/Desktop/agent/harness/model-dispatch.md` 紅線）。
> 回報、提問、要 Andy 選擇：一律照根目錄 `~/Desktop/agent/CLAUDE.md` 鐵則用 reply 工具發到頻道（純文字編號清單）；時間一律台北時間。
> 本專案現況與雷點以下文為準；改前先讀檔，改後實跑驗證才算完成。

# tw-earnings-calendar

台股法說會行事曆＋AI 研究工具，給 Andy 用：自動追蹤法說會、AI 輔助產出事前快報／事後詳細報告，公開刊載於 GitHub Pages。

**技術棧**：Python 後端（`requirements.txt`）＋ Vite/React 前端（`web/`）
**指令**：`python3 -m pytest -v`（後端測試）；`cd web && npm run build`；`cd web && npx vitest run`

專案現況與踩雷紀錄見記憶檔 `project_tw_earnings_calendar.md`。

**寫研究報告（「研究 XXXX」「詳細 XXXX」）必先讀 `docs/研究報告工作流.md`**——唯一權威 SOP（章節規格、資料源、品質關卡、scorecard 回驗），照著做，不憑記憶。

有 GitHub Actions：`weekly.yml`（週六 12:00 掃描推播）、`daily.yml`（每日 11:00 提醒）、`deploy.yml`（push main 觸發部署），正在線上運作中——改排程前先看記憶檔，別動到正在跑的排程。
