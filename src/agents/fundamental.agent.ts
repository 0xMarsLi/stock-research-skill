import { structuredCall } from "../config/llm.js";
import { FundamentalSchema, type FundamentalResult } from "../schemas/agent-output.schema.js";
import type { FundamentalSnapshot } from "../services/providers/fundamentals.provider.js";

const SYSTEM = `You are a fundamental equity analyst. Assess business quality and
growth from the metrics provided. If most metrics are missing, set
dataAvailable=false, keep the thesis tentative, and lower the score.
Score 0-100 reflects fundamental attractiveness.`;

export async function runFundamentalAgent(
  snap: FundamentalSnapshot,
): Promise<FundamentalResult> {
  const present = [
    snap.revenueGrowthYoyPct,
    snap.epsGrowthYoyPct,
    snap.netMarginPct,
    snap.freeCashFlow,
  ].filter((v) => v != null).length;
  const dataAvailable = present >= 2;

  const user = `Ticker: ${snap.ticker}
Revenue growth YoY: ${fmt(snap.revenueGrowthYoyPct)}%
EPS growth YoY: ${fmt(snap.epsGrowthYoyPct)}%
Net margin: ${fmt(snap.netMarginPct)}%
Free cash flow (TTM): ${fmt(snap.freeCashFlow)}
Next earnings date: ${snap.nextEarningsDate ?? "N/A"}
${dataAvailable ? "" : "WARNING: limited fundamental data. Set dataAvailable=false and be cautious."}

Give signal, 0-100 score, a concise thesis, and the key risk. Set dataAvailable=${dataAvailable}.`;

  return structuredCall<FundamentalResult>(
    FundamentalSchema,
    SYSTEM,
    user,
    "FundamentalRead",
  );
}

function fmt(v: number | null): string {
  return v == null ? "N/A" : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
