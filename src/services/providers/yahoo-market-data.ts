import YahooFinance from "yahoo-finance2";
import type { MarketDataProvider } from "./market-data.provider.js";
import type { OhlcvBar } from "../../schemas/market.schema.js";
import { daysAgo, toIso } from "../../utils/date.js";
import { withRetry } from "../../utils/concurrency.js";
import { readDailyCache, writeDailyCache } from "./daily-cache.js";

/**
 * MarketDataProvider backed by yahoo-finance2 (no API key required).
 * Unofficial source — tolerate transient failures by returning [] / null and
 * letting downstream agents flag missing data rather than crashing the flow.
 * Daily bars are cached per trading day to avoid re-hitting the API on reruns.
 */
export class YahooMarketDataProvider implements MarketDataProvider {
  // yahoo-finance2 v3 exports a class; instantiate once per provider.
  private readonly yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

  async getDailyBars(ticker: string, lookbackDays: number): Promise<OhlcvBar[]> {
    const cacheKey = `${ticker}_${lookbackDays}`;
    const cached = await readDailyCache<OhlcvBar[]>("bars", cacheKey);
    if (cached) return cached;

    try {
      const result = await withRetry(() =>
        this.yf.chart(ticker, {
          period1: daysAgo(lookbackDays),
          interval: "1d",
          return: "array",
        }),
      );
      const bars: OhlcvBar[] = [];
      for (const q of result.quotes) {
        if (
          q.open == null ||
          q.high == null ||
          q.low == null ||
          q.close == null ||
          q.volume == null
        ) {
          continue; // skip incomplete bars (holidays / partial days)
        }
        bars.push({
          date: toIso(q.date),
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume,
        });
      }
      if (bars.length > 0) await writeDailyCache("bars", cacheKey, bars);
      return bars;
    } catch (err) {
      console.warn(`[yahoo] getDailyBars(${ticker}) failed: ${String(err)}`);
      return [];
    }
  }

  async getQuote(ticker: string): Promise<number | null> {
    try {
      const q = await this.yf.quote(ticker);
      return q?.regularMarketPrice ?? null;
    } catch (err) {
      console.warn(`[yahoo] getQuote(${ticker}) failed: ${String(err)}`);
      return null;
    }
  }
}
