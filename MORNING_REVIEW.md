# Morning review

Everything below was built and tested overnight (Phases D2, E, F). This file is the checklist for **your own** verification in the browser, plus the decisions I made without you, what is unfinished, the security pass, and the final test counts.

Live app: **https://groundwork.app.space**. Latest release is listed by `npx deepspace releases`. Commits: `c5af93a` (D2), `3cdd702` (E), and the Phase F commit after it.

Current live data: workspace "Northwind Ops" with the three sample documents (Remote Work Policy, Expense Guidelines, Onboarding Handbook), all ready; the D1 verification answers; one answer from tonight's live coverage check (the stipend question). No eval cases or feedback yet on live.

---

## Checklist (do these yourself)

Use a desktop browser signed in as **your owner account** (the one that deploys). For steps 7 to 10 you also need **your second account** in a private/incognito window.

### 1. Sign in lands in the app
- [ ] Open https://groundwork.app.space/ask in a private window. You should see the sign-in screen (Google and GitHub buttons, theme button top right).
- [ ] Sign in with your owner account. You should land on **/ask**, not a 404. (Before tonight, a fresh sign-in redirected to the removed `/home` page; fixed in D2.)

### 2. Ask a question the documents don't cover, and save it as an eval case
- [ ] On **Ask**, type: `How many weeks of parental leave does Northwind Ops offer?` and press Enter.
- [ ] You see "Searching your documents / Checking citations", then **Not in your documents** with the abstain text.
- [ ] Click 👎 on that answer. A panel opens: type a note (for example "We do have a parental leave policy"), then **Save as eval case**. "Saved as eval case" appears.

### 3. Coverage note, citation, and the highlighted page
- [ ] Ask: `What is the home office stipend, and will Northwind pay for a standing desk?`
- [ ] The answer is **Verified**, and under the badge: *"Answers part of your question; your documents don't cover the rest."*
- [ ] Click the citation chip **1**. The source panel opens on the right: "Remote Work Policy, Page 3", the excerpt with the supporting sentence highlighted in yellow, and the note "This passage was retrieved…".
- [ ] Click **Open page 3 in Remote Work Policy**. The viewer opens on **page 3 of 6**; the sentence about the $450 stipend is highlighted; a green tag says "Cited passage highlighted on this page"; the page-3 thumbnail says "3 · cited".
- [ ] In the viewer: press → and ← (pages change), type a page number and press Enter, use zoom − / + and **Fit width**, click **Download** (the PDF downloads).
- [ ] Back on **Documents**, open **Onboarding Handbook**: it renders as formatted Markdown (headings, lists, tables).

### 4. Upload a document as Owner and watch it index
- [ ] Create a text file on your computer named `parental-leave.txt` containing, for example:
      `Northwind Ops Parental Leave Policy. Employees receive 16 weeks of paid parental leave after six months of employment. Leave can be taken within the first year after a birth or adoption.`
- [ ] **Documents → Upload document**. First try an image file: the dialog says images aren't supported and **Upload** stays disabled. Then choose `parental-leave.txt` → "Ready to upload" → **Upload**.
- [ ] The row appears with an **Indexing** spinner; within about 1–3 minutes it turns **Ready** (no reload needed) and a toast says it is ready to search.

### 5. Re-run evals and see the change
- [ ] Open **Evals**. The parental-leave case shows **Not found**, "Not re-run yet".
- [ ] Click **Re-run all 1**. After a few seconds the row shows **Verified** and **Changed** (status went from abstained to verified). Expand "Latest answer" to see it cites your new document.
- [ ] Optional: ask the parental-leave question again on Ask; it should now be verified and cite `parental-leave`.

### 6. Delete with confirmation
- [ ] On **Documents**, click the trash icon on `parental-leave`. A dialog asks you to confirm; confirm. The row disappears. (Past answers keep their citations; opening one shows "deleted document".)

### 7. Approve your second account and watch its screen change
- [ ] In a private window, sign in with your **second account**. It shows **"You don't have access to this workspace yet"** with its email. Leave this window open.
- [ ] In your owner window, open **Team**. Your second account is under **Waiting for access**. Click **Approve as Viewer**.
- [ ] Without reloading, the second window turns into the app (Ask page).

### 8. Live feedback across two windows
- [ ] Put both windows on **Ask**, side by side.
- [ ] In the second window, click 👍 on an answer. The count goes up in the **owner** window within a second or two. Click 👍 again to remove it; the count goes back down in both.

