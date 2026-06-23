# stock-research

> Equity research assistant: surface **good stocks**, judge **entry timing**, then
> **validate** each call against online market consensus.
> Built with TypeScript + LangGraph.js. Reports are written in Traditional Chinese.

With hundreds of stocks every day, the question is never "which is strongest right
now" (that's hindsight) — it's **"which are good stocks worth holding, and is now a
good time to enter."** This tool turns that into a repeatable, auditable pipeline:
numbers come from formulas (not LLM guesses), judgment comes from LLMs, and the
final pick is checked against what the market is actually saying.

> ⚠️ **Not investment advice.** Evidence shows pure LLM + public information has no
> proven, persistent edge. Treat this as a disciplined, reproducible **decision aid
> and research journal**, not a profit predictor.

---

## How it works (core pipeline)

Two entry points share one analysis pipeline:

```
                         ┌─────────────────┐
   pnpm research ───────▶│  Market regime   │  SPY/QQQ trend, VIX, yields
   (screen the universe) │  market_regime   │  → risk_on / risk_off
                         └────────┬────────┘
                                  │ risk_off → emit "no trade" and stop
                                  ▼
                         ┌─────────────────────────────────────┐
                         │  Screen (published methodology, formula)│
                         │                                       │
                         │  • RS Rating — cross-sectional        │
                         │    weighted-momentum percentile       │
                         │  • Minervini Trend Template (8 rules)  │
                         │    MA stack, 52w high/low, RS ≥ 70     │
                         │  • CANSLIM hard filter                 │
                         │    quarterly EPS ≥ 20%, sales ≥ 15%    │
                         │  → pass all → rank by RS, top N        │
                         │    near-pass / extended → watchlist    │
                         └────────┬────────────────────────────┘
   pnpm analyze NVDA ──────────── ┤ (specific tickers: skip screen, enter here)
   (analyze given tickers)        ▼
                         ┌─────────────────────────────────────┐
                         │  Deep analysis (top N enterNow only)  │
                         │                                       │
                         │  1. multi-lens agents (LLM):          │
                         │     technical / fundamental /         │
                         │     valuation / news                  │
                         │  2. price structure (formula):        │
                         │     support/resistance, range,        │
                         │     MA120, consolidation/breakout     │
                         │  3. trade plan (formula): entry/stop/ │
                         │     target from real ATR & MAs (R:R=2)│
                         │  4. bull / bear debate agents         │
                         │  5. risk pre-check + aggregator       │
                         │  6. market validation: search the web,│
                         │     does consensus agree with us?     │
                         └────────┬────────────────────────────┘
                                  ▼
                    Traditional-Chinese Markdown report
            research/recommendations/<date>.md     (screen)
            research/analysis/<date>_<tickers>.md   (analyze)
```

**Three design principles** (and what sets it apart from "LLM eyeballs a chart"
tools):

1. **Numbers from formulas, judgment from LLMs** — entry zone / stop / target are
   computed in `nodes/trade-plan.node.ts` from **real ATR and moving averages**
   (stop = entry − 2×ATR, reward:risk = 2). The LLM **never invents prices**, which
   eliminates numeric hallucination. The "real indicators" table is computed too.
2. **Published methodology, not self-tuned knobs** — the screen uses named,
   documented, community-vetted rules (Minervini Trend Template + O'Neil CANSLIM +
   cross-sectional RS Rating), with their original thresholds. The report shows
   "passes X/8 + which conditions failed" so it's checkable, not a black box.
3. **Market validation** — for every actionable pick, search the web for consensus
   and label it **agree / mixed / disagree**, covering the "are we wrong?" blind spot.

---

## Setup

```bash
pnpm install
cp .env.example .env   # configure keys — see "Data sources & configuration" below
```

## Usage

```bash
pnpm research            # screen the universe, deep-analyze top 3 (default)
pnpm research --top 5    # top 5 (or set RESEARCH_TOP_N)
pnpm analyze NVDA AAPL   # skip screening, analyze the given tickers
pnpm test                # unit tests (38)
pnpm typecheck
```

Report paths: screen → `research/recommendations/<US-Eastern date>.md`;
analyze → `research/analysis/<US-Eastern date>_<tickers>.md`.

## What a report looks like (excerpt — reports are in Traditional Chinese)

