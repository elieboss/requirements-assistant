// Browser side of the API. The browser never talks to the AI directly; it only calls our own Worker.

export class ApiError extends Error {}

async function readError(response) {
  const body = await response.json().catch(() => ({}));
  // A 5xx with no message means the server itself failed; anything else is a message for the analyst.
  return new ApiError(body.error ?? (response.status >= 500 ? "offline" : `Request failed (${response.status}).`));
}

async function post(path, payload, signal) {
  try {
    return await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    throw new ApiError(err.name === "AbortError" ? "cancelled" : "offline");
  }
}

// Streams the analysis: calls onProgress for each update, resolves with { sentences, results }.
export async function analyzeRequest(text, { onProgress, signal } = {}) {
  const response = await post("/api/analyze", { text }, signal);
  if (!response.ok) throw await readError(response);
  if (!response.headers.get("content-type")?.includes("ndjson")) return response.json();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.type === "progress") onProgress?.(event);
        if (event.type === "result") return { sentences: event.sentences, results: event.results };
        if (event.type === "error") throw new ApiError(event.error);
      }
      if (done) throw new ApiError("offline");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.name === "AbortError" ? "cancelled" : "offline");
  }
}

export async function draftTestCase(payload, { signal } = {}) {
  const response = await post("/api/testcase", payload, signal);
  if (!response.ok) throw await readError(response);
  return (await response.json()).testCase;
}
