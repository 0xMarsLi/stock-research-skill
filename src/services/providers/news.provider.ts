/**
 * Company news / analyst actions. Free-tier may return an empty list; callers
 * treat empty as "no data" rather than "no news".
 */
export interface NewsItem {
  date: string;
  headline: string;
  summary: string;
  source: string;
}

export interface NewsProvider {
  /** Recent headlines for a ticker, newest-first, limited to `limit`. */
  getRecentNews(ticker: string, limit: number): Promise<NewsItem[]>;
}
