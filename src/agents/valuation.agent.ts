import { structuredCall } from "../config/llm.js";
import { ValuationSchema, type ValuationResult } from "../schemas/agent-output.schema.js";
import type { ValuationSnapshot } from "../services/providers/fundamentals.provider.js";

const SYSTEM = `You are a valuation analyst. Judge whether the stock is cheap, fair,
fair_to_expensive, or expensive from the multiples provided, considering that
high-quality growth names often warrant a premium. If multiples are missing, set
dataAvailable=false and lower the score. Score 0-100: higher = more attractive
valuation (cheaper relative to quality).`;

export async function runValuationAgent(
  snap: ValuationSnapshot,
): Promise<ValuationResult> {
  const present = [snap.peTtm, snap.forwardPe, snap.ps, snap.evToEbitda].filter(
    (v) => v != null,
  ).length;
  const dataAvailable = present >= 1;

  const user = `Ticker: ${snap.ticker}
PE (TTM): ${fmt(snap.peTtm)}
Forward PE: ${fmt(snap.forwardPe)}
P/S (TTM): ${fmt(snap.ps)}
EV/EBITDA: ${fmt(snap.evToEbitda)}
${dataAvailable ? "" : "WARNING: no valuation multiples available. Set dataAvailable=false."}

Give a valuationView, 0-100 score, and the reason. Set dataAvailable=${dataAvailable}.`;

  return structuredCall<ValuationResult>(
    ValuationSchema,
    SYSTEM,
    user,
    "ValuationRead",
  );
}

function fmt(v: number | null): string {
  return v == null ? "N/A" : v.toFixed(2);
}
