import { getModel } from "../../config/llm.js";

/**
 * Abstraction over "fetch market commentary from the web". Lets us swap the
 * search backend (Gemini grounding now; Tavily/others later) without touching
 * the sentiment agent. The provider only retrieves text + sources — it does NOT
 * interpret them (that's the agent's job).
 */
export interface SearchSource {
  title: string;
  url: string;
}

export interface SearchResult {
  text: string;
  sources: SearchSource[];
  /** false when search was unavailable/failed → agent degrades gracefully. */
  available: boolean;
}

export interface MarketSentimentProvider {
  search(query: string): Promise<SearchResult>;
}

/** Resolve a grounding-redirect or plain URL host for display. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Gemini built-in Google Search grounding. NOTE: confirmed by smoke test that
 * this model accepts the `googleSearch` tool (not the older
 * `googleSearchRetrieval`, which 400s on gemini 2.x+/3.x). Grounding and
 * structured output are mutually exclusive, so this returns raw text + sources
 * and the agent does a separate structured extraction pass.
 */
export class GeminiGroundedSearchProvider implements MarketSentimentProvider {
  async search(query: string): Promise<SearchResult> {
    try {
      const model = getModel().bindTools([{ googleSearch: {} } as never]);
      const res = (await model.invoke(query)) as {
        content: unknown;
        response_metadata?: { groundingMetadata?: GroundingMetadata };
        additional_kwargs?: { groundingMetadata?: GroundingMetadata };
      };
      const text =
        typeof res.content === "string" ? res.content : JSON.stringify(res.content);
      const meta =
        res.response_metadata?.groundingMetadata ??
        res.additional_kwargs?.groundingMetadata;
      const sources: SearchSource[] = (meta?.groundingChunks ?? [])
        .map((c) => c.web)
        .filter((w): w is { uri: string; title?: string } => !!w?.uri)
        .map((w) => ({ title: w.title ?? hostOf(w.uri), url: w.uri }));

      if (!text.trim()) return { text: "", sources, available: false };
      return { text, sources, available: true };
    } catch (err) {
      console.warn(`[sentiment] grounded search failed: ${String(err)}`);
      return { text: "", sources: [], available: false };
    }
  }
}

interface GroundingMetadata {
  groundingChunks?: Array<{ web?: { uri: string; title?: string } }>;
}
