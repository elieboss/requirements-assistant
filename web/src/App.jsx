import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon, Badge, Button, Code, Container, Grid, Group, Stack, Text, Title, Tooltip, useComputedColorScheme, useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { sampleRequest } from "../../shared/sampleRequest.js";
import { sampleResults } from "../../shared/sampleResults.js";
import { sampleTestCase } from "../../shared/sampleTestCase.js";
import { splitSentences } from "../../shared/sentences.js";
import RequestInput from "./components/RequestInput.jsx";
import AnalysisProgress from "./components/AnalysisProgress.jsx";
import SourcePanel from "./components/SourcePanel.jsx";
import Workspace from "./components/Workspace.jsx";
import TestCaseModal from "./components/TestCaseModal.jsx";
import { findItem, tabForId } from "./lib/trace.js";
import { analyzeRequest, draftTestCase } from "./lib/api.js";
import { criterionBlockers, isResolved, overallStatus, stageLock } from "./lib/workflow.js";
import { applyBulk } from "./lib/bulk.js";
import { criteriaWithPlaceholder, fillPlaceholder } from "./lib/tbd.js";
import { clearReview, loadReview, saveReview } from "./lib/storage.js";

const OVERALL_COLORS = { "Not started": "gray", "In refinement": "blue", "Ready for test design": "green" };

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  return (
    <Tooltip label={scheme === "dark" ? "Light mode" : "Dark mode"}>
      <ActionIcon variant="default" aria-label="Toggle color scheme" onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}>
        {scheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

export default function App() {
  const [requestText, setRequestText] = useState(sampleRequest.body);
  const [results, setResults] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [phase, setPhase] = useState("input"); // input | analyzing | review
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState(null); // { type: "item" | "sentence", id }
  const [stage, setStage] = useState("requirements");
  const [focusMode, setFocusMode] = useState(false);
  const [testCaseFor, setTestCaseFor] = useState(null);
  const [saved, setSaved] = useState(() => loadReview());
  const abortRef = useRef(null);
  const groupOpener = useRef(null);

  const draftSentences = useMemo(() => splitSentences(requestText), [requestText]);
  const isSample = requestText.trim() === sampleRequest.body;

  // Autosave the review in this browser while it is in progress.
  useEffect(() => {
    if (phase === "review" && results) saveReview({ requestText, sentences, results });
  }, [phase, results, requestText, sentences]);

  function startReview(newSentences, newResults) {
    setSentences(newSentences);
    setResults(newResults);
    setSelection(null);
    setStage("requirements");
    setPhase("review");
    setSaved(null);
  }

  // Streams the analysis; progress updates drive the live checklist.
  async function analyze() {
    const controller = new AbortController();
    abortRef.current = controller;
    setNotice("");
    setProgress(null);
    setPhase("analyzing");
    try {
      const { sentences: s, results: r } = await analyzeRequest(requestText, { onProgress: setProgress, signal: controller.signal });
      startReview(s, r);
    } catch (err) {
      if (err.message === "offline" && isSample) {
        startReview(draftSentences, { ...structuredClone(sampleResults), generatedBy: "sample-offline" });
        return;
      }
      setPhase("input");
      setNotice({
        cancelled: "Analysis cancelled.",
        offline: "The server can't be reached. Check your connection and try again.",
      }[err.message] ?? err.message);
    }
  }

  // Every review action goes through here, so it can be undone from the notification.
  function commit(message, updater) {
    const previous = results;
    setResults(updater);
    notifications.clean();
    const id = `undo-${Date.now()}`;
    notifications.show({
      id,
      autoClose: 5000,
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm">{message}</Text>
          <Button size="compact-xs" variant="light" onClick={() => { setResults(previous); notifications.hide(id); }}>Undo</Button>
        </Group>
      ),
    });
  }

  function describe(listName, id, changes) {
    if (changes.edited) return `${id} edited`;
    if ("resolution" in changes) {
      return `${id} ${{ answered: "answered", assumption: "assumed", parked: "parked", asked: "marked as asked" }[changes.resolution] ?? "reset"}`;
    }
    if (listName === "stakeholders" && changes.status === "approved") return `${id} confirmed as ${changes.raci}`;
    return `${id} ${{ approved: "approved", rejected: listName === "stakeholders" ? "removed" : "rejected", draft: "reopened" }[changes.status] ?? "updated"}`;
  }

  function updateItem(listName, id, changes) {
    commit(describe(listName, id, changes), (r) => ({
      ...r,
      [listName]: r[listName].map((it) => (it.id === id ? { ...it, ...changes } : it)),
    }));
  }

  function bulkMark(stageKey, ids) {
    commit(`${ids.length} items marked in bulk`, (r) => applyBulk(r, stageKey, ids));
  }

  // Puts an answered value into every criterion that was waiting on it.
  function fillTbd(qId, value) {
    const targets = criteriaWithPlaceholder(results, qId).map((ac) => ac.id);
    commit(`Filled ${qId} into ${targets.join(", ")}`, (r) => ({
      ...r,
      acceptanceCriteria: r.acceptanceCriteria.map((ac) => (targets.includes(ac.id) ? { ...ac, ...fillPlaceholder(ac, qId, value), edited: true } : ac)),
    }));
  }

  // Copies a ready-to-send message with one person's questions, then marks them as asked.
  async function copyQuestions(group, questions) {
    const subject = (isSample ? sampleRequest.title : results.summary).replace(/\.$/, "");
    const text = [
      `Hi ${group.title},`,
      "",
      `A few questions so we can finalize the requirements for "${subject}":`,
      "",
      ...questions.map((q, i) => `${i + 1}. ${q.question}`),
      "",
      "Thanks!",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      notifications.show({
        color: "orange",
        autoClose: false,
        title: "Couldn't copy automatically. Select and copy this text:",
        message: <Code block>{text}</Code>,
      });
      return;
    }
    const ids = questions.map((q) => q.id);
    commit(`Copied ${ids.length} question${ids.length === 1 ? "" : "s"} · marked as asked`, (r) => ({
      ...r,
      openQuestions: r.openQuestions.map((q) => (ids.includes(q.id) ? { ...q, resolution: "asked", bulk: false } : q)),
    }));
  }

  // Keyboard "A" in focus mode.
  function quickApprove(item) {
    if (item.id.startsWith("Q-")) return;
    const list = { "REQ-": "requirements", "STK-": "stakeholders", "STORY-": "userStories", "AC-": "acceptanceCriteria" };
    const listName = Object.entries(list).find(([p]) => item.id.startsWith(p))[1];
    const stageKey = tabForId(item.id);
    if (stageLock(results, stageKey)) return;
    if (item.id.startsWith("AC-") && criterionBlockers(results, item).length) return;
    updateItem(listName, item.id, listName === "stakeholders" ? { status: "approved", raci: "Consulted", bulk: false } : { status: "approved", bulk: false });
  }

  function setTestCase(acId, testCase) {
    setResults((r) => ({ ...r, testCases: { ...r.testCases, [acId]: testCase } }));
  }

  // Sends one approved criterion, its requirement, its source sentences and its questions (with answers) to the Worker.
  async function generateTestCase(acId) {
    const criterion = results.acceptanceCriteria.find((ac) => ac.id === acId);
    const requirement = results.requirements.find((r) => r.id === criterion.requirementId);
    if (!requirement) throw new Error("This criterion is not linked to a known requirement, so it can't be traced.");
    const blockers = criterionBlockers(results, criterion);
    if (criterion.status !== "approved" || blockers.length) {
      throw new Error(`This criterion isn't ready for test design. ${blockers.join(", ")}`);
    }
    const payload = {
      criterion: { id: criterion.id, given: criterion.given, when: criterion.when, then: criterion.then },
      requirement: { id: requirement.id, statement: requirement.statement },
      sentences: sentences.filter((s) => criterion.sourceSentenceIds.includes(s.id)),
      questions: results.openQuestions
        .filter((q) => criterion.dependsOnQuestionIds.includes(q.id))
        .map((q) => ({ id: q.id, question: q.question, ...(isResolved(q) && { answer: q.note }) })),
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
      });
    }
  }

  function navigate(id) {
    setFocusMode(false);
    setStage(tabForId(id));
    setSelection({ type: "item", id });
    setTimeout(() => {
      groupOpener.current?.(id);
      setTimeout(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    }, 0);
  }

  function goToStep(step) {
    if (step.targetId) navigate(step.targetId);
    else setStage(step.tab);
  }

  // Back to the request screen. The current review stays saved, so "Resume review" brings it back.
  function newRequest() {
    saveReview({ requestText, sentences, results });
    setSaved(loadReview());
    setResults(null);
    setSelection(null);
    setPhase("input");
  }

  const selectedItem = selection?.type === "item" ? findItem(results, selection.id) : null;
  const selectedSentence = selection?.type === "sentence" ? selection.id : null;
  const highlighted = selectedSentence ? [selectedSentence] : selectedItem?.sourceSentenceIds ?? [];

  const ctx = {
    updateItem,
    bulkMark,
    fillTbd,
    copyQuestions,
    quickApprove,
    goToStep,
    setTestCase,
    generateTestCase,
    lock: (stageKey) => stageLock(results, stageKey),
    openTestCase: (acId) => setTestCaseFor(acId),
    registerGroupOpener: (fn) => { groupOpener.current = fn; },
    onNavigate: navigate,
    onSelect: (id) => setSelection({ type: "item", id }),
    onSelectSentence: (id) => setSelection({ type: "sentence", id }),
    cardState: (item) => ({
      selected: selectedItem?.id === item.id,
      linked: !!selectedSentence && item.sourceSentenceIds.includes(selectedSentence),
    }),
  };

  const status = overallStatus(phase === "review" ? results : null);
  const sourceLabel = {
    ai: "Drafted by AI (Claude)",
    "sample-server": "Sample results",
    "sample-fallback": "Sample results · AI unavailable",
    "sample-offline": "Offline sample · server unreachable",
  }[results?.generatedBy];

  return (
    <Container size="xl" py="md" className="app">
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <div>
          <Title order={3}>Requirements Assistant</Title>
          <Text size="sm" c="dimmed">Turn a vague request into traced, testable requirements, one small step at a time.</Text>
        </div>
        <Group gap="xs">
          {phase === "review" && <Badge size="lg" variant="light" color={OVERALL_COLORS[status]}>{status}</Badge>}
          <Badge variant="outline" color="gray">Fictional data · demo</Badge>
          <ThemeToggle />
        </Group>
      </Group>

      {phase === "input" && (
        <Container size="md" px={0}>
          <RequestInput
            requestText={requestText}
            setRequestText={(t) => { setRequestText(t); setNotice(""); }}
            sentenceCount={draftSentences.length}
            isSample={isSample}
            onAnalyze={analyze}
            onUseSample={() => setRequestText(sampleRequest.body)}
            notice={notice}
            saved={saved}
            onResume={() => { setRequestText(saved.requestText); startReview(saved.sentences, saved.results); }}
            onDiscard={() => { clearReview(); setSaved(null); }}
          />
        </Container>
      )}

      {phase !== "input" && (
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <div className="sticky-col">
              <SourcePanel
                meta={isSample ? sampleRequest : null}
                sentences={phase === "review" ? sentences : draftSentences}
                results={phase === "review" ? results : null}
                highlighted={highlighted}
                selectedSentence={selectedSentence}
                onSelectSentence={ctx.onSelectSentence}
                onNavigate={navigate}
                onNewRequest={phase === "review" ? newRequest : null}
              />
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            {phase === "analyzing" ? (
              <AnalysisProgress progress={progress} sentenceCount={draftSentences.length} onCancel={() => abortRef.current?.abort()} />
            ) : (
              <Stack gap="sm">
                <Group gap="xs">
                  <Badge variant="light" color="yellow">Draft · needs analyst review</Badge>
                  <Text size="xs" c="dimmed">{sourceLabel}</Text>
                  {results.citationCheck && (
                    <Badge variant="light" color={results.citationCheck.issues.length ? "red" : "green"}>
                      {results.citationCheck.issues.length ? `${results.citationCheck.issues.length} citation issues` : `${results.citationCheck.itemCount} citations checked`}
                    </Badge>
                  )}
                </Group>
                {results.fallbackReason && <Text size="xs" c="dimmed">{results.fallbackReason}</Text>}
                <Workspace results={results} stage={stage} setStage={setStage} focusMode={focusMode} setFocusMode={setFocusMode} ctx={ctx} />
              </Stack>
            )}
          </Grid.Col>
        </Grid>
      )}

      {testCaseFor && results && (
        <TestCaseModal acId={testCaseFor} results={results} ctx={ctx} onClose={() => setTestCaseFor(null)} />
      )}
    </Container>
  );
}
