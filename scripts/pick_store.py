import json
from pathlib import Path
from datetime import datetime, timedelta

PICKS_PATH = "data/picks.json"


def load_picks():
    """Load picks from PICKS_PATH (dynamically read at call time)."""
    picks_path = Path(PICKS_PATH)
    if picks_path.exists():
        with open(picks_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def _save_picks(picks):
    """Save picks to PICKS_PATH (dynamically read at call time)."""
    picks_path = Path(PICKS_PATH)
    picks_path.parent.mkdir(parents=True, exist_ok=True)
    with open(picks_path, 'w', encoding='utf-8') as f:
        json.dump(picks, f, ensure_ascii=False, indent=2)


def add_picks(ids, latest):
    """
    Add picks from latest["events"].

    For each id in ids, find its event in latest["events"] and store
    {id: {name, event_date, event_type, status:"watching"}}.
    Skip ids not found in latest.

    Returns list of ids actually added.
    """
    picks = load_picks()
    added = []

    # Build a map of id -> event from latest
    event_map = {evt["id"]: evt for evt in latest.get("events", [])}

    for id in ids:
        if id in event_map:
            evt = event_map[id]
            picks[id] = {
                "name": evt["name"],
                "event_date": evt["date"],
                "event_type": evt["type"],
                "status": "watching"
            }
            added.append(id)

    _save_picks(picks)
    return added


def set_status(id, status):
    """Set status for a pick by id."""
    picks = load_picks()
    if id in picks:
        picks[id]["status"] = status
        _save_picks(picks)


def due_reminders(today_iso):
    """
    Return picks where event_date == yesterday and status == "watching".

    today_iso: ISO format date string (e.g., "2026-07-02")
    yesterday: today - 1 day
    """
    picks = load_picks()

    # Calculate yesterday
    today = datetime.fromisoformat(today_iso)
    yesterday = today - timedelta(days=1)
    yesterday_iso = yesterday.strftime("%Y-%m-%d")

    # Filter picks with event_date == yesterday and status == "watching"
    due = [
        {
            "id": id,
            **data
        }
        for id, data in picks.items()
        if data.get("event_date") == yesterday_iso and data.get("status") == "watching"
    ]

    return due
