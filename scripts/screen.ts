/**
 * Screen the S&P 500 with Minervini Trend Template + CANSLIM + RS Rating.
 * Pure formula, NO LLM. Prints JSON to stdout for the host agent to judge.
 *
 * Usage: tsx scripts/screen.ts [--top N]   (default N=5)
 */
import { runScreen } from "./lib.js";
import { easternToday } from "../src/utils/date.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === "--top" || a === "-n");
  const raw = idx >= 0 ? args[idx + 1] : process.env.RESEARCH_TOP_N;
  const topN = raw ? Number.parseInt(raw, 10) : 5;
  if (!Number.isFinite(topN) || topN <= 0) {
    process.stderr.write(`Invalid --top: ${raw}\n`);
    process.exit(1);
  }
  const json = await runScreen(topN, easternToday());
  process.stdout.write(JSON.stringify(json, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(1);
});
