import { useState } from "react";
import { LinkChips } from "./common.jsx";
import { nextStep, readiness, stageProgress } from "../lib/workflow.js";

// The stage bar: refinement order, progress per stage, and which stages are still locked.
export function StageBar({ results, activeTab, onOpen }) {
  const stages = stageProgress(results);
  return (
    <ol className="stage-bar" aria-label="Refinement stages: choose one to open it">
      {stages.map((s, i) => {
        const state = s.complete ? "done" : s.unlocked ? "open" : "locked";
        const isActive = s.tab === activeTab && !s.optional;
        return (
          <li key={s.key}>
            <button
              className={`stage stage-${state}${isActive ? " is-active" : ""}${s.optional ? " is-optional" : ""}`}
              onClick={() => onOpen(s.tab)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="stage-num" aria-hidden="true">{s.complete ? "✓" : state === "locked" ? "🔒" : i + 1}</span>
              <span className="stage-text">
                <span className="stage-label">{s.label}</span>
                {s.optional && <span className="stage-count">optional</span>}
                <span className="stage-count">
                  {s.total === null ? `${s.done} drafted` : `${s.done} of ${s.total}`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// "What should I do now?" in one line, with the Definition of Ready behind a toggle.
export function NextStep({ results, onGo, onNavigate }) {
  const step = nextStep(results);
  const ready = readiness(results);
  const met = ready.checklist.filter((c) => c.met).length;
  const gaps = [
    ["Parked", ready.parked],
    ["No approved criterion", ready.uncovered],
    ["Not in a story", ready.noStory],
  ].filter(([, ids]) => ids.length);

  return (
    <section className={`next-box${step.ready ? " is-ready" : ""}`} aria-live="polite">
      <p className="next-line">
        <strong>{step.title}</strong> <span className="next-detail">{step.detail}</span>
      </p>
      <button className="btn btn-primary" onClick={() => onGo(step)}>Go</button>
      <details className="dor">
        <summary>Definition of Ready · {met}/{ready.checklist.length}</summary>
        <ul>
          {ready.checklist.map((c) => (
            <li key={c.label} className={c.met ? "met" : ""}>{c.met ? "✓" : "○"} {c.label}</li>
          ))}
        </ul>
        {gaps.map(([label, ids]) => (
          <div key={label} className="dor-note"><LinkChips label={label} ids={ids} onNavigate={onNavigate} warn /></div>
        ))}
      </details>
    </section>
  );
}

// Demo shortcut: review a few items live, then mark the rest. Items are labelled "Bulk" so it stays honest.
export function BulkAction({ count, label, confirmText, locked, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (count === 0 || locked) return null;
  return (
    <div className="bulk">
      {confirming ? (
        <>
          <span>{confirmText}</span>
          <button className="btn btn-primary" onClick={() => { onConfirm(); setConfirming(false); }}>Yes</button>
          <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-quiet" onClick={() => setConfirming(true)}>{label} ({count})</button>
      )}
    </div>
  );
}
