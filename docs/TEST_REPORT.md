# Test report

**Date:** 22 October 2026, updated 29 October 2026 for Student Learning and 13 November 2026 for Classroom · **Commit:** the commit that last changed this file (branch `claude/busy-cerf-vb9w2a`) · **Environment:** Linux x64 container (kernel 6.18), Node 22.22 for Vitest, Electron 44.9.3 (Node 24.22, Chromium) for the app, Xvfb display, running as root (`--no-sandbox`).

Only results that were actually produced are listed. Nothing here was run on Windows or macOS.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| Type checking (Node side + renderer) | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass (0 problems) |
| Unit + integration | `npm test` | **358 passed**, 0 failed, 25 skipped (the live tests below, which skip themselves without their environment variables) — 13 Nov 2026 |
| Student Learning content harness, stress run | `FC_CONTENT_SEEDS=300 npx vitest run tests/unit/content.test.ts --testTimeout=1000000` | **Pass**: all 35 skill packs at every difficulty, 300 seeds per level; no generated question needed to be discarded by its self-check |
| Live: Ontario curriculum against the Ministry site | `NODE_USE_ENV_PROXY=1 npm run curriculum:verify` | **No changes** between the shipped bundle (fetched 22 Oct 2026) and the live site (29 Oct 2026): 297 courses, 11,153 expectations, 37 requests |
| End-to-end (real Electron app, real extension in Chromium, classroom browser build) | `npm run build && npm run build:classroom && xvfb-run -a npx playwright test` | **27 passed**, 0 failed, 1 skipped (the live-model test, which needs `FC_LIVE_OPENAI_COMPAT_URL`) — 13 Nov 2026 |
| Classroom accessibility | axe-core 4.14 (WCAG 2.0/2.1 A and AA, 2.2 AA rules) inside `tests/e2e/classroom-web.spec.ts` | **0 violations** on 8 screens: sign-in, materials, questions, settings, student pre-start notice, student workspace, teacher review, student results. The first runs found real contrast failures (form hints, status badges), fixed in the shared colour tokens |
| Classroom load (35 students at once) | `npx vitest run tests/integration/classroom-load.test.ts` | **Pass**, see Performance |
| Live: classroom AI-use judge against Claude | `ANTHROPIC_API_KEY=… npx vitest run tests/live/classroom-judge.test.ts` | **Not run: no Anthropic API key in this environment.** No agreement numbers exist yet. Acceptance test 27 is therefore not met |
| Live: classroom assistant against Claude | `ANTHROPIC_API_KEY=… npx vitest run tests/live/classroom-assistant.test.ts` | **Not run**, same reason |
| Live: real local model | `FC_LIVE_OPENAI_COMPAT_URL=http://127.0.0.1:8080/v1 npx vitest run tests/live/local-model.test.ts` | **2 passed** (llama.cpp `llama-server`, Qwen2.5-0.5B-Instruct Q4_K_M) |
| Live: built-in news feeds | `FC_LIVE_FEEDS=1 npx vitest run tests/live/feeds.test.ts` | **11 passed, 10 failed** — every failure is `403 Blocked by egress policy` from this environment's outbound proxy (feeds.bbci.co.uk, arstechnica.com, theverge.com, espn.com), not from the publishers. Earlier the same day all 21 passed. The packaged app (Electron's network stack) loaded BBC, Hacker News and NASA feeds at 06:43 (see `docs/images/home.png`). |
| Learning Hub links | `node scripts/verify-links.mjs --dry` | **72/72 verified** (HTTP 2xx and expected page text) |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities in runtime dependencies (13 Nov 2026, after upgrading pdfjs-dist to 6.5.438 for a high-severity advisory and fast-xml-parser to 5.12.0); 8 moderate in the build tool chain (see SECURITY.md) |
| Packaged app smoke test | Launch `release/linux-unpacked/flowcompanion` and the AppImage (`APPIMAGE_EXTRACT_AND_RUN=1`) under Xvfb with a fresh data folder | Both stayed running, created the database and backups, and rendered the Home screen |

## Unit and integration tests by file

