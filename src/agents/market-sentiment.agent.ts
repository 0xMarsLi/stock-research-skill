import { structuredCall } from "../config/llm.js";
import {
  MarketSentimentSchema,
  type MarketSentimentResult,
} from "../schemas/market-sentiment.schema.js";
import type { MarketSentimentProvider } from "../services/providers/market-sentiment.provider.js";

const SYSTEM = `You compare the MARKET's view of a stock against our own call.
You are given web commentary (analyst ratings, news, opinions) plus our
recommendation. Decide:
- marketView: is the market broadly bullish / mixed / bearish on the stock?
- alignment: does the market AGREE with our recommendation, is it MIXED, or does
  it DISAGREE? (e.g. we say buy but the market is bearish = disagree)
Summarize what the market is saying and list the notable points. Base everything
ONLY on the provided commentary — do not invent ratings or numbers.`;

/**
 * Two-step (grounding ⊥ structured output on Gemini):
 *  1. provider.search() → raw web commentary + sources
 *  2. structuredCall() → extract MarketSentimentResult, compared vs our call
 */
export async function runMarketSentimentAgent(
  ticker: string,
  ourRecommendation: string,
  ourThesis: string,
  provider: MarketSentimentProvider,
  monthYear: string,
): Promise<MarketSentimentResult> {
  const query =
    `${ticker} stock analysis analyst rating buy or sell ${monthYear}, ` +
    `recent news and price outlook, bull and bear case`;
  const search = await provider.search(query);

  if (!search.available || !search.text.trim()) {
    return {
      ticker,
      dataAvailable: false,
      marketView: "mixed",
      alignment: "mixed",
      summary: "無法取得市場討論資料（搜尋失敗或無結果）。",
      keyPoints: [],
      sources: [],
    };
  }

  const user = `Ticker: ${ticker}
Our recommendation: ${ourRecommendation}
Our thesis: ${ourThesis}

--- Web commentary (from search) ---
${search.text}
--- end commentary ---

Extract the market's view and how it aligns with our recommendation. Set dataAvailable=true.`;

  const result = await structuredCall<Omit<MarketSentimentResult, "sources">>(
    MarketSentimentSchema,
    SYSTEM,
    user,
    "MarketSentiment",
  );
  return { ...result, sources: search.sources };
}
