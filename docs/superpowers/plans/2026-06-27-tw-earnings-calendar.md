# 台股法說會／財報行事曆＋分析工具 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每週六自動掃台股下週法說會／財報並推播（TG＋Discord）；Andy 挑標的後由 CC 即時做事前快報，事件隔天系統自動提醒、CC 出事後詳細報告，所有報告存進公開研究網頁。

**Architecture:** 三塊鬆耦合——(1) Python 掃描／推播管線，(2) `picks.json` 追蹤狀態 + 每日提醒，(3) Vite+React 研究存放網頁（GitHub Pages）。爬取層用「正規化事件模型 `CalendarEvent`」當內部契約隔離 MOPS 的不穩定，下游程式只吃乾淨格式。研究「怎麼做」不寫進程式，由 CC 即時做、產出 markdown 報告檔給網頁渲染。

**Tech Stack:** Python 3.11（urllib + curl 雙路徑、pytest）、Vite + React 18、GitHub Actions（cron + Pages 部署）、Telegram Bot API、Discord Webhook。

## Global Constraints

- 介面、推播、報告一律**繁體中文**；中文與英數間加半形空格。
- 資料源**只用免費官方源**（MOPS、TWSE、TPEX）；不接付費源。
- 市場範圍：**上市（sii）＋上櫃（otc）全市場**。
- 所有密鑰（TG bot token＝`8822595401:...`、TG chat id＝`542348223`、Discord webhook URL）**只放 GitHub Secrets / 本機環境變數，永不進版控**；`.gitignore` 防呆。
- 時間一律**台北時間（UTC+8）**；cron 用 UTC 換算後標註。
- 財報「實際公布日」不可得 → 一律以「公司在 MOPS 預告的董事會／法說會日」為準，推播表尾誠實標示。
- 研究報告核心是**評估與預測**（題材可行性與風險、隱藏題材、隱藏合作、成長機會），**優先主動挖隱藏題材與機會**；數字查證、標日期、寧缺勿錯、查不到講「查無」。
- 不做後端／登入／資料庫；報告即 repo 內 markdown 檔。
- TDD：每個 Python 任務先寫失敗測試再實作；頻繁 commit。

## 正規化資料模型（全專案共用契約）

```python
# scripts/lib/models.py
from dataclasses import dataclass, asdict

@dataclass
class CalendarEvent:
    id: str            # 股票代號，如 "2330"
    name: str          # "台積電"
    market: str        # "上市" | "上櫃"
    industry: str      # 產業，如 "半導體"；查無填 ""
    date: str          # 事件日 ISO "2026-07-01"
    type: str          # "法說會" | "財報"
    market_cap: float  # 市值（億元），無法取得時為 0.0
    cap_is_estimate: bool  # True=以成交值近似排序

    def to_dict(self):
        return asdict(self)
```

下游（排序、組訊息、latest.json、提醒）**只依賴這個結構**，不碰 MOPS 原始格式。

---

### Task 1: 專案骨架

**Files:**
- Create: `tw-earnings-calendar/.gitignore`
- Create: `tw-earnings-calendar/requirements.txt`
- Create: `tw-earnings-calendar/pytest.ini`
- Create: `tw-earnings-calendar/scripts/__init__.py`, `scripts/lib/__init__.py`
- Create: `tw-earnings-calendar/scripts/lib/models.py`
- Create: `tw-earnings-calendar/tests/__init__.py`, `tests/test_models.py`

**Interfaces:**
- Produces: `CalendarEvent` dataclass（上方定義）。

- [ ] **Step 1: 建 .gitignore（密鑰與產物防呆）**

```gitignore
__pycache__/
*.pyc
.venv/
node_modules/
web/dist/
.env
*.local
.DS_Store
```

- [ ] **Step 2: requirements.txt 與 pytest.ini**

`requirements.txt`：
```
pytest==8.2.0
```
（爬取只用標準庫 urllib + 系統 curl，不加重依賴。）

`pytest.ini`：
```ini
[pytest]
testpaths = tests
```

- [ ] **Step 3: 寫失敗測試 tests/test_models.py**

