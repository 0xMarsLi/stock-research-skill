# Analysis guide — how to judge each candidate

The `screen.ts` / `analyze.ts` scripts give you **formula-computed numbers** per
ticker (RS Rating, Minervini 8/8, CANSLIM, trade plan, indicators, price
structure). Your job (the host agent) is the **judgment** the scripts can't do.
Be specific, cite the numbers given, and never invent price levels — the trade
plan numbers are authoritative.

For each candidate, form a view on these lenses, then a single verdict.

## Technical (trend & momentum)
- Use the provided MA stack (20/50/120/150/200), RSI, ATR, RS Rating, price
  structure. A clean Stage-2 uptrend = price above a rising MA stack, RS high.
- Entry strategy is already derived: `immediate` (at/below MA20), `pullback`
  (extended above MA20 — wait), `breakout` (coiled below resistance).
- Flag overheated: RSI very high, price far above MA20, near 52-week high with
  no consolidation.

## Fundamental (business quality & growth)
- Use CANSLIM fields (quarterly EPS YoY, sales YoY) + net margin if present.
- Strong = accelerating earnings, healthy margins. Weak = decelerating/negative.
- ⚠️ Free data is shallow: no ROE, no quarterly acceleration history. Say so;
  don't pretend to a depth you don't have.

## Valuation
- Use forward PE / PS if present. Judge "cheap / fair / expensive" relative to
  growth. High-growth leaders carry a premium — note when it's *excessive*.
- This screen finds already-strong names, so valuation is often stretched.

## News / catalysts
- If you have web search: look for recent earnings, guidance, analyst actions,
  product/regulatory news. Otherwise state "no news checked".

## Bull / bear (force the debate)
- Bull: 2–4 concrete reasons grounded in the data above (not platitudes).
- Bear: 2–4 concrete risks. Be a genuine skeptic — valuation, competition,
  concentration, cyclicality, execution.

## Aggregate verdict
- Decide: **buy / buy_on_pullback / watch / avoid**.
- If entry strategy is `pullback` or price is far above MA20, prefer
  buy_on_pullback over buy (don't tell the user to chase).
- Position size should respect the user's risk; this tool doesn't know their
  holdings — flag concentration if the user already owns similar names.

## Market validation (do this if you can search the web)
For buy / buy_on_pullback names, search current analyst consensus + recent news.
Then compare to **our** call and label:
- ✅ agree — market consensus aligns with us
- 🟡 mixed — partial disagreement (e.g. bullish but valuation-worried)
- ⚠️ disagree — market sees it differently than we do
Critically, check **two things this screen is blind to**:
1. **Price vs analyst target** — if price already exceeds the average target,
   upside is limited; say so plainly.
2. **Insider selling** — heavy insider selling at highs is a real warning.

## Mandatory honesty (surface these to the user)
- Trade-plan numbers (entry/stop/target) are formula-derived — reliable. Your
  thesis and the market read are judgment, not fact.
- **This screen finds ALREADY-STRONG stocks by design** (Minervini/CANSLIM/RS
  require demonstrated strength). Picks often sit above analyst targets and near
  overheated. Present them as a *strong-stock candidate pool*, not "buy now" —
  honor the 進場區 and "wait for pullback" labels.
- Not investment advice. No backtest exists; the universe is a survivorship-biased
  S&P 500 snapshot. Methodology is named/checkable, not proven.
