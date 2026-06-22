import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Recommendation } from "../schemas/recommendation.schema.js";
import type { MarketRegimeResult } from "../schemas/market.schema.js";
import type { AgentResults } from "../schemas/agent-output.schema.js";
import type { MarketSentimentResult } from "../schemas/market-sentiment.schema.js";
import type { ScoredCandidate } from "./screener.node.js";

export interface ReportInput {
  date: string;
  regime: MarketRegimeResult;
  recommendations: Recommendation[];
  agentResults: Record<string, AgentResults>;
  screenScores?: Record<string, ScoredCandidate>;
  /** Good stocks too extended to enter now — listed as a watchlist (not analyzed). */
  watchlist?: ScoredCandidate[];
  /** Subfolder under research/ to write into (default "recommendations"). */
  subdir?: string;
  /** Filename without extension (default = date). */
  fileName?: string;
}

/** 中文標籤對照表（enum 代碼維持英文以利解析，僅顯示時翻譯）。 */
const REGIME_LABEL: Record<MarketRegimeResult["marketRegime"], string> = {
  risk_on: "偏多 (risk_on)",
  neutral: "中性 (neutral)",
  risk_off: "偏空 (risk_off)",
};

const ACTION_LABEL: Record<Recommendation["recommendation"], string> = {
  buy: "買進",
  buy_on_pullback: "回檔買進",
  watch: "觀察",
  avoid: "避開",
  no_trade: "不交易",
};

const SIGNAL_LABEL: Record<string, string> = {
  bullish: "偏多",
  neutral: "中性",
  bearish: "偏空",
  positive: "正向",
  negative: "負向",
  cheap: "便宜",
  fair: "合理",
  fair_to_expensive: "合理偏貴",
  expensive: "偏貴",
  neutral_positive: "中性偏正",
};

const STRATEGY_LABEL: Record<string, string> = {
  immediate: "立即進場",
  pullback: "回檔進場",
  breakout: "突破進場",
  avoid: "暫不進場",
};

const label = (map: Record<string, string>, key: string): string => map[key] ?? key;

/** Renders the research recommendation markdown (PRD 6.6) and writes it to disk. */
export async function writeRecommendationReport(input: ReportInput): Promise<string> {
  const md = renderReport(input);
  const path = resolve(
    process.cwd(),
    "research",
    input.subdir ?? "recommendations",
    `${input.fileName ?? input.date}.md`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, md, "utf8");
  return path;
}

export function renderReport(input: ReportInput): string {
  const { date, regime, recommendations, agentResults, screenScores } = input;
  const watchlist = input.watchlist ?? [];
  const buyable = recommendations.filter(
    (r) => r.recommendation === "buy" || r.recommendation === "buy_on_pullback",
  );

  const frontmatter = [
    "---",
    `date: ${date}`,
    `marketRegime: ${regime.marketRegime}`,
    `allowNewPositions: ${regime.allowNewPositions}`,
    `maxEquityExposurePct: ${regime.maxEquityExposurePct}`,
    `candidateCount: ${recommendations.length}`,
    `buyableCount: ${buyable.length}`,
    `watchlistCount: ${watchlist.length}`,
    "---",
  ].join("\n");

  const parts: string[] = [
    frontmatter,
    "",
    `# 研究推薦報告 — ${date}`,
    "",
    "## 市場觀點",
    "",
    `- 市場狀態：**${label(REGIME_LABEL, regime.marketRegime)}**`,
    `- 允許新進場：${regime.allowNewPositions ? "是" : "否"}`,
    `- 建議股票曝險上限：${regime.maxEquityExposurePct}%`,
    `- 理由：${regime.reason}`,
    "",
  ];

  if (recommendations.length === 0 && watchlist.length === 0) {
    parts.push(
      "## 不交易 (No Trade)",
      "",
      "今日無標的通過篩選 / 風險預檢，或市場狀態不允許新進場。",
      "",
    );
    return parts.join("\n");
  }

  // 區塊一：適合現在進場（深入分析）
  if (recommendations.length > 0) {
    parts.push("## ✅ 適合現在進場（深入分析）", "");
    parts.push(...renderOverviewTable(recommendations));
    for (const rec of recommendations) {
      parts.push(...renderCandidate(rec, agentResults[rec.ticker], screenScores?.[rec.ticker]));
    }
  }

  // 區塊二：好股·等回檔（觀察名單，尚未深度分析）
  if (watchlist.length > 0) {
    parts.push(...renderWatchlist(watchlist));
  }

  return parts.join("\n");
}

/** 格式化「現價相對 MA20」的乖離百分比，含正確正負號。 */
function fmtVsMa20(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : ""; // 負數本身帶 -，不再加 +
  return `${sign}${pct}%`;
}

