import { structuredCall } from "../config/llm.js";
import { RiskPrecheckSchema, type RiskPrecheckResult } from "../schemas/agent-output.schema.js";
import type { AgentResults } from "../schemas/agent-output.schema.js";
import type { MarketRegimeResult } from "../schemas/market.schema.js";
import { summarize } from "./bull-case.agent.js";

const SYSTEM = `You are a risk pre-check for a research recommendation (NOT position
risk). Decide if recommending this name is reasonable now and a max position
size % (cap at the regime's max equity exposure). Do NOT output a stop-loss price
— stops are computed separately from real volatility. If the market regime
disallows new positions, set allowed=false.`;

export async function runRiskPrecheckAgent(
  ticker: string,
  prior: AgentResults,
  regime: MarketRegimeResult,
  lastClose: number | null,
): Promise<RiskPrecheckResult> {
  const user = `Ticker: ${ticker}
Last close: ${lastClose == null ? "N/A" : lastClose.toFixed(2)}
Market regime: ${regime.marketRegime}, allowNewPositions=${regime.allowNewPositions}, maxEquityExposurePct=${regime.maxEquityExposurePct}
${summarize(prior)}

Return allowed, maxPositionPct, and the reason.`;
  return structuredCall<RiskPrecheckResult>(
    RiskPrecheckSchema,
    SYSTEM,
    user,
    "RiskPrecheck",
  );
}
