from scripts import pick_store

LATEST = {"events":[
    {"id":"2330","name":"台積電","date":"2026-07-01","type":"法說會"},
    {"id":"2454","name":"聯發科","date":"2026-07-03","type":"法說會"},
]}

def test_add_and_due(tmp_path, monkeypatch):
    monkeypatch.setattr(pick_store, "PICKS_PATH", tmp_path/"picks.json")
    added = pick_store.add_picks(["2330","2454"], LATEST)
    assert set(added) == {"2330","2454"}
    # 7/2 早上檢查 → 7/1 開完的 2330 到期
    due = pick_store.due_reminders("2026-07-02")
    assert [d["id"] for d in due] == ["2330"]

def test_add_ignores_unknown_id(tmp_path, monkeypatch):
    monkeypatch.setattr(pick_store, "PICKS_PATH", tmp_path/"picks.json")
    assert pick_store.add_picks(["9999"], LATEST) == []