```python
from scripts.lib.models import CalendarEvent

def test_calendar_event_to_dict():
    e = CalendarEvent(id="2330", name="台積電", market="上市",
                      industry="半導體", date="2026-07-01", type="法說會",
                      market_cap=28500.0, cap_is_estimate=False)
    d = e.to_dict()
    assert d["id"] == "2330"
    assert d["type"] == "法說會"
    assert d["cap_is_estimate"] is False
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `cd tw-earnings-calendar && python -m pytest tests/test_models.py -v`
Expected: FAIL（ModuleNotFoundError: scripts.lib.models）

- [ ] **Step 5: 寫 scripts/lib/models.py**（用上方「正規化資料模型」完整內容）

- [ ] **Step 6: 跑測試確認通過**

Run: `python -m pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 7: git init 並首次 commit**

```bash
cd tw-earnings-calendar
git init
git add .gitignore requirements.txt pytest.ini scripts tests
git commit -m "chore: 專案骨架與 CalendarEvent 正規化模型"
```

---

### Task 2: 資料源驗證 spike ＋ 行事曆抓取（fetch_calendar）

> ⚠️ 本任務含「驗證」步驟，是整個專案最高風險點。MOPS 有防爬（直打會被擋），必須先找到一條穩定可抓的路。先做 Step 1 的探勘，**把實際可用的 endpoint 與回傳欄位記進 `docs/datasource-notes.md`**，再依實況實作 parser。下游全部依賴本任務輸出的 `CalendarEvent` 正規化清單，不碰原始格式。

**Files:**
- Create: `tw-earnings-calendar/docs/datasource-notes.md`（探勘紀錄）
- Create: `tw-earnings-calendar/scripts/lib/http.py`（curl + urllib 雙路徑重試）
- Create: `tw-earnings-calendar/scripts/fetch_calendar.py`
- Create: `tw-earnings-calendar/tests/fixtures/`（存真實回應樣本）
- Create: `tw-earnings-calendar/tests/test_fetch_calendar.py`

**Interfaces:**
- Consumes: `CalendarEvent`（Task 1）。
- Produces: `fetch_events(start_iso: str, end_iso: str) -> list[CalendarEvent]`（依日期窗回傳該區間所有法說會／財報事件，市值欄位先填 0.0，由 Task 3 補）。
- Produces: `scripts/lib/http.get_text(url, *, data=None, headers=None, tries=3) -> str|None`。

- [ ] **Step 1: 資料源探勘（手動驗證，記錄成 datasource-notes.md）**

依序實測下列候選，找出能穩定回傳「未來日期 + 公司 + 法說會/財報」的來源，把可用者的 URL、HTTP method、必要 headers、回傳格式與欄位位置寫進 `docs/datasource-notes.md`：

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
# 候選 A：新版 MOPS SPA 後端 JSON API（host 可能為 mopsov.twse.com.tw）
curl -s -A "$UA" -H "Referer: https://mopsov.twse.com.tw/" \
  "https://mopsov.twse.com.tw/mops/api/t100sb02_1" -H "Content-Type: application/json" --data '{"TYPEK":"sii"}' | head -c 800
# 候選 B：法人說明會（舊版需正確 Referer/Cookie）
curl -s -A "$UA" -e "https://mops.twse.com.tw/mops/web/t100sb02_1" \
  "https://mops.twse.com.tw/mops/web/ajax_t100sb02_1" \
  --data "encodeURIComponent=1&step=1&firstin=1&TYPEK=sii" | head -c 800
# 候選 C：TWSE 公司治理/重大行事曆 OpenAPI
curl -s -A "$UA" "https://openapi.twse.com.tw/v1/opendata/t187ap04_L" | head -c 800
# 候選 D（備援）：TPEX 上櫃法說會公告
curl -s -A "$UA" "https://www.tpex.org.tw/openapi/v1/..." | head -c 400
```

驗收：`docs/datasource-notes.md` 內至少記下「法說會」與「財報/董事會」各一條**實測可回傳未來事件**的來源與欄位對應。若官方源全部不可靠，紀錄改用 TWSE OpenAPI（`openapi.twse.com.tw`，無防爬）能取得的範圍，並把缺口（如上櫃法說會）明確標示為已知限制。

- [ ] **Step 2: 寫 http.py（雙路徑抓取）**

```python
# scripts/lib/http.py
import subprocess, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")

def get_text(url, *, data=None, headers=None, tries=3):
    """先試 urllib，失敗改用系統 curl；皆失敗回 None。data 為 bytes 表 POST。"""
    hdr = {"User-Agent": UA, **(headers or {})}
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=hdr,
                                         method="POST" if data else "GET")
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            pass
        try:
            cmd = ["curl", "-s", "-m", "25", "-A", UA]
            for k, v in (headers or {}).items():
                cmd += ["-H", f"{k}: {v}"]
            if data:
                cmd += ["--data-binary", data.decode("utf-8", "replace")]
            cmd.append(url)
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if out.returncode == 0 and out.stdout:
                return out.stdout
        except Exception:
            pass
    return None
