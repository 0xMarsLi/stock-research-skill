import type { OhlcvBar } from "../schemas/market.schema.js";

/**
 * Lightweight technical indicators. Pure functions over closing-price / OHLCV
 * series, oldest-first. No external deps so they're trivially unit-testable.
 *
 * Each function returns null when there isn't enough data to compute a value.
 */

/** Simple moving average of the last `period` values. */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Exponential moving average series (same length as input, leading nulls). */
export function emaSeries(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with SMA of first `period` values.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series[series.length - 1] ?? null;
}

/**
 * Wilder's RSI over `period` (default 14). Returns 0..100, or null if short.
 */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  // Initial average over the first `period` deltas.
  for (let i = 1; i <= period; i++) {
    const delta = values[i]! - values[i - 1]!;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  // Wilder smoothing for the rest.
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i]! - values[i - 1]!;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export type MacdResult = { macd: number; signal: number; histogram: number };

/** MACD (fast=12, slow=26, signal=9 by default). */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdResult | null {
  if (values.length < slow + signalPeriod) return null;
  const fastE = emaSeries(values, fast);
  const slowE = emaSeries(values, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const f = fastE[i];
    const s = slowE[i];
    if (f != null && s != null) macdLine.push(f - s);
  }
  const signalLine = ema(macdLine, signalPeriod);
  if (signalLine == null) return null;
  const macdVal = macdLine[macdLine.length - 1]!;
  return { macd: macdVal, signal: signalLine, histogram: macdVal - signalLine };
}

/** Average True Range over `period` (default 14), using OHLC bars. */
export function atr(bars: OhlcvBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const cur = bars[i]!;
    const prevClose = bars[i - 1]!.close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    trs.push(tr);
  }
  // Wilder smoothing of TR.
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]!) / period;
  }
  return prev;
}

/**
 * Relative-strength ratio of `ticker` vs `benchmark` over `period` trading days:
 * (ticker return) - (benchmark return), in percent. Positive = outperforming.
 */
export function relativeStrengthPct(
  tickerCloses: number[],
  benchmarkCloses: number[],
  period: number,
): number | null {
  if (tickerCloses.length < period + 1 || benchmarkCloses.length < period + 1) {
    return null;
  }
  const tNow = tickerCloses[tickerCloses.length - 1]!;
  const tThen = tickerCloses[tickerCloses.length - 1 - period]!;
  const bNow = benchmarkCloses[benchmarkCloses.length - 1]!;
  const bThen = benchmarkCloses[benchmarkCloses.length - 1 - period]!;
  if (tThen === 0 || bThen === 0) return null;
  const tRet = (tNow / tThen - 1) * 100;
  const bRet = (bNow / bThen - 1) * 100;
  return tRet - bRet;
}

export const closesOf = (bars: OhlcvBar[]): number[] => bars.map((b) => b.close);

/**
 * IBD/O'Neil-style weighted relative-strength raw score: a blend of trailing
 * returns over ~3/6/9/12 months, weighting the most recent quarter double.
 * Returns null if there isn't ~12 months (252 trading days) of data.
 * The cross-sectional percentile of this raw score is the "RS Rating".
 */
export function weightedMomentumRaw(closes: number[]): number | null {
  if (closes.length < 252) return null;
  const now = closes[closes.length - 1]!;
  const ret = (daysAgo: number): number => {
    const past = closes[closes.length - 1 - daysAgo]!;
    return past > 0 ? now / past - 1 : 0;
  };
  // 3m≈63, 6m≈126, 9m≈189, 12m≈252 trading days; recent quarter weighted 2x.
  return 0.4 * ret(63) + 0.2 * ret(126) + 0.2 * ret(189) + 0.2 * ret(252);
}

/**
 * Cross-sectional percentile rank (0-100) of each value within the set.
 * Used to turn raw momentum into an RS Rating across the universe.
 */
