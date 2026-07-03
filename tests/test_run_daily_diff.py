"""每日法說會異動核對測試：新增／取消／改期三情境 + 無異動安靜 + 抓取失敗告警。"""
import json

import pytest

import scripts.run_daily_diff as rd
from scripts.fetch_calendar import CalendarFetchError
from scripts.lib.models import CalendarEvent

BASE_EVENT = {
    "id": "2330",
    "name": "台積電",
    "market": "上市",
    "industry": "半導體業",
    "date": "2026-07-01",
    "type": "法說會",
    "market_cap": 285000.0,
    "cap_is_estimate": False,
}


def _write_latest(tmp_path, events, start="2026-06-29", end="2026-07-05"):
    path = tmp_path / "latest.json"
    path.write_text(
        json.dumps({"updated": "2026-06-27T12:00:00+08:00", "range": [start, end], "events": events}),
        encoding="utf-8",
    )
    return path


def _stub_common(monkeypatch, pushed):
    monkeypatch.setattr(rd, "enrich_market_cap", lambda evs: evs)
    monkeypatch.setattr(rd, "enrich_industry", lambda evs: evs)
    monkeypatch.setattr(rd, "push_all", lambda t: pushed.append(t))


# ── 無已發布清單：安靜跳過 ───────────────────────────────────────────────

def test_no_baseline_silently_skips(monkeypatch, tmp_path):
    monkeypatch.setattr(rd, "LATEST_PATH", tmp_path / "latest.json")  # 檔案不存在
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: (_ for _ in ()).throw(AssertionError("不應呼叫")))

    out = rd.run_daily_diff()

    assert out["changed"] is False
    assert pushed == []


# ── 無異動：安靜不推 ────────────────────────────────────────────────────

def test_no_change_stays_silent(monkeypatch, tmp_path):
    latest_path = _write_latest(tmp_path, [BASE_EVENT])
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    same_event = CalendarEvent("2330", "台積電", "上市", "半導體業", "2026-07-01", "法說會", 285000.0, False)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [same_event])

    out = rd.run_daily_diff()

    assert out["changed"] is False
    assert pushed == [], "無異動時不應推播"
    # latest.json 不應被改寫
    assert json.loads(latest_path.read_text(encoding="utf-8"))["events"] == [BASE_EVENT]


# ── 新增 ────────────────────────────────────────────────────────────────

def test_added_event_triggers_push_and_persists(monkeypatch, tmp_path):
    latest_path = _write_latest(tmp_path, [BASE_EVENT])
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)

    old_event = CalendarEvent("2330", "台積電", "上市", "半導體業", "2026-07-01", "法說會", 285000.0, False)
    new_event = CalendarEvent("2454", "聯發科", "上市", "半導體業", "2026-07-02", "法說會", 92000.0, False)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [old_event, new_event])

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["added"] == 1 and out["removed"] == 0 and out["rescheduled"] == 0
    assert pushed, "有新增應推播"
    assert "新增" in pushed[0] and "2454" in pushed[0] and "聯發科" in pushed[0]
    written = json.loads(latest_path.read_text(encoding="utf-8"))
    assert {e["id"] for e in written["events"]} == {"2330", "2454"}


# ── 取消 ────────────────────────────────────────────────────────────────

def test_removed_event_triggers_push_and_persists(monkeypatch, tmp_path):
    latest_path = _write_latest(tmp_path, [BASE_EVENT])
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [])  # 2330 消失

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["removed"] == 1 and out["added"] == 0 and out["rescheduled"] == 0
    assert "取消" in pushed[0] and "2330" in pushed[0] and "台積電" in pushed[0]
    written = json.loads(latest_path.read_text(encoding="utf-8"))
    assert written["events"] == []


# ── 改期 ────────────────────────────────────────────────────────────────

def test_rescheduled_event_triggers_push_and_persists(monkeypatch, tmp_path):
    latest_path = _write_latest(tmp_path, [BASE_EVENT])
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    moved_event = CalendarEvent("2330", "台積電", "上市", "半導體業", "2026-07-03", "法說會", 285000.0, False)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [moved_event])

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["rescheduled"] == 1 and out["added"] == 0 and out["removed"] == 0
    assert "改期" in pushed[0] and "2026-07-01" in pushed[0] and "2026-07-03" in pushed[0]
    written = json.loads(latest_path.read_text(encoding="utf-8"))
    assert written["events"][0]["date"] == "2026-07-03"


