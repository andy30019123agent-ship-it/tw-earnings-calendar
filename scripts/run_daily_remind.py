"""每日事件後提醒入口。

cron 0 3 * * * (UTC) = 台北每日 11:00 跑。
對昨天到期且 status=="watching" 的 picks 推提醒，並把 status 設為 event_passed。
無到期時靜默不推（每日跑，無事不擾民）。
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from scripts.cross_signals import fetch_market_stance_line, fetch_screener_signal
from scripts.pick_store import due_reminders, set_status
from scripts.push import push_all

_TAIPEI = timezone(timedelta(hours=8))

_MSG_TMPL = "📣 {name}({id}) 昨天開完{event_type}了，回我『詳細 {id}』就幫你出完整報告"


def _today_taipei() -> str:
    return datetime.now(_TAIPEI).strftime("%Y-%m-%d")


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
        push_all(msg)
        set_status(item["id"], "event_passed")
        count += 1

    return count


if __name__ == "__main__":
    pushed = run_daily()
    print(f"每日提醒：推送 {pushed} 筆")
