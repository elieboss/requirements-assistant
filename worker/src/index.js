// Cloudflare Worker: the server side of the Requirements Assistant.
// It serves the built React app and handles POST /api/analyze and POST /api/testcase.
// The browser sends the request text here; only this server calls the AI, so the API key stays private.

import { sampleRequest } from "../../shared/sampleRequest.js";
import { sampleResults } from "../../shared/sampleResults.js";
import { sampleTestCase } from "../../shared/sampleTestCase.js";
import { splitSentences } from "../../shared/sentences.js";
import { AnalysisError, draftAnalysis, draftTestCase } from "./ai.js";
import { validateAnalysis } from "./validate.js";

const MAX_REQUEST_CHARS = 6000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function analyze(request, env) {
  let text;
  try {
    ({ text } = await request.json());
  } catch {
    return json({ error: "Send JSON like {\"text\": \"...\"}." }, 400);
  }
  if (typeof text !== "string" || !text.trim()) {
    return json({ error: "The request text is empty." }, 400);
  }
  if (text.length > MAX_REQUEST_CHARS) {
    return json({ error: `Keep the request under ${MAX_REQUEST_CHARS} characters for this demo.` }, 413);
  }

  // The server numbers the sentences, so citations always point at text it has seen.
  const sentences = splitSentences(text.trim());
  const isSample = text.trim() === sampleRequest.body;
  const sampleFallback = (reason) =>
    json({ sentences, results: { ...sampleResults, generatedBy: "sample-fallback", fallbackReason: reason } });

  if (!env.ANTHROPIC_API_KEY) {
    if (isSample) return sampleFallback("The AI key is not set up on the server.");
    return json({ error: "The AI key is not set up on the server, so only the sample request can be analyzed." }, 503);
  }

  try {
    const raw = await draftAnalysis(env.ANTHROPIC_API_KEY, sentences);
    return json({ sentences, results: validateAnalysis(raw, sentences) });
  } catch (error) {
    const reason = error instanceof AnalysisError ? error.message : "The AI request failed unexpectedly.";
    console.error("analysis failed:", error);
    // In a live demo, the sample request still shows a result, clearly labelled as the pre-written fallback.
    if (isSample) return sampleFallback(reason);
    return json({ error: `${reason} Your request was not analyzed.` }, 502);
  }
}

// Optional step: one approved acceptance criterion in, one draft test case out.
// The trace links (criterion, requirement, sentences) are attached here by code, not by the AI.
async function testCase(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Send JSON with criterion, requirement, sentences and questions." }, 400);
  }
  const { criterion, requirement, sentences = [], questions = [] } = input ?? {};
  const isText = (v) => typeof v === "string" && v.trim().length > 0;
  if (!criterion || ![criterion.id, criterion.given, criterion.when, criterion.then].every(isText)) {
    return json({ error: "The acceptance criterion is incomplete." }, 400);
  }
  if (!requirement || !isText(requirement.id) || !isText(requirement.statement)) {
    return json({ error: "The requirement for this criterion is missing." }, 400);
  }
  if (!Array.isArray(sentences) || !Array.isArray(questions) || JSON.stringify(input).length > MAX_REQUEST_CHARS) {
    return json({ error: "The test case request is not in the expected shape or is too long." }, 400);
  }

  const trace = {
    id: criterion.id.replace(/^AC-/, "TC-"),
    acceptanceCriterionId: criterion.id,
    requirementId: requirement.id,
    sourceSentenceIds: sentences.map((s) => s.id),
    criterionSnapshot: { given: criterion.given, when: criterion.when, then: criterion.then },
    status: "draft",
  };
  const sample = sampleResults.acceptanceCriteria.find((ac) => ac.id === "AC-1");
  const isSampleCriterion = ["given", "when", "then"].every((k) => criterion[k] === sample[k]);
  const sampleFallback = (reason) =>
    json({ testCase: { ...sampleTestCase, ...trace, generatedBy: "sample-fallback", fallbackReason: reason } });

  if (!env.ANTHROPIC_API_KEY) {
    if (isSampleCriterion) return sampleFallback("The AI key is not set up on the server.");
    return json({ error: "The AI key is not set up on the server, so a test case can't be drafted." }, 503);
  }

  try {
    const draft = await draftTestCase(env.ANTHROPIC_API_KEY, { criterion, requirement, sentences, questions });
    return json({ testCase: { ...draft, ...trace, generatedBy: "ai" } });
  } catch (error) {
    const reason = error instanceof AnalysisError ? error.message : "The AI request failed unexpectedly.";
    console.error("test case failed:", error);
    if (isSampleCriterion) return sampleFallback(reason);
    return json({ error: `${reason} No test case was drafted.` }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      return analyze(request, env);
    }
    if (url.pathname === "/api/testcase") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      return testCase(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);

    // Everything else is the React app.
    return env.ASSETS.fetch(request);
  },
};
