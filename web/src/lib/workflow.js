// The refinement workflow: the order an analyst works in, what "done" means for each stage,
// and which actions stay locked until the earlier stages are done (the Definition of Ready).

export const STAGES = [
  { key: "requirements", tab: "requirements", label: "Requirements" },
  { key: "stakeholders", tab: "stakeholders", label: "Stakeholders" },
  { key: "questions", tab: "questions", label: "Open questions" },
  { key: "criteria", tab: "criteria", label: "Story & criteria" },
  { key: "testcase", tab: "criteria", label: "Draft test case", optional: true },
];

export const isDecided = (item) => item.status === "approved" || item.status === "rejected";
export const isResolved = (q) => q.resolution === "answered" || q.resolution === "assumption";
const hasOutcome = (q) => Boolean(q.resolution);

function stageCounts(results, key) {
  switch (key) {
    case "requirements":
      return { done: results.requirements.filter(isDecided).length, total: results.requirements.length };
    case "stakeholders":
      return { done: results.stakeholders.filter(isDecided).length, total: results.stakeholders.length };
    case "questions":
      return { done: results.openQuestions.filter(hasOutcome).length, total: results.openQuestions.length };
    case "criteria": {
      const items = [...(results.userStory ? [results.userStory] : []), ...results.acceptanceCriteria];
      return { done: items.filter(isDecided).length, total: items.length };
    }
    case "testcase":
      return { done: Object.keys(results.testCases ?? {}).length, total: null };
  }
}

export function stageProgress(results) {
  let previousComplete = true;
  return STAGES.map((stage) => {
    const { done, total } = stageCounts(results, stage.key);
    const complete = total === null ? false : done === total;
    const unlocked = previousComplete;
    if (!stage.optional) previousComplete = previousComplete && complete;
    return { ...stage, done, total, complete, unlocked };
  });
}

// Returns null when the stage's actions are open, or the reason they are locked.
export function stageLock(results, key) {
  const stages = stageProgress(results);
  const stage = stages.find((s) => s.key === key);
  if (stage.unlocked) return null;
  const blocker = stages.find((s) => !s.optional && !s.complete);
  const left = blocker.total - blocker.done;
  return `Locked: finish ${stages.indexOf(blocker) + 1}. ${blocker.label} first (${left} left).`;
}

// What stands between one acceptance criterion and approval (or test design).
export function criterionBlockers(results, ac) {
  const reasons = [];
  const lock = stageLock(results, "criteria");
  if (lock) reasons.push(lock);
  const requirement = results.requirements.find((r) => r.id === ac.requirementId);
  if (!requirement) reasons.push("It is not linked to a known requirement.");
  else if (requirement.status !== "approved") reasons.push(`${requirement.id} is not approved.`);
  for (const id of ac.dependsOnQuestionIds) {
    const q = results.openQuestions.find((x) => x.id === id);
    if (q && !isResolved(q)) reasons.push(`${q.id} is ${q.resolution === "parked" ? "parked" : "not resolved"}.`);
  }
  return reasons;
}

export function nextStep(results) {
  const stages = stageProgress(results);
  const open = stages.find((s) => !s.optional && !s.complete);
  if (!open && !results.acceptanceCriteria.some((ac) => ac.status === "approved")) {
    return {
      ready: false,
      title: "Not ready: no acceptance criterion is approved.",
      detail: "Every criterion was rejected. Return one to draft and fix it, or the request has nothing testable yet.",
      tab: "criteria",
    };
  }
  if (!open) {
    return {
      ready: true,
      title: "Ready: this request meets the Definition of Ready.",
      detail: "Optional next step: open an approved acceptance criterion and generate a draft test case for test design.",
      tab: "criteria",
    };
  }
  const left = open.total - open.done;
  switch (open.key) {
    case "requirements":
      return { title: "Next: review the requirements.", tab: open.tab,
        detail: `${left} of ${open.total} still need a decision. Approve, edit or reject each one against its source sentence.` };
    case "stakeholders": {
      const inferred = results.stakeholders.filter((s) => s.inferred && !isDecided(s)).length;
      return { title: "Next: confirm the stakeholders.", tab: open.tab,
        detail: `${left} still to confirm or remove${inferred ? `, including ${inferred} inferred by the AI. Check they are really involved` : ""}.` };
    }
    case "questions":
      return { title: "Next: resolve the open questions.", tab: open.tab,
        detail: `${left} have no outcome yet. Record the stakeholder's answer, note an assumption, or park it. Parked questions block the criteria that depend on them.` };
    case "criteria": {
      if (results.userStory && !isDecided(results.userStory)) {
        return { title: "Next: review the user story.", tab: open.tab,
          detail: "Check the story reflects what the requester actually needs, then approve it." };
      }
      const blocked = results.acceptanceCriteria.filter((ac) => !isDecided(ac) && criterionBlockers(results, ac).length).length;
      return { title: "Next: review the acceptance criteria.", tab: open.tab,
        detail: `${left} still need a decision${blocked ? `; ${blocked} are blocked and can only be rejected or fixed upstream` : ""}. Make sure each one has a clear pass or fail result.` };
    }
  }
}

// The Definition of Ready checklist, plus requirements that have no approved criterion yet.
export function readiness(results) {
  const stages = stageProgress(results);
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  const approvedCriteria = results.acceptanceCriteria.filter((ac) => ac.status === "approved");
  const parked = results.openQuestions.filter((q) => q.resolution === "parked");
  const uncovered = results.requirements
    .filter((r) => r.status === "approved")
    .filter((r) => !approvedCriteria.some((ac) => ac.requirementId === r.id))
    .map((r) => r.id);

  return {
    checklist: [
      { label: "Every requirement approved or rejected", met: byKey.requirements.complete },
      { label: "Stakeholders confirmed, including inferred ones", met: byKey.stakeholders.complete },
      { label: "Every open question answered, assumed or parked", met: byKey.questions.complete },
      { label: "User story approved", met: !results.userStory || results.userStory.status === "approved" },
      { label: "At least one testable acceptance criterion approved", met: approvedCriteria.length > 0 },
    ],
    parked: parked.map((q) => q.id),
    uncovered,
  };
}
