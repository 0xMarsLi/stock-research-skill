import { describe, it, expect } from "vitest";
import { screen, qualityScore, type ScreenInputRow } from "./screener.node.js";
import type { TechnicalFeatures } from "../agents/technical-features.js";
import type { FundamentalSnapshot, ValuationSnapshot } from "../services/providers/fundamentals.provider.js";

function feat(over: Partial<TechnicalFeatures>): TechnicalFeatures {
  return {
    ticker: "TEST",
    lastClose: 100,
    ma20: 98,
    ma50: 95,
    ma200: 85,
    ma200SlopePct: 3,
    rsi14: 60,
    macdHistogram: 0.5,
    atr14: 2,
    atrPctOfPrice: 2,
    relStrength20dVsBenchmarkPct: 3,
    ma120: 90,
    resistance: null,
    distToResistancePct: null,
    support: null,
    distToSupportPct: null,
    rangeHigh: null,
    rangeLow: null,
    pctInRange: null,
    isConsolidating: false,
    nearResistance: false,
    bars: 250,
    ...over,
  };
}

function goodFund(over: Partial<FundamentalSnapshot> = {}): FundamentalSnapshot {
  return {
    ticker: "TEST",
    revenueGrowthYoyPct: 15,
    epsGrowthYoyPct: 20,
    netMarginPct: 22,
    freeCashFlow: 1000,
    nextEarningsDate: null,
    ...over,
  };
}

function val(over: Partial<ValuationSnapshot> = {}): ValuationSnapshot {
  return { ticker: "TEST", peTtm: 30, forwardPe: 22, ps: 8, evToEbitda: 18, ...over };
}

function row(features: TechnicalFeatures, fundamental?: FundamentalSnapshot, valuation?: ValuationSnapshot): ScreenInputRow {
  return { features, fundamental, valuation };
}

describe("trend-health gate", () => {
  it("rejects penny stocks", () => {
    const r = screen(new Map([["P", row(feat({ ticker: "P", lastClose: 5 }))]]), 10);
    expect(r.rejected[0]?.reason).toBe("price <= 10");
  });

  it("rejects when MA200 is rolling over (long-term trend broken)", () => {
    const r = screen(new Map([["F", row(feat({ ticker: "F", ma200SlopePct: -2 }))]]), 10);
    expect(r.rejected[0]?.reason).toMatch(/MA200 falling/);
  });

  it("rejects names well below MA50 (breakdown, not a pullback)", () => {
    const r = screen(new Map([["B", row(feat({ ticker: "B", lastClose: 88, ma50: 95 }))]]), 10);
    expect(r.rejected[0]?.reason).toMatch(/below MA50/);
  });

  it("rejects names lagging the benchmark badly", () => {
    const r = screen(new Map([["L", row(feat({ ticker: "L", relStrength20dVsBenchmarkPct: -10 }), goodFund(), val())]]), 10);
    expect(r.rejected[0]?.reason).toMatch(/lagging benchmark/);
  });

  it("ALLOWS a shallow dip toward MA50 (good stock on a pullback)", () => {
    // 2% below MA50 (within tolerance), MA200 rising, RS ok → still passes.
    const f = feat({ ticker: "DIP", lastClose: 94, ma20: 96, ma50: 96, ma200: 85, ma200SlopePct: 4, relStrength20dVsBenchmarkPct: 1 });
    const r = screen(new Map([["DIP", row(f, goodFund(), val())]]), 10);
    expect(r.rejected).toEqual([]);
    expect([...r.enterNow, ...r.watchlist].map((c) => c.ticker)).toContain("DIP");
  });
});

describe("quality gate", () => {
  it("rejects weak fundamentals below the floor", () => {
    const weak = goodFund({ netMarginPct: -5, revenueGrowthYoyPct: -10, epsGrowthYoyPct: -20 });
    const r = screen(new Map([["W", row(feat({ ticker: "W" }), weak, val({ forwardPe: 80 }))]]), 10);
    expect(r.rejected[0]?.reason).toMatch(/quality below floor/);
  });

  it("does not penalize totally missing fundamentals (null quality passes)", () => {
    const r = screen(new Map([["X", row(feat({ ticker: "X" }))]]), 10);
    expect(r.rejected).toEqual([]);
  });
});

describe("entry-timing classification", () => {
  it("near MA20 → enterNow; extended → watchlist", () => {
    const near = feat({ ticker: "NEAR", lastClose: 100, ma20: 99 }); // +1%
    const ext = feat({ ticker: "EXT", lastClose: 120, ma20: 100 }); // +20%
    const r = screen(new Map([
      ["NEAR", row(near, goodFund(), val())],
      ["EXT", row(ext, goodFund(), val())],
    ]), 10);
    expect(r.enterNow.map((c) => c.ticker)).toContain("NEAR");
    expect(r.watchlist.map((c) => c.ticker)).toContain("EXT");
    expect(r.watchlist.find((c) => c.ticker === "EXT")?.pullbackTo).toBe(100);
  });

  it("ranks enterNow by quality, caps to topN, and overflows the rest to watchlist (not dropped)", () => {
    const hi = row(feat({ ticker: "HI", lastClose: 100, ma20: 99 }), goodFund({ netMarginPct: 25, revenueGrowthYoyPct: 30 }), val());
    const lo = row(feat({ ticker: "LO", lastClose: 100, ma20: 99 }), goodFund({ netMarginPct: 10, revenueGrowthYoyPct: 5 }), val());
    const r = screen(new Map([["LO", lo], ["HI", hi]]), 1);
    expect(r.enterNow).toHaveLength(1);
    expect(r.enterNow[0]?.ticker).toBe("HI");
    // LO is enterable but beyond topN → demoted to watchlist, NOT dropped.
    expect(r.watchlist.map((c) => c.ticker)).toContain("LO");
    expect(r.rejected.map((c) => c.ticker)).not.toContain("LO");
  });
});

describe("qualityScore", () => {
  it("returns null when no fundamentals at all", () => {
    expect(qualityScore(undefined, undefined)).toBeNull();
  });
  it("high margin + growth + reasonable PE scores high", () => {
    const s = qualityScore(goodFund({ netMarginPct: 25, revenueGrowthYoyPct: 30 }), val({ forwardPe: 20 }));
    expect(s!).toBeGreaterThan(80);
  });
  it("weak fundamentals score low", () => {
    const s = qualityScore(goodFund({ netMarginPct: 2, revenueGrowthYoyPct: -5, epsGrowthYoyPct: -10 }), val({ forwardPe: 90 }));
    expect(s!).toBeLessThan(40);
  });
});

describe("earnings filter flag", () => {
  it("always flags that earnings-date filtering was skipped", () => {
    expect(screen(new Map(), 10).unfilteredForEarnings).toBe(true);
  });
});