```

- [ ] **Step 3: 存一份真實回應 fixture**

把 Step 1 找到的可用來源回應存成 `tests/fixtures/calendar_sample.json`（或 .html），供測試離線使用——避免測試打外網而不穩。

- [ ] **Step 4: 寫失敗測試 tests/test_fetch_calendar.py**

```python
import json, pathlib
from scripts.fetch_calendar import parse_events
from scripts.lib.models import CalendarEvent

FIX = pathlib.Path(__file__).parent / "fixtures" / "calendar_sample.json"

def test_parse_events_returns_calendar_events():
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-29", end_iso="2026-07-05")
    assert len(events) > 0
    assert all(isinstance(e, CalendarEvent) for e in events)
    # 全部落在日期窗內
    assert all("2026-06-29" <= e.date <= "2026-07-05" for e in events)
    # 類型只有兩種
    assert all(e.type in ("法說會", "財報") for e in events)
```

> 註：`parse_events(raw, start_iso, end_iso)` 的欄位對應依 Step 1 實測格式填寫；fixture 的真實內容讓測試斷言具體可驗。

- [ ] **Step 5: 跑測試確認失敗**

Run: `python -m pytest tests/test_fetch_calendar.py -v`
Expected: FAIL（無 parse_events）

- [ ] **Step 6: 實作 fetch_calendar.py**

依 Step 1 紀錄實作 `parse_events(raw, start_iso, end_iso)`（解析→過濾日期窗→去重→轉 `CalendarEvent`，market_cap 先 0.0）與 `fetch_events(start_iso, end_iso)`（呼叫 `get_text` 抓來源後交給 `parse_events`）。`is_common_stock`：代號為 4 位數字才收（濾掉 ETF／權證）。

- [ ] **Step 7: 跑測試確認通過 + 實打一次**

```bash
python -m pytest tests/test_fetch_calendar.py -v   # PASS
python -c "from scripts.fetch_calendar import fetch_events; print(len(fetch_events('2026-06-29','2026-07-05')))"
```
Expected: 測試 PASS；實打印出事件數（>0 表來源活著）。

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/http.py scripts/fetch_calendar.py tests/ docs/datasource-notes.md
git commit -m "feat: 行事曆抓取與正規化（含資料源探勘紀錄）"
```

---

### Task 3: 市值排序（market_cap）

**Files:**
- Create: `tw-earnings-calendar/scripts/market_cap.py`
- Create: `tw-earnings-calendar/data/shares_cache.json`（初始 `{}`）
- Create: `tw-earnings-calendar/tests/test_market_cap.py`

**Interfaces:**
- Consumes: `CalendarEvent`（Task 1）、`get_text`（Task 2）。
- Produces: `enrich_market_cap(events: list[CalendarEvent]) -> list[CalendarEvent]`（填 `market_cap` 與 `cap_is_estimate`）。
- Produces: `load_shares() -> dict[str,int]`、`refresh_shares() -> dict[str,int]`（代號→已發行股數）。

- [ ] **Step 1: 寫失敗測試 tests/test_market_cap.py**

