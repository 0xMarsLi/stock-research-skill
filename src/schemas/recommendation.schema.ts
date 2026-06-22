import { z } from "zod";

/**
 * Aggregator VERDICT — the LLM's judgment only. It contains NO price numbers;
 * all prices come from the deterministic trade-plan node. This keeps the LLM to
 * "summarize and decide", never "invent numbers".
 */
export const AggregatorVerdictSchema = z.object({
  ticker: z.string(),
  recommendation: z.enum([
    "buy",
    "buy_on_pullback",
    "watch",
    "avoid",
    "no_trade",
  ]),
  confidence: z.number().min(0).max(100),
  suggestedPositionPct: z.number().min(0).max(100),
  thesis: z.string(),
  bullCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  invalidConditions: z.array(z.string()),
});
export type AggregatorVerdict = z.infer<typeof AggregatorVerdictSchema>;

/**
 * Final per-ticker recommendation rendered into the report: the LLM verdict
 * merged with the deterministic trade-plan prices. Assembled in code, not by an
 * LLM — so every price field is formula-derived from real indicators.
 */
export type Recommendation = AggregatorVerdict & {
  entryStrategy: "immediate" | "pullback" | "breakout" | "avoid";
  entryLow: number;
  entryHigh: number;
  doNotChaseAbove: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
};
