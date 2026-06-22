import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { MarketRegimeResult } from "../schemas/market.schema.js";
import type { AgentResults, RiskPrecheckResult } from "../schemas/agent-output.schema.js";
import type { Recommendation } from "../schemas/recommendation.schema.js";
import { getProviders } from "../services/providers/index.js";
import { UNIVERSE, BENCHMARK } from "../config/universe.js";
import { computeFeatures, type TechnicalFeatures } from "../agents/technical-features.js";
import { screen, trendHealthReject, type ScoredCandidate, type ScreenInputRow } from "../nodes/screener.node.js";
import { buildTradePlan } from "../nodes/trade-plan.node.js";
import { runMarketRegimeAgent } from "../agents/market-regime.agent.js";
import { runTechnicalAgent } from "../agents/technical.agent.js";
import { runFundamentalAgent } from "../agents/fundamental.agent.js";
import { runValuationAgent } from "../agents/valuation.agent.js";
import { runNewsAgent } from "../agents/news.agent.js";
import { runBullCaseAgent } from "../agents/bull-case.agent.js";
import { runBearCaseAgent } from "../agents/bear-case.agent.js";
import { runRiskPrecheckAgent } from "../agents/risk-precheck.agent.js";
import { runResearchAggregator } from "../agents/research-aggregator.agent.js";
import { runMarketSentimentAgent } from "../agents/market-sentiment.agent.js";
import { writeRecommendationReport } from "../nodes/markdown-writer.node.js";
import { easternToday } from "../utils/date.js";
import { mapWithConcurrency } from "../utils/concurrency.js";

const LOOKBACK_DAYS = 400; // ~ enough trading days for MA200
const DEFAULT_TOP_N = 3; // candidates sent to deep LLM analysis (configurable)
const AGENT_CONCURRENCY = 3; // LLM calls — keep within free-tier rate limits
const DATA_CONCURRENCY = 8; // price fetches are cheap; higher throughput for screening
const FUNDAMENTALS_CONCURRENCY = 4; // Finnhub free tier ~60/min; stay well under

/** Merge reducer for per-ticker record state written by parallel work. */
function mergeRecord<T>(left: Record<string, T>, right: Record<string, T>): Record<string, T> {
  return { ...left, ...right };
}

/** "2026-06-21" → "June 2026" for natural search queries. */
function monthYearLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const idx = Number.parseInt(m ?? "1", 10) - 1;
  return `${months[idx] ?? ""} ${y ?? ""}`.trim();
}

const ResearchState = Annotation.Root({
  date: Annotation<string>(),
  topN: Annotation<number>(),
  /** "screen" = pick from universe; "analyze" = use the provided tickers. */
  mode: Annotation<"screen" | "analyze">(),
  inputTickers: Annotation<string[] | undefined>(),
  candidates: Annotation<string[]>(),
  featuresByTicker: Annotation<Record<string, TechnicalFeatures>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  marketRegime: Annotation<MarketRegimeResult | undefined>(),
  screenScores: Annotation<Record<string, ScoredCandidate>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  /** Good stocks that are too extended to enter now — listed, not deep-analyzed. */
  watchlist: Annotation<ScoredCandidate[]>(),
  agentResults: Annotation<Record<string, AgentResults>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  riskResults: Annotation<Record<string, RiskPrecheckResult>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),
  recommendations: Annotation<Recommendation[]>(),
  reportPath: Annotation<string | undefined>(),
});

type State = typeof ResearchState.State;

// --- Nodes ---

async function marketRegimeNode(): Promise<Partial<State>> {
  const marketRegime = await runMarketRegimeAgent();
  console.log(`[regime] ${marketRegime.marketRegime} — allowNewPositions=${marketRegime.allowNewPositions}`);
  return { marketRegime };
}

/** Fetch OHLCV + compute technical features for a set of tickers (cheap fan-out). */
async function fetchFeatures(
  tickers: string[],
): Promise<Record<string, TechnicalFeatures>> {
  const { marketData } = getProviders();
  const benchmarkBars = await marketData.getDailyBars(BENCHMARK, LOOKBACK_DAYS);
  const featuresByTicker: Record<string, TechnicalFeatures> = {};
  await mapWithConcurrency(tickers, DATA_CONCURRENCY, async (ticker) => {
    const bars = await marketData.getDailyBars(ticker, LOOKBACK_DAYS);
    featuresByTicker[ticker] = computeFeatures(ticker, bars, benchmarkBars);
  });
  return featuresByTicker;
}