/**
 * 觀察名單：體質通過篩選的好股票，分兩群——
 *  (a) 可進場但排名在前 N 之外（貼近 MA20，未深度分析）
 *  (b) 漲多、需等回檔（乖離 MA20 過大）
 * 皆僅輕量列出，未跑深度分析。
 */
function renderWatchlist(watchlist: ScoredCandidate[]): string[] {
  const enterableOverflow = watchlist.filter((c) => c.bucket === "enter_now");
  const extended = watchlist.filter((c) => c.bucket === "watch");
  const out: string[] = ["## 👀 觀察名單（體質佳，未深度分析）", ""];

  if (enterableOverflow.length > 0) {
    out.push(
      "### 可進場・排名前 5 以外",
      "",
      "體質好、現價也貼近均線可進場，但本次深度分析名額有限未納入。需要時用 `analyze <代號>` 深入評估。",
      "",
      "| 標的 | 品質分 | 現價vsMA20 |",
      "|---|---|---|",
      ...enterableOverflow.map((c) => `| ${c.ticker} | ${c.qualityScore ?? "—"} | ${fmtVsMa20(c.pctAboveMa20)} |`),
      "",
    );
  }

  if (extended.length > 0) {
    out.push(...renderExtendedWatch(extended));
  }
  return out;
}

/** (b) 漲多·等回檔。 */
function renderExtendedWatch(watchlist: ScoredCandidate[]): string[] {
  const rows = watchlist.map(
    (c) =>
      `| ${c.ticker} | ${c.qualityScore ?? "—"} | ${fmtVsMa20(c.pctAboveMa20)} | ${c.pullbackTo ?? "—"} |`,
  );
  return [
    "### 漲多·等回檔",
    "",
    "體質通過篩選、但目前股價乖離均線過大（漲多）的好股票。建議等回檔至參考價附近，再用 `analyze <代號>` 深入評估。",
    "",
    "| 標的 | 品質分 | 高於MA20 | 回檔參考價(MA20) |",
    "|---|---|---|---|",
    ...rows,
    "",
  ];
}

/** 全部候選一眼總覽表。 */
function renderOverviewTable(recs: Recommendation[]): string[] {
  const rows = recs.map(
    (r) =>
      `| ${r.ticker} | ${label(ACTION_LABEL, r.recommendation)} | ${r.confidence} | ` +
      `${label(STRATEGY_LABEL, r.entryStrategy)} | ${r.entryLow}–${r.entryHigh} | ${r.stopLoss} | ${r.takeProfit} | ${r.suggestedPositionPct}% |`,
  );
  return [
    "## 候選總覽",
    "",
    "| 標的 | 建議動作 | 信心 | 進場策略 | 進場區 | 停損 | 停利 | 建議倉位 |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "> 進場區 / 停損 / 停利為依真實 ATR、均線以公式計算（非 LLM 生成）。",
    "",
  ];
}

