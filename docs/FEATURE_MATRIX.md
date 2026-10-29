# Feature completion matrix

Classifications, as defined in the brief:

- **Verified**: implemented and verified by automated tests that ran (unit/integration and/or end-to-end in the real app), on Linux.
- **Not fully verified**: implemented, but some part was not exercised: another OS, a real third-party account, or a UI path without a test.
- **Partial**: partially implemented.
- **Demo only**: demonstration only.
- **Blocked**: cannot be done in this environment.
- **Not implemented**.

"e2e" = Playwright against the built Electron app; "unit"/"int" = Vitest. Details: [TEST_REPORT.md](TEST_REPORT.md).

## Desktop shell and floating companion

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| Main workspace, sidebar navigation, lazy-loaded modules, command palette | Verified | e2e (every spec navigates) |
| Global search across notes, tasks, prompts, conversations, events, bookmarks, saved articles, learning resources | Verified | unit (FTS), e2e (learning, AI search) |
| Application modes (personal, student, creator, advanced, parent-managed, educator) | Verified | unit (presets) |
| Enable/disable modules | Verified | e2e (Games hidden, persists) |
| Theme and accent, applied instantly and persisted | Verified | e2e |
| Text size, density, high contrast, reduced motion | Not fully verified | Implemented and applied via CSS tokens; no automated visual check |
| Distraction-free mode | Not fully verified | Implemented; no test |
| Floating companion: open without stealing focus, collapse to launcher, expand, remember position and size | Verified | e2e |
| Companion: move/resize by dragging, minimize, close/hide, always-on-top, dock left/right, opacity | Not fully verified | Implemented; only persistence is tested; window-manager behaviour not tested |
| Tray / menu-bar icon and menu | Not fully verified | Implemented; no tray available under Xvfb |
| Global keyboard shortcuts with conflict reporting | Not fully verified | Implemented; registration status shown; not exercised with a real desktop |
| Launch at login, start hidden, close to tray | Not fully verified | Linux autostart file / OS login items; not tested |
| No focus stealing on reminders and companion | Verified | e2e (companion), notification centre uses OS notifications |
| Window preferences persist | Verified | e2e (companion) |

## AI workspace and AI task status

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| Honest setup state when no provider; never fabricates replies | Verified | e2e, int |
| Conversations: create, rename, archive, delete, search, export (Markdown/JSON) | Verified | int, e2e (search after restart) |
| Streaming, cancel (keeps partial text), retry, retry on another model | Verified | int, e2e |
| Errors: invalid key, rate limit, missing model, network failure, idle timeout, refusal | Verified | int (mock providers), e2e (error + retry) |
| Markdown rendering (no raw HTML) and code blocks | Verified | e2e renders answers; code-block copy button not separately tested |
| Answer → note and → task, linked to the conversation | Verified | e2e |
| Global and per-conversation system instructions | Verified | int |
| Attachments (notes/tasks/events) with confirmation before sending | Verified | int (only explicit attachments sent); confirmation dialog not e2e-tested |
| Local model through OpenAI-compatible API (llama.cpp) | Verified | live int + live e2e with a real model |
| OpenAI, Anthropic (official SDK), Google Gemini, Ollama | Not fully verified | int against protocol-faithful mock servers; no real accounts or Ollama install were available |
| Claude specifics: no temperature sent, adaptive thinking replay, refusal fallback on by default (switchable per provider) | Not fully verified | int with mocks; not run against api.anthropic.com |
| API keys in OS secure storage | Not fully verified | Session-only fallback verified (no keyring here); Keychain/DPAPI/libsecret paths not run |
| Usage and capability disclosure | Verified | int (usage recorded), setup screen shows capabilities |
| AI task status: idle/running/waiting/completed/failed/canceled/unknown; confirmed vs estimated vs manual; timers; restart-safe | Verified | int |
| Completion signals from browser integration events | Not implemented | The extension does not report AI-website task status |
| Visible-state detection of external AI tasks | Not implemented | By design; never inferred from inactivity |

## Notes and knowledge

| Feature | Status | Evidence |
| --- | --- | --- |
| Create, edit, autosave with status, Markdown/plain, preview | Verified | unit, e2e |
| Crash recovery of unsaved edits (SIGKILL) | Verified | e2e |
| Folders, tags, favourites, pins, archive, trash with retention, restore | Verified | unit, e2e (trash/restore) |
| Full-text search with snippets | Verified | unit, e2e |
| Import (JSON, Markdown, text) and export (Markdown, text, JSON, all notes) | Verified | unit, e2e (Markdown export) |
| Explicit links between notes, tasks, prompts, events, conversations, bookmarks, learning resources | Verified | unit, e2e (study event linked to resource) |

## Productivity

