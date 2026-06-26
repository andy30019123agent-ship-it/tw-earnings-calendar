# 台股法說會行事曆 ＋ AI 研究工具

自動追蹤台股法說會，AI 輔助產出事前快報與事後詳細報告，並公開刊載於 GitHub Pages。

---

## 專案用途

1. **每週六自動掃描**下週所有上市/上櫃公司法說會（來源：MOPS）
2. 按市值大→小分組整理，同步推播到 **Telegram ＋ Discord**
3. 你回覆「研究 代號」→ CC 出**事前快報**，並記入追蹤清單
4. 事件隔天系統自動提醒（每日 11:00 台北時間）
5. 你回覆「詳細 代號」→ CC 出**事後詳細報告**
6. 快報與詳細報告 commit/push 到 main 後自動上架公開網頁

---

## 整體流程

```
週六 12:00
  GitHub Action 掃描 MOPS
        ↓
  推播行事曆到 TG + Discord
        ↓
  你回覆「研究 2330 2454」
        ↓
  CC 出【事前快報】並寫檔 + 更新 picks
        ↓
  commit/push → 自動上架 GitHub Pages
        ↓
  事件日隔天 11:00 → 系統提醒「昨天開完了」
        ↓
  你回覆「詳細 2330」
        ↓
  CC 查證 + 出【事後詳細報告】
        ↓
  commit/push → 自動上架
```

---

## 研究指令格式備忘（CC 接手必讀）

> 研究本身由 Claude Code 在對話中即時執行，不是自動化程式。
> 任何 CC session 接手都要遵守以下格式。

### 觸發：事前快報

Andy 說「研究 2330 2454」（可同時列多支）→ CC 做以下事情：

**報告內容（事前快報）**
- 近期業績概況（最近一到兩季重點數字，標明資料日期）
- 近期市場題材 + 可行性評估
- 多空論點
- 隱藏題材（市場還沒充分定價的機會）
- 隱藏合作／技術轉機
- 成長機會
- 後勢預測

**撰寫立場**
- 扮演「會質疑的分析師」，不幫公司護航
- 優先挖隱藏題材與機會，不只複述市場共識
- 數字查證後標明資料日期（查不到的欄位寫「查無」）
- 來源連結彙整於文末
- Andy 說「先別放」→ 不寫該檔，僅在對話呈現

**寫檔路徑**
```
web/reports/<id>-快報-<今日 YYYY-MM-DD>.md
```

**frontmatter 格式**
```yaml
---
id: 2330
name: 台積電
date: 2026-06-27      # 報告產出日
type: 快報
event_date: 2026-07-01  # 法說會日期
---
```

**同步更新 picks**（讓系統在事件隔天提醒）

```bash
# CC 讀取 data/latest.json，呼叫 add_picks([id,...], latest)
# 若 latest.json 已含當週資料，直接 import 更新：
python -m scripts.pick_store   # 無 CLI；CC 在 Python session 直接 import add_picks
```

實際做法：CC 讀取 `data/latest.json`，import `scripts.pick_store.add_picks`，傳入代號清單即可更新 `data/picks.json`。

---

### 觸發：事後詳細報告

Andy 說「詳細 2330」→ CC 做以下事情：

**報告內容（事後詳細報告）**
- 法說會實際公告現況（CC 即時查證，標明資料日期）
- 題材可行性與風險（對照快報預期是否兌現）
- 多空
- 隱藏題材（現在才確認的機會或風險）
- 隱藏合作／技術轉機
- 成長機會
- 後勢預測（依現況更新）

**撰寫立場**：同快報（質疑性分析師、挖隱藏、查數字、「查無」、彙整來源）

**寫檔路徑**
```
web/reports/<id>-詳細-<今日 YYYY-MM-DD>.md
```

**frontmatter 格式**
```yaml
---
id: 2330
name: 台積電
date: 2026-06-28      # 報告產出日
type: 詳細
event_date: 2026-07-01  # 對應的法說會日期
---
```

---

### 報告上架

寫完後執行：
```bash
git add web/reports/
git commit -m "report: 2330 快報 2026-06-27"
git push
```

