import { useState } from "react";
import { LinkChips, ReviewActions, SentenceChips, StatusBadge, WithTbd } from "./common.jsx";
import { criteriaForRequirement, questionsForRequirement, questionsForStakeholder } from "../lib/trace.js";

function Card({ id, selected, linked, status, onSelect, children }) {
  const cls = ["card", selected && "is-selected", linked && "is-linked", status && `is-${status}`].filter(Boolean).join(" ");
  return (
    <article id={`card-${id}`} className={cls} onClick={() => onSelect(id)}>
      {children}
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

export function RequirementCard({ item, results, ctx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.statement);
  const update = (changes) => ctx.updateItem("requirements", item.id, changes);

  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag={item.type}>
        <StatusBadge status={item.status} edited={item.edited} />
      </CardHead>
      {editing ? (
        <textarea className="edit-box" value={draft} onClick={(e) => e.stopPropagation()} onChange={(e) => setDraft(e.target.value)} rows={3} />
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
        onApprove={() => update({ status: "approved" })}
        onReject={() => update({ status: "rejected" })}
        onReset={() => update({ status: "draft" })}
        onEdit={() => { setDraft(item.statement); setEditing(true); }}
        onSave={() => { update({ statement: draft.trim(), edited: true }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </Card>
  );
}

export function StakeholderCard({ item, results, ctx }) {
  return (
    <Card id={item.id} {...ctx.cardState(item)} onSelect={ctx.onSelect}>
      <CardHead
        id={item.id}
        tag={item.inferred ? "inferred · confirm" : "named in request"}
        tagKind={item.inferred ? "inferred" : "named"}
      />
      <p className="statement"><strong>{item.role}</strong></p>
      <p className="detail">{item.interest}</p>
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Questions for them" ids={questionsForStakeholder(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
      </div>
    </Card>
  );
}

export function QuestionCard({ item, results, ctx }) {
  const askRoles = item.askStakeholderIds
    .map((id) => results.stakeholders.find((s) => s.id === id)?.role)
    .filter(Boolean)
    .join("; ");
  return (
    <Card id={item.id} {...ctx.cardState(item)} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag={item.issue} />
      <p className="statement">{item.question}</p>
      {askRoles && <p className="detail">Ask: {askRoles}</p>}
      <div className="trace-row">
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Affects" ids={item.relatedRequirementIds} onNavigate={ctx.onNavigate} />
        <LinkChips label="Ask" ids={item.askStakeholderIds} onNavigate={ctx.onNavigate} />
      </div>
    </Card>
  );
}

export function CriterionCard({ item, ctx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ given: item.given, when: item.when, then: item.then });
  const update = (changes) => ctx.updateItem("acceptanceCriteria", item.id, changes);
  const stop = (e) => e.stopPropagation();

  return (
    <Card id={item.id} {...ctx.cardState(item)} status={item.status} onSelect={ctx.onSelect}>
      <CardHead id={item.id} tag="given / when / then" tagKind="gwt">
        <StatusBadge status={item.status} edited={item.edited} />
      </CardHead>
      {editing ? (
        <div className="gwt-edit">
          {["given", "when", "then"].map((k) => (
            <label key={k}>
              <span className="gwt-key">{k}</span>
              <textarea className="edit-box" rows={2} value={draft[k]} onClick={stop} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
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
        <LinkChips label="Blocked by" ids={item.dependsOnQuestionIds} onNavigate={ctx.onNavigate} warn />
      </div>
      {item.status === "draft" && item.dependsOnQuestionIds.length > 0 && !editing && (
        <p className="warning">Depends on open questions. Resolve them, or note the assumption, before approving.</p>
      )}
      <ReviewActions
        status={item.status}
        editing={editing}
        onApprove={() => update({ status: "approved" })}
        onReject={() => update({ status: "rejected" })}
        onReset={() => update({ status: "draft" })}
        onEdit={() => { setDraft({ given: item.given, when: item.when, then: item.then }); setEditing(true); }}
        onSave={() => { update({ ...draft, edited: true }); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
      {item.status === "approved" && (
        <div className="next-step">
          <button className="btn" disabled title="Added in Step 5">Generate draft test case (Step 5)</button>
        </div>
      )}
    </Card>
  );
}
