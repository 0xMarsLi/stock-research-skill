import { describe, it, expect } from "vitest";
import { buildTradePlan } from "./trade-plan.node.js";
import type { TechnicalFeatures } from "../agents/technical-features.js";

function feat(over: Partial<TechnicalFeatures>): TechnicalFeatures {
  return {
    ticker: "TEST",
    lastClose: 100,
    ma20: 96,
    ma50: 90,
    ma200: 80,
    ma200SlopePct: 3,
    rsi14: 55,
    macdHistogram: 0.5,
    atr14: 4,
    atrPctOfPrice: 4,
    relStrength20dVsBenchmarkPct: 2,
    ma120: 85,
    ma150: 83,
    high52w: 120,
    low52w: 70,
    pctBelow52wHigh: 16.7,
    pctAbove52wLow: 42.9,
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
    closeSeries: [],
    ...over,
  };
}

describe("buildTradePlan", () => {
  it("immediate: entry band around close, stop = ref - 2*ATR, R:R = 2", () => {
    const p = buildTradePlan(feat({}), "immediate");
    expect(p.entryLow).toBe(98); // 100 - 0.5*4
    expect(p.entryHigh).toBe(102); // 100 + 0.5*4
    expect(p.stopLoss).toBe(92); // ref 100 - 2*4
    expect(p.takeProfit).toBe(116); // 100 + 8*2
    expect(p.riskReward).toBe(2);
    expect(p.degraded).toBe(false);
  });

  it("pullback: entry zone centers on MA20", () => {
    const p = buildTradePlan(feat({}), "pullback");
    expect(p.entryLow).toBe(94); // 96 - 0.5*4
    expect(p.entryHigh).toBe(98); // 96 + 0.5*4
  });

  it("breakout: entry zone starts at close and extends up", () => {
    const p = buildTradePlan(feat({}), "breakout");
    expect(p.entryLow).toBe(100);
    expect(p.entryHigh).toBe(104); // 100 + 2*0.5*4
  });

  it("carries real indicator snapshot for the report", () => {
    const p = buildTradePlan(feat({}), "immediate");
    expect(p.refClose).toBe(100);
    expect(p.refMa20).toBe(96);
    expect(p.refMa50).toBe(90);
    expect(p.refAtr).toBe(4);
  });

  it("degrades gracefully when ATR is missing (percent fallback)", () => {
    const p = buildTradePlan(feat({ atr14: null }), "immediate");
    expect(p.degraded).toBe(true);
    expect(p.entryLow).toBe(98); // 100 - 2%
    expect(p.entryHigh).toBe(102);
    expect(p.stopLoss).toBe(96); // 100 - 4%
  });
});
