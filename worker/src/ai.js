// The only place that talks to Claude. The API key comes from the Worker's secret store (env),
// never from the browser.

import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA, ANALYSIS_SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { TEST_CASE_SCHEMA, TEST_CASE_SYSTEM_PROMPT, buildTestCaseMessage } from "./testCasePrompt.js";

export const MODEL = "claude-opus-5-5";

export class AnalysisError extends Error {}

// Sections of the analysis in the order Claude writes them, and how to count finished items in each.
export const SECTIONS = [
  { key: "requirements", id: "REQ-" },
  { key: "stakeholders", id: "STK-" },
  { key: "openQuestions", id: "Q-" },
  { key: "userStories", id: "STORY-" },
  { key: "acceptanceCriteria", id: "AC-" },
];

// Reads the partial JSON written so far: which section is being written and how many items each has.
function progressFrom(snapshot) {
  const counts = {};
  let section = null;
  let furthest = -1;
  for (const { key, id } of SECTIONS) {
    counts[key] = (snapshot.match(new RegExp(`"id"\\s*:\\s*"${id}`, "g")) ?? []).length;
    const at = snapshot.search(new RegExp(`"${key}"\\s*:`));
    if (at > furthest) { furthest = at; section = key; }
  }
  return { counts, section: furthest >= 0 ? section : null };
}

function translateError(error) {
  if (error instanceof Anthropic.APIUserAbortError) return new AnalysisError("The analysis was cancelled.");
  if (error instanceof Anthropic.AuthenticationError) return new AnalysisError("The AI key on the server was rejected.");
  if (error instanceof Anthropic.RateLimitError) return new AnalysisError("The AI service is busy. Try again in a minute.");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AnalysisError("The AI took too long to respond.");
  if (error instanceof Anthropic.APIError) return new AnalysisError(`The AI service returned an error (${error.status ?? "no status"}).`);
  return error;
}

// Sends one request and returns the JSON answer, which must match `schema`.
// With `onProgress`, the answer is streamed and progress is reported as it is written.
async function askClaude({ apiKey, baseURL }, { system, userMessage, schema, onProgress, signal }) {
  // baseURL is normally unset; local tests point it at a stand-in server.
  const client = new Anthropic({ apiKey, baseURL: baseURL || undefined, timeout: 120_000, maxRetries: 1 });
  const params = {
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
  };

  let response;
  try {
    if (onProgress) {
      const stream = client.beta.messages.stream(params, { signal });
      let last = "";
      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "thinking") onProgress({ phase: "thinking" });
      });
      stream.on("text", (_delta, snapshot) => {
        const progress = progressFrom(snapshot);
        const key = JSON.stringify(progress);
        if (key !== last) { last = key; onProgress({ phase: "writing", ...progress }); }
      });
      response = await stream.finalMessage();
    } else {
      response = await client.beta.messages.create(params, { signal });
    }
  } catch (error) {
    throw translateError(error);
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

export function draftAnalysis(connection, sentences, { onProgress, signal } = {}) {
  return askClaude(connection, {
    system: ANALYSIS_SYSTEM_PROMPT,
    userMessage: buildUserMessage(sentences),
    schema: ANALYSIS_SCHEMA,
    onProgress,
    signal,
  });
}

export function draftTestCase(connection, input, { signal } = {}) {
  return askClaude(connection, {
    system: TEST_CASE_SYSTEM_PROMPT,
    userMessage: buildTestCaseMessage(input),
    schema: TEST_CASE_SCHEMA,
    signal,
  });
}
