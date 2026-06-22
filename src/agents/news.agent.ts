import { structuredCall } from "../config/llm.js";
import { NewsSchema, type NewsResult } from "../schemas/agent-output.schema.js";
import type { NewsItem } from "../services/providers/news.provider.js";

const SYSTEM = `You are a markets news analyst. Summarize sentiment and flag any
material risk events (downgrades, guidance cuts, regulatory/legal, accounting).
If there are no headlines, set dataAvailable=false, sentiment=neutral, and a
neutral score (~50). Score 0-100 reflects news sentiment for the stock.`;

export async function runNewsAgent(
  ticker: string,
  items: NewsItem[],
): Promise<NewsResult> {
  const dataAvailable = items.length > 0;
  const headlines = dataAvailable
    ? items
        .map((n, i) => `${i + 1}. [${n.date}] ${n.headline}${n.summary ? ` — ${n.summary}` : ""}`)
        .join("\n")
    : "(no recent headlines available)";

  const user = `Ticker: ${ticker}
Recent headlines:
${headlines}

Assess sentiment, a 0-100 score, a short summary, and list any risk events.
Set dataAvailable=${dataAvailable}.`;

  return structuredCall<NewsResult>(NewsSchema, SYSTEM, user, "NewsRead");
}
