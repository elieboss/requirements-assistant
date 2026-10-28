import { useState } from "react";
import {
  ActionIcon, Badge, Button, Chip, Collapse, Group, Menu, Paper, Stack, Text, Textarea, TextInput, Tooltip,
} from "@mantine/core";
import { IconCheck, IconChevronDown, IconInfoCircle, IconPencil, IconRotate, IconSend, IconTestPipe } from "@tabler/icons-react";
import { DecisionBadge, LinkChips, RejectMenu, SentenceChips, WithTbd } from "./common.jsx";
import { criteriaForRequirement, questionsForRequirement, questionsForStakeholder } from "../lib/trace.js";
import { criterionBlockers, isResolved } from "../lib/workflow.js";
import { criteriaWithPlaceholder, fillPlaceholder, placeholderFor } from "../lib/tbd.js";

const stop = (e) => e.stopPropagation();

// The frame every item shares: ID and status on top, the main text, quick actions, and trace links behind "Details".
function ItemShell({ item, ctx, tag, tagColor = "gray", badge, focus, children, actions, details }) {
  const [showDetails, setShowDetails] = useState(false);
  const { selected, linked } = ctx.cardState(item);
  return (
    <Paper
      id={`card-${item.id}`}
      withBorder
      p={focus ? "lg" : "sm"}
      radius="md"
      className={`item${selected ? " is-selected" : ""}${linked ? " is-linked" : ""}${item.status === "rejected" ? " is-rejected" : ""}`}
      onClick={() => ctx.onSelect(item.id)}
    >
      <Stack gap={focus ? "sm" : 6}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Text size="xs" fw={700} c="dimmed">{item.id}</Text>
            {tag && <Badge size="xs" variant="light" color={tagColor}>{tag}</Badge>}
            {item.unsupported && <Badge size="xs" color="red">Not traced</Badge>}
          </Group>
          {badge}
        </Group>
        <div className={focus ? "item-text is-focus" : "item-text"}>{children}</div>
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Group gap={6} wrap="wrap" onClick={stop}>{actions}</Group>
          {details && (
            <Tooltip label={showDetails ? "Hide trace links" : "Show trace links"} withArrow>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Details" aria-expanded={showDetails}
                onClick={(e) => { stop(e); setShowDetails((v) => !v); }}>
                <IconInfoCircle size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {details && (
          <Collapse in={showDetails || focus}>
            <Stack gap={4} pt={4}>{details}</Stack>
          </Collapse>
        )}
      </Stack>
    </Paper>
  );
}

function LockNote({ text }) {
  return text ? <Text size="xs" c="dimmed">🔒 {text}</Text> : null;
}

function ReopenButton({ onClick, label = "Reopen" }) {
  return (
    <Button size="xs" variant="subtle" color="gray" leftSection={<IconRotate size={14} />} onClick={onClick}>{label}</Button>
  );
}

// Approve / Edit / Reject, shared by requirements, stories and criteria.
function DecideActions({ item, locked, blockers = [], onUpdate, onEdit }) {
  if (item.status !== "draft") return <ReopenButton onClick={() => onUpdate({ status: "draft", rejectReason: null })} />;
  const why = locked ?? (blockers.length ? `Blocked: ${blockers.join(", ")}` : null);
  return (
    <>
      <Tooltip label={why} disabled={!why} withArrow multiline maw={260}>
        <span>
          <Button size="xs" color="green" leftSection={<IconCheck size={14} />} disabled={!!why}
            onClick={() => onUpdate({ status: "approved", bulk: false })}>
            Approve
          </Button>
        </span>
      </Tooltip>
      {onEdit && <Button size="xs" variant="default" leftSection={<IconPencil size={14} />} disabled={!!locked} onClick={onEdit}>Edit</Button>}
      <RejectMenu disabled={!!locked} onReject={(reason) => onUpdate({ status: "rejected", rejectReason: reason, bulk: false })} />
    </>
  );
}

function RejectedNote({ item }) {
  return item.status === "rejected" && item.rejectReason ? <Text size="xs" c="red">Rejected: {item.rejectReason}</Text> : null;
}

export function RequirementItem({ item, results, ctx, focus }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.statement);
  const update = (changes) => ctx.updateItem("requirements", item.id, changes);
  const typeColor = { compliance: "grape", "business-rule": "grape", constraint: "gray", "non-functional": "cyan" }[item.type] ?? "indigo";

  return (
    <ItemShell item={item} ctx={ctx} focus={focus} tag={item.type} tagColor={typeColor} badge={<DecisionBadge item={item} />}
      actions={editing ? (
        <>
          <Button size="xs" onClick={() => { update({ statement: draft.trim(), edited: true }); setEditing(false); }}>Save</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setEditing(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <DecideActions item={item} locked={ctx.lock("requirements")} onUpdate={update} onEdit={() => { setDraft(item.statement); setEditing(true); }} />
          <LockNote text={ctx.lock("requirements")} />
        </>
      )}
      details={<>
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Questions" ids={questionsForRequirement(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
        <LinkChips label="Criteria" ids={criteriaForRequirement(results, item.id).map((a) => a.id)} onNavigate={ctx.onNavigate} />
      </>}
    >
      {editing ? (
        <Textarea autosize minRows={2} value={draft} onClick={stop} onChange={(e) => setDraft(e.currentTarget.value)} />
      ) : (
        <Text size={focus ? "lg" : "sm"}>{item.statement}</Text>
      )}
      <RejectedNote item={item} />
    </ItemShell>
  );
}

const RACI = [
  { value: "Decides", hint: "Signs off and answers scope questions" },
  { value: "Consulted", hint: "Gives input before decisions" },
  { value: "Informed", hint: "Kept up to date" },
];

export function StakeholderItem({ item, results, ctx, focus }) {
  const update = (changes) => ctx.updateItem("stakeholders", item.id, changes);
  const locked = ctx.lock("stakeholders");
  return (
    <ItemShell item={item} ctx={ctx} focus={focus}
      tag={item.inferred ? "inferred" : "named"} tagColor={item.inferred ? "orange" : "teal"}
      badge={<DecisionBadge item={item} labels={{ approved: "Confirmed", rejected: "Removed" }} />}
      actions={item.status && item.status !== "draft" ? (
        <ReopenButton onClick={() => update({ status: "draft", raci: null })} />
      ) : (
        <>
          <Text size="xs" c="dimmed">Confirm as</Text>
          {RACI.map((r) => (
            <Tooltip key={r.value} label={r.hint} withArrow>
              <Button size="xs" variant="light" disabled={!!locked} onClick={() => update({ status: "approved", raci: r.value, bulk: false })}>
                {r.value}
              </Button>
            </Tooltip>
          ))}
          <RejectMenu label="Not involved" disabled={!!locked}
            reasons={["Not affected by this change", "Duplicate of another stakeholder", "Out of scope"]}
            onReject={(reason) => update({ status: "rejected", rejectReason: reason, bulk: false })} />
          <LockNote text={locked} />
        </>
      )}
      details={<>
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Questions for them" ids={questionsForStakeholder(results, item.id).map((q) => q.id)} onNavigate={ctx.onNavigate} warn />
      </>}
    >
      <Text size={focus ? "lg" : "sm"} fw={600}>{item.role}</Text>
      <Text size="sm" c="dimmed">{item.interest}</Text>
      <RejectedNote item={item} />
    </ItemShell>
  );
}

const QUESTION_STATUS = {
  asked: ["Asked · waiting", "violet"],
  answered: ["Answered", "green"],
  assumption: ["Assumed", "grape"],
  parked: ["Parked", "orange"],
};

export function QuestionItem({ item, results, ctx, focus }) {
  const [other, setOther] = useState(null); // { kind: "answered" | "assumption", text }
  const [skipFill, setSkipFill] = useState(false);
  const update = (changes) => ctx.updateItem("openQuestions", item.id, changes);
  const locked = ctx.lock("questions");
  const [label, color] = QUESTION_STATUS[item.resolution] ?? ["Not asked", "gray"];
  const blocks = results.acceptanceCriteria.filter((ac) => ac.dependsOnQuestionIds.includes(item.id)).map((ac) => ac.id);
  const askRoles = item.askStakeholderIds.map((id) => results.stakeholders.find((s) => s.id === id)?.role).filter(Boolean);
  const toFill = item.resolution === "answered" && !skipFill ? criteriaWithPlaceholder(results, item.id) : [];
  const open = !isResolved(item);

  const answer = (text) => { update({ resolution: "answered", note: text, bulk: false }); setSkipFill(false); };
  const assume = (text) => update({ resolution: "assumption", note: text, bulk: false });

  return (
    <ItemShell item={item} ctx={ctx} focus={focus} tag={item.issue} tagColor="orange"
      badge={<Group gap={4}><Badge size="sm" variant="light" color={color}>{label}</Badge>{item.bulk && <Badge size="sm" variant="outline" color="gray">Bulk</Badge>}</Group>}
      actions={other ? (
        <Group gap={6} onClick={stop} wrap="nowrap" style={{ flex: 1 }}>
          <TextInput size="xs" style={{ flex: 1 }} autoFocus placeholder={other.kind === "answered" ? "Their answer" : "What you're assuming"}
            value={other.text} onChange={(e) => setOther({ ...other, text: e.currentTarget.value })} />
          <Button size="xs" disabled={!other.text.trim()}
            onClick={() => { (other.kind === "answered" ? answer : assume)(other.text.trim()); setOther(null); }}>Save</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setOther(null)}>Cancel</Button>
        </Group>
      ) : open ? (
        <>
          {item.resolution !== "asked" && (
            <Button size="xs" variant="light" color="violet" leftSection={<IconSend size={14} />} disabled={!!locked}
              onClick={() => update({ resolution: "asked", bulk: false })}>Mark asked</Button>
          )}
          <Menu withinPortal position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant="default" rightSection={<IconChevronDown size={14} />} disabled={!!locked}>Assume</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Assume for now</Menu.Label>
              {item.suggestedAnswers?.map((a) => <Menu.Item key={a} onClick={() => assume(a)}>{a}</Menu.Item>)}
              <Menu.Item onClick={() => assume(`Keep current behavior; confirm with ${askRoles[0] ?? "the requester"}`)}>Keep current behavior</Menu.Item>
              <Menu.Item onClick={() => setOther({ kind: "assumption", text: "" })}>Other…</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {item.resolution !== "parked" && (
            <Button size="xs" variant="subtle" color="orange" disabled={!!locked} onClick={() => update({ resolution: "parked", note: "", bulk: false })}>Park</Button>
          )}
          {item.resolution && <ReopenButton label="Reset" onClick={() => update({ resolution: null, note: "" })} />}
          <LockNote text={locked} />
        </>
      ) : (
        <ReopenButton onClick={() => update({ resolution: null, note: "" })} />
      )}
      details={<>
        {askRoles.length > 0 && <Text size="xs" c="dimmed">Ask: {askRoles.join(" · ")}</Text>}
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Affects" ids={item.relatedRequirementIds} onNavigate={ctx.onNavigate} />
        <LinkChips label="Blocks" ids={blocks} onNavigate={ctx.onNavigate} warn={open} />
      </>}
    >
      <Text size={focus ? "lg" : "sm"}>{item.question}</Text>
      {open && !other && item.suggestedAnswers?.length > 0 && (
        <Group gap={6} mt={6} onClick={stop} wrap="wrap">
          <Text size="xs" c="dimmed">Answer:</Text>
          {item.suggestedAnswers.map((a) => (
            <Chip key={a} size="xs" checked={false} disabled={!!locked} onChange={() => answer(a)}>{a}</Chip>
          ))}
          <Chip size="xs" checked={false} disabled={!!locked} onChange={() => setOther({ kind: "answered", text: "" })}>Other…</Chip>
        </Group>
      )}
      {isResolved(item) && (
        <Text size="sm" mt={4}><Text span fw={600}>{label}:</Text> {item.note}</Text>
      )}
      {toFill.length > 0 && (
        <Paper withBorder p="xs" mt={6} radius="sm" className="fill-box" onClick={stop}>
          <Text size="xs" fw={600}>Fill {placeholderFor(item.id)} with “{item.note}”?</Text>
          {toFill.map((ac) => (
            <Text key={ac.id} size="xs" c="dimmed">{ac.id}: …{fillPlaceholder(ac, item.id, item.note).then}</Text>
          ))}
          <Group gap={6} mt={4}>
            <Button size="xs" onClick={() => ctx.fillTbd(item.id, item.note)}>Fill {toFill.length === 1 ? toFill[0].id : `${toFill.length} criteria`}</Button>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setSkipFill(true)}>Not now</Button>
          </Group>
        </Paper>
      )}
    </ItemShell>
  );
}