| File | Passed | What it covers |
| --- | ---: | --- |
| tests/unit/db.test.ts | 13 | Migrations, transactions, backups, corruption recovery, newer-schema refusal |
| tests/unit/settings.test.ts | 9 | Schema defaults, validation, repair of invalid stored values, modes |
| tests/unit/notes.test.ts | 13 | Notes CRUD, revisions/conflicts, drafts and recovery, search, trash, import/export |
| tests/unit/productivity.test.ts | 10 | Task lists and checklists, today/upcoming in the user's time zone, reordering, bookmarks and reading queue (http(s) only), time tracker, focus sessions and long breaks, global search, quick-capture classification |
| tests/unit/calc-units.test.ts | 13 | Safe calculator (no `eval`), unit conversions |
| tests/unit/calendar.test.ts | 21 | Recurrence and exceptions, this/following/all edits, time zones and DST, reminders delivered once, missed reminders, quiet hours, ICS escaping |
| tests/unit/scheduler.test.ts | 3 | Single wake-on-demand timer: earliest source, one-hour cap, failing source isolated |
| tests/unit/data.test.ts | 1 | Export everything excludes secrets |
| tests/unit/feed.test.ts | 12 | Parser (RSS, Atom, RDF, hostile input), ETag caching, failures, size cap, cross-source and same-feed duplicate collapsing, alerts, blocking |
| tests/unit/games.test.ts | 9 | Sudoku uniqueness/conflicts, word evaluation with repeated letters, memory, trivia, scores |
| tests/unit/learning.test.ts | 16 | Catalog validity (no ratings/durations, every link verified), filters, progress, paths, consent-based recommendations, export/delete |
| tests/unit/prompts.test.ts | 9 | Variables and defaults, versions and restore, search/filters, import/export, FTS indexing |
| tests/unit/parental.test.ts | 19 | Acceptance tests PA–PO, plus locked sections (PIN, sessions, migration of the old games-only lock) |
| tests/unit/curriculum.test.ts | 16 | Rich-text sanitising (allow-list, nested lists, whitespace), bundle parsing and validation, diffs, curriculum store: import, revisions, removed records, search, update check and apply, unverified file import, coverage |
| tests/unit/content.test.ts | 4 | Every skill pack: mappings point at real expectations, generated keys mark themselves correct and pass the pack's independent recomputation, known wrong answers are recognised, text renders (no NaN/undefined, valid LaTeX) |
| tests/unit/study-core.test.ts | 20 | Exact rational arithmetic, expression parsing/equivalence/simplification, answer checking for every question type, mastery statuses and weights, adaptive difficulty, gaps, spaced review |
| tests/unit/study-service.test.ts | 23 | Profiles and PIN lockout, isolation, lessons (pause/resume/repeat), quizzes and redaction, evidence and mastery, plans → calendar events/tasks, assignments, assessments, AI paths with a fake provider (consent, name not sent, invalid JSON rejected), reports and parent sharing, export/delete |
| tests/unit/data.test.ts | 2 | Export everything excludes secrets and Student Learning profiles |
| tests/unit/protocol.test.ts | 3 | `app://` path-traversal refusal, CSP |
| tests/integration/ai.test.ts | 34 | OpenAI, OpenAI-compatible, Anthropic (official SDK), Gemini and Ollama adapters against mock servers: no fabricated replies without a provider, key storage (encrypted or session-only), streaming, non-streaming, cancel, idle timeout, retry on another model, network, auth, rate-limit, missing-model and refusal errors, Claude refusal fallback and content-block replay, conversation management, retention, tutor prompt |
| tests/integration/marketplace-server.test.ts | 11 | Accounts and scrypt, moderation flow, preview rule, verified reviews, server-enforced 7-day trial including expiry, 501 purchases, reports, malformed requests, demo seed, rate limiting |
| tests/integration/marketplace-client.test.ts | 8 | Desktop marketplace offline and against the real reference server end to end |
| tests/integration/bridge.test.ts | 6 | Loopback only, origin and DNS-rebinding rejection, pairing expiry/attempt limits, capture and ask, session blocking, port conflicts |
| tests/unit/classroom-shared.test.ts | 10 | Teacher question format to checker questions, redaction of keys, response parsing, overlap computation and verbatim checks, CSV with formula neutralising, the recorded-data notice, rule-change detection, and a source scan: no camera, microphone, screen, keystroke, location or clipboard-reading code in any classroom file |
| tests/unit/classroom-judge-set.test.ts | 2 | The AI-use evaluation set: 42 synthetic cases, every kind of use, labels for every criterion with at least three levels each, jailbreak cases match the rule-change check |
| tests/integration/classroom-accounts.test.ts | 10 | School setup and setup code, teacher invites, student join and approval, sessions, cookie sessions and the CSRF header, lockout per sign-in name, roles, archive and delete, under-13 confirmation, roster preview and commit |
| tests/integration/classroom-materials.test.ts | 12 | PDF, DOCX, PPTX, text and image extraction; scanned PDFs reported, not faked; type, size and structure checks; ClamAV against a mock daemon (and failing closed); encryption at rest; versions; signed download links; class quota |
| tests/integration/classroom-assessments.test.ts | 13 | AI drafts must be reviewed before publishing; invalid AI drafts add nothing; item validation, reorder, import; versions; notice and acknowledgement; redaction; autosave, resume and auto-submit; late work; extra time and closing times; schedule and attempt limits; activity events and accommodations; route-by-route access isolation; partial updates keep unsent fields; hints only in practice |
| tests/integration/classroom-grading.test.ts | 25 | Assistant requests (rules per mode, fencing, documents, no names, caching-friendly system prompt, exact replay), citations to pages, draft sharing, rule-change logging, limits, refusals and failures, no-AI mode; auto-marking and overrides with reasons; AI-suggested written marks with invented-quote removal; "Not graded" and "Not evaluated" after one retry; release and visibility; practice results; gradebook and CSV match; class overview; comment bank; AI-use evaluation with linked evidence, teacher decisions and student replies; empty chats never sent; code-computed overlap; a batch of 30 matched by id; audit of chat views; admin chat access off by default; budget pause and resume; the AI key never returned; retention purge of rows, files and provider copies; student export |
| tests/integration/classroom-anthropic.test.ts | 7 | The Claude provider against a local mock of the Anthropic HTTP API: cited document blocks and their order, cache-control placement, adaptive thinking and effort, streamed text and citation mapping (page and block), refusal fallback beta and turning it off when rejected, replay retry, structured-output schema, batches without fallbacks and matched by `custom_id`, Files API upload and delete, error mapping |
| tests/integration/classroom-load.test.ts | 1 | 35 students start, chat, autosave five times, send events and submit at the same moment under default rate limits; every answer is the student's last save |

