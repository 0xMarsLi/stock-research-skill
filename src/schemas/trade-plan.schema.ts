import { z } from "zod";

/**
 * Deterministic trade plan — entry/stop/target computed by formula from REAL
 * indicators (no LLM). This is the single source of truth for all price numbers
 * in the report.
 */
export const TradePlanSchema = z.object({
  ticker: z.string(),
  /** Strategy chosen by the technical agent, executed here as concrete prices. */
  entryStrategy: z.enum(["immediate", "pullback", "breakout", "avoid"]),
  entryLow: z.number(),
  entryHigh: z.number(),
  doNotChaseAbove: z.number(),
  stopLoss: z.number(),
  takeProfit: z.number(),
  /** Risk:reward, derived (takeProfit-entry)/(entry-stop). */
  riskReward: z.number(),
  /** Real indicator snapshot the plan was built from (shown in the report). */
  refClose: z.number(),
  refMa20: z.number().nullable(),
  refMa50: z.number().nullable(),
  refAtr: z.number().nullable(),
  /** True when indicators were too sparse to compute a reliable plan. */
  degraded: z.boolean(),
});
export type TradePlan = z.infer<typeof TradePlanSchema>;
