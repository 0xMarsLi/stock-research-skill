import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { InteropZodType } from "@langchain/core/utils/types";
import { loadEnv } from "./env.js";

/**
 * Single place that constructs the Gemini chat model and runs structured calls.
 * Keeps model id / temperature / retries consistent across every agent.
 */

let model: ChatGoogleGenerativeAI | null = null;

export function getModel(): ChatGoogleGenerativeAI {
  if (model) return model;
  const env = loadEnv();
  model = new ChatGoogleGenerativeAI({
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
    temperature: 0.2,
    maxRetries: 2,
  });
  return model;
}

/**
 * Invoke Gemini and return a value validated against a Zod schema.
 *
 * Uses the `jsonSchema` method (constrains generation directly — more reliable
 * than function-calling on Gemini). Schemas MUST have explicit fields; Gemini
 * rejects open records.
 */
/**
 * Language directive appended to every system prompt. Free-text fields are
 * written in Traditional Chinese; enum/constrained fields stay as their schema
 * values (English) so downstream parsing and the markdown label maps still work.
 */
const LANGUAGE_DIRECTIVE =
  "請以繁體中文（台灣用語）撰寫所有敘述性文字欄位（如 thesis、reason、summary、trend、" +
  "entryRationale、invalidIf、notes、bullCase、bearCase、risk、invalidConditions 等）。" +
  "但列舉型欄位（signal、recommendation、valuationView、sentiment、marketRegime 等）" +
  "必須維持原本的英文代碼，不要翻譯。";

export async function structuredCall<T extends Record<string, unknown>>(
  schema: InteropZodType<T>,
  systemPrompt: string,
  userPrompt: string,
  name: string,
): Promise<T> {
  const structured = getModel().withStructuredOutput<T>(schema, {
    name,
    method: "jsonSchema",
  });
  return structured.invoke([
    { role: "system", content: `${systemPrompt}\n\n${LANGUAGE_DIRECTIVE}` },
    { role: "user", content: userPrompt },
  ]);
}