# ── 同一公司同週多場法說會（不得以股號當唯一鍵互相覆蓋） ─────────────────

def _make_event(code="2330", name="台積電", date="2026-07-07"):
    return CalendarEvent(code, name, "上市", "半導體業", date, "法說會", 285000.0, False)


def _make_event_dict(code="2330", name="台積電", date="2026-07-07"):
    return {**BASE_EVENT, "id": code, "name": name, "date": date}


def test_same_company_two_sessions_unchanged_stays_silent(monkeypatch, tmp_path):
    """同公司同週兩場（7/07、7/10）新舊都在：不得誤報任何異動。"""
    old = [_make_event_dict(date="2026-07-07"), _make_event_dict(date="2026-07-10")]
    latest_path = _write_latest(tmp_path, old, start="2026-07-06", end="2026-07-12")
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [
        _make_event(date="2026-07-07"), _make_event(date="2026-07-10"),
    ])

    out = rd.run_daily_diff()

    assert out["changed"] is False
    assert pushed == [], "兩場都沒變不應推播"


def test_same_company_one_of_two_sessions_cancelled(monkeypatch, tmp_path):
    """兩場取消一場（7/10）：只報取消那場，另一場（7/07）不受影響。"""
    old = [_make_event_dict(date="2026-07-07"), _make_event_dict(date="2026-07-10")]
    latest_path = _write_latest(tmp_path, old, start="2026-07-06", end="2026-07-12")
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [_make_event(date="2026-07-07")])

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["removed"] == 1 and out["added"] == 0 and out["rescheduled"] == 0
    assert "取消" in pushed[0] and "2026-07-10" in pushed[0]
    assert "2026-07-07" not in pushed[0], "仍照常舉行的那場不應出現在異動訊息"
    written = json.loads(latest_path.read_text(encoding="utf-8"))
    assert [e["date"] for e in written["events"]] == ["2026-07-07"]


def test_same_company_second_session_added(monkeypatch, tmp_path):
    """原一場（7/07）新增第二場（7/10）：只報新增那場，不誤判成改期。"""
    old = [_make_event_dict(date="2026-07-07")]
    latest_path = _write_latest(tmp_path, old, start="2026-07-06", end="2026-07-12")
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [
        _make_event(date="2026-07-07"), _make_event(date="2026-07-10"),
    ])

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["added"] == 1 and out["removed"] == 0 and out["rescheduled"] == 0
    assert "新增" in pushed[0] and "2026-07-10" in pushed[0]
    assert "改期" not in pushed[0]


def test_same_company_one_of_two_sessions_rescheduled(monkeypatch, tmp_path):
    """兩場其中一場改期（7/10→7/11）：報改期且日期正確，另一場（7/07）不受影響。"""
    old = [_make_event_dict(date="2026-07-07"), _make_event_dict(date="2026-07-10")]
    latest_path = _write_latest(tmp_path, old, start="2026-07-06", end="2026-07-12")
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)
    monkeypatch.setattr(rd, "fetch_events", lambda s, e: [
        _make_event(date="2026-07-07"), _make_event(date="2026-07-11"),
    ])

    out = rd.run_daily_diff()

    assert out["changed"] is True
    assert out["rescheduled"] == 1 and out["added"] == 0 and out["removed"] == 0
    assert "改期" in pushed[0]
    assert "2026-07-10 → 2026-07-11" in pushed[0]
    assert "2026-07-07" not in pushed[0], "沒動的那場不應出現在異動訊息"


# ── 抓取失敗：告警＋重新拋出，且不得覆寫舊資料（不誤判成「全部取消」） ─────

def test_fetch_failure_pushes_warning_raises_and_preserves_old_data(monkeypatch, tmp_path):
    latest_path = _write_latest(tmp_path, [BASE_EVENT])
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    pushed = []
    _stub_common(monkeypatch, pushed)

    def bad_fetch(s, e):
        raise CalendarFetchError("MOPS 掛了")

    monkeypatch.setattr(rd, "fetch_events", bad_fetch)

    with pytest.raises(CalendarFetchError):
        rd.run_daily_diff()

    assert pushed, "抓取失敗應推警告"
    assert "失敗" in pushed[0] or "⚠️" in pushed[0]
    # 舊資料必須原封不動保留，不能被清空或誤判成全部取消
    assert json.loads(latest_path.read_text(encoding="utf-8"))["events"] == [BASE_EVENT]
