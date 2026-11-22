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
- Upload goes to `POST /api/documents` (editor or owner). The original file is stored with `appFiles` in the owner's private folder and served to teammates only through `GET /api/documents/:id/file`, which checks the role. (Client `useR2Files` scopes are either uploader-only or public, which fits neither need.) The document record stores the **full stored key** that `upload` returns (`apps/<app>/users/<owner>/…`); `download` refuses the short relative key with "key outside scope".
- A background job extracts text page by page in the Worker with `unpdf` (PDF.js for serverless) and adds each page as its own knowledge item: folder `docs/<documentId>`, file `pNNNN.txt`. Pages are added a few at a time in parallel (one add takes about 2.6 s). The PDF bytes are copied before extraction because PDF.js detaches the buffer. Markdown and text files are a single page 1. A page with no extractable text is skipped; a document with no text at all is marked failed ("may be scanned"). The job marks the document ready once `list` reports every page `completed` (items can be missing from `list` for a few seconds right after `add`).
- At ask time, the server searches **with no folder filter** (the folder filter is an exact match, so `docs` does not reach `docs/<id>/`; the knowledge base belongs to this app and holds only document pages), parses `documentId` and `page` back out of each chunk's key, drops chunks whose key does not parse or whose document is not `ready`, and labels the rest S1..Sn for the model. An unanswerable question returns no chunks, which is the abstain path.
- The knowledge item ids are stored on the document record, so deleting a document removes its pages from the index by id.

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
B. Spike (1 hour): per-page PDF text extraction inside the Worker, add pages to knowledge, search, confirm document id and page come back. **Done: Worker extraction works; no browser fallback needed.**
C. Ask pipeline: retrieval, S1..Sn labels, generation, `verifyCitations`, abstain, with unit tests.
D. UI matching `design/prototype.html`: Ask, Documents with upload, document viewer.
E. Feedback, Evals, Team access approvals.
F. E2E test, README, sample documents loaded on workspace setup.

## Testing
- Unit tests: `verifyCitations` keeps valid labels, strips invented labels, abstains when none are valid; `answerQuestion` with a fake retriever and generator covers verified, partial, and abstain (nothing retrieved).
- Multi-user test (deepspace/testing): a Viewer gets 403 when uploading a document.
- Test accounts: GW Owner, GW Editor, GW Viewer (`@deepspace.test`). Specs that need an owner set `OWNER_USER_ID` in `.dev.vars` to GW Owner's user id and run with `npx playwright test -c tests/playwright.config.ts`; `deepspace test run` and `deepspace deploy` both rewrite `.dev.vars`, so re-set it after either. Those specs skip with an explanation when the owner is not set.

## DeepSpace SDK feedback
Friction found while building on `deepspace@0.44.2`, with what we did about it. Each item names where it was confirmed (docs page, installed types, or SDK source).

| # | What we hit | Impact | Workaround in Groundwork | Suggestion for the SDK |
|---|---|---|---|---|
| 1 | `resolveAppRole` / `resolveAppMembership` return only `member` or `admin`; any other role, including a custom `editor` that the docs show and `setRole` accepts, comes back as `viewer` (`isWriterRole` in `worker.js`). The scaffolded `AppJobRoom.authorizeWrite` uses it. | Server code using the SDK helper silently locks out custom roles. | `requireRole` reads the raw role from the `users` row. Job room is admin-only. | Return the stored role, or document the collapse next to the custom-role example. |
| 2 | Server actions cannot change a role: `role` is system-assigned and action writes are refused; only an admin's socket `setRole` or `registerUser({ isAdmin })` can. No user-registration hook on `RecordRoom`. | Invites cannot be applied at first sign-in from the server. | Dropped invites; owners approve waiting users on the Team page. | A server-side `tools.setRole` for actions, or an `onUserRegistered` hook. |
| 3 | Knowledge search chunks have no page number and no custom metadata (`KnowledgeSearchChunk` type). The docs do not say whether PDFs are parsed. | Page-level citations need extra work. | One knowledge item per page, page encoded in the key; text extracted with `unpdf`. | Per-item metadata, or page numbers for PDF chunks. |
| 4 | The knowledge `folder` filter matches exactly; searching `docs` does not reach `docs/<id>/`. The SDK exports a prefix-range `folderFilter` helper, but `search` does not use it. The docs describe folders as paths, which suggests prefix matching. | A natural "search all documents" call returns nothing. | Search with no folder and filter by parsed key. | Document exact matching, or make `search` use `folderFilter`. |
| 5 | `appFiles().download(key)` refuses the relative key passed to `upload({ key })` with "key outside scope"; it needs the full stored key. | Easy to store the wrong key. | Store the full key `upload` returns. | Accept both forms, or name the parameter `storedKey`. |
| 6 | `useR2Files` offers `'self'` (uploader only) or `'app'` (public to anyone with the URL). | No built-in "readable by my team" file scope. | Worker-side storage plus an authenticated download route. | A role-gated file scope. |
| 7 | Agent tool failures return only `tool_execution_failed`, and the calls did not appear in `deepspace logs`. | Hard to debug. | Caught errors per stage and returned them while spiking. | Include the error message for the app owner, and log tool calls. |
| 8 | `deepspace test run` regenerates `.dev.vars`, so a test that needs a test account as `OWNER_USER_ID` must run Playwright directly (documented in the private-app guide, not in the testing guide). `deepspace deploy` also rewrites `.dev.vars`, silently resetting the owner after every deploy. | Surprising when following the testing guide alone; owner-only specs start skipping after a deploy. | Run `npx playwright test -c tests/playwright.config.ts` for those specs; owner-only specs check `.dev.vars` and skip with an explanation instead of failing. | A `test run --owner <account>` option, and leave `.dev.vars` alone on deploy. |
| 11 | Declaring the documented `[[ai_search]]` binding makes local dev (`vite` via `@cloudflare/vite-plugin`) fail: the plugin tries to open a Cloudflare remote-binding session and asks for `CLOUDFLARE_API_TOKEN`. Not mentioned on the managed-knowledge page. | Local dev and Playwright stop starting as soon as knowledge is added. | `remoteBindings: false` in `vite.config.ts` (the app reaches knowledge through `knowledge(env)`, never `env.KNOWLEDGE`). | Ship that setting in the scaffold, or document it with the binding. |
| 9 | `AuthOverlay` offers Google and GitHub only. | The prototype's Microsoft and Apple buttons cannot ship. | Google and GitHub only. | — |
| 10 | Without `allowAnonymous`, `RecordProvider` renders nothing for signed-out visitors, so sign-in must be gated above it. | A private app built on the scaffold shows a blank page signed out until this is found. | `AuthGate` wraps the data layer in `(app)/_layout.tsx`. | Mention it in the authentication guide's private-app section. |

