# Architecture

## Platform choice: Electron vs Tauri

Both were evaluated against what FlowCompanion actually needs.

| Need | Electron (chosen) | Tauri |
| --- | --- | --- |
| Embedded SQLite with FTS5, no native modules to compile | `node:sqlite` ships inside Electron's Node 24 (SQLite 3.53, FTS5) | Rust `rusqlite` — fine, but all services would be written in Rust or run as a Node sidecar |
| One rendering engine on every OS | Chromium everywhere | WebView2 / WKWebView / WebKitGTK — three engines to test |
| OS secure storage | `safeStorage` (Keychain, DPAPI, libsecret/kwallet) | Plugins (stronghold/keyring) |
| Local HTTP for the browser bridge and marketplace client | Node `http` / `fetch` | Rust (axum/reqwest) |
| Window features: always-on-top panel, content protection, tray, global shortcuts | All built in | Mostly available; content protection less uniform |
| End-to-end testing of the real app | Playwright drives Electron directly | WebDriver, platform-dependent |
| Packaging for Windows, macOS, Linux | electron-builder | tauri-bundler |
| Footprint | ~100 MB+ installers, higher memory | Much smaller |

Electron was selected because it lets one TypeScript codebase hold the services, the UI and the tests, with SQLite and secure storage built in and a single rendering engine to verify. The cost is size and memory, accepted for this product. TypeScript and React are used throughout.

## Processes and layers

```
┌──────────────────────── Electron main process (Node) ────────────────────────┐
│ src/main      app lifecycle, windows, tray, shortcuts, protocol, security,   │
│               IPC registry (single fc:invoke channel), file dialogs, OS glue │
│ src/core      business logic, no Electron imports — unit-tested directly:    │
│               db + migrations, notes, tasks, calendar, reminders, scheduler, │
│               notifications, AI service + adapters, feeds, learning, games,  │
│               prompts, marketplace client, parental controls, bridge, data   │
└──────────────▲──────────────────────────────────────────────────────▲────────┘
               │ contextBridge (preload, sandboxed)                    │ 127.0.0.1 only
┌──────────────┴──────────────┐                     ┌──────────────────┴────────┐
│ Renderer (React 19, Vite)   │                     │ Browser extension (MV3)   │
│ src/renderer: shell, modules│                     │ extension/                │
│ app://flowcompanion, CSP    │                     └───────────────────────────┘
└─────────────────────────────┘
        optional ↕ HTTPS                              optional ↕ HTTPS
┌─────────────────────────────┐                     ┌───────────────────────────┐
│ AI providers (your keys)    │                     │ Marketplace server        │
│ RSS/Atom feeds              │                     │ server/ (reference impl.) │
└─────────────────────────────┘                     └───────────────────────────┘
```

- **Renderer** has no Node access and no network access: CSP `connect-src 'self'`. Every request goes through the main process.
- **IPC**: one channel, `fc:invoke`, with a method registry built from `src/main/api.ts` (`namespace.method`). Sender frames are validated; arguments are validated in the API layer and again in services (zod schemas).
- **Events** flow main → renderer as `fc:event` (`data.changed`, `ai.stream`, `notification`, …). The renderer's small query cache (`lib/query.ts`) invalidates by key prefix.
- **`src/shared`** holds types, settings schema, pure logic (games, prompt variables, protocol schemas, learning catalog) used by both sides.

## Data

- SQLite file in the user data folder, WAL mode, foreign keys on. Migrations v1–v12 in `src/core/db/migrations.ts`, each in its own transaction; a backup is taken before migrating, and a corrupted database is quarantined and restored from the newest good backup.
- Full-text search: one FTS5 table (`search_index`) maintained by triggers for notes, tasks, prompts, conversations, events, bookmarks and saved articles. Learning resources are searched in memory and merged into global search.
- Settings: one validated document (zod) in the key-value table; invalid fields are repaired on load and reported.
- Secrets (API keys, marketplace token): encrypted with Electron `safeStorage` when the OS provides real encryption; otherwise kept in memory for the session only, and the UI says so.

