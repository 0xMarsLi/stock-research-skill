import { loadEnv } from "../../config/env.js";
import type { MarketDataProvider } from "./market-data.provider.js";
import type { FundamentalsProvider } from "./fundamentals.provider.js";
import type { NewsProvider } from "./news.provider.js";
import { YahooMarketDataProvider } from "./yahoo-market-data.js";
import { FinnhubFundamentalsProvider } from "./finnhub-fundamentals.js";
import { FinnhubNewsProvider } from "./finnhub-news.js";
import { NullFundamentalsProvider, NullNewsProvider } from "./null-providers.js";

/**
 * Provider factory. The deterministic scripts depend only on these interfaces —
 * swapping vendors (or going paid) is contained here. No LLM/sentiment provider:
 * judgment and web search are the host agent's job, not this skill's.
 */
export interface Providers {
  marketData: MarketDataProvider;
  fundamentals: FundamentalsProvider;
  news: NewsProvider;
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
  cached = { marketData, fundamentals, news };
  return cached;
}

export type { MarketDataProvider, FundamentalsProvider, NewsProvider };
