import scripts.run_daily_remind as rd


def test_run_daily_pushes_due(monkeypatch):
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    n = rd.run_daily(today_iso="2026-07-02")
    assert n == 1 and "詳細 2330" in sent[0]


def test_run_daily_no_due_silent(monkeypatch):
    """無到期項目時不推播，靜默返回 0。"""
    monkeypatch.setattr(rd, "due_reminders", lambda d: [])
    sent = []
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
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
    rd.run_daily(today_iso="2026-07-02")
    assert ("2317", "event_passed") in statuses
    assert ("2330", "event_passed") in statuses


def test_run_daily_message_format(monkeypatch):
    """訊息格式應包含名稱、股票代碼、事件類型。"""
    sent = []
    monkeypatch.setattr(rd, "due_reminders", lambda d: [{"id": "2330", "name": "台積電", "event_type": "法說會"}])
    monkeypatch.setattr(rd, "push_all", lambda t: sent.append(t))
    monkeypatch.setattr(rd, "set_status", lambda i, s: None)
    rd.run_daily(today_iso="2026-07-02")
    msg = sent[0]
    assert "台積電" in msg
    assert "2330" in msg
    assert "法說會" in msg
    assert "📣" in msg
