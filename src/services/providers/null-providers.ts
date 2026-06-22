import type {
  FundamentalsProvider,
  FundamentalSnapshot,
  ValuationSnapshot,
} from "./fundamentals.provider.js";
import type { NewsProvider, NewsItem } from "./news.provider.js";

/**
 * No-op providers used when no data key is configured (e.g. FINNHUB_API_KEY
 * absent). They return empty/null data so agents take their data-unavailable
 * branch and the flow still completes end-to-end.
 */

export class NullFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(ticker: string): Promise<FundamentalSnapshot> {
    return {
      ticker,
      revenueGrowthYoyPct: null,
      epsGrowthYoyPct: null,
      netMarginPct: null,
      freeCashFlow: null,
      nextEarningsDate: null,
    };
  }
  async getValuation(ticker: string): Promise<ValuationSnapshot> {
    return { ticker, peTtm: null, forwardPe: null, ps: null, evToEbitda: null };
  }
}

export class NullNewsProvider implements NewsProvider {
  async getRecentNews(_ticker: string, _limit: number): Promise<NewsItem[]> {
    return [];
  }
}
