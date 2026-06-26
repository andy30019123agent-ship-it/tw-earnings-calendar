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
        with urllib.request.urlopen(req) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def push_telegram(text):
    """Push text to Telegram. Returns True on success, False if secrets missing or on error."""
    token = os.getenv("TG_BOT_TOKEN")
    chat_id = os.getenv("TG_CHAT_ID")

    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text
    }

    return _post(url, payload)


def push_discord(text):
    """Push text to Discord. Returns True on success, False if webhook missing or on error."""
    webhook = os.getenv("DISCORD_WEBHOOK")

    if not webhook:
        return False

    payload = {
        "content": text
    }

    return _post(webhook, payload)


def push_all(text):
    """Push text to both Telegram and Discord. Each error is swallowed independently."""
    try:
        push_telegram(text)
    except Exception:
        pass

    try:
        push_discord(text)
    except Exception:
        pass
