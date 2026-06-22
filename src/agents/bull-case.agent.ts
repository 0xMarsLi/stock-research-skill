import { structuredCall } from "../config/llm.js";
import { BullCaseSchema, type BullCaseResult } from "../schemas/agent-output.schema.js";
import type { AgentResults } from "../schemas/agent-output.schema.js";

const SYSTEM = `You build the bull case for a stock: concrete, specific reasons to
buy, grounded in the technical/fundamental/valuation/news reads provided. Avoid
generic platitudes. 2-5 bullet points.`;

export async function runBullCaseAgent(
  ticker: string,
  prior: AgentResults,
): Promise<BullCaseResult> {
  const user = `Ticker: ${ticker}
${summarize(prior)}

List the strongest bull-case points.`;
  return structuredCall<BullCaseResult>(BullCaseSchema, SYSTEM, user, "BullCase");
}

export function summarize(p: AgentResults): string {
  const lines: string[] = [];
  if (p.technical)
    lines.push(`Technical: ${p.technical.signal} (${p.technical.score}) — ${p.technical.trend}`);
  if (p.fundamental)
    lines.push(`Fundamental: ${p.fundamental.signal} (${p.fundamental.score}) — ${p.fundamental.thesis}`);
  if (p.valuation)
    lines.push(`Valuation: ${p.valuation.valuationView} (${p.valuation.score}) — ${p.valuation.reason}`);
  if (p.news)
    lines.push(`News: ${p.news.sentiment} (${p.news.score}) — ${p.news.summary}`);
  return lines.join("\n") || "(no prior agent reads)";
}
