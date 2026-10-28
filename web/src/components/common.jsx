import { useState } from "react";
import { Badge, Button, Group, Mark, Menu, Text, TextInput } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { STATUS_COLORS } from "../lib/workflow.js";

// Source sentence chips: click to highlight the sentence in the request.
export function SentenceChips({ ids, onSelectSentence }) {
  if (!ids?.length) return null;
  return (
    <Group gap={4} wrap="wrap">
      <Text size="xs" c="dimmed">Source</Text>
      {ids.map((id) => (
        <Badge key={id} component="button" variant="light" color="yellow" size="sm" className="chip-btn"
          onClick={(e) => { e.stopPropagation(); onSelectSentence(id); }}>
          {id}
        </Badge>
      ))}
    </Group>
  );
}

// Links to other items: click to jump there.
export function LinkChips({ label, ids, onNavigate, warn = false }) {
  if (!ids?.length) return null;
  return (
    <Group gap={4} wrap="wrap">
      <Text size="xs" c="dimmed">{label}</Text>
      {ids.map((id) => (
        <Badge key={id} component="button" variant="outline" color={warn ? "orange" : "indigo"} size="sm" className="chip-btn"
          onClick={(e) => { e.stopPropagation(); onNavigate(id); }}>
          {id}
        </Badge>
      ))}
    </Group>
  );
}

export function StatusPill({ status }) {
  return <Badge variant="light" color={STATUS_COLORS[status] ?? "gray"} size="sm">{status}</Badge>;
}

// Item-level decision badge.
export function DecisionBadge({ item, labels = {} }) {
  const map = {
    draft: ["To review", "yellow"],
    approved: [labels.approved ?? "Approved", "green"],
    rejected: [labels.rejected ?? "Rejected", "red"],
  };
  const [text, color] = map[item.status ?? "draft"];
  return (
    <Group gap={4} wrap="nowrap">
      <Badge variant="light" color={color} size="sm">{text}{item.raci && item.status === "approved" ? ` · ${item.raci}` : ""}</Badge>
      {item.bulk && item.status !== "draft" && <Badge variant="outline" color="gray" size="sm">Bulk</Badge>}
      {item.edited && <Badge variant="outline" color="indigo" size="sm">Edited</Badge>}
    </Group>
  );
}

// Shows "[TBD per Q-1]" placeholders highlighted so unresolved values stand out.
export function WithTbd({ text }) {
  return text.split(/(\[TBD[^\]]*\])/).map((part, i) =>
    part.startsWith("[TBD") ? <Mark key={i} color="orange">{part}</Mark> : part
  );
}

const REJECT_REASONS = ["Out of scope", "Duplicate", "Not in the request", "Too vague to keep"];

// Reject with a reason picked from a short list; "Other…" opens a small text box.
export function RejectMenu({ onReject, disabled, label = "Reject", reasons = REJECT_REASONS }) {
  const [other, setOther] = useState(null);
  if (other !== null) {
    return (
      <Group gap={6} onClick={(e) => e.stopPropagation()}>
        <TextInput size="xs" placeholder="Reason" value={other} onChange={(e) => setOther(e.currentTarget.value)} autoFocus />
        <Button size="xs" color="red" variant="light" disabled={!other.trim()} onClick={() => { onReject(other.trim()); setOther(null); }}>
          {label}
        </Button>
        <Button size="xs" variant="subtle" color="gray" onClick={() => setOther(null)}>Cancel</Button>
      </Group>
    );
  }
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Button size="xs" variant="subtle" color="red" rightSection={<IconChevronDown size={14} />} disabled={disabled}
          onClick={(e) => e.stopPropagation()}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Why?</Menu.Label>
        {reasons.map((r) => <Menu.Item key={r} onClick={() => onReject(r)}>{r}</Menu.Item>)}
        <Menu.Item onClick={() => setOther("")}>Other…</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
