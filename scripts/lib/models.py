from dataclasses import dataclass, asdict


@dataclass
class CalendarEvent:
    """台股法說會／財報事件模型。

    Attributes:
        id: 股票代號（例如 "2330"）
        name: 公司名稱（例如 "台積電"）
        market: 市場類別（"上市" 或 "上櫃"）
        industry: 產業別（例如 "半導體"）
        date: 事件日期（YYYY-MM-DD 格式）
        type: 事件類型（"法說會" 或 "財報"）
        market_cap: 市值（億元為單位，float）
        cap_is_estimate: 市值是否為估算值（True 表示用成交值替代，False 表示用股數計算）
    """

    id: str
    name: str
    market: str
    industry: str
    date: str
    type: str
    market_cap: float
    cap_is_estimate: bool

    def to_dict(self) -> dict:
        """將 CalendarEvent 轉換為字典形式。

        Returns:
            包含所有欄位的字典。
        """
        return asdict(self)
