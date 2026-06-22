---
name: stock-research
description: >-
  Research US equities and decide what is worth buying and when. Screens a tech
  stock universe into "good stocks + good entry timing", or deep-analyzes
  specific tickers on demand. Produces a Traditional-Chinese markdown report with
  formula-computed entry/stop/target (real ATR & moving averages, not
  LLM-guessed), technical/fundamental/valuation/news scoring, bull/bear cases,
  and a web-grounded market-consensus check. Use when the user asks what US stock
  to buy, whether a stock is a good entry now, to analyze specific tickers, or to
  validate a stock pick against market opinion.
---

# Stock Research

A deterministic-where-it-counts equity research pipeline (TypeScript + LangGraph
+ Gemini). Numbers come from formulas over real price data; judgment comes from
LLM agents; actionable picks are validated against web market consensus.

> Not investment advice. Public-information analysis has no proven edge — treat
> output as a disciplined, reproducible decision aid, not a profit predictor.

## When to use

- "What US stock can I buy now?" → run **screen** (`research`)
- "Analyze NVDA / should I hold AAPL?" → run **analyze** with the tickers
- "Is this a good entry point?" / "does the market agree?" → either command; the
  report includes formula entry/stop/target and a market-consensus check

## Prerequisites (one-time)

This skill runs a local Node project. From the project directory:

```bash
pnpm install
cp .env.example .env   # set GOOGLE_API_KEY (required); FINNHUB_API_KEY optional
```

Required env: `GOOGLE_API_KEY` (Gemini). Optional: `FINNHUB_API_KEY`
(fundamentals/news; without it those parts degrade gracefully), `GEMINI_MODEL`.

## How to run

**Screen the universe for buyable stocks (default top 3):**
```bash
pnpm research            # or: pnpm research --top 5
```

**Analyze specific tickers (skips screening):**
```bash
pnpm analyze NVDA AAPL TSM
```

Each command prints progress lines and finishes with:
`Done. Report: <path>`. **Read that markdown file** — it is the result. Do not
rely on the progress logs.

## Interpreting the report

- **適合現在進場（深入分析）**: top picks. Each has a 交易計畫 table
  (進場區/停損/停利 — formula-computed, trustworthy numbers), 技術指標(實算),
  各面向評分 (technical/fundamental/valuation/news 0–100), 看多/看空, and
  **市場討論（網路驗證）** showing whether market consensus agrees (✅附和 /
  🟡部分分歧 / ⚠️相左) with our call, plus source links.
- **觀察名單**: good stocks NOT analyzed deeply — either ranked just outside the
  top N (可進場) or extended above MA20 (漲多·等回檔, with a pullback target).
- Action mapping for the user: 買進/回檔買進 = healthy & worth entering (often on
  a pullback to the 進場區); 觀察/避開 = reconsider. Entry zones are usually
  BELOW current price (wait for pullback) — say so, don't imply "buy now" unless
  current price is inside the 進場區.

## Important caveats to surface

- Entry/stop/target are formula-derived from real ATR/MA — reliable. The LLM
  thesis and market-consensus text are judgment, not fact.
- This screens **tech stocks** only; it selects "good stock + good timing", NOT
  "the strongest mover" (that would be hindsight). It cannot find "the next
  NVIDIA" — by definition such a stock isn't strong in the data yet.
- It does NOT know the user's holdings/cost basis. "Can I add NVDA?" needs
  position context the tool lacks — flag concentration risk if relevant.

## Notes for cross-agent use

Pure markdown + a Node CLI; works under any SKILL.md-compatible agent (Claude
Code, Codex, Hermes, OpenClaw, …). For programmatic/structured (JSON) access or
MCP exposure, the core graph lives in `src/graphs/research.graph.ts`
(`runResearch(topN)`, `runAnalyze(tickers)`).