push 到 main 後 `deploy.yml` 自動 build 並上架 GitHub Pages，約 1–2 分鐘生效。

---

## 本機測試

```bash
# Python 測試（31 個，全 pass）
python3 -m pytest -v

# 前端 build 測試（Vite）
cd web && npm run build

# 前端 unit 測試（Vitest）
cd web && npx vitest run

# 手動觸發週六掃描（需已設好環境變數）
python3 -m scripts.run_weekly

# 手動觸發每日提醒
python3 -m scripts.run_daily_remind
```

---

## 需要的 GitHub Secrets

| Secret 名稱 | 說明 |
|---|---|
| `TG_BOT_TOKEN` | Telegram Bot API Token |
| `TG_CHAT_ID` | Telegram 聊天 ID（值：542348223） |
| `DISCORD_WEBHOOK` | Discord Webhook URL |

**重要：** 金鑰只進 GitHub Secrets，永不進版控。`.env` 已列入 `.gitignore`。

---

## 上線前一次性人工步驟

1. 在 GitHub 建立 repo `tw-earnings-calendar`（建議帳號：andy30019123agent-ship-it），將本專案 push 上去
2. repo → Settings → Secrets and variables → Actions，新增以下三個 secret：
   - `TG_BOT_TOKEN`
   - `TG_CHAT_ID`（填 `542348223`）
   - `DISCORD_WEBHOOK`
3. Settings → Pages → Source 設為 **GitHub Actions**
4. 手動觸發一次 `weekly-calendar` workflow（Actions → weekly-calendar → Run workflow），確認推播到 TG ＋ Discord 均成功
5. 確認 Pages URL（`https://<org>.github.io/tw-earnings-calendar/`）可正常開啟，首頁行事曆與報告庫均正常

---

## 自動化排程

| Workflow | 排程（台北時間） | 功能 |
|---|---|---|
| `weekly.yml` | 週六 12:00 | 掃描下週法說會，推播 TG/Discord，更新 `data/latest.json` |
| `daily.yml` | 每日 11:00 | 對昨日到期事件推提醒（無到期則靜默） |
| `deploy.yml` | push 到 main 觸發 | Build Vite 網頁並部署 GitHub Pages |

---

## 公開研究網頁結構

- `/`：首頁，顯示本週法說會行事曆（從 `data/latest.json` 讀取）
- `/reports`：報告庫，可搜尋所有快報與詳細報告
- `/reports/<id>-<type>-<date>`：個別報告閱讀頁

---

## 已知限制

- **本期僅追蹤法說會**，不含財報發布日。財報未來預告目前無可靠官方批次來源（MOPS 相關 endpoint 均無法取得全市場未來財報日）。
- 詳細探勘紀錄請見 [`docs/datasource-notes.md`](docs/datasource-notes.md)。
- 財報事件列為未來待辦，待找到穩定資料源後補充。

---

## 專案目錄

```
tw-earnings-calendar/
├── scripts/           # Python 後端邏輯
│   ├── fetch_calendar.py   # 抓取 MOPS 法說會
│   ├── market_cap.py       # 補市值
│   ├── build_message.py    # 組推播訊息
│   ├── push.py             # 推播 TG + Discord
│   ├── pick_store.py       # 管理追蹤清單 picks.json
│   ├── run_weekly.py       # 週六主流程
│   └── run_daily_remind.py # 每日提醒主流程
├── web/               # Vite + React 前端（GitHub Pages）
│   ├── src/
│   │   └── components/     # CalendarCard, ReportLibrary, ReportView…
│   └── reports/            # Markdown 報告檔（快報 + 詳細）
├── data/              # 執行期資料
│   ├── latest.json         # 最新一週行事曆（週六更新）
│   └── picks.json          # 追蹤清單
├── tests/             # Python 測試（pytest）
├── docs/
│   └── datasource-notes.md # 資料源探勘紀錄
└── .github/workflows/ # GitHub Actions
    ├── weekly.yml
    ├── daily.yml
    └── deploy.yml
```
