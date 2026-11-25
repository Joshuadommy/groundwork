# Groundwork: submission note

**Live:** https://groundwork.app.space · **Code:** https://github.com/Joshuadommy/groundwork · **Demo video:** https://youtu.be/n7ABJHlI_Jk

## What I built
Groundwork answers questions from a team's documents and never cites anything it didn't retrieve. Editors upload PDFs, Markdown or text, indexed page by page. Each answer shows a verification badge, and its citations open the original page with the supporting sentence highlighted. Teammates rate answers live, and wrong answers become eval cases an owner can re-run. For review, new sign-ins join as Viewers (20 questions a day); a real team deployment makes them wait for owner approval, as the video shows.

## DeepSpace integrations
Used: auth, RBAC with a custom Editor role, real-time records, app files behind a role-checked route, managed knowledge, server-side AI (Claude Sonnet, temperature 0, structured output), background jobs for indexing, agent tools, and presence. Left out: payments (nothing to charge for), collaborative editing, canvas and voice (they don't serve the ask → verify → trust flow), and email invites (server code can't assign roles at sign-in, so owners approve people).

## The main tradeoff
Citation checking is deterministic code, not a second model call: the server keeps only citations that point to passages actually retrieved. That's cheap, testable and guaranteed, but it doesn't prove a passage supports its sentence, or that every sentence is cited.

## What the agent did
Claude Code planned against the DeepSpace docs, ran a timeboxed spike proving per-page PDF indexing in the Worker, then built and deployed phase by phase with tests, logging each step in PLAN.md. When I found that everyday wording retrieved nothing, it diagnosed a fixed relevance cutoff in the platform's search before changing anything, added a fallback that rewrites the question into document-style phrases only when nothing is retrieved, and measured the fix with the app's own evals.

## What I verified myself
- Read `verifyCitations` until I could explain every case, then broke it on purpose and watched the right tests fail before restoring it.
- Tested live as Owner and with a second account: uploaded and indexed a 7-page PDF, followed citations to the highlighted page, approved my second account and watched its screen update live, and deleted documents.
- Found bugs the agent's tests missed: the access screen flashing on refresh, PDFs failing only on the deployed server (a MIME-type issue invisible locally), Apple sign-in missing, and everyday questions returning "Not in your documents" even though the answer was in the document. I re-checked each fix on live.
- Filled in my own column of the verification log in PLAN.md for every phase.

## What's unfinished
No semantic support check; uncited sentences aren't flagged; the daily limit is simple; only the latest 50 answers show; "Partially verified" is exercised only by unit tests.

## SDK feedback
Nineteen findings with workarounds are in PLAN.md, including custom roles reported as `viewer`, no server-side role assignment, no page metadata in knowledge search, and `setRole` without acknowledgement.