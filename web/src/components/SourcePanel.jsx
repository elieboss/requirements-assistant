import { LinkChips } from "./common.jsx";
import { itemsCitingSentence, requirementsCitingSentence } from "../lib/trace.js";

// Left side: the business request. Before analysis it is an editable text box;
// after analysis it becomes numbered sentences that highlight when cited.
export default function SourcePanel({
  meta, requestText, setRequestText, sentences, results, notice,
  onAnalyze, onReset, onEdit, highlighted, selectedSentence, onSelectSentence, onNavigate,
}) {
  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (file) file.text().then(setRequestText);
    e.target.value = "";
  }

  return (
    <section className="panel source-panel">
      <div className="panel-head">
        <h2>Business request</h2>
        {meta && (
          <p className="meta">
            <strong>{meta.title}</strong>
            <br />
            From {meta.from}, {meta.organization}
          </p>
        )}
      </div>

      {!results ? (
        <>
          <label className="field-label" htmlFor="request-text">Paste or upload a request</label>
          <textarea
            id="request-text"
            className="request-input"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={14}
          />
          <div className="actions">
            <button className="btn btn-primary" onClick={onAnalyze} disabled={!requestText.trim()}>
              Analyze request
            </button>
            <label className="btn">
              Upload .txt
              <input type="file" accept=".txt,text/plain" onChange={handleUpload} hidden />
            </label>
            <button className="btn btn-quiet" onClick={onReset}>Reset to sample</button>
          </div>
          {notice && <p className="notice">{notice}</p>}
          <p className="hint">The request is split into {sentences.length} numbered sentences. Every result must cite them.</p>
        </>
      ) : (
        <>
          <ol className="sentences">
            {sentences.map((s) => {
              const isHighlighted = highlighted.includes(s.id);
              const isSelected = selectedSentence === s.id;
              const hasRequirement = requirementsCitingSentence(results, s.id).length > 0;
              return (
                <li key={s.id}>
                  <button
                    className={`sentence${isHighlighted ? " is-highlighted" : ""}`}
                    onClick={() => onSelectSentence(s.id)}
                  >
                    <span className="sentence-id">{s.id}</span>
                    <span className="sentence-text">{s.text}</span>
                    {!hasRequirement && <span className="coverage-flag">No requirement cites this</span>}
                  </button>
                  {isSelected && (
                    <div className="cited-by">
                      <LinkChips
                        label="Cited by"
                        ids={itemsCitingSentence(results, s.id).map((i) => i.id)}
                        onNavigate={onNavigate}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="actions">
            <button className="btn btn-quiet" onClick={onEdit}>Edit request (clears results)</button>
          </div>
        </>
      )}
    </section>
  );
}
