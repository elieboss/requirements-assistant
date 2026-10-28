// "Approve remaining": which items a stage's shortcut would mark, and what it does to them.

import { criterionBlockers, isDecided } from "./workflow.js";

export const BULK = {
  requirements: { label: "Approve remaining", confirm: "Approve every requirement still to review?" },
  stakeholders: { label: "Confirm remaining", confirm: "Confirm every remaining stakeholder as Consulted?" },
  questions: { label: "Assume remaining", confirm: "Record every open question as an assumption to confirm later?" },
  criteria: { label: "Approve remaining", confirm: "Approve every story and every criterion that isn't blocked?" },
};

export function bulkEligible(results, stageKey) {
  switch (stageKey) {
    case "requirements":
    case "stakeholders":
      return results[stageKey].filter((it) => !isDecided(it)).map((it) => it.id);
    case "questions":
      return results.openQuestions.filter((q) => !["answered", "assumption", "parked"].includes(q.resolution)).map((q) => q.id);
    case "criteria": {
      // Stories are approved in the same step, so check criteria as if they already were.
      const stories = results.userStories.filter((st) => !isDecided(st));
      const after = { ...results, userStories: results.userStories.map((st) => (isDecided(st) ? st : { ...st, status: "approved" })) };
      const criteria = results.acceptanceCriteria.filter((ac) => !isDecided(ac) && criterionBlockers(after, ac).length === 0);
      return [...stories, ...criteria].map((it) => it.id);
    }
  }
  return [];
}

export function applyBulk(r, stageKey, ids) {
  const pick = (it) => ids.includes(it.id);
  const approve = (list, extra = {}) => list.map((it) => (pick(it) ? { ...it, status: "approved", bulk: true, ...extra } : it));
  switch (stageKey) {
    case "requirements":
      return { ...r, requirements: approve(r.requirements) };
    case "stakeholders":
      return { ...r, stakeholders: approve(r.stakeholders, { raci: "Consulted" }) };
    case "questions":
      return {
        ...r,
        openQuestions: r.openQuestions.map((q) => {
          if (!pick(q)) return q;
          const who = r.stakeholders.find((s) => s.id === q.askStakeholderIds[0])?.role ?? "the requester";
          const guess = q.suggestedAnswers?.[0];
          return { ...q, resolution: "assumption", note: `${guess ? `${guess}, for now` : "Assumed for now"}; confirm with ${who}`, bulk: true };
        }),
      };
    case "criteria":
      return { ...r, userStories: approve(r.userStories), acceptanceCriteria: approve(r.acceptanceCriteria) };
  }
  return r;
}
