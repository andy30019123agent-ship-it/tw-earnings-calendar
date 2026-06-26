import scripts.push as push


def test_push_telegram_posts_to_api(monkeypatch):
    calls = {}
    monkeypatch.setenv("TG_BOT_TOKEN", "T")
    monkeypatch.setenv("TG_CHAT_ID", "542348223")
    monkeypatch.setattr(push, "_post", lambda url, payload: calls.update(url=url, payload=payload) or True)
    assert push.push_telegram("hi") is True
    assert "botT/sendMessage" in calls["url"]
    assert calls["payload"]["chat_id"] == "542348223"


def test_push_skips_when_secret_missing(monkeypatch):
    monkeypatch.delenv("DISCORD_WEBHOOK", raising=False)
    assert push.push_discord("hi") is False
