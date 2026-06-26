from datetime import date, timedelta


def next_week_window(today: date) -> tuple:
    """回傳下週一與下週日的 ISO 日期字串。

    Args:
        today: 基準日期（date 物件）

    Returns:
        (next_monday_iso, next_sunday_iso) 的 tuple
    """
    monday = today + timedelta(days=(7 - today.weekday()))  # 下週一
    sunday = monday + timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()
