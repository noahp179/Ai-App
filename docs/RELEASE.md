# Release checklist and versioning

## Versioning

FlowCompanion follows Semantic Versioning (`MAJOR.MINOR.PATCH`), stored in `package.json` `version`:

- **MAJOR**: incompatible data or settings changes that cannot be migrated automatically, or removal of a feature.
- **MINOR**: new features; new database migrations (always forward-only and automatic, with a backup first).
- **PATCH**: fixes only.

The database schema version (`PRAGMA user_version`, currently 11) is separate from the app version. A newer database opened by an older app is refused with a clear message instead of being modified.

Marketplace listings use their own semantic versions; the marketplace protocol is versioned by URL (`/api/v1`).

## Before a release

1. `npm ci` on a clean checkout.
2. `npm run check` (typecheck, lint, unit + integration tests): must pass.
3. `npm run test:e2e` on Linux (and on Windows/macOS where possible): must pass.
4. Live checks: `FC_LIVE_FEEDS=1 npx vitest run tests/live/feeds.test.ts` and `npm run verify:links` (commit the updated `link-check.json`). Remove or replace any source that no longer works.
5. `npm audit --omit=dev`: no known vulnerabilities in runtime dependencies (or documented exceptions).
6. Update `docs/TEST_REPORT.md`, `docs/FEATURE_MATRIX.md` and `docs/KNOWN_LIMITATIONS.md` with the actual results.
7. Bump `version` in `package.json`; tag `vX.Y.Z`.
8. CI (`.github/workflows/ci.yml`) builds packages on Linux, Windows and macOS for tags. Download the artifacts and smoke-test each one: install, launch, create a note, restart, check it is still there, check Settings → About shows the right version.
9. Sign and notarise (below), then publish checksums (`sha256sum`) with the release notes.

## Signing (not set up yet)

- **Windows**: provide a code-signing certificate to electron-builder (`CSC_LINK`, `CSC_KEY_PASSWORD`) and remove `CSC_IDENTITY_AUTO_DISCOVERY=false` from CI.
- **macOS**: Developer ID Application certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`) and notarisation credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`); `hardenedRuntime` is already enabled. Add an arm64 or universal target.
- **Linux**: optionally sign checksums with GPG.

## After a release

- Watch for crash reports from users (there is no automatic crash reporting) and feed outages.
- Keep `npm audit` clean; upgrade Electron for security fixes promptly (each Electron major is supported for about 6 months).
