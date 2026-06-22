import { z } from "zod";
import type { TradePlan } from "./trade-plan.schema.js";
import type { MarketSentimentResult } from "./market-sentiment.schema.js";

/**
 * Output schemas for each research agent.
 *
 * IMPORTANT (Gemini constraint): these schemas are passed to
 * `llm.withStructuredOutput(..., { method: "json_schema" })`. Gemini rejects
 * objects with unknown/open properties (e.g. `z.record(z.unknown())`), so every
 * field here must be explicitly typed. Keep this file free of open records.
 *
 * Every agent carries `dataAvailable` so a provider gap (e.g. missing Finnhub
 * free-tier fields) degrades confidence instead of crashing the flow.
 */

/**
 * Technical agent. It judges trend/momentum and chooses an ENTRY STRATEGY, but
 * does NOT emit price numbers — prices are computed deterministically from real
 * indicators by the trade-plan node. entryStrategy:
 *  - immediate: buy now (strong trend, near support)
 *  - pullback:  wait for a pullback toward MA20 (extended / overbought)
 *  - breakout:  buy on a breakout above recent consolidation
 *  - avoid:     technicals don't support an entry
 */
export const TechnicalSchema = z.object({
  ticker: z.string(),
  dataAvailable: z.boolean(),
  signal: z.enum(["bullish", "neutral", "bearish"]),
  score: z.number().min(0).max(100),
  trend: z.string().describe("short description of current trend"),
  entryStrategy: z.enum(["immediate", "pullback", "breakout", "avoid"]),
  entryRationale: z.string().describe("why this entry strategy, referencing the indicators (no invented numbers)"),
  invalidIf: z.string().describe("condition that invalidates the technical setup"),
  notes: z.string(),
});
export type TechnicalResult = z.infer<typeof TechnicalSchema>;

export const FundamentalSchema = z.object({
  ticker: z.string(),
  dataAvailable: z.boolean(),
  signal: z.enum(["positive", "neutral", "negative"]),
  score: z.number().min(0).max(100),
  thesis: z.string(),
  risk: z.string(),
});
export type FundamentalResult = z.infer<typeof FundamentalSchema>;

export const ValuationSchema = z.object({
  ticker: z.string(),
  dataAvailable: z.boolean(),
  score: z.number().min(0).max(100),
  valuationView: z.enum(["cheap", "fair", "fair_to_expensive", "expensive"]),
  reason: z.string(),
});
export type ValuationResult = z.infer<typeof ValuationSchema>;

export const NewsSchema = z.object({
  ticker: z.string(),
  dataAvailable: z.boolean(),
  sentiment: z.enum(["negative", "neutral", "neutral_positive", "positive"]),
  score: z.number().min(0).max(100),
  summary: z.string(),
  riskEvents: z.array(z.string()),
});
export type NewsResult = z.infer<typeof NewsSchema>;

export const BullCaseSchema = z.object({
  ticker: z.string(),
  bullCase: z.array(z.string()).describe("concrete reasons to buy"),
});
export type BullCaseResult = z.infer<typeof BullCaseSchema>;

export const BearCaseSchema = z.object({
  ticker: z.string(),
  bearCase: z.array(z.string()).describe("concrete reasons to avoid or be cautious"),
});
export type BearCaseResult = z.infer<typeof BearCaseSchema>;

/**
 * Risk pre-check. Decides whether recommending the name is reasonable and a max
 * position size. Stop-loss is NOT here — it's computed deterministically by the
 * trade-plan node from real ATR.
 */
export const RiskPrecheckSchema = z.object({
  ticker: z.string(),
  allowed: z.boolean(),
  maxPositionPct: z.number().min(0).max(100),
  reason: z.string(),
});
export type RiskPrecheckResult = z.infer<typeof RiskPrecheckSchema>;

/**
 * Per-ticker bundle of all agent outputs accumulated in graph state.
 * (Internal state container — NOT passed to the LLM, so a plain object is fine.)
 */
export type AgentResults = {
  technical?: TechnicalResult;
  fundamental?: FundamentalResult;
  valuation?: ValuationResult;
  news?: NewsResult;
  bull?: BullCaseResult;
  bear?: BearCaseResult;
  tradePlan?: TradePlan;
  sentiment?: MarketSentimentResult;
};
