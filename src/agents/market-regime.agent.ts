import { structuredCall } from "../config/llm.js";
import { MarketRegimeSchema, type MarketRegimeResult } from "../schemas/market.schema.js";
import { getProviders } from "../services/providers/index.js";
import { REGIME_TICKERS } from "../config/universe.js";
import { sma, closesOf } from "../services/indicators.service.js";
import type { OhlcvBar } from "../schemas/market.schema.js";

const SYSTEM = `You are a macro/market-regime strategist for US equities.
Classify the environment as risk_on, neutral, or risk_off and decide whether new
long positions should be opened, plus a max equity exposure %. Be cautious:
deteriorating breadth, rising VIX, rising 10Y yields, or major indices below
their 50/200-day MAs argue for risk_off and disallowing new positions.`;

/**
 * Assesses overall market regime from SPY/QQQ trend, VIX, and 10Y yield.
 * Gates the rest of the research flow (risk_off -> no new positions).
 */
export async function runMarketRegimeAgent(): Promise<MarketRegimeResult> {
  const { marketData } = getProviders();
  const [spy, qqq] = await Promise.all([
    marketData.getDailyBars(REGIME_TICKERS.spy, 320),
    marketData.getDailyBars(REGIME_TICKERS.qqq, 320),
  ]);
  // VIX / TNX are best-effort (some feeds reject ^-prefixed symbols).
  const [vix, tnx] = await Promise.all([
    marketData.getQuote(REGIME_TICKERS.vix),
    marketData.getQuote(REGIME_TICKERS.tnx),
  ]);

  const user = `SPY: ${trendLine(spy)}
QQQ: ${trendLine(qqq)}
VIX: ${vix == null ? "N/A" : vix.toFixed(2)}
10Y yield (^TNX/10): ${tnx == null ? "N/A" : (tnx / 10).toFixed(2) + "%"}

Classify the regime, set allowNewPositions, and a maxEquityExposurePct (0-100).`;

  return structuredCall<MarketRegimeResult>(
    MarketRegimeSchema,
    SYSTEM,
    user,
    "MarketRegime",
  );
}

function trendLine(bars: OhlcvBar[]): string {
  if (bars.length === 0) return "N/A (no data)";
  const closes = closesOf(bars);
  const last = closes.at(-1)!;
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  return `last ${last.toFixed(2)}, MA50 ${fmt(ma50)}, MA200 ${fmt(ma200)} (${
    ma50 != null && ma200 != null
      ? last > ma50 && ma50 > ma200
        ? "uptrend"
        : last < ma50
          ? "below MA50"
          : "mixed"
      : "insufficient history"
  })`;
}

function fmt(v: number | null): string {
  return v == null ? "N/A" : v.toFixed(2);
}
