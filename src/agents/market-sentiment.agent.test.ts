import { describe, it, expect, vi } from "vitest";
import { runMarketSentimentAgent } from "./market-sentiment.agent.js";
import type { MarketSentimentProvider } from "../services/providers/market-sentiment.provider.js";

// Mock the LLM extraction step so the test is offline/deterministic.
vi.mock("../config/llm.js", () => ({
  structuredCall: vi.fn(async () => ({
    ticker: "NVDA",
    dataAvailable: true,
    marketView: "bullish",
    alignment: "agree",
    summary: "市場普遍看多。",
    keyPoints: ["分析師多數給買進"],
  })),
}));

describe("runMarketSentimentAgent", () => {
  it("degrades to dataAvailable=false when search is unavailable", async () => {
    const provider: MarketSentimentProvider = {
      search: async () => ({ text: "", sources: [], available: false }),
    };
    const r = await runMarketSentimentAgent("NVDA", "buy", "thesis", provider, "June 2026");
    expect(r.dataAvailable).toBe(false);
    expect(r.sources).toEqual([]);
  });

  it("extracts sentiment and attaches sources when search succeeds", async () => {
    const provider: MarketSentimentProvider = {
      search: async () => ({
        text: "Analysts maintain a Strong Buy on NVDA...",
        sources: [{ title: "public.com", url: "https://public.com/nvda" }],
        available: true,
      }),
    };
    const r = await runMarketSentimentAgent("NVDA", "buy", "thesis", provider, "June 2026");
    expect(r.dataAvailable).toBe(true);
    expect(r.marketView).toBe("bullish");
    expect(r.alignment).toBe("agree");
    expect(r.sources).toEqual([{ title: "public.com", url: "https://public.com/nvda" }]);
  });
});
