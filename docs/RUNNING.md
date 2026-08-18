# Running Synapse

Four ways to see the app, from fastest to most involved. **Start with the
browser** — it takes two commands and gives you accurate phone, iPad, and Mac
window sizes without installing Xcode or Android Studio.

---

## 0. One-time setup

You need **Node 20 or newer**. Check with `node --version`.

```bash
git clone https://github.com/noahp179/Ai-App.git
cd Ai-App
git checkout claude/ai-education-app-t3trrh
npm install
```

Then open the folder in VS Code:

```bash
code .
```

VS Code will offer to install the recommended extensions (Expo Tools, ESLint,
Prettier). Say yes — they are listed in `.vscode/extensions.json`.

**Sanity check** that everything is wired up:

```bash
npm test
```

You should see `164 passed`. If that works, the app will run.

---

## 1. Browser — fastest, and how to see phone / iPad / Mac sizes

```bash
npm run web
```

Expo starts a dev server and opens `http://localhost:8081`. Edit any file and
the browser reloads instantly.

### Seeing it as a phone or iPad

The app is responsive, so the browser's device emulator gives you a genuinely
accurate preview.

1. Open Chrome DevTools — <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>I</kbd> on Mac,
   <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> on Windows/Linux.
2. Click the **device toolbar** icon (the phone/tablet symbol, top-left of
   DevTools) or press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>.
3. Pick a device from the dropdown at the top:

| Pick this | To see |
|---|---|
| **iPhone 14 Pro** | The phone layout — tab bar, one-column lessons |
| **iPad Pro** | Tablet layout — content centred, wider reading measure |
| **Responsive** → drag to ~1280×860 | Roughly what the Mac app window looks like |

Close the device toolbar and maximise the window for the desktop layout. The
app caps content at a readable width rather than stretching, which is what the
macOS build does too.

### Doing it inside VS Code

Install the **Live Preview** extension and run *Simple Browser: Show* from the
command palette (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>), then paste
`http://localhost:8081`. You get the app in a VS Code tab beside your code.
For device emulation you still want a real Chrome window.

---

## 2. Your actual phone — no Xcode needed

This is the best way to feel the app properly: real touch, real haptics.

1. Install **Expo Go** from the App Store or Play Store.
2. Run:

```bash
npm run mobile
```

3. A QR code appears in the terminal.
   - **iPhone** — open the Camera app, point at the QR code, tap the banner.
   - **Android** — open Expo Go and scan from inside the app.

Your phone and computer must be on the same Wi-Fi. If the connection fails
(common on corporate or guest networks), press `s` in the terminal to switch to
tunnel mode, which routes over the internet instead.

Shake the phone to open the developer menu. Edits to code appear on the phone
within a second or two.

---

## 3. Simulators and emulators

### iOS Simulator — Mac only

Requires **Xcode** from the Mac App Store (large download, ~7 GB). Once
installed, open it once and accept the licence, then:

```bash
npm run mobile     # start the dev server
# press `i` in the terminal
```

That launches the iOS Simulator running the app inside Expo Go. In the
Simulator, **File → Open Simulator** lets you switch between iPhone and iPad
devices.

`npm run ios` does something different and heavier: it generates a native
Xcode project and compiles a standalone build. You only need that when adding a
native module Expo Go does not bundle. For looking at the app, press `i`.

### Android Emulator — any OS

Requires **Android Studio**. Create a virtual device in its Device Manager and
start it, then:

```bash
npm run mobile
# press `a` in the terminal
```

---

## 4. The Mac desktop app

The macOS app is an Electron shell around the same code, so it gets a real menu
bar, keyboard shortcuts, and remembered window size.

**Development** — needs two terminals:

```bash
# Terminal 1
npm run web        # leave running; the shell loads from this dev server

# Terminal 2
npm run desktop
```

An app window opens with the traffic lights inset over the content. Menu
shortcuts work: <kbd>Cmd</kbd>+<kbd>L</kbd> for the catalog,
<kbd>Cmd</kbd>+<kbd>K</kbd> for the Lab, <kbd>Cmd</kbd>+<kbd>R</kbd> to start a
review session.

**Building a real `.dmg`** (Mac only):

```bash
npm run desktop:dist
```

The installer lands in `apps/desktop/release/`. It is unsigned, so the first
launch needs right-click → Open. Shipping it to other people requires an Apple
Developer account and notarisation.

---

## Running it from VS Code's UI

The repo ships tasks so you can avoid the terminal entirely.

Press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → **Tasks: Run Task**:

| Task | What it does |
|---|---|
| **Web (browser)** | Starts the dev server for browser preview |
| **Mobile (QR / simulator)** | Starts Expo with the QR code |
| **Desktop (macOS)** | Builds and launches the Electron shell |
| **Test** | Runs the 164 core tests |
| **Test (watch)** | Re-runs tests as you edit |
| **Typecheck all** | Checks all four packages |

**Web (browser)** is the default build task, so
<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> starts it directly.

---

## What you will see first

A first run drops you into onboarding: name, why you are here, your starting
level, and a daily time commitment. It takes about 20 seconds. Then:

- **Today** — your streak, daily goal, and the single next lesson to do
- **Learn** — all 14 tracks, filterable by level
- **Practice** — spaced review, once you have finished a lesson or two
- **Lab** — all 37 interactive widgets, browsable without a lesson
- **Profile** — mastery by domain, achievements, and settings

**Go to Lab first if you just want to see the interesting parts.** It is the
only screen with no prerequisites — try *Train a network* (set hidden units to
0 and train on XOR to watch it fail), *k-means clustering*, or *Q-learning*.

To start over from scratch: **Profile → Reset all progress**.

---

## Troubleshooting

**`npm install` fails.** Check `node --version` is 20+. If it is older, install
a current Node from nodejs.org or via `nvm install 20`.

**Metro says "Unable to resolve module".** Clear the cache:

```bash
npx expo start --clear
```

**Port 8081 already in use.** Something else is on it:

```bash
npx expo start --port 8082
```

**Expo Go cannot connect to the dev server.** Same Wi-Fi network on both
devices, then press `s` in the terminal for tunnel mode. Corporate and guest
networks often block the direct connection.

**TypeScript errors in VS Code but `npm test` passes.** VS Code may be using
its own bundled TypeScript. Open any `.ts` file, press
<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *TypeScript: Select
TypeScript Version* → **Use Workspace Version**.

**The desktop app shows a blank window.** It loads from the web dev server in
dev mode, so `npm run web` has to be running first in another terminal.

**Changes to `packages/core` are not picked up.** The mobile app reads core's
source directly, so most edits hot-reload. If types look stale:

```bash
npm run build --workspace @synapse/core
```

---

## Where to change things

| You want to | Edit |
|---|---|
| Fix a typo in a lesson | `packages/core/src/content/tracks/*.ts` |
| Add a lesson or exercise | Same files — use the helpers in `content/builders.ts` |
| Change colours, spacing, type | `packages/ui/src/theme/tokens.ts` |
| Change a screen's layout | `apps/mobile/app/**` |
| Change an interactive widget | `apps/mobile/src/components/interactives/**` |
| Change grading, XP, or scheduling | `packages/core/src/engine/**` |
| Change pricing or what is free | `packages/core/src/monetization/**` |

After editing content, run `npm test` — the catalog validator checks that every
exercise's stated answer actually grades as correct, that skill references
resolve, and that no lesson ends up unreachable.