```python
from scripts.lib.models import CalendarEvent
from scripts import market_cap

def test_enrich_uses_shares_when_available(monkeypatch):
    monkeypatch.setattr(market_cap, "load_shares", lambda: {"2330": 25930000000})
    monkeypatch.setattr(market_cap, "_latest_close", lambda ids: {"2330": 1100.0})
    e = CalendarEvent("2330","台積電","上市","半導體","2026-07-01","法說會",0.0,False)
    out = market_cap.enrich_market_cap([e])[0]
    # 市值(億) = 1100 * 25,930,000,000 / 1e8 ≈ 285230
    assert out.market_cap > 280000 and out.cap_is_estimate is False

def test_enrich_falls_back_to_turnover(monkeypatch):
    monkeypatch.setattr(market_cap, "load_shares", lambda: {})  # 無股數
    monkeypatch.setattr(market_cap, "_latest_close", lambda ids: {"6666": 50.0})
    monkeypatch.setattr(market_cap, "_latest_volume", lambda ids: {"6666": 3000000})
    e = CalendarEvent("6666","某股","上櫃","其他","2026-07-02","法說會",0.0,False)
    out = market_cap.enrich_market_cap([e])[0]
    assert out.cap_is_estimate is True and out.market_cap > 0
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `python -m pytest tests/test_market_cap.py -v`
Expected: FAIL（無 market_cap 模組）

- [ ] **Step 3: 實作 market_cap.py**

- `load_shares()`：讀 `data/shares_cache.json`。
- `refresh_shares()`：抓 TWSE 上市公司基本資料（`openapi.twse.com.tw/v1/opendata/t187ap03_L`，含實收資本額/股數）＋ TPEX 上櫃基本資料，組 `{代號: 股數}` 寫回快取。
- `_latest_close(ids)` / `_latest_volume(ids)`：用 TWSE `MI_INDEX type=ALL` 與 TPEX `dailyQuotes`（沿用選股站既有做法）取最新收盤與成交量。
- `enrich_market_cap(events)`：有股數→市值(億)=close×股數/1e8、`cap_is_estimate=False`；無股數→以成交值(close×量)近似、`cap_is_estimate=True`；都抓不到→保持 0.0。

- [ ] **Step 4: 跑測試確認通過**

Run: `python -m pytest tests/test_market_cap.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/market_cap.py data/shares_cache.json tests/test_market_cap.py
git commit -m "feat: 市值排序（股數快取，備援成交值）"
```

---

### Task 4: 組行事曆訊息與 latest.json（build_message）

**Files:**
- Create: `tw-earnings-calendar/scripts/build_message.py`
- Create: `tw-earnings-calendar/scripts/lib/dates.py`
- Create: `tw-earnings-calendar/tests/test_build_message.py`, `tests/test_dates.py`

**Interfaces:**
- Consumes: `CalendarEvent`。
- Produces: `scripts/lib/dates.next_week_window(today: date) -> tuple[str,str]`（回下週一、下週日 ISO）。
- Produces: `build_calendar_message(events, start_iso, end_iso) -> str`、`build_latest_json(events, start_iso, end_iso) -> dict`。

- [ ] **Step 1: 寫失敗測試 tests/test_dates.py**

```python
from datetime import date
from scripts.lib.dates import next_week_window

def test_next_week_window_from_saturday():
    # 2026-06-27 是週六，下週一=06-29、下週日=07-05
    assert next_week_window(date(2026,6,27)) == ("2026-06-29","2026-07-05")
```

- [ ] **Step 2: 跑測試確認失敗 → 實作 dates.py → 跑測試通過**

```python
# scripts/lib/dates.py
from datetime import date, timedelta
def next_week_window(today):
    monday = today + timedelta(days=(7 - today.weekday()))  # 下週一
    sunday = monday + timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()
```
Run: `python -m pytest tests/test_dates.py -v` → PASS

- [ ] **Step 3: 寫失敗測試 tests/test_build_message.py**

```python
from scripts.lib.models import CalendarEvent
from scripts.build_message import build_calendar_message, build_latest_json

EVTS = [
    CalendarEvent("2330","台積電","上市","半導體","2026-07-01","法說會",285000.0,False),
    CalendarEvent("2454","聯發科","上市","半導體","2026-07-01","法說會",92000.0,False),
    CalendarEvent("3008","大立光","上市","光電","2026-07-03","財報",4000.0,False),
]

def test_message_groups_by_day_and_sorts_by_cap():
    msg = build_calendar_message(EVTS, "2026-06-29", "2026-07-05")
    assert "7/1" in msg and "7/3" in msg
    # 同日內台積電(285000)排在聯發科(92000)前
    assert msg.index("2330") < msg.index("2454")
    # 表尾誠實標示
    assert "非投資建議" in msg or "預告" in msg

def test_empty_message_not_silent():
    msg = build_calendar_message([], "2026-06-29", "2026-07-05")
    assert "暫無" in msg

def test_latest_json_shape():
    j = build_latest_json(EVTS, "2026-06-29", "2026-07-05")
    assert j["range"] == ["2026-06-29","2026-07-05"]
    assert len(j["events"]) == 3
