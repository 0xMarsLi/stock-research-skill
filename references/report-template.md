# Report template (Traditional Chinese output)

Write the final report in **Traditional Chinese (Taiwan)**. Use the script's
numbers verbatim for the trade plan / indicators / template — don't recompute or
invent. One section per candidate, plus a watchlist.

```markdown
# 研究推薦報告 — <date>

## 市場觀點
- （若有跑 market regime 或自行判斷）大盤趨勢、風險偏好一句話

## ✅ 適合現在進場（深入分析）

| 標的 | 建議動作 | 進場區 | 停損 | 停利 | 風報比 |
|---|---|---|---|---|---|
| AMD | 買進/回檔買進 | 523–557 | 473 | 674 | 2 |

### AMD — <建議動作>

#### 選股依據（Minervini 趨勢模板 + CANSLIM）
趨勢模板 8/8 ｜ RS Rating 99 ｜ CANSLIM ✅
（未過的列出哪幾條）
> 方法：Minervini 趨勢模板(原始8條) + O'Neil CANSLIM + 橫截面 RS。非自訂參數。

#### 交易計畫（公式計算，數字來自 script）
進場區 / 停損 / 停利 / 風報比（直接用 JSON 的 tradePlan）

#### 技術指標（實算） / 價格結構
現價、MA20/50/150/200、52週高低、上下方支撐壓力（用 JSON）

#### 各面向判讀（你的分析）
- 技術面：…
- 基本面：…（標明免費資料淺）
- 估值：…
- 多空：看多… / 看空…

#### 市場討論（網路驗證，若有搜尋）
- 市場觀點：偏多/分歧/偏空 ｜ vs 我們：✅附和 / 🟡部分分歧 / ⚠️相左
- 重點 + 來源連結
- ⚠️ 現價 vs 分析師目標價、內部人是否賣股（screen 看不到，務必查）

## 👀 觀察名單（體質佳，未深度分析）
| 標的 | 模板 | RS | CANSLIM | 高於MA20 | 回檔參考價 |
（直接列 JSON 的 watchlist）

## ⚠️ 重要提醒
- 進場/停損/停利為公式計算（可信）；判讀與市場為判斷，非事實。
- 本系統設計上找「已強勢」的股票，選出的常已涨過、可能超過目標價 → 別追高，
  尊重進場區與「等回檔」標示。
- 非投資建議；無回測；S&P500 為今日成分（幸存者偏差）。
```