## Rules
- Use DeepSpace platform primitives; don't reimplement auth, storage, retrieval, or sync.
- No secrets in client code or the repo. Use DeepSpace secrets if any are needed.
- Only public sample documents. No confidential employer or school material.

## Verification log (fill in as you build — this feeds the writeup)
| Step | What the agent did | What I checked / changed myself |
|---|---|---|
| A. Skeleton | Roles (admin/editor/member/viewer), 6 collections with server-only writes except feedback, `requireRole` reading the raw `users` role (found in SDK source that `resolveAppRole` reports `editor` as `viewer`), AuthGate above the data layer (a RecordProvider without `allowAnonymous` renders nothing signed out), waiting-for-access screen, token required on all WebSocket routes, unused Yjs/canvas/presence routes removed, job room admin-only, agent tools team-only. Checks: tsc, eslint, build, Playwright 8 passed / 1 skipped (no test accounts yet). Deployed release `rel_01M7YFJ7KQXH00NQ86393BJ8NM`; live `/ws/any-room` without a token returns 401. |Signed in on the live site with a second account (not the deployer): it landed on "waiting for access" with its own email shown. Deployer account signs in as Owner. Read requireRole and confirmed it fails closed when the role can't be read. |
| B. Spike | On the deployed Worker, with a generated 4-page PDF (unique text on pages 1, 2, 4; page 3 blank) stored in the owner's private files, via temporary owner-only agent tools: `unpdf@1.6.2` extracted 4 pages and detected the blank page; each page was added as `docs/spike1/pNNNN.txt` (about 2.6 s per add); a page-2 question returned `p0002` at score 0.998 and the key parsed back to document `spike1`, page 2; the browser fallback was not needed. Found and designed around: exact-match knowledge folders (search with no folder: page-2 and page-4 questions returned the right pages, an unanswerable question returned 0 chunks), `appFiles.download` needing the full stored key, PDF.js detaching the buffer, items missing from `list` right after `add` (all `completed` on re-check). Cleaned up: spike knowledge items removed by id and the test file deleted (0 items, 0 files left); spike tools removed. Wall clock exceeded the 1-hour box (12:41–14:50, including a long idle gap) plus a 14-minute follow-up. | Reviewed the spike report and approved the design changes: search with no folder filter, keep only pages of ready documents, page keys in the form docs/<id>/pNNNN.txt. Asked for the SDK findings to be recorded as feedback. Did not re-run the spike myself; will inspect a real search result once sample documents are indexed in Phase D1. |
| C. Ask pipeline | `verifyCitations` (pure: merges inline `[Sn]` markers with the cited list, keeps retrieved labels, strips invented ones from the text, abstains when nothing valid is cited or the model says it can't answer), `answerQuestion` (retrieve → keep pages of ready documents → dedupe, cap at 8, label S1..Sn → abstain with no model call if empty → generate → verify), Worker adapters (knowledge search with no folder; `claude-sonnet-5-5`, temperature 0, `Output.object`, owner-billed), `askQuestion` action (team roles; writes a `pending` answer first so it appears live, then updates it; `error` status on AI failure). Checks: 28 unit tests (verifier, pipeline with fake retriever/generator, passage keys); a deliberate bug (partial reported as verified) failed exactly the 2 partial tests. Playwright 12/12 with GW Owner as local owner: unauthenticated ask → 401, waiting user → refused, owner ask with nothing indexed → `abstained` via real knowledge search. Not yet verified live: the model call itself (needs an indexed document; first check of Phase D). Fixed local dev broken by the `[[ai_search]]` binding (`remoteBindings: false`). | Read verifyCitations and its tests and can explain each case. Broke it myself (partial reported as verified), saw the partial-answer tests fail in both test files, then restored it and confirmed all unit tests pass. Noted two limitations: a partial answer keeps the unsupported sentence uncited, and "verified" means every citation is valid, not that every sentence is cited. |
