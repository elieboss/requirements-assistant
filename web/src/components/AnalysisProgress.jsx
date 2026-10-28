import { useEffect, useState } from "react";
import { Button, Group, Loader, Paper, Progress, Stack, Text, ThemeIcon, Timeline, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

const STEPS = [
  { key: "read", label: "Reading the request" },
  { key: "thinking", label: "Planning the analysis" },
  { key: "requirements", label: "Requirements", noun: "found" },
  { key: "stakeholders", label: "Stakeholders", noun: "found" },
  { key: "openQuestions", label: "Open questions", noun: "raised" },
  { key: "userStories", label: "User stories", noun: "written" },
  { key: "acceptanceCriteria", label: "Acceptance criteria", noun: "written" },
  { key: "checking", label: "Checking every citation" },
];

// Which step is happening now, from the latest progress update.
function activeIndex(progress) {
  if (!progress) return 0;
  if (progress.phase === "checking") return 7;
  if (progress.phase === "writing" && progress.section) return STEPS.findIndex((s) => s.key === progress.section);
  if (progress.phase === "thinking" || progress.phase === "writing") return 1;
  return progress.phase === "read" ? 1 : 0;
}

// Live progress while Claude drafts: real steps and counts, elapsed time, and a way to stop.
export default function AnalysisProgress({ progress, sentenceCount, onCancel }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const active = activeIndex(progress);
  const counts = progress?.counts ?? {};
  const detail = (step, i) => {
    if (step.key === "read") return `${progress?.sentenceCount ?? sentenceCount} sentences, numbered for tracing`;
    if (step.key === "thinking") return i === active ? "Claude is reading the request and planning" : "Done";
    if (step.noun) return counts[step.key] ? `${counts[step.key]} ${step.noun}${i === active ? " so far" : ""}` : i < active ? "None" : "";
    if (step.key === "checking") return "Making sure every item points at a real sentence";
    return "";
  };

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Drafting the analysis</Title>
            <Text size="sm" c="dimmed">{elapsed}s · usually 30–90 seconds. You can read the request while you wait.</Text>
          </div>
          <Button variant="default" size="xs" onClick={onCancel}>Cancel</Button>
        </Group>
        <Progress value={((active + 0.5) / STEPS.length) * 100} animated size="sm" />
        <Timeline active={active} bulletSize={22} lineWidth={2}>
          {STEPS.map((step, i) => (
            <Timeline.Item key={step.key} title={<Text size="sm" fw={i === active ? 700 : 500} c={i > active ? "dimmed" : undefined}>{step.label}</Text>}
              bullet={i < active ? <ThemeIcon size={22} radius="xl" color="indigo"><IconCheck size={12} /></ThemeIcon> : i === active ? <Loader size={14} /> : null}>
              {detail(step, i) && <Text size="xs" c="dimmed">{detail(step, i)}</Text>}
            </Timeline.Item>
          ))}
        </Timeline>
      </Stack>
    </Paper>
  );
}
