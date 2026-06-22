/**
 * Fundamentals + valuation metrics. Free-tier sources frequently omit fields,
 * so every field is nullable and consumers must degrade gracefully.
 */
export interface FundamentalSnapshot {
  ticker: string;
  revenueGrowthYoyPct: number | null;
  epsGrowthYoyPct: number | null;
  netMarginPct: number | null;
  freeCashFlow: number | null;
  /** Next earnings date (ISO yyyy-mm-dd), if known. */
  nextEarningsDate: string | null;
}

export interface ValuationSnapshot {
  ticker: string;
  peTtm: number | null;
  forwardPe: number | null;
  ps: number | null;
  evToEbitda: number | null;
}

export interface FundamentalsProvider {
  getFundamentals(ticker: string): Promise<FundamentalSnapshot>;
  getValuation(ticker: string): Promise<ValuationSnapshot>;
}
