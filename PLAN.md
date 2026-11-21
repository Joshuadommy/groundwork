# Groundwork — Project Plan

**One line:** A team knowledge assistant that answers questions from your team's documents, cites the exact passages it used, and refuses to cite anything it didn't actually retrieve.

## Why it exists
AI answers over documents are only useful if people can trust them. Two failure modes break trust:
1. The model cites a source it never retrieved (a fabricated citation).
2. Nobody notices when answers get worse after documents change.

Groundwork fixes both: a **server-side citation check** and a **team feedback loop that becomes an evaluation set**.

## Core user flow (the important path — must work end to end)
1. The owner (the account that deployed the app) signs in and sets up the workspace. Teammates sign in with Google or GitHub and land on "Waiting for access" until the owner approves them on the Team page as Viewer or Editor (see Roles and access).
2. Editor uploads documents (PDF, Markdown, or text). They are indexed per page with DeepSpace managed knowledge (see Per-page indexing).
3. Any approved teammate asks a question.
4. The server retrieves passages, labels them S1..Sn, asks the model to answer citing those labels, then **verifies every citation** against the retrieved set:
   - all citations valid → answer shown as **Verified**
   - some invalid → invalid ones removed, answer marked **Partially verified**
   - none valid / nothing relevant retrieved → **"I couldn't find this in your documents"** (abstain)
5. Teammates rate answers (👍 / 👎 + optional note). Ratings update live for everyone.
6. A 👎 answer can be saved as an **eval case** (editors and owners). On the Evals tab, an owner can **re-run eval cases** (up to 10 per run) and see which answers changed and their verification status.

## Roles and access
DeepSpace roles live on the `users` row and are enforced by the record room (Durable Object). Role ids and the labels shown in the UI:

| Role id | UI label | Can |
|---|---|---|
| `admin` | Owner | Everything: approve people, change roles, remove access, re-run evals |
| `editor` | Editor | Ask, rate, upload and delete documents, save eval cases |
| `member` | Viewer | Ask and rate |
| `viewer` | No access | Nothing; sees "Waiting for access" |

- The app owner (`OWNER_USER_ID`) is always `admin`. Other owners are made with `setRole(userId, 'admin')`.
- New sign-ins get `defaultRole: 'viewer'` (no access). There are no invite records: the Team page lists waiting users with **Approve as Viewer** / **Approve as Editor**, and lists members with a role picker and **Remove access** (sets them back to `viewer`). All of these call `useUsers().setRole` from an owner's session; the server refuses `setRole` from non-admins.
- Enforcement: (1) collection permissions in the record room cover all reads and direct client writes, and every collection names `editor` explicitly; (2) server actions, HTTP routes and jobs bypass RBAC, so each one calls `requireRole()`, which reads the caller's role from their `users` row (the SDK's `resolveAppRole` reports custom roles like `editor` as `viewer`, so it is not used); (3) the records WebSocket requires a verified token.
- Answers, documents, eval cases and eval runs are written only by server code (`create: false` for clients), so a client cannot forge a "Verified" answer. Feedback is the only collection clients write directly.

## Per-page indexing
Managed knowledge search returns chunks with `{ id, score, text, key, filename, folder }` and no page number or custom metadata, so the page is carried in the item key:
- Upload goes to `POST /api/documents` (editor or owner). The original file is stored with `appFiles` in the owner's private folder and served to teammates only through `GET /api/documents/:id/file`, which checks the role. (Client `useR2Files` scopes are either uploader-only or public, which fits neither need.)
- A background job extracts text page by page and adds each page as its own knowledge item, keyed `docs/<documentId>/pNNNN.txt`. Markdown and text files are a single page 1. A page with no extractable text is skipped; a document with no text at all is marked failed ("may be scanned").
- At ask time, the server parses `documentId` and `page` back out of each chunk's key, drops chunks whose document is no longer `ready`, and labels the rest S1..Sn for the model.
- The knowledge item ids are stored on the document record, so deleting a document removes its pages from the index.