export function StoryItem({ item, ctx, focus }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const update = (changes) => ctx.updateItem("userStories", item.id, changes);
  const fields = [["asA", "As a"], ["iWant", "I want"], ["soThat", "so that"]];
  return (
    <ItemShell item={item} ctx={ctx} focus={focus} tag="user story" tagColor="indigo" badge={<DecisionBadge item={item} />}
      actions={editing ? (
        <>
          <Button size="xs" onClick={() => { update({ asA: draft.asA, iWant: draft.iWant, soThat: draft.soThat, edited: true }); setEditing(false); }}>Save</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setEditing(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <DecideActions item={item} locked={ctx.lock("criteria")} onUpdate={update} onEdit={() => { setDraft(item); setEditing(true); }} />
          <LockNote text={ctx.lock("criteria")} />
        </>
      )}
      details={<>
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Covers" ids={item.requirementIds} onNavigate={ctx.onNavigate} />
      </>}
    >
      {editing ? (
        <Stack gap={4} onClick={stop}>
          {fields.map(([k, l]) => (
            <TextInput key={k} size="xs" label={l} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.currentTarget.value })} />
          ))}
        </Stack>
      ) : (
        <Text size={focus ? "lg" : "sm"}>
          <b>As a</b> {item.asA}, <b>I want</b> {item.iWant}, <b>so that</b> {item.soThat}.
        </Text>
      )}
      <RejectedNote item={item} />
    </ItemShell>
  );
}