```

- [ ] **Step 4: 跑測試確認失敗 → 實作 build_message.py → 跑測試通過**

`build_calendar_message`：依 `date` 分組（升冪），組內依 `market_cap` 降冪；每筆格式 `代號 名稱  類型  產業  市值(億)`（estimate 標「(估)」）；空清單回「下週暫無已申報的法說會／財報行程」；表尾加「資料源：MOPS 預告，財報實際公布日以公司公告為準・非投資建議」。`build_latest_json`：`{"updated":..., "range":[s,e], "events":[e.to_dict()...]}`。
Run: `python -m pytest tests/test_build_message.py -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/build_message.py scripts/lib/dates.py tests/test_build_message.py tests/test_dates.py
git commit -m "feat: 組行事曆訊息（每日分組+市值排序）與 latest.json"
```

---

### Task 5: 推播管道（push）

**Files:**
- Create: `tw-earnings-calendar/scripts/push.py`
- Create: `tw-earnings-calendar/tests/test_push.py`

**Interfaces:**
- Produces: `push_telegram(text) -> bool`、`push_discord(text) -> bool`、`push_all(text) -> None`（讀環境變數 `TG_BOT_TOKEN`、`TG_CHAT_ID`、`DISCORD_WEBHOOK`）。

- [ ] **Step 1: 寫失敗測試（mock 網路，驗證有讀對 env、組對 payload）**

```python
import scripts.push as push

def test_push_telegram_posts_to_api(monkeypatch):
    calls = {}
    monkeypatch.setenv("TG_BOT_TOKEN", "T")
    monkeypatch.setenv("TG_CHAT_ID", "542348223")
    monkeypatch.setattr(push, "_post", lambda url, payload: calls.update(url=url, payload=payload) or True)
    assert push.push_telegram("hi") is True
    assert "botT/sendMessage" in calls["url"]
    assert calls["payload"]["chat_id"] == "542348223"

def test_push_skips_when_secret_missing(monkeypatch):
    monkeypatch.delenv("DISCORD_WEBHOOK", raising=False)
    assert push.push_discord("hi") is False
```

- [ ] **Step 2: 跑測試確認失敗 → 實作 push.py → 跑測試通過**

`_post(url, payload)`：urllib POST JSON。`push_telegram`：缺 token/chat 回 False；否則 POST `https://api.telegram.org/bot{token}/sendMessage`。`push_discord`：缺 webhook 回 False；否則 POST `{"content": text}`。`push_all`：兩者都發，各自吞錯不互相影響。
Run: `python -m pytest tests/test_push.py -v` → PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/push.py tests/test_push.py
git commit -m "feat: Telegram + Discord 推播（密鑰讀環境變數）"
```

---

### Task 6: 週六入口 ＋ weekly workflow

**Files:**
- Create: `tw-earnings-calendar/scripts/run_weekly.py`
- Create: `tw-earnings-calendar/.github/workflows/weekly.yml`
- Create: `tw-earnings-calendar/tests/test_run_weekly.py`

**Interfaces:**
- Consumes: Task 2–5。
- Produces: `run_weekly(today=None) -> dict`（串接：算下週窗→抓事件→補市值→寫 `data/latest.json`→推播；回 summary）。

- [ ] **Step 1: 寫失敗測試（mock 各層，驗證串接順序與寫檔）**

```python
import scripts.run_weekly as rw
from scripts.lib.models import CalendarEvent
from datetime import date

def test_run_weekly_writes_latest_and_pushes(monkeypatch, tmp_path):
    e = CalendarEvent("2330","台積電","上市","半導體","2026-07-01","法說會",285000.0,False)
    monkeypatch.setattr(rw, "fetch_events", lambda s,en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    pushed = {}
    monkeypatch.setattr(rw, "push_all", lambda t: pushed.update(text=t))
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path/"latest.json")
    out = rw.run_weekly(today=date(2026,6,27))
    assert out["count"] == 1
    assert (tmp_path/"latest.json").exists()
    assert "2330" in pushed["text"]
```

- [ ] **Step 2: 跑測試確認失敗 → 實作 run_weekly.py → 跑測試通過**

串 `next_week_window`→`fetch_events`→`enrich_market_cap`→`build_latest_json`寫 `LATEST_PATH`→`build_calendar_message`→`push_all`。`__main__` 直接呼叫 `run_weekly()`。
Run: `python -m pytest tests/test_run_weekly.py -v` → PASS

- [ ] **Step 3: 建 weekly.yml**

```yaml
name: weekly-calendar
on:
  schedule:
    - cron: "0 4 * * 6"   # UTC 週六 04:00 = 台北週六 12:00
  workflow_dispatch:
jobs:
  scan:
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt
      - name: 掃描並推播
        env:
          TG_BOT_TOKEN: ${{ secrets.TG_BOT_TOKEN }}
          TG_CHAT_ID: ${{ secrets.TG_CHAT_ID }}
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        run: python -m scripts.run_weekly
      - name: 回寫 latest.json
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add data/latest.json data/shares_cache.json || true
          git commit -m "data: 更新下週行事曆 [skip ci]" || echo "無變更"
          git push || true
