# Groundwork: submission note (draft)

**Live:** https://groundwork.app.space · **Code:** https://github.com/Joshuadommy/groundwork

## What I built
Groundwork answers questions from a team's documents and refuses to cite anything it didn't retrieve. Editors upload PDFs, Markdown or text, indexed page by page. Each answer shows a verification badge, citation chips that open the source passage, and "Open page N", which opens the original with the supporting sentence highlighted. Teammates rate answers live; bad answers become eval cases an owner re-runs. New sign-ins wait until the owner approves them as Viewer or Editor.

## DeepSpace integrations
Used: auth, RBAC with a custom Editor role, real-time records, app files behind a role-checked route, managed knowledge, server-side AI (Claude Sonnet, temperature 0, structured output, billed to the owner), background jobs for indexing, and agent tools. Left out: payments (nobody to charge), presence (scope), collaborative editing, canvas and voice (they don't serve the ask → verify → trust flow), and invite records (server code can't assign a role at sign-in, so the owner approves people).

## The main tradeoff
Citation checking is deterministic code, not a second model call. The model cites labelled passages; the server keeps only labels that were actually retrieved. That guarantees every citation points to a real retrieved passage, cheaply and testably. It does not prove the passage supports the sentence, or that every sentence is cited. Coverage ("answers part of your question") is the model's own judgment, shown as a note and never as verification.

## What the agent did
Claude Code planned against the DeepSpace docs, ran a timeboxed spike proving per-page indexing in the Worker, and built the app phase by phase with tests, deploying after each. It found and fixed real bugs (a list-size limit, a sign-in redirect to a deleted page, an import cycle breaking an action) and logged each step in PLAN.md.

## What I verified myself
- _[placeholder]_
- _[placeholder]_
- _[placeholder]_

## What's unfinished
No semantic support check; uncited sentences aren't flagged; no per-user rate limit on questions; the Ask page shows only the latest 50 answers; "Partially verified" has only been exercised by unit tests.

## SDK feedback
Seventeen findings with workarounds are in [PLAN.md § DeepSpace SDK feedback](PLAN.md#deepspace-sdk-feedback), notably: role helpers that report custom roles as `viewer`, no server-side role assignment, knowledge search without page metadata, and `setRole` with no acknowledgement.
