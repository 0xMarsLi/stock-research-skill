/**
 * Minimal Finnhub REST client (fetch-based, no SDK dependency).
 * Returns null on any failure so callers degrade to a data-unavailable branch
 * instead of throwing. Free tier is rate-limited (~60 req/min).
 */
const BASE = "https://finnhub.io/api/v1";

/**
 * Global rate limiter for the Finnhub free tier (~60 calls/min). Token-bucket:
 * keep timestamps of recent calls; if the last 60s already holds the cap, wait
 * until the oldest one ages out. Serialized via a promise chain so concurrent
 * callers queue rather than burst.
 */
const MAX_PER_WINDOW = 50; // headroom below the 60/min hard cap
const WINDOW_MS = 60_000;
const callTimes: number[] = [];
let gate: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireSlot(): Promise<void> {
  // Chain so only one acquirer evaluates the window at a time.
  const prev = gate;
  let release!: () => void;
  gate = new Promise<void>((r) => (release = r));
  await prev;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      while (callTimes.length > 0 && now - callTimes[0]! >= WINDOW_MS) callTimes.shift();
      if (callTimes.length < MAX_PER_WINDOW) {
        callTimes.push(now);
        return;
      }
      const waitMs = WINDOW_MS - (now - callTimes[0]!) + 20;
      await sleep(waitMs);
    }
  } finally {
    release();
  }
}

export async function finnhubGet<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T | null> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", apiKey);
  await acquireSlot();
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[finnhub] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[finnhub] ${path} failed: ${String(err)}`);
    return null;
  }
}

/** Coerce an unknown numeric-ish value to number | null. */
export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
