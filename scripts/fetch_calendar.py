"""法說會行事曆抓取與正規化。

資料源：MOPS ajax_t100sb02_1（上市 sii + 上櫃 otc），回傳 HTML 表格。
財報/董事會未來預告官方源尚不可靠（見 docs/datasource-notes.md），
本期只供法說會事件，財報留待後續任務。
"""
import re
from datetime import datetime
from typing import Optional

from scripts.lib.http import get_text
from scripts.lib.models import CalendarEvent

_MOPS_URL = "https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1"
_MOPS_REFERER = "https://mopsov.twse.com.tw/mops/web/t100sb02_1"
_MARKET_MAP = {"sii": "上市", "otc": "上櫃"}


def _roc_to_iso(date_text: str) -> Optional[str]:
    """民國日期字串轉 ISO。
    支援「115/06/26」與「115/06/30 至 115/07/03」（取起始日）。
    回傳 None 表示無法解析。
    """
    # 取第一段日期（處理區間格式）
    m = re.match(r"(\d+)/(\d+)/(\d+)", date_text.strip())
    if not m:
        return None
    roc_year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    western_year = roc_year + 1911
    try:
        dt = datetime(western_year, month, day)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _strip_tags(html: str) -> str:
    """移除 HTML 標籤與 &nbsp;，回傳純文字（去首尾空白）。"""
    text = re.sub(r"<[^>]+>", "", html)
    text = text.replace("&nbsp;", " ")
    return text.strip()


def _is_common_stock(code: str) -> bool:
    """只保留 4 位純數字代號（排除 ETF、權證、特別股等）。"""
    return bool(re.fullmatch(r"\d{4}", code.strip()))


def parse_events(
    raw: str,
    start_iso: str,
    end_iso: str,
    market: str = "上市",
) -> list[CalendarEvent]:
    """解析 MOPS HTML，回傳落在 [start_iso, end_iso] 區間的 CalendarEvent 清單。

    Args:
        raw: MOPS ajax_t100sb02_1 回傳的完整 HTML 字串。
        start_iso: 起始日期（含），格式 YYYY-MM-DD。
        end_iso: 結束日期（含），格式 YYYY-MM-DD。
        market: 市場別標籤（"上市" 或 "上櫃"），預設 "上市"。

    Returns:
        符合條件的 CalendarEvent 清單。
    """
    events: list[CalendarEvent] = []
    seen: set[str] = set()  # 去重 key = (代號, 日期)

    # 抓出所有 data-type='body' 的資料列
    row_pattern = re.compile(
        r"<tr[^>]*data-type=['\"]body['\"][^>]*>(.*?)</tr>",
        re.DOTALL,
    )
    for row_match in row_pattern.finditer(raw):
        row_html = row_match.group(1)
        tds = re.findall(r"<td[^>]*>(.*?)</td>", row_html, re.DOTALL)
        if len(tds) < 3:
            continue

        code = _strip_tags(tds[0])
        name = _strip_tags(tds[1])
        date_raw = _strip_tags(tds[2])

        if not _is_common_stock(code):
            continue

        iso_date = _roc_to_iso(date_raw)
        if iso_date is None:
            continue

        if not (start_iso <= iso_date <= end_iso):
            continue

        dedup_key = (code, iso_date)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        events.append(
            CalendarEvent(
                id=code,
                name=name,
                market=market,
                industry="",   # Task 3 補填
                date=iso_date,
                type="法說會",
                market_cap=0.0,  # Task 3 補填
                cap_is_estimate=False,
            )
        )

    return events


def _build_body(typek: str) -> bytes:
    """組 MOPS POST body（整年查詢）。"""
    # 固定查當前民國年（2026 = 115）
    roc_year = datetime.now().year - 1911
    body = (
        f"encodeURIComponent=1&step=1&firstin=1"
        f"&TYPEK={typek}&year={roc_year}&month="
    )
    return body.encode("utf-8")


def fetch_events(start_iso: str, end_iso: str) -> list[CalendarEvent]:
    """從 MOPS 抓取上市（sii）＋上櫃（otc）法說會，回傳指定區間事件。

    Args:
        start_iso: 起始日期（含），格式 YYYY-MM-DD。
        end_iso: 結束日期（含），格式 YYYY-MM-DD。

    Returns:
        符合條件的 CalendarEvent 清單（market_cap=0.0 待 Task 3 補填）。
    """
    headers = {"Referer": _MOPS_REFERER}
    all_events: list[CalendarEvent] = []

    for typek, market_label in _MARKET_MAP.items():
        raw = get_text(_MOPS_URL, data=_build_body(typek), headers=headers)
        if not raw:
            continue
        events = parse_events(raw, start_iso, end_iso, market=market_label)
        all_events.extend(events)

    return all_events
