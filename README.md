# Requirements Assistant

A small demo that helps an analyst turn a vague business request into **draft** requirements, stakeholders, open questions, user stories and acceptance criteria, then review them in a fixed order before anything moves to testing. Every item is traced to the sentence in the request that supports it. All data is fictional, and all generated content is a draft for human review.

## Parts

| Folder | What it is | Its job |
|---|---|---|
| `web/` | React app (Vite, plain CSS) | The screen: request on the left, draft analysis on the right, reviewed stage by stage |
| `web/src/lib/workflow.js` | Workflow rules | Stage order, what "done" means, what stays locked, the Definition of Ready |
| `worker/` | Cloudflare Worker | Serves the app and handles `POST /api/analyze`; the only part that holds the AI key or calls Claude |
| `worker/src/prompt.js` | The analysis instructions | The analyst method the AI follows, plus the exact output shape |
| `worker/src/validate.js` | Citation check | Removes any citation or link that points at nothing, and flags the item |
| `worker/src/testCasePrompt.js` | Optional test case step | Turns one approved acceptance criterion into a draft test case for an analyst to review |
| `shared/` | Plain JavaScript | The fictional sample request, the sample results, and the sentence splitter |
| `docs/` | Notes | The data shape and traceability chain |

## Refinement workflow (Definition of Ready)

The analysis is reviewed in order, like backlog refinement. Each stage stays view-only until the stage before it is done, and a **Next step** box always says what to do.

| Stage | Done when | Locks until done |
|---|---|---|
| 1. Requirements | Every requirement approved or rejected | Stage 2 actions |
| 2. Stakeholders | Every stakeholder confirmed or removed, including the AI's inferred ones | Stage 3 actions |
| 3. Open questions | Every question **answered** (stakeholder's answer recorded), **assumed** (assumption noted) or **parked** (still open) | Stage 4 actions |
| 4. Stories & criteria | Every story and criterion decided. A criterion can only be approved if its requirement and its story are approved and none of its questions is open or parked | Test case button |
| 5. Draft test case (optional) | Only for an approved, unblocked criterion | none |

The **Definition of Ready** checklist also lists parked questions and approved requirements that have no approved criterion yet (coverage gaps). If something upstream changes after approval, for example a requirement is returned to draft, the affected criteria are flagged for re-review and their test case button is hidden.

**User stories.** The request is treated as an epic and split into stories, one per user and need (for example, customer alerts, customer fraud report, compliance record). Each story lists the requirements it covers, and its acceptance criteria are shown nested under it. Constraints such as the deadline apply to the whole epic.

**Staying focused.** Cards show one line until opened; the next item to review opens by itself and folds away once decided. Every action shows a short toast with **Undo**. If every remaining criterion is blocked by parked questions, the Next step box names the question that unblocks the most and **Go** jumps to it.

For live demos, each stage has an **Approve remaining** shortcut. Items marked this way carry a **Bulk** label, so the review record stays honest.

## Optional step: draft test case

Approve an acceptance criterion, then click **Generate draft test case**. The Worker sends only that criterion, its requirement, its source sentences and any blocking questions to Claude, and returns a draft with preconditions, steps, expected results, fictional test data, and suggested edge cases and coverage gaps. The links back to the criterion, requirement and sentences are added by code, not by the AI. If the criterion is edited afterwards, the test case is flagged as out of date.

This shows requirements supporting testing. It is not a test management tool: a real team would adapt the draft to its own templates, tools and process.

## Run it locally

```bash
npm --prefix web install
npm --prefix worker install

# Terminal 1: the Worker (API) on http://localhost:8787
npm --prefix worker run dev

# Terminal 2: the React dev server on http://localhost:5173 (forwards /api to the Worker)
npm --prefix web run dev
```

If the Worker is not running, the sample request still works from an offline copy, and the page says so.

### Connect the AI locally

Create `worker/.dev.vars` (it is git-ignored, so the key never reaches GitHub):

```
ANTHROPIC_API_KEY=your-key-here
```

Restart the Worker. Without a key, the sample request returns the pre-written results, labelled as a fallback.

## Deploy

```bash
cd worker
npx wrangler login                        # once
npx wrangler secret put ANTHROPIC_API_KEY # paste the key when asked; stored by Cloudflare, not in code
npm run deploy                            # builds the app, then deploys app + API as one Worker
```
