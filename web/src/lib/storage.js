// Autosave: keeps the review in this browser so a refresh or closed tab doesn't lose it.
// Storage can be unavailable (private windows, blocked site data), so every call is guarded.

const KEY = "requirements-assistant:review:v2";

export function loadReview() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return saved?.results ? saved : null;
  } catch {
    return null;
  }
}

export function saveReview(review) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...review, savedAt: new Date().toISOString() }));
  } catch {
    // Saving is a convenience; the app works without it.
  }
}

export function clearReview() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
