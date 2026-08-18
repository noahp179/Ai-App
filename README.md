# Synapse

**Learn how AI actually works — from first principles to production systems.**

A complete learning platform for artificial intelligence, machine learning, deep
learning, LLMs, and generative AI. Built for iOS, Android, and macOS from one
TypeScript codebase.

Think Duolingo's pedagogy — short daily sessions, streaks, spaced repetition —
applied to a subject that usually only exists as either a 4-hour YouTube video or
a graduate course.

---

## What's in it

| | |
|---|---|
| **11 tracks** | Foundations → Prompt Engineering → Math → ML → Deep Learning → LLMs → Generative AI → Agents → RL → MLOps → Ethics |
| **50 lessons** | 20 units, ~200 minutes of material, all three difficulty levels |
| **252 exercises** | 9 exercise types, every one with a written explanation |
| **109 skills** | Individually tracked with spaced-repetition scheduling |
| **9 interactive labs** | Tokenizer, attention matrix, gradient descent, and more |

Every track spans intro, intermediate, and expert material. The curriculum is
data (`packages/core/src/content/`), validated on every test run — a typo in a
skill reference fails the build rather than silently breaking review scheduling.

---

## Architecture

```
synapse/
├── packages/
│   ├── core/          Domain logic. No React, no native APIs, runs under plain Node.
│   │   ├── domain/       Types: tracks, lessons, exercises, skills
│   │   ├── engine/       Grading, spaced repetition, XP, streaks, placement, sessions
│   │   ├── content/      The curriculum, as validated data
│   │   ├── monetization/ Plans and entitlement rules
│   │   ├── store/        Pure progress-state transitions
│   │   └── services/     AI tutor client, typed analytics
│   └── ui/            Design system: tokens + 12 shared components
├── apps/
│   ├── mobile/        Expo Router — iOS, Android, and the web build
│   └── desktop/       Electron shell for macOS
└── docs/              Monetization strategy, architecture notes
```

**The rule that shapes everything:** all learning rules live in `@synapse/core`
as pure functions. Grading, scheduling, XP, entitlements, and session state are
testable without mounting a component or booting a simulator — which is why there
are 156 tests that run in under a second.

The apps are rendering layers over that core. `packages/ui` never imports from an
app; apps never reimplement a rule.

---

## Getting started

```bash
npm install
npm test                    # 156 tests, ~1s
npm run build --workspace @synapse/core

npm run mobile              # Expo dev server
npm run ios                 # iOS simulator
npm run android             # Android emulator
npm run web                 # Browser

npm run desktop             # Electron on macOS (dev)
npm run desktop:dist        # Signed .dmg
```

Requires Node 20+. `cp .env.example .env` before running against a real backend.

---

## How the learning engine works

**Spaced repetition** (`engine/scheduler.ts`) — an SM-2 variant tuned so a lapse
drops the interval to one day rather than resetting all state. Mastery is an
exponential moving average, so one bad answer dents a well-known skill without
erasing it. Recall grade factors in response *time*, because hesitation predicts
forgetting better than correctness alone.

**Adaptive placement** (`engine/placement.ts`) — 12 questions on a difficulty
ladder: step up on a correct answer, down on a wrong one. Places by where the
learner spent the test, weighted for domain coverage. Explainable by design; the
result is always presented as a suggestion the learner can override.

**Session rules** (`engine/session.ts`) — `SessionRunner` is a state machine
handling hearts, mistake re-queuing, and attempt records. Not a React thing, so
every rule is unit-testable in isolation.

**Grading** (`engine/grading.ts`) — nine exercise kinds, all graded locally and
synchronously with partial credit where it makes sense. Free-response answers get
a local keyword rubric as a fallback, so the app teaches fully offline and
without a subscription.

---

## Design

Dark-first, because the app is used in the evening on a phone. Tokens live in
`packages/ui/src/theme/tokens.ts` — two palettes, a 4pt spacing grid, six type
sizes. Components read tokens and never hardcode a value.

Specific decisions worth naming:

- **The primary button never moves.** Check and Continue occupy the same
  position, so the thumb never hunts mid-session.
- **Explanations show on correct answers too.** Getting it right is the best
  moment to explain why.
- **Answer state is never colour alone.** Every state has a distinct icon.
- **Diagrams are drawn with views, not shipped as images.** They scale, respond
  to the theme, stay readable at accessibility text sizes, and cost nothing.

---

## Monetization

Free tier: the whole Foundations track plus the first unit of every other track,
forever. Paid tiers, consumables, B2B, and the reasoning behind each — including
what was deliberately *not* built — are in **[docs/MONETIZATION.md](docs/MONETIZATION.md)**.

---

## Testing

```bash
npm test
```

156 tests covering the grading engine, scheduler, XP and streak logic, session
state machine, placement algorithm, entitlements, progress transitions, and
catalog integrity.

The catalog tests are load-bearing: they verify that every exercise's stated
answer actually grades as correct, that every skill reference resolves, that no
prerequisite graph has a cycle, and that no declared skill goes unpractised.
Content is data written by hand, and data written by hand drifts.

---

## Status

Complete and typechecked across all four packages. What a production launch would
still need: real backend services (the tutor gateway, auth, receipt validation),
app icons and splash assets, store listings, and a content review pass by a
second subject-matter expert.

## License

MIT
