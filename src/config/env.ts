import "dotenv/config";

/**
 * Centralized environment access + validation.
 * GOOGLE_API_KEY is required (no LLM = no research). Everything else is
 * optional; missing keys produce a warning and a degraded-but-running flow.
 */

function warnOnce(message: string): void {
  console.warn(`[env] ${message}`);
}

export type Env = {
  googleApiKey: string;
  geminiModel: string;
  finnhubApiKey: string | null;
  dataProvider: string;
  /** Market-sentiment search backend. "gemini" (grounding) for now. */
  sentimentProvider: string;
};

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const googleApiKey = process.env.GOOGLE_API_KEY?.trim() ?? "";
  if (!googleApiKey) {
    throw new Error(
      "GOOGLE_API_KEY is required. Copy .env.example to .env and set it (https://aistudio.google.com/apikey).",
    );
  }

  const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim() || null;
  if (!finnhubApiKey) {
    warnOnce(
      "FINNHUB_API_KEY not set — fundamental/news/valuation agents will run a data-unavailable branch.",
    );
  }

  cached = {
    googleApiKey,
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    finnhubApiKey,
    dataProvider: process.env.DATA_PROVIDER?.trim() || "finnhub",
    sentimentProvider: process.env.SENTIMENT_PROVIDER?.trim() || "gemini",
  };
  return cached;
}
