import { CriterionCard, QuestionCard, RequirementCard, StakeholderCard, UserStoryCard } from "./cards.jsx";
import { LinkChips } from "./common.jsx";
import { BulkAction, NextStep, StageBar } from "./Workflow.jsx";
import { criterionBlockers, isDecided } from "../lib/workflow.js";
import { storyForRequirement } from "../lib/trace.js";

const TABS = [
  { key: "requirements", label: "Requirements", list: "requirements", Card: RequirementCard },
  { key: "stakeholders", label: "Stakeholders", list: "stakeholders", Card: StakeholderCard },
  { key: "questions", label: "Open questions", list: "openQuestions", Card: QuestionCard },
  { key: "criteria", label: "Stories & criteria", list: "acceptanceCriteria", Card: CriterionCard },
];

const BULK = {
  requirements: { label: "Approve remaining", confirmText: "Approve all undecided requirements?" },
  stakeholders: { label: "Confirm remaining", confirmText: "Confirm all unreviewed stakeholders?" },
  questions: { label: "Assume remaining", confirmText: "Record all open questions as assumptions?" },
  criteria: { label: "Approve remaining", confirmText: "Approve all stories and every unblocked criterion?" },
};

const isPending = (item) => !isDecided(item) && !item.resolution;

// Which items "Approve remaining" would mark on each tab.
export function bulkEligible(results, tabKey) {
  switch (tabKey) {
    case "requirements":
    case "stakeholders":
      return results[tabKey].filter((it) => !isDecided(it)).map((it) => it.id);
    case "questions":
      return results.openQuestions.filter((q) => !q.resolution).map((q) => q.id);
    case "criteria": {
      // Stories are approved in the same step, so check criteria as if they already were.
      const stories = results.userStories.filter((st) => st.status === "draft");
      const after = { ...results, userStories: results.userStories.map((st) => (st.status === "draft" ? { ...st, status: "approved" } : st)) };
      const criteria = results.acceptanceCriteria.filter((ac) => ac.status === "draft" && criterionBlockers(after, ac).length === 0);
      return [...stories, ...criteria].map((it) => it.id);
    }
  }
}

function sourceLabel(results) {
  return {
    ai: "AI (Claude)",
    "sample-server": "sample results",
    "sample-fallback": "sample results (AI unavailable)",
    "sample-offline": "offline sample (server unreachable)",
  }[results.generatedBy] ?? "sample results";
}

// Stage 4: the epic, each story with its criteria nested under it, then anything not in a story.
function StoriesAndCriteria({ results, ctx, nextId }) {
  const criteriaFor = (story) => results.acceptanceCriteria.filter((ac) => story.requirementIds.includes(ac.requirementId));
  const loose = results.acceptanceCriteria.filter((ac) => !storyForRequirement(results, ac.requirementId));
  const constraints = results.requirements.filter((r) => r.type === "constraint").map((r) => r.id);

  return (
    <div className="epic">
      <p className="epic-head">
        <span className="tag tag-epic">epic</span> {results.summary}
      </p>
      {constraints.length > 0 && <div className="epic-meta"><LinkChips label="Applies to the whole epic" ids={constraints} onNavigate={ctx.onNavigate} /></div>}
      {results.userStories.map((story) => (
        <div key={story.id} className="story-group">
          <UserStoryCard item={story} results={results} ctx={ctx} isNext={story.id === nextId} />
          <div className="story-criteria">
            {criteriaFor(story).map((ac) => (
              <CriterionCard key={ac.id} item={ac} results={results} ctx={ctx} isNext={ac.id === nextId} />
            ))}
            {criteriaFor(story).length === 0 && <p className="hint">No acceptance criteria for this story yet.</p>}
          </div>
        </div>
      ))}
      {loose.length > 0 && (
        <div className="story-group">
          <p className="hint">Not in a story</p>
          <div className="story-criteria">
            {loose.map((ac) => <CriterionCard key={ac.id} item={ac} results={results} ctx={ctx} isNext={ac.id === nextId} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// Right side: the draft analysis as ordered refinement stages.
export default function ResultsPanel({ results, activeTab, setActiveTab, ctx }) {
  if (!results) {
    return (
      <section className="panel results-panel empty">
        <h2>Draft analysis</h2>
        <p>Analyze the request, then review it stage by stage.</p>
      </section>
    );
  }

  const tab = TABS.find((t) => t.key === activeTab);
  const check = results.citationCheck;
  const eligible = bulkEligible(results, tab.key);
  const lock = ctx.lock(tab.key);
  const ordered = tab.key === "criteria"
    ? results.userStories.flatMap((st) => [st, ...results.acceptanceCriteria.filter((ac) => st.requirementIds.includes(ac.requirementId))])
        .concat(results.acceptanceCriteria.filter((ac) => !storyForRequirement(results, ac.requirementId)))
    : results[tab.list];
  const nextId = lock ? null : ordered.find((it) => isPending(it) && !(it.id.startsWith("AC-") && criterionBlockers(results, it).length))?.id;

  return (
    <section className="panel results-panel">
      <div className="draft-banner" role="note">
        <strong>DRAFT</strong> · {sourceLabel(results)} · needs analyst review
        {check && (
          <span className={`citation-chip${check.issues.length ? " has-issues" : ""}`}>
            {check.issues.length ? `⚠ ${check.issues.length} citation issues` : `✓ ${check.itemCount} citations checked`}
          </span>
        )}
        {results.fallbackReason && <span className="fallback-reason">{results.fallbackReason}</span>}
        {check?.issues.length > 0 && (
          <details className="citation-details">
            <summary>Show citation issues</summary>
            <ul>{check.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </details>
        )}
      </div>

      <StageBar results={results} activeTab={activeTab} onOpen={setActiveTab} />
      <NextStep results={results} onGo={ctx.goToStep} onNavigate={ctx.onNavigate} />

      <div className="stage-head">
        <h3>{TABS.indexOf(tab) + 1}. {tab.label}</h3>
        <BulkAction key={tab.key} count={eligible.length} {...BULK[tab.key]} locked={lock} onConfirm={() => ctx.bulkMark(tab.key, eligible)} />
      </div>
      {lock && <p className="lock-reason stage-lock">🔒 View only · {lock}</p>}

      <div className="card-list">
        {tab.key === "criteria" ? (
          <StoriesAndCriteria results={results} ctx={ctx} nextId={nextId} />
        ) : (
          results[tab.list].map((item) => (
            <tab.Card key={item.id} item={item} results={results} ctx={ctx} isNext={item.id === nextId} />
          ))
        )}
      </div>
    </section>
  );
}
