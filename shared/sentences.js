// Splits a request into numbered sentences (S1, S2, ...).
// Every requirement, question and criterion cites these IDs, which is what makes the output traceable.

export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `S${i + 1}`, text }));
}