## Student Learning

- **Curriculum engine** (`src/core/curriculum`): `dcp.ts` reads the Ministry's public content API (only live curriculum documents, Grades 6–12) into a validated bundle (`src/shared/curriculum/types.ts`); `richtext.ts` reduces Ministry HTML to an allow-list; `bundle.ts` hashes, diffs and (de)serialises bundles; `service.ts` keeps the curriculum in its **own database, `curriculum.db`** (public reference data, no personal data, not in backups), with FTS search, revision history, verification states, update checks and coverage. The bundle ships in `resources/curriculum/` and is loaded on first start.
- **Learning services** (`src/core/study`): `students.ts` (profiles, PINs), `lessons.ts` (nine-step lessons from authored packs, Ministry supports or AI), `quizzes.ts` (quizzes, redaction of answer keys, adaptive regeneration), `mastery.ts` (pure functions: weighted evidence, statuses, adaptive difficulty, gaps, spaced review), `progress.ts` (evidence store and recommendations), `planner.ts` (plans → calendar events, tasks and links after approval; assignments), `assessments.ts`, `ai.ts` (prompts, JSON validation with one retry, tutor streaming, cache) and `service.ts` (the facade the IPC layer calls; every call acts on the open profile only).
- **Content** (`src/core/study/content`): 35 math skill packs built with `kit.ts`; `registry.ts` generates a question and accepts it only if the pack's independent `selfCheck` agrees with its key. Answers are checked by `src/shared/study/checking.ts` with exact rational arithmetic (`rational.ts`) and an expression parser (`expr.ts`).
- Student records live in the main database (`students`, `study_*`, migration v12), outside the global search index and the app-wide export.

## Scheduling and notifications

A single wake-on-demand timer (`core/scheduler.ts`) asks each source for its next due time — reminders, feed refresh, focus timer, AI timers, study-session end, trial reminders — and sleeps until the earliest (at most one hour; it also wakes on system resume). Notifications go through `NotificationCenter`, which records a dedupe key per logical notification so nothing is delivered twice, honours quiet hours, and marks reminders that fell due while the app was closed as "missed".

## AI service

`core/ai/service.ts` runs requests with provider adapters (`adapters/openai.ts`, `anthropic.ts` using the official `@anthropic-ai/sdk`, `gemini.ts`, `ollama.ts`). Adapters report capabilities, stream through an SSE parser, use idle timeouts, and normalise errors (auth, rate limit, model not found, network, refused, …). The AI task-status engine (`core/aitasks.ts`) tracks requests as idle/running/waiting/completed/failed/canceled/unknown and separates confirmed states from estimates and manual timers — it never claims external work finished because time passed.

## Marketplace

- Desktop side (`core/marketplace/service.ts`): bundled starter listings, imported listing files, your own drafts, local review/report records, and a validated HTTP client (`remote.ts`) for an optional server.
- Server side (`server/`): node:http + SQLite, accounts (scrypt), hashed bearer tokens, moderation queue, verified reviews, abuse reports, analytics from server-side events, server-authoritative 7-day trials. Purchase requests return 501: no payment provider is integrated.
- The wire format is defined once in `src/shared/marketplace/protocol.ts` and validated on both ends.

## Parental controls and browser bridge

- `core/parental.ts`: PIN/recovery (scrypt), lockouts, config, sessions; exposes enforcement hooks used by the main process (copy blocking, tutor prompt, module allow-list, content protection).
- `core/bridge.ts`: loopback HTTP server for the extension; Host and Origin checks, pairing, hashed tokens, size/rate limits.

## Testing layers

Unit and integration tests (Vitest) exercise `src/core`, `src/shared` and `server/` without Electron. End-to-end tests (Playwright) launch the built Electron app with an isolated data folder, and load the real extension into Chromium. Live tests (opt-in) hit real feeds and a real local model. See [TEST_REPORT.md](TEST_REPORT.md).
