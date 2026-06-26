from datetime import date
from scripts.lib.dates import next_week_window

def test_next_week_window_from_saturday():
    # 2026-06-27 是週六，下週一=06-29、下週日=07-05
    assert next_week_window(date(2026,6,27)) == ("2026-06-29","2026-07-05")

def test_next_week_window_from_sunday():
    # 2026-06-28 是週日，下週一=06-29、下週日=07-05
    assert next_week_window(date(2026,6,28)) == ("2026-06-29","2026-07-05")
