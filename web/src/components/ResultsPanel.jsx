import { CriterionCard, QuestionCard, RequirementCard, StakeholderCard, UserStoryCard } from "./cards.jsx";
import { BulkAction, NextStep, StageBar } from "./Workflow.jsx";
import { criterionBlockers } from "../lib/workflow.js";

const TABS = [
  { key: "requirements", stage: "requirements", label: "Requirements", list: "requirements", Card: RequirementCard },
  { key: "stakeholders", stage: "stakeholders", label: "Stakeholders", list: "stakeholders", Card: StakeholderCard },
  { key: "questions", stage: "questions", label: "Open questions", list: "openQuestions", Card: QuestionCard },
  { key: "criteria", stage: "criteria", label: "Story & criteria", list: "acceptanceCriteria", Card: CriterionCard },
];

const BULK = {
  requirements: { label: "Approve remaining", confirmText: "Mark every undecided requirement as approved?" },
  stakeholders: { label: "Confirm remaining", confirmText: "Mark every unreviewed stakeholder as confirmed?" },
  questions: { label: "Record remaining as assumptions", confirmText: "Record every open question as an assumption to confirm later?" },
  criteria: { label: "Approve remaining eligible", confirmText: "Approve the user story and every criterion that isn't blocked?" },
};

// Which items "Approve remaining" would mark on each tab.
export function bulkEligible(results, tabKey) {
  switch (tabKey) {
    case "requirements":
      return results.requirements.filter((r) => r.status === "draft").map((r) => r.id);
    case "stakeholders":
      return results.stakeholders.filter((s) => !s.status || s.status === "draft").map((s) => s.id);
    case "questions":
      return results.openQuestions.filter((q) => !q.resolution).map((q) => q.id);
    case "criteria": {
      const ids = results.userStory?.status === "draft" ? [results.userStory.id] : [];
      return ids.concat(
        results.acceptanceCriteria
          .filter((ac) => ac.status === "draft" && criterionBlockers(results, ac).length === 0)
          .map((ac) => ac.id)
      );
    }
  }
}

// Right side: the draft analysis as ordered refinement stages.
export default function ResultsPanel({ results, activeTab, setActiveTab, ctx }) {
  if (!results) {
    return (
      <section className="panel results-panel empty">
        <h2>Draft analysis</h2>
        <p>Analyze the request to see draft requirements, stakeholders, open questions, a user story and acceptance criteria, each linked to the sentence it came from. You then review them stage by stage.</p>
      </section>
    );
  }

  const tab = TABS.find((t) => t.key === activeTab);
  const sourceLabel = {
    ai: "AI (Claude)",
    "sample-server": "pre-written sample results, served by the Worker",
    "sample-fallback": "the pre-written sample results, because the AI was not available",
    "sample-offline": "the offline copy of the sample results (the server could not be reached)",
  }[results.generatedBy] ?? "pre-written sample results";
  const check = results.citationCheck;
  const eligible = bulkEligible(results, tab.key);

  return (
    <section className="panel results-panel">
      <div className="draft-banner" role="note">
        <strong>DRAFT — for analyst review.</strong> Generated from {sourceLabel}. Nothing here is final until an analyst approves it.
        {results.fallbackReason && <span className="fallback-reason"> Reason: {results.fallbackReason}</span>}
      </div>

      {check && (
        <div className={`citation-check${check.issues.length ? " has-issues" : ""}`}>
          {check.issues.length === 0
            ? `Citation check passed: all ${check.itemCount} items cite sentences that exist in the request.`
            : `Citation check: ${check.issues.length} problem(s) found and removed. Flagged items need extra review.`}
          {check.issues.length > 0 && (
            <details>
              <summary>Show details</summary>
              <ul>{check.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      <p className="summary">{results.summary}</p>

      <StageBar results={results} activeTab={activeTab} onOpen={setActiveTab} />
      <NextStep results={results} onOpen={setActiveTab} onNavigate={ctx.onNavigate} />

      <div className="stage-head">
        <h3>
          Stage {TABS.indexOf(tab) + 1} · {tab.label}
        </h3>
        <BulkAction
          key={tab.key}
          count={eligible.length}
          {...BULK[tab.key]}
          locked={ctx.lock(tab.stage)}
          onConfirm={() => ctx.bulkMark(tab.key, eligible)}
        />
      </div>
      {ctx.lock(tab.stage) && <p className="lock-reason stage-lock"><span aria-hidden="true">🔒 </span>View only. {ctx.lock(tab.stage)}</p>}

      <div className="card-list">
        {tab.key === "criteria" && results.userStory && <UserStoryCard item={results.userStory} results={results} ctx={ctx} />}
        {results[tab.list].map((item) => (
          <tab.Card key={item.id} item={item} results={results} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}
