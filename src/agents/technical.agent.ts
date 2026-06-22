import { structuredCall } from "../config/llm.js";
import { TechnicalSchema, type TechnicalResult } from "../schemas/agent-output.schema.js";
import type { TechnicalFeatures } from "./technical-features.js";

const SYSTEM = `You are a disciplined technical analyst for US equities.
Judge trend, momentum AND horizontal price structure (support/resistance, range)
from the provided indicators only, then CHOOSE an entry strategy. Do NOT output
any price numbers — prices are computed separately; reference the provided levels
but never invent new ones.
- immediate: strong trend and price at/near support; reasonable to buy now
- pullback: trend intact but extended above MA20/support; wait for a pullback
- breakout: consolidating just below resistance; buy on a breakout above it
- avoid: technicals do not support an entry (e.g. below falling MAs, far from support)
Use the structure signals: if price is near resistance and consolidating, it's a
breakout-or-rejection decision point (lean breakout only if momentum confirms);
if it just bounced off support, lean immediate/pullback; if far below support /
under falling MAs, lean avoid.
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
MA120: ${fmt(features.ma120)}
MA200: ${fmt(features.ma200)}
RSI(14): ${fmt(features.rsi14)}
MACD histogram: ${fmt(features.macdHistogram)}
ATR(14): ${fmt(features.atr14)} (${fmt(features.atrPctOfPrice)}% of price)
20d relative strength vs QQQ: ${fmt(features.relStrength20dVsBenchmarkPct)}%

Price structure:
Nearest resistance above: ${fmt(features.resistance)} (${fmt(features.distToResistancePct)}% above)
Nearest support below: ${fmt(features.support)} (${fmt(features.distToSupportPct)}% below)
Recent 20d range: ${fmt(features.rangeLow)} – ${fmt(features.rangeHigh)}, price at ${fmt(features.pctInRange)}% of range
Consolidating (tight box): ${features.isConsolidating ? "yes" : "no"}
Near resistance (within ~1 ATR): ${features.nearResistance ? "yes" : "no"}
${dataAvailable ? "" : "WARNING: limited data (<50 bars). Treat as low-confidence."}

Produce a technical read: signal, 0-100 score, trend description, an entry
STRATEGY (immediate/pullback/breakout/avoid) with rationale, a priceStructureNote
(how price sits vs the support/resistance above and whether it's near a
breakout/rejection — reference the given levels, don't invent), and the condition
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
