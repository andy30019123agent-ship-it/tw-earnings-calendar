from scripts.lib.models import CalendarEvent
from scripts import market_cap

def test_enrich_uses_shares_when_available(monkeypatch):
    monkeypatch.setattr(market_cap, "load_shares", lambda: {"2330": 25930000000})
    monkeypatch.setattr(market_cap, "_latest_close", lambda ids: {"2330": 1100.0})
    e = CalendarEvent("2330","台積電","上市","半導體","2026-07-01","法說會",0.0,False)
    out = market_cap.enrich_market_cap([e])[0]
    # 市值(億) = 1100 * 25,930,000,000 / 1e8 ≈ 285230
    assert out.market_cap > 280000 and out.cap_is_estimate is False

def test_enrich_falls_back_to_turnover(monkeypatch):
    monkeypatch.setattr(market_cap, "load_shares", lambda: {})  # 無股數
    monkeypatch.setattr(market_cap, "_latest_close", lambda ids: {"6666": 50.0})
    monkeypatch.setattr(market_cap, "_latest_volume", lambda ids: {"6666": 3000000})
    e = CalendarEvent("6666","某股","上櫃","其他","2026-07-02","法說會",0.0,False)
    out = market_cap.enrich_market_cap([e])[0]
    assert out.cap_is_estimate is True and out.market_cap > 0
