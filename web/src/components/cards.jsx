import { useEffect, useRef, useState } from "react";
import { LinkChips, ReviewActions, SentenceChips, StatusBadge, WithTbd } from "./common.jsx";
import TestCasePanel from "./TestCasePanel.jsx";
import { criteriaForRequirement, questionsForRequirement, questionsForStakeholder } from "../lib/trace.js";
import { criterionBlockers, isDecided, isResolved } from "../lib/workflow.js";

// A one-line card that expands on click. The next item to review opens by itself,
// and a card folds away once it has been decided, so review flows item by item.
function Card({ item, title, tag, tagKind, badge, isNext, keepOpenWhenDecided, ctx, children }) {
  const { selected, linked } = ctx.cardState(item);
  const [open, setOpen] = useState(isNext);
  const decided = isDecided(item) || Boolean(item.resolution);
  const wasDecided = useRef(decided);

  useEffect(() => { if (selected || isNext) setOpen(true); }, [selected, isNext]);
  useEffect(() => {
    if (decided && !wasDecided.current && !keepOpenWhenDecided) setOpen(false);
    wasDecided.current = decided;
  }, [decided, keepOpenWhenDecided]);

  const cls = ["card", open && "is-open", selected && "is-selected", linked && "is-linked", item.status && `is-${item.status}`]
    .filter(Boolean).join(" ");
  return (
    <article id={`card-${item.id}`} className={cls}>
      <button className="card-toggle" aria-expanded={open} onClick={() => { if (!open) ctx.onSelect(item.id); setOpen(!open); }}>
        <span className="chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="item-id">{item.id}</span>
        {tag && <span className={`tag tag-${tagKind ?? tag}`}>{tag}</span>}
        <span className="card-title">{title}</span>
        {item.unsupported && <span className="badge badge-rejected">Not traced</span>}
        {badge}
      </button>
      {open && (
        <div className="card-body" onClick={() => ctx.onSelect(item.id)}>
          {children}
          {item.unsupported && <p className="unsupported">No valid source in the request. Verify before using.</p>}
        </div>
      )}
    </article>
  );
}

const stopClick = (e) => e.stopPropagation();

