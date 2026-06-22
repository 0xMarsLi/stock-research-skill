import type { TechnicalFeatures } from "../agents/technical-features.js";
import type {
  FundamentalSnapshot,
  ValuationSnapshot,
} from "../services/providers/fundamentals.provider.js";

/**
 * Two-stage screener (deterministic, no LLM).
 *
 * Philosophy: separate "is this a GOOD stock?" from "is NOW a good entry?".
 * Selecting only the strongest names is just momentum / hindsight. Instead:
 *
 *   Stage 1 — Good-stock pool
 *     1a. Trend-health gate (price only, all names, zero API cost) — LOOSE:
 *         keep anything whose long-term structure is intact; reject only
 *         falling knives, penny stocks, and data-poor names. A name temporarily
 *         below MA20/MA50 (a pullback) still passes.
 *     1b. Quality score (Finnhub fundamentals, only for gate-passers) — LOOSE:
 *         positive net margin + positive revenue OR EPS growth = a good stock.
 *
 *   Stage 2 — Entry timing (split the good-stock pool into two lists)
 *     - enterNow:   price near MA20 (enterable today)        → deep analysis
 *     - watchlist:  good stock but extended far above MA20    → wait for pullback
 *
 * So MU (great business, but +17% over MA20) lands on the watchlist instead of
 * vanishing; QCOM (good + near MA20) lands on enterNow; TSLA (weak fundamentals)
 * is rejected at the quality stage.
 */

export interface ScoredCandidate {
  ticker: string;
  /** Quality score 0-100 (fundamentals). null if fundamentals unavailable. */
  qualityScore: number | null;
  /** Entry proximity 0-100 (100 = at/below MA20, 0 = extended). */
  entryProximity: number;
  /** % the current price sits above MA20 (negative = below). */
  pctAboveMa20: number | null;
  /** "enter_now" | "watch" classification. */
  bucket: "enter_now" | "watch";
  /** Approx pullback target (MA20) for watchlist names. */
  pullbackTo: number | null;
}

export interface ScreenResult {
  /** Good stocks enterable now, ranked by quality, capped to topN. */
  enterNow: ScoredCandidate[];
  /** Good stocks that are too extended — wait for a pullback. */
  watchlist: ScoredCandidate[];
  rejected: { ticker: string; reason: string }[];
  unfilteredForEarnings: boolean;
}

/** Above this % over MA20 a name is "extended" → watchlist instead of enter-now. */
const EXTENDED_PCT = 8;
/** Minimum quality score to count as a "good stock". Loose by design. */
const QUALITY_FLOOR = 40;

export interface ScreenInputRow {
  features: TechnicalFeatures;
  fundamental?: FundamentalSnapshot;
  valuation?: ValuationSnapshot;
}

export function screen(
  rows: Map<string, ScreenInputRow>,
  topN: number,
): ScreenResult {
  const good: ScoredCandidate[] = [];
  const rejected: { ticker: string; reason: string }[] = [];

  for (const [ticker, row] of rows) {
    const gate = trendHealthReject(row.features);
    if (gate) {
      rejected.push({ ticker, reason: gate });
      continue;
    }
    const quality = qualityScore(row.fundamental, row.valuation);
    if (quality != null && quality < QUALITY_FLOOR) {
      rejected.push({ ticker, reason: `quality below floor (${quality} < ${QUALITY_FLOOR})` });
      continue;
    }
    good.push(classify(ticker, row.features, quality));
  }

  // Rank good stocks by quality (fallback: entry proximity when quality unknown).
  const byQuality = (a: ScoredCandidate, b: ScoredCandidate) =>
    (b.qualityScore ?? 50) - (a.qualityScore ?? 50) || b.entryProximity - a.entryProximity;

  const enterable = good.filter((c) => c.bucket === "enter_now").sort(byQuality);
  const extended = good.filter((c) => c.bucket === "watch").sort(byQuality);

  // Only the top-N enterable names get deep analysis. The rest are still good
  // stocks — demote them to the watchlist instead of dropping them.
  const enterNow = enterable.slice(0, topN);
  const overflow = enterable.slice(topN);
  const watchlist = [...overflow, ...extended].sort(byQuality);

  return {
    enterNow,
    watchlist,
    rejected,
    unfilteredForEarnings: true,
  };
}

