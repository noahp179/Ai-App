# Delivery report — FlowCompanion 1.0.0

22 October 2026, updated 29 October 2026 · repository `noahp179/Ai-App`, branch `claude/busy-cerf-vb9w2a`

## 1. What was delivered

A standalone Electron desktop application (TypeScript, React 19, SQLite) that works fully offline and without any account, extension or AI provider. It has these modules:
- **Core workspace:** an AI workspace, a floating companion, notes, productivity tools and a calendar with reminders.
- **Content:** a news reader, five games and a Learning Hub of 72 verified free resources.
- **Prompts:** a prompt library, a marketplace with a creator studio, and a reference marketplace server.
- **Student Learning (added 29 October 2026):** an Ontario Grades 6–12 curriculum engine built from the Ministry's Curriculum and Resources site, student profiles, lessons, checked practice and quizzes, mastery tracking, spaced review, a study planner tied to the calendar, an assessment builder and an optional AI tutor. Offline lessons cover 80 mathematics expectations; see [STUDENT_LEARNING.md](STUDENT_LEARNING.md) and [CURRICULUM_COVERAGE.md](CURRICULUM_COVERAGE.md).
- **Optional extras:** Parental Learning Controls, a browser bridge with a Chromium extension, and central settings, privacy and data tools.

On request, the previous contents of this branch were removed and the app was built from scratch. The repository's default branch (`claude/ai-education-app-t3trrh`) still holds the earlier, unrelated "Synapse" code; nothing was merged into it.

## 2. Feature completion matrix

See [FEATURE_MATRIX.md](FEATURE_MATRIX.md). The core modules are classified **Implemented and verified** on Linux:
- AI workspace, with a real local model
- notes, productivity, calendar and reminders
- news, all five games and the Learning Hub
- prompt library, and the marketplace with its reference server and trials
- browser bridge and extension, and parental controls

Anything that depends on Windows, macOS or real cloud-provider accounts is **Implemented but not fully verified**. Windows/macOS installers, code signing and Linux screen-capture privacy are **Blocked**. Payments, sync, auto-update and external calendar sync are **Not implemented**.

## 3. Project structure

```
src/main      Electron main process (windows, tray, shortcuts, protocol, security, IPC, API)
src/preload   contextBridge
src/core      Business logic and services (no Electron): db/migrations, AI adapters, notes, tasks, calendar,
              scheduler, notifications, feeds, learning, games, prompts, marketplace client, parental, bridge
src/shared    Types, settings schema, protocol schemas, catalogs, pure game/prompt logic
src/renderer  React UI (shell, companion, modules)
server/       Reference marketplace server
extension/    Chromium MV3 extension
tests/        unit, integration, live, e2e
docs/         Documentation (this folder)
.github/      CI workflow
```

About 210 files: about 26,000 lines of source and 4,000 lines of tests.

## 4. Architecture and rationale

Electron was chosen over Tauri for built-in SQLite (`node:sqlite`, no native modules), a single Chromium engine to test, `safeStorage`, content protection and Playwright end-to-end testing. The cost is a larger footprint. Business logic is isolated in `src/core` and tested without Electron. See [ARCHITECTURE.md](ARCHITECTURE.md).