export function RequirementCard({ item, results, ctx, isNext }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.statement);
  const update = (changes) => ctx.updateItem("requirements", item.id, changes);

  return (
    <Card item={item} ctx={ctx} isNext={isNext} title={item.statement} tag={item.type}
      badge={<StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />}>
      {editing && (
        <textarea className="edit-box" value={draft} onClick={stopClick} onChange={(e) => setDraft(e.target.value)} rows={3} />
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Questions" ids={questionsForRequirement(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
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

export function StakeholderCard({ item, results, ctx, isNext }) {
  const update = (changes) => ctx.updateItem("stakeholders", item.id, changes);
  return (
    <Card item={item} ctx={ctx} isNext={isNext} title={item.role}
      tag={item.inferred ? "inferred" : "named"} tagKind={item.inferred ? "inferred" : "named"}
      badge={<StatusBadge status={item.status} bulk={item.bulk} labels={{ approved: "Confirmed", rejected: "Removed" }} />}>
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
  answered: { label: "Answered", prompt: "Stakeholder's answer" },
  assumption: { label: "Assumption", prompt: "What you're assuming" },
  parked: { label: "Parked", prompt: null },
};

export function QuestionCard({ item, results, ctx, isNext }) {
  const [choosing, setChoosing] = useState(null); // "answered" | "assumption" while typing a note
  const [note, setNote] = useState("");
  const update = (changes) => ctx.updateItem("openQuestions", item.id, changes);
  const locked = ctx.lock("questions");
  const askRoles = item.askStakeholderIds.map((id) => results.stakeholders.find((s) => s.id === id)?.role).filter(Boolean);
  const blocks = results.acceptanceCriteria.filter((ac) => ac.dependsOnQuestionIds.includes(item.id)).map((ac) => ac.id);

  function start(kind) {
    if (kind === "parked") return update({ resolution: "parked", note: "", bulk: false });
    setNote(item.note ?? "");
    setChoosing(kind);
  }

  const badge = item.resolution ? (
    <span className="badges">
      <span className={`badge badge-res-${item.resolution}`}>{RESOLUTIONS[item.resolution].label}</span>
      {item.bulk && <span className="badge badge-bulk">Bulk</span>}
    </span>
  ) : (
    <span className="badge badge-draft">Open</span>
  );

  return (
    <Card item={item} ctx={ctx} isNext={isNext} title={item.question} tag={item.issue} badge={badge}>
      {askRoles.length > 0 && <p className="detail">Ask: {askRoles.join(" · ")}</p>}
      {item.resolution && item.resolution !== "parked" && (
        <p className="resolution-note"><strong>{RESOLUTIONS[item.resolution].label}:</strong> {item.note}</p>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Affects" ids={item.relatedRequirementIds} onNavigate={ctx.onNavigate} />
        <LinkChips label={item.resolution === "parked" ? "Blocking" : "Blocks"} ids={blocks} onNavigate={ctx.onNavigate} warn={!isResolved(item)} />
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
              Save
            </button>
            <button className="btn" onClick={() => setChoosing(null)}>Cancel</button>
          </div>
        </div>
      ) : item.resolution === "parked" ? (
        <div className="actions" onClick={stopClick}>
          <button className="btn btn-primary" onClick={() => start("answered")}>Answer</button>
          <button className="btn" onClick={() => start("assumption")}>Assume</button>
          <button className="btn btn-quiet" onClick={() => update({ resolution: null, note: "", bulk: false })}>Reopen</button>
        </div>
      ) : item.resolution ? (
        <div className="actions">
          <button className="btn btn-quiet" onClick={(e) => { stopClick(e); update({ resolution: null, note: "", bulk: false }); }}>
            Reopen
          </button>
        </div>
      ) : (
        <>
          <div className="actions" onClick={stopClick}>
            <button className="btn btn-primary" disabled={!!locked} onClick={() => start("answered")}>Answer</button>
            <button className="btn" disabled={!!locked} onClick={() => start("assumption")}>Assume</button>
            <button className="btn btn-quiet" disabled={!!locked} onClick={() => start("parked")}>Park</button>
          </div>
          {locked && <p className="lock-reason">🔒 {locked}</p>}
        </>
      )}
    </Card>
  );
}

export function UserStoryCard({ item, ctx, isNext }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ asA: item.asA, iWant: item.iWant, soThat: item.soThat });
  const update = (changes) => ctx.updateItem("userStories", item.id, changes);
  const fields = [["asA", "As a"], ["iWant", "I want"], ["soThat", "so that"]];

  return (
    <Card item={item} ctx={ctx} isNext={isNext} tag="story" tagKind="story"
      title={<><strong>As a</strong> {item.asA}, <strong>I want</strong> {item.iWant}</>}
      badge={<StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />}>
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
        <p className="story"><strong>so that</strong> {item.soThat}.</p>
      )}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Covers" ids={item.requirementIds} onNavigate={ctx.onNavigate} />
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

export function CriterionCard({ item, results, ctx, isNext }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ given: item.given, when: item.when, then: item.then });
  const [generating, setGenerating] = useState(false);
  const [tcError, setTcError] = useState("");
  const testCase = results.testCases?.[item.id];
  const update = (changes) => ctx.updateItem("acceptanceCriteria", item.id, changes);

  const locked = ctx.lock("criteria");
  const blockers = criterionBlockers(results, item).filter((r) => r !== locked);
  const questions = item.dependsOnQuestionIds.map((id) => results.openQuestions.find((q) => q.id === id)).filter(Boolean);
  const text = `${item.given} ${item.when} ${item.then}`;
  const placeholders = questions.filter((q) => q.resolution === "answered" && text.includes(`[TBD per ${q.id}]`));
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
    <Card item={item} ctx={ctx} isNext={isNext} keepOpenWhenDecided tag="GWT" tagKind="gwt"
      title={<WithTbd text={`Then ${item.then}`} />}
      badge={<StatusBadge status={item.status} edited={item.edited} bulk={item.bulk} />}>
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
        <LinkChips label="Depends on" ids={item.dependsOnQuestionIds} onNavigate={ctx.onNavigate} warn={questions.some((q) => !isResolved(q))} />
      </div>
      {placeholders.map((q) => (
        <p key={q.id} className="warning">{q.id} answered: “{q.note}”. Edit to replace [TBD per {q.id}].</p>
      ))}
      {item.status === "approved" && blockers.length > 0 && (
        <p className="unsupported">⚠ Re-review: {blockers.join(", ")}.</p>
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
            {generating ? "Drafting…" : testCase ? "Regenerate test case" : "Draft a test case"}
          </button>
          <span className="hint">Optional</span>
          {tcError && <p className="notice">{tcError}</p>}
        </div>
      )}
      {testCase && <TestCasePanel testCase={testCase} criterion={item} ctx={ctx} />}
    </Card>
  );
}
