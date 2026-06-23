import { describe, it, expect } from "vitest";
import { screen, canslimCheck, preFetchReject, type ScreenInputRow } from "./screener.node.js";
import type { TechnicalFeatures } from "../agents/technical-features.js";
import type { FundamentalSnapshot } from "../services/providers/fundamentals.provider.js";

/**
 * Build a Stage-2 leader passing all 8 Minervini conditions (RS comes from the
 * cross-section, so we make this the strongest name in the set). `closeSeries`
 * is a 252-day uptrend so weighted momentum is computable and high.
 */
function leaderFeatures(over: Partial<TechnicalFeatures> = {}): TechnicalFeatures {
  const closeSeries = Array.from({ length: 260 }, (_, i) => 50 + i * 0.2); // steady uptrend → 100
  return {
    ticker: "LEAD",
    lastClose: 100,
    ma20: 96,
    ma50: 92,
    ma120: 85,
    ma150: 82,
    ma200: 78,
    ma200SlopePct: 5,
    rsi14: 60,
    macdHistogram: 0.5,
    atr14: 3,
    atrPctOfPrice: 3,
    relStrength20dVsBenchmarkPct: 4,
    high52w: 105,
    low52w: 55,
    pctBelow52wHigh: 4.76,
    pctAbove52wLow: 81.8,
    resistance: null,
    distToResistancePct: null,
    support: null,
    distToSupportPct: null,
    rangeHigh: null,
    rangeLow: null,
    pctInRange: null,
    isConsolidating: false,
    nearResistance: false,
    bars: 260,
    closeSeries,
    ...over,
  };
}

function goodFund(over: Partial<FundamentalSnapshot> = {}): FundamentalSnapshot {
  return {
    ticker: "LEAD",
    revenueGrowthYoyPct: 20,
    epsGrowthYoyPct: 30,
    netMarginPct: 22,
    freeCashFlow: 1000,
    nextEarningsDate: null,
    ...over,
  };
}

function row(features: TechnicalFeatures, fundamental?: FundamentalSnapshot): ScreenInputRow {
  return { features, fundamental };
}

describe("canslimCheck", () => {
  it("passes when EPS≥20% and sales≥15%", () => {
    expect(canslimCheck(goodFund()).pass).toBe(true);
  });
  it("fails when EPS growth too low", () => {
    expect(canslimCheck(goodFund({ epsGrowthYoyPct: 5 })).pass).toBe(false);
  });
  it("fails (not passes) when fundamentals missing", () => {
    const r = canslimCheck(undefined);
    expect(r.pass).toBe(false);
    expect(r.note).toMatch(/資料不足/);
  });
});

describe("preFetchReject", () => {
  it("keeps a leader", () => {
    expect(preFetchReject(leaderFeatures())).toBeNull();
  });
  it("drops penny stocks and below-MA200 names", () => {
    expect(preFetchReject(leaderFeatures({ lastClose: 5 }))).toMatch(/price/);
    expect(preFetchReject(leaderFeatures({ lastClose: 70 }))).toMatch(/below MA200/);
  });
  it("drops names with MA200 not rising", () => {
    expect(preFetchReject(leaderFeatures({ ma200SlopePct: -1 }))).toMatch(/MA200 not rising/);
  });
});

describe("screen", () => {
  it("puts a leader passing template+CANSLIM into enterNow with RS Rating", () => {
    // Add a weak second name so the cross-section has a clear leader.
    const weak = leaderFeatures({
      ticker: "WEAK",
      closeSeries: Array.from({ length: 260 }, () => 100), // flat → low momentum
      ma200SlopePct: -1, // also fails template
    });
    const r = screen(new Map([
      ["LEAD", row(leaderFeatures(), goodFund())],
      ["WEAK", row(weak, goodFund({ ticker: "WEAK" }))],
    ]), 5);
    const lead = r.enterNow.find((c) => c.ticker === "LEAD");
    expect(lead).toBeTruthy();
    expect(lead!.trendTemplate.passAll).toBe(true);
    expect(lead!.canslimPass).toBe(true);
    expect(lead!.rsRating).toBe(100); // strongest momentum in the set
  });

  it("rejects a name failing CANSLIM even if template passes", () => {
    const r = screen(new Map([
      ["LEAD", row(leaderFeatures(), goodFund({ epsGrowthYoyPct: 2, revenueGrowthYoyPct: 2 }))],
    ]), 5);
    expect(r.enterNow).toHaveLength(0);
    // template all pass but CANSLIM fails → not enterNow; passCount 8 ≥ NEAR_PASS so watchlist
    expect([...r.watchlist, ...r.rejected].some((x) => "ticker" in x && x.ticker === "LEAD")).toBe(true);
  });

  it("extended leader (far above MA20) goes to watchlist, not enterNow", () => {
    const ext = leaderFeatures({ lastClose: 100, ma20: 88 }); // +13.6% over MA20
    const r = screen(new Map([["LEAD", row(ext, goodFund())]]), 5);
    expect(r.enterNow).toHaveLength(0);
    expect(r.watchlist.some((c) => c.ticker === "LEAD")).toBe(true);
  });

  it("always flags earnings filter not applied", () => {
    expect(screen(new Map(), 5).unfilteredForEarnings).toBe(true);
  });
});
