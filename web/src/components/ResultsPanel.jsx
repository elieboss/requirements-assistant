import { CriterionCard, QuestionCard, RequirementCard, StakeholderCard } from "./cards.jsx";

const TABS = [
  { key: "requirements", label: "Requirements", list: "requirements", Card: RequirementCard },
  { key: "stakeholders", label: "Stakeholders", list: "stakeholders", Card: StakeholderCard },
  { key: "questions", label: "Open questions", list: "openQuestions", Card: QuestionCard },
  { key: "criteria", label: "Acceptance criteria", list: "acceptanceCriteria", Card: CriterionCard },
];

function reviewed(list) {
  return list.filter((i) => i.status !== "draft").length;
}

// Right side: the draft analysis, split into tabs, with review progress at the top.
export default function ResultsPanel({ results, activeTab, setActiveTab, ctx }) {
  if (!results) {
    return (
      <section className="panel results-panel empty">
        <h2>Draft analysis</h2>
        <p>Analyze the request to see draft requirements, stakeholders, open questions and acceptance criteria, each linked to the sentence it came from.</p>
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

      <div className="progress">
        <span>Requirements reviewed: {reviewed(results.requirements)} / {results.requirements.length}</span>
        <span>Criteria reviewed: {reviewed(results.acceptanceCriteria)} / {results.acceptanceCriteria.length}</span>
        <span>Open questions: {results.openQuestions.length}</span>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === activeTab}
            className={`tab${t.key === activeTab ? " is-active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label} <span className="count">{results[t.list].length}</span>
          </button>
        ))}
      </nav>

      <div className="card-list">
        {results[tab.list].map((item) => (
          <tab.Card key={item.id} item={item} results={results} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}
