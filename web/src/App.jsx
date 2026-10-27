import { useMemo, useState } from "react";
import { sampleRequest } from "../../shared/sampleRequest.js";
import { sampleResults } from "../../shared/sampleResults.js";
import { sampleTestCase } from "../../shared/sampleTestCase.js";
import { splitSentences } from "../../shared/sentences.js";
import SourcePanel from "./components/SourcePanel.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import { findItem, tabForId } from "./lib/trace.js";
import { analyzeRequest, draftTestCase } from "./lib/api.js";
import { criterionBlockers, stageLock } from "./lib/workflow.js";

export default function App() {
  const [requestText, setRequestText] = useState(sampleRequest.body);
  const [results, setResults] = useState(null);
  const [analyzedSentences, setAnalyzedSentences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState(null); // { type: "item" | "sentence", id }
  const [activeTab, setActiveTab] = useState("requirements");

  const draftSentences = useMemo(() => splitSentences(requestText), [requestText]);
  const isSample = requestText.trim() === sampleRequest.body;

  function showResults(sentences, newResults, message = "") {
    setAnalyzedSentences(sentences);
    setResults(newResults);
    setNotice(message);
    setSelection(null);
    setActiveTab("requirements");
  }

  // Sends the request to the Worker. If the server can't be reached during a demo,
  // the sample request falls back to the bundled sample results, clearly labelled.
  async function analyze() {
    setLoading(true);
    setNotice("");
    try {
      const { sentences, results: serverResults } = await analyzeRequest(requestText);
      showResults(sentences, serverResults);
    } catch (err) {
      if (err.message === "offline" && isSample) {
        showResults(draftSentences, { ...structuredClone(sampleResults), generatedBy: "sample-offline" });
      } else {
        setNotice(err.message === "offline" ? "The server can't be reached. Check that the Worker is running and try again." : err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function editRequest() {
    setResults(null);
    setSelection(null);
  }

  function updateItem(listName, id, changes) {
    setResults((r) =>
      listName === "userStory"
        ? { ...r, userStory: { ...r.userStory, ...changes } }
        : { ...r, [listName]: r[listName].map((it) => (it.id === id ? { ...it, ...changes } : it)) }
    );
  }

  // "Approve remaining" on one stage. Every item it touches is labelled Bulk.
  function bulkMark(tabKey, ids) {
    const pick = (it) => ids.includes(it.id);
    setResults((r) => {
      switch (tabKey) {
        case "requirements":
          return { ...r, requirements: r.requirements.map((it) => (pick(it) ? { ...it, status: "approved", bulk: true } : it)) };
        case "stakeholders":
          return { ...r, stakeholders: r.stakeholders.map((it) => (pick(it) ? { ...it, status: "approved", bulk: true } : it)) };
        case "questions":
          return {
            ...r,
            openQuestions: r.openQuestions.map((q) => {
              if (!pick(q)) return q;
              const who = q.askStakeholderIds.map((id) => r.stakeholders.find((s) => s.id === id)?.role).filter(Boolean);
              const note = `Assumed for now; confirm with ${who.length ? who.join(" and ") : "the requester"}.`;
              return { ...q, resolution: "assumption", note, bulk: true };
            }),
          };
        case "criteria":
          return {
            ...r,
            userStory: r.userStory && pick(r.userStory) ? { ...r.userStory, status: "approved", bulk: true } : r.userStory,
            acceptanceCriteria: r.acceptanceCriteria.map((it) => (pick(it) ? { ...it, status: "approved", bulk: true } : it)),
          };
      }
    });
  }

  function setTestCase(acId, testCase) {
    setResults((r) => ({ ...r, testCases: { ...r.testCases, [acId]: testCase } }));
  }

  // Sends one approved criterion, its requirement, its source sentences and blocking questions to the Worker.
  async function generateTestCase(acId) {
    const criterion = results.acceptanceCriteria.find((ac) => ac.id === acId);
    const requirement = results.requirements.find((r) => r.id === criterion.requirementId);
    if (!requirement) throw new Error("This criterion is not linked to a known requirement, so it can't be traced.");
    const blockers = criterionBlockers(results, criterion);
    if (criterion.status !== "approved" || blockers.length) {
      throw new Error(`This criterion isn't ready for test design. ${blockers.join(" ")}`);
    }
    const payload = {
      criterion: { id: criterion.id, given: criterion.given, when: criterion.when, then: criterion.then },
      requirement: { id: requirement.id, statement: requirement.statement },
      sentences: analyzedSentences.filter((s) => criterion.sourceSentenceIds.includes(s.id)),
      questions: results.openQuestions
        .filter((q) => criterion.dependsOnQuestionIds.includes(q.id))
        .map((q) => ({ id: q.id, question: q.question })),
    };
    try {
      setTestCase(acId, await draftTestCase(payload));
    } catch (err) {
      const sampleAc = sampleResults.acceptanceCriteria.find((ac) => ac.id === "AC-1");
      const isSampleCriterion = ["given", "when", "then"].every((k) => criterion[k] === sampleAc[k]);
      if (err.message !== "offline" || !isSampleCriterion) {
        throw new Error(err.message === "offline" ? "The server can't be reached, so no test case was drafted." : err.message);
      }
      setTestCase(acId, {
        ...sampleTestCase,
        id: acId.replace(/^AC-/, "TC-"),
        acceptanceCriterionId: acId,
        requirementId: requirement.id,
        sourceSentenceIds: payload.sentences.map((s) => s.id),
        criterionSnapshot: payload.criterion,
        status: "draft",
        generatedBy: "sample-offline",
        fallbackReason: "The server could not be reached.",
      });
    }
  }

  function navigate(id) {
    setActiveTab(tabForId(id));
    setSelection({ type: "item", id });
    setTimeout(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  const selectedItem = selection?.type === "item" ? findItem(results, selection.id) : null;
  const selectedSentence = selection?.type === "sentence" ? selection.id : null;
  const highlighted = selectedSentence ? [selectedSentence] : selectedItem?.sourceSentenceIds ?? [];

  const ctx = {
    updateItem,
    bulkMark,
    lock: (stageKey) => stageLock(results, stageKey),
    setTestCase,
    generateTestCase,
    onNavigate: navigate,
    onSelect: (id) => setSelection({ type: "item", id }),
    onSelectSentence: (id) => setSelection({ type: "sentence", id }),
    cardState: (item) => ({
      selected: selectedItem?.id === item.id,
      linked: !!selectedSentence && item.sourceSentenceIds.includes(selectedSentence),
    }),
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Requirements Assistant</h1>
          <p className="tagline">Turns a business request into draft requirements, stakeholders, open questions, a user story and acceptance criteria, each traced to its source sentence, then guides the analyst through review stage by stage.</p>
        </div>
        <span className="fictional-flag">Fictional data · demo only</span>
      </header>

      <main className="layout">
        <SourcePanel
          meta={isSample ? sampleRequest : null}
          requestText={requestText}
          setRequestText={(t) => { setRequestText(t); setNotice(""); }}
          sentences={results ? analyzedSentences : draftSentences}
          loading={loading}
          results={results}
          notice={notice}
          onAnalyze={analyze}
          onReset={() => { setRequestText(sampleRequest.body); setNotice(""); }}
          onEdit={editRequest}
          highlighted={highlighted}
          selectedSentence={selectedSentence}
          onSelectSentence={ctx.onSelectSentence}
          onNavigate={navigate}
        />
        <ResultsPanel results={results} activeTab={activeTab} setActiveTab={setActiveTab} ctx={ctx} />
      </main>
    </div>
  );
}
