import { structuredCall } from "../config/llm.js";
import { BearCaseSchema, type BearCaseResult } from "../schemas/agent-output.schema.js";
import type { AgentResults } from "../schemas/agent-output.schema.js";
import { summarize } from "./bull-case.agent.js";

const SYSTEM = `You are a skeptical analyst (think deep-value contrarian). Build the
bear case: concrete, specific reasons to avoid or be cautious — valuation risk,
deteriorating fundamentals, technical breakdown risk, concentration/macro risk,
news risk. Be rigorous, not reflexively negative. 2-5 bullet points.`;

export async function runBearCaseAgent(
  ticker: string,
  prior: AgentResults,
): Promise<BearCaseResult> {
  const user = `Ticker: ${ticker}
${summarize(prior)}

List the strongest bear-case points.`;
  return structuredCall<BearCaseResult>(BearCaseSchema, SYSTEM, user, "BearCase");
}
