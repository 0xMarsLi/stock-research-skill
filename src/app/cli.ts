import { runResearch, runAnalyze } from "../graphs/research.graph.js";

/**
 * CLI entrypoint.
 *
 * Commands:
 *   research [--top N]      screen the universe, deeply analyze the top N (default 3)
 *   analyze TICKER...       skip screening; analyze only the given tickers
 *
 *   --top N   number of candidates (default 3; env RESEARCH_TOP_N)
 */
const USAGE = "Usage:\n  research [--top N]\n  analyze TICKER [TICKER...]";
function parseTopN(args: string[]): number | undefined {
  const idx = args.findIndex((a) => a === "--top" || a === "-n");
  const raw = idx >= 0 ? args[idx + 1] : process.env.RESEARCH_TOP_N;
  if (raw == null) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Invalid --top value: ${raw}`);
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "research": {
      const topN = parseTopN(args);
      console.log(`Running research flow${topN ? ` (top ${topN})` : ""}...\n`);
      const path = await runResearch(topN);
      console.log(path ? `\nDone. Report: ${path}` : "\nDone (no report produced).");
      break;
    }
    case "analyze": {
      const tickers = args.filter((a) => !a.startsWith("-"));
      if (tickers.length === 0) {
        console.error("analyze requires at least one ticker.\n" + USAGE);
        process.exit(1);
      }
      console.log(`Analyzing ${tickers.join(", ")}...\n`);
      const path = await runAnalyze(tickers);
      console.log(path ? `\nDone. Report: ${path}` : "\nDone (no report produced).");
      break;
    }
    case undefined:
      console.error(USAGE);
      process.exit(1);
      break;
    default:
      console.error(`Unknown command: ${command}\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
