# 資料源探勘筆記

> 最後更新：2026-06-27（Task 2 實測）

---

## ✅ 法說會（投資人說明會）：MOPS ajax_t100sb02_1

### 狀態
已驗證可用，**實測可回傳未來日期事件**。

### 來源資訊
| 項目 | 值 |
|------|-----|
| Method | POST |
| URL | `https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1` |
| Host | `mopsov.twse.com.tw`（注意不是 `mops.twse.com.tw`，打主站會被防爬擋） |

### 必要 Headers
```
Referer: https://mopsov.twse.com.tw/mops/web/t100sb02_1
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36
```

### POST Body（form-urlencoded）
```
encodeURIComponent=1&step=1&firstin=1&TYPEK=sii&year=115&month=
```

- `TYPEK=sii`：上市；`TYPEK=otc`：上櫃（兩者都要抓，分別呼叫後合併）
- `year`：民國年（西元 − 1911，例如 2026 → 115）
- `month`：留空代表整年查詢

### 回傳格式
- **類型**：約 2.3 MB HTML（不是 JSON）
- **結構**：`<table id='myTable' class='hasBorder'>` 內的 `<tr data-type='body'>` 資料列

### 表頭欄位順序（實測）
| 欄位索引 | 欄位名稱 |
|----------|----------|
| 0 | 公司代號 |
| 1 | 公司名稱 |
| 2 | 召開法人說明會日期（民國格式，可為區間） |
| 3 | 召開法人說明會時間 |
| 4 | 召開法人說明會地點 |
| 5 | 法人說明會擇要訊息 |
| 6 | 法人說明會簡報內容（中文檔案） |
| 7 | 法人說明會簡報內容（英文檔案） |
| 8 | 公司網站是否提供法人說明會相關資訊 |
| 9 | 影音連結資訊 |
| 10 | 其他應敘明事項 |
| 11 | 歷年法人說明會 |

### 日期格式
- 單一日期：`115/06/26`
- 日期區間：`115/06/30 至 115/07/03`（取起始日）
- 轉西元：民國年 + 1911，輸出 ISO：`2026-06-26`

### 資料列過濾規則
- 資料列特徵：`<tr data-type='body'>`
- 只保留公司代號為 **4 位純數字**（過濾 ETF、權證、指數股票等）
- type 欄位固定為「**法說會**」

### 實測結果（2026-06-27）
- 上市（sii）整年：約 1,583 筆，含未來日期（6/29、6/30、7/7、7/8…）
- 上櫃（otc）整年：約 842 KB HTML，資料筆數較少
- 查詢區間 2026-06-29 到 2026-07-05，合計回傳 **33 筆** 有效事件

---

## ❌ 財報/董事會未來預告：尚無可靠來源（已知限制）

### 探勘結果

#### MOPS 董事會相關 endpoints
嘗試 `ajax_t100sb05`、`ajax_t100sb04`、`ajax_t100sb06/07/08` 等相近 endpoint：
- `t100sb06/07/08`：需帶單一公司代號，不支援全市場批次查詢
- `t100sb05`、`t100sb04` 等：連線回應為空（連線拒絕或 endpoint 不存在）
- **結論**：MOPS 無法批次取得全市場未來董事會召開預告

#### TWSE OpenAPI（openapi.twse.com.tw）
- `/opendata/t187ap04_L`（上市公司每日重大訊息）：僅回傳**已發生**公告，非未來預告
- `/opendata/t187ap03_L`（上市公司基本資料）：含 `產業別`（代碼，如 `01`）與 `已發行普通股數`，但無事件日期

#### TPEX OpenAPI
未找到上櫃法說會/財報預告的 OpenAPI endpoint。

### 結論
**財報未來預告官方來源目前尚不可靠**，本期（Task 2）只供「法說會」事件。
財報事件留待後續任務，待找到穩定來源後補充。

---

## 產業別補充

- TWSE `/opendata/t187ap03_L` 提供上市公司 `產業別` 欄位（為代碼數值，如 `01`）
- 上市公司也提供 `已發行普通股數`，可搭配股價計算市值（Task 3 負責）
- `industry` 欄位在 Task 2 先填空字串，待 Task 3 查詢公司資料時補填

---

## 驗證指令（可隨時重跑）

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
# 上市法說會
curl -s -A "$UA" -H "Referer: https://mopsov.twse.com.tw/mops/web/t100sb02_1" \
  "https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1" \
  --data "encodeURIComponent=1&step=1&firstin=1&TYPEK=sii&year=115&month=" | wc -c

# 上櫃法說會
curl -s -A "$UA" -H "Referer: https://mopsov.twse.com.tw/mops/web/t100sb02_1" \
  "https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1" \
  --data "encodeURIComponent=1&step=1&firstin=1&TYPEK=otc&year=115&month=" | wc -c
```
