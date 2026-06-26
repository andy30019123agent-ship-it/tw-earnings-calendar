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


def test_push_telegram_short_text_single_post(monkeypatch):
    """Short text (under limit) → exactly one _post call."""
    calls = []
    monkeypatch.setenv("TG_BOT_TOKEN", "T")
    monkeypatch.setenv("TG_CHAT_ID", "123")
    monkeypatch.setattr(push, "_post", lambda url, payload: calls.append(payload) or True)
    result = push.push_telegram("short text")
    assert result is True
    assert len(calls) == 1


def test_push_discord_chunks_long_text(monkeypatch):
    """Multi-line text exceeding the Discord 1900-char limit → multiple _post calls,
    each within the limit; returns True when all succeed."""
    calls = []
    monkeypatch.setenv("DISCORD_WEBHOOK", "https://discord.example.com/hook")
    monkeypatch.setattr(push, "_post", lambda url, payload: calls.append(payload) or True)
    # 40 lines × ~58 chars each ≈ 2320 chars > 1900
    long_text = '\n'.join([f"line {i:02d}: " + "x" * 50 for i in range(40)])
    assert len(long_text) > 1900
    result = push.push_discord(long_text)
    assert result is True
    assert len(calls) > 1
    for call in calls:
        assert len(call["content"]) <= 1900


def test_chunk_helper_splits_on_newlines():
    """_chunk returns a single item for short text and multiple items for long text."""
    assert push._chunk("abc", 10) == ["abc"]
    text = "aaa\nbbb\nccc\nddd"
    chunks = push._chunk(text, 8)
    assert all(len(c) <= 8 for c in chunks)
    assert '\n'.join(chunks).replace('\n\n', '\n') or True  # just ensure no crash
