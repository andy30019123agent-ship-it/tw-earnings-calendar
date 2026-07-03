"""產業別填充模組測試：ISIN 頁面解析、快取讀寫、事件補值。"""
import json

from scripts import industry
from scripts.lib.models import CalendarEvent

SAMPLE_ROW_TWSE = (
    "<tr><td bgcolor=#FAFAD2>2330　台積電</td>"
    "<td bgcolor=#FAFAD2>TW0002330008</td>"
    "<td bgcolor=#FAFAD2>1994/09/05</td>"
    "<td bgcolor=#FAFAD2>上市</td>"
    "<td bgcolor=#FAFAD2>半導體業</td>"
    "<td bgcolor=#FAFAD2>ESVUFR</td><td bgcolor=#FAFAD2></td></tr>"
)
SAMPLE_ROW_NO_INDUSTRY = (
    "<tr><td bgcolor=#FAFAD2>700019　宏捷科統一5C購01</td>"
    "<td bgcolor=#FAFAD2>TW25Z7000198</td>"
    "<td bgcolor=#FAFAD2>2025/10/01</td>"
    "<td bgcolor=#FAFAD2>上櫃</td>"
    "<td bgcolor=#FAFAD2></td>"
    "<td bgcolor=#FAFAD2>RWSCCA</td><td bgcolor=#FAFAD2></td></tr>"
)
SAMPLE_HEADER_ROW = (
    "<tr align=center><td bgcolor=#D5FFD5>有價證券代號及名稱 </td>"
    "<td bgcolor=#D5FFD5>國際證券辨識號碼(ISIN Code)</td></tr>"
)


def test_parse_isin_page_extracts_industry():
    raw = SAMPLE_HEADER_ROW + SAMPLE_ROW_TWSE + SAMPLE_ROW_NO_INDUSTRY
    result = industry._parse_isin_page(raw)
    assert result["2330"] == "半導體業"


def test_parse_isin_page_skips_rows_without_industry():
    raw = SAMPLE_ROW_NO_INDUSTRY
    result = industry._parse_isin_page(raw)
    assert "700019" not in result


def test_parse_isin_page_skips_non_4digit_codes():
    raw = SAMPLE_HEADER_ROW
    result = industry._parse_isin_page(raw)
    assert result == {}


def test_load_industry_missing_file_returns_empty(monkeypatch, tmp_path):
    monkeypatch.setattr(industry, "_CACHE_PATH", tmp_path / "nope.json")
    assert industry.load_industry() == {}


def test_refresh_industry_writes_cache(monkeypatch, tmp_path):
    cache_path = tmp_path / "industry_cache.json"
    monkeypatch.setattr(industry, "_CACHE_PATH", cache_path)

    def fake_get_text(url, encoding="utf-8"):
        if "strMode=2" in url:
            return SAMPLE_ROW_TWSE
        return ""

    monkeypatch.setattr(industry, "get_text", fake_get_text)
    result = industry.refresh_industry()

    assert result["2330"] == "半導體業"
    assert json.loads(cache_path.read_text(encoding="utf-8"))["2330"] == "半導體業"


def test_refresh_industry_all_sources_fail_keeps_old_cache(monkeypatch, tmp_path):
    cache_path = tmp_path / "industry_cache.json"
    cache_path.write_text(json.dumps({"2330": "半導體業"}), encoding="utf-8")
    monkeypatch.setattr(industry, "_CACHE_PATH", cache_path)
    monkeypatch.setattr(industry, "get_text", lambda url, encoding="utf-8": None)

    result = industry.refresh_industry()

    assert result == {"2330": "半導體業"}, "抓取全失敗時應沿用舊快取，不清空"


def test_enrich_industry_fills_from_cache(monkeypatch):
    monkeypatch.setattr(industry, "load_industry", lambda: {"2330": "半導體業"})
    e = CalendarEvent("2330", "台積電", "上市", "", "2026-07-01", "法說會", 0.0, False)
    out = industry.enrich_industry([e])[0]
    assert out.industry == "半導體業"


def test_enrich_industry_does_not_overwrite_existing_value(monkeypatch):
    monkeypatch.setattr(industry, "load_industry", lambda: {"2330": "半導體業"})
    e = CalendarEvent("2330", "台積電", "上市", "既有值", "2026-07-01", "法說會", 0.0, False)
    out = industry.enrich_industry([e])[0]
    assert out.industry == "既有值"


def test_enrich_industry_missing_code_stays_blank():
    """查無產業別的代號一律留空白，不准塞猜測值。"""
    e = CalendarEvent("9999", "查無公司", "上市", "", "2026-07-01", "法說會", 0.0, False)
    out = industry.enrich_industry([e])[0]
    assert out.industry == ""
