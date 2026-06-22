import { structuredCall } from "../config/llm.js";
import { TechnicalSchema, type TechnicalResult } from "../schemas/agent-output.schema.js";
import type { TechnicalFeatures } from "./technical-features.js";

const SYSTEM = `You are a disciplined technical analyst for US equities.
Judge trend and momentum from the provided indicators only, then CHOOSE an entry
strategy — do NOT output any price numbers (prices are computed separately):
- immediate: strong trend and price near support; reasonable to buy now
- pullback: trend intact but extended/overbought; wait for a pullback toward MA20
- breakout: consolidating below resistance; buy on a breakout above current price
- avoid: technicals do not support an entry
Reference the indicators in your rationale, but never invent specific price levels.
Score 0-100 reflects technical attractiveness for a swing-trade entry.`;

export async function runTechnicalAgent(
  features: TechnicalFeatures,
): Promise<TechnicalResult> {
  const dataAvailable = features.bars >= 50 && features.lastClose != null;
  const user = `Ticker: ${features.ticker}
Bars available: ${features.bars}
Last close: ${fmt(features.lastClose)}
MA20: ${fmt(features.ma20)}
MA50: ${fmt(features.ma50)}
MA200: ${fmt(features.ma200)}
RSI(14): ${fmt(features.rsi14)}
MACD histogram: ${fmt(features.macdHistogram)}
ATR(14): ${fmt(features.atr14)} (${fmt(features.atrPctOfPrice)}% of price)
20d relative strength vs QQQ: ${fmt(features.relStrength20dVsBenchmarkPct)}%
${dataAvailable ? "" : "WARNING: limited data (<50 bars). Treat as low-confidence."}

Produce a technical read: signal, 0-100 score, trend description, an entry
STRATEGY (immediate/pullback/breakout/avoid) with rationale, and the condition
that invalidates the setup. Set dataAvailable=${dataAvailable}.`;

  return structuredCall<TechnicalResult>(
    TechnicalSchema,
    SYSTEM,
    user,
    "TechnicalRead",
  );
}

function fmt(v: number | null): string {
  return v == null ? "N/A" : v.toFixed(2);
}
