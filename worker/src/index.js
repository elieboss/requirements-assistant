// Cloudflare Worker: the server side of the Requirements Assistant.
// It serves the built React app and handles POST /api/analyze.
// Step 3: the endpoint returns the pre-written sample results. Step 4 adds the AI call here,
// so the API key only ever lives on the server.

import { sampleRequest } from "../../shared/sampleRequest.js";
import { sampleResults } from "../../shared/sampleResults.js";
import { splitSentences } from "../../shared/sentences.js";

const MAX_REQUEST_CHARS = 6000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function analyze(request) {
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

  if (text.trim() !== sampleRequest.body) {
    return json({ error: "Live analysis of other requests is connected in Step 4. For now, use the sample request." }, 501);
  }

  return json({ sentences, results: { ...sampleResults, generatedBy: "sample-server" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);
      return analyze(request);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);

    // Everything else is the React app.
    return env.ASSETS.fetch(request);
  },
};
