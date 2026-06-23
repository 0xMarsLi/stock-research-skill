---
name: stock-research
description: >-
  Screen US equities (S&P 500) for strong-trend growth candidates and analyze
  specific tickers, using published methodologies (Minervini Trend Template +
  O'Neil CANSLIM + cross-sectional RS Rating). Deterministic scripts output JSON
  with formula-computed entry/stop/target, indicators, and pass/fail per rule;
  YOU (the host agent) do the judgment — technical/fundamental/valuation/news,
  bull-bear, a verdict, and web-search market validation — then write a report.
  Use when the user asks what US stock to buy, whether a stock is a good entry,
  to screen for candidates, or to analyze/validate specific tickers.
---

# Stock Research

This is a **skill**: the bundled scripts do the *deterministic* part (fetch
prices/fundamentals, run Minervini/CANSLIM/RS formulas, compute entry/stop/target)
and print JSON. **You, the host agent, do the reasoning** — judge each candidate,
debate bull/bear, verify against web search, and write the report. No LLM or LLM
key is bundled; the brain is yours.

> Not investment advice. The screen finds **already-strong** stocks by design —
> treat output as a strong-stock candidate pool, not a "buy now" trigger.

## When to use
- "What US stock can I buy now?" → run `scripts/screen.ts`
- "Analyze NVDA / should I hold AAPL?" → run `scripts/analyze.ts NVDA AAPL`
- "Is this a good entry / does the market agree?" → either, then do market validation

## Setup (first run — bootstrap before running)
This skill is a Node project. From the repo root, do what's missing:
1. Install deps if `node_modules/` absent: `pnpm install` (or `npm install`).
2. (Optional) `cp .env.example .env` and set **`FINNHUB_API_KEY`** (free at
   https://finnhub.io) for CANSLIM fundamentals. Without it, price-only screening
   still runs; CANSLIM is marked unavailable. **No LLM key is needed.**

## How to run
**Screen the S&P 500 (default top 5):**
```bash
pnpm exec tsx scripts/screen.ts --top 5
```
**Analyze specific tickers:**
```bash
pnpm exec tsx scripts/analyze.ts NVDA AAPL TSM
```
Each prints **JSON to stdout**. First screen run fetches ~360 names (a few
minutes); reruns the same day are cached and fast. Parse the JSON — that's the
input to your analysis.

## What the JSON gives you (formula, trustworthy)
Per candidate: `rsRating` (0–100 cross-sectional), `trendTemplate` (8 conditions
with pass/fail), `canslimPass` + `canslimNote`, `tradePlan` (entryLow/High, stop,
target, riskReward — real ATR/MA), `indicators` (MAs, 52w high/low, RSI, ATR),
`priceStructure` (support/resistance, range, consolidation). `enterNow` = passed
all + enterable; `watchlist` = qualified-but-extended or near-pass.

## Your job (the analysis the scripts can't do)
1. **Read JSON.** Trust its numbers; never invent price levels.
2. **Judge each `enterNow` name** across technical / fundamental / valuation /
   news / bull-bear → a verdict (buy / buy_on_pullback / watch / avoid).
   Follow `references/analysis-guide.md`.
3. **Market validation (use your web search):** for buy/buy_on_pullback names,
   check analyst consensus + recent news; label agree / mixed / disagree. Crucially
   check the two things the screen is blind to: **price vs analyst target** and
   **insider selling**.
4. **Write the report** in Traditional Chinese per `references/report-template.md`.

## Must surface to the user (honesty)
- Trade-plan numbers are formula-derived (reliable); your thesis & market read are
  judgment, not fact.
- The screen finds **already-strong** stocks — picks often sit ABOVE analyst
  targets / near overheated. Don't imply "buy now" unless price is inside the 進場區;
  honor "wait for pullback".
- No backtest; S&P 500 list is a survivorship-biased snapshot. Methodology is
  named & checkable (Minervini/CANSLIM/RS), not proven to beat the market.

## Cross-agent use
Pure scripts + markdown, agentskills.io standard. Works in any CLI agent with
filesystem + web (Claude Code, Codex CLI, Gemini CLI). The deterministic core is
in `src/` (imported by `scripts/`); judgment is the host agent's.
