// Filling "[TBD per Q-n]" placeholders in acceptance criteria once a question is answered.

export const placeholderFor = (qId) => `[TBD per ${qId}]`;

export function criteriaWithPlaceholder(results, qId) {
  const mark = placeholderFor(qId);
  return results.acceptanceCriteria.filter((ac) => [ac.given, ac.when, ac.then].some((t) => t.includes(mark)));
}

export function fillPlaceholder(ac, qId, value) {
  const mark = placeholderFor(qId);
  const fill = (t) => t.split(mark).join(value);
  return { given: fill(ac.given), when: fill(ac.when), then: fill(ac.then) };
}
