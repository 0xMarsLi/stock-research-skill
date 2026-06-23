/**
 * Analyze specific tickers (skip the screen). Pure formula, NO LLM. Prints JSON
 * to stdout for the host agent to judge. RS Rating is computed vs the full
 * S&P 500 universe.
 *
 * Usage: tsx scripts/analyze.ts NVDA AAPL TSM
 */
import { runAnalyze } from "./lib.js";
import { easternToday } from "../src/utils/date.js";

async function main(): Promise<void> {
  const tickers = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (tickers.length === 0) {
    process.stderr.write("Usage: tsx scripts/analyze.ts TICKER [TICKER...]\n");
    process.exit(1);
  }
  const json = await runAnalyze(tickers, easternToday());
  process.stdout.write(JSON.stringify(json, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
});
