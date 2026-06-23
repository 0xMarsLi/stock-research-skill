import type { TechnicalFeatures } from "../agents/technical-features.js";

/**
 * Mark Minervini's Trend Template — verbatim 8 conditions (original thresholds,
 * no self-invented magic numbers). A name is a Stage-2 leader only if it passes
 * all 8. RS Rating is cross-sectional, so it's passed in (computed by the
 * screener over the whole universe), not derived per-stock here.
 *
 * Reference thresholds (Minervini, "Trade Like a Stock Market Wizard"):
 *  1. price > MA150 and price > MA200
 *  2. MA150 > MA200
 *  3. MA200 trending up (≥1 month)
 *  4. MA50 > MA150 > MA200
 *  5. price > MA50
 *  6. price ≥ 25% above 52-week low  (Minervini also cites 30%; use 25%)
 *  7. price ≤ 25% below 52-week high
 *  8. RS Rating ≥ 70
 */

export interface TrendTemplateResult {
  passCount: number;
  passAll: boolean;
  /** Per-condition pass/fail with a short label (for the report). */
  conditions: { label: string; pass: boolean }[];
}

export const RS_RATING_MIN = 70;
const ABOVE_52W_LOW_MIN = 25; // %
const BELOW_52W_HIGH_MAX = 25; // %

export function evaluateTrendTemplate(
  f: TechnicalFeatures,
  rsRating: number | null,
): TrendTemplateResult {
  const c = f.lastClose;
  const conditions: { label: string; pass: boolean }[] = [
    {
      label: "價 > MA150 且 > MA200",
      pass: c != null && f.ma150 != null && f.ma200 != null && c > f.ma150 && c > f.ma200,
    },
    {
      label: "MA150 > MA200",
      pass: f.ma150 != null && f.ma200 != null && f.ma150 > f.ma200,
    },
    {
      label: "MA200 上揚",
      pass: (f.ma200SlopePct ?? -1) > 0,
    },
    {
      label: "MA50 > MA150 > MA200",
      pass:
        f.ma50 != null && f.ma150 != null && f.ma200 != null &&
        f.ma50 > f.ma150 && f.ma150 > f.ma200,
    },
    {
      label: "價 > MA50",
      pass: c != null && f.ma50 != null && c > f.ma50,
    },
    {
      label: `距52週低 ≥ ${ABOVE_52W_LOW_MIN}%`,
      pass: (f.pctAbove52wLow ?? -1) >= ABOVE_52W_LOW_MIN,
    },
    {
      label: `距52週高 ≤ ${BELOW_52W_HIGH_MAX}%`,
      pass: f.pctBelow52wHigh != null && f.pctBelow52wHigh <= BELOW_52W_HIGH_MAX,
    },
    {
      label: `RS Rating ≥ ${RS_RATING_MIN}`,
      pass: rsRating != null && rsRating >= RS_RATING_MIN,
    },
  ];
  const passCount = conditions.filter((x) => x.pass).length;
  return { passCount, passAll: passCount === conditions.length, conditions };
}
