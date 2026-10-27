# Data shape (Step 1)

All data is fictional. All analysis output is a **draft for analyst review**.

## Traceability chain

```
Source sentence (S1..Sn)
  └─ Requirement (REQ-n)        cites sentences
       ├─ Open question (Q-n)   cites sentences, links to requirements, names who to ask
       └─ Acceptance criterion (AC-n)  links to one requirement, cites sentences, lists blocking questions
            └─ Draft test case (TC-n)   optional step; links to one approved criterion
Stakeholder (STK-n)             cites sentences; `inferred: true` when implied rather than named
```

## Objects

| Object | Key fields |
|---|---|
| Sentence | `id` (S1), `text` — created by code, not by the AI |
| Requirement | `id`, `statement`, `type` (functional, non-functional, business-rule, compliance, constraint), `sourceSentenceIds`, `status` (draft, approved, rejected) |
| Stakeholder | `id`, `role`, `interest`, `inferred`, `sourceSentenceIds` |
| Open question | `id`, `question`, `issue` (vague, missing, assumption, constraint), `sourceSentenceIds`, `relatedRequirementIds`, `askStakeholderIds` |
| Acceptance criterion | `id`, `requirementId`, `given`, `when`, `then`, `sourceSentenceIds`, `dependsOnQuestionIds`, `status` |
| Test case (Step 5) | `id`, `acceptanceCriterionId`, `requirementId`, `sourceSentenceIds`, `criterionSnapshot`, `title`, `objective`, `preconditions`, `testData`, `steps[{action, expected}]`, `edgeCases[{scenario, why}]`, `coverageGaps`, `assumptions`, `status` |

Unknown values inside criteria are written as `[TBD per Q-n]` so a gap is never hidden behind a guessed number.