/**
 * Stage 1a — trend-health gate. Healthy-uptrend minimum bar:
 *  - not a penny stock / has MA history
 *  - MA200 not rolling over (long-term trend intact)
 *  - price above MA50 (mid-term uptrend) — BUT allow a shallow dip toward MA20:
 *    if price is within DIP_TOLERANCE_PCT below MA50 it still passes (pullback,
 *    not a breakdown). This keeps "temporarily under the line but fine" names.
 *  - not lagging the benchmark badly (relative strength not deeply negative)
 * Exported so the graph can pre-filter before spending Finnhub calls.
 */
const DIP_TOLERANCE_PCT = 3; // how far below MA50 still counts as a pullback
const RS_FLOOR_PCT = -5; // 20d relative strength vs benchmark must beat this

export function trendHealthReject(f: TechnicalFeatures): string | null {
  if (f.lastClose == null) return "no price data";
  if (f.lastClose <= 10) return "price <= 10";
  if (f.ma50 == null || f.ma200 == null) return "insufficient history for MA50/MA200";
  if ((f.ma200SlopePct ?? 0) < 0) return "long-term trend rolling over (MA200 falling)";
  // Must be above MA50, allowing a shallow pullback below it.
  const pctVsMa50 = (f.lastClose / f.ma50 - 1) * 100;
  if (pctVsMa50 < -DIP_TOLERANCE_PCT) return "below MA50 beyond pullback tolerance";
  if ((f.relStrength20dVsBenchmarkPct ?? 0) < RS_FLOOR_PCT) return "lagging benchmark";
  return null;
}

/**
 * Stage 1b — quality score 0-100 from free-tier fundamentals. LOOSE proxy:
 * profitability (net margin), growth (revenue or EPS), and valuation sanity.
 * Returns null when no fundamentals at all (don't penalize missing data — the
 * trend gate already vouched for it).
 */
export function qualityScore(
  fund: FundamentalSnapshot | undefined,
  val: ValuationSnapshot | undefined,
): number | null {
  if (!fund && !val) return null;
  const margin = fund?.netMarginPct ?? null;
  const revG = fund?.revenueGrowthYoyPct ?? null;
  const epsG = fund?.epsGrowthYoyPct ?? null;
  const fwdPe = val?.forwardPe ?? null;
  if (margin == null && revG == null && epsG == null && fwdPe == null) return null;

  // Profitability (0-40): positive margin scores, saturating at 25% margin.
  const profitability = margin == null ? 15 : clamp01(margin / 25) * 40;

  // Growth (0-40): best of revenue / EPS growth, saturating at +30% YoY.
  const bestGrowth = Math.max(revG ?? -999, epsG ?? -999);
  const growth = bestGrowth === -999 ? 15 : clamp01(bestGrowth / 30) * 40;

  // Valuation sanity (0-20): reasonable forward PE scores; extreme/none neutral.
  let valuation = 10;
  if (fwdPe != null) {
    if (fwdPe <= 0) valuation = 5; // negative earnings
    else if (fwdPe <= 25) valuation = 20;
    else if (fwdPe <= 45) valuation = 12;
    else valuation = 5; // very expensive
  }

  return round(profitability + growth + valuation);
}

/** Stage 2 — entry-timing classification for a good stock. */
function classify(
  ticker: string,
  f: TechnicalFeatures,
  quality: number | null,
): ScoredCandidate {
  const pctAboveMa20 =
    f.ma20 != null && f.ma20 > 0 && f.lastClose != null
      ? (f.lastClose / f.ma20 - 1) * 100
      : null;
  const entryProximity = entryProximityScore(pctAboveMa20);
  const extended = pctAboveMa20 != null && pctAboveMa20 > EXTENDED_PCT;
  return {
    ticker,
    qualityScore: quality,
    entryProximity: round(entryProximity * 100),
    pctAboveMa20: pctAboveMa20 == null ? null : round(pctAboveMa20),
    bucket: extended ? "watch" : "enter_now",
    pullbackTo: extended && f.ma20 != null ? round(f.ma20) : null,
  };
}

/** 1.0 at/below MA20, fading to 0 as price extends EXTENDED_PCT above it. */
function entryProximityScore(pctAboveMa20: number | null): number {
  if (pctAboveMa20 == null) return 0.5;
  if (pctAboveMa20 <= 0) return 1;
  return clamp01(1 - pctAboveMa20 / EXTENDED_PCT);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
