import { useEffect, useMemo, useState } from "react";
import {
  Accordion, Alert, Badge, Button, Group, Kbd, Paper, Popover, Progress, SimpleGrid, Stack, Switch, Text, ThemeIcon, Title, UnstyledButton,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconArrowLeft, IconArrowRight, IconCheck, IconCopy, IconLock, IconListCheck } from "@tabler/icons-react";
import { ItemFor } from "./items.jsx";
import { LinkChips, StatusPill } from "./common.jsx";
import { groupsFor } from "../lib/groups.js";
import { BULK, bulkEligible } from "../lib/bulk.js";
import { STAGES, STATUS_COLORS, criterionBlockers, groupStatus, isPending, nextStep, readiness, stageProgress, stageStatus } from "../lib/workflow.js";

const REVIEW_STAGES = STAGES.filter((s) => !s.optional);

// Stage navigation: one tile per stage with its status in plain words.
function StageNav({ results, active, onOpen }) {
  const stages = stageProgress(results);
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
      {REVIEW_STAGES.map((stage, i) => {
        const s = stages.find((x) => x.key === stage.key);
        const status = stageStatus(results, stage.key);
        const isActive = active === stage.key;
        return (
          <UnstyledButton key={stage.key} onClick={() => onOpen(stage.key)} className={`stage-tile${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "step" : undefined}>
            <Group gap={8} wrap="nowrap" align="flex-start">
              <ThemeIcon size={24} radius="xl" variant={status === "Done" ? "filled" : "light"} color={STATUS_COLORS[status]}>
                {status === "Done" ? <IconCheck size={14} /> : status === "Locked" ? <IconLock size={13} /> : <Text size="xs" fw={700}>{i + 1}</Text>}
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} lh={1.25}>{stage.label}</Text>
                <Text size="xs" c="dimmed">{status} · {s.done}/{s.total}</Text>
              </div>
            </Group>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}

// One line: what to do now. The Definition of Ready sits in a popover.
function NextStepBar({ results, onGo, onNavigate }) {
  const step = nextStep(results);
  const ready = readiness(results);
  const met = ready.checklist.filter((c) => c.met).length;
  const gaps = [["Parked", ready.parked], ["No approved criterion", ready.uncovered], ["Not in a story", ready.noStory]].filter(([, ids]) => ids.length);
  return (
    <Alert variant="light" color={step.ready ? "green" : "indigo"} p="sm">
      <Group justify="space-between" gap="xs" wrap="wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} size="sm">{step.title}</Text>
          <Text size="xs" c="dimmed">{step.detail}</Text>
        </div>
        <Group gap="xs">
          <Popover width={300} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Button size="xs" variant="default" leftSection={<IconListCheck size={14} />}>Ready {met}/{ready.checklist.length}</Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Text size="sm" fw={700} mb={6}>Definition of Ready</Text>
              <Stack gap={4}>
                {ready.checklist.map((c) => (
                  <Text key={c.label} size="sm" c={c.met ? "green" : "dimmed"}>{c.met ? "✓" : "○"} {c.label}</Text>
                ))}
                {gaps.map(([label, ids]) => <LinkChips key={label} label={label} ids={ids} onNavigate={onNavigate} warn />)}
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Button size="xs" onClick={() => onGo(step)}>Go</Button>
        </Group>
      </Group>
    </Alert>
  );
}

function BulkButton({ results, stageKey, ctx }) {
  const [confirming, setConfirming] = useState(false);
  const ids = bulkEligible(results, stageKey);
  if (!ids.length || ctx.lock(stageKey)) return null;
  return confirming ? (
    <Group gap={6}>
      <Text size="xs">{BULK[stageKey].confirm}</Text>
      <Button size="xs" onClick={() => { ctx.bulkMark(stageKey, ids); setConfirming(false); }}>Yes</Button>
      <Button size="xs" variant="subtle" color="gray" onClick={() => setConfirming(false)}>Cancel</Button>
    </Group>
  ) : (
    <Button size="xs" variant="subtle" onClick={() => setConfirming(true)}>{BULK[stageKey].label} ({ids.length})</Button>
  );
}

// A copy-ready message with every question for one person; marks them "Asked, waiting".
function CopyQuestions({ group, results, ctx }) {
  const open = group.items.filter((q) => !q.resolution || q.resolution === "parked");
  if (!open.length || ctx.lock("questions")) return null;
  return (
    <Button size="xs" variant="light" color="violet" leftSection={<IconCopy size={14} />} onClick={() => ctx.copyQuestions(group, open)}>
      Copy {open.length} question{open.length === 1 ? "" : "s"} for {group.title}
    </Button>
  );
}

// Chunked view: groups open one at a time, and the next unfinished group opens when one is done.
function GroupList({ results, stageKey, ctx }) {
  const groups = groupsFor(results, stageKey);
  const statuses = groups.map((g) => groupStatus(results, g.items));
  const firstOpen = groups[statuses.findIndex((s) => s !== "Done")]?.key ?? groups[0]?.key ?? null;
  const [openKey, setOpenKey] = useState(firstOpen);
  const statusKey = statuses.join("|");

  useEffect(() => { setOpenKey(firstOpen); }, [stageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const i = groups.findIndex((g) => g.key === openKey);
    if (i >= 0 && statuses[i] === "Done") {
      const next = groups.findIndex((g, j) => j > i && statuses[j] !== "Done");
      if (next >= 0) setOpenKey(groups[next].key);
    }
  }, [statusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => ctx.registerGroupOpener((itemId) => {
    const g = groups.find((x) => x.items.some((it) => it.id === itemId));
    if (g) setOpenKey(g.key);
  }));

  return (
    <Accordion value={openKey} onChange={setOpenKey} variant="separated" chevronPosition="left" radius="md">
      {groups.map((g, i) => {
        const done = g.items.filter((it) => !isPending(it)).length;
        return (
          <Accordion.Item key={g.key} value={g.key}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{g.title}</Text>
                  {g.hint && <Text size="xs" c="dimmed">{g.hint}</Text>}
                </div>
                <Group gap={6} wrap="nowrap">
                  <Text size="xs" c="dimmed">{done}/{g.items.length}</Text>
                  <StatusPill status={statuses[i]} />
                </Group>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {stageKey === "questions" && <CopyQuestions group={g} results={results} ctx={ctx} />}
                {g.items.map((item) => <ItemFor key={item.id} item={item} results={results} ctx={ctx} />)}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

// Focus mode: one item at a time, with keyboard shortcuts.
function FocusView({ results, stageKey, ctx }) {
  const queue = useMemo(
    () => groupsFor(results, stageKey).flatMap((g) => g.items)
      .filter((it) => isPending(it) && !(it.id.startsWith("AC-") && criterionBlockers(results, it).length)),
    [results, stageKey]
  );
  const [index, setIndex] = useState(0);
  const i = Math.min(index, Math.max(queue.length - 1, 0));
  const item = queue[i];
  const move = (d) => setIndex(Math.max(0, Math.min(queue.length - 1, i + d)));

  useHotkeys([
    ["a", () => item && ctx.quickApprove(item)],
    ["ArrowRight", () => move(1)], ["j", () => move(1)],
    ["ArrowLeft", () => move(-1)], ["k", () => move(-1)],
    ...[1, 2, 3, 4].map((n) => [String(n), () => item?.suggestedAnswers?.[n - 1] && ctx.updateItem("openQuestions", item.id, { resolution: "answered", note: item.suggestedAnswers[n - 1] })]),
  ]);

  if (!item) {
    return <Paper withBorder p="lg" radius="md"><Text fw={600}>Nothing left to review in this stage.</Text><Text size="sm" c="dimmed">Blocked items appear once what blocks them is resolved.</Text></Paper>;
  }
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{queue.length} left · item {i + 1} of {queue.length}</Text>
        <Group gap={6}>
          <Button size="xs" variant="default" leftSection={<IconArrowLeft size={14} />} disabled={i === 0} onClick={() => move(-1)}>Previous</Button>
          <Button size="xs" variant="default" rightSection={<IconArrowRight size={14} />} disabled={i >= queue.length - 1} onClick={() => move(1)}>Skip</Button>
        </Group>
      </Group>
      <Progress value={(1 - queue.length / Math.max(groupsFor(results, stageKey).flatMap((g) => g.items).length, 1)) * 100} size="sm" />
      <ItemFor item={item} results={results} ctx={ctx} focus />
      <Text size="xs" c="dimmed">
        <Kbd>A</Kbd> approve · <Kbd>←</Kbd> <Kbd>→</Kbd> previous / skip{stageKey === "questions" && <> · <Kbd>1</Kbd>–<Kbd>4</Kbd> pick an answer</>}
      </Text>
    </Stack>
  );
}

export default function Workspace({ results, stage, setStage, focusMode, setFocusMode, ctx }) {
  const lock = ctx.lock(stage);
  const label = REVIEW_STAGES.find((s) => s.key === stage).label;
  return (
    <Stack gap="sm">
      <StageNav results={results} active={stage} onOpen={setStage} />
      <NextStepBar results={results} onGo={ctx.goToStep} onNavigate={ctx.onNavigate} />
      <Group justify="space-between" gap="xs" mt={4}>
        <Group gap="xs">
          <Title order={4}>{label}</Title>
          <StatusPill status={stageStatus(results, stage)} />
        </Group>
        <Group gap="sm">
          <BulkButton results={results} stageKey={stage} ctx={ctx} />
          <Switch size="sm" label="Focus mode" checked={focusMode}
            onChange={(e) => { setFocusMode(e.currentTarget.checked); e.currentTarget.blur(); /* so keyboard shortcuts work right away */ }} />
        </Group>
      </Group>
      {lock && <Alert color="gray" variant="light" p="xs" icon={<IconLock size={16} />}><Text size="sm">View only · {lock}</Text></Alert>}
      {focusMode && !lock ? <FocusView results={results} stageKey={stage} ctx={ctx} /> : <GroupList results={results} stageKey={stage} ctx={ctx} />}
    </Stack>
  );
}