```

- [ ] **Step 4: Commit**

```bash
git add scripts/run_weekly.py .github/workflows/weekly.yml tests/test_run_weekly.py
git commit -m "feat: 週六掃描入口與排程"
```

---

### Task 7: 追蹤清單 picks 存取（pick_store）

**Files:**
- Create: `tw-earnings-calendar/scripts/pick_store.py`
- Create: `tw-earnings-calendar/data/picks.json`（初始 `{}`）
- Create: `tw-earnings-calendar/tests/test_pick_store.py`

**Interfaces:**
- Produces: `add_picks(ids: list[str], latest: dict) -> list[str]`（從 latest.json 取事件日，寫入 picks，回成功加入的代號）；`load_picks() -> dict`；`set_status(id, status)`；`due_reminders(today_iso: str) -> list[dict]`（回事件日==昨天且 status=="watching" 的項目）。

- [ ] **Step 1: 寫失敗測試**

```python
from scripts import pick_store

LATEST = {"events":[
    {"id":"2330","name":"台積電","date":"2026-07-01","type":"法說會"},
    {"id":"2454","name":"聯發科","date":"2026-07-03","type":"法說會"},
]}

def test_add_and_due(tmp_path, monkeypatch):
    monkeypatch.setattr(pick_store, "PICKS_PATH", tmp_path/"picks.json")
    added = pick_store.add_picks(["2330","2454"], LATEST)
    assert set(added) == {"2330","2454"}
    # 7/2 早上檢查 → 7/1 開完的 2330 到期
    due = pick_store.due_reminders("2026-07-02")
    assert [d["id"] for d in due] == ["2330"]

def test_add_ignores_unknown_id(tmp_path, monkeypatch):
    monkeypatch.setattr(pick_store, "PICKS_PATH", tmp_path/"picks.json")
    assert pick_store.add_picks(["9999"], LATEST) == []
```

- [ ] **Step 2: 跑測試確認失敗 → 實作 pick_store.py → 跑測試通過**

`PICKS_PATH=data/picks.json`。`add_picks`：對每個 id 在 latest.events 找到對應事件，存 `{id:{name,event_date,event_type,status:"watching"}}`；找不到的略過。`due_reminders(today)`：昨天=today-1，回 event_date==昨天 且 status=="watching"。
Run: `python -m pytest tests/test_pick_store.py -v` → PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/pick_store.py data/picks.json tests/test_pick_store.py
git commit -m "feat: 追蹤清單 picks 存取與到期判斷"
```

---

### Task 8: 每日提醒入口 ＋ daily workflow

**Files:**
- Create: `tw-earnings-calendar/scripts/run_daily_remind.py`
- Create: `tw-earnings-calendar/.github/workflows/daily.yml`
- Create: `tw-earnings-calendar/tests/test_run_daily.py`

**Interfaces:**
- Consumes: `pick_store`、`push_all`。
- Produces: `run_daily(today_iso=None) -> int`（推到期提醒數；推完把該 pick status 設 `event_passed`）。

- [ ] **Step 1: 寫失敗測試**

```python
import scripts.run_daily_remind as rd

def test_run_daily_pushes_due(monkeypatch):
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id":"2330","name":"台積電","event_type":"法說會"}])
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i,s: None)
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 1 and "詳細 2330" in sent[0]
```

- [ ] **Step 2: 跑測試確認失敗 → 實作 run_daily_remind.py → 跑測試通過**

對每個 due 項目推：「📣 {name}({id}) 昨天開完{event_type}了，回我『詳細 {id}』就幫你出完整報告」，然後 `set_status(id,"event_passed")`。無到期則不推（靜默 OK，因為每日跑、無事不擾民）。
Run: `python -m pytest tests/test_run_daily.py -v` → PASS

- [ ] **Step 3: 建 daily.yml**（cron `0 3 * * *` = 台北每日 11:00；env 同 weekly；跑 `python -m scripts.run_daily_remind`；回寫 picks.json）

- [ ] **Step 4: Commit**

```bash
git add scripts/run_daily_remind.py .github/workflows/daily.yml tests/test_run_daily.py
git commit -m "feat: 每日事件後提醒入口與排程"
```

---

### Task 9: 研究網頁骨架 ＋ 報告載入

