"""每日法說會異動核對：重抓已發布週窗，與 data/latest.json 比對新增／取消／改期。

動機：原本只有週六掃一次下週行事曆，週中若有公司改期或取消法說會，
使用者要等到下週六才會看到更新——資料源本來就是查整年，加一道每日核對成本很低。

公開介面
--------
run_daily_diff() -> dict
    pipeline：讀 LATEST_PATH 取得已發布的「本週窗口」range → 用同一 range 重新
              fetch_events → 補市值／產業別 → 與舊事件比對 → 有異動才推播＋覆寫
              LATEST_PATH；無異動安靜返回。
    回傳 summary dict，至少含 changed (bool)。

__main__ 直接呼叫 run_daily_diff()，fetch 失敗時 exit(1) 讓 GitHub Actions 標記失敗。

重要：抓取失敗（CalendarFetchError）與「查到的清單比舊清單少」是兩回事——
前者必須明確報錯＋沿用舊資料，絕不可誤判成「本週全部取消」。
"""
from __future__ import annotations

import json
import pathlib
import sys

from scripts.build_message import SITE_URL, build_latest_json
from scripts.fetch_calendar import CalendarFetchError
from scripts.fetch_calendar import fetch_events  # noqa: F401 — module-level for monkeypatch
from scripts.industry import enrich_industry  # noqa: F401 — module-level for monkeypatch
from scripts.market_cap import enrich_market_cap  # noqa: F401 — module-level for monkeypatch
from scripts.push import push_all  # noqa: F401 — module-level for monkeypatch

# 讓測試可以 monkeypatch 此路徑（與 run_weekly 共用同一份持久化檔）
LATEST_PATH: pathlib.Path = pathlib.Path(__file__).parent.parent / "data" / "latest.json"


def _load_latest() -> dict:
    try:
        return json.loads(LATEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _diff_events(old_events: list[dict], new_events: list) -> dict:
    """比對舊（dict）／新（CalendarEvent）事件清單，key 為股票代號。

    Returns:
        {"added": [CalendarEvent], "removed": [dict], "rescheduled": [(dict, CalendarEvent)]}
    """
    old_map = {e["id"]: e for e in old_events}
    new_map = {e.id: e for e in new_events}

    added = [new_map[cid] for cid in new_map if cid not in old_map]
    removed = [old_map[cid] for cid in old_map if cid not in new_map]
    rescheduled = [
        (old_map[cid], new_map[cid])
        for cid in new_map
        if cid in old_map and old_map[cid].get("date") != new_map[cid].date
    ]
    return {"added": added, "removed": removed, "rescheduled": rescheduled}


def _build_diff_message(diff: dict) -> str:
    lines = ["⚠️ 法說會異動通知（每日核對）"]

    for evt in diff["added"]:
        lines.append(f"🆕 新增：{evt.id} {evt.name}　{evt.date}")
    for old, new in diff["rescheduled"]:
        lines.append(f"📆 改期：{new.id} {new.name}　{old.get('date', '?')} → {new.date}")
    for evt in diff["removed"]:
        lines.append(f"❌ 取消／延後：{evt['id']} {evt['name']}　原訂 {evt.get('date', '?')}")

    lines.append("")
    lines.append(f"📲 完整行事曆：{SITE_URL}")
    return "\n".join(lines)


def run_daily_diff() -> dict:
    """核對本週窗口異動。無已發布清單可核對時安靜跳過（回傳 changed=False）。"""
    latest = _load_latest()
    date_range = latest.get("range")
    old_events = latest.get("events", [])

    if not date_range or len(date_range) != 2:
        # 尚無已發布清單（例如 latest.json 不存在），無從核對，安靜跳過
        return {"changed": False, "reason": "no_baseline"}

    start, end = date_range

    # ── 1. 重抓同一窗口（失敗時推警告並重新拋出，絕不當成「全部取消」） ─────
    try:
        events = fetch_events(start, end)
    except CalendarFetchError as exc:
        push_all(f"⚠️ 每日法說會異動核對抓取失敗，稍後人工補查：{exc}")
        raise

    # ── 2. 補市值／產業別（沿用既有快取，不在每日流程額外刷新快取） ─────────
    events = enrich_market_cap(events)
    events = enrich_industry(events)

    # ── 3. 比對異動 ──────────────────────────────────────────────────────
    diff = _diff_events(old_events, events)
    changed = bool(diff["added"] or diff["removed"] or diff["rescheduled"])

    if not changed:
        return {"changed": False}

    # ── 4. 有異動才推播＋覆寫持久化清單／網頁資料 ───────────────────────────
    message = _build_diff_message(diff)
    push_all(message)

    new_latest = build_latest_json(events, start, end)
    LATEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    LATEST_PATH.write_text(json.dumps(new_latest, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "changed": True,
        "added": len(diff["added"]),
        "removed": len(diff["removed"]),
        "rescheduled": len(diff["rescheduled"]),
    }


if __name__ == "__main__":
    try:
        summary = run_daily_diff()
        if summary.get("changed"):
            print(
                f"完成：偵測到異動（新增 {summary['added']}／取消 {summary['removed']}／"
                f"改期 {summary['rescheduled']}），已推播並更新 latest.json"
            )
        else:
            print(f"完成：無異動（{summary.get('reason', '本週窗口比對一致')}）")
    except CalendarFetchError as exc:
        print(f"[ERROR] 每日異動核對抓取失敗：{exc}", file=sys.stderr)
        sys.exit(1)
