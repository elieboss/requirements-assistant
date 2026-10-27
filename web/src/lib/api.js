// Browser side of the API. The browser never talks to the AI directly; it only calls our own Worker.

export class ApiError extends Error {}

async function postJson(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError("offline");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 5xx with no message means the server itself failed; anything else is a message for the analyst.
    throw new ApiError(body.error ?? (response.status >= 500 ? "offline" : `Request failed (${response.status}).`));
  }
  return body;
}

export function analyzeRequest(text) {
  return postJson("/api/analyze", { text }); // { sentences, results }
}

export async function draftTestCase(payload) {
  return (await postJson("/api/testcase", payload)).testCase;
}
