import { loadEnv } from "../../config/env.js";
import type { MarketDataProvider } from "./market-data.provider.js";
import type { FundamentalsProvider } from "./fundamentals.provider.js";
import type { NewsProvider } from "./news.provider.js";
import { YahooMarketDataProvider } from "./yahoo-market-data.js";
import { FinnhubFundamentalsProvider } from "./finnhub-fundamentals.js";
import { FinnhubNewsProvider } from "./finnhub-news.js";
import { NullFundamentalsProvider, NullNewsProvider } from "./null-providers.js";
import type { MarketSentimentProvider } from "./market-sentiment.provider.js";
import { GeminiGroundedSearchProvider } from "./market-sentiment.provider.js";

/**
 * Provider factory. Agents call getProviders() and depend only on the
 * interfaces — swapping vendors (or going paid) is contained here.
 */
export interface Providers {
  marketData: MarketDataProvider;
  fundamentals: FundamentalsProvider;
  news: NewsProvider;
  sentiment: MarketSentimentProvider;
}

let cached: Providers | null = null;

export function getProviders(): Providers {
  if (cached) return cached;
  const env = loadEnv();
  const marketData = new YahooMarketDataProvider();
  const fundamentals = env.finnhubApiKey
    ? new FinnhubFundamentalsProvider(env.finnhubApiKey)
    : new NullFundamentalsProvider();
  const news = env.finnhubApiKey
    ? new FinnhubNewsProvider(env.finnhubApiKey)
    : new NullNewsProvider();
  // Market sentiment: Gemini grounding for now (env.sentimentProvider reserved
  // for future Tavily/other backends).
  const sentiment = new GeminiGroundedSearchProvider();
  cached = { marketData, fundamentals, news, sentiment };
  return cached;
}

export type {
  MarketDataProvider,
  FundamentalsProvider,
  NewsProvider,
  MarketSentimentProvider,
};
