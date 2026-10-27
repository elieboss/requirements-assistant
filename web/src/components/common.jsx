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

export function StatusBadge({ status = "draft", edited }) {
  const text = { draft: "Draft · needs review", approved: "Approved by analyst", rejected: "Rejected by analyst" }[status];
  return (
    <span className="badges">
      <span className={`badge badge-${status}`}>{text}</span>
      {edited && <span className="badge badge-edited">Edited</span>}
    </span>
  );
}

export function ReviewActions({ status, editing, canEdit = true, onApprove, onReject, onReset, onEdit, onSave, onCancel }) {
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
  return (
    <div className="actions">
      {status === "draft" ? (
        <>
          <button className="btn btn-primary" onClick={stop(onApprove)}>Approve</button>
          {canEdit && <button className="btn" onClick={stop(onEdit)}>Edit</button>}
          <button className="btn btn-quiet" onClick={stop(onReject)}>Reject</button>
        </>
      ) : (
        <button className="btn btn-quiet" onClick={stop(onReset)}>Return to draft</button>
      )}
    </div>
  );
}

// Shows "[TBD per Q-1]" placeholders in amber so unresolved values stand out.
export function WithTbd({ text }) {
  return text.split(/(\[TBD[^\]]*\])/).map((part, i) =>
    part.startsWith("[TBD") ? <mark key={i} className="tbd">{part}</mark> : part
  );
}
