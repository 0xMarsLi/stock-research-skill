import { z } from "zod";

/**
 * Market regime — overall environment gate produced by the Market Regime agent.
 * Drives whether the research flow opens new positions or short-circuits to no_trade.
 */
export const MarketRegimeSchema = z.object({
  marketRegime: z.enum(["risk_on", "neutral", "risk_off"]),
  allowNewPositions: z.boolean(),
  maxEquityExposurePct: z.number().min(0).max(100),
  reason: z.string(),
});
export type MarketRegimeResult = z.infer<typeof MarketRegimeSchema>;

/**
 * A single OHLCV bar (daily). Dates are ISO yyyy-mm-dd (exchange calendar day).
 */
export const OhlcvBarSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});
export type OhlcvBar = z.infer<typeof OhlcvBarSchema>;

/**
 * Lightweight current-price snapshot used by screener / review.
 */
export const PriceSnapshotSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  date: z.string(),
});
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;