function renderCandidate(
  rec: Recommendation,
  agents: AgentResults | undefined,
  screen: ScoredCandidate | undefined,
): string[] {
  const lines: string[] = [
    `### ${rec.ticker} — ${label(ACTION_LABEL, rec.recommendation)}（信心 ${rec.confidence}）`,
    "",
    "#### 結論",
    "",
    rec.thesis,
    "",
  ];

  // 為什麼這檔入選（兩階段篩選明細）。
  if (screen) {
    const prox = screen.pctAboveMa20 == null
      ? "—"
      : screen.pctAboveMa20 <= 0
        ? `貼近/低於 MA20（${screen.pctAboveMa20}%）`
        : `高於 MA20 ${screen.pctAboveMa20}%`;
    lines.push(
      "#### 入選理由（兩階段篩選）",
      "",
      `品質分 **${screen.qualityScore ?? "—"}**　｜　進場接近度 ${screen.entryProximity}（${prox}）`,
      "",
      "> 由科技股池先篩「好股票」（趨勢健康 + 品質：獲利/成長/估值），再依進場時機分類。此檔屬「貼近支撐、適合現在進場」。",
      "",
    );
  }

  lines.push(
    "#### 交易計畫（公式計算）",
    "",
    "| 項目 | 數值 |",
    "|---|---|",
    `| 建議動作 | ${label(ACTION_LABEL, rec.recommendation)} |`,
    `| 進場策略 | ${label(STRATEGY_LABEL, rec.entryStrategy)} |`,
    `| 進場區間 | ${rec.entryLow} – ${rec.entryHigh} |`,
    `| 不追高於 | ${rec.doNotChaseAbove} |`,
    `| 停損 | ${rec.stopLoss} |`,
    `| 停利 | ${rec.takeProfit} |`,
    `| 風報比 (R:R) | ${rec.riskReward} |`,
    `| 建議倉位 | ${rec.suggestedPositionPct}% |`,
    "",
  );

  // 技術指標（實算）— 數字直接來自 OHLCV 計算，供對照交易計畫。
  const plan = agents?.tradePlan;
  if (plan) {
    lines.push(
      "#### 技術指標（實算）",
      "",
      "| 指標 | 數值 |",
      "|---|---|",
      `| 現價 | ${plan.refClose} |`,
      `| MA20 | ${plan.refMa20 ?? "N/A"} |`,
      `| MA50 | ${plan.refMa50 ?? "N/A"} |`,
      `| ATR(14) | ${plan.refAtr ?? "N/A"} |`,
      "",
    );
    if (plan.degraded) {
      lines.push("> ⚠️ 指標資料不足，交易計畫以百分比備援公式估算，請謹慎參考。", "");
    }
  }

  if (agents) {
    lines.push(
      "#### 各面向評分",
      "",
      "| 面向 | 評分 | 判讀 | 摘要 |",
      "|---|---|---|---|",
    );
    if (agents.technical)
      lines.push(
        `| 技術面 | ${agents.technical.score} | ${label(SIGNAL_LABEL, agents.technical.signal)} | ${cell(agents.technical.trend)} |`,
      );
    if (agents.fundamental)
      lines.push(
        `| 基本面 | ${agents.fundamental.score} | ${label(SIGNAL_LABEL, agents.fundamental.signal)} | ${cell(agents.fundamental.thesis)} |`,
      );
    if (agents.valuation)
      lines.push(
        `| 估值面 | ${agents.valuation.score} | ${label(SIGNAL_LABEL, agents.valuation.valuationView)} | ${cell(agents.valuation.reason)} |`,
      );
    if (agents.news)
      lines.push(
        `| 消息面 | ${agents.news.score} | ${label(SIGNAL_LABEL, agents.news.sentiment)} | ${cell(agents.news.summary)} |`,
      );
    lines.push("");

    // 技術面進場理由與失效條件（敘述，不含自報數字）。
    if (agents.technical) {
      lines.push(
        "**技術面進場理由**：" + agents.technical.entryRationale,
        "",
        "**技術面失效條件**：" + agents.technical.invalidIf,
        "",
      );
    }
  }

  lines.push("#### 看多理由", "");
  lines.push(...bullets(rec.bullCase));
  lines.push("", "#### 看空理由", "");
  lines.push(...bullets(rec.bearCase));
  lines.push("", "#### 失效條件（thesis invalidation）", "");
  lines.push(...bullets(rec.invalidConditions));

  // 市場討論（網路驗證）— 市場是否認同我們的判斷。
  if (agents?.sentiment) {
    lines.push("", ...renderSentiment(agents.sentiment, rec.recommendation));
  }

  lines.push("", "---", "");
  return lines;
}

const MARKET_VIEW_LABEL: Record<string, string> = {
  bullish: "偏多",
  mixed: "分歧",
  bearish: "偏空",
};
const ALIGNMENT_LABEL: Record<string, string> = {
  agree: "✅ 附和我們",
  mixed: "🟡 部分分歧",
  disagree: "⚠️ 與我們相左",
};

/** 市場討論區塊：市場觀點 + 與我們判斷的對照 + 重點 + 來源連結。 */
function renderSentiment(s: MarketSentimentResult, ourRec: string): string[] {
  if (!s.dataAvailable) {
    return ["#### 市場討論（網路驗證）", "", "> 無法取得市場討論資料（搜尋失敗或無結果）。"];
  }
  const out = [
    "#### 市場討論（網路驗證）",
    "",
    `- 市場觀點：**${label(MARKET_VIEW_LABEL, s.marketView)}**　｜　vs 我們的「${label(ACTION_LABEL, ourRec)}」：**${label(ALIGNMENT_LABEL, s.alignment)}**`,
    "",
    s.summary,
    "",
  ];
  if (s.keyPoints.length > 0) {
    out.push("市場重點：", ...bullets(s.keyPoints), "");
  }
  const sources = s.sources ?? [];
  if (sources.length > 0) {
    out.push("來源：", ...sources.slice(0, 6).map((src) => `- [${src.title}](${src.url})`));
  }
  return out;
}

/** 表格儲存格：移除換行、跳脫 pipe，避免破壞表格。 */
function cell(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function bullets(items: string[]): string[] {
  return items.length ? items.map((i) => `- ${i}`) : ["- （無）"];
}
