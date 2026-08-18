# Architecture

## The core rule

Every learning rule lives in `@synapse/core` as a pure function. Grading,
scheduling, XP, streaks, entitlements, and session state are all decided there
and nowhere else.

The consequence is that the entire behaviour of the app is testable under plain
Node in about a second, with no simulator, no component mounting, and no mocking
of native modules. That is why the test suite is worth having: it tests the
things that are actually hard to get right.

The apps are rendering layers. When a screen needs to know something, it calls
core. When a screen needs to change something, it calls a store action that calls
core and persists the result.

```
┌──────────────────────────────────────────────┐
│  apps/mobile (Expo Router)                   │
│  apps/desktop (Electron shell → web build)   │
└───────────────────┬──────────────────────────┘
                    │  reads tokens, renders components
┌───────────────────▼──────────────────────────┐
│  packages/ui — tokens + 12 components        │
└───────────────────┬──────────────────────────┘
                    │  imports types and helpers
┌───────────────────▼──────────────────────────┐
│  packages/core — pure TypeScript, no React   │
│  domain · engine · content · monetization    │
└──────────────────────────────────────────────┘
```

Dependencies point one way only. `packages/ui` never imports from an app.
`packages/core` imports nothing from either.

## State

Two zustand stores in the mobile app, both thin:

- **`useProgress`** — the learner's durable state. Owns persistence
  (`AsyncStorage`, debounced 400ms) and hydration. Every mutation delegates to a
  pure function in `core/store/progress.ts`.
- **`useSession`** — the active lesson. Wraps `SessionRunner` and republishes its
  snapshot.

Persisted state carries a schema version and goes through `migrateProgress()` on
load, which returns fresh state rather than throwing when the blob is unusable.
Losing progress is bad; crashing on launch is worse.

## Content pipeline

Curriculum is TypeScript data, not a CMS. Files in `content/tracks/` use terse
constructors from `content/builders.ts` so a lesson reads like an outline.

`validateCatalog()` runs in the test suite and checks:

- id uniqueness across tracks, lessons, and steps
- every `skillIds` reference resolves to a defined skill
- exercise wellformedness (answer indices in range, blank counts matching the
  template, non-empty explanations)
- track and skill prerequisite graphs are acyclic
- no declared skill goes unpractised by any exercise

Plus a test that grades every exercise's own stated answer and asserts it comes
back correct — which catches the class of authoring error that is otherwise
invisible until a learner hits it.

## Interactive widgets

37 widgets live in `apps/mobile/src/components/interactives/`, split by subject
(`foundations`, `classic`, `deep`, `language`, `applied`, `core`) with a
dispatcher in `index.tsx`.

Content references a widget by name from the `InteractiveWidget` union in
`@synapse/core`; the dispatcher's switch is exhaustive over that union, so
declaring a widget without implementing it is a compile error rather than a
blank screen a learner discovers. The reverse direction is covered by a test:
every declared widget must appear in content at least once, and every track must
contain at least one hands-on step.

`interactives/shared.tsx` holds the primitives — `PlotCanvas` (reports taps in
unit coordinates and hands its measured size to children), `Dot`, `Line`,
`Path`, `Bar`, `Readout`, `SegmentedControl`, `ActionRow`, `Note`, and a seeded
PRNG so generated datasets stay stable across re-renders. A scatter plot that
reshuffles on every state change is unusable: you cannot reason about a change
you made if the data moved too.

## Cross-platform strategy

One React Native codebase. iOS and Android build natively through Expo; macOS
runs the Expo **web** export inside an Electron shell.

This constrains component choices: anything that only works as a native module
breaks the desktop build. That is why the slider is hand-built on `PanResponder`
and the progress ring is drawn with rotated views rather than SVG. The
interactive widgets are the most memorable part of the product, so they need to
work everywhere.

The desktop shell adds what macOS expects — a real menu bar with keyboard
shortcuts, persisted window state, `hiddenInset` traffic lights — and nothing
else. Menu commands reach the renderer through a preload bridge exposing exactly
one method over a fixed channel allowlist.

## Security posture

- **No model provider key ever reaches the client.** The app calls our own
  gateway, which holds the credential and enforces per-user rate limits against
  the learner's entitlement. A key shipped in a mobile binary is a published key.
- **Entitlements are re-validated server-side.** The local copy is a cache for UI
  responsiveness; a tampered local state gets you a nicer-looking button, not
  free content.
- **Electron renderer is sandboxed** — context isolation on, node integration
  off, `devTools` disabled in packaged builds, navigation pinned to an origin
  allowlist with everything else handed to the system browser, and all permission
  requests refused.
- **macOS entitlements request only outbound networking.** No camera, microphone,
  location, or filesystem access, because the app has no use for any of them.
- **Analytics carry no learner-authored text**, no email, and no answer content.
  Enforced by the typed event union rather than by policy.