export function percentileRanks(values: Map<string, number>): Map<string, number> {
  const entries = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const n = entries.length;
  const out = new Map<string, number>();
  entries.forEach(([key], i) => {
    // rank 0..1 → 0..100; with n=1 give 100.
    out.set(key, n <= 1 ? 100 : Math.round((i / (n - 1)) * 100));
  });
  return out;
}

// --- Horizontal price structure (support / resistance / range) ---------------
// Heuristic, formula-based (no LLM). Captures what a trader sees on the daily
// chart: pivot highs/lows, the nearest resistance above / support below the
// current price, and whether price is consolidating in a tight box.

export interface Pivot {
  index: number;
  price: number;
  kind: "high" | "low";
}

/**
 * Pivot (swing) highs/lows: a bar is a pivot high if its high is the highest
 * within `lookback` bars on BOTH sides (mirror for pivot low). Bars too close to
 * the edges can't be confirmed and are skipped.
 */
export function swingHighsLows(bars: OhlcvBar[], lookback = 5): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const hi = bars[i]!.high;
    const lo = bars[i]!.low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j]!.high >= hi) isHigh = false;
      if (bars[j]!.low <= lo) isLow = false;
    }
    if (isHigh) pivots.push({ index: i, price: hi, kind: "high" });
    if (isLow) pivots.push({ index: i, price: lo, kind: "low" });
  }
  return pivots;
}

export interface SupportResistance {
  /** Nearest pivot price strictly above `price` (resistance), or null. */
  resistance: number | null;
  /** Nearest pivot price strictly below `price` (support), or null. */
  support: number | null;
}

/**
 * From pivots, find the nearest resistance above and nearest support below the
 * given price. Pivots within `clusterPct` of each other collapse to one level
 * (so a band tested several times counts once, at its average).
 */
export function supportResistance(
  bars: OhlcvBar[],
  price: number,
  lookback = 5,
  clusterPct = 1.5,
): SupportResistance {
  const pivots = swingHighsLows(bars, lookback);
  const levels = clusterLevels(pivots.map((p) => p.price), clusterPct);

  let resistance: number | null = null;
  let support: number | null = null;
  for (const lvl of levels) {
    if (lvl > price && (resistance === null || lvl < resistance)) resistance = lvl;
    if (lvl < price && (support === null || lvl > support)) support = lvl;
  }
  return { resistance, support };
}

/** Collapse nearby levels into their averages (cluster within clusterPct%). */
function clusterLevels(prices: number[], clusterPct: number): number[] {
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: number[] = [];
  let bucket: number[] = [];
  for (const p of sorted) {
    if (bucket.length === 0) {
      bucket.push(p);
      continue;
    }
    const ref = bucket[bucket.length - 1]!;
    if (Math.abs(p / ref - 1) * 100 <= clusterPct) {
      bucket.push(p);
    } else {
      clusters.push(avg(bucket));
      bucket = [p];
    }
  }
  if (bucket.length > 0) clusters.push(avg(bucket));
  return clusters;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export interface RangeBox {
  high: number;
  low: number;
  /** Box width as % of the low. */
  widthPct: number;
  /** Where price sits in the box, 0 (at low) .. 100 (at high). */
  pctInRange: number;
  /** True when the recent box is tight (widthPct <= tightPct) → consolidating. */
  isConsolidating: boolean;
}

/**
 * High/low box over the last `window` bars + where current price sits in it.
 * A tight box (<= `tightPct` wide) flags consolidation.
 */
export function rangeBox(
  bars: OhlcvBar[],
  window = 20,
  tightPct = 12,
): RangeBox | null {
  if (bars.length < window) return null;
  const slice = bars.slice(-window);
  const high = Math.max(...slice.map((b) => b.high));
  const low = Math.min(...slice.map((b) => b.low));
  if (low <= 0 || high <= low) return null;
  const widthPct = (high / low - 1) * 100;
  const close = slice[slice.length - 1]!.close;
  const pctInRange = ((close - low) / (high - low)) * 100;
  return {
    high,
    low,
    widthPct,
    pctInRange: Math.max(0, Math.min(100, pctInRange)),
    isConsolidating: widthPct <= tightPct,
  };
}