| Feature | Status | Evidence |
| --- | --- | --- |
| Tasks, lists, checklists, due dates, today/upcoming, reordering | Verified | unit, e2e |
| Quick capture (main window, companion, global shortcut, prefixes) | Verified | unit, e2e (shortcut path not tested) |
| Focus (Pomodoro) timer with breaks and streaks | Verified | unit |
| Reminders | Verified | unit, e2e |
| Bookmarks and reading queue | Verified | unit, e2e (browser bridge saves to queue) |
| Calculator and unit converter (safe evaluator) | Verified | unit |
| Time tracker | Verified | unit |
| Study planner (study events in the calendar) | Not fully verified | Implemented; the Learning Hub path into the calendar is e2e-tested, the planner tab is not |

## Calendar and reminders

| Feature | Status | Evidence |
| --- | --- | --- |
| Day, week, month and agenda views | Not fully verified | Agenda view e2e-tested; other views implemented without UI tests |
| Recurrence (daily/weekly/monthly/yearly, by weekday, nth weekday, count/until) with exceptions and this/following/all edits | Verified | unit |
| Time zones and DST | Verified | unit |
| Locations, meeting links, notes, categories, checklists | Not fully verified | Implemented; covered only partly by unit tests |
| Multiple reminders, snooze, dismiss, quiet hours, missed reminders, never duplicated across restarts | Verified | unit, e2e |
| ICS export | Verified | unit |
| External calendar sync (Google, Microsoft, CalDAV) | Not implemented | Not built; nothing claims it |

## News

