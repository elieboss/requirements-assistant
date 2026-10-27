# Requirements Assistant

A small demo that helps an analyst turn a vague business request into **draft** requirements, stakeholders, open questions and acceptance criteria. Every item is traced to the sentence in the request that supports it. All data is fictional, and all generated content is a draft for human review.

## Parts

| Folder | What it is | Its job |
|---|---|---|
| `web/` | React app (Vite, plain CSS) | The screen: request on the left, draft analysis on the right, approve/edit/reject |
| `worker/` | Cloudflare Worker | Serves the app and handles `POST /api/analyze`; the AI key will live here only |
| `shared/` | Plain JavaScript | The fictional sample request, the sample results, and the sentence splitter |
| `docs/` | Notes | The data shape and traceability chain |

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

## Deploy

```bash
npx --prefix worker wrangler login   # once
npm --prefix worker run deploy       # builds the app, then deploys app + API as one Worker
```
