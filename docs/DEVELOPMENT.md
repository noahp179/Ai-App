# Developer setup

## Requirements

- Node.js 22.13+ (24 recommended; Electron 44 bundles Node 24). `node:sqlite` is used directly, so no native modules are compiled.
- npm 10+ (`npm ci` works with npm 10; to *add* dependencies use npm 11 — `npx -y npm@11 install …` — because of an npm 10 peer-resolution bug with Vitest 4).
- For end-to-end tests on Linux: a display or `xvfb-run`, and the usual Chromium libraries.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install exact dependencies |
| `npm start` | Build everything and launch Electron |
| `npm run dev` | Watch mode: Vite dev server for the UI + esbuild for main/preload, restarts Electron on change |
| `npm run build` | Production build into `dist/` (main, preload with esbuild; renderer with Vite) |
| `npm run typecheck` | `tsc` for Node-side and renderer projects |
| `npm run lint` | ESLint (TypeScript, React hooks, extension) |
| `npm test` | Vitest unit + integration tests (live tests skip themselves) |
| `npm run test:e2e` | Build, then Playwright end-to-end tests against the real Electron app |
| `npm run check` | typecheck + lint + test |
| `npm run server` | Build and run the reference marketplace server |
| `npm run verify:links` | Re-check every Learning Hub link and update `src/shared/learning/link-check.json` |
| `npm run dist:linux` / `dist:win` / `dist:mac` | Package with electron-builder into `release/` |

Running Electron as root (containers): add `--no-sandbox`. The e2e launcher does this automatically when the uid is 0.

### Live tests (opt-in, use the network or a real model)

```bash
FC_LIVE_FEEDS=1 npx vitest run tests/live/feeds.test.ts
FC_LIVE_OPENAI_COMPAT_URL=http://127.0.0.1:8080/v1 npx vitest run tests/live/local-model.test.ts
FC_LIVE_OPENAI_COMPAT_URL=http://127.0.0.1:8080/v1 xvfb-run -a npx playwright test tests/e2e/ai.spec.ts
```

The extension e2e test needs a Chromium build that still accepts `--load-extension` (Playwright's Chromium, or set `PW_CHROMIUM=/path/to/chromium`).

## Project layout

```
src/
  main/        Electron main process: lifecycle, windows, tray, shortcuts, protocol, security, IPC, API surface
  preload/     contextBridge: exposes window.fc.invoke / onEvent only
  core/        Business logic without Electron (testable in Node): db, migrations, services, AI adapters, feeds,
               calendar, scheduler, notifications, learning, prompts, marketplace client, parental, bridge
  shared/      Types, settings schema, API types, pure logic (games, prompt variables, protocol, catalogs)
  renderer/    React UI: shell, companion, components, lib (api, query cache, router, settings), modules/*
server/        Reference marketplace server (node:http + SQLite)
extension/     Manifest V3 browser extension (plain JS, no build step)
scripts/       build, dev, icon rendering, link verification
tests/
  unit/        Vitest unit tests (core + shared)
  integration/ AI adapters against mock providers, marketplace server and client, browser bridge
  live/        Real network / real model (opt-in)
  e2e/         Playwright: Electron app, extension in Chromium
resources/     Icons (SVG sources and rendered PNGs)
docs/          This documentation
```

## Conventions

- Business logic lives in `src/core` and never imports Electron; the main process wires services together in `src/main/context.ts` and exposes them in `src/main/api.ts`.
- Every API method is reachable as `namespace.method` over one IPC channel; add new methods to `src/shared/api.ts` (types) and `src/main/api.ts` (implementation).
- Database changes are new migrations appended to `src/core/db/migrations.ts` — never edit a shipped migration.
- User-facing errors are thrown as `UserError` with a plain-language message; anything else is logged and shown as a generic failure.
- UI copy is plain, specific and honest: never claim something happened that did not (sent, saved, verified, charged).

## Adding an AI provider

Implement `ProviderAdapter` (`src/core/ai/types.ts`): `capabilities`, `suggestedModels`, `setupHelp`, `listModels` and `chat` (streaming deltas through `onDelta`), mapping provider errors to `AiError` codes. Register it in `src/core/ai/registry.ts`, add a mock to `tests/helpers/mockProviders.ts` and integration tests next to the existing ones.

## Updating the learning catalog

Edit `src/shared/learning/catalog.json` (each resource needs a `check` string that appears on its page), then `npm run verify:links`. Do not add ratings or time estimates. The unit test fails if any bundled link did not pass the last check.
