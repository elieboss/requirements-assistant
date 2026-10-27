// Small building blocks shared by every results tab.

export function SentenceChips({ ids, onSelectSentence }) {
  return (
    <span className="chips">
      <span className="chips-label">Source</span>
      {ids.map((id) => (
        <button
          key={id}
          className="chip chip-source"
          title="Highlight this sentence in the request"
          onClick={(e) => {
            e.stopPropagation();
            onSelectSentence(id);
          }}
        >
          {id}
        </button>
      ))}
    </span>
  );
}

export function LinkChips({ label, ids, onNavigate, warn = false }) {
  if (!ids.length) return null;
  return (
    <span className="chips">
      <span className="chips-label">{label}</span>
      {ids.map((id) => (
        <button
          key={id}
          className={`chip chip-link${warn ? " chip-warn" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(id);
          }}
        >
          {id}
        </button>
      ))}
    </span>
  );
}

export function StatusBadge({ status = "draft", edited, bulk, labels = {} }) {
  const text = {
    draft: "Draft · needs review",
    approved: labels.approved ?? "Approved by analyst",
    rejected: labels.rejected ?? "Rejected by analyst",
  }[status];
  return (
    <span className="badges">
      <span className={`badge badge-${status}`}>{text}</span>
      {bulk && status !== "draft" && <span className="badge badge-bulk" title="Marked in bulk with 'Approve remaining'">Bulk</span>}
      {edited && <span className="badge badge-edited">Edited</span>}
    </span>
  );
}

// Approve / Edit / Reject for one item.
// `locked` disables everything (an earlier stage isn't finished); `approveBlockers` disables only Approve.
export function ReviewActions({
  status, editing, canEdit = true, locked = null, approveBlockers = [], labels = {},
  onApprove, onReject, onReset, onEdit, onSave, onCancel,
}) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  if (editing) {
    return (
      <div className="actions">
        <button className="btn btn-primary" onClick={stop(onSave)}>Save edit</button>
        <button className="btn" onClick={stop(onCancel)}>Cancel</button>
      </div>
    );
  }
  if (status !== "draft") {
    return (
      <div className="actions">
        <button className="btn btn-quiet" onClick={stop(onReset)}>Return to draft</button>
      </div>
    );
  }
  const blockers = locked ? [locked] : approveBlockers;
  return (
    <>
      <div className="actions">
        <button className="btn btn-primary" onClick={stop(onApprove)} disabled={blockers.length > 0}>
          {labels.approve ?? "Approve"}
        </button>
        {canEdit && <button className="btn" onClick={stop(onEdit)} disabled={!!locked}>Edit</button>}
        <button className="btn btn-quiet" onClick={stop(onReject)} disabled={!!locked}>{labels.reject ?? "Reject"}</button>
      </div>
      {blockers.length > 0 && (
        <p className="lock-reason">
          <span aria-hidden="true">🔒 </span>
          {locked ?? `Can't approve yet: ${blockers.join(" ")}`}
        </p>
      )}
    </>
  );
}

// Shows "[TBD per Q-1]" placeholders in amber so unresolved values stand out.
export function WithTbd({ text }) {
  return text.split(/(\[TBD[^\]]*\])/).map((part, i) =>
    part.startsWith("[TBD") ? <mark key={i} className="tbd">{part}</mark> : part
  );
}