## End-to-end tests (Playwright, real app)

| Spec | Test |
| --- | --- |
| ai.spec.ts | Honest setup screen, then chat through a (mock) provider, save the answer as a note and as a task, search after restart; provider errors with guidance and retry on another model; **live: a real local model answers through the UI** |
| core.spec.ts | Settings persist and apply; notes create/autosave/search/restart/trash/restore; unsaved edits recovered after the app is killed (SIGKILL); Markdown export; tasks and quick capture; calendar event survives restart; reminders delivered once across restarts; floating companion opens without stealing focus, collapses, remembers position |
| discover.spec.ts | News: add a local feed, search, save; games: trivia round score, sudoku progress survives restart; word guess, memory and reaction time played with keyboard and mouse |
| learning.spec.ts | Browse, progress, notes autosave, study session scheduled into the calendar, global search, restart; notes typed just before quitting are kept; paths and goals change suggestions |
| marketplace.spec.ts | Prompt versions/restore/variables/copy; bundled listing saved to library; reference server: sign-up, trial disclosure gate, server trial, purchase refused, publish for review |
| parental.spec.ts | PA–PO in the app: off by default, setup with recovery code, banner, AI copy blocked, wrong PIN, session locks sections, survives restart, end early, turn off; a parent locks News, Games and AI (locked screens, Home, command palette, AI refused by the main process), locks persist and unlock with the PIN |
| study.spec.ts | Student Learning offline: onboarding, official expectation with source, coverage page, lesson paused and resumed after a restart at the same step, quiz with redacted keys, progress page, plan approval creating calendar events, a second profile with a PIN sees nothing of the first, typed confirmation to delete records, AI tutor honestly off; with a mock AI provider: consent dialog, tutor streams a reply, the student's name is absent from every request, invalid AI lesson output is reported and nothing is saved |
| browser.spec.ts | Bridge off by default, turned on from Settings, pairing code, page saved to the reading queue |
| extension.spec.ts | Real extension loaded in Chromium: popup pairing (wrong then right code), context-menu actions save page/selection, ask AI, non-web pages refused, a normal web page cannot use the bridge |
| classroom-web.spec.ts | The classroom browser build against a real classroom server (scripted AI). A first visit sets up the school. A teacher creates a class, makes a code, uploads a PDF, writes a multiple-choice and a written question, attaches the material and publishes. A student joins with the code, reads what is recorded and acknowledges it, asks the assistant (reply with a citation that opens the page), is blocked from copying the reply and pasting into an answer (both recorded), autosaves, reloads and resumes, and submits with a receipt. The teacher sees the chat, the activity with what it means and the AI-suggested evaluation, changes a level, marks the written answer and releases. The student sees the teacher's decision and not the AI's rationale. axe scans at 8 points |
| classroom-desktop.spec.ts | The Classroom section of the built Electron app: http refused for a non-local server, connect, sign in, the token stays in the main process, assistant reply streamed through IPC, the whole app refuses to copy while the assessment is open and allows it after, resume and submit |

## Performance (measured, this environment only)

4 vCPU, 16 GB RAM, Linux container, software rendering under Xvfb. Numbers on real desktops will differ.

| Measurement | Result |
| --- | --- |
| Launch to interactive Home screen (built app, Playwright timing) | 949 ms on first start (migrations, seeding), 873–911 ms on later starts |
| Memory after start-up (sum of `workingSetSize` over all Electron processes) | 532–576 MB |
| Insert 5,000 notes of ~300 words, including full-text index triggers | 1.1 s |
| Global full-text search over those notes (25 queries) | median 7.3 ms, max 11.5 ms |
| List all 5,000 notes with excerpts (not paginated) | 152 ms |

