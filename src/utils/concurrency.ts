/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retries `fn` up to `attempts` times with exponential backoff. Returns the last
 * thrown error to the caller if all attempts fail. Used to ride out transient
 * rate-limit / network blips from unofficial data sources.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 400,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }
  throw lastErr;
}

/**
 * Runs `fn` over `items` with at most `limit` concurrent executions.
 * Keeps us within free-tier API rate limits without external deps.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers: Promise<void>[] = [];
  const size = Math.max(1, Math.min(limit, items.length));

  for (let i = 0; i < size; i++) {
    workers.push(
      (async () => {
        let next = queue.shift();
        while (next) {
          await fn(next.item, next.index);
          next = queue.shift();
        }
      })(),
    );
  }
  await Promise.all(workers);
}
