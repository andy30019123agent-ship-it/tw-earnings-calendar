from scripts.lib.models import CalendarEvent

def test_calendar_event_to_dict():
    e = CalendarEvent(id="2330", name="台積電", market="上市",
                      industry="半導體", date="2026-07-01", type="法說會",
                      market_cap=28500.0, cap_is_estimate=False)
    d = e.to_dict()
    assert d["id"] == "2330"
    assert d["type"] == "法說會"
    assert d["cap_is_estimate"] is False
