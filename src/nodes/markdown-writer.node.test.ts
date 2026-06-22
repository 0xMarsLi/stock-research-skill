import { describe, it, expect } from "vitest";
import { renderReport } from "./markdown-writer.node.js";
import type { Recommendation } from "../schemas/recommendation.schema.js";
import type { MarketRegimeResult } from "../schemas/market.schema.js";

const regime: MarketRegimeResult = {
  marketRegime: "risk_on",
  allowNewPositions: true,
  maxEquityExposurePct: 60,
  reason: "uptrend intact",
};

const rec: Recommendation = {
  ticker: "MSFT",
  recommendation: "buy_on_pullback",
  confidence: 76,
  suggestedPositionPct: 8,
  thesis: "Cloud and AI growth intact.",
  bullCase: ["AI/cloud growth strong"],
  bearCase: ["valuation elevated"],
  invalidConditions: ["daily close below MA50"],
  entryStrategy: "pullback",
  entryLow: 410,
  entryHigh: 415,
  doNotChaseAbove: 423,
  stopLoss: 392,
  takeProfit: 460,
  riskReward: 2,
};

describe("renderReport", () => {
  it("includes frontmatter, enter-now section, and key recommendation fields", () => {
    const md = renderReport({ date: "2026-06-21", regime, recommendations: [rec], agentResults: {} });
    expect(md).toMatch(/^---\ndate: 2026-06-21/);
    expect(md).toContain("marketRegime: risk_on"); // frontmatter keeps enum codes
    expect(md).toContain("# 研究推薦報告 — 2026-06-21");
    expect(md).toContain("## ✅ 適合現在進場（深入分析）");
    expect(md).toContain("### MSFT — 回檔買進（信心 76）");
    expect(md).toContain("| 停損 | 392 |");
    expect(md).toContain("| 進場區間 | 410 – 415 |");
    expect(md).toContain("- AI/cloud growth strong");
    expect(md).toContain("- valuation elevated");
  });

  it("renders a watchlist section, listed but not deep-analyzed", () => {
    const md = renderReport({
      date: "2026-06-21",
      regime,
      recommendations: [],
      agentResults: {},
      watchlist: [
        { ticker: "MU", qualityScore: 88, entryProximity: 0, pctAboveMa20: 17.4, bucket: "watch", pullbackTo: 965 },
      ],
    });
    expect(md).toContain("## 👀 觀察名單（體質佳，未深度分析）");
    expect(md).toContain("### 漲多·等回檔");
    expect(md).toContain("| MU | 88 | +17.4% | 965 |");
    expect(md).not.toContain("## 不交易"); // has watchlist => not no-trade
  });

  it("renders no-trade only when both lists are empty", () => {
    const md = renderReport({ date: "2026-06-21", regime, recommendations: [], agentResults: {}, watchlist: [] });
    expect(md).toContain("## 不交易 (No Trade)");
  });

  it("escapes pipes and newlines inside agent summary cells", () => {
    const md = renderReport({
      date: "2026-06-21",
      regime,
      recommendations: [rec],
      agentResults: {
        MSFT: {
          technical: {
            ticker: "MSFT",
            dataAvailable: true,
            signal: "bullish",
            score: 70,
            trend: "line1\nline2 | piped",
            entryStrategy: "pullback",
            entryRationale: "wait for dip",
            invalidIf: "close < MA50",
            notes: "",
          },
        },
      },
    });
    expect(md).toContain("line1 line2 \\| piped");
    expect(md).toContain("| 技術面 | 70 | 偏多 |");
  });
});
