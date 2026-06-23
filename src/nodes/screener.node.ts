import type { TechnicalFeatures } from "../agents/technical-features.js";
import type {
  FundamentalSnapshot,
  ValuationSnapshot,
} from "../services/providers/fundamentals.provider.js";
import { weightedMomentumRaw, percentileRanks } from "../services/indicators.service.js";
import { evaluateTrendTemplate, type TrendTemplateResult } from "./minervini.js";

/**
 * Screener using PUBLISHED methodologies (no self-invented magic numbers):
 *   1. Cross-sectional RS Rating (O'Neil/IBD weighted momentum percentile).
 *   2. Minervini Trend Template — verbatim 8 conditions (incl. RS ≥ 70).
 *   3. CANSLIM fundamental hard filter — quarterly EPS ≥ 20%, sales ≥ 15%.
 *
 * A name must pass ALL of the trend template AND CANSLIM to be an enterNow
 * candidate (strict, by design — Minervini eliminates ~95%). Near-passes
 * (template ≥ NEAR_PASS) go to the watchlist with "missing which conditions".
 * Entry-timing (near MA20 vs extended) still decides enter-now vs wait.
 *
 * ⚠️ Free-tier Finnhub gives only TTM YoY (no quarterly acceleration, no ROE),
 * so CANSLIM is partial — surfaced via `canslimNote`, never silently dropped.
 */

export interface ScoredCandidate {
  ticker: string;
  /** RS Rating 0-100 (cross-sectional percentile of weighted momentum). */
  rsRating: number | null;
  /** Minervini trend template result (X/8). */
  trendTemplate: TrendTemplateResult;
  /** CANSLIM fundamental check. */
  canslimPass: boolean;
  canslimNote: string;
  /** Entry proximity 0-100 (100 = at/below MA20, 0 = extended). */
  entryProximity: number;
  /** % the current price sits above MA20 (negative = below). */
  pctAboveMa20: number | null;
  /** "enter_now" | "watch". */
  bucket: "enter_now" | "watch";
  /** Approx pullback target (MA20) for extended names. */
  pullbackTo: number | null;
}

export interface ScreenResult {
  /** Pass template+CANSLIM, enterable now, ranked by RS, capped to topN. */
  enterNow: ScoredCandidate[];
  /** Qualified but extended, OR near-passes — listed, not deep-analyzed. */
  watchlist: ScoredCandidate[];
  rejected: { ticker: string; reason: string }[];
  unfilteredForEarnings: boolean;
}

/** Template pass-count at/above this (but <8) → watchlist near-pass. */
const NEAR_PASS = 6;
/** Above this % over MA20 a name is "extended" → wait for pullback. */
const EXTENDED_PCT = 8;

export interface ScreenInputRow {
  features: TechnicalFeatures;
  fundamental?: FundamentalSnapshot;
  valuation?: ValuationSnapshot;
}

export function screen(
  rows: Map<string, ScreenInputRow>,
  topN: number,
): ScreenResult {
  // Pass 1 — cross-sectional RS Rating over the whole universe.
  const rawMomentum = new Map<string, number>();
  for (const [ticker, row] of rows) {
    const raw = weightedMomentumRaw(closesFrom(row.features));
    if (raw != null) rawMomentum.set(ticker, raw);
  }
  const rsRanks = percentileRanks(rawMomentum);

  // Pass 2 — per-stock template + CANSLIM.
  const qualified: ScoredCandidate[] = []; // pass all 8 + CANSLIM
  const nearPass: ScoredCandidate[] = []; // template ≥ NEAR_PASS (or qualified-but-extended overflow)
  const rejected: { ticker: string; reason: string }[] = [];

  for (const [ticker, row] of rows) {
    const f = row.features;
    if (f.lastClose == null) {
      rejected.push({ ticker, reason: "no price data" });
      continue;
    }
    if (f.lastClose <= 10) {
      rejected.push({ ticker, reason: "price <= 10" });
      continue;
    }
    const rsRating = rsRanks.get(ticker) ?? null;
    const trendTemplate = evaluateTrendTemplate(f, rsRating);
    const cans = canslimCheck(row.fundamental);
    const candidate = classify(ticker, f, rsRating, trendTemplate, cans);

    if (trendTemplate.passAll && cans.pass) {
      qualified.push(candidate);
    } else if (trendTemplate.passCount >= NEAR_PASS) {
      nearPass.push(candidate);
    } else {
      rejected.push({ ticker, reason: `trend template ${trendTemplate.passCount}/8${cans.pass ? "" : ", CANSLIM fail"}` });
    }
  }

  // Rank by RS Rating (the published "strength" signal), desc.
  const byRs = (a: ScoredCandidate, b: ScoredCandidate) =>
    (b.rsRating ?? -1) - (a.rsRating ?? -1) || b.entryProximity - a.entryProximity;

  const enterable = qualified.filter((c) => c.bucket === "enter_now").sort(byRs);
  const extended = qualified.filter((c) => c.bucket === "watch").sort(byRs);

  const enterNow = enterable.slice(0, topN);
  const overflow = enterable.slice(topN);
  // Watchlist = qualified-but-extended + qualified overflow + template near-passes.
  const watchlist = [...overflow, ...extended, ...nearPass.sort(byRs)];

  return { enterNow, watchlist, rejected, unfilteredForEarnings: true };
}

