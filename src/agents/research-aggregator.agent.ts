import { structuredCall } from "../config/llm.js";
import { AggregatorVerdictSchema, type AggregatorVerdict } from "../schemas/recommendation.schema.js";
import type { AgentResults, RiskPrecheckResult } from "../schemas/agent-output.schema.js";
import type { MarketRegimeResult } from "../schemas/market.schema.js";
import type { TradePlan } from "../schemas/trade-plan.schema.js";
import { summarize } from "./bull-case.agent.js";

const SYSTEM = `You are the lead research analyst. Synthesize all agent reads into a
single decision. You DECIDE and SUMMARIZE — you do NOT produce price numbers
(entry/stop/target are already computed from real indicators and given to you).
- recommendation ∈ buy | buy_on_pullback | watch | avoid | no_trade
- if risk pre-check disallows or regime is risk_off, prefer watch/avoid/no_trade
- if the technical entry strategy is "pullback", prefer buy_on_pullback over buy
- suggestedPositionPct must not exceed the risk pre-check's maxPositionPct
- thesis is one tight paragraph consistent with the given trade plan; include the
  strongest bull and bear points and the conditions that invalidate the thesis.`;

export async function runResearchAggregator(
  ticker: string,
  prior: AgentResults,
  risk: RiskPrecheckResult,
  regime: MarketRegimeResult,
  plan: TradePlan,
): Promise<AggregatorVerdict> {
  const user = `Ticker: ${ticker}
Market regime: ${regime.marketRegime} (allowNewPositions=${regime.allowNewPositions})
Risk pre-check: allowed=${risk.allowed}, maxPositionPct=${risk.maxPositionPct} — ${risk.reason}
Trade plan (computed from real indicators — use these, do not change them):
  entry strategy: ${plan.entryStrategy}
  entry zone: ${plan.entryLow} – ${plan.entryHigh}
  stop loss: ${plan.stopLoss}, take profit: ${plan.takeProfit} (R:R ${plan.riskReward})
  ref close ${plan.refClose}, MA20 ${plan.refMa20 ?? "N/A"}, ATR ${plan.refAtr ?? "N/A"}
${summarize(prior)}
Bull case:
${(prior.bull?.bullCase ?? []).map((b) => `- ${b}`).join("\n") || "- (none)"}
Bear case:
${(prior.bear?.bearCase ?? []).map((b) => `- ${b}`).join("\n") || "- (none)"}

Produce the verdict: recommendation, confidence, suggestedPositionPct, thesis,
bullCase, bearCase, invalidConditions.`;
  return structuredCall<AggregatorVerdict>(
    AggregatorVerdictSchema,
    SYSTEM,
    user,
    "AggregatorVerdict",
  );
}
