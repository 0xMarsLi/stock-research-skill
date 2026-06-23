/**
 * Shared deterministic core for the skill's scripts. NO LLM — pure formulas over
 * real price/fundamental data. Produces JSON the host agent reads and judges.
 *
 * This replaces the old LangGraph orchestration: the host agent's brain does the
 * analysis (technical/fundamental/valuation/news/bull-bear/aggregate) and web
 * search; we only hand it trustworthy, formula-computed numbers.
 */
import { getProviders } from "../src/services/providers/index.js";
import { UNIVERSE, BENCHMARK } from "../src/config/universe.js";
import { computeFeatures, type TechnicalFeatures } from "../src/agents/technical-features.js";
import {
  screen,
  preFetchReject,
  canslimCheck,
  type ScoredCandidate,
  type ScreenInputRow,
} from "../src/nodes/screener.node.js";
import { evaluateTrendTemplate, type TrendTemplateResult } from "../src/nodes/minervini.js";
import { buildTradePlan } from "../src/nodes/trade-plan.node.js";
import type { TradePlan } from "../src/schemas/trade-plan.schema.js";
import { weightedMomentumRaw, percentileRanks } from "../src/services/indicators.service.js";
import { mapWithConcurrency } from "../src/utils/concurrency.js";

const LOOKBACK_DAYS = 400;
const DATA_CONCURRENCY = 8;
const FUNDAMENTALS_CONCURRENCY = 4;

/** What a candidate looks like in the JSON the host agent consumes. */
export interface CandidateOutput {
  ticker: string;
  rsRating: number | null;
  trendTemplate: ScoredCandidate["trendTemplate"];
  canslimPass: boolean;
  canslimNote: string;
  bucket: ScoredCandidate["bucket"];
  pctAboveMa20: number | null;
  pullbackTo: number | null;
  tradePlan: TradePlan;
  indicators: {
    lastClose: number | null;
    ma20: number | null;
    ma50: number | null;
    ma120: number | null;
    ma150: number | null;
    ma200: number | null;
    rsi14: number | null;
    atr14: number | null;
    high52w: number | null;
    low52w: number | null;
    pctBelow52wHigh: number | null;
    pctAbove52wLow: number | null;
  };
  priceStructure: {
    resistance: number | null;
    distToResistancePct: number | null;
    support: number | null;
    distToSupportPct: number | null;
    rangeHigh: number | null;
    rangeLow: number | null;
    pctInRange: number | null;
    isConsolidating: boolean;
    nearResistance: boolean;
  };
}

/**
 * Derive the entry strategy deterministically from price structure (replaces the
 * old LLM technical agent's choice):
 *  - near/below MA20 → immediate (at support, enterable)
 *  - near resistance + consolidating → breakout (coiled below resistance)
 *  - extended above MA20 → pullback (wait)
 *  - otherwise → immediate
 */
function deriveEntryStrategy(f: TechnicalFeatures, bucket: ScoredCandidate["bucket"]): TradePlan["entryStrategy"] {
  if (bucket === "watch") return "pullback";
  if (f.nearResistance && f.isConsolidating) return "breakout";
  return "immediate";
}

interface ScoreParts {
  ticker: string;
  rsRating: number | null;
  trendTemplate: TrendTemplateResult;
  canslimPass: boolean;
  canslimNote: string;
  bucket: ScoredCandidate["bucket"];
  pctAboveMa20: number | null;
  pullbackTo: number | null;
}

function toCandidate(c: ScoreParts, f: TechnicalFeatures): CandidateOutput {
  const tradePlan = buildTradePlan(f, deriveEntryStrategy(f, c.bucket));
  return {
    ticker: c.ticker,
    rsRating: c.rsRating,
    trendTemplate: c.trendTemplate,
    canslimPass: c.canslimPass,
    canslimNote: c.canslimNote,
    bucket: c.bucket,
    pctAboveMa20: c.pctAboveMa20,
    pullbackTo: c.pullbackTo,
    tradePlan,
    indicators: {
      lastClose: f.lastClose,
      ma20: f.ma20,
      ma50: f.ma50,
      ma120: f.ma120,
      ma150: f.ma150,
      ma200: f.ma200,
      rsi14: f.rsi14,
      atr14: f.atr14,
      high52w: f.high52w,
      low52w: f.low52w,
      pctBelow52wHigh: f.pctBelow52wHigh,
      pctAbove52wLow: f.pctAbove52wLow,
    },
    priceStructure: {
      resistance: f.resistance,
      distToResistancePct: f.distToResistancePct,
      support: f.support,
      distToSupportPct: f.distToSupportPct,
      rangeHigh: f.rangeHigh,
      rangeLow: f.rangeLow,
      pctInRange: f.pctInRange,
      isConsolidating: f.isConsolidating,
      nearResistance: f.nearResistance,
    },
  };
}

/** Fetch OHLCV + compute features for a set of tickers. */
async function fetchFeatures(tickers: string[]): Promise<Record<string, TechnicalFeatures>> {
  const { marketData } = getProviders();
  const benchmarkBars = await marketData.getDailyBars(BENCHMARK, LOOKBACK_DAYS);
  const out: Record<string, TechnicalFeatures> = {};
  await mapWithConcurrency(tickers, DATA_CONCURRENCY, async (ticker) => {
    const bars = await marketData.getDailyBars(ticker, LOOKBACK_DAYS);
    out[ticker] = computeFeatures(ticker, bars, benchmarkBars);
  });
  return out;
}

