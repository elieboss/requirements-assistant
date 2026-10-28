// Chunking: each stage is split into small groups so the analyst works through a few items at a time.

import { storyForRequirement } from "./trace.js";

const short = (text, n = 48) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);
export const storyLabel = (story) => short(`${story.asA[0].toUpperCase()}${story.asA.slice(1)}: ${story.iWant}`);

export function groupsFor(results, stageKey) {
  switch (stageKey) {
    case "requirements": {
      const groups = results.userStories.map((st) => ({
        key: st.id,
        title: storyLabel(st),
        hint: st.id,
        items: results.requirements.filter((r) => st.requirementIds.includes(r.id)),
      }));
      groups.push({ key: "epic", title: "Whole epic (constraints)", items: results.requirements.filter((r) => r.type === "constraint") });
      groups.push({
        key: "none",
        title: "Not in a story",
        items: results.requirements.filter((r) => r.type !== "constraint" && !storyForRequirement(results, r.id)),
      });
      return groups.filter((g) => g.items.length);
    }
    case "stakeholders":
      return [
        { key: "named", title: "Named in the request", items: results.stakeholders.filter((s) => !s.inferred) },
        { key: "inferred", title: "Inferred by the AI", hint: "confirm they're involved", items: results.stakeholders.filter((s) => s.inferred) },
      ].filter((g) => g.items.length);
    case "questions": {
      // One group per person to ask, so each group is one conversation.
      const byPerson = new Map();
      for (const q of results.openQuestions) {
        const key = q.askStakeholderIds[0] ?? "anyone";
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key).push(q);
      }
      return [...byPerson].map(([key, items]) => ({
        key,
        title: results.stakeholders.find((s) => s.id === key)?.role ?? "Anyone",
        hint: "ask",
        stakeholderId: key,
        items,
      }));
    }
    case "criteria": {
      const groups = results.userStories.map((st) => ({
        key: st.id,
        title: storyLabel(st),
        hint: st.id,
        items: [st, ...results.acceptanceCriteria.filter((ac) => st.requirementIds.includes(ac.requirementId))],
      }));
      groups.push({
        key: "none",
        title: "Criteria not in a story",
        items: results.acceptanceCriteria.filter((ac) => !storyForRequirement(results, ac.requirementId)),
      });
      return groups.filter((g) => g.items.length);
    }
  }
  return [];
}
