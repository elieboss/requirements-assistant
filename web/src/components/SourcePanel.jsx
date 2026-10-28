import { Badge, Button, Group, Paper, Spoiler, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { LinkChips } from "./common.jsx";
import { itemsCitingSentence, requirementsCitingSentence } from "../lib/trace.js";

// The request as numbered sentences. Selected items light up their sources here.
export default function SourcePanel({ meta, sentences, results, highlighted, selectedSentence, onSelectSentence, onNavigate, onNewRequest }) {
  // On small screens the request folds to a preview so the review is reachable without long scrolling.
  const small = useMediaQuery("(max-width: 62em)");
  const list = (
    <ol className="sentences">
      {sentences.map((s) => {
        const lit = highlighted.includes(s.id);
        const uncovered = results && requirementsCitingSentence(results, s.id).length === 0;
        return (
          <li key={s.id}>
            <button className={`sentence${lit ? " is-highlighted" : ""}`} onClick={() => onSelectSentence(s.id)}>
              <span className="sentence-id">{s.id}</span>
              <span className="sentence-text">{s.text}</span>
              {uncovered && <Badge size="xs" variant="outline" color="gray" className="coverage-flag">no requirement</Badge>}
            </button>
            {results && selectedSentence === s.id && (
              <div className="cited-by">
                <LinkChips label="Cited by" ids={itemsCitingSentence(results, s.id).map((i) => i.id)} onNavigate={onNavigate} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
  return (
    <Paper withBorder p="md" radius="md" className="source-panel">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div style={{ minWidth: 0, flex: 1 }}>
            <Title order={5}>{meta?.title ?? "Business request"}</Title>
            {meta && <Text size="xs" c="dimmed">{meta.from} · {meta.organization}</Text>}
          </div>
          {onNewRequest && <Button size="xs" variant="subtle" color="gray" style={{ flexShrink: 0 }} onClick={onNewRequest}>New request</Button>}
        </Group>
        {small ? <Spoiler maxHeight={150} showLabel="Show full request" hideLabel="Hide">{list}</Spoiler> : list}
      </Stack>
    </Paper>
  );
}
