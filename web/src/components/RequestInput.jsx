import { Alert, Badge, Button, FileButton, Group, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import { IconFileUpload, IconSparkles, IconRestore } from "@tabler/icons-react";

// Step zero: paste, upload or load a request, then analyze it.
export default function RequestInput({ requestText, setRequestText, sentenceCount, isSample, onAnalyze, onUseSample, notice, saved, onResume, onDiscard }) {
  return (
    <Stack gap="md">
      {saved && (
        <Alert color="indigo" variant="light" icon={<IconRestore size={18} />} title="You have a review in progress">
          <Text size="sm">Saved {new Date(saved.savedAt).toLocaleString()} in this browser.</Text>
          <Group gap="xs" mt="xs">
            <Button size="xs" onClick={onResume}>Resume review</Button>
            <Button size="xs" variant="subtle" color="gray" onClick={onDiscard}>Discard it</Button>
          </Group>
        </Alert>
      )}
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Business request</Title>
            {isSample && <Badge variant="light" color="gray">Fictional sample</Badge>}
          </Group>
          <Textarea autosize minRows={8} maxRows={18} value={requestText} onChange={(e) => setRequestText(e.currentTarget.value)}
            placeholder="Paste the request from the business team…" aria-label="Request text" />
          <Text size="xs" c="dimmed">{sentenceCount} sentences · each result will cite the sentence it came from</Text>
          <Group gap="xs">
            <Button size="md" leftSection={<IconSparkles size={18} />} onClick={onAnalyze} disabled={!requestText.trim()}>Analyze request</Button>
            <FileButton onChange={(file) => file?.text().then(setRequestText)} accept=".txt,text/plain">
              {(props) => <Button {...props} variant="default" leftSection={<IconFileUpload size={16} />}>Upload .txt</Button>}
            </FileButton>
            {!isSample && <Button variant="subtle" onClick={onUseSample}>Use the sample</Button>}
          </Group>
          {notice && <Alert color="orange" variant="light" p="xs"><Text size="sm">{notice}</Text></Alert>}
        </Stack>
      </Paper>
    </Stack>
  );
}
