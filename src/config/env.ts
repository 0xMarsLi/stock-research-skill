import "dotenv/config";

/**
 * Centralized environment access. This is a SKILL: there is no LLM key — the host
 * agent supplies reasoning and web search. The only (optional) key is Finnhub for
 * fundamentals; without it, fundamentals degrade gracefully and the price-only
 * parts still run.
 */

function warnOnce(message: string): void {
  console.warn(`[env] ${message}`);
}

export type Env = {
  finnhubApiKey: string | null;
};

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim() || null;
  if (!finnhubApiKey) {
    warnOnce(
      "FINNHUB_API_KEY not set — fundamentals (CANSLIM) will be unavailable; price-only screening still runs.",
    );
  }

  cached = { finnhubApiKey };
  return cached;
}
