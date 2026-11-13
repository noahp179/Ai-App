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

## Classroom server

| Control | Status |
| --- | --- |
| Passwords: scrypt with per-user salt; 5 wrong passwords lock that sign-in name for 5 minutes (not the shared school IP) | Done, tested |
| Sessions: random tokens stored only as SHA-256 hashes, 14-day expiry; desktop keeps the token in the OS-backed secret store, never in the page; browser uses an HttpOnly, SameSite=Strict cookie (Secure with `FC_CLASSROOM_SECURE=1`) | Done, tested |
| CSRF: cookie-authenticated writes must carry the `x-fc-client` header, which a cross-site form cannot set | Done, tested |
| Authorisation: every class, material, assessment and attempt route checks membership and role; non-members get 404; route-by-route isolation test | Done, tested |
| Rate limits per signed-in user (a class shares one address) and per address for sign-in routes | Done, tested (35 students at once under default limits) |
| Uploads: allowed types by content and extension, 25 MB per file and 500 MB per class, structure checks, optional ClamAV that fails closed; files stored AES-256-GCM encrypted; downloads only as attachments through 2-minute signed links | Done, tested; ClamAV path tested against a mock daemon only |
| PDF parsing with pdf.js 6.5 (5.x had GHSA-hq66-cqwq-w95j, script execution from a crafted PDF; found by `npm audit` during this work and upgraded) | Done |
| The school's AI key: encrypted with the master key, never returned to any client (only its last four characters) | Done, tested |
| Browser build: CSP `script-src 'self'`, `frame-ancestors 'none'`, Permissions-Policy denying camera, microphone, geolocation and display capture, `no-referrer` | Done, tested by source scan |
| Prompt injection: student text and draft answers fenced, closing tags neutralised; documents and transcripts declared data; judge quotes verified by code | Done, tested with a scripted AI; real-model behaviour not tested |
| Audit log of every teacher or admin view of a student's chat, mark overrides, AI-use level changes, releases, settings changes and deletions | Done, tested |
| Not done: database file encryption (use disk encryption), SSO, password reset and change, penetration testing, deployment hardening guide beyond "run behind a TLS proxy" | Gap |

## Dependencies

`npm audit --omit=dev` (runtime dependencies): **0 vulnerabilities** (13 Nov 2026, after upgrading pdfjs-dist to 6.5.438 and fast-xml-parser to 5.12.0 for GHSA-hq66-cqwq-w95j and GHSA-474x-hrwr-fgx4). Earlier: (22 Oct 2026; re-checked 29 Oct 2026 with KaTeX 0.19.0, chosen over 0.16.x because of a published advisory).

`npm audit` (all): 8 moderate findings, all in the packaging tool chain (`electron-builder` → `@electron/get` → `global-agent` → `roarr` → `sprintf-js`, GHSA-hp3w-g68c-fv3c, denial of service via format strings). They run only at build time on the developer's machine and are not shipped in the app. Re-check when electron-builder publishes a fix.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository. Please do not file public issues for vulnerabilities.

## Known gaps

- No code signing, so OS reputation checks (SmartScreen, Gatekeeper) will warn.
- Auto-update is not implemented (no update channel to compromise, but also no automatic security updates).
- Parental controls can be removed by someone with administrator access or who can edit the data folder; they are learning aids, not tamper-proof security software.
- The reference marketplace server has no email verification, password reset, or account deletion endpoint yet.
- The classroom server has no password change or reset, no SSO, no database-file encryption, and has not been penetration-tested or run in a real school.