/**
 * Mode 1: two-stage screen of the universe.
 * Stage 1a trend gate is price-only (free); we then fetch fundamentals ONLY for
 * gate-passers (saves Finnhub calls), score quality, and split into
 * enter-now (deep-analyzed) vs watchlist (listed only).
 */
async function screenerNode(state: State): Promise<Partial<State>> {
  const { fundamentals } = getProviders();
  const featuresByTicker = await fetchFeatures(UNIVERSE);

  // Stage 1a: price-only trend gate (free) — only gate-passers get fundamentals,
  // which keeps Finnhub calls far below the free-tier limit.
  const gatePassers = UNIVERSE.filter((t) => trendHealthReject(featuresByTicker[t]!) === null);
  console.log(`[screener] trend gate: ${gatePassers.length}/${UNIVERSE.length} passed → fetching fundamentals`);

  const rows = new Map<string, ScreenInputRow>();
  // Rejected-by-gate names still go into screen() (so they're counted/logged),
  // just without fundamentals.
  for (const t of UNIVERSE) rows.set(t, { features: featuresByTicker[t]! });
  await mapWithConcurrency(gatePassers, FUNDAMENTALS_CONCURRENCY, async (ticker) => {
    const [fundamental, valuation] = await Promise.all([
      fundamentals.getFundamentals(ticker),
      fundamentals.getValuation(ticker),
    ]);
    rows.set(ticker, { features: featuresByTicker[ticker]!, fundamental, valuation });
  });

  const topN = state.topN ?? DEFAULT_TOP_N;
  const result = screen(rows, topN);
  console.log(
    `[screener] universe ${UNIVERSE.length} | enterNow ${result.enterNow.length} | watchlist ${result.watchlist.length} | rejected ${result.rejected.length}`,
  );
  console.log(
    `[screener] 進場 top ${result.enterNow.length}: ${result.enterNow.map((c) => `${c.ticker}(q${c.qualityScore ?? "?"})`).join(", ") || "(none)"}`,
  );
  console.log(
    `[screener] 觀察(漲多): ${result.watchlist.map((c) => `${c.ticker}(q${c.qualityScore ?? "?"})`).join(", ") || "(none)"}`,
  );
  if (result.unfilteredForEarnings) {
    console.log("[screener] NOTE: earnings-date proximity filter NOT applied.");
  }

  const candidates = result.enterNow.map((c) => c.ticker);
  const screenScores: Record<string, ScoredCandidate> = {};
  for (const c of [...result.enterNow, ...result.watchlist]) screenScores[c.ticker] = c;
  return { candidates, featuresByTicker, screenScores, watchlist: result.watchlist };
}

/** Mode 2: analyze user-provided tickers, skipping the screen entirely. */
async function loadProvidedNode(state: State): Promise<Partial<State>> {
  const requested = state.inputTickers ?? [];
  const featuresByTicker = await fetchFeatures(requested);

  // Drop tickers we couldn't get price data for, but say so — never silently.
  const candidates = requested.filter((t) => featuresByTicker[t]?.lastClose != null);
  const dropped = requested.filter((t) => !candidates.includes(t));
  if (dropped.length > 0) {
    console.log(`[analyze] no price data, skipped: ${dropped.join(", ")}`);
  }
  console.log(`[analyze] analyzing ${candidates.length}: ${candidates.join(", ") || "(none)"}`);
  return { candidates, featuresByTicker };
}

