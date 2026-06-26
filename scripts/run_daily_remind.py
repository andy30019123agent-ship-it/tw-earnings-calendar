"""每日事件後提醒入口。

cron 0 3 * * * (UTC) = 台北每日 11:00 跑。
對昨天到期且 status=="watching" 的 picks 推提醒，並把 status 設為 event_passed。
無到期時靜默不推（每日跑，無事不擾民）。
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from scripts.pick_store import due_reminders, set_status
from scripts.push import push_all

_TAIPEI = timezone(timedelta(hours=8))

_MSG_TMPL = "📣 {name}({id}) 昨天開完{event_type}了，回我『詳細 {id}』就幫你出完整報告"


def _today_taipei() -> str:
    return datetime.now(_TAIPEI).strftime("%Y-%m-%d")


def run_daily(today_iso: Optional[str] = None) -> int:
    """推昨日到期提醒。返回推送筆數；無到期則靜默返回 0。"""
    if today_iso is None:
        today_iso = _today_taipei()

    items = due_reminders(today_iso)
    count = 0
    for item in items:
        msg = _MSG_TMPL.format(
            name=item["name"],
            id=item["id"],
            event_type=item["event_type"],
        )
        push_all(msg)
        set_status(item["id"], "event_passed")
        count += 1

    return count


if __name__ == "__main__":
    pushed = run_daily()
    print(f"每日提醒：推送 {pushed} 筆")
