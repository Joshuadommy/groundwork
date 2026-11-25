# Groundwork: submission note (draft)

**Live:** https://groundwork.app.space · **Code:** https://github.com/Joshuadommy/groundwork · **Demo video:** https://youtu.be/n7ABJHlI_Jk

## What I built
Groundwork answers questions from a team's documents and refuses to cite anything it didn't retrieve. Editors upload PDFs, Markdown or text, indexed page by page. Each answer shows a verification badge, citation chips that open the source passage, and "Open page N", which opens the original with the supporting sentence highlighted. Teammates rate answers live; bad answers become eval cases an owner re-runs. This review deployment admits new sign-ins as Viewers (20 questions a day) so you can try it at once; a real team deployment makes them wait for the owner's approval, as the video shows, and switching is one setting.

## DeepSpace integrations
Used: auth, RBAC with a custom Editor role, real-time records, app files behind a role-checked route, managed knowledge, server-side AI (Claude Sonnet, temperature 0, structured output, billed to the owner), background jobs for indexing, agent tools, and presence (which teammates are online; people awaiting access never appear). Left out: payments (nobody to charge), collaborative editing, canvas and voice (they don't serve the ask → verify → trust flow), and invite records (server code can't assign a role at sign-in, so the owner approves people).

## The main tradeoff
Citation checking is deterministic code, not a second model call. The model cites labelled passages; the server keeps only labels that were actually retrieved. That guarantees every citation points to a real retrieved passage, cheaply and testably. It does not prove the passage supports the sentence, or that every sentence is cited. Coverage ("answers part of your question") is the model's own judgment, shown as a note and never as verification.

## What the agent did
Claude Code planned against the DeepSpace docs, ran a timeboxed spike proving per-page indexing in the Worker, and built the app phase by phase with tests, deploying after each. It found and fixed real bugs (a list-size limit, a sign-in redirect to a deleted page, an import cycle breaking an action) and logged each step in PLAN.md. When I found that everyday wording retrieved nothing, it diagnosed the cause before changing anything (a fixed relevance cutoff in the platform's search), added a fallback that rewrites the question into document-style search phrases only when nothing is retrieved, and measured the fix with the app's own evals: two questions changed from Not found to Verified, and an off-topic one stayed Not found.

## What I verified myself
- Read `verifyCitations` and its tests until I could explain every case, then broke it on purpose (partial reported as verified), watched the right tests fail in both test files, and restored it.
- Tested the live app as Owner and with a second account: uploaded a 7-page PDF and watched it index, opened citations to the highlighted page, approved my second account from Team and watched its waiting screen turn into the app, saw both of us online, and deleted documents.
- Found bugs the agent's tests had missed and sent them back: the waiting screen flashing for the Owner on refresh, PDFs that wouldn't open on live (a server MIME-type issue invisible locally), and Apple sign-in missing from the sign-in screen.
- Found that everyday questions ("Do I need to tell anyone if I'm dating a coworker?") abstained even though the answer was on page 3. After the fix, I confirmed on live that both failing questions return Verified with the right pages, and that "What's the dress code?" still returns Not in your documents.
- Checked phone layouts, the theme toggle and the favicon, and filled in my own column of the verification log in PLAN.md for every phase.

## What's unfinished
No semantic support check; uncited sentences aren't flagged; the per-user limit is a simple 20 questions per rolling 24 hours; the Ask page shows only the latest 50 answers; "Partially verified" has only been exercised by unit tests.

## SDK feedback
Nineteen findings with workarounds are in [PLAN.md § DeepSpace SDK feedback](PLAN.md#deepspace-sdk-feedback), notably: role helpers that report custom roles as `viewer`, no server-side role assignment, knowledge search without page metadata, and `setRole` with no acknowledgement.
