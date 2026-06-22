import "dotenv/config";

/**
 * Centralized environment access + validation.
 * GEMINI_API_KEY is required (no LLM = no research). Everything else is
 * optional; missing keys produce a warning and a degraded-but-running flow.
 */

function warnOnce(message: string): void {
  console.warn(`[env] ${message}`);
}

export type Env = {
  geminiApiKey: string;
  geminiModel: string;
  finnhubApiKey: string | null;
  dataProvider: string;
  /** Market-sentiment search backend. "gemini" (grounding) for now. */
  sentimentProvider: string;
};

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  // Prefer GEMINI_API_KEY; fall back to GOOGLE_API_KEY (langchain/Google SDK's
  // default var) for backward compatibility.
  const geminiApiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is required. Copy .env.example to .env and set it (https://aistudio.google.com/apikey).",
    );
  }

  const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim() || null;
  if (!finnhubApiKey) {
    warnOnce(
      "FINNHUB_API_KEY not set — fundamental/news/valuation agents will run a data-unavailable branch.",
    );
  }

  cached = {
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
    finnhubApiKey,
    dataProvider: process.env.DATA_PROVIDER?.trim() || "finnhub",
    sentimentProvider: process.env.SENTIMENT_PROVIDER?.trim() || "gemini",
  };
  return cached;
}
