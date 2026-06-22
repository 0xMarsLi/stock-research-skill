import type { NewsProvider, NewsItem } from "./news.provider.js";
import { finnhubGet } from "./finnhub-client.js";
import { daysAgo, toIso } from "../../utils/date.js";

interface FinnhubNewsRow {
  datetime?: number; // unix seconds
  headline?: string;
  summary?: string;
  source?: string;
}

/**
 * NewsProvider backed by Finnhub free tier (/company-news).
 * Empty list = treated as "no data" by the news agent.
 */
export class FinnhubNewsProvider implements NewsProvider {
  constructor(private readonly apiKey: string) {}

  async getRecentNews(ticker: string, limit: number): Promise<NewsItem[]> {
    const rows = await finnhubGet<FinnhubNewsRow[]>(
      "/company-news",
      { symbol: ticker, from: toIso(daysAgo(14)), to: toIso(daysAgo(0)) },
      this.apiKey,
    );
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => r.headline)
      .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, limit)
      .map((r) => ({
        date: r.datetime ? toIso(new Date(r.datetime * 1000)) : "",
        headline: r.headline ?? "",
        summary: r.summary ?? "",
        source: r.source ?? "finnhub",
      }));
  }
}