```markdown
## ✅ 適合現在進場（深入分析）

| 標的 | 建議動作 | 信心 | 進場區 | 停損 | 停利 | 建議倉位 |
|------|---------|-----|--------|------|------|---------|
| AMD | 買進 | 70 | 523.24–556.66 | 473.12 | 673.62 | 3% |

### AMD — 買進（信心 70）

#### 選股依據（Minervini 趨勢模板 + CANSLIM）
趨勢模板 8/8 ｜ RS Rating 99 ｜ CANSLIM ✅ 通過
CANSLIM：EPS YoY 123.4% (需≥20%)、營收 YoY 35.0% (需≥15%)
> 方法：依 Minervini 趨勢模板（原始8條）+ O'Neil CANSLIM，RS 為全 universe 橫截面百分位。非自訂參數。

#### 交易計畫（公式計算）          #### 技術指標（實算）
| 進場區間 | 523.24 – 556.66 |       | 現價 | 523.24 |
| 停損    | 473.12 |              | MA50 | … |
| 停利    | 673.62 |              | ATR  | … |
| 風報比  | 2 |

#### 市場討論（網路驗證）
- 市場觀點：**偏多**　｜　vs 我們的「買進」：**✅ 附和我們**（含來源連結）

## 👀 觀察名單（體質佳，未深度分析）
### 觀察（漲多·等回檔 / 接近通過）
| 標的 | 模板 | RS | CANSLIM | 高於MA20 | 回檔參考價(MA20) |
| MU  | 8/8 | 100 | ✓ | +17.4% | 965.6 |
```

## Project structure

```
src/
  graphs/research.graph.ts   LangGraph main flow (screen / analyze dual mode)
  agents/                    LLM agents: technical, fundamental, valuation,
                             news, bull-case, bear-case, risk-precheck,
                             research-aggregator, market-sentiment
  nodes/                     deterministic: screener (RS + CANSLIM),
                             minervini (8-rule trend template),
                             trade-plan (formula), markdown-writer
  services/
    indicators.service.ts    SMA / RSI / MACD / ATR / relative strength /
                             weighted-momentum + percentile (RS Rating) /
                             support-resistance / range / pivots
    providers/               data-source abstraction (swap source = swap impl):
                             prices, fundamentals/news, market sentiment;
                             includes API rate limiter and same-day cache
  schemas/                   zod (explicit agent-output fields for safe parsing)
  config/universe.ts         vendored S&P 500 list (all sectors); SPY benchmark
  app/cli.ts                 CLI entry point
research/                    generated reports
SKILL.md                     instructions for use as a cross-agent skill (agentskills.io)
```

## Known limitations

- **Finds already-strong stocks, by design.** Minervini / CANSLIM / RS all require
  *demonstrated* strength (RS ≥ 70, near 52-week high, full MA stack), so the screen
  surfaces stocks that have **already run** — not undervalued or not-yet-risen ones.
  In practice this means picks often sit *above* analyst price targets; momentum at
  its strongest is also closest to overheated. Use the output as a *strong-stock
  candidate pool*, not a "buy now" trigger — respect the 進場區 and the watchlist's
  "wait for pullback" labels.
- **Blind to valuation gap & insider activity.** The screen doesn't compare price to
  analyst targets or check insider selling — both are real signals it can miss.
- Free-tier fundamentals are shallow (no ROIC / margin trend / F-Score; CANSLIM is
  partial — quarterly acceleration and ROE are unverified, and the report says so).
- **No backtest**: can't prove it beats the market. Full flow can't be backtested
  cleanly (fundamentals lack point-in-time history; web search leaks future info);
  only the pure formula path could be tested honestly.
- Universe is a **vendored S&P 500 snapshot = survivorship bias** (today's members).
  Methodology is *named and checkable*, but that doesn't make it *proven*.

## Roadmap

Three decoupled flows per the PRD; **Research** is done:

- [x] Research flow (screen + analyze + market validation)
- [ ] Trade Journal (record buys/sells, average cost + lots)
- [ ] Position Review (daily holdings review with cost/size/trailing stop)
- [ ] Backtest (honest technical-only), scheduling & notifications

## Use as an agent skill

The core is a standalone CLI, but the repo ships `SKILL.md` (following the
agentskills.io open standard), so it can be loaded as a skill by compatible agents
(Claude Code, Codex, Hermes, OpenClaw, …) — the agent runs the CLI and interprets
the report. For programmatic/structured integration, call `runResearch(topN)` /
`runAnalyze(tickers)` in `graphs/research.graph.ts`.

---

## Data sources & configuration

All data goes through provider interfaces (`services/providers/`); swapping a
source only changes its implementation. Copy `.env.example` to `.env` and set:

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | LLM inference and market-sentiment search (`GOOGLE_API_KEY` also accepted) |
| `GEMINI_MODEL` |  | LLM model (falls back to a built-in default) |
| `FINNHUB_API_KEY` |  | Fundamentals/news; if unset, those parts run a "data unavailable" branch and the flow still completes |
| `SENTIMENT_PROVIDER` |  | Market-sentiment search backend (built-in default needs no extra key) |

Services used:

- **LLM / market-sentiment search**: Google [Gemini](https://aistudio.google.com/apikey)
  (built-in Google Search grounding — market validation needs no extra key).
- **Prices / OHLCV**: `yahoo-finance2` (no key).
- **Fundamentals / news**: [Finnhub](https://finnhub.io) free tier (rate-limited;
  a rate limiter and same-day cache are built in).
```
