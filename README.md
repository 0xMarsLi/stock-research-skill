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
                         │  Two-stage screen (pure formula)      │
                         │                                       │
                         │  Stage 1 — good stock?                │
                         │    trend-health gate (above MA50,     │
                         │      rising MA200, not lagging market)│
                         │    + quality score (margin/growth/val)│
                         │                                       │
                         │  Stage 2 — good entry? (distance MA20)│
                         │    ├─ near support → enterNow (top N)  │
                         │    └─ extended     → watchlist         │
                         └────────┬────────────────────────────┘
   pnpm analyze NVDA ──────────── ┤ (specific tickers: skip screen, enter here)
   (analyze given tickers)        ▼
                         ┌─────────────────────────────────────┐
                         │  Deep analysis (top N enterNow only)  │
                         │                                       │
                         │  1. multi-lens agents (LLM):          │
                         │     technical / fundamental /         │
                         │     valuation / news                  │
                         │  2. trade plan (formula): entry/stop/ │
                         │     target from real ATR & MAs (R:R=2)│
                         │  3. bull / bear debate agents         │
                         │  4. risk pre-check + aggregator       │
                         │  5. market validation: search the web,│
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
2. **Good stock first, timing second** — screening is not "pick the strongest";
   it's "healthy + enterable now". Good-but-extended names aren't dropped — they go
   to a **watchlist with a pullback reference price**.
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
| ANET | 回檔買進 | 80  | 157–165 | 145.34 | 192.62 | 5% |

### ANET — 回檔買進（信心 80）

#### 交易計畫（公式計算）          #### 技術指標（實算）
| 進場區間 | 157.16 – 165.04 |       | 現價 | 169.67 |
| 停損    | 145.34 |              | MA20 | 161.10 |
| 停利    | 192.62 |              | MA50 | 158.53 |
| 風報比  | 2 |                   | ATR  |   7.88 |

#### 市場討論（網路驗證）
- 市場觀點：**偏多**　｜　vs 我們的「回檔買進」：**✅ 附和我們**
  華爾街給予「強力買進」，目標價持續調升；風險為客戶集中與高估值。
  來源：marketbeat.com、investing.com …

## 👀 觀察名單（體質佳，未深度分析）
### 漲多·等回檔
| 標的 | 品質分 | 高於MA20 | 回檔參考價(MA20) |
| MU  | 100   | +17.4%  | 965.6 |
```

## Project structure

```
src/
  graphs/research.graph.ts   LangGraph main flow (screen / analyze dual mode)
  agents/                    LLM agents: technical, fundamental, valuation,
                             news, bull-case, bear-case, risk-precheck,
                             research-aggregator, market-sentiment
  nodes/                     deterministic: screener (two-stage),
                             trade-plan (formula), markdown-writer
  services/
    indicators.service.ts    SMA / RSI / MACD / ATR / relative strength
    providers/               data-source abstraction (swap source = swap impl):
                             prices, fundamentals/news, market sentiment;
                             includes API rate limiter and same-day cache
  schemas/                   zod (explicit agent-output fields for safe parsing)
  app/cli.ts                 CLI entry point
research/                    generated reports
SKILL.md                     instructions for use as a cross-agent skill (agentskills.io)
```

## Known limitations

- Free-tier fundamentals are shallow (no ROIC / margin trend / F-Score), so the
  quality factor is a lightweight proxy.
- **No backtest**: the full flow can't be backtested cleanly (fundamentals lack
  point-in-time history; web search leaks future info). Only the pure
  technical/formula path could be backtested honestly.
- Tech stocks only; "good stock + good timing" ≠ "finding the next breakout"
  (which inherently can't be screened from hindsight data).

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
| `GOOGLE_API_KEY` | ✅ | LLM inference and market-sentiment search |
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
