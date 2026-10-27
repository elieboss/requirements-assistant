import { useMemo, useState } from "react";
import { sampleRequest } from "../../shared/sampleRequest.js";
import { sampleResults } from "../../shared/sampleResults.js";
import { splitSentences } from "../../shared/sentences.js";
import SourcePanel from "./components/SourcePanel.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import { findItem, tabForId } from "./lib/trace.js";

export default function App() {
  const [requestText, setRequestText] = useState(sampleRequest.body);
  const [results, setResults] = useState(null);
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState(null); // { type: "item" | "sentence", id }
  const [activeTab, setActiveTab] = useState("requirements");

  const sentences = useMemo(() => splitSentences(requestText), [requestText]);
  const isSample = requestText.trim() === sampleRequest.body;

  // Step 2: analysis returns the pre-written sample results. Step 3 moves this behind the server endpoint.
  function analyze() {
    if (!isSample) {
      setNotice("Live analysis of other requests is connected in Step 4. For now, use the sample request.");
      return;
    }
    setResults(structuredClone(sampleResults));
    setNotice("");
    setSelection(null);
    setActiveTab("requirements");
  }

  function editRequest() {
    setResults(null);
    setSelection(null);
  }

  function updateItem(listName, id, changes) {
    setResults((r) => ({ ...r, [listName]: r[listName].map((it) => (it.id === id ? { ...it, ...changes } : it)) }));
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
          <p className="tagline">Turns a business request into draft requirements, stakeholders, open questions and acceptance criteria, each traced to its source sentence.</p>
        </div>
        <span className="fictional-flag">Fictional data · demo only</span>
      </header>

      <main className="layout">
        <SourcePanel
          meta={isSample ? sampleRequest : null}
          requestText={requestText}
          setRequestText={(t) => { setRequestText(t); setNotice(""); }}
          sentences={sentences}
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
