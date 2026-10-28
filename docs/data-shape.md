# Data shape (Step 1)

All data is fictional. All analysis output is a **draft for analyst review**.

## Traceability chain

```
Source sentence (S1..Sn)
  └─ Requirement (REQ-n)        cites sentences
       ├─ Open question (Q-n)   cites sentences, links to requirements, names who to ask, records the outcome
       ├─ User story (STORY-n)  cites sentences, groups the requirements it covers (the request is the epic)
       └─ Acceptance criterion (AC-n)  links to one requirement, cites sentences, lists blocking questions
            └─ Draft test case (TC-n)   optional step; links to one approved criterion
Stakeholder (STK-n)             cites sentences; `inferred: true` when implied rather than named
```

## Objects

| Object | Key fields |
|---|---|
| Sentence | `id` (S1), `text` — created by code, not by the AI |
| Requirement | `id`, `statement`, `type` (functional, non-functional, business-rule, compliance, constraint), `sourceSentenceIds`, `status` (draft, approved, rejected) |
| Stakeholder | `id`, `role`, `interest`, `inferred`, `sourceSentenceIds`, `status` (draft, approved = confirmed, rejected = removed), `raci` (Decides, Consulted, Informed) |
| Open question | `id`, `question`, `issue` (vague, missing, assumption, constraint), `sourceSentenceIds`, `relatedRequirementIds`, `askStakeholderIds`, `suggestedAnswers`, `resolution` (asked, answered, assumption, parked), `note` |
| User story | `id` (STORY-n), `asA`, `iWant`, `soThat`, `requirementIds`, `sourceSentenceIds`, `status` |
| Acceptance criterion | `id`, `requirementId`, `given`, `when`, `then`, `sourceSentenceIds`, `dependsOnQuestionIds`, `status` |
| Test case (Step 5) | `id`, `acceptanceCriterionId`, `requirementId`, `sourceSentenceIds`, `criterionSnapshot`, `title`, `objective`, `preconditions`, `testData`, `steps[{action, expected}]`, `edgeCases[{scenario, why}]`, `coverageGaps`, `assumptions`, `status` |

Rejected items carry `rejectReason`. Any reviewed item may carry `bulk: true` when it was marked with the Approve remaining shortcut.

Unknown values inside criteria are written as `[TBD per Q-n]` so a gap is never hidden behind a guessed number.