## DeepSpace integrations used (and why)
| Integration | Why it earns its place |
|---|---|
| Auth | Answers and feedback are tied to real teammates |
| Permissions (RBAC) | Viewers ask; editors manage documents; owners run evals |
| File uploads | Teams bring their own documents |
| Managed knowledge (RAG) | Platform retrieval instead of a hand-rolled vector store |
| AI (server-side) | Answer generation stays on the worker; no keys in the client |
| Real-time records | Feedback and new answers appear live for the whole team |
| Background jobs | Document indexing outlives the upload request |

AI and knowledge usage are billed to the app owner (server calls omit the caller's token). Answers use `claude-sonnet-5-5` at temperature 0 with structured output.

**Deliberately left out:** payments (no one pays for an internal team tool at this stage), collaborative editing and LiveKit (don't serve the ask → verify → trust flow), presence (cut for scope), invite records (replaced by access approvals).

## Data model (records)
Record ids and `createdAt` / `createdBy` come from the record envelope.
- `workspace`: slot (unique, always `main`), name, setupBy
- `documents`: title, kind (pdf | md | txt), fileKey, sizeBytes, pageCount, uploadedBy, status (indexing | ready | failed), error, knowledgeItemIds
- `answers`: question, answerText, citations [{label, documentId, docTitle, page, excerpt, chunkId}], removedCitations [label], status (pending | verified | partial | abstained | error), askedBy, model
- `feedback`: answerId, userId, rating (up | down), note — one per user per answer
- `evalCases`: question, sourceAnswerId (unique), createdBy
- `evalRuns`: evalCaseId, batchId, answerText, citations, status, changedFromPrevious (bool), runAt. "Changed" means the status or the set of cited (document, page) pairs differs from the previous run; wording alone does not count, because model wording varies.

## Key design decision (the main tradeoff)
Citation verification is **deterministic code, not another model call**. The model is asked to cite passage IDs; the server checks each ID against what retrieval actually returned. Tradeoff: it guarantees a citation points to a retrieved passage, but it does not prove the passage *supports* the sentence. A semantic support check (an extra model call per citation) was left out for latency and cost — listed under "next steps."

## Scope cut line (if time runs short)
Must ship: roles and access approvals, upload + per-page index, ask with verified citations, abstain behavior, live feedback.
Already cut: presence. Eval re-runs run inside a server action, capped at 10 cases per run (no background job).
Cut next: eval re-run diffing (keep saving eval cases) → styling extras.

## Build order (risk first; commit and deploy after each phase)
A. Skeleton: auth gate, roles, schemas, `requireRole`, token required on the WebSocket route.
B. Spike (1 hour): per-page PDF text extraction inside the Worker, add pages to knowledge, search, confirm document id and page come back. Fallback: extract page text in the browser with pdf.js and upload it with the file.
C. Ask pipeline: retrieval, S1..Sn labels, generation, `verifyCitations`, abstain, with unit tests.
D. UI matching `design/prototype.html`: Ask, Documents with upload, document viewer.
E. Feedback, Evals, Team access approvals.
F. E2E test, README, sample documents loaded on workspace setup.

## Testing
- Unit tests: `verifyCitations` keeps valid labels, strips invented labels, abstains when none are valid; `answerQuestion` with a fake retriever and generator covers verified, partial, and abstain (nothing retrieved).
- Multi-user test (deepspace/testing): a Viewer gets 403 when uploading a document.

## Rules
- Use DeepSpace platform primitives; don't reimplement auth, storage, retrieval, or sync.
- No secrets in client code or the repo. Use DeepSpace secrets if any are needed.
- Only public sample documents. No confidential employer or school material.

## Verification log (fill in as you build — this feeds the writeup)
| Step | What the agent did | What I checked / changed myself |
|---|---|---|
| A. Skeleton | Roles (admin/editor/member/viewer), 6 collections with server-only writes except feedback, `requireRole` reading the raw `users` role (found in SDK source that `resolveAppRole` reports `editor` as `viewer`), AuthGate above the data layer (a RecordProvider without `allowAnonymous` renders nothing signed out), waiting-for-access screen, token required on all WebSocket routes, unused Yjs/canvas/presence routes removed, job room admin-only, agent tools team-only. Checks: tsc, eslint, build, Playwright 8 passed / 1 skipped (no test accounts yet). Deployed release `rel_01M7YFJ7KQXH00NQ86393BJ8NM`; live `/ws/any-room` without a token returns 401. | |