| Feature | Status | Evidence |
| --- | --- | --- |
| 21 built-in publisher feeds + your own RSS/Atom; topics; attribution; previews only | Verified | unit; live: 21/21 earlier on 22 Oct, 11/21 later (other 10 blocked by this environment's egress policy) |
| Caching with ETag/Last-Modified, failure reporting, 5 MB cap | Verified | unit |
| Search, saved, read/unread, blocking sources | Verified | unit, e2e |
| Duplicate collapsing (across sources and same-feed republications) | Verified | unit |
| Keyword alerts as notifications | Verified | unit |
| Demo news data | n/a | None used: only real feeds |

## Games

| Feature | Status | Evidence |
| --- | --- | --- |
| Word guess | Verified | unit (logic), e2e (keyboard play, invalid-guess message) |
| Sudoku (unique puzzles, 3 difficulties, notes, conflicts, resume) | Verified | unit, e2e (resume after restart) |
| AI & computing trivia (verified questions, explanations) | Verified | unit, e2e |
| Memory match | Verified | unit (logic), e2e (cards flip, moves counted) |
| Reaction time | Verified | unit (scores), e2e (start, false start detected) |
| Rules, restart, keyboard play, reduced motion, local scores, module can be disabled | Verified | e2e (disable, scores), reduced motion implemented |

## Learning Hub

| Feature | Status | Evidence |
| --- | --- | --- |
| 72 free resources (articles, guides, videos, courses, exercises, docs, projects, books) with publisher, level, prerequisites, sign-up rules, paid extras, accessibility notes | Verified | unit (schema; no ratings/durations) |
| Link verification script, results shown in app | Verified | 72/72 on 22 Oct |
| Nine learning paths | Verified | unit, e2e |
| Search, filters, saved, progress, completion, notes, resume | Verified | unit, e2e |
| Study scheduling with reminders | Verified | e2e |
| Export and delete learning data | Verified | unit |
| Personalised suggestions with separate consents (goals, activity, conversation titles) | Verified | unit, e2e (goals) |

## Prompt library, marketplace, creators

| Feature | Status | Evidence |
| --- | --- | --- |
| Prompts: create/edit, categories, tags, search, filters, favourites | Verified | unit, e2e |
| Versions and restore | Verified | unit, e2e |
| Variables with defaults and validated substitution | Verified | unit, e2e |
| Provider labels | Verified | unit |
| Copy and open in AI workspace | Verified | e2e (copy); "open in AI" navigates with the prompt prefilled |
| Import/export | Verified | unit |
| Bundled free starter listings (labelled, unrated) | Verified | int, e2e |
| Listings, detail pages, search, categories, creator profiles, previews | Verified | int, e2e |
| Free and paid listing types, versioning, pricing fields | Verified | int |
| Verified reviews (only from people who used the prompt) | Verified | int |
| Abuse reports and moderation (server); local hide/restore | Verified | int; the moderator screens in the app are not e2e-tested |
| Creator drafting, checklist, publishing for review, unpublish | Verified | int, e2e (publish) |
| Listing files (.flowprompt.json) for free listings | Verified | int |
| Creator analytics from real server events | Verified | int |
| Explicit 7-day trials with disclosure, server-authoritative expiry | Verified | int (expiry with server clock), e2e (disclosure gate, trial) |
| Trial expiry reminders | Not fully verified | Scheduler source implemented; not tested |
| Reference marketplace server | Verified | int (11 tests); not deployed anywhere |
| Payments, receipts, refunds, creator payouts, subscriptions | Not implemented | Purchases are refused honestly (501); nothing is ever charged |

## Settings, privacy, security

| Feature | Status | Evidence |
| --- | --- | --- |
| Central settings with validation, repair, persistence; every setting has an effect | Verified | unit, e2e; usage audit of every key |
| Export everything (no secrets), backups, restore | Verified | unit |
| Delete everything | Not fully verified | Implemented; not tested (it restarts the app) |
| Privacy inventory screen | Verified | unit (inventory) |
| CSP, sandbox, IPC sender checks, navigation/permission denial, path-traversal protection | Verified | unit (protocol), code review; runtime behaviour exercised by every e2e test |
| Electron fuses in packaged builds | Not fully verified | Applied in the Linux build log; not checked on Windows/macOS |
| Dependency audit | Verified | 0 runtime vulnerabilities |
| Automatic updates | Not implemented | |
| Accounts and sync for personal data | Not implemented | Settings says so |

## Optional integrations

| Feature | Status | Evidence |
| --- | --- | --- |
| Browser bridge (loopback, pairing, origin/host checks) | Verified | int, e2e |
| Chromium extension (MV3): save page/selection, task, ask AI | Verified | e2e with the real extension in Chromium |
| Firefox / Safari extension | Not implemented | |

## Parental Learning Controls

| Feature | Status | Evidence |
| --- | --- | --- |
| Off by default, scope explanation, explicit setup, PIN, recovery code, lockout | Verified | unit PA–PO, e2e |
| Status banner | Verified | e2e |
| Block copying AI answers (in FlowCompanion) | Verified | unit, e2e |
| Tutor mode | Verified | unit, int |
| Supervised study sessions, end on time, persist | Verified | unit, e2e |
| Lock any section (News, Games, Marketplace, Creator Studio, AI…) with the PIN; enforced in navigation, Home, search, alerts, AI and the browser bridge | Verified | unit, e2e |
| Screen-capture privacy on macOS/Windows | Not fully verified | Uses Electron `setContentProtection`; not run on those OSes |
| Screen-capture privacy on Linux | Blocked | No documented OS mechanism; reported unavailable |
| Supervised profiles (separate user profiles) | Not implemented | Sessions only |

## Student Learning (Ontario Grades 6–12)

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| Curriculum import from the Ministry site (live documents, Grades 6–12), sanitising, validation, duplicate detection | Verified | unit (curriculum), live `curriculum:verify` on 29 Oct 2026: no differences |
| Offline storage, versioning, revision history, update check and apply, unverified file import | Verified | unit |
| Navigation by grade/subject/course with codes, types and prerequisites; search; official text with source links | Verified | unit, e2e |
| Coverage report that does not overclaim (in app and `docs/CURRICULUM_COVERAGE.md`, generated) | Verified | unit, e2e |
| Courses published only as PDF | Partial | Listed with links; expectations not imported |
| Student profiles, onboarding, profile PIN with lockout, isolation between profiles | Verified | unit, e2e |
| Nine-step lessons, modes, pause/resume across restart, repeat, alternative explanations | Verified | unit, e2e |
| Offline lessons and checked practice | Partial | 35 math packs covering 80 expectations (Grades 6–9); other subjects use Ministry supports or AI |
| Lessons from Ministry teacher supports | Verified | unit |
| AI lessons, questions, feedback and tutor (streaming, consent, name never sent, invalid output rejected) | Verified | unit, int (mock), e2e (mock); not tested with real cloud providers |
| Question types (11), deterministic checking, exact fractions, expression equivalence | Verified | unit (checking, content harness at 300 seeds per level) |
| Hints, immediate feedback, misconception detection, similar questions | Verified | unit, content harness |
| Quiz kinds (practice, pop, diagnostic, formative, unit review, practice test, reflection), optional timer, extra time, answer-key redaction | Verified | unit, e2e (redaction) |
| Adaptive difficulty, mastery statuses, gap detection, spaced review, review reminders | Verified | unit; reminder notification not exercised in e2e |
| Study plans (approval creates calendar events, tasks and links), rescheduling, assignments with step templates | Verified | unit, e2e (approval → calendar) |
| Assessment builder with review, regenerate, export, practice rubric (Growing Success categories) | Verified | unit; UI not covered by e2e |
| Dashboard, progress and activity, student report, parent report with consent and PIN | Verified | unit; parent report UI not covered by e2e |
| Export and delete learning data; profile deletion | Verified | unit, e2e (delete) |
| Accessibility options (text size, readable font, plain language, extra time) | Not fully verified | Implemented; no screen-reader test |
| Pedagogical review by an Ontario teacher | Not implemented | Not done |

## Packaging and release

| Item | Status | Evidence |
| --- | --- | --- |
| Linux AppImage and .deb | Verified | Built; packaged binary and AppImage launched and rendered Home |
| Windows portable zip | Not fully verified | Cross-built, unsigned, no icon resource; never run on Windows |
| Windows NSIS installer | Blocked | Needs Wine or a Windows runner (CI workflow prepared, not run) |
| macOS .app zip | Not fully verified | Cross-built, unsigned, not notarised; never run on macOS |
| macOS DMG | Blocked | Needs macOS (CI workflow prepared, not run) |
| Code signing and notarisation | Blocked | No certificates |
| CI workflow (checks, tests, packaging on 3 OSes) | Not fully verified | Written, never executed |