export function CriterionItem({ item, results, ctx, focus }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const update = (changes) => ctx.updateItem("acceptanceCriteria", item.id, changes);
  const locked = ctx.lock("criteria");
  const blockers = criterionBlockers(results, item).filter((r) => r !== locked);
  const ready = item.status === "approved" && !locked && blockers.length === 0;
  const testCase = results.testCases?.[item.id];

  return (
    <ItemShell item={item} ctx={ctx} focus={focus} tag="Given / When / Then" tagColor="indigo"
      badge={<Group gap={4}>{item.status === "draft" && blockers.length > 0 && <Badge size="sm" color="orange" variant="light">Blocked</Badge>}<DecisionBadge item={item} /></Group>}
      actions={editing ? (
        <>
          <Button size="xs" onClick={() => { update({ given: draft.given, when: draft.when, then: draft.then, edited: true }); setEditing(false); }}>Save</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setEditing(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <DecideActions item={item} locked={locked} blockers={blockers} onUpdate={update} onEdit={() => { setDraft(item); setEditing(true); }} />
          {ready && (
            <Button size="xs" variant="light" leftSection={<IconTestPipe size={14} />} onClick={() => ctx.openTestCase(item.id)}>
              {testCase ? "View test case" : "Draft test case"}
            </Button>
          )}
          <LockNote text={locked} />
        </>
      )}
      details={<>
        <SentenceChips ids={item.sourceSentenceIds} onSelectSentence={ctx.onSelectSentence} />
        <LinkChips label="Verifies" ids={[item.requirementId]} onNavigate={ctx.onNavigate} />
        <LinkChips label="Depends on" ids={item.dependsOnQuestionIds} onNavigate={ctx.onNavigate} warn={blockers.length > 0} />
      </>}
    >
      {editing ? (
        <Stack gap={4} onClick={stop}>
          {["given", "when", "then"].map((k) => (
            <Textarea key={k} size="xs" autosize label={k[0].toUpperCase() + k.slice(1)} value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.currentTarget.value })} />
          ))}
        </Stack>
      ) : (
        <dl className={`gwt${focus ? " is-focus" : ""}`}>
          <dt>Given</dt><dd><WithTbd text={item.given} /></dd>
          <dt>When</dt><dd><WithTbd text={item.when} /></dd>
          <dt>Then</dt><dd><WithTbd text={item.then} /></dd>
        </dl>
      )}
      {item.status === "approved" && blockers.length > 0 && <Text size="xs" c="orange">⚠ Re-review: {blockers.join(", ")}</Text>}
      <RejectedNote item={item} />
    </ItemShell>
  );
}

export function ItemFor(props) {
  const id = props.item.id;
  if (id.startsWith("REQ-")) return <RequirementItem {...props} />;
  if (id.startsWith("STK-")) return <StakeholderItem {...props} />;
  if (id.startsWith("Q-")) return <QuestionItem {...props} />;
  if (id.startsWith("STORY-")) return <StoryItem {...props} />;
  return <CriterionItem {...props} />;
}
