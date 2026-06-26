"""市值填充模組：從 TWSE/TPEX 抓取股數與收盤價，計算市值（億元）。

公開介面
--------
enrich_market_cap(events)  -- 填充 market_cap / cap_is_estimate
load_shares()              -- 讀 data/shares_cache.json
refresh_shares()           -- 抓最新股數並寫回快取

內部 helper（供 monkeypatch 測試用，請勿改名）
-----------------------------------------------
_latest_close(ids)  -- {代號: 收盤價}
_latest_volume(ids) -- {代號: 成交股數}
"""
import csv
import dataclasses
import io
import json
import pathlib

from scripts.lib.http import get_text

# ── 路徑 ──────────────────────────────────────────────────────────────────
_CACHE_PATH = pathlib.Path(__file__).parent.parent / "data" / "shares_cache.json"

# ── 資料源 URL ─────────────────────────────────────────────────────────────
# TWSE 上市公司基本資料（含已發行普通股數）
_TWSE_BASIC_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
# TPEX 上櫃公司基本資料（含 IssueShares 已發行股數）
_TPEX_BASIC_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"
# TWSE 全股每日收盤（CSV：日期,證券代號,證券名稱,成交股數,...,收盤價,...）
_TWSE_PRICE_URL = "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json"
# TPEX 上櫃每日收盤（JSON：SecuritiesCompanyCode/Close/Capitals(=IssueShares)/TradingShares）
_TPEX_PRICE_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"

# TWSE CSV 欄位索引（從 0 起）
_COL_CODE = 1
_COL_CLOSE = 8
_COL_VOL = 3


# ── 股數快取 ───────────────────────────────────────────────────────────────

def load_shares() -> dict:
    """讀取 data/shares_cache.json，回傳 {代號: 已發行股數(股)} 字典。
    讀取失敗或檔案不存在時回傳空字典。
    """
    try:
        return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def refresh_shares() -> dict:
    """從 TWSE/TPEX 抓取最新已發行普通股股數，寫回 data/shares_cache.json。
    回傳 {代號: 股數(股)} 字典。任一來源失敗時保留另一來源的結果。
    """
    result: dict[str, int] = {}

    # --- TWSE 上市公司（openapi.twse.com.tw t187ap03_L） ---
    text = get_text(_TWSE_BASIC_URL)
    if text:
        try:
            for row in json.loads(text):
                code = row.get("公司代號", "").strip()
                shares_str = (
                    row.get("已發行普通股數或TDR原股發行股數", "")
                    .replace(",", "").strip()
                )
                if code and shares_str.isdigit():
                    shares = int(shares_str)
                    if shares > 0:
                        result[code] = shares
        except Exception:
            pass

    # --- TPEX 上櫃公司（tpex.org.tw mopsfin_t187ap03_O，IssueShares 欄） ---
    text = get_text(_TPEX_BASIC_URL)
    if text:
        try:
            for row in json.loads(text):
                code = row.get("SecuritiesCompanyCode", "").strip()
                shares_str = row.get("IssueShares", "").replace(",", "").strip()
                if code and shares_str.isdigit():
                    shares = int(shares_str)
                    if shares > 0 and code not in result:
                        result[code] = shares
        except Exception:
            pass

    _CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


# ── 價格 helpers（module-level 以支援 monkeypatch） ────────────────────────

def _latest_close(ids: list) -> dict:
    """取 TWSE+TPEX 最新收盤價，回傳 {代號: 收盤價(元)} 字典。
    找不到的代號不放入結果（而非放 0）。
    """
    id_set = set(ids)
    result: dict[str, float] = {}

    # TWSE（CSV 格式）
    text = get_text(_TWSE_PRICE_URL)
    if text:
        try:
            reader = csv.reader(io.StringIO(text))
            next(reader, None)  # 跳標頭列
            for row in reader:
                if len(row) <= _COL_CLOSE:
                    continue
                code = row[_COL_CODE].strip()
                if code not in id_set:
                    continue
                close_str = row[_COL_CLOSE].strip().replace(",", "")
                try:
                    result[code] = float(close_str)
                except ValueError:
                    pass
        except Exception:
            pass

    # TPEX（JSON 格式，補 TWSE 找不到的代號）
    if len(result) < len(id_set):
        text = get_text(_TPEX_PRICE_URL)
        if text:
            try:
                for row in json.loads(text):
                    code = row.get("SecuritiesCompanyCode", "").strip()
                    if code not in id_set or code in result:
                        continue
                    close_str = str(row.get("Close", "")).replace(",", "").strip()
                    try:
                        result[code] = float(close_str)
                    except ValueError:
                        pass
            except Exception:
                pass

    return result


def _latest_volume(ids: list) -> dict:
    """取 TWSE+TPEX 最新成交股數，回傳 {代號: 成交股數(股)} 字典。
    找不到的代號不放入結果（而非放 0）。
    """
    id_set = set(ids)
    result: dict[str, int] = {}

    # TWSE（CSV 格式）
    text = get_text(_TWSE_PRICE_URL)
    if text:
        try:
            reader = csv.reader(io.StringIO(text))
            next(reader, None)  # 跳標頭列
            for row in reader:
                if len(row) <= _COL_VOL:
                    continue
                code = row[_COL_CODE].strip()
                if code not in id_set:
                    continue
                vol_str = row[_COL_VOL].strip().replace(",", "")
                try:
                    result[code] = int(vol_str)
                except ValueError:
                    pass
        except Exception:
            pass

    # TPEX（JSON 格式，TradingShares 欄）
    if len(result) < len(id_set):
        text = get_text(_TPEX_PRICE_URL)
        if text:
            try:
                for row in json.loads(text):
                    code = row.get("SecuritiesCompanyCode", "").strip()
                    if code not in id_set or code in result:
                        continue
                    vol_str = str(row.get("TradingShares", "")).replace(",", "").strip()
                    try:
                        result[code] = int(vol_str)
                    except ValueError:
                        pass
            except Exception:
                pass

    return result


# ── 主要公開介面 ───────────────────────────────────────────────────────────

def enrich_market_cap(events: list) -> list:
    """填充 CalendarEvent 清單的 market_cap 與 cap_is_estimate。

    計算邏輯：
    - 有股數 → 市值(億元) = 收盤 × 股數 / 1e8，cap_is_estimate=False
    - 無股數 → 以 收盤 × 成交股數 / 1e8 作人氣代理，cap_is_estimate=True
    - 都無法取得 → 保持 0.0（cal_is_estimate 維持原值）
    """
    if not events:
        return events

    ids = [e.id for e in events]
    shares_map = load_shares()
    close_map = _latest_close(ids)

    result = []
    for e in events:
        close = close_map.get(e.id)
        shares = shares_map.get(e.id)

        if close is not None and shares is not None:
            cap = round(close * shares / 1e8, 2)
            result.append(dataclasses.replace(e, market_cap=cap, cap_is_estimate=False))
        elif close is not None:
            vol_map = _latest_volume([e.id])
            vol = vol_map.get(e.id)
            if vol is not None:
                cap = round(close * vol / 1e8, 2)
                result.append(dataclasses.replace(e, market_cap=cap, cap_is_estimate=True))
            else:
                result.append(e)
        else:
            result.append(e)

    return result
