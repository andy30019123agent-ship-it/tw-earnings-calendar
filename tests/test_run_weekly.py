"""Task 6 測試：週六入口 run_weekly 串接與失敗處理。"""

import dataclasses
import json

import scripts.run_weekly as rw
from scripts.fetch_calendar import CalendarFetchError
from scripts.lib.models import CalendarEvent
from datetime import date
import pytest


# ── 正常路徑 ───────────────────────────────────────────────────────────────

def test_run_weekly_writes_latest_and_pushes(monkeypatch, tmp_path):
    e = CalendarEvent("2330", "台積電", "上市", "半導體", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)
    pushed = {}
    monkeypatch.setattr(rw, "push_all", lambda t: pushed.update(text=t))
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")
    out = rw.run_weekly(today=date(2026, 6, 27))
    assert out["count"] == 1
    assert (tmp_path / "latest.json").exists()
    assert "2330" in pushed["text"]


def test_run_weekly_returns_summary_dict(monkeypatch, tmp_path):
    """回傳 dict 必有 count 欄位。"""
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)
    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")
    out = rw.run_weekly(today=date(2026, 6, 27))
    assert "count" in out
    assert out["count"] == 0


def test_run_weekly_empty_window_pushes_no_events_message(monkeypatch, tmp_path):
    """空窗口（無事件）應推「暫無」訊息，不得推空字串或靜默。"""
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)
    pushed = {}
    monkeypatch.setattr(rw, "push_all", lambda t: pushed.update(text=t))
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")
    rw.run_weekly(today=date(2026, 6, 27))
    assert "暫無" in pushed["text"]


# ── 失敗路徑（CalendarFetchError） ────────────────────────────────────────

def test_run_weekly_fetch_error_pushes_failure_notice_and_raises(monkeypatch, tmp_path):
    """fetch_events 拋出 CalendarFetchError 時：
    1. push_all 必須收到含警告文字的失敗通知（不推空表）。
    2. run_weekly 必須重新拋出（讓 __main__ / GitHub Actions 標記失敗）。
    """
    def bad_fetch(s, en):
        raise CalendarFetchError("MOPS 掛了")

    monkeypatch.setattr(rw, "fetch_events", bad_fetch)
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)
    pushed = {}
    monkeypatch.setattr(rw, "push_all", lambda t: pushed.update(text=t))
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    with pytest.raises(CalendarFetchError):
        rw.run_weekly(today=date(2026, 6, 27))

    # 必須推了失敗通知
    assert "text" in pushed, "CalendarFetchError 時應呼叫 push_all 推失敗通知"
    assert "失敗" in pushed["text"] or "⚠️" in pushed["text"], (
        f"失敗通知訊息應含 '失敗' 或 '⚠️'，實際：{pushed['text']!r}"
    )

    # 不應寫 latest.json（fetch 失敗不產出資料）
    assert not (tmp_path / "latest.json").exists(), "fetch 失敗時不應寫 latest.json"


# ── 股數快取 seed 行為 ─────────────────────────────────────────────────────

def test_run_weekly_seeds_shares_when_cache_empty(monkeypatch, tmp_path):
    """快取空（{}）時，run_weekly 應呼叫 refresh_shares 做初次 seed。"""
    e = CalendarEvent("2330", "台積電", "上市", "半導體", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {})  # 模擬空快取

    refresh_called = []
    monkeypatch.setattr(rw, "refresh_shares", lambda: refresh_called.append(True))
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)

    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    rw.run_weekly(today=date(2026, 6, 27))

    assert refresh_called, "快取空時應呼叫 refresh_shares 做 seed"


def test_run_weekly_skips_refresh_when_cache_present(monkeypatch, tmp_path):
    """快取非空時，run_weekly 不應呼叫 refresh_shares（避免每次都打 API）。"""
    e = CalendarEvent("2330", "台積電", "上市", "半導體", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})  # 模擬有資料

    refresh_called = []
    monkeypatch.setattr(rw, "refresh_shares", lambda: refresh_called.append(True))
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)

    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    rw.run_weekly(today=date(2026, 6, 27))

    assert not refresh_called, "快取非空時不應呼叫 refresh_shares"


# ── 產業別補值（Task 2） ──────────────────────────────────────────────────

def test_run_weekly_refreshes_and_enriches_industry(monkeypatch, tmp_path):
    """run_weekly 應每次刷新產業別快取，並用 enrich_industry 補值事件。"""
    e = CalendarEvent("2330", "台積電", "上市", "", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)

    refresh_called = []
    monkeypatch.setattr(rw, "refresh_industry", lambda: refresh_called.append(True))
    monkeypatch.setattr(
        rw, "enrich_industry",
        lambda evs: [dataclasses.replace(x, industry="半導體業") for x in evs],
    )

    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    rw.run_weekly(today=date(2026, 6, 27))

    assert refresh_called, "應每次呼叫 refresh_industry 更新產業別快取"
    written = json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))
    assert written["events"][0]["industry"] == "半導體業"


def test_run_weekly_refresh_industry_failure_does_not_break_pipeline(monkeypatch, tmp_path):
    """refresh_industry 失敗時應繼續走完流程（沿用舊快取），不得整個流程中斷。"""
    e = CalendarEvent("2330", "台積電", "上市", "半導體", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [e])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)

    def bad_refresh():
        raise RuntimeError("網路掛了")

    monkeypatch.setattr(rw, "refresh_industry", bad_refresh)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)

    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    out = rw.run_weekly(today=date(2026, 6, 27))
    assert out["count"] == 1


# ── 時區顯式化（Task 3） ──────────────────────────────────────────────────

def test_run_weekly_default_today_uses_taipei_timezone(monkeypatch, tmp_path):
    """today=None 時應使用顯式台北時區當天（_today_taipei），不依賴系統/伺服器時區。"""
    monkeypatch.setattr(rw, "_today_taipei", lambda: date(2026, 6, 27))
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rw, "load_shares", lambda: {"2330": 25930380458})
    monkeypatch.setattr(rw, "refresh_shares", lambda: None)
    monkeypatch.setattr(rw, "refresh_industry", lambda: None)
    monkeypatch.setattr(rw, "enrich_industry", lambda evs: evs)
    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")

    out = rw.run_weekly()  # today 未帶入，應走 _today_taipei()

    # date(2026,6,27) 是週六，next_week_window 應算出下週一 2026-06-29
    assert out["start"] == "2026-06-29"
