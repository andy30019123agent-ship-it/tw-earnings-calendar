"""測試 fetch_calendar 的 parse_events 函式（使用離線 fixture）。"""
import pathlib

from scripts.fetch_calendar import parse_events
from scripts.lib.models import CalendarEvent

FIX = pathlib.Path(__file__).parent / "fixtures" / "calendar_sample.html"


def test_parse_events_returns_calendar_events():
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-29", end_iso="2026-07-05")
    assert len(events) > 0
    assert all(isinstance(e, CalendarEvent) for e in events)
    # 全部落在日期窗內
    assert all("2026-06-29" <= e.date <= "2026-07-05" for e in events)
    # 類型只有兩種
    assert all(e.type in ("法說會", "財報") for e in events)


def test_parse_events_only_common_stock():
    """確認只保留 4 位純數字代號（過濾 ETF、權證等）。"""
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-01", end_iso="2026-12-31")
    assert all(e.id.isdigit() and len(e.id) == 4 for e in events)


def test_parse_events_market_cap_zero():
    """market_cap 在此階段應為 0.0（Task 3 負責填值）。"""
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-01", end_iso="2026-12-31")
    assert all(e.market_cap == 0.0 for e in events)


def test_parse_events_market_field():
    """上市來源的事件 market 欄位應為 '上市'。"""
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-01", end_iso="2026-12-31",
                          market="上市")
    assert all(e.market == "上市" for e in events)
