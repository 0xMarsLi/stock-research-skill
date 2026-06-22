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

## Setup (first run — bootstrap before running)

This skill IS a Node project (the whole repo). Run all commands from the repo
root. **On first use, bring it up before running an analysis** — do these in order
and only what's missing:

1. **Install dependencies** if `node_modules/` is absent:
   ```bash
   pnpm install      # if pnpm is missing: npm install
   ```
2. **Create `.env`** if absent, then ensure the API key is set:
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` and set **`GEMINI_API_KEY`** (required). If the user doesn't have
     one, direct them to https://aistudio.google.com/apikey to create a free key,
     then paste it after `GEMINI_API_KEY=`.
   - `FINNHUB_API_KEY` is optional (free at https://finnhub.io). Without it,
     fundamentals/news degrade to a "data unavailable" branch but the flow still
     completes. `GEMINI_MODEL` is optional (has a built-in default).
3. **Verify** it builds before a long run (optional but recommended):
   ```bash
   pnpm typecheck
   ```

If a command fails with a missing-key error, the key step above was skipped —
guide the user through it, don't give up.

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
rely on the progress logs. The first screen run fetches data for ~100 names and
may take a few minutes; reruns the same day are cached and fast.

## Interpreting the report

- **適合現在進場（深入分析）**: top picks. Each has a 交易計畫 table
  (進場區/停損/停利 — formula-computed, trustworthy numbers), 技術指標(實算),
  **價格結構（公式計算）** (nearest support/resistance, 20d range, MA120,
  consolidation/near-breakout — what a chart reader sees), 各面向評分
  (technical/fundamental/valuation/news 0–100), 看多/看空, and
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
