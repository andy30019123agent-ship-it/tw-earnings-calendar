"""組合行事曆訊息文字與 latest.json 資料結構。"""

from __future__ import annotations

import datetime
from itertools import groupby
from typing import List

from scripts.lib.models import CalendarEvent

# 公開研究網站（行事曆＋報告庫）
SITE_URL = "https://andy30019123agent-ship-it.github.io/tw-earnings-calendar/"


def build_calendar_message(
    events: List[CalendarEvent],
    start_iso: str,
    end_iso: str,
) -> str:
    """將事件清單組成給使用者閱讀的行事曆訊息。

    - 依日期升冪分組，組內依市值降冪排序。
    - 市值為估算值時標記「(估)」。
    - 空清單時回傳告知暫無事件的訊息。
    - 末尾附誠實免責聲明。

    Args:
        events: CalendarEvent 清單。
        start_iso: 起始日期（ISO 格式，僅用於標頭）。
        end_iso: 結束日期（ISO 格式，僅用於標頭）。

    Returns:
        格式化後的純文字訊息。
    """
    footer = (
        "資料源：MOPS 預告，財報實際公布日以公司公告為準・非投資建議\n"
        f"📲 完整行事曆＋研究報告：{SITE_URL}"
    )

    if not events:
        return f"下週暫無已申報的法說會／財報行程\n\n{footer}"

    # 依日期升冪排序後分組
    sorted_events = sorted(events, key=lambda e: (e.date, -e.market_cap))

    lines: List[str] = []
    for date_str, group in groupby(sorted_events, key=lambda e: e.date):
        # 標頭顯示 M/D，去除前導零
        dt = datetime.date.fromisoformat(date_str)
        header = f"📅 {dt.month}/{dt.day}"
        lines.append(header)

        for evt in group:
            cap_str = f"{evt.market_cap:.0f}"
            if evt.cap_is_estimate:
                cap_str += "(估)"
            parts = [f"{evt.id} {evt.name}", evt.type]
            if evt.industry:
                parts.append(evt.industry)
            parts.append(f"市值 {cap_str} 億")
            lines.append("  " + "  ".join(parts))

        lines.append("")  # 日期之間空一行

    lines.append(footer)
    return "\n".join(lines)


def build_latest_json(
    events: List[CalendarEvent],
    start_iso: str,
    end_iso: str,
) -> dict:
    """建立 latest.json 的資料結構。

    Args:
        events: CalendarEvent 清單。
        start_iso: 查詢起始日期（ISO 格式）。
        end_iso: 查詢結束日期（ISO 格式）。

    Returns:
        包含 updated、range、events 欄位的字典。
    """
    now_taipei = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    return {
        "updated": now_taipei.isoformat(),
        "range": [start_iso, end_iso],
        "events": [e.to_dict() for e in events],
    }
