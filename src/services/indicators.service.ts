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
