"""產業別填充模組：從 TWSE ISIN 一覽表抓取股票產業分類，補進事件。

資料源：isin.twse.com.tw 本國上市／上櫃證券 ISIN 一覽表，表格直接含「產業別」
欄位文字（例如「半導體業」），無需自建代碼對照表。頁面 HTTP header 宣稱
utf-8，實際回傳 cp950（Big5 超集），需指定 encoding 解碼，否則中文全變亂碼。

公開介面
--------
enrich_industry(events)  -- 填充 industry（已有值的事件不覆蓋；查無則維持空字串）
load_industry()          -- 讀 data/industry_cache.json
refresh_industry()       -- 抓最新產業別並寫回快取

查不到的個股一律留空白，不塞猜測值。
"""
from __future__ import annotations

import dataclasses
import json
import pathlib
import re

from scripts.lib.http import get_text

_CACHE_PATH = pathlib.Path(__file__).parent.parent / "data" / "industry_cache.json"

_ISIN_URL = "https://isin.twse.com.tw/isin/C_public.jsp?strMode={mode}"
_MODES = ("2", "4")  # 2=上市 4=上櫃

_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.DOTALL)
_TD_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")
_CODE_RE = re.compile(r"^(\d{4})[　\s]")


def load_industry() -> dict:
    """讀取 data/industry_cache.json，回傳 {代號: 產業別} 字典。
    讀取失敗或檔案不存在時回傳空字典。
    """
    try:
        return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _parse_isin_page(raw: str) -> dict:
    """解析 ISIN 一覽表 HTML，回傳 {代號: 產業別}（僅保留有產業別文字的列）。"""
    result: dict[str, str] = {}
    for row_match in _ROW_RE.finditer(raw):
        tds = _TD_RE.findall(row_match.group(1))
        if len(tds) < 5:
            continue
        code_name = _TAG_RE.sub("", tds[0]).strip()
        m = _CODE_RE.match(code_name)
        if not m:
            continue
        code = m.group(1)
        industry = _TAG_RE.sub("", tds[4]).strip()
        if industry:
            result[code] = industry
    return result


def refresh_industry() -> dict:
    """從 TWSE ISIN 一覽表（上市＋上櫃）抓最新產業別，寫回 data/industry_cache.json。
    回傳 {代號: 產業別} 字典。任一來源失敗時保留另一來源的結果；兩者皆失敗回舊快取。
    """
    result: dict[str, str] = {}
    for mode in _MODES:
        raw = get_text(_ISIN_URL.format(mode=mode), encoding="cp950")
        if not raw:
            continue
        try:
            result.update(_parse_isin_page(raw))
        except Exception:
            pass

    if not result:
        return load_industry()

    _CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def enrich_industry(events: list) -> list:
    """填充 CalendarEvent 清單的 industry（已有值不覆蓋，查無則維持空字串）。"""
    if not events:
        return events

    industry_map = load_industry()
    result = []
    for e in events:
        if e.industry:
            result.append(e)
            continue
        industry = industry_map.get(e.id)
        if industry:
            result.append(dataclasses.replace(e, industry=industry))
        else:
            result.append(e)
    return result
