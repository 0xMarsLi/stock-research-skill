import { describe, it, expect } from "vitest";
import { evaluateTrendTemplate } from "./minervini.js";
import type { TechnicalFeatures } from "../agents/technical-features.js";

/** A textbook Stage-2 leader passing all 8 conditions. */
function leader(over: Partial<TechnicalFeatures> = {}): TechnicalFeatures {
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
    high52w: 105, // price 100 is ~4.8% below high (≤25% ✓)
    low52w: 55, // price 100 is ~82% above low (≥25% ✓)
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
    bars: 300,
    closeSeries: [],
    ...over,
  };
}

describe("evaluateTrendTemplate", () => {
  it("passes all 8 for a textbook Stage-2 leader (RS≥70)", () => {
    const r = evaluateTrendTemplate(leader(), 85);
    expect(r.passAll).toBe(true);
    expect(r.passCount).toBe(8);
  });

  it("fails the RS condition when RS Rating < 70", () => {
    const r = evaluateTrendTemplate(leader(), 60);
    expect(r.passAll).toBe(false);
    expect(r.passCount).toBe(7);
    expect(r.conditions.find((c) => c.label.includes("RS"))?.pass).toBe(false);
  });

  it("fails the 52w-high condition when too far below the high", () => {
    // price far below 52w high → pctBelow52wHigh large
    const r = evaluateTrendTemplate(leader({ pctBelow52wHigh: 40 }), 85);
    expect(r.passCount).toBe(7);
    expect(r.conditions.find((c) => c.label.includes("52週高"))?.pass).toBe(false);
  });

  it("fails MA ordering when MA50 < MA150", () => {
    const r = evaluateTrendTemplate(leader({ ma50: 80 }), 85); // below ma150(82)
    expect(r.conditions.find((c) => c.label.includes("MA50 > MA150"))?.pass).toBe(false);
    expect(r.passAll).toBe(false);
  });

  it("fails when MA200 is not rising", () => {
    const r = evaluateTrendTemplate(leader({ ma200SlopePct: -1 }), 85);
    expect(r.conditions.find((c) => c.label.includes("上揚"))?.pass).toBe(false);
  });
});
