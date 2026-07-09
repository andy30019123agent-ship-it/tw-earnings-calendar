"""每日事件後提醒入口。

cron 0 3 * * * (UTC) = 台北每日 11:00 跑（另有 40 3 * * * 保險重試）。
1. 今日法說會晨間廣播：從 data/latest.json 撈當天場次推清單；當天無場次不推。
   冪等：data/notify_state.json 記錄當日已播旗標（會 commit 回 repo），
   同一天重跑（含保險 cron）不會重複推。
2. 對昨天到期且 status=="watching" 的 picks 推提醒，並把 status 設為 event_passed。
   無到期時靜默不推（每日跑，無事不擾民）。
"""
import json
import pathlib
from datetime import datetime, timezone, timedelta
from typing import Optional

from scripts.cross_signals import fetch_market_stance_line, fetch_screener_signal
from scripts.pick_store import due_reminders, set_status
from scripts.push import push_all

_TAIPEI = timezone(timedelta(hours=8))

_MSG_TMPL = "📣 {name}({id}) 昨天開完{event_type}了，回我『詳細 {id}』就幫你出完整報告"

# 讓測試可以 monkeypatch 這兩個路徑
LATEST_PATH: pathlib.Path = pathlib.Path(__file__).parent.parent / "data" / "latest.json"
STATE_PATH: pathlib.Path = pathlib.Path(__file__).parent.parent / "data" / "notify_state.json"


def _today_taipei() -> str:
    return datetime.now(_TAIPEI).strftime("%Y-%m-%d")


# ── 今日法說會晨間廣播 ─────────────────────────────────────────────────────

def _load_notify_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_notify_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _build_today_broadcast(events: list) -> str:
    """組今日法說會清單訊息，組內市值大→小；industry 空白時排版不能壞。"""
    parts = []
    for e in sorted(events, key=lambda x: -(x.get("market_cap") or 0)):
        if e.get("industry"):
            parts.append(f"{e['name']}({e['id']}·{e['industry']})")
        else:
            parts.append(f"{e['name']}({e['id']})")
    return f"📅 今日法說會 {len(parts)} 場：" + "、".join(parts)


def run_today_broadcast(today_iso: Optional[str] = None) -> bool:
    """推「今日法說會」清單。當天無場次或當日已播過→不推，返回 False。"""
    if today_iso is None:
        today_iso = _today_taipei()

    state = _load_notify_state()
    if state.get("today_broadcast") == today_iso:
        return False  # 當日已播過（例如保險 cron 重跑），冪等不重複推

    try:
        latest = json.loads(LATEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return False  # 無行事曆資料可播，安靜跳過（latest.json 由週掃/每日核對維護）

    todays = [e for e in latest.get("events", []) if e.get("date") == today_iso]
    if not todays:
        return False

    # 推播成功才寫冪等旗標；失敗則不寫，讓下次 cron 重試（否則整日廣播漏掉）
    if push_all(_build_today_broadcast(todays)):
        state["today_broadcast"] = today_iso
        _save_notify_state(state)
        return True
    print(f"[WARN] {today_iso} 今日廣播推播失敗，不寫 state，下次 cron 重試")
    return False


def run_daily(today_iso: Optional[str] = None) -> int:
    """推昨日到期提醒。返回推送筆數；無到期則靜默返回 0。

    每則提醒額外附加跨專案情報（選股訊號＋市況研判）：兩者皆唯讀 fetch 外部
    公開 JSON，任一失敗就靜默省略該段，提醒本體照常發送、不影響到期判斷。
    """
    if today_iso is None:
        today_iso = _today_taipei()

    items = due_reminders(today_iso)
    count = 0
    stance_line = fetch_market_stance_line() if items else None
    for item in items:
        msg = _MSG_TMPL.format(
            name=item["name"],
            id=item["id"],
            event_type=item["event_type"],
        )
        if stance_line:
            msg = f"{stance_line}\n{msg}"
        signal_line = fetch_screener_signal(item["id"])
        if signal_line:
            msg = f"{msg}\n{signal_line}"
        # 推播成功才標記 event_passed，否則保留 watching 讓下次 cron 重試（避免提醒漏發卻被當已提醒）
        if push_all(msg):
            set_status(item["id"], "event_passed")
            count += 1
        else:
            print(f"[WARN] {item['id']} 到期提醒推播失敗，保留 watching，下次 cron 重試")

    return count


if __name__ == "__main__":
    broadcasted = run_today_broadcast()
    pushed = run_daily()
    print(f"每日提醒：今日場次廣播{'已推' if broadcasted else '略過'}，回顧提醒推送 {pushed} 筆")
