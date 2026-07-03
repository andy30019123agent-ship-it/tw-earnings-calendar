from scripts.lib.models import CalendarEvent
from scripts.build_message import build_calendar_message, build_latest_json

EVTS = [
    CalendarEvent("2330","台積電","上市","半導體","2026-07-01","法說會",285000.0,False),
    CalendarEvent("2454","聯發科","上市","半導體","2026-07-01","法說會",92000.0,False),
    CalendarEvent("3008","大立光","上市","光電","2026-07-03","財報",4000.0,False),
]

def test_message_groups_by_day_and_sorts_by_cap():
    msg = build_calendar_message(EVTS, "2026-06-29", "2026-07-05")
    assert "7/1" in msg and "7/3" in msg
    # 同日內台積電(285000)排在聯發科(92000)前
    assert msg.index("2330") < msg.index("2454")
    # 表尾誠實標示
    assert "非投資建議" in msg or "預告" in msg

def test_empty_message_not_silent():
    msg = build_calendar_message([], "2026-06-29", "2026-07-05")
    assert "暫無" in msg

def test_latest_json_shape():
    j = build_latest_json(EVTS, "2026-06-29", "2026-07-05")
    assert j["range"] == ["2026-06-29","2026-07-05"]
    assert len(j["events"]) == 3

def test_estimate_marker():
    evt = CalendarEvent("6666","某股","上櫃","其他","2026-07-01","法說會",1234.0,True)
    msg = build_calendar_message([evt], "2026-06-29", "2026-07-05")
    assert "(估)" in msg

def test_latest_json_has_updated():
    j = build_latest_json(EVTS, "2026-06-29", "2026-07-05")
    assert "updated" in j

def test_blank_industry_does_not_leave_double_space():
    """industry 空白時排版不能壞：不應出現連續三個以上空格。"""
    evt = CalendarEvent("6666","某股","上櫃","","2026-07-01","法說會",1234.0,False)
    msg = build_calendar_message([evt], "2026-06-29", "2026-07-05")
    assert "   " not in msg
    assert "市值 1234 億" in msg

def test_industry_shown_when_present():
    evt = CalendarEvent("2330","台積電","上市","半導體業","2026-07-01","法說會",285000.0,False)
    msg = build_calendar_message([evt], "2026-06-29", "2026-07-05")
    assert "半導體業" in msg
