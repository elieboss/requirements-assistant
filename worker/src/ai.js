// The only place that talks to Claude. The API key comes from the Worker's secret store (env),
// never from the browser.

import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA, ANALYSIS_SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { TEST_CASE_SCHEMA, TEST_CASE_SYSTEM_PROMPT, buildTestCaseMessage } from "./testCasePrompt.js";

export const MODEL = "claude-opus-5-5";

export class AnalysisError extends Error {}

// Sends one request and returns the JSON answer, which must match `schema`.
async function askClaude(apiKey, { system, userMessage, schema }) {
  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      // If a safety check declines the request, the API retries it on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AnalysisError("The AI key on the server was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new AnalysisError("The AI service is busy. Try again in a minute.");
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AnalysisError("The AI took too long to respond.");
    if (error instanceof Anthropic.APIError) throw new AnalysisError(`The AI service returned an error (${error.status ?? "no status"}).`);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new AnalysisError("The AI declined this request.");
  if (response.stop_reason === "max_tokens") throw new AnalysisError("The AI's answer was cut off. Try a shorter request.");

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new AnalysisError("The AI's answer was not in the expected format.");
  }
}

export function draftAnalysis(apiKey, sentences) {
  return askClaude(apiKey, {
    system: ANALYSIS_SYSTEM_PROMPT,
    userMessage: buildUserMessage(sentences),
    schema: ANALYSIS_SCHEMA,
  });
}

export function draftTestCase(apiKey, input) {
  return askClaude(apiKey, {
    system: TEST_CASE_SYSTEM_PROMPT,
    userMessage: buildTestCaseMessage(input),
    schema: TEST_CASE_SCHEMA,
  });
}
