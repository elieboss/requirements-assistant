// The refinement workflow: the order an analyst works in, what "done" means for each stage,
// and which actions stay locked until the earlier stages are done (the Definition of Ready).

import { storyForRequirement } from "./trace.js";

export const STAGES = [
  { key: "requirements", tab: "requirements", label: "Requirements" },
  { key: "stakeholders", tab: "stakeholders", label: "Stakeholders" },
  { key: "questions", tab: "questions", label: "Open questions" },
  { key: "criteria", tab: "criteria", label: "Stories & criteria" },
  { key: "testcase", tab: "criteria", label: "Test case", optional: true },
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
      const items = [...results.userStories, ...results.acceptanceCriteria];
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

// Returns null when the stage's actions are open, or a short reason they are locked.
export function stageLock(results, key) {
  const stages = stageProgress(results);
  if (stages.find((s) => s.key === key).unlocked) return null;
  const blocker = stages.find((s) => !s.optional && !s.complete);
  return `Finish ${blocker.label} first`;
}

// Short reasons one acceptance criterion can't be approved (or sent to test design) yet.
export function criterionBlockers(results, ac) {
  const reasons = [];
  const lock = stageLock(results, "criteria");
  if (lock) reasons.push(lock);
  const requirement = results.requirements.find((r) => r.id === ac.requirementId);
  if (!requirement) reasons.push("no linked requirement");
  else if (requirement.status !== "approved") reasons.push(`${requirement.id} not approved`);
  const story = requirement && storyForRequirement(results, requirement.id);
  if (story && story.status !== "approved") reasons.push(`${story.id} not approved`);
  for (const id of ac.dependsOnQuestionIds) {
    const q = results.openQuestions.find((x) => x.id === id);
    if (q && !isResolved(q)) reasons.push(`${q.id} ${q.resolution === "parked" ? "parked" : "open"}`);
  }
  return reasons;
}

// The parked question that blocks the most undecided criteria, if any.
function topParkedBlocker(results) {
  const counts = {};
  for (const ac of results.acceptanceCriteria) {
    if (isDecided(ac)) continue;
    for (const id of ac.dependsOnQuestionIds) {
      const q = results.openQuestions.find((x) => x.id === id);
      if (q?.resolution === "parked") counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  const [id, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return id ? { id, n } : null;
}

// One short instruction: what to do now, and where.
export function nextStep(results) {
  const stages = stageProgress(results);
  const open = stages.find((s) => !s.optional && !s.complete);
  const approvedCriteria = results.acceptanceCriteria.filter((ac) => ac.status === "approved");

  if (!open) {
    return approvedCriteria.length
      ? { ready: true, title: "Ready for test design", detail: "Optional: draft a test case from an approved criterion.", tab: "criteria" }
      : { title: "Nothing testable yet", detail: "Every criterion was rejected. Reopen one and fix it.", tab: "criteria" };
  }
  const left = open.total - open.done;
  switch (open.key) {
    case "requirements":
      return { title: `Review ${left} requirement${left === 1 ? "" : "s"}`, detail: "Check each one against its source sentence.", tab: open.tab };
    case "stakeholders":
      return { title: `Confirm ${left} stakeholder${left === 1 ? "" : "s"}`, detail: "Inferred ones need an explicit decision.", tab: open.tab };
    case "questions":
      return { title: `Resolve ${left} question${left === 1 ? "" : "s"}`, detail: "Answer, assume or park each one.", tab: open.tab };
    case "criteria": {
      const stories = results.userStories.filter((st) => !isDecided(st)).length;
      if (stories) return { title: `Review ${stories} user stor${stories === 1 ? "y" : "ies"}`, detail: "Criteria unlock once their story is approved.", tab: open.tab };
      const pending = results.acceptanceCriteria.filter((ac) => !isDecided(ac));
      const approvable = pending.filter((ac) => criterionBlockers(results, ac).length === 0);
      const parked = topParkedBlocker(results);
      if (!approvable.length && parked) {
        return {
          title: `Unblock: resolve ${parked.id}`,
          detail: `It blocks ${parked.n} criteri${parked.n === 1 ? "on" : "a"}. Answer or assume it, or reject those criteria.`,
          tab: "questions",
          targetId: parked.id,
        };
      }
      return { title: `Review ${pending.length} criteri${pending.length === 1 ? "on" : "a"}`, detail: "Each needs a clear pass or fail result.", tab: open.tab };
    }
  }
}

// The Definition of Ready checklist, plus gaps worth a second look.
export function readiness(results) {
  const byKey = Object.fromEntries(stageProgress(results).map((s) => [s.key, s]));
  const approvedCriteria = results.acceptanceCriteria.filter((ac) => ac.status === "approved");
  const approvedReqs = results.requirements.filter((r) => r.status === "approved");

  return {
    checklist: [
      { label: "Requirements reviewed", met: byKey.requirements.complete },
      { label: "Stakeholders confirmed", met: byKey.stakeholders.complete },
      { label: "Questions resolved or parked", met: byKey.questions.complete },
      { label: "User stories approved", met: results.userStories.every((st) => st.status === "approved") },
      { label: "Criteria reviewed, at least one approved", met: byKey.criteria.complete && approvedCriteria.length > 0 },
    ],
    parked: results.openQuestions.filter((q) => q.resolution === "parked").map((q) => q.id),
    uncovered: approvedReqs
      .filter((r) => r.type !== "constraint" && !approvedCriteria.some((ac) => ac.requirementId === r.id))
      .map((r) => r.id),
    noStory: approvedReqs.filter((r) => r.type !== "constraint" && !storyForRequirement(results, r.id)).map((r) => r.id),
  };
}
