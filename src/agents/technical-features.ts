import type { OhlcvBar } from "../schemas/market.schema.js";
import {
  sma,
  rsi,
  macd,
  atr,
  relativeStrengthPct,
  closesOf,
  supportResistance,
  rangeBox,
} from "../services/indicators.service.js";

/**
 * Computes a compact set of technical features from OHLCV bars, ready to feed
 * into an agent prompt. Null fields mean "not enough data" and the agent is
 * told so. Shared by the screener and the technical agent.
 */
export interface TechnicalFeatures {
  ticker: string;
  lastClose: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  /** % change of MA200 vs ~20 trading days ago; >0 = long-term trend rising. */
  ma200SlopePct: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  atrPctOfPrice: number | null;
  relStrength20dVsBenchmarkPct: number | null;
  /** 120-day MA (quarter/half-year line) — common mid-term support/resistance. */
  ma120: number | null;
  // --- Horizontal price structure (what a trader sees on the daily chart) ---
  /** Nearest pivot resistance above current price. */
  resistance: number | null;
  /** % distance from price up to resistance (positive). */
  distToResistancePct: number | null;
  /** Nearest pivot support below current price. */
  support: number | null;
  /** % distance from price down to support (positive). */
  distToSupportPct: number | null;
  /** Recent box high/low and where price sits in it. */
  rangeHigh: number | null;
  rangeLow: number | null;
  pctInRange: number | null;
  /** Tight recent box → consolidating (may break out or get rejected). */
  isConsolidating: boolean;
  /** Price is within ~1 ATR of resistance → at a decision point. */
  nearResistance: boolean;
  bars: number;
}

export function computeFeatures(
  ticker: string,
  bars: OhlcvBar[],
  benchmarkBars: OhlcvBar[],
): TechnicalFeatures {
  const closes = closesOf(bars);
  const lastClose = closes.at(-1) ?? null;
  const atr14 = atr(bars, 14);
  const macdRes = macd(closes);
  const ma200 = sma(closes, 200);
  // MA200 slope: compare current MA200 to MA200 of ~20 bars ago.
  const ma200Prev = sma(closes.slice(0, -20), 200);
  const ma200SlopePct =
    ma200 != null && ma200Prev != null && ma200Prev !== 0
      ? (ma200 / ma200Prev - 1) * 100
      : null;

  // Horizontal price structure (formula-derived; the LLM only narrates it).
  const sr = lastClose != null ? supportResistance(bars, lastClose, 5, 1.5) : { resistance: null, support: null };
  const box = rangeBox(bars, 20, 12);
  const distToResistancePct =
    sr.resistance != null && lastClose ? (sr.resistance / lastClose - 1) * 100 : null;
  const distToSupportPct =
    sr.support != null && lastClose ? (1 - sr.support / lastClose) * 100 : null;
  const nearResistance =
    distToResistancePct != null && atr14 != null && lastClose != null
      ? sr.resistance! - lastClose <= atr14
      : false;

  return {
    ticker,
    lastClose,
    ma20: sma(closes, 20),
    ma50: sma(closes, 50),
    ma200,
    ma200SlopePct,
    rsi14: rsi(closes, 14),
    macdHistogram: macdRes?.histogram ?? null,
    atr14,
    atrPctOfPrice: atr14 != null && lastClose ? (atr14 / lastClose) * 100 : null,
    relStrength20dVsBenchmarkPct: relativeStrengthPct(
      closes,
      closesOf(benchmarkBars),
      20,
    ),
    ma120: sma(closes, 120),
    resistance: sr.resistance,
    distToResistancePct,
    support: sr.support,
    distToSupportPct,
    rangeHigh: box?.high ?? null,
    rangeLow: box?.low ?? null,
    pctInRange: box?.pctInRange ?? null,
    isConsolidating: box?.isConsolidating ?? false,
    nearResistance,
    bars: bars.length,
  };
}
