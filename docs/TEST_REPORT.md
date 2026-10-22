# Test report

**Date:** 22 October 2026 · **Commit:** the commit that adds this file (branch `claude/busy-cerf-vb9w2a`) · **Environment:** Linux x64 container (kernel 6.18), Node 22.22 for Vitest, Electron 44.9.3 (Node 24.22, Chromium) for the app, Xvfb display, running as root (`--no-sandbox`).

Only results that were actually produced are listed. Nothing here was run on Windows or macOS.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| Type checking (Node side + renderer) | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass (0 problems) |
| Unit + integration | `npm test` | **205 passed**, 0 failed, 23 skipped (the live tests below, which skip themselves without their environment variables) |
| End-to-end (real Electron app, real extension in Chromium) | `xvfb-run -a npx playwright test` with `FC_LIVE_OPENAI_COMPAT_URL` set | **21 passed**, 0 failed |
| Live: real local model | `FC_LIVE_OPENAI_COMPAT_URL=http://127.0.0.1:8080/v1 npx vitest run tests/live/local-model.test.ts` | **2 passed** (llama.cpp `llama-server`, Qwen2.5-0.5B-Instruct Q4_K_M) |
| Live: built-in news feeds | `FC_LIVE_FEEDS=1 npx vitest run tests/live/feeds.test.ts` | **11 passed, 10 failed** — every failure is `403 Blocked by egress policy` from this environment's outbound proxy (feeds.bbci.co.uk, arstechnica.com, theverge.com, espn.com), not from the publishers. Earlier the same day all 21 passed. The packaged app (Electron's network stack) loaded BBC, Hacker News and NASA feeds at 06:43 (see `docs/images/home.png`). |
| Learning Hub links | `node scripts/verify-links.mjs --dry` | **72/72 verified** (HTTP 2xx and expected page text) |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities in runtime dependencies; 8 moderate in the build tool chain (see SECURITY.md) |
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
| tests/unit/parental.test.ts | 15 | Acceptance tests PA–PO |
| tests/unit/protocol.test.ts | 3 | `app://` path-traversal refusal, CSP |
| tests/integration/ai.test.ts | 33 | OpenAI, OpenAI-compatible, Anthropic (official SDK), Gemini and Ollama adapters against mock servers: no fabricated replies without a provider, key storage (encrypted or session-only), streaming, non-streaming, cancel, idle timeout, retry on another model, network, auth, rate-limit, missing-model and refusal errors, Claude refusal fallback and content-block replay, conversation management, retention, tutor prompt |
| tests/integration/marketplace-server.test.ts | 11 | Accounts and scrypt, moderation flow, preview rule, verified reviews, server-enforced 7-day trial including expiry, 501 purchases, reports, malformed requests, demo seed, rate limiting |
| tests/integration/marketplace-client.test.ts | 8 | Desktop marketplace offline and against the real reference server end to end |
| tests/integration/bridge.test.ts | 6 | Loopback only, origin and DNS-rebinding rejection, pairing expiry/attempt limits, capture and ask, session blocking, port conflicts |

## End-to-end tests (Playwright, real app)

| Spec | Test |
| --- | --- |
| ai.spec.ts | Honest setup screen, then chat through a (mock) provider, save the answer as a note and as a task, search after restart; provider errors with guidance and retry on another model; **live: a real local model answers through the UI** |
| core.spec.ts | Settings persist and apply; notes create/autosave/search/restart/trash/restore; unsaved edits recovered after the app is killed (SIGKILL); Markdown export; tasks and quick capture; calendar event survives restart; reminders delivered once across restarts; floating companion opens without stealing focus, collapses, remembers position |
| discover.spec.ts | News: add a local feed, search, save; games: trivia round score, sudoku progress survives restart; word guess, memory and reaction time played with keyboard and mouse |
| learning.spec.ts | Browse, progress, notes autosave, study session scheduled into the calendar, global search, restart; paths and goals change suggestions |
| marketplace.spec.ts | Prompt versions/restore/variables/copy; bundled listing saved to library; reference server: sign-up, trial disclosure gate, server trial, purchase refused, publish for review |
| parental.spec.ts | PA–PO in the app: off by default, setup with recovery code, banner, AI copy blocked, wrong PIN, session locks sections, survives restart, end early, turn off |
| browser.spec.ts | Bridge off by default, turned on from Settings, pairing code, page saved to the reading queue |
| extension.spec.ts | Real extension loaded in Chromium: popup pairing (wrong then right code), context-menu actions save page/selection, ask AI, non-web pages refused, a normal web page cannot use the bridge |

## Performance (measured, this environment only)

4 vCPU, 16 GB RAM, Linux container, software rendering under Xvfb. Numbers on real desktops will differ.

| Measurement | Result |
| --- | --- |
| Launch to interactive Home screen (built app, Playwright timing) | 949 ms on first start (migrations, seeding), 873–911 ms on later starts |
| Memory after start-up (sum of `workingSetSize` over all Electron processes) | 532–576 MB |
| Insert 5,000 notes of ~300 words, including full-text index triggers | 1.1 s |
| Global full-text search over those notes (25 queries) | median 7.3 ms, max 11.5 ms |
| List all 5,000 notes with excerpts (not paginated) | 152 ms |

Background activity: one timer that sleeps until the next due job (max 1 hour); feeds refresh hourly by default with conditional requests (ETag/Last-Modified); modules load lazily.

## Defects found by tests and fixed during this work

- The parental recovery code dialog disappeared as soon as setup finished (found by the e2e test).
- The extension popup overwrote the "Connected" status after pairing (found by the extension e2e test).
- Same-feed republished articles (BBC re-issues items with new GUIDs) showed twice (found by smoke-testing the packaged app).
- The marketplace reviews/reports tables could not record server listings (foreign key), fixed with migration v11.
- The preview check rejected valid descriptions of short prompts; replaced with a word-sequence overlap check.
- Oversized request bodies reset the connection instead of returning 413 (server and bridge).

## Not executed

- Anything on Windows or macOS: installers, tray, notifications, global shortcuts, launch at login, content protection, OS keychain storage.
- Cloud AI providers with real accounts (OpenAI, Anthropic, Google): only mock servers; no API keys were available.
- The Windows NSIS installer and macOS DMG builds (need Wine / macOS). The GitHub Actions workflow that builds them has not been run.
- Screen-reader testing, manual accessibility audit, performance/load tests, penetration testing.
- The tray icon and OS notifications on Linux (no tray or notification daemon under Xvfb); notifications were verified through the app's inbox and notification log.
