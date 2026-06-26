"""測試 fetch_calendar 的 parse_events 函式（使用離線 fixture）。"""
import pathlib
from unittest.mock import patch

import pytest

from scripts.fetch_calendar import CalendarFetchError, fetch_events, parse_events
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


# --- Item 1: 網路失敗應拋出 CalendarFetchError，不得靜默略過 ---

def test_fetch_events_raises_calendar_fetch_error_on_network_failure():
    """get_text 回傳 None 時 fetch_events 必須拋出 CalendarFetchError。"""
    with patch("scripts.fetch_calendar.get_text", return_value=None):
        with pytest.raises(CalendarFetchError):
            fetch_events("2026-06-29", "2026-07-05")


# --- Item 5: ETF 過濾測試具備否定性 ---

def test_parse_events_etf_code_filtered_out():
    """5 位數 ETF 代號（00878）不得出現在 parse_events 結果中；
    刪除 _is_common_stock 後此測試會失敗。"""
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-01", end_iso="2026-12-31")
    codes = [e.id for e in events]
    assert "00878" not in codes


# --- Item 6: 去重斷言 ---

def test_parse_events_dedup_3717():
    """fixture 中 3717 重複兩筆，parse_events 結果應只有一筆。"""
    raw = FIX.read_text(encoding="utf-8")
    events = parse_events(raw, start_iso="2026-06-01", end_iso="2026-12-31")
    count_3717 = sum(1 for e in events if e.id == "3717")
    assert count_3717 == 1
