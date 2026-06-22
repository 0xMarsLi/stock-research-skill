import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { easternToday } from "../../utils/date.js";

/**
 * Tiny same-day file cache for market data. Keyed by (kind, ticker, eastern day):
 * re-running the flow on the same trading day reads from disk instead of hitting
 * the API again — protects against rate limits when screening ~100 names.
 *
 * Cache lives under .cache/<day>/; stale days are simply never read (and can be
 * deleted freely). JSON-serializable values only.
 */
function cachePath(kind: string, key: string): string {
  const safeKey = key.replace(/[^A-Za-z0-9._^-]/g, "_");
  return resolve(process.cwd(), ".cache", easternToday(), `${kind}__${safeKey}.json`);
}

export async function readDailyCache<T>(kind: string, key: string): Promise<T | null> {
  try {
    const raw = await readFile(cachePath(kind, key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null; // miss / unreadable
  }
}

export async function writeDailyCache<T>(kind: string, key: string, value: T): Promise<void> {
  try {
    const path = cachePath(kind, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value), "utf8");
  } catch (err) {
    console.warn(`[cache] write ${kind}/${key} failed: ${String(err)}`);
  }
}
