// Checks the AI's draft before the browser sees it.
// Every citation and link must point at something that exists; anything that doesn't is removed
// and the item is flagged, so an unsupported claim is never shown as if it were traced.

export function validateAnalysis(raw, sentences) {
  const sentenceIds = new Set(sentences.map((s) => s.id));
  const issues = [];

  const reqIds = new Set(raw.requirements.map((r) => r.id));
  const stkIds = new Set(raw.stakeholders.map((s) => s.id));
  const qIds = new Set(raw.openQuestions.map((q) => q.id));

  function keep(item, field, valid) {
    const before = item[field];
    const after = before.filter((id) => valid.has(id));
    for (const id of before) if (!valid.has(id)) issues.push(`${item.id}: removed unknown reference ${id}`);
    return after;
  }

  function checkSources(item) {
    const sourceSentenceIds = keep(item, "sourceSentenceIds", sentenceIds);
    const unsupported = sourceSentenceIds.length === 0;
    if (unsupported) issues.push(`${item.id}: no valid source sentence`);
    return { ...item, sourceSentenceIds, ...(unsupported && { unsupported: true }) };
  }

  const userStory = raw.userStory ? { ...checkSources({ ...raw.userStory, id: "STORY-1" }), status: "draft" } : undefined;
  const requirements = raw.requirements.map((r) => ({ ...checkSources(r), status: "draft" }));
  const stakeholders = raw.stakeholders.map((s) => ({ ...checkSources(s), status: "draft" }));
  const openQuestions = raw.openQuestions.map((q) => ({
    ...checkSources(q),
    relatedRequirementIds: keep(q, "relatedRequirementIds", reqIds),
    askStakeholderIds: keep(q, "askStakeholderIds", stkIds),
  }));
  const acceptanceCriteria = raw.acceptanceCriteria.map((ac) => {
    const checked = { ...checkSources(ac), dependsOnQuestionIds: keep(ac, "dependsOnQuestionIds", qIds), status: "draft" };
    if (!reqIds.has(ac.requirementId)) {
      issues.push(`${ac.id}: verifies unknown requirement ${ac.requirementId}`);
      checked.unsupported = true;
    }
    return checked;
  });

  const itemCount = (userStory ? 1 : 0) + requirements.length + stakeholders.length + openQuestions.length + acceptanceCriteria.length;

  return {
    status: "draft",
    generatedBy: "ai",
    summary: raw.summary,
    userStory,
    requirements,
    stakeholders,
    openQuestions,
    acceptanceCriteria,
    citationCheck: { itemCount, issues },
  };
}