## 5. Tests that were run

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | Pass |
| `npm test` | 273 passed, 0 failed (23 opt-in live tests skipped) — 29 Oct 2026 |
| Student Learning content harness at 300 seeds per level | Pass, all 35 packs, no discarded questions |
| `npm run curriculum:verify` (live Ministry site) | No differences, 29 Oct 2026 |
| `xvfb-run -a npx playwright test` | 24 passed, 0 failed, 1 skipped (live model) — 29 Oct 2026 |
| Live local model (llama.cpp + Qwen2.5-0.5B) | 2/2 passed; also answered through the app UI |
| Live news feeds | 21/21 earlier today; 11/21 in the final run (10 blocked by this environment's network policy) |
| Learning links | 72/72 verified |
| `npm audit --omit=dev` | 0 vulnerabilities |

Measured performance (Linux container): about 0.9 s to an interactive Home screen and 530–580 MB across processes. Search over 5,000 notes has a median of 7 ms. Details are in [TEST_REPORT.md](TEST_REPORT.md).

## 6. Build and packaging results

| Artifact | Size | SHA-256 | State |
| --- | --- | --- | --- |
| `FlowCompanion-1.0.0.AppImage` | 126 MB | `4825b4797f66d6facb4c89ccbffb19e0f585ef9f7671005eb1e7e3effc4966b5` | Built; launched and rendered Home |
| `flowcompanion_1.0.0_amd64.deb` | 100 MB | `bd89bd10728a7188c3ee4eb7b1c6a57878ec53faea56db0408a674b6c4f382a5` | Built; its unpacked binary launched; the `.deb` itself was not installed |
| `FlowCompanion-1.0.0-win.zip` | 154 MB | `7e9f6872cdb5ddd82903c24c9e7d34277c481e31667640415d7a1ec5385de3c9` | Cross-built; unsigned; never run on Windows |
| `FlowCompanion-1.0.0-mac.zip` | 384 MB | `a6ac7b49cd02c034a10fc2017e1f5e62b8381867772d91f5f9b944817e883b53` | Cross-built; unsigned, not notarised; never run on macOS |
| Windows NSIS installer, macOS DMG | — | — | Blocked here (need Wine/macOS); CI workflow prepared, not run |

## 7. Downloadable artifacts

None are published. The packages above exist only in the build environment's `release/` folder, which is not committed. To get them, run `npm run dist:linux` (or the CI workflow on a `v*` tag), which uploads them as workflow artifacts.

## 8. Installation and configuration

See [INSTALL.md](INSTALL.md) (packages, first run, AI providers, local models, marketplace server, extension) and [DEVELOPMENT.md](DEVELOPMENT.md).

## 9. Credentials and external services

None are required. Optional:
- **AI:** API keys for OpenAI, Anthropic or Google, or a local runtime (llama.cpp, Ollama, LM Studio).
- **Marketplace server:** a deployment of `server/` behind TLS.
- **Signing:** code-signing certificates for Windows and an Apple Developer ID for macOS.
- **Payments:** none are integrated, so no payment credentials are needed.

## 10. Privacy and security protections

- **Sandboxing:** a sandboxed, context-isolated renderer with a strict CSP and no network access from the UI.
- **IPC:** a single validated IPC channel that rejects non-app frames.
- **Navigation and permissions:** navigation and permission requests are denied.
- **Secrets:** OS-encrypted storage, with an honest session-only fallback.
- **Hashing:** scrypt for PINs and passwords; hashed tokens.
- **Input handling:** validated imports and a hardened feed parser.
- **Browser bridge:** loopback only, with Host and Origin checks and pairing.
- **Packaging:** Electron fuses in packaged builds.
- **Data handling:** no telemetry; documented data flows; export and delete.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## 11. Supported operating systems and verified integrations

| | Status |
| --- | --- |
| Linux x64 | Built, tested and run |
| Windows 10/11 x64 | Built (zip only), not run |
| macOS x64 | Built (zip only), not run |

Verified integrations:
- a local OpenAI-compatible model (llama.cpp)
- live RSS/Atom feeds
- the reference marketplace server
- the Chromium extension

Not verified: real OpenAI, Anthropic, Google and Ollama services; OS keychains.

## 12. Parental controls by platform

On Linux, the following are verified:
- blocking copies of AI answers
- tutor mode
- supervised sessions
- locking any section (News, Games, Marketplace, AI…) with the PIN
- PIN, recovery and lockout
- the status banner

Screen-capture privacy is **not available on Linux** and is reported that way. On Windows and macOS it is implemented through Electron's `setContentProtection` but not verified. The controls never apply outside FlowCompanion. See [PARENTAL_CONTROLS.md](PARENTAL_CONTROLS.md).

## 13. Known defects, incomplete features and blockers

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). The main ones:
- **Untested platforms:** Windows and macOS are untested and unsigned.
- **AI providers:** cloud providers were tested only against mocks.
- **Not built:** payments, sync, auto-update and calendar import/sync.
- **Student Learning:** offline lessons for 80 of 8,856 specific expectations (math only); 106 PDF-only courses not imported; no review by an Ontario teacher; AI tested with mocks only.
- **Missing tests:** no screen-reader audit; some UI paths have no automated test (other calendar views, the study planner tab, moderator screens, trial reminders, delete everything).

## 14. Recommended next milestone

**"1.1 — Cross-platform release candidate":**
1. Run the CI workflow and smoke-test the Windows NSIS and macOS DMG builds on real machines, fixing what breaks (tray, notifications, shortcuts, keychains, content protection).
2. Set up code signing and notarisation, and add an arm64/universal macOS build.
3. Verify each cloud provider with real test accounts and record results.
4. Run an accessibility audit with NVDA and VoiceOver, and add e2e tests for the remaining untested UI paths.
5. Add an update channel (signed auto-update) before any public distribution.

For Student Learning, the next steps are a review of the existing lessons by an Ontario mathematics teacher, then skill packs for Grade 9–10 science and Grade 10–12 mathematics, each mapped with notes and checked by the content harness, and the French-language curriculum.

Payments should only follow later, after legal review and with a real payment provider.
