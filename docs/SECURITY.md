# Security checklist

Each item says how it is enforced and where it is tested. "Not verified" means the code exists but no automated or manual check ran in this environment.

## Electron hardening

| Control | Status | Where |
| --- | --- | --- |
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true` on every window | Done | `src/main/windows.ts` |
| Global renderer sandbox (`app.enableSandbox()`) | Done; skipped only when started with `--no-sandbox` (needed when running as root in containers) | `src/main/index.ts` |
| UI served from a custom `app://flowcompanion` protocol with path-traversal checks | Done, unit-tested | `src/main/protocol.ts` |
| Strict CSP: `script-src 'self'`, `connect-src 'self'`, no frames/objects/forms | Done | `src/main/protocol.ts` |
| Navigation and new windows denied; external links only `http(s)`/`mailto` via the OS browser; `<webview>` blocked | Done | `src/main/security.ts` |
| All permission requests (camera, mic, geolocation, notifications, devices) denied | Done | `src/main/security.ts` |
| Single IPC channel; only app frames may call; only registered methods; arguments validated | Done | `src/main/ipc.ts`, `src/main/api.ts`, services (zod) |
| Clipboard writes go through the main process (so policy such as parental copy limits applies) | Done, e2e-tested | `app.copyText` |
| Packaged-app Electron fuses: RunAsNode off, NODE_OPTIONS off, `--inspect` off, cookie encryption on, asar integrity validation on, only load app from asar | Configured in `package.json` → `build.electronFuses`; applied in the Linux build here (electron-builder log) | Not verified on Windows/macOS |
| Code signing / notarisation | **Not done** — no certificates available | See [RELEASE.md](RELEASE.md) |

## Data and secrets

| Control | Status |
| --- | --- |
| API keys and tokens encrypted with OS secure storage; session-only fallback when the OS has no real encryption (reported in the UI) | Done; fallback path verified on this Linux machine (no keyring), OS keyring path not verified |
| Secrets never returned to the renderer, never exported, never logged | Done; reviewed (`grep` of log statements) |
| Parental PIN and recovery code: scrypt (N=16384) with salt; constant-time compare; escalating lockout | Done, unit-tested (PA–PO) |
| Marketplace passwords (server): scrypt; sessions as random 32-byte tokens stored as SHA-256 | Done, integration-tested |
| Bridge tokens: random 32-byte, stored as SHA-256, never shown again | Done, integration-tested |
| Student Learning profile PINs: scrypt hashes; 5 wrong tries lock the profile for 5 minutes; a parent can remove a PIN only with the parental PIN | Done, unit-tested |
| Student Learning answer keys and worked solutions stay in the main process until a question is answered | Done, unit- and e2e-tested |
| Ministry curriculum HTML reduced to an allow-list (p, lists, em/strong, sup/sub, br, span.term) when imported, and rendered in the UI through a second DOM allow-list; KaTeX runs with `trust: false` | Done, unit-tested |
| AI output for lessons and questions is parsed as JSON and validated with schemas; invalid output is rejected, never shown | Done, unit- and e2e-tested |
| SQL: parameterised statements only; FTS queries built from quoted tokens | Done |
| Imports (notes, prompts, listing files, backups) validated with schemas; size limits | Done, tested |
| Feed parsing: entity declarations rejected, 5 MB cap, HTML stripped to text, links limited to http(s) | Done, tested with hostile inputs |
| Markdown rendering: no raw HTML; links open externally | Done |
| No keystroke logging, screen capture or background monitoring code | Done; enforced by test PG (scans sources for capture/hook APIs) |

## Network services

| Control | Status |
| --- | --- |
| Browser bridge off by default; binds `127.0.0.1` only | Done |
| Bridge rejects web-page origins and unexpected `Host` headers (DNS rebinding) | Done; integration-tested and verified from a real web page in Chromium |
| Bridge pairing: single-use code, 5-minute expiry, 5 attempts | Done, tested |
| Bridge/server body size limits, JSON-only, rate limits | Done, tested |
| Marketplace client: https only (http allowed for localhost), no redirects, response schema validation, timeouts | Done, tested |
| Reference server: zod validation, security headers, no CORS, request timeouts; designed to run behind a TLS proxy | Done, tested; not load- or penetration-tested |

## Dependencies

`npm audit --omit=dev` (runtime dependencies): **0 vulnerabilities** (22 Oct 2026; re-checked 29 Oct 2026 with KaTeX 0.19.0, chosen over 0.16.x because of a published advisory).

`npm audit` (all): 8 moderate findings, all in the packaging tool chain (`electron-builder` → `@electron/get` → `global-agent` → `roarr` → `sprintf-js`, GHSA-hp3w-g68c-fv3c, denial of service via format strings). They run only at build time on the developer's machine and are not shipped in the app. Re-check when electron-builder publishes a fix.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository. Please do not file public issues for vulnerabilities.

## Known gaps

- No code signing, so OS reputation checks (SmartScreen, Gatekeeper) will warn.
- Auto-update is not implemented (no update channel to compromise, but also no automatic security updates).
- Parental controls can be removed by someone with administrator access or who can edit the data folder; they are learning aids, not tamper-proof security software.
- The reference marketplace server has no email verification, password reset, or account deletion endpoint yet.
