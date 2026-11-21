# Groundwork — Project Plan

**One line:** A team knowledge assistant that answers questions from your team's documents, cites the exact passages it used, and refuses to cite anything it didn't actually retrieve.

## Why it exists
AI answers over documents are only useful if people can trust them. Two failure modes break trust:
1. The model cites a source it never retrieved (a fabricated citation).
2. Nobody notices when answers get worse after documents change.

Groundwork fixes both: a **server-side citation check** and a **team feedback loop that becomes an evaluation set**.

## Core user flow (the important path — must work end to end)
1. Owner signs in and invites teammates (roles: owner, editor, viewer).
2. Editor uploads documents (PDF, Markdown, or text). They are indexed with DeepSpace managed knowledge.
3. Anyone asks a question.
4. The server retrieves passages, asks the model to answer citing passage IDs, then **verifies every citation** against the retrieved set:
   - all citations valid → answer shown as **Verified**
   - some invalid → invalid ones removed, answer marked **Partially verified**
   - none valid / nothing relevant retrieved → **"I couldn't find this in your documents"** (abstain)
5. Teammates rate answers (👍 / 👎 + optional note). Ratings update live for everyone.
6. A 👎 answer can be saved as an **eval case**. On the Eval tab, an owner can **re-run all eval cases** and see which answers changed and their verification status.

## DeepSpace integrations used (and why)
| Integration | Why it earns its place |
|---|---|
| Auth | Answers and feedback are tied to real teammates |
| Permissions (RBAC) | Viewers ask; editors manage documents; owners run evals |
| File uploads | Teams bring their own documents |
| Managed knowledge (RAG) | Platform retrieval instead of a hand-rolled vector store |
| AI (server-side) | Answer generation stays on the worker; no keys in the client |
| Real-time records | Feedback and new answers appear live for the whole team |
| Presence (stretch) | Shows who's active in the workspace |

**Deliberately left out:** payments (no one pays for an internal team tool at this stage), collaborative editing and LiveKit (don't serve the ask → verify → trust flow).

## Data model (records)
- `documents`: title, fileId, uploadedBy, status (indexing | ready | failed), createdAt
- `answers`: question, answerText, citations [{passageId, docTitle, excerpt}], status (verified | partial | abstained), askedBy, createdAt
- `feedback`: answerId, userId, rating (up | down), note, createdAt
- `evalCases`: question, sourceAnswerId, createdBy, createdAt
- `evalRuns`: evalCaseId, answerText, status, changedFromPrevious (bool), runAt

## Key design decision (the main tradeoff)
Citation verification is **deterministic code, not another model call**. The model is asked to cite passage IDs; the server checks each ID against what retrieval actually returned. Tradeoff: it guarantees a citation points to a retrieved passage, but it does not prove the passage *supports* the sentence. A semantic support check (an extra model call per citation) was left out for latency and cost — listed under "next steps."

## Scope cut line (if time runs short)
Must ship: roles, upload + index, ask with verified citations, abstain behavior, live feedback.
Cut first: presence → eval re-run diffing (keep saving eval cases) → styling extras.

## Testing
- Unit test: citation verifier keeps valid IDs, strips invented IDs, abstains when none are valid.
- Multi-user test (deepspace/testing): a viewer cannot upload; feedback from user A appears for user B.

## Rules
- Use DeepSpace platform primitives; don't reimplement auth, storage, retrieval, or sync.
- No secrets in client code or the repo. Use DeepSpace secrets if any are needed.
- Only public sample documents. No confidential employer or school material.

## Verification log (fill in as you build — this feeds the writeup)
| Step | What the agent did | What I checked / changed myself |
|---|---|---|
| | | |