export interface ScreenJson {
  mode: "screen";
  date: string;
  benchmark: string;
  universeSize: number;
  counts: { enterNow: number; watchlist: number; rejected: number };
  enterNow: CandidateOutput[];
  watchlist: CandidateOutput[];
  notes: string[];
}

/** Mode 1: screen the universe, return formula JSON (host agent does judgment). */
export async function runScreen(topN: number, date: string): Promise<ScreenJson> {
  const { fundamentals } = getProviders();
  const featuresByTicker = await fetchFeatures(UNIVERSE);

  const gatePassers = UNIVERSE.filter((t) => preFetchReject(featuresByTicker[t]!) === null);
  const rows = new Map<string, ScreenInputRow>();
  for (const t of UNIVERSE) rows.set(t, { features: featuresByTicker[t]! });
  await mapWithConcurrency(gatePassers, FUNDAMENTALS_CONCURRENCY, async (ticker) => {
    const [fundamental, valuation] = await Promise.all([
      fundamentals.getFundamentals(ticker),
      fundamentals.getValuation(ticker),
    ]);
    rows.set(ticker, { features: featuresByTicker[ticker]!, fundamental, valuation });
  });

  const result = screen(rows, topN);
  return {
    mode: "screen",
    date,
    benchmark: BENCHMARK,
    universeSize: UNIVERSE.length,
    counts: {
      enterNow: result.enterNow.length,
      watchlist: result.watchlist.length,
      rejected: result.rejected.length,
    },
    enterNow: result.enterNow.map((c) => toCandidate(c, featuresByTicker[c.ticker]!)),
    watchlist: result.watchlist.map((c) => toCandidate(c, featuresByTicker[c.ticker]!)),
    notes: [
      "Numbers are formula-computed (Minervini template, CANSLIM, RS, ATR trade plan).",
      "Host agent should judge each name (technical/fundamental/valuation/news/bull-bear) and verify against web search — see references/.",
      "Earnings-date proximity filter NOT applied.",
    ],
  };
}

export interface AnalyzeJson {
  mode: "analyze";
  date: string;
  benchmark: string;
  tickers: string[];
  skipped: string[];
  results: CandidateOutput[];
  notes: string[];
}

/** Mode 2: analyze specific tickers (skip screen). RS is computed against the
 *  FULL universe so the RS Rating is meaningful (not vs the 2 requested names).
 *  Returns ALL requested tickers, pass or fail. */
export async function runAnalyze(tickers: string[], date: string): Promise<AnalyzeJson> {
  const { fundamentals } = getProviders();
  const requested = tickers.map((t) => t.toUpperCase());

  // Fetch the requested names + the whole universe (for cross-sectional RS).
  const allTickers = [...new Set([...requested, ...UNIVERSE])];
  const featuresByTicker = await fetchFeatures(allTickers);

  const usable = requested.filter((t) => featuresByTicker[t]?.lastClose != null);
  const skipped = requested.filter((t) => !usable.includes(t));

  // Cross-sectional RS Rating over the full universe + requested names.
  const rawMomentum = new Map<string, number>();
  for (const t of allTickers) {
    const raw = weightedMomentumRaw(featuresByTicker[t]?.closeSeries ?? []);
    if (raw != null) rawMomentum.set(t, raw);
  }
  const rsRanks = percentileRanks(rawMomentum);

  // Fundamentals only for the requested (usable) names.
  const funds = new Map<string, Awaited<ReturnType<typeof fundamentals.getFundamentals>>>();
  await mapWithConcurrency(usable, FUNDAMENTALS_CONCURRENCY, async (ticker) => {
    funds.set(ticker, await fundamentals.getFundamentals(ticker));
  });

  const results: CandidateOutput[] = [];
  for (const t of usable) {
    const f = featuresByTicker[t]!;
    const rsRating = rsRanks.get(t) ?? null;
    const trendTemplate = evaluateTrendTemplate(f, rsRating);
    const cans = canslimCheck(funds.get(t));
    const pctAboveMa20 =
      f.ma20 != null && f.ma20 > 0 && f.lastClose != null
        ? Math.round((f.lastClose / f.ma20 - 1) * 1000) / 10
        : null;
    const extended = pctAboveMa20 != null && pctAboveMa20 > 8;
    results.push(
      toCandidate(
        {
          ticker: t,
          rsRating,
          trendTemplate,
          canslimPass: cans.pass,
          canslimNote: cans.note,
          bucket: extended ? "watch" : "enter_now",
          pctAboveMa20,
          pullbackTo: extended && f.ma20 != null ? Math.round(f.ma20 * 100) / 100 : null,
        },
        f,
      ),
    );
  }

  return {
    mode: "analyze",
    date,
    benchmark: BENCHMARK,
    tickers: requested,
    skipped,
    results,
    notes: [
      "Numbers are formula-computed. Host agent does the judgment + web verification (see references/).",
      "RS Rating is computed vs the full S&P 500 universe. Requested tickers are returned pass or fail.",
    ],
  };
}
