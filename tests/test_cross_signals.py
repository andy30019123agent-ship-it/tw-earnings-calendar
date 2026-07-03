import scripts.cross_signals as cs


# ── fetch_screener_signal ────────────────────────────────────────────────

def test_fetch_screener_signal_found_with_tags(monkeypatch):
    """該股在清單中且有訊號 → 回傳最多 3 個標籤組成的訊號行。"""
    payload = (
        '{"stocks": [{"id": "2330", "bull_aligned": true, "diverging": true, '
        '"foreign_streak": 4, "trust_streak": 0}]}'
    )
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: payload)
    line = cs.fetch_screener_signal("2330")
    assert line == "📈 訊號：多頭發散・外資連4買"


def test_fetch_screener_signal_caps_at_three_tags(monkeypatch):
    payload = (
        '{"stocks": [{"id": "2330", "signal_breakout": true, "sn_tags": ["縮口帶量突破"], '
        '"bull_aligned": true, "foreign_streak": 5, "trust_streak": 5, '
        '"holder_rising": true, "undervalued": true}]}'
    )
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: payload)
    line = cs.fetch_screener_signal("2330")
    assert line is not None
    tags = line.replace("📈 訊號：", "").split("・")
    assert len(tags) == 3


def test_fetch_screener_signal_not_in_list_returns_none(monkeypatch):
    """股號不在選股清單中 → 靜默回 None，不噴例外。"""
    payload = '{"stocks": [{"id": "2317", "bull_aligned": true}]}'
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: payload)
    assert cs.fetch_screener_signal("2330") is None


def test_fetch_screener_signal_no_tags_returns_none(monkeypatch):
    """該股在清單中但無任何訊號 → 回 None（不加空字串行）。"""
    payload = '{"stocks": [{"id": "2330", "bull_aligned": false, "foreign_streak": 0}]}'
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: payload)
    assert cs.fetch_screener_signal("2330") is None


def test_fetch_screener_signal_fetch_failure_returns_none(monkeypatch):
    """get_text 逾時/失敗回 None（既有慣例） → 靜默回 None，提醒本體不受影響。"""
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: None)
    assert cs.fetch_screener_signal("2330") is None


def test_fetch_screener_signal_malformed_json_returns_none(monkeypatch):
    """回應格式不符（非 JSON 或缺 stocks 欄位）→ 靜默回 None。"""
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: "<html>not json</html>")
    assert cs.fetch_screener_signal("2330") is None
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: '{"no_stocks_key": []}')
    assert cs.fetch_screener_signal("2330") is None


# ── fetch_market_stance_line ─────────────────────────────────────────────

def test_fetch_market_stance_line_success(monkeypatch):
    def fake_get_text(url, tries=1):
        if "index.json" in url:
            return '{"dates": ["2026-06-30", "2026-07-02", "2026-07-01"]}'
        assert url.endswith("2026-07-02.json")
        return '{"verdict": {"tw": {"stance": "中性偏多"}}}'

    monkeypatch.setattr(cs, "get_text", fake_get_text)
    line = cs.fetch_market_stance_line()
    assert line == "今日市況研判：中性偏多（AI 生成僅供參考）"


def test_fetch_market_stance_line_index_fetch_failure_returns_none(monkeypatch):
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: None)
    assert cs.fetch_market_stance_line() is None


def test_fetch_market_stance_line_day_fetch_failure_returns_none(monkeypatch):
    def fake_get_text(url, tries=1):
        if "index.json" in url:
            return '{"dates": ["2026-07-02"]}'
        return None  # 當日資料抓失敗

    monkeypatch.setattr(cs, "get_text", fake_get_text)
    assert cs.fetch_market_stance_line() is None


def test_fetch_market_stance_line_missing_stance_returns_none(monkeypatch):
    def fake_get_text(url, tries=1):
        if "index.json" in url:
            return '{"dates": ["2026-07-02"]}'
        return '{"verdict": {"tw": {}}}'

    monkeypatch.setattr(cs, "get_text", fake_get_text)
    assert cs.fetch_market_stance_line() is None


def test_fetch_market_stance_line_empty_index_returns_none(monkeypatch):
    monkeypatch.setattr(cs, "get_text", lambda url, tries=1: '{"dates": []}')
    assert cs.fetch_market_stance_line() is None
