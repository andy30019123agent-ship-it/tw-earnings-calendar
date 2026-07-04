"""週六入口：串接各層，執行完整的下週行事曆掃描與推播流程。

公開介面
--------
run_weekly(today=None) -> dict
    pipeline：next_week_window → fetch_events → enrich_market_cap
              → 寫 LATEST_PATH → build_calendar_message → push_all
    回傳 summary dict（至少含 count）。

__main__ 直接呼叫 run_weekly()，fetch 失敗時 exit(1) 讓 GitHub Actions 標記失敗。

注意：fetch_events / enrich_market_cap / push_all / LATEST_PATH 均為 module-level，
以支援測試 monkeypatch。
"""

from __future__ import annotations

import json
import pathlib
import sys
from datetime import date, datetime, timedelta, timezone

from scripts.build_message import build_calendar_message, build_latest_json
from scripts.fetch_calendar import CalendarFetchError
from scripts.fetch_calendar import fetch_events  # noqa: F401 — module-level for monkeypatch
from scripts.industry import enrich_industry, refresh_industry  # noqa: F401 — module-level for monkeypatch
from scripts.lib.dates import next_week_window
from scripts.market_cap import enrich_market_cap, load_shares, refresh_shares  # noqa: F401 — module-level for monkeypatch
from scripts.push import push_all  # noqa: F401 — module-level for monkeypatch

# 讓測試可以 monkeypatch 此路徑
LATEST_PATH: pathlib.Path = pathlib.Path(__file__).parent.parent / "data" / "latest.json"

# 冪等旗標（與 run_daily_remind 共用同一個 state 檔，key 各自獨立）
STATE_PATH: pathlib.Path = pathlib.Path(__file__).parent.parent / "data" / "notify_state.json"


def _load_notify_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_notify_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

_TAIPEI = timezone(timedelta(hours=8))


def _today_taipei() -> date:
    return datetime.now(_TAIPEI).date()


def run_weekly(today: date | None = None) -> dict:
    """執行週六掃描完整流程。

    Args:
        today: 基準日期，預設使用台北時間當天（顯式時區，不依賴 cron 執行時點）。

    Returns:
        summary dict，至少含：
          - count (int): 本週找到的事件數
          - start (str): 查詢起始日
          - end (str): 查詢結束日
          錯誤時額外含 error 欄位，且會重新拋出 CalendarFetchError。

    Raises:
        CalendarFetchError: fetch_events 失敗時重新拋出，讓呼叫端／CI 標記失敗。
    """
    if today is None:
        today = _today_taipei()

    start, end = next_week_window(today)

    # ── 1. 抓取資料（失敗時推警告並重新拋出，不產出空表） ─────────────────
    try:
        events = fetch_events(start, end)
    except CalendarFetchError as exc:
        failure_notice = "⚠️ 下週行事曆抓取失敗，稍後人工補"
        push_all(failure_notice)
        raise

    # ── 1.5 首次執行 seed 股數快取（快取空時才抓，避免每次發網路請求） ─────
    if not load_shares():
        try:
            refresh_shares()
        except Exception as exc:
            print(f"[WARN] refresh_shares 失敗，繼續以估算市值：{exc}", file=sys.stderr)

    # ── 2. 補市值 ─────────────────────────────────────────────────────────
    events = enrich_market_cap(events)

    # ── 2.5 每週更新產業別快取（頻率低，直接每次刷新；失敗則沿用舊快取） ─────
    try:
        refresh_industry()
    except Exception as exc:
        print(f"[WARN] refresh_industry 失敗，沿用舊產業別快取：{exc}", file=sys.stderr)

    events = enrich_industry(events)

    # ── 3. 寫 latest.json ─────────────────────────────────────────────────
    latest = build_latest_json(events, start, end)
    LATEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    LATEST_PATH.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── 4. 組訊息並推播（冪等：同一週窗口已推過就跳過，保險 cron 不重複推） ──
    state = _load_notify_state()
    if state.get("weekly_calendar") == start:
        print(f"[SKIP] 週窗口 {start} 已推播過，冪等跳過重複推播")
    else:
        message = build_calendar_message(events, start, end)
        push_all(message)
        state["weekly_calendar"] = start
        _save_notify_state(state)

    return {"count": len(events), "start": start, "end": end}


if __name__ == "__main__":
    try:
        summary = run_weekly()
        print(f"完成：找到 {summary['count']} 筆事件（{summary['start']} ~ {summary['end']}）")
    except CalendarFetchError as exc:
        print(f"[ERROR] 行事曆抓取失敗：{exc}", file=sys.stderr)
        sys.exit(1)
