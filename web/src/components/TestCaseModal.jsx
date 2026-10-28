import { useEffect, useState } from "react";
import { Alert, Badge, Button, Group, List, Loader, Modal, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { LinkChips, SentenceChips, WithTbd } from "./common.jsx";

// The optional last step: a draft test case for one approved criterion, in its own window.
export default function TestCaseModal({ acId, results, ctx, onClose }) {
  const criterion = results.acceptanceCriteria.find((ac) => ac.id === acId);
  const testCase = results.testCases?.[acId];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  async function generate() {
    setBusy(true);
    setError("");
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    try {
      await ctx.generateTestCase(acId);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }
  useEffect(() => { if (!testCase) generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stale = testCase && ["given", "when", "then"].some((k) => testCase.criterionSnapshot[k] !== criterion[k]);
  const setStatus = (status) => ctx.setTestCase(acId, { ...testCase, status });

  return (
    <Modal opened onClose={onClose} size="xl" title={<Text fw={700}>{testCase?.id ?? acId.replace("AC-", "TC-")} · Draft test case</Text>}>
      {busy && (
        <Stack align="center" py="xl" gap="xs">
          <Loader />
          <Text fw={600}>Drafting steps, test data and edge cases…</Text>
          <Text size="sm" c="dimmed">{elapsed}s · usually 15–40 seconds</Text>
        </Stack>
      )}
      {error && !busy && <Alert color="red" variant="light" mb="sm">{error}</Alert>}
      {testCase && !busy && (
        <Stack gap="sm">
          <Alert color="yellow" variant="light" p="xs">
            <Text size="sm"><b>Draft for analyst review.</b> {testCase.generatedBy === "ai" ? "Written by AI." : "Pre-written sample (AI unavailable)."} A real team would adapt this to its own template, tools and process.</Text>
          </Alert>
          {stale && <Alert color="orange" variant="light" p="xs"><Text size="sm">The criterion changed after this was drafted. Regenerate before relying on it.</Text></Alert>}
          <Group gap="md">
            <LinkChips label="Verifies" ids={[testCase.acceptanceCriterionId, testCase.requirementId]} onNavigate={(id) => { onClose(); ctx.onNavigate(id); }} />
            <SentenceChips ids={testCase.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
            <Badge variant="light" color={{ draft: "yellow", approved: "green", rejected: "red" }[testCase.status]}>{{ draft: "To review", approved: "Approved", rejected: "Rejected" }[testCase.status]}</Badge>
          </Group>
          <div>
            <Title order={5}>{testCase.title}</Title>
            <Text size="sm" c="dimmed">{testCase.objective}</Text>
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div><Text size="xs" fw={700} c="dimmed" tt="uppercase">Preconditions</Text><List size="sm">{testCase.preconditions.map((p) => <List.Item key={p}><WithTbd text={p} /></List.Item>)}</List></div>
            <div><Text size="xs" fw={700} c="dimmed" tt="uppercase">Test data (fictional)</Text><List size="sm">{testCase.testData.map((d) => <List.Item key={d}>{d}</List.Item>)}</List></div>
          </SimpleGrid>
          <Table.ScrollContainer minWidth={480}>
            <Table striped withTableBorder verticalSpacing="xs">
              <Table.Thead><Table.Tr><Table.Th w={36}>#</Table.Th><Table.Th>Action</Table.Th><Table.Th>Expected result</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {testCase.steps.map((s, i) => (
                  <Table.Tr key={i}><Table.Td>{i + 1}</Table.Td><Table.Td>{s.action}</Table.Td><Table.Td><WithTbd text={s.expected} /></Table.Td></Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Alert variant="light" color="gray" title="Suggested for the analyst (not part of the test case)">
            <Text size="xs" fw={700} mt={4}>Edge cases</Text>
            <List size="sm">{testCase.edgeCases.map((e) => <List.Item key={e.scenario}><b>{e.scenario}</b> {e.why}</List.Item>)}</List>
            <Text size="xs" fw={700} mt={6}>Coverage gaps</Text>
            <List size="sm">{testCase.coverageGaps.map((g) => <List.Item key={g}>{g}</List.Item>)}</List>
            {testCase.assumptions.length > 0 && <>
              <Text size="xs" fw={700} mt={6}>Assumptions</Text>
              <List size="sm">{testCase.assumptions.map((a) => <List.Item key={a}><WithTbd text={a} /></List.Item>)}</List>
            </>}
          </Alert>
          <Group justify="space-between">
            <Button variant="subtle" onClick={generate}>Regenerate</Button>
            <Group gap="xs">
              {testCase.status === "draft" ? (
                <>
                  <Button color="green" onClick={() => setStatus("approved")}>Approve</Button>
                  <Button variant="subtle" color="red" onClick={() => setStatus("rejected")}>Reject</Button>
                </>
              ) : (
                <Button variant="default" onClick={() => setStatus("draft")}>Reopen</Button>
              )}
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
