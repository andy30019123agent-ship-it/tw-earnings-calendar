"""跨專案情報：抓選股訊號（tw-stock-screener）與市況研判（daily-market-dashboard）。

兩者皆為唯讀 fetch 對方 GitHub Pages 上公開的 JSON（Actions runner 上兩個 repo
互不相通，只能走線上網址；GitHub Pages CDN 可能有 1-2 分鐘快取，無妨）。

失敗安全鐵則：任何一步失敗（逾時／HTTP 錯誤／JSON 格式不符／查無該股／無訊號）
一律靜默回傳 None，呼叫端據此省略該段，絕不讓每日提醒因外部服務出包而掛掉。
"""
from __future__ import annotations

import json
from typing import Optional

from scripts.lib.http import get_text

SCREENER_URL = "https://andy30019123agent-ship-it.github.io/tw-stock-screener/data/screener.json"
DASHBOARD_INDEX_URL = "https://andy30019123agent-ship-it.github.io/daily-market-dashboard/data/index.json"
DASHBOARD_DAY_URL_TMPL = "https://andy30019123agent-ship-it.github.io/daily-market-dashboard/data/{date}.json"


def _fetch_json(url: str) -> Optional[dict]:
    text = get_text(url, tries=1)
    if not text:
        return None
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None


def _signal_tags(stock: dict) -> list[str]:
    """精簡版訊號標籤，比照 tw-stock-screener/pipeline/notify_tg.py 的 reasons()。"""
    tags: list[str] = []
    if stock.get("signal_breakout"):
        tags.append("爆量突破")
    for t in (stock.get("sn_tags") or [])[:1]:
        tags.append(t)
    if stock.get("signal_ma"):
        tags.append("糾結轉強")
    elif stock.get("bull_aligned") and stock.get("diverging"):
        tags.append("多頭發散")
    elif stock.get("bull_aligned"):
        tags.append("多頭排列")
    fs = stock.get("foreign_streak") or 0
    if fs >= 3:
        tags.append(f"外資連{fs}買")
    ts = stock.get("trust_streak") or 0
    if ts >= 3:
        tags.append(f"投信連{ts}買")
    if stock.get("holder_rising"):
        tags.append("千張↑")
    if stock.get("undervalued"):
        tags.append("同業低估")
    return tags[:3]


def fetch_screener_signal(stock_id: str) -> Optional[str]:
    """回傳該股訊號行，如「📈 訊號：多頭排列・外資連4天買」；查無該股或無訊號回 None。"""
    data = _fetch_json(SCREENER_URL)
    if not isinstance(data, dict) or not isinstance(data.get("stocks"), list):
        return None
    stock = next((s for s in data["stocks"] if s.get("id") == stock_id), None)
    if not isinstance(stock, dict):
        return None
    tags = _signal_tags(stock)
    if not tags:
        return None
    return f"📈 訊號：{'・'.join(tags)}"


def fetch_market_stance_line() -> Optional[str]:
    """回傳最近一個交易日台股研判行；任一步失敗回 None。"""
    index = _fetch_json(DASHBOARD_INDEX_URL)
    if not isinstance(index, dict) or not index.get("dates"):
        return None
    latest_date = sorted(index["dates"])[-1]
    day = _fetch_json(DASHBOARD_DAY_URL_TMPL.format(date=latest_date))
    if not isinstance(day, dict):
        return None
    stance = day.get("verdict", {}).get("tw", {}).get("stance")
    if not stance:
        return None
    return f"今日市況研判：{stance}（AI 生成僅供參考）"
