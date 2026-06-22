# Daily US Stock Agent

TypeScript + LangGraph.js 美股研究輔助系統。Markdown 為唯一事實來源（source of
truth）。依 PRD 規劃三條解耦流程（Research / Trade Journal / Position Review）；
**目前實作 Research 流程**，產出繁體中文研究報告。

> ⚠️ 本工具產出為程式化的「有紀律分析」，**非投資建議**。學術證據顯示純 LLM + 公開
> 資訊難以產生持續超額報酬；請將其定位為決策輔助與投資日誌，而非賺錢預測。

## 設計哲學（核心）

1. **數字歸公式、判斷歸 LLM**：進場區 / 停損 / 停利由 `nodes/trade-plan.node.ts`
   依**真實 ATR、均線**以公式計算（停損 = 現價 − 2×ATR，風報比 R:R = 2），LLM 只負責
   判斷與總結，不自行生成價格（避免幻覺）。
2. **兩階段篩選**（`nodes/screener.node.ts`）：先篩「好股票」（趨勢健康 + 品質：獲利/
   成長/估值），再依**進場時機**分類。不是「選現在最強的」（結果論），而是「好股票 +
   適合進場」。
3. **市場驗證層**：對判定可進場的股票，用 Gemini 內建 Google Search 搜網路評論，
   比對市場是否認同我們的判斷（附和 / 部分分歧 / 相左）。

## Setup

```bash
pnpm install
cp .env.example .env   # 填 GOOGLE_API_KEY（必填）、FINNHUB_API_KEY（選填）
```

| 環境變數 | 必填 | 用途 |
|---|---|---|
| `GOOGLE_API_KEY` | ✅ | Gemini（[aistudio.google.com/apikey](https://aistudio.google.com/apikey)）|
| `GEMINI_MODEL` | | 預設 `gemini-2.5-flash`（本專案實測用 `gemini-3.1-flash-lite`）|
| `FINNHUB_API_KEY` | | 基本面/新聞；無則該部分走「資料不足」分支 |
| `SENTIMENT_PROVIDER` | | 市場情緒搜尋後端，預設 `gemini`（grounding，免額外金鑰）|

價格資料用 `yahoo-finance2`（免金鑰）。

## 指令

```bash
pnpm research            # 篩選股票池 → 報告（預設深入分析 top 3）
pnpm research --top 5    # 深入分析前 5 名（亦可用環境變數 RESEARCH_TOP_N）
pnpm analyze NVDA AAPL   # 跳過篩選，只分析指定股票
pnpm test                # 單元測試
pnpm typecheck
```

- 篩選報告 → `research/recommendations/<美東日期>.md`
- 指定分析報告 → `research/analysis/<美東日期>_<tickers>.md`

## Research 流程

```
market_regime ──(risk_off)──▶ no_trade ──▶ report
      │
  (risk_on / analyze 模式)
      ▼
篩選（兩階段）┌─ enterNow (top N) ─▶ 深入分析（technical/fundamental/valuation/
      │      │                        news/bull/bear → 交易計畫公式 → risk → 整合
      │      │                        → 市場驗證）─▶ report 區塊一「適合現在進場」
      │      └─ watchlist ──────────▶ report 區塊二「觀察名單」（輕量列出，未深度分析）
```

報告含：候選總覽、交易計畫（公式）、技術指標（實算）、各面向評分、多空、失效條件、
**市場討論（網路驗證）**；觀察名單分「可進場·排名外」與「漲多·等回檔」。

## 架構

- `agents/` — LLM agents（technical / fundamental / valuation / news / bull / bear /
  risk-precheck / research-aggregator / market-sentiment）
- `nodes/` — deterministic（screener 兩階段、trade-plan 公式、markdown-writer）
- `graphs/research.graph.ts` — LangGraph 主流程（screen / analyze 雙模式）
- `services/providers/` — 資料來源抽象（market-data / fundamentals / news / sentiment），
  換源只改實作；含 Finnhub 限速器與當日快取
- `schemas/` — zod（agent 輸出欄位明確，因 Gemini 不接受開放 record / tuple）

## 已知限制

- 免費 Finnhub 基本面資料淺（無 ROIC / 毛利趨勢 / F-Score），品質因子為輕量代理。
- 市場情緒來源連結為 Gemini grounding redirect（標題可辨識來源網站）。
- 無回測（最該補）：因基本面拿不到歷史、LLM 搜尋含未來資訊，僅「純技術面/公式」可乾淨回測。

## 尚未實作

Trade Journal 流程、Position Review 流程（帶成本/部位/移動停損）、回測、付費資料源、
排程自動化與推播、多市場。