/** Run all per-ticker research agents for the screened candidates. */
async function researchNode(state: State): Promise<Partial<State>> {
  const { fundamentals, news, sentiment } = getProviders();
  const regime = state.marketRegime!;
  const monthYear = monthYearLabel(state.date);
  const agentResults: Record<string, AgentResults> = {};
  const riskResults: Record<string, RiskPrecheckResult> = {};
  const recommendations: Recommendation[] = [];

  await mapWithConcurrency(state.candidates, AGENT_CONCURRENCY, async (ticker) => {
    const features = state.featuresByTicker[ticker]!;

    // Independent reads in parallel.
    const [technical, fundamental, valuation, newsRes] = await Promise.all([
      runTechnicalAgent(features),
      fundamentals.getFundamentals(ticker).then(runFundamentalAgent),
      fundamentals.getValuation(ticker).then(runValuationAgent),
      news.getRecentNews(ticker, 10).then((items) => runNewsAgent(ticker, items)),
    ]);

    const prior: AgentResults = { technical, fundamental, valuation, news: newsRes };
    // Deterministic trade plan from the technical strategy + real indicators.
    const tradePlan = buildTradePlan(features, technical.entryStrategy);
    prior.tradePlan = tradePlan;

    // Bull/bear depend on the reads above.
    const [bull, bear] = await Promise.all([
      runBullCaseAgent(ticker, prior),
      runBearCaseAgent(ticker, prior),
    ]);
    prior.bull = bull;
    prior.bear = bear;

    const risk = await runRiskPrecheckAgent(ticker, prior, regime, features.lastClose);
    const verdict = await runResearchAggregator(ticker, prior, risk, regime, tradePlan);

    // Market validation: only for actionable (buy/buy_on_pullback) calls —
    // search the web and check whether the market agrees with us.
    if (verdict.recommendation === "buy" || verdict.recommendation === "buy_on_pullback") {
      prior.sentiment = await runMarketSentimentAgent(
        ticker,
        verdict.recommendation,
        verdict.thesis,
        sentiment,
        monthYear,
      );
      console.log(`[sentiment] ${ticker}: market ${prior.sentiment.marketView} → ${prior.sentiment.alignment} with us`);
    }

    // Merge LLM judgment with formula-derived prices into the final rec.
    const rec: Recommendation = {
      ...verdict,
      entryStrategy: tradePlan.entryStrategy,
      entryLow: tradePlan.entryLow,
      entryHigh: tradePlan.entryHigh,
      doNotChaseAbove: tradePlan.doNotChaseAbove,
      stopLoss: tradePlan.stopLoss,
      takeProfit: tradePlan.takeProfit,
      riskReward: tradePlan.riskReward,
    };

    agentResults[ticker] = prior;
    riskResults[ticker] = risk;
    recommendations.push(rec);
    console.log(`[research] ${ticker}: ${rec.recommendation} (confidence ${rec.confidence})`);
  });

  return { agentResults, riskResults, recommendations };
}

async function writeReportNode(state: State): Promise<Partial<State>> {
  // Analyze-mode reports go to research/analysis/ so they don't overwrite the
  // dated screening recommendation; filename includes the tickers analyzed.
  const isAnalyze = state.mode === "analyze";
  const reportPath = await writeRecommendationReport({
    date: state.date,
    regime: state.marketRegime!,
    recommendations: state.recommendations ?? [],
    agentResults: state.agentResults,
    featuresByTicker: state.featuresByTicker,
    screenScores: state.screenScores,
    watchlist: isAnalyze ? [] : state.watchlist ?? [],
    subdir: isAnalyze ? "analysis" : "recommendations",
    fileName: isAnalyze ? `${state.date}_${(state.candidates ?? []).join("-")}` : state.date,
  });
  console.log(`[report] written: ${reportPath}`);
  return { reportPath };
}

/** Write a no-trade report when the regime disallows new positions. */
async function noTradeNode(state: State): Promise<Partial<State>> {
  const reportPath = await writeRecommendationReport({
    date: state.date,
    regime: state.marketRegime!,
    recommendations: [],
    agentResults: {},
  });
  console.log(`[report] risk_off / no new positions — no-trade report: ${reportPath}`);
  return { reportPath };
}

function afterRegime(state: State): "screener" | "load_provided" | "no_trade" {
  // Analyze mode always proceeds — the user explicitly asked for these names,
  // so a risk_off regime informs the analysis rather than blocking it.
  if (state.mode === "analyze") return "load_provided";
  return state.marketRegime?.allowNewPositions ? "screener" : "no_trade";
}

// --- Graph ---

export function buildResearchGraph() {
  return new StateGraph(ResearchState)
    .addNode("market_regime", marketRegimeNode)
    .addNode("screener", screenerNode)
    .addNode("load_provided", loadProvidedNode)
    .addNode("research", researchNode)
    .addNode("write_report", writeReportNode)
    .addNode("no_trade", noTradeNode)
    .addEdge(START, "market_regime")
    .addConditionalEdges("market_regime", afterRegime, {
      screener: "screener",
      load_provided: "load_provided",
      no_trade: "no_trade",
    })
    .addEdge("screener", "research")
    .addEdge("load_provided", "research")
    .addEdge("research", "write_report")
    .addEdge("write_report", END)
    .addEdge("no_trade", END)
    .compile();
}

export async function runResearch(topN = DEFAULT_TOP_N): Promise<string | undefined> {
  const graph = buildResearchGraph();
  const final = await graph.invoke({ date: easternToday(), topN, mode: "screen" });
  return final.reportPath;
}

/** Analyze a specific set of tickers, skipping the screener. */
export async function runAnalyze(tickers: string[]): Promise<string | undefined> {
  const graph = buildResearchGraph();
  const final = await graph.invoke({
    date: easternToday(),
    mode: "analyze",
    inputTickers: tickers.map((t) => t.toUpperCase()),
  });
  return final.reportPath;
}
