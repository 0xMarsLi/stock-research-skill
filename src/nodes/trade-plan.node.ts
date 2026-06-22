import type { TradePlan } from "../schemas/trade-plan.schema.js";
import type { TechnicalFeatures } from "../agents/technical-features.js";

/**
 * Deterministic trade-plan calculator. Turns the technical agent's chosen entry
 * STRATEGY into concrete prices using REAL indicators (close / MA20 / ATR).
 * No LLM — these numbers are verifiable and reproducible.
 *
 * Formula (ATR-based, the most volatility-adaptive default):
 *   stopLoss  = entryRef - STOP_ATR_MULT * ATR
 *   takeProfit = entryRef + (entryRef - stopLoss) * REWARD_MULT   (R:R = REWARD_MULT)
 *   entry zone depends on strategy:
 *     immediate: [close - 0.5*ATR, close + 0.5*ATR]   around current price
 *     pullback:  [MA20 - 0.5*ATR, MA20 + 0.5*ATR]     wait for pullback to MA20
 *     breakout:  [close, close + 1.0*ATR]             buy strength above current
 *   doNotChaseAbove = entryHigh + CHASE_ATR_MULT * ATR
 *
 * TODO: make the stop strategy pluggable (ATR / MA-structure / percent) via config.
 */

const STOP_ATR_MULT = 2;
const REWARD_MULT = 2; // risk:reward target
const CHASE_ATR_MULT = 1;
const ENTRY_BAND_ATR = 0.5;

/** Fallback band when ATR is unavailable: ±2% of price. */
const FALLBACK_BAND_PCT = 0.02;

export function buildTradePlan(
  features: TechnicalFeatures,
  entryStrategy: TradePlan["entryStrategy"],
): TradePlan {
  const close = features.lastClose ?? 0;
  const atr = features.atr14;
  const ma20 = features.ma20;
  const degraded = close <= 0 || atr == null;

  const band = atr != null ? ENTRY_BAND_ATR * atr : close * FALLBACK_BAND_PCT;
  const stopDist = atr != null ? STOP_ATR_MULT * atr : close * FALLBACK_BAND_PCT * 2;

  // Entry zone center depends on strategy (pullback aims at MA20 if known).
  let entryLow: number;
  let entryHigh: number;
  switch (entryStrategy) {
    case "pullback": {
      const center = ma20 ?? close;
      entryLow = center - band;
      entryHigh = center + band;
      break;
    }
    case "breakout": {
      entryLow = close;
      entryHigh = close + 2 * band;
      break;
    }
    case "immediate":
    case "avoid":
    default: {
      entryLow = close - band;
      entryHigh = close + band;
      break;
    }
  }

  const entryRef = (entryLow + entryHigh) / 2;
  const stopLoss = entryRef - stopDist;
  const risk = entryRef - stopLoss;
  const takeProfit = entryRef + risk * REWARD_MULT;
  const doNotChaseAbove = entryHigh + (atr != null ? CHASE_ATR_MULT * atr : band);
  const riskReward = risk > 0 ? (takeProfit - entryRef) / risk : 0;

  return {
    ticker: features.ticker,
    entryStrategy,
    entryLow: round(entryLow),
    entryHigh: round(entryHigh),
    doNotChaseAbove: round(doNotChaseAbove),
    stopLoss: round(stopLoss),
    takeProfit: round(takeProfit),
    riskReward: round(riskReward),
    refClose: round(close),
    refMa20: ma20 == null ? null : round(ma20),
    refMa50: features.ma50 == null ? null : round(features.ma50),
    refAtr: atr == null ? null : round(atr),
    degraded,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
