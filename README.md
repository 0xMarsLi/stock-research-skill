# stock-research-skill

> An **agent skill** for US equity research. Deterministic scripts screen the
> S&P 500 with published methodologies (Minervini Trend Template + O'Neil CANSLIM
> + cross-sectional RS Rating) and print JSON; the **host agent** (Claude Code,
> Codex CLI, Gemini CLI, …) does the judgment and web-search validation, then
> writes the report. **No bundled LLM, no LLM key.**

The split is the whole point:
- **Scripts = the deterministic part** — fetch prices/fundamentals, run the
  formulas, compute entry/stop/target. Same input → same numbers, every time.
- **Host agent = the brain** — reads the JSON, judges each name
  (technical/fundamental/valuation/news, bull vs bear), searches the web to
  validate, and writes the report in Traditional Chinese.

> ⚠️ **Not investment advice.** The screen finds **already-strong** stocks by
> design — use the output as a strong-stock candidate pool, not a "buy now"
> trigger. No backtest; methodology is named and checkable, not proven.

## Use as a skill (intended)
Load the repo as a skill in any CLI agent with filesystem + web. The agent reads
`SKILL.md`, runs the scripts, and follows `references/` to analyze and report.
See `SKILL.md` for the playbook.

## Run the scripts directly
```bash
pnpm install                              # deps: yahoo-finance2, zod (no LLM libs)
cp .env.example .env                      # optional: set FINNHUB_API_KEY (CANSLIM)
pnpm exec tsx scripts/screen.ts --top 5   # screen S&P 500 → JSON
pnpm exec tsx scripts/analyze.ts NVDA AAPL  # analyze tickers → JSON
pnpm test                                 # unit tests (formula core)
pnpm typecheck
```
Output is **JSON to stdout** — per candidate: RS Rating, Minervini 8/8 (with each
condition's pass/fail), CANSLIM, formula trade plan (entry/stop/target from real
ATR & MAs), indicators, price structure. `enterNow` (passed all + enterable) and
`watchlist` (qualified-but-extended / near-pass).

## What the screen does (published methodology)
- **RS Rating** — cross-sectional percentile of weighted momentum (O'Neil/IBD).
- **Minervini Trend Template** — verbatim 8 conditions (MA stack, 52w high/low,
  rising MA200, RS ≥ 70).
- **CANSLIM hard filter** — quarterly EPS ≥ 20%, sales ≥ 15% (free-tier partial;
  ROE / quarterly-acceleration unverified — noted, not silently dropped).
- Pre-fetch price gate so only template-eligible names hit Finnhub (stays within
  free-tier limits); rate limiter + same-day cache.

## Project structure
```
SKILL.md                     skill playbook (run scripts → judge → report)
references/                   analysis-guide.md + report-template.md (host agent's rules)
scripts/
  screen.ts / analyze.ts     thin CLIs → JSON (no LLM)
  lib.ts                      orchestrates the deterministic core
src/
  nodes/screener.node.ts      RS + Minervini + CANSLIM filter
  nodes/minervini.ts          8-condition trend template
  nodes/trade-plan.node.ts    entry/stop/target from ATR & MAs
  services/indicators.service.ts  SMA/RSI/MACD/ATR/RS/momentum/support-resistance
  services/providers/         prices (yahoo) + fundamentals (finnhub); cache + limiter
  agents/technical-features.ts  pure feature computation (legacy name; no LLM)
  config/universe.ts          vendored S&P 500 (all sectors); SPY benchmark
```

## Known limitations
- **Finds already-strong stocks, by design** — picks often sit above analyst
  targets and near overheated. Use as a candidate pool; respect "wait for pullback".
- **Scripts are blind to valuation gap vs targets & insider selling** — the host
  agent must check these via web search (see `references/analysis-guide.md`).
- Judgment quality depends on the **host agent** (different agents judge
  differently) — the trade-off for being a true, key-free, cross-tool skill.
- Free-tier fundamentals shallow (no ROE / quarterly acceleration); CANSLIM partial.
- No backtest; universe is a survivorship-biased S&P 500 snapshot.

## Roadmap
- [x] Deterministic screen (Minervini + CANSLIM + RS) as scripts → JSON
- [x] True skill form: host agent does judgment + web validation
- [ ] Backtest (honest, formula-only path)
- [ ] Valuation-gap & insider-selling signals in the JSON
- [ ] Trade Journal / Position Review flows (cost basis, trailing stop)

## Configuration
Copy `.env.example` to `.env`. Only key: `FINNHUB_API_KEY` (optional — fundamentals
for CANSLIM; without it, price-only screening still runs). Prices via
`yahoo-finance2` (no key). **No LLM key** — reasoning and web search are the host
agent's.