**Files:**
- Create: `tw-earnings-calendar/web/package.json`, `vite.config.js`, `index.html`
- Create: `tw-earnings-calendar/web/src/main.jsx`, `web/src/lib/reports.js`
- Create: `tw-earnings-calendar/web/reports/2330-快報-2026-06-27.md`（範例，供 build 與肉眼驗證）
- Create: `tw-earnings-calendar/web/src/lib/reports.test.js`（vitest）

**Interfaces:**
- Produces: `loadReports() -> {id,name,date,type,body,html}[]`（用 Vite `import.meta.glob('../reports/*.md', {as:'raw'})` 讀全部報告，解析 frontmatter）。

報告 markdown frontmatter 規格：
```markdown
---
id: 2330
name: 台積電
date: 2026-06-27
type: 快報   # 快報 | 詳細
event_date: 2026-07-01
---
（報告內文 markdown…）
```

- [ ] **Step 1: 初始化 web（vite react）**

```bash
cd tw-earnings-calendar/web
npm create vite@latest . -- --template react
npm install
npm install marked
npm install -D vitest
```

- [ ] **Step 2: 寫範例報告 2330-快報-2026-06-27.md**（含上方 frontmatter + 幾段內文，讓載入有東西可測）

- [ ] **Step 3: 寫失敗測試 web/src/lib/reports.test.js**

```js
import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './reports'

describe('parseFrontmatter', () => {
  it('擷取 frontmatter 與內文', () => {
    const raw = `---\nid: 2330\nname: 台積電\ndate: 2026-06-27\ntype: 快報\n---\n內文一行`
    const r = parseFrontmatter(raw)
    expect(r.id).toBe('2330')
    expect(r.type).toBe('快報')
    expect(r.body.trim()).toBe('內文一行')
  })
})
```

- [ ] **Step 4: 跑測試確認失敗 → 實作 reports.js → 跑測試通過**

`parseFrontmatter(raw)`：用正則切 `---` 區塊，逐行 `key: value`，其餘為 `body`。`loadReports()`：glob 載入→`parseFrontmatter`→`marked(body)`成 html→依 date 降冪。
Run: `cd web && npx vitest run` → PASS

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/vite.config.js web/index.html web/src web/reports
git commit -m "feat: 研究網頁骨架與報告載入（frontmatter 解析）"
```

---

### Task 10: 網頁首頁（最新行事曆 + 最近報告）

**Files:**
- Create: `tw-earnings-calendar/web/src/App.jsx`, `web/src/components/CalendarCard.jsx`, `web/src/components/ReportList.jsx`
- Modify: `web/vite.config.js`（設 `base` 為 repo 名以利 Pages；build 前把 `data/latest.json` 複製到 `web/public/data/`）
- Create: `web/src/App.css`

**Interfaces:**
- Consumes: `loadReports()`（Task 9）、`/data/latest.json`。

- [ ] **Step 1: 把 latest.json 接到 build**

在 `web/package.json` 的 `scripts.prebuild` 加：`node -e "require('fs').mkdirSync('public/data',{recursive:true});require('fs').copyFileSync('../data/latest.json','public/data/latest.json')"`（latest.json 不存在時先放一份 `{"events":[],"range":[]}` 範例避免 build 壞）。

- [ ] **Step 2: 實作 App.jsx**

首頁兩區塊：上方 `CalendarCard`（fetch `${import.meta.env.BASE_URL}data/latest.json`，依日期分組顯示，空則顯示「下週暫無行程」）；下方 `ReportList`（`loadReports()` 取最近 10 篇，顯示 代號·名稱·類型·日期，點擊進閱讀頁）。

- [ ] **Step 3: 肉眼驗證**

```bash
cd web && npm run build && python3 -m http.server -d dist 8099
```
用 chrome-devtools 截圖確認首頁顯示行事曆與範例報告卡（手機寬度 ≥500）。

- [ ] **Step 4: Commit**

```bash
git add web/src web/vite.config.js web/package.json
git commit -m "feat: 網頁首頁（行事曆 + 最近報告）"
```

---

### Task 11: 報告庫與閱讀頁（瀏覽／搜尋）

**Files:**
- Create: `web/src/components/ReportLibrary.jsx`, `web/src/components/ReportView.jsx`
- Modify: `web/src/App.jsx`（極簡路由：hash 決定看首頁／報告庫／單篇）

**Interfaces:**
- Consumes: `loadReports()`。

- [ ] **Step 1: 實作報告庫**

`ReportLibrary`：列出全部報告，提供搜尋框（比對 代號／名稱）、可切換「依股票」或「依日期」分組。

- [ ] **Step 2: 實作閱讀頁**

`ReportView`：依 hash `#/r/<檔名>` 找到該報告，渲染 `html`（marked 產出），頂部顯示 代號·名稱·類型·日期，底部「非投資建議」。空狀態（找不到）顯示提示不報錯。

