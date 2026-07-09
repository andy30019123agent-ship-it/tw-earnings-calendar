import json
import os
import urllib.request


def _post(url, payload):
    """POST JSON payload to URL. Returns True on success, False on failure."""
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def _chunk(text, limit):
    """Split text into chunks of at most `limit` chars, splitting on newlines.
    If a single line exceeds limit, it is hard-split at the limit boundary."""
    if len(text) <= limit:
        return [text]
    chunks = []
    current = []
    current_len = 0
    for line in text.split('\n'):
        line_with_nl = len(line) + 1  # +1 for the '\n' we rejoin with
        if current and current_len + line_with_nl > limit:
            chunks.append('\n'.join(current))
            current = []
            current_len = 0
        if line_with_nl > limit:
            # flush pending lines first
            if current:
                chunks.append('\n'.join(current))
                current = []
                current_len = 0
            # hard-split the oversized line
            for i in range(0, len(line), limit):
                chunks.append(line[i:i + limit])
        else:
            current.append(line)
            current_len += line_with_nl
    if current:
        chunks.append('\n'.join(current))
    return chunks


def push_telegram(text):
    """Push text to Telegram. Returns True on success, False if secrets missing or on error."""
    token = os.getenv("TG_BOT_TOKEN")
    chat_id = os.getenv("TG_CHAT_ID")

    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    for chunk in _chunk(text, 4000):
        payload = {"chat_id": chat_id, "text": chunk}
        if not _post(url, payload):
            return False
    return True


def push_discord(text):
    """Push text to Discord. Returns True on success, False if webhook missing or on error."""
    webhook = os.getenv("DISCORD_WEBHOOK")

    if not webhook:
        return False

    for chunk in _chunk(text, 1900):
        payload = {"content": chunk}
        if not _post(webhook, payload):
            return False
    return True


def push_all(text):
    """Push text to both Telegram and Discord. Each error is swallowed independently.
    回傳 True 代表「至少一個管道成功」；兩個都失敗（或都沒設定）回 False，
    讓呼叫端據此決定要不要寫入 notify_state（避免推播失敗卻被冪等旗標標記成已推）。"""
    try:
        tg = push_telegram(text)
    except Exception:
        tg = False

    try:
        dc = push_discord(text)
    except Exception:
        dc = False

    return bool(tg or dc)
