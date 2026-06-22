import { z } from "zod";

/**
 * Market-sentiment result — the web's view of a stock, extracted from grounded
 * search and compared against OUR recommendation. Explicit fields (Gemini
 * rejects open records). `dataAvailable` lets the flow degrade when search fails.
 */
export const MarketSentimentSchema = z.object({
  ticker: z.string(),
  dataAvailable: z.boolean(),
  /** What the market/analysts broadly think. */
  marketView: z.enum(["bullish", "mixed", "bearish"]),
  /** Whether the market agrees with our recommendation. */
  alignment: z.enum(["agree", "mixed", "disagree"]),
  summary: z.string().describe("concise summary of what the market is saying"),
  keyPoints: z.array(z.string()).describe("notable bullish/bearish points raised by the market"),
});
export type MarketSentimentResult = z.infer<typeof MarketSentimentSchema> & {
  /** Source links (attached in code, not by the LLM). */
  sources?: { title: string; url: string }[];
};