- [ ] **Step 3: 肉眼驗證**（build + http.server + 截圖，確認搜尋與單篇渲染正常）

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat: 報告庫瀏覽搜尋與單篇閱讀頁"
```

---

### Task 12: GitHub Pages 部署 workflow

**Files:**
- Create: `tw-earnings-calendar/.github/workflows/deploy.yml`

- [ ] **Step 1: 建 deploy.yml**

```yaml
name: deploy-pages
on:
  push:
    branches: [main]
    paths: ["web/**", "data/latest.json"]
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd web && npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 驗證**

push 後到 repo Actions 看 deploy 綠燈；開 Pages URL 確認首頁與報告顯示。（首次需在 repo Settings→Pages 設 Source=GitHub Actions，記入 README。）

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages 自動部署"
```

---

### Task 13: README 研究指令備忘 ＋ 收尾

**Files:**
- Create: `tw-earnings-calendar/README.md`

- [ ] **Step 1: 寫 README**

內容涵蓋：專案用途；三段流程圖；**「研究指令格式」備忘**（讓任何 CC session 接手都知道規則）——
- 觸發：Andy 回「研究 2330 2454」→ CC 產**事前快報**（近期業績／近期題材+可行性／多空／隱藏題材／隱藏合作／成長機會／後勢預測），寫 `web/reports/<id>-快報-<今日>.md`，並 `python -m scripts.pick_store add 2330 2454`（記進 picks）。
- Andy 回「詳細 2330」→ CC 即時查證事件實際內容，產**事後詳細報告**（現況／題材可行性與風險／多空／隱藏題材／隱藏合作／成長機會與後勢預測），寫 `web/reports/<id>-詳細-<今日>.md`。
- 撰寫立場：會質疑的分析師、優先挖隱藏題材與機會、數字查證標日期、查不到講「查無」。
- 「先別放」→ 不寫該檔。
- 部署：報告 commit/push 到 main 即自動上架。
- 本機測試指令、需要的 GitHub Secrets 清單。

- [ ] **Step 2: 跑全部測試**

Run: `python -m pytest -v && cd web && npx vitest run`
Expected: 全 PASS

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README 與研究指令備忘"
```

---

## 上線前人工步驟（非程式，記於 README）

1. 在 GitHub 建 repo `tw-earnings-calendar`（andy30019123agent-ship-it），push。
2. repo Settings → Secrets 新增：`TG_BOT_TOKEN`、`TG_CHAT_ID=542348223`、`DISCORD_WEBHOOK`。
3. Settings → Pages → Source 設 GitHub Actions。
4. 手動觸發一次 `weekly-calendar` workflow 驗證推播到 TG＋Discord。
5. 確認 Pages URL 可開、首頁行事曆與範例報告正常。

## Self-Review（對照 spec）

- **每週六掃描推播** → Task 2/3/4/5/6 ✅
- **每天一組、市值大→小** → Task 4 `build_calendar_message` ✅
- **TG（金冬天秘書）＋Discord** → Task 5 ✅
- **事前快報（含可行性/隱藏題材/合作/成長/後勢）** → Task 13 README 規格 + 流程（研究由 CC 做，不寫死）✅
- **picks 記錄 + 事件後每日提醒** → Task 7/8 ✅
- **事後詳細報告（評估與預測為核心）** → Task 13 README 規格 ✅
- **公開研究網頁（首頁行事曆 + 報告庫 + 閱讀）** → Task 9/10/11/12 ✅
- **快報與詳細都保留** → Task 9 frontmatter `type` + 檔名鍵 ✅
- **密鑰只進 Secrets** → Task 1 .gitignore + Task 5 env + Task 5/6/8 workflow secrets ✅
- **財報日不可得誠實標示** → Task 4 表尾 ✅
- **資料源風險隔離** → Task 2 spike + `CalendarEvent` 正規化契約 ✅
- placeholder 掃描：除「研究怎麼做」刻意由 CC 即時執行（spec 明定不寫成程式）外，無 TBD；Task 2 parser 依 spike 實測格式填寫，已用真實 fixture 鎖定測試。
- 型別一致：全程用 `CalendarEvent` 欄位（id/name/market/industry/date/type/market_cap/cap_is_estimate）；picks 用 `event_date/event_type/status`，前後一致。
