# Known limitations, defects and blockers

## Platforms and packaging

- Developed and tested on **Linux only**. Windows and macOS builds are cross-built from Linux, unsigned, and have never been run on those systems. Tray, notifications, global shortcuts, launch-at-login, secure key storage and screen-capture privacy on Windows/macOS are untested.
- The Windows NSIS installer and macOS DMG could not be built here (they need Wine / macOS). The CI workflow that would build them on GitHub's Windows and macOS runners has not been run.
- No code signing or notarisation: Windows SmartScreen and macOS Gatekeeper will warn or block. The Windows zip has no embedded icon or version resource.
- macOS build is x64 only (Rosetta on Apple Silicon); no arm64/universal build yet.
- On Ubuntu 24.04+ the AppImage needs `--no-sandbox` (AppArmor restricts unprivileged user namespaces); the `.deb` installs an AppArmor profile instead.
- No automatic updates.

## AI

- Cloud providers (OpenAI, Anthropic, Google) and Ollama were tested only against mock servers that follow their documented protocols; no real accounts were available. Provider APIs and model names change; adapters may need updates.
- If the OS has no working secure storage (common on minimal Linux), API keys are kept only for the session, so you re-enter them after restarting.
- Tutor mode is an instruction to the model; models do not always follow instructions.
- Image input, tool use and file uploads to providers are not implemented.
- Browser-reported AI task status and visible-state detection are not implemented (the AI task engine uses FlowCompanion's own requests, timers and manual updates).

## Data and sync

- No sync between devices and no FlowCompanion account. Back up with Export or the backups folder.
- The notes list is not paginated: listing 5,000 notes took ~150 ms in testing; much larger libraries will feel slower.
- Calendar has no import (ICS export only) and no external calendar sync.

## News and learning

- Feeds depend on publishers; a feed can change or disappear. In this build environment 10 of the 21 built-in feeds were blocked by the sandbox's network policy during the final run (all 21 parsed earlier the same day).
- Learning links were all verified on 22 October 2026; sites change, so re-run `npm run verify:links` before each release.

## Student Learning

- Offline lessons and code-checked questions exist for **80 of 8,856** specific expectations, all in mathematics, Grades 6–9, and usually for part of what each expectation asks. Every other expectation has the official text, Ministry teacher supports where published, and the optional AI tutor. See [CURRICULUM_COVERAGE.md](CURRICULUM_COVERAGE.md).
- 106 courses are published by the Ministry only as PDFs; they are listed with links, but their expectations are not imported.
- Lessons and explanations have **not been reviewed by an Ontario-certified teacher**. Answer keys are checked by code; pedagogy is not.
- Mastery thresholds, weights and review intervals are design choices, not validated against student outcomes. Statuses are not achievement levels or marks.
- AI lessons, questions and feedback depend on the provider and model chosen and can be wrong; their keys are not verified. They were tested against mock providers only.
- Images, tables and media in Ministry pages are not reproduced; the expectation links to the Ministry page instead.
- Requests the AI tutor makes appear in the app-wide AI task list with the session title (an expectation or topic, never the student's name).
- No teacher or classroom accounts, no sync between devices, French-language curriculum not imported.

## Marketplace

- Payments, receipts, refunds, payouts and subscriptions are not implemented. Paid listings can be tried (server trial) but not bought.
- The reference server lacks email verification, password reset, account deletion, admin user management and a web UI. Editing a published listing hides it until a moderator re-approves it.
- Server analytics count page views per visitor per hour, trials, free acquisitions and reviews only.
- Trial expiry reminders depend on the trial having been started from this device.

## Parental Learning Controls

- Apply only inside FlowCompanion. They do not control other apps or websites, cannot stop photos of the screen, and can be removed by someone with administrator access or access to the data folder.
- Screen-capture privacy is unavailable on Linux and unverified on Windows/macOS; some capture tools may ignore it even where supported.
- No separate supervised user profiles for the whole app; one app profile with optional sessions. (Student Learning has its own per-student profiles.)
- The original PA–PO acceptance-test wording was not provided; the tests were derived from the brief's requirements.

## Browser extension

- Chromium-based browsers only, loaded unpacked (not in a store). Firefox and Safari are not supported.

## Accessibility

- Keyboard navigation, focus rings, ARIA labels, reduced motion, high contrast and text scaling are implemented, but no screen-reader testing or formal accessibility audit has been done.

## Not measured

- Performance on real Windows/macOS hardware, battery impact, memory over long sessions, very large databases (>100 MB), and load on the reference server.
