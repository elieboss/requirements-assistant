import { useState } from "react";
import { LinkChips, ReviewActions, SentenceChips, StatusBadge, WithTbd } from "./common.jsx";
import TestCasePanel from "./TestCasePanel.jsx";
import { criteriaForRequirement, questionsForRequirement, questionsForStakeholder } from "../lib/trace.js";
import { criterionBlockers, isResolved } from "../lib/workflow.js";

function Card({ id, selected, linked, status, unsupported, onSelect, children }) {
  const cls = ["card", selected && "is-selected", linked && "is-linked", status && `is-${status}`].filter(Boolean).join(" ");
  return (
    <article id={`card-${id}`} className={cls} onClick={() => onSelect(id)}>
      {children}
      {unsupported && <p className="unsupported">Not traced: no valid source in the request. Verify before using.</p>}
    </article>
  );
}

function CardHead({ id, tag, tagKind, children }) {
  return (
    <header className="card-head">
      <span className="item-id">{id}</span>
      {tag && <span className={`tag tag-${tagKind ?? tag}`}>{tag}</span>}
      <span className="spacer" />
      {children}
    </header>
  );
}

const stopClick = (e) => e.stopPropagation();

export function RequirementCard({ item, results, ctx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.statement);
  const update = (changes) => ctx.updateItem("requirements", item.id, changes);

  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} unsupported={item.unsupported} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag={item.type}>
        <StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />
      </CardHead>
      {editing ? (
        <textarea className="edit-box" value={draft} onClick={stopClick} onChange={(e) => setDraft(e.target.value)} rows={3} />
      ) : (
        <p className="statement">{item.statement}</p>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Open questions" ids={questionsForRequirement(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
        <LinkChips label="Criteria" ids={criteriaForRequirement(results, item.id).map((a) => a.id)} onNavigate={ctx.onNavigate} />
      </div>
      <ReviewActions
        status={item.status}
        editing={editing}
        locked={ctx.lock("requirements")}
        onApprove={() => update({ status: "approved", bulk: false })}
        onReject={() => update({ status: "rejected", bulk: false })}
        onReset={() => update({ status: "draft" })}
        onEdit={() => { setDraft(item.statement); setEditing(true); }}
        onSave={() => { update({ statement: draft.trim(), edited: true }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </Card>
  );
}

export function StakeholderCard({ item, results, ctx }) {
  const update = (changes) => ctx.updateItem("stakeholders", item.id, changes);
  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} unsupported={item.unsupported} onSelect={ctx.onSelect}>
      <CardHead
        id={item.id}
        tag={item.inferred ? "inferred · confirm" : "named in request"}
        tagKind={item.inferred ? "inferred" : "named"}
      >
        <StatusBadge status={item.status} bulk={item.bulk} labels={{ approved: "Confirmed by analyst", rejected: "Removed by analyst" }} />
      </CardHead>
      <p className="statement"><strong>{item.role}</strong></p>
      <p className="detail">{item.interest}</p>
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Questions for them" ids={questionsForStakeholder(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
      </div>
      <ReviewActions
        status={item.status ?? "draft"}
        canEdit={false}
        locked={ctx.lock("stakeholders")}
        labels={{ approve: "Confirm", reject: "Remove" }}
        onApprove={() => update({ status: "approved", bulk: false })}
        onReject={() => update({ status: "rejected", bulk: false })}
        onReset={() => update({ status: "draft" })}
      />
    </Card>
  );
}

const RESOLUTIONS = {
  answered: { label: "Answered", prompt: "What did the stakeholder say?" },
  assumption: { label: "Assumption", prompt: "What are you assuming for now?" },
  parked: { label: "Parked", prompt: null },
};

export function QuestionCard({ item, results, ctx }) {
  const [choosing, setChoosing] = useState(null); // "answered" | "assumption" while typing a note
  const [note, setNote] = useState("");
  const update = (changes) => ctx.updateItem("openQuestions", item.id, changes);
  const locked = ctx.lock("questions");
  const askRoles = item.askStakeholderIds
    .map((id) => results.stakeholders.find((s) => s.id === id)?.role)
    .filter(Boolean)
    .join("; ");
  const blocks = results.acceptanceCriteria.filter((ac) => ac.dependsOnQuestionIds.includes(item.id)).map((ac) => ac.id);

  function start(kind) {
    if (kind === "parked") return update({ resolution: "parked", note: "", bulk: false });
    setNote(item.note ?? "");
    setChoosing(kind);
  }

  return (
    <Card id={item.id} {...ctx.cardState(item)} unsupported={item.unsupported} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag={item.issue}>
        {item.resolution ? (
          <span className="badges">
            <span className={`badge badge-res-${item.resolution}`}>{RESOLUTIONS[item.resolution].label}</span>
            {item.bulk && <span className="badge badge-bulk">Bulk</span>}
          </span>
        ) : (
          <span className="badge badge-draft">Open · needs an outcome</span>
        )}
      </CardHead>
      <p className="statement">{item.question}</p>
      {askRoles && <p className="detail">Ask: {askRoles}</p>}
      {item.resolution && item.resolution !== "parked" && (
        <p className="resolution-note"><strong>{RESOLUTIONS[item.resolution].label}:</strong> {item.note}</p>
      )}
      {item.resolution === "parked" && blocks.length > 0 && (
        <p className="warning">Parked. {blocks.join(", ")} can't be approved until this is answered or assumed.</p>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Affects" ids={item.relatedRequirementIds} onNavigate={ctx.onNavigate} />
        <LinkChips label="Blocks" ids={blocks} onNavigate={ctx.onNavigate} warn={!isResolved(item)} />
        <LinkChips label="Ask" ids={item.askStakeholderIds} onNavigate={ctx.onNavigate} />
      </div>

      {choosing ? (
        <div className="resolve-form" onClick={stopClick}>
          <label className="field-label" htmlFor={`note-${item.id}`}>{RESOLUTIONS[choosing].prompt}</label>
          <textarea id={`note-${item.id}`} className="edit-box" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="actions">
            <button
              className="btn btn-primary"
              disabled={!note.trim()}
              onClick={() => { update({ resolution: choosing, note: note.trim(), bulk: false }); setChoosing(null); }}
            >
              Save {RESOLUTIONS[choosing].label.toLowerCase()}
            </button>
            <button className="btn" onClick={() => setChoosing(null)}>Cancel</button>
          </div>
        </div>
      ) : item.resolution ? (
        <div className="actions">
          <button className="btn btn-quiet" onClick={(e) => { stopClick(e); update({ resolution: null, note: "", bulk: false }); }}>
            Change outcome
          </button>
        </div>
      ) : (
        <>
          <div className="actions" onClick={stopClick}>
            <button className="btn btn-primary" disabled={!!locked} onClick={() => start("answered")}>Record answer</button>
            <button className="btn" disabled={!!locked} onClick={() => start("assumption")}>Note assumption</button>
            <button className="btn btn-quiet" disabled={!!locked} onClick={() => start("parked")}>Park</button>
          </div>
          {locked && <p className="lock-reason"><span aria-hidden="true">🔒 </span>{locked}</p>}
        </>
      )}
    </Card>
  );
}

export function UserStoryCard({ item, ctx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ asA: item.asA, iWant: item.iWant, soThat: item.soThat });
  const update = (changes) => ctx.updateItem("userStory", item.id, changes);
  const fields = [["asA", "As a"], ["iWant", "I want"], ["soThat", "so that"]];

  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} unsupported={item.unsupported} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag="user story" tagKind="story">
        <StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />
      </CardHead>
      {editing ? (
        <div className="gwt-edit">
          {fields.map(([k, label]) => (
            <label key={k}>
              <span className="gwt-key">{label}</span>
              <textarea className="edit-box" rows={2} value={draft[k]} onClick={stopClick} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      ) : (
        <p className="story">
          <strong>As a</strong> {item.asA}, <strong>I want</strong> {item.iWant}, <strong>so that</strong> {item.soThat}.
        </p>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
      </div>
      <ReviewActions
        status={item.status}
        editing={editing}
        locked={ctx.lock("criteria")}
        onApprove={() => update({ status: "approved", bulk: false })}
        onReject={() => update({ status: "rejected", bulk: false })}
        onReset={() => update({ status: "draft" })}
        onEdit={() => { setDraft({ asA: item.asA, iWant: item.iWant, soThat: item.soThat }); setEditing(true); }}
        onSave={() => { update({ ...draft, edited: true }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </Card>
  );
}

export function CriterionCard({ item, results, ctx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ given: item.given, when: item.when, then: item.then });
  const [generating, setGenerating] = useState(false);
  const [tcError, setTcError] = useState("");
  const testCase = results.testCases?.[item.id];
  const update = (changes) => ctx.updateItem("acceptanceCriteria", item.id, changes);

  const locked = ctx.lock("criteria");
  const blockers = criterionBlockers(results, item).filter((r) => r !== locked);
  const questions = item.dependsOnQuestionIds.map((id) => results.openQuestions.find((q) => q.id === id)).filter(Boolean);
  const openDeps = questions.filter((q) => !isResolved(q)).map((q) => q.id);
  const resolvedDeps = questions.filter(isResolved).map((q) => q.id);
  const text = `${item.given} ${item.when} ${item.then}`;
  const placeholdersToUpdate = questions.filter((q) => q.resolution === "answered" && text.includes(`[TBD per ${q.id}]`));
  const readyForTest = item.status === "approved" && !locked && blockers.length === 0;

  async function generate(e) {
    e.stopPropagation();
    setGenerating(true);
    setTcError("");
    try {
      await ctx.generateTestCase(item.id);
    } catch (err) {
      setTcError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} unsupported={item.unsupported} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag="given / when / then" tagKind="gwt">
        <StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />
      </CardHead>
      {editing ? (
        <div className="gwt-edit">
          {["given", "when", "then"].map((k) => (
            <label key={k}>
              <span className="gwt-key">{k}</span>
              <textarea className="edit-box" rows={2} value={draft[k]} onClick={stopClick} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      ) : (
        <dl className="gwt">
          <dt>Given</dt><dd><WithTbd text={item.given} /></dd>
          <dt>When</dt><dd><WithTbd text={item.when} /></dd>
          <dt>Then</dt><dd><WithTbd text={item.then} /></dd>
        </dl>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Verifies" ids={[item.requirementId]} onNavigate={ctx.onNavigate} />
        <LinkChips label="Blocked by" ids={openDeps} onNavigate={ctx.onNavigate} warn />
        <LinkChips label="Resolved" ids={resolvedDeps} onNavigate={ctx.onNavigate} />
      </div>
      {placeholdersToUpdate.map((q) => (
        <p key={q.id} className="warning">
          {q.id} is answered ("{q.note}"). Edit this criterion to replace [TBD per {q.id}] with the agreed value.
        </p>
      ))}
      {item.status === "approved" && blockers.length > 0 && (
        <p className="unsupported">Approved earlier, but something upstream changed: {blockers.join(" ")} Re-review it.</p>
      )}
      <ReviewActions
        status={item.status}
        editing={editing}
        locked={locked}
        approveBlockers={blockers}
        onApprove={() => update({ status: "approved", bulk: false })}
        onReject={() => update({ status: "rejected", bulk: false })}
        onReset={() => update({ status: "draft" })}
        onEdit={() => { setDraft({ given: item.given, when: item.when, then: item.then }); setEditing(true); }}
        onSave={() => { update({ ...draft, edited: true }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
      {readyForTest && (
        <div className="next-step">
          <button className="btn" onClick={generate} disabled={generating}>
            {generating ? "Drafting test case…" : testCase ? "Regenerate draft test case" : "Generate draft test case"}
          </button>
          <span className="hint"> Optional: shows how an approved criterion carries forward into testing.</span>
          {tcError && <p className="notice">{tcError}</p>}
        </div>
      )}
      {testCase && <TestCasePanel testCase={testCase} criterion={item} ctx={ctx} />}
    </Card>
  );
}
