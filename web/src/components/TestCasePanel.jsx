import { LinkChips, ReviewActions, SentenceChips, StatusBadge, WithTbd } from "./common.jsx";

// Optional step: a draft test case generated from one approved acceptance criterion.
export default function TestCasePanel({ testCase, criterion, ctx }) {
  const stale = ["given", "when", "then"].some((k) => testCase.criterionSnapshot[k] !== criterion[k]);
  const update = (changes) => ctx.setTestCase(criterion.id, { ...testCase, ...changes });
  const sourceLabel = testCase.generatedBy === "ai" ? "AI (Claude)" : "the pre-written sample, because the AI was not available";

  return (
    <section className="test-case" onClick={(e) => e.stopPropagation()}>
      <header className="card-head">
        <span className="item-id">{testCase.id}</span>
        <span className="tag tag-gwt">draft test case</span>
        <span className="spacer" />
        <StatusBadge status={testCase.status} />
      </header>

      <p className="tc-note">
        <strong>DRAFT — for analyst review.</strong> Generated from {sourceLabel}. A real team would adapt this to its
        own test template, tool and process.
        {testCase.fallbackReason && <span className="fallback-reason"> Reason: {testCase.fallbackReason}</span>}
      </p>

      <div className="trace-row">
        <LinkChips label="Verifies" ids={[testCase.acceptanceCriterionId, testCase.requirementId]} onNavigate={ctx.onNavigate} />
        <SentenceChips ids={testCase.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
      </div>

      {stale && (
        <p className="unsupported">The criterion was edited after this test case was drafted. Regenerate it before relying on it.</p>
      )}

      <h4 className="tc-title">{testCase.title}</h4>
      <p className="detail">{testCase.objective}</p>

      <div className="tc-columns">
        <div>
          <h5>Preconditions</h5>
          <ul>{testCase.preconditions.map((p) => <li key={p}><WithTbd text={p} /></li>)}</ul>
        </div>
        <div>
          <h5>Test data (fictional)</h5>
          <ul>{testCase.testData.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </div>

      <h5>Steps</h5>
      <div className="table-scroll">
        <table className="tc-steps">
          <thead>
            <tr><th>#</th><th>Action</th><th>Expected result</th></tr>
          </thead>
          <tbody>
            {testCase.steps.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{s.action}</td>
                <td><WithTbd text={s.expected} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tc-suggestions">
        <h5>Suggested for the analyst</h5>
        <p className="detail">Not part of the test case. Ideas to review when deciding what else to test.</p>
        <h6>Edge cases</h6>
        <ul>{testCase.edgeCases.map((e) => <li key={e.scenario}><strong>{e.scenario}</strong> {e.why}</li>)}</ul>
        <h6>Coverage gaps</h6>
        <ul>{testCase.coverageGaps.map((g) => <li key={g}>{g}</li>)}</ul>
        {testCase.assumptions.length > 0 && (
          <>
            <h6>Assumptions</h6>
            <ul>{testCase.assumptions.map((a) => <li key={a}><WithTbd text={a} /></li>)}</ul>
          </>
        )}
      </div>

      <ReviewActions
        status={testCase.status}
        canEdit={false}
        onApprove={() => update({ status: "approved" })}
        onReject={() => update({ status: "rejected" })}
        onReset={() => update({ status: "draft" })}
      />
    </section>
  );
}
