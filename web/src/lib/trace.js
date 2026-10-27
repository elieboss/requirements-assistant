// Traceability helpers: follow the links between sentences, requirements, questions, criteria and stakeholders.

const LISTS = {
  "REQ-": ["requirements", "requirements"],
  "STK-": ["stakeholders", "stakeholders"],
  "Q-": ["openQuestions", "questions"],
  "AC-": ["acceptanceCriteria", "criteria"],
};

function prefixOf(id) {
  return Object.keys(LISTS).find((p) => id.startsWith(p));
}

export function tabForId(id) {
  return LISTS[prefixOf(id)]?.[1] ?? "requirements";
}

export function findItem(results, id) {
  const prefix = results && prefixOf(id);
  return prefix ? results[LISTS[prefix][0]].find((item) => item.id === id) : undefined;
}

export function allItems(results) {
  return [...results.requirements, ...results.stakeholders, ...results.openQuestions, ...results.acceptanceCriteria];
}

export function itemsCitingSentence(results, sentenceId) {
  return allItems(results).filter((item) => item.sourceSentenceIds.includes(sentenceId));
}

export function requirementsCitingSentence(results, sentenceId) {
  return results.requirements.filter((r) => r.sourceSentenceIds.includes(sentenceId));
}

export function questionsForRequirement(results, reqId) {
  return results.openQuestions.filter((q) => q.relatedRequirementIds.includes(reqId));
}

export function criteriaForRequirement(results, reqId) {
  return results.acceptanceCriteria.filter((ac) => ac.requirementId === reqId);
}

export function questionsForStakeholder(results, stkId) {
  return results.openQuestions.filter((q) => q.askStakeholderIds.includes(stkId));
}
