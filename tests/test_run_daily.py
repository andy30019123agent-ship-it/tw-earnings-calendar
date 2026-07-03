import scripts.run_daily_remind as rd


def _mute_cross_signals(monkeypatch, signal=None, stance=None):
    """預設兩個跨專案 fetch 都回 None（等同外部服務不可用/查無），維持既有測試對訊息內容的斷言不受影響。"""
    monkeypatch.setattr(rd, "fetch_screener_signal", lambda stock_id: signal)
    monkeypatch.setattr(rd, "fetch_market_stance_line", lambda: stance)


def test_run_daily_pushes_due(monkeypatch):
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(monkeypatch)
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 1 and "詳細 2330" in sent[0]


def test_run_daily_no_due_silent(monkeypatch):
    """無到期項目時不推播，靜默返回 0。"""
    monkeypatch.setattr(rd, "due_reminders", lambda d: [])
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(monkeypatch)
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 0
    assert sent == []


def test_run_daily_sets_event_passed(monkeypatch):
    """每個到期項目狀態應設為 event_passed。"""
    statuses = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [
        {"id": "2317", "name": "鴻海", "event_type": "財報"},
        {"id": "2330", "name": "台積電", "event_type": "法說會"},
    ])
    monkeypatch.setattr(rd, "push_all", lambda t: None)
    monkeypatch.setattr(rd, "set_status", lambda i, s: statuses.append((i, s)))
    _mute_cross_signals(monkeypatch)
    rd.run_daily(today_iso="2026-07-02")
    assert ("2317", "event_passed") in statuses
    assert ("2330", "event_passed") in statuses


def test_run_daily_message_format(monkeypatch):
    """訊息格式應包含名稱、股票代碼、事件類型。"""
    sent = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(monkeypatch)
    rd.run_daily(today_iso="2026-07-02")
    msg = sent[0]
    assert "台積電" in msg
    assert "2330" in msg
    assert "法說會" in msg
    assert "📣" in msg


def test_run_daily_appends_signal_and_stance_when_available(monkeypatch):
    """兩個跨專案情報都拿得到時，訊息應附市況研判(開頭)與選股訊號(行尾)。"""
    sent = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(
        monkeypatch,
        signal="📈 訊號：多頭排列・外資連4天買",
        stance="今日市況研判：中性偏多（AI 生成僅供參考）",
    )
    rd.run_daily(today_iso="2026-07-02")
    msg = sent[0]
    lines = msg.split("\n")
    assert lines[0] == "今日市況研判：中性偏多（AI 生成僅供參考）"
    assert lines[-1] == "📈 訊號：多頭排列・外資連4天買"
    assert "詳細 2330" in msg  # 提醒本體仍在，未被覆蓋


def test_run_daily_omits_signal_when_not_found(monkeypatch):
    """該股不在選股清單或無訊號時，不加訊號行，提醒本體照常送出。"""
    sent = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "9999", "name": "冷門股", "event_type": "法說會"}])
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(monkeypatch, signal=None, stance="今日市況研判：偏空（AI 生成僅供參考）")
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 1
    msg = sent[0]
    assert "📈 訊號" not in msg
    assert "詳細 9999" in msg


def test_run_daily_survives_both_fetch_failures(monkeypatch):
    """選股訊號與市況研判兩個外部 fetch 都失敗（回 None）時，提醒仍照常發送、不掛掉。"""
    sent = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    _mute_cross_signals(monkeypatch, signal=None, stance=None)
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 1
    msg = sent[0]
    assert msg == "📣 台積電(2330) 昨天開完法說會了，回我『詳細 2330』就幫你出完整報告"


# ── 今日法說會晨間廣播 ─────────────────────────────────────────────────────

import json


def _setup_broadcast(monkeypatch, tmp_path, events):
    latest_path = tmp_path / "latest.json"
    latest_path.write_text(
        json.dumps({"range": ["2026-06-29", "2026-07-05"], "events": events}, ensure_ascii=False),
        encoding="utf-8",
    )
    monkeypatch.setattr(rd, "LATEST_PATH", latest_path)
    monkeypatch.setattr(rd, "STATE_PATH", tmp_path / "notify_state.json")
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    return sent


TODAY_EVENTS = [
    {"id": "8463", "name": "潤泰材", "industry": "其他業", "date": "2026-07-03", "market_cap": 32.1},
    {"id": "3663", "name": "鑫科", "industry": "其他電子業", "date": "2026-07-03", "market_cap": 87.23},
    {"id": "2330", "name": "台積電", "industry": "半導體業", "date": "2026-07-01", "market_cap": 285000.0},
]


def test_broadcast_pushes_today_events_with_industry(monkeypatch, tmp_path):
    """今日有場次：推清單（含產業別、市值大→小），不含其他日期的事件。"""
    sent = _setup_broadcast(monkeypatch, tmp_path, TODAY_EVENTS)
    out = rd.run_today_broadcast(today_iso="2026-07-03")
    assert out is True
    assert len(sent) == 1
    msg = sent[0]
    assert "📅 今日法說會 2 場" in msg
    assert "鑫科(3663·其他電子業)" in msg and "潤泰材(8463·其他業)" in msg
    assert msg.index("3663") < msg.index("8463"), "組內應市值大→小"
    assert "2330" not in msg, "非今日的事件不應出現"


def test_broadcast_no_events_today_stays_silent(monkeypatch, tmp_path):
    """當天無場次：不推、也不寫當日旗標。"""
    sent = _setup_broadcast(monkeypatch, tmp_path, TODAY_EVENTS)
    out = rd.run_today_broadcast(today_iso="2026-07-04")
    assert out is False
    assert sent == []
    assert not (tmp_path / "notify_state.json").exists()


def test_broadcast_idempotent_same_day(monkeypatch, tmp_path):
    """同一天重跑（保險 cron）：第一次推、第二次靠當日旗標不重複推。"""
    sent = _setup_broadcast(monkeypatch, tmp_path, TODAY_EVENTS)
    assert rd.run_today_broadcast(today_iso="2026-07-03") is True
    assert rd.run_today_broadcast(today_iso="2026-07-03") is False
    assert len(sent) == 1, "同日第二次不得重複推"
    state = json.loads((tmp_path / "notify_state.json").read_text(encoding="utf-8"))
    assert state["today_broadcast"] == "2026-07-03"


def test_broadcast_new_day_pushes_again(monkeypatch, tmp_path):
    """旗標記的是前一天：新的一天有場次照常推。"""
    events = TODAY_EVENTS + [
        {"id": "4907", "name": "富宇", "industry": "", "date": "2026-07-04", "market_cap": 48.2},
    ]
    sent = _setup_broadcast(monkeypatch, tmp_path, events)
    (tmp_path / "notify_state.json").write_text(
        json.dumps({"today_broadcast": "2026-07-03"}), encoding="utf-8",
    )
    out = rd.run_today_broadcast(today_iso="2026-07-04")
    assert out is True
    # industry 空白時排版不能壞：括號內只剩代號、無多餘的「·」
    assert "富宇(4907)" in sent[0]
    assert "·)" not in sent[0]


def test_broadcast_missing_latest_stays_silent(monkeypatch, tmp_path):
    """latest.json 不存在：安靜跳過，不推也不寫旗標。"""
    monkeypatch.setattr(rd, "LATEST_PATH", tmp_path / "nope.json")
    monkeypatch.setattr(rd, "STATE_PATH", tmp_path / "notify_state.json")
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    assert rd.run_today_broadcast(today_iso="2026-07-03") is False
    assert sent == []
