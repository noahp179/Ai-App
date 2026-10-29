# Implementation checklist

Phases from the brief, with what was delivered. Status per feature is in [FEATURE_MATRIX.md](FEATURE_MATRIX.md).

- [x] **Phase 1 — Foundation**: wiped the `Ai-App` repository branch; Electron + React + TypeScript scaffold; build scripts; SQLite with migrations, backups and corruption recovery; validated settings.
- [x] **Phase 2 — Desktop shell**: main workspace, navigation, command palette, floating companion (launcher/panel/full workspace), tray, global shortcuts, themes, modes, launch at login.
- [x] **Phase 3 — AI workspace**: provider adapters (OpenAI, OpenAI-compatible, Anthropic, Gemini, Ollama), streaming, cancel, retry, errors, conversations, export, secure key storage, AI task-status engine; verified with a real local model.
- [x] **Phase 4 — Notes and productivity**: notes with autosave and recovery, search, links; tasks, capture, focus timer, time tracker, bookmarks, reading queue, calculator, unit converter, study planner.
- [x] **Phase 5 — Calendar and reminders**: views, recurrence, time zones/DST, reminders that survive restarts, quiet hours, snooze, ICS export.
- [x] **Phase 6 — News and games**: 21 publisher feeds plus custom, dedupe, alerts; five games.
- [x] **Phase 7 — Learning Hub**: 72 verified free resources, nine paths, progress, notes, scheduling, link verification script.
- [x] **Phase 8 — Prompt library**: variables, versions, provider labels, import/export, insert into AI.
- [x] **Phase 9 — Marketplace and creators**: bundled starter set, listing files, creator studio, reference server with moderation, verified reviews, server-enforced 7-day trials; no payments.
- [x] **Phase 10 — Browser integration**: loopback bridge with pairing; Chromium MV3 extension verified in Chromium.
- [x] **Phase 11 — Parental Learning Controls**: off by default, PIN/recovery, copy restriction, tutor mode, supervised sessions, best-effort screen-capture privacy, PA–PO tests.
- [x] **Phase 12 — Hardening and tests**: security review, protocol tests, settings audit (every setting has an effect), performance measurements, packaging config with Electron fuses, CI workflow.
- [x] **Phase 13 — Packaging and documentation**: Linux AppImage/deb built and smoke-tested; Windows/macOS zips cross-built (unsigned, untested); full documentation and delivery report.

## Ontario Grades 6–12 AI tutor and curriculum engine

- [x] **Phase 1 — Curriculum foundation**: importer for the Ministry's Curriculum and Resources site, verified bundle (297 courses, 2,297 overall and 8,856 specific expectations), separate curriculum database, navigation and search, verification states, update check, revision history, generated coverage report.
- [x] **Phase 2 — Profiles and lessons**: student profiles and onboarding, PINs, nine-step teaching cycle, lesson modes, pause/resume, alternative explanations, lessons from authored packs, Ministry supports or AI.
- [x] **Phase 3 — Quizzes and checking**: 11 question types, deterministic answer checking with exact arithmetic, visible hints, immediate feedback, misconceptions, quiz kinds with stated rules, optional timer, adaptive difficulty.
- [x] **Phase 4 — Mastery**: weighted evidence model, statuses with explanations, gaps, spaced review and reminders.
- [x] **Phase 5 — Planning and assessment**: study plans that go into the calendar only after approval, assignments, assessment builder with review and practice rubrics, exam preparation steps.
- [~] **Phase 6–7 — Subjects, tutor, dashboard, safety**: subject profiles for prompts and age guidance, AI tutor with consent and privacy rules, dashboard, parent report with consent, accessibility options. Offline lessons exist for mathematics only (35 packs, 80 expectations).
- [x] **Phase 8 — Tests and documentation**: unit tests for the curriculum, checking, mastery and services; content harness for every pack; two end-to-end acceptance tests (offline and mock AI); [STUDENT_LEARNING.md](STUDENT_LEARNING.md), [CURRICULUM_COVERAGE.md](CURRICULUM_COVERAGE.md).

Open items: see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) and the "Recommended next milestone" in [DELIVERY_REPORT.md](DELIVERY_REPORT.md).