### 9. What a Viewer can't do
- [ ] In the second window: **Documents** has no Upload button and says only editors and owners can upload; **Evals** has no Re-run button ("Only owners can re-run evals"); **Team** is read-only (no buttons, no emails); 👎 then shows "Save as eval case" disabled with "Editors and owners can save eval cases".
- [ ] (Server side this is covered by the automated test; the UI just mirrors it.)

### 10. Change role, then remove access
- [ ] In the owner window on **Team**, change the second account's role to **Editor** in the dropdown. In the second window, **Documents** now shows **Upload document**.
- [ ] Click the trash icon next to the second account → **Remove member**. The second window returns to the waiting screen; the account is back under Waiting for access.

### 11. Theme
- [ ] Click the moon/sun button in the top bar: the app switches between light and dark; a toast mentions "System" in the account menu.
- [ ] Reload: your choice is kept.
- [ ] Open the account menu (your avatar): Theme **System / Light / Dark**. Choose **System**: the app follows your OS setting again.
- [ ] Signed out (private window), the sign-in screen and the 404 page (https://groundwork.app.space/nope) also have the theme button.

### 12. Phone layout
- [ ] On your phone (or DevTools device mode, e.g. iPhone 14, 390 px wide): the sidebar becomes a top icon bar; Ask has the composer pinned to the bottom; opening a citation shows the source as a bottom sheet; Documents hides the "Uploaded by" column; the viewer toolbar wraps and thumbnails are hidden; dialogs fit the screen.
- [ ] Reference screenshots for every screen are in `docs/screenshots/` (desktop and phone, light and dark).

### 13. Read the code that carries the trust claim
- [ ] `src/lib/verify-citations.ts` is unchanged since Phase C. `src/lib/quotes.ts` and the coverage field run after it and never change the status.
- [ ] Run `npx vitest run` (60 tests) and, with `OWNER_USER_ID` set to GW Owner in `.dev.vars`, `npx playwright test -c tests/playwright.config.ts` (16 pass, 2 skipped unless `GW_LIVE_AI=1`).

---

## Decisions made overnight

1. **Coverage** (your D1 decision): added `coverage: "full" | "partial"` to the model's structured output, stored on `answers`, shown under the badge only when partial and not abstained; missing → "full"; abstained → none. `verifyCitations` untouched; unit tests added. The uncited-sentence limitation is recorded in PLAN.md § Next steps.
2. **Highlight source.** Every knowledge item is a whole page, so highlighting "the cited passage" would highlight the whole page. I added one short **quote per citation** to the structured output; code keeps a quote only if it occurs verbatim in the retrieved passage (whitespace and case ignored) and drops it otherwise. The viewer highlights that quote; without one it falls back to the excerpt text. This is a small scope addition beyond the plan; it costs no extra model calls.
3. **Highlight technique:** the CSS Custom Highlight API over the pdf.js text layer (no DOM mutation). Supported in current Chrome, Edge, Safari 17.2+ and Firefox 140+; elsewhere the page still opens and the tag says "The cited passage is on this page".
4. **Eval "changed" baseline:** a case's first re-run is compared with the answer it was saved from (so the first re-run can already say "Changed"); later runs compare with the previous run. Changed = status or the set of cited (document, page) pairs; wording never counts.
5. **Which 10 cases run:** never-run first, then least recently run, so repeated clicks eventually cover more than 10. Three run at a time inside the action.
6. **Team page for non-owners:** read-only member list with names and roles; the waiting list is hidden from non-owners (they can't act on it). Non-owners never see emails (the SDK roster only includes them for admins).
7. **Eval cases can be saved from any finished answer** the user rated 👎 in the UI; the server requires Editor/Owner and a finished answer, and is idempotent per answer. It does not require a 👎 row (kept simple).
8. **Sample files stay public** at `/samples/…` (they are fictional and needed by setup); uploaded team documents are never public.
9. **Post-sign-in redirect** changed from `/home` (removed in Phase A; every fresh sign-in landed on the 404) to `/ask`.
10. **Live-AI tests are opt-in** (`GW_LIVE_AI=1`): once documents are indexed, the "abstains" test made a real owner-billed model call on every run.
11. **Default document titles** turn `remote-work-policy.pdf` into "remote work policy" when the filename has no spaces.
12. **Scaffold placeholders removed:** the slate/paper theme catalog, Navigation, PagePlaceholder and nav.ts; the static landing at `/` is kept, restyled, with an "Open Groundwork" button.
13. **Local test data:** to test the UI I set up a local workspace and uploaded the samples locally (as GW Owner). Those local documents shared the live knowledge index, so I deleted them at the end through `deleteDocument` (18 knowledge items, 3 files, 3 records). Local answers/eval cases remain only in the local dev database.
14. **Live data:** nothing deleted. Live gained one answer from the coverage check.

## Unfinished, flaky or worth knowing

- **Search index lag after delete.** After deleting the 3 local documents (all 18 knowledge items removed successfully), live search still returned 2 of their pages about a minute later; they were gone 3–4 minutes after deletion. Answers are unaffected either way: the pipeline drops any chunk whose document is not a ready document. Recorded as SDK feedback 15.
- **`setRole` has no acknowledgement** (SDK feedback 13). If the owner's socket is momentarily disconnected, a click on Approve is silently dropped; the UI only changes when the server confirms via the roster broadcast, so you would see nothing happen and can click again.
- **Not verified on live by me:** the upload route's success path and the authenticated file download in a browser (no owner browser session overnight). Both were verified locally through the real UI. Steps 3–4 above cover them on live.
- **"Partially verified" (an invented citation) has never happened with a real model call**; it is covered by unit tests only.
- **No per-user rate limit** on asking questions (each ask is an owner-billed model call).
- The Ask page shows the latest 50 answers; there is no pagination yet.
- PDF pages on a phone are small at fit width (zoom works).
- Large PDFs (100+ pages) were not tested; thumbnails render lazily.
- The prototype's Microsoft and Apple sign-in buttons are not offered (DeepSpace offers Google and GitHub here).
- One test of mine was flaky during Phase E (its cleanup read the roster before it loaded); fixed and re-run green several times.

## Security pass

- **Secrets:** searched all tracked files and the full git history (all branches) for API keys (`sk-`, `ghp_`, `AKIA`), private keys, JWTs (`eyJhbGciOi…`), and `APP_OWNER_JWT=`, `APP_IDENTITY_TOKEN=`, `AUTH_JWT_PUBLIC_KEY=`, `OWNER_USER_ID=` assignments: **0 matches**. No `.dev.vars`, `.env`, key or credential file has ever been committed. `.dev.vars`, `.dev.vars.*`, `.env` and `.env.*` are gitignored (`.env` lines added tonight; no such files exist). Checked before every commit tonight.
- **Every server entry point checks the role:**
  - Actions (all wrapped in `withRole`): `askQuestion` (Viewer/Editor/Owner), `setupWorkspace` (Owner), `retryDocumentIndexing`, `deleteDocument`, `saveEvalCase` (Editor/Owner), `runEvals` (Owner).
  - HTTP: `POST /api/documents` (Editor/Owner, 401 without token, 403 otherwise), `GET /api/documents/:id/file` (approved teammates).
  - Agent tools: each calls `requireRole` (setup Owner; retry Editor/Owner; list, ask, search approved teammates), on top of `registerAgent`'s team-only `authorize`.
  - WebSockets: records and jobs require a verified token (401 otherwise); the job room only lets Owners write.
  - Role changes: only admins (the SDK refuses `setRole` otherwise); `role` is a system-assigned column, so nobody can edit their own.
- **No client can write answers, documents, eval cases, eval runs or the workspace:** every role has `create/update/delete: false` on them. This is now a unit test (`src/schemas/permissions.test.ts`), and the multi-user Playwright test confirms an approved Viewer is refused `saveEvalCase`, `runEvals`, `deleteDocument` and upload by the server. The only client-writable data are a user's own feedback rows (`userId` is user-bound) and their own profile fields.
- Viewers waiting for access read nothing (unit-tested), and actions refuse them (Playwright).

## Final test counts

- **Unit (Vitest):** 60 tests in 10 files, all passing.
- **Playwright:** 18 tests. With `GW_LIVE_AI=1`: 18 passed. Default run: 16 passed, 2 skipped (the two that make a real model call).
- Type-check and lint: clean.
- **Live model calls used tonight:** 9 of the 25 allowed (local ask 1, live coverage check 1, eval re-run 1, local coverage example for screenshots 1, the live-AI test runs 5 including the final opt-in run).
