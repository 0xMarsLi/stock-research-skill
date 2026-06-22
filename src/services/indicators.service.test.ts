import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, atr, relativeStrengthPct } from "./indicators.service.js";
import type { OhlcvBar } from "../schemas/market.schema.js";

describe("sma", () => {
  it("averages the last `period` values", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([2, 4, 6], 2)).toBe(5); // (4+6)/2
  });
  it("returns null when too short", () => {
    expect(sma([1, 2], 3)).toBeNull();
  });
});

describe("ema", () => {
  it("equals the value for a flat series", () => {
    expect(ema([10, 10, 10, 10, 10], 3)).toBeCloseTo(10, 6);
  });
  it("returns null when too short", () => {
    expect(ema([1, 2], 5)).toBeNull();
  });
});

describe("rsi", () => {
  it("is 100 when prices only rise", () => {
    const rising = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(rising, 14)).toBe(100);
  });
  it("classic Wilder example (~70.46)", () => {
    // Well-known reference series for RSI-14.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28,
    ];
    const v = rsi(closes, 14);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(69);
    expect(v!).toBeLessThan(71);
  });
  it("returns null when too short", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
});

describe("macd", () => {
  it("returns null when too short", () => {
    expect(macd([1, 2, 3, 4], 12, 26, 9)).toBeNull();
  });
  it("has zero macd line for a flat series", () => {
    const flat = new Array(60).fill(50);
    const r = macd(flat);
    expect(r).not.toBeNull();
    expect(r!.macd).toBeCloseTo(0, 6);
    expect(r!.histogram).toBeCloseTo(0, 6);
  });
});

describe("atr", () => {
  it("computes a positive range and respects gaps", () => {
    const bars: OhlcvBar[] = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      open: 100,
      high: 102,
      low: 98,
      close: 100,
      volume: 1000,
    }));
    const v = atr(bars, 14);
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo(4, 6); // high-low = 4, no gaps
  });
  it("returns null when too short", () => {
    expect(atr([], 14)).toBeNull();
  });
});

describe("relativeStrengthPct", () => {
  it("is positive when ticker outperforms benchmark", () => {
    const ticker = [100, 100, 110]; // +10%
    const bench = [100, 100, 105]; // +5%
    expect(relativeStrengthPct(ticker, bench, 2)).toBeCloseTo(5, 6);
  });
  it("is negative when ticker underperforms", () => {
    const ticker = [100, 102]; // +2%
    const bench = [100, 108]; // +8%
    expect(relativeStrengthPct(ticker, bench, 1)).toBeCloseTo(-6, 6);
  });
  it("returns null when too short", () => {
    expect(relativeStrengthPct([100], [100], 5)).toBeNull();
  });
});