/**
 * CANSLIM fundamental hard filter (free-tier proxy). Requires growth; missing
 * data fails CANSLIM (no "null免檢"). Note partial coverage in canslimNote.
 */
const EPS_GROWTH_MIN = 20; // %
const SALES_GROWTH_MIN = 15; // %

export function canslimCheck(fund: FundamentalSnapshot | undefined): {
  pass: boolean;
  note: string;
} {
  const epsG = fund?.epsGrowthYoyPct ?? null;
  const revG = fund?.revenueGrowthYoyPct ?? null;
  if (epsG == null && revG == null) {
    return { pass: false, note: "基本面資料不足，CANSLIM 未通過" };
  }
  const epsOk = epsG != null && epsG >= EPS_GROWTH_MIN;
  const salesOk = revG != null && revG >= SALES_GROWTH_MIN;
  const pass = epsOk && salesOk;
  const note =
    `EPS YoY ${fmtPct(epsG)} (需≥${EPS_GROWTH_MIN}%)、營收 YoY ${fmtPct(revG)} (需≥${SALES_GROWTH_MIN}%)` +
    `；註：免費資料無季加速/ROE，CANSLIM 部分條件未驗`;
  return { pass, note };
}

/** Entry-timing classification (near MA20 vs extended). */
function classify(
  ticker: string,
  f: TechnicalFeatures,
  rsRating: number | null,
  trendTemplate: TrendTemplateResult,
  cans: { pass: boolean; note: string },
): ScoredCandidate {
  const pctAboveMa20 =
    f.ma20 != null && f.ma20 > 0 && f.lastClose != null
      ? (f.lastClose / f.ma20 - 1) * 100
      : null;
  const entryProximity = entryProximityScore(pctAboveMa20);
  const extended = pctAboveMa20 != null && pctAboveMa20 > EXTENDED_PCT;
  return {
    ticker,
    rsRating,
    trendTemplate,
    canslimPass: cans.pass,
    canslimNote: cans.note,
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

function fmtPct(v: number | null): string {
  return v == null ? "N/A" : `${v.toFixed(1)}%`;
}

/**
 * Reconstruct a close series from features — only the last close is stored, so
 * weighted momentum needs raw bars. We instead expose a helper the graph fills.
 * (See `screen()` — momentum is computed from features.closeSeries if present.)
 */
function closesFrom(f: TechnicalFeatures): number[] {
  return f.closeSeries ?? [];
}

/**
 * Pure-price pre-fetch gate for the graph: cheaply drop names that clearly can't
 * pass the Minervini template, so we only spend Finnhub calls on real
 * candidates. Conservative (keeps near-passes). Returns a reject reason or null.
 */
export function preFetchReject(f: TechnicalFeatures): string | null {
  if (f.lastClose == null) return "no price data";
  if (f.lastClose <= 10) return "price <= 10";
  if (f.ma50 == null || f.ma150 == null || f.ma200 == null) return "insufficient MA history";
  if ((f.ma200SlopePct ?? -1) <= 0) return "MA200 not rising";
  // Must be above the long-term averages (template conditions 1, 5).
  if (f.lastClose < f.ma200) return "below MA200";
  if (f.lastClose < f.ma50) return "below MA50";
  // Near 52-week high band (condition 7) — allow a margin for near-passes.
  if ((f.pctBelow52wHigh ?? 999) > 35) return "far below 52w high";
  return null;
}
