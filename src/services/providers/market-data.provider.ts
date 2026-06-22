import type { OhlcvBar } from "../../schemas/market.schema.js";

/**
 * Abstraction over price/OHLCV data. Agents depend on this interface, never on
 * a concrete vendor — swapping yahoo for a paid source touches only the impl.
 */
export interface MarketDataProvider {
  /** Daily OHLCV bars, oldest-first, for the last `lookbackDays` calendar days. */
  getDailyBars(ticker: string, lookbackDays: number): Promise<OhlcvBar[]>;
  /** Latest known close (or intraday) price. */
  getQuote(ticker: string): Promise<number | null>;
}
