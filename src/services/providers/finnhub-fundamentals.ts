import type {
  FundamentalsProvider,
  FundamentalSnapshot,
  ValuationSnapshot,
} from "./fundamentals.provider.js";
import { finnhubGet, num } from "./finnhub-client.js";
import { readDailyCache, writeDailyCache } from "./daily-cache.js";

/** Shape of Finnhub /stock/metric?metric=all (subset we use; all optional). */
interface FinnhubMetricResponse {
  metric?: Record<string, unknown>;
}

interface FinnhubEarningsCalendar {
  earningsCalendar?: Array<{ date?: string }>;
}

/**
 * FundamentalsProvider backed by Finnhub free tier.
 * Every field is best-effort: missing metrics resolve to null, and the agents
 * lower their confidence rather than failing.
 *
 * The /stock/metric response is cached per trading day AND in-memory per run,
 * so screening the whole universe + later agent reads don't blow the free-tier
 * 60-calls/min limit (getFundamentals + getValuation share one fetch).
 */
export class FinnhubFundamentalsProvider implements FundamentalsProvider {
  constructor(private readonly apiKey: string) {}

  private readonly memo = new Map<string, Record<string, unknown>>();

  /** Fetch /stock/metric once per ticker per day (memo -> daily cache -> API). */
  private async getMetrics(ticker: string): Promise<Record<string, unknown>> {
    const memoed = this.memo.get(ticker);
    if (memoed) return memoed;

    const cached = await readDailyCache<Record<string, unknown>>("metric", ticker);
    if (cached) {
      this.memo.set(ticker, cached);
      return cached;
    }

    const data = await finnhubGet<FinnhubMetricResponse>(
      "/stock/metric",
      { symbol: ticker, metric: "all" },
      this.apiKey,
    );
    const m = data?.metric ?? {};
    this.memo.set(ticker, m);
    if (Object.keys(m).length > 0) await writeDailyCache("metric", ticker, m);
    return m;
  }

  async getFundamentals(ticker: string): Promise<FundamentalSnapshot> {
    const m = await this.getMetrics(ticker);
    return {
      ticker,
      revenueGrowthYoyPct: num(m["revenueGrowthTTMYoy"]),
      epsGrowthYoyPct: num(m["epsGrowthTTMYoy"]),
      netMarginPct: num(m["netProfitMarginTTM"]),
      freeCashFlow: num(m["freeCashFlowTTM"]),
      nextEarningsDate: await this.getNextEarningsDate(ticker),
    };
  }

  async getValuation(ticker: string): Promise<ValuationSnapshot> {
    const m = await this.getMetrics(ticker);
    return {
      ticker,
      peTtm: num(m["peTTM"]),
      forwardPe: num(m["forwardPE"]),
      ps: num(m["psTTM"]),
      evToEbitda: num(m["currentEv/freeCashFlowTTM"]) ?? num(m["evToEbitdaTTM"]),
    };
  }

  private async getNextEarningsDate(ticker: string): Promise<string | null> {
    const cached = await readDailyCache<string | null>("earnings", ticker);
    if (cached !== null) return cached;

    const data = await finnhubGet<FinnhubEarningsCalendar>(
      "/calendar/earnings",
      { symbol: ticker },
      this.apiKey,
    );
    const upcoming = data?.earningsCalendar
      ?.map((e) => e.date)
      .filter((d): d is string => typeof d === "string")
      .sort();
    const result = upcoming?.[0] ?? null;
    await writeDailyCache("earnings", ticker, result);
    return result;
  }
}
