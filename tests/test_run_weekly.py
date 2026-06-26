"""Task 6 測試：週六入口 run_weekly 串接與失敗處理。"""

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
    monkeypatch.setattr(rw, "push_all", lambda t: None)
    monkeypatch.setattr(rw, "LATEST_PATH", tmp_path / "latest.json")
    out = rw.run_weekly(today=date(2026, 6, 27))
    assert "count" in out
    assert out["count"] == 0


def test_run_weekly_empty_window_pushes_no_events_message(monkeypatch, tmp_path):
    """空窗口（無事件）應推「暫無」訊息，不得推空字串或靜默。"""
    monkeypatch.setattr(rw, "fetch_events", lambda s, en: [])
    monkeypatch.setattr(rw, "enrich_market_cap", lambda evs: evs)
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