**Classroom server, 35 students at once** (`tests/integration/classroom-load.test.ts`; in-process server on the same machine, SQLite on local disk, scripted AI with a 50 ms reply delay, default rate limits). 350 requests in 553 ms:

| Request | n | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| Start attempt | 35 | 115 ms | 311 ms | 324 ms |
| Autosave | 175 | 21 ms | 180 ms | 309 ms |
| Chat (including the 50 ms scripted reply) | 35 | 78 ms | 89 ms | 90 ms |
| Activity events | 35 | 22 ms | 33 ms | 39 ms |
| Submit | 35 | 22 ms | 35 ms | 36 ms |

This measures the server, not the AI or the network: real Claude replies take seconds.

Background activity: one timer that sleeps until the next due job (max 1 hour); feeds refresh hourly by default with conditional requests (ETag/Last-Modified); modules load lazily.

## Defects found by tests and fixed during this work

- The parental recovery code dialog disappeared as soon as setup finished (found by the e2e test).
- The extension popup overwrote the "Connected" status after pairing (found by the extension e2e test).
- Same-feed republished articles (BBC re-issues items with new GUIDs) showed twice (found by smoke-testing the packaged app).
- The marketplace reviews/reports tables could not record server listings (foreign key), fixed with migration v11.
- The preview check rejected valid descriptions of short prompts; replaced with a word-sequence overlap check.
- Oversized request bodies reset the connection instead of returning 413 (server and bridge).
- Learning-resource notes typed less than 0.6 s before quitting or leaving the page were lost (the debounced save was cancelled). Found by the first GitHub Actions run; notes now save immediately on blur, page leave and window close.
- An end-to-end test used a loose label locator (`Source`) that sometimes also matched a listing titled "…sources"; made exact and re-run 10 times without failure.

- Student Learning: the tutor screen crashed after a reply (`destroy is not a function`) because `scrollIntoView` returns a promise in current Chromium and an arrow-function effect returned it (found by study.spec.ts).
- Student Learning: AI was reported as available when the provider had no default model, so the tutor failed later; the status now names the missing model (found by study.spec.ts).
- Student Learning: a Grade 8 order-of-operations question negated a fraction object with JavaScript's unary minus, producing NaN (found by the content harness).
- Student Learning: "Export everything" would have included student profiles (PIN hashes, records of PIN-protected profiles); they are now left out (found in review, unit-tested).

- Classroom: a `null` reply was sent as `{ "ok": true }`, so "no class code" looked like a code without text and crashed the Students tab (found by the web e2e test).
- Classroom: partial updates reset unsent fields to their defaults. Renaming an assessment wiped its settings and materials, and accepting an AI-drafted question set its points to 1 (found while building the editor; regression test added).
- Classroom: activity events recorded just before a reload were lost; they are now kept in the browser until the server has them (found by the web e2e test).
- Classroom: the browser upload left out the file name, and bodiless POSTs (submit, suggest) were rejected (found by the web e2e test).
- Classroom: hints were sent to students outside practice quizzes (found in review; test added).
- Classroom: the chat history could arrive after a streamed reply and overwrite it with a partial copy (found by the desktop e2e test).
- Classroom: Back from a submission lost the open tab (found by the web e2e test).
- Classroom: assistant history was replayed in timestamp order, so a reply could come before its question when both shared a millisecond (found by the grading tests).
- Shared: form hints, faint text and status badges failed WCAG AA contrast in both themes (found by axe); the colour tokens were adjusted for the whole app.
- Dependencies: pdfjs-dist 5.7 had a high-severity advisory (script execution from a crafted PDF); upgraded to 6.5.438 (found by `npm audit`).

## Not executed

- Classroom with the real Claude API: the assistant's behaviour, the AI-use judge's agreement on the evaluation set (acceptance test 27), real latency and cost. No API key was available here; the runners are in `tests/live/`.
- Classroom on Chromebooks, in Safari or Firefox, with screen readers, on a school network, or with more than one class at once.

- Anything on Windows or macOS: installers, tray, notifications, global shortcuts, launch at login, content protection, OS keychain storage.
- Cloud AI providers with real accounts (OpenAI, Anthropic, Google): only mock servers; no API keys were available.
- The Windows NSIS installer and macOS DMG builds (need Wine / macOS). The GitHub Actions workflow that builds them has not been run.
- Pedagogical review of Student Learning lessons by an Ontario teacher; Student Learning with real cloud AI providers; the assessment builder and parent report through the UI (covered by unit tests only).
- Screen-reader testing, manual accessibility audit, performance/load tests, penetration testing.
- The tray icon and OS notifications on Linux (no tray or notification daemon under Xvfb); notifications were verified through the app's inbox and notification log.
